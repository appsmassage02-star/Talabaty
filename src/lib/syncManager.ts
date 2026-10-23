/**
 * Authoritative Synchronization & Offline Persistent Queue Engine for Talabat Al-Bayt
 * 
 * Required Data Flow:
 * Supabase ↕ Sync Layer ↕ Local Cache ↕ React Application State
 * 
 * Invariants:
 * 1. Supabase is the single authoritative source of truth when online.
 * 2. Local cache provides seamless offline read/write capabilities without data loss.
 * 3. Persistent namespaced sync queue per (userId + householdId) preserves pending mutations across app restarts.
 * 4. Never exposes misleading "synced" status when mutations exist only locally in the queue.
 * 5. Idempotent mutations using client-assigned stable IDs prevent duplicate records on network retries.
 * 6. Conflict resolution uses timestamp / server-authoritative rules.
 * 7. Realtime subscriptions are bound strictly to authorized household and cleaned up on logout/switch.
 */

import { supabase, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from "./supabase";
import { cacheManager } from "./cacheManager";
import { RealtimeChannel } from "@supabase/supabase-js";
import { nativeBackgroundSync } from "./nativeBackgroundSync";

export type SyncState =
  | "INITIALIZING"
  | "ONLINE"
  | "OFFLINE"
  | "SYNCING"
  | "SYNCED"
  | "PENDING"
  | "SYNC_ERROR";

export type QueueItemStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED";

export type SyncEntity =
  | "missing_items"
  | "invoices"
  | "categories"
  | "household_budgets"
  | "household_permissions"
  | "notifications"
  | "household_members"
  | "households"
  | "profiles"
  | "household_products"
  | "recurring_orders"
  | "recurring_order_items"
  | "recurring_order_requests"
  | "recurring_order_request_items"
  | "admin_notifications"
  | "delivery_governorate_settings";

export type MutationType = "INSERT" | "UPDATE" | "DELETE" | "UPSERT";

export interface SyncQueueItem {
  id: string; // Unique operation ID
  entity: SyncEntity;
  type: MutationType;
  recordId: string; // Stable record ID
  payload: any;
  userId: string;
  householdId: string;
  createdAt: string; // ISO
  clientTimestamp: number; // Date.now()
  retryCount: number;
  maxRetries: number;
  status: QueueItemStatus;
  lastError?: string | null;
}

export interface SyncMetrics {
  totalPending: number;
  totalFailed: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  failedItems?: SyncQueueItem[];
}

const QUEUE_STORAGE_PREFIX = "talabat:queue";
const MAX_DEFAULT_RETRIES = 5;

export const buildQueueStorageKey = (userId: string, householdId: string): string => {
  return `${QUEUE_STORAGE_PREFIX}:${userId}:${householdId}`;
};

class SyncManager {
  private activeChannel: RealtimeChannel | null = null;
  private currentHouseholdId: string | null = null;
  private currentUserId: string | null = null;
  private currentAccessToken: string | null = null;
  private currentRefreshToken: string | null = null;
  private isProcessingQueue = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(state: SyncState, metrics: SyncMetrics) => void> = new Set();
  private realtimeCallbacks: Map<SyncEntity, (eventType: "INSERT" | "UPDATE" | "DELETE", record: any) => void> = new Map();
  
  private currentState: SyncState = "INITIALIZING";
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      // 1. Network state listeners
      window.addEventListener("online", () => {
        this.reconcileNativeSyncedOperations();
        this.handleNetworkChange(true);
      });
      window.addEventListener("offline", () => this.handleNetworkChange(false));

      // 2. Lifecycle & Foreground event listeners
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          this.reconcileNativeSyncedOperations();
          this.triggerQueueProcessing();
        }
      });
      window.addEventListener("focus", () => {
        this.reconcileNativeSyncedOperations();
        this.triggerQueueProcessing();
      });
      window.addEventListener("pageshow", () => {
        this.reconcileNativeSyncedOperations();
        this.triggerQueueProcessing();
      });

      // 3. Service Worker message listener (progressive enhancement)
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data?.type === "TRIGGER_SYNC") {
            this.triggerQueueProcessing();
          }
        });
      }

      // 4. Periodic background health check every 30s when online
      setInterval(() => {
        if (typeof navigator !== "undefined" && navigator.onLine) {
          const queue = this.getQueue();
          const hasWork = queue.some((q) => q.status === "PENDING" || q.status === "FAILED");
          if (hasWork) {
            this.triggerQueueProcessing();
          }
        }
      }, 30000);
    }
  }

  // --------------------------------------------------------------------------
  // State & Metrics Subscription
  // --------------------------------------------------------------------------
  public subscribeState(callback: (state: SyncState, metrics: SyncMetrics) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentState, this.getMetrics());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    const metrics = this.getMetrics();
    this.listeners.forEach((cb) => {
      try {
        cb(this.currentState, metrics);
      } catch (err) {
        console.warn("[SyncManager] Listener error:", err);
      }
    });
  }

  public getMetrics(): SyncMetrics {
    const queue = this.getQueue();
    const pending = queue.filter((q) => q.status === "PENDING" || q.status === "SYNCING").length;
    const failedItems = queue.filter((q) => q.status === "FAILED");
    return {
      totalPending: pending,
      totalFailed: failedItems.length,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
      failedItems,
    };
  }

  public getCurrentState(): SyncState {
    return this.currentState;
  }

  public getRecordStatus(
    entity: SyncEntity,
    recordId: string,
    userId?: string,
    householdId?: string
  ): "SYNCED" | "PENDING" | "SYNCING" | "FAILED" | "OFFLINE_CACHED" {
    const queue = this.getQueue(userId, householdId);
    const queueItem = queue.find((q) => q.entity === entity && q.recordId === recordId);
    if (queueItem) {
      if (queueItem.status === "FAILED") return "FAILED";
      if (queueItem.status === "SYNCING") return "SYNCING";
      return "PENDING";
    }
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline) {
      return "OFFLINE_CACHED";
    }
    return "SYNCED";
  }

  private setState(newState: SyncState, error?: string | null): void {
    this.currentState = newState;
    if (error !== undefined) {
      this.lastError = error;
    }
    this.notifyListeners();
  }

  // --------------------------------------------------------------------------
  // Network Lifecycle
  // --------------------------------------------------------------------------
  private async handleNetworkChange(isOnline: boolean): Promise<void> {
    console.log(`[SyncManager] Network status changed. isOnline=${isOnline}`);
    if (!isOnline) {
      this.setState("OFFLINE");
      return;
    }

    if (this.currentUserId && this.currentHouseholdId) {
      this.setState("SYNCING");
      await this.processQueue();
    } else {
      this.setState("ONLINE");
    }
  }

  // --------------------------------------------------------------------------
  // Persistent Queue Operations (Namespaced by User + Household)
  // --------------------------------------------------------------------------
  public getQueue(userId?: string, householdId?: string): SyncQueueItem[] {
    const uid = userId || this.currentUserId;
    const hid = householdId || this.currentHouseholdId;
    if (!uid || !hid || typeof window === "undefined") return [];

    try {
      const raw = localStorage.getItem(buildQueueStorageKey(uid, hid));
      if (!raw) return [];
      return JSON.parse(raw) as SyncQueueItem[];
    } catch (e) {
      console.warn("[SyncManager] Error reading persistent queue:", e);
      return [];
    }
  }

  public getPendingCount(userId?: string, householdId?: string): number {
    const queue = this.getQueue(userId, householdId);
    return queue.filter((q) => q.status === "PENDING" || q.status === "SYNCING").length;
  }

  public hasPendingOperations(userId?: string, householdId?: string): boolean {
    return this.getPendingCount(userId, householdId) > 0;
  }

  public async flushPendingOperations(): Promise<boolean> {
    if (typeof navigator !== "undefined" && !navigator.onLine) return false;
    await this.processQueue();
    return this.getPendingCount() === 0;
  }

  private saveQueue(queue: SyncQueueItem[], userId?: string, householdId?: string): void {
    const uid = userId || this.currentUserId;
    const hid = householdId || this.currentHouseholdId;
    if (!uid || !hid || typeof window === "undefined") return;

    try {
      const key = buildQueueStorageKey(uid, hid);
      if (queue.length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(queue));
      }
    } catch (e) {
      console.warn("[SyncManager] Error saving persistent queue:", e);
    }

    // Forward pending queue to Android Native WorkManager if running on Android/Capacitor
    if (nativeBackgroundSync.isAvailable()) {
      nativeBackgroundSync
        .scheduleNativeSync(
          queue,
          supabaseUrl,
          supabaseAnonKey,
          uid,
          hid,
          this.currentAccessToken || undefined,
          this.currentRefreshToken || undefined
        )
        .catch((e) => {
          console.warn("[SyncManager] Error forwarding queue to native worker:", e);
        });
    }
  }

  public setAuthSession(userId: string, householdId: string, accessToken?: string, refreshToken?: string): void {
    this.currentUserId = userId;
    this.currentHouseholdId = householdId;
    if (accessToken) {
      this.currentAccessToken = accessToken;
    }
    if (refreshToken) {
      this.currentRefreshToken = refreshToken;
    }
    this.reconcileNativeSyncedOperations();
  }

  public async reconcileNativeSyncedOperations(): Promise<void> {
    if (!nativeBackgroundSync.isAvailable() || !this.currentUserId || !this.currentHouseholdId) return;
    try {
      const syncedIds = await nativeBackgroundSync.fetchSyncedItemIds();
      if (syncedIds && syncedIds.length > 0) {
        console.log(`[SyncManager] Android WorkManager background-synced ${syncedIds.length} operations.`);
        const syncedSet = new Set(syncedIds);
        const queue = this.getQueue();
        const updated = queue.filter((q) => !syncedSet.has(q.id));
        this.saveQueue(updated);
        this.lastSyncedAt = new Date().toISOString();
        this.updateStateAfterQueueChange();
      }
    } catch (e) {
      console.warn("[SyncManager] Error reconciling native synced ops:", e);
    }
  }

  public enqueue(item: {
    entity: SyncEntity;
    type: MutationType;
    recordId: string;
    payload: any;
    userId?: string;
    householdId?: string;
  }): SyncQueueItem | null {
    return this.enqueueMutation(
      item.entity,
      item.type,
      item.recordId,
      item.payload,
      item.userId,
      item.householdId
    );
  }

  public enqueueMutation(
    entity: SyncEntity,
    type: MutationType,
    recordId: string,
    payload: any,
    userId?: string,
    householdId?: string
  ): SyncQueueItem | null {
    const uid = userId || this.currentUserId;
    const hid = householdId || this.currentHouseholdId;
    if (!uid || !hid) {
      console.warn("[SyncManager] Cannot enqueue mutation without active user and household.");
      return null;
    }

    if (this.currentUserId !== uid || this.currentHouseholdId !== hid) {
      this.currentUserId = uid;
      this.currentHouseholdId = hid;
    }

    const queue = this.getQueue();

    // Check if there is already a pending mutation for this same entity + recordId
    // If updating a record that was already queued for INSERT, merge payload into the INSERT item
    const existingInsertIdx = queue.findIndex(
      (item) => item.entity === entity && item.recordId === recordId && item.type === "INSERT" && item.status === "PENDING"
    );

    if (existingInsertIdx >= 0 && (type === "UPDATE" || type === "UPSERT")) {
      queue[existingInsertIdx].payload = {
        ...queue[existingInsertIdx].payload,
        ...payload,
      };
      queue[existingInsertIdx].clientTimestamp = Date.now();
      this.saveQueue(queue);
      this.updateStateAfterQueueChange();
      this.triggerQueueProcessing();
      return queue[existingInsertIdx];
    }

    // If deleting a record that was only queued locally for INSERT, we can cancel both
    if (existingInsertIdx >= 0 && type === "DELETE") {
      queue.splice(existingInsertIdx, 1);
      this.saveQueue(queue);
      this.updateStateAfterQueueChange();
      return null;
    }

    const newItem: SyncQueueItem = {
      id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      entity,
      type,
      recordId,
      payload,
      userId: this.currentUserId,
      householdId: this.currentHouseholdId,
      createdAt: new Date().toISOString(),
      clientTimestamp: Date.now(),
      retryCount: 0,
      maxRetries: MAX_DEFAULT_RETRIES,
      status: "PENDING",
      lastError: null,
    };

    queue.push(newItem);
    this.saveQueue(queue);
    this.updateStateAfterQueueChange();

    // Trigger immediate background sync attempt if online
    this.triggerQueueProcessing();

    return newItem;
  }

  public removeQueueItem(opId: string): void {
    const queue = this.getQueue();
    const filtered = queue.filter((item) => item.id !== opId);
    this.saveQueue(filtered);
    this.updateStateAfterQueueChange();
  }

  public retryFailedOperations(): void {
    const queue = this.getQueue();
    let updated = false;
    queue.forEach((item) => {
      if (item.status === "FAILED") {
        item.status = "PENDING";
        item.retryCount = 0;
        item.lastError = null;
        updated = true;
      }
    });

    if (updated) {
      this.saveQueue(queue);
      this.updateStateAfterQueueChange();
      this.triggerQueueProcessing();
    }
  }

  public clearAllPendingQueue(): void {
    if (!this.currentUserId || !this.currentHouseholdId) return;
    this.saveQueue([]);
    this.updateStateAfterQueueChange();
  }

  private updateStateAfterQueueChange(): void {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline) {
      this.setState("OFFLINE");
      return;
    }

    const queue = this.getQueue();
    const pending = queue.filter((q) => q.status === "PENDING" || q.status === "SYNCING");
    const failed = queue.filter((q) => q.status === "FAILED");

    if (this.isProcessingQueue) {
      this.setState("SYNCING");
    } else if (failed.length > 0 && pending.length === 0) {
      this.setState("SYNC_ERROR", this.lastError || `فشل مزامنة ${failed.length} عمليات`);
    } else if (pending.length > 0) {
      this.setState("PENDING");
    } else {
      this.setState("SYNCED");
    }
  }

  // --------------------------------------------------------------------------
  // Queue Processor with Exponential Backoff & Idempotency
  // --------------------------------------------------------------------------
  public triggerQueueProcessing(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    this.syncTimer = setTimeout(() => {
      this.processQueue();
    }, 150);
  }

  public async processQueue(): Promise<{ success: boolean; processed: number; errors: number }> {
    if (this.isProcessingQueue) {
      return { success: true, processed: 0, errors: 0 };
    }

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline || !isSupabaseConfigured() || !supabase) {
      this.setState("OFFLINE");
      return { success: false, processed: 0, errors: 0 };
    }

    if (!this.currentUserId || !this.currentHouseholdId) {
      return { success: false, processed: 0, errors: 0 };
    }

    // Reconcile any items already synced in background by Android WorkManager
    await this.reconcileNativeSyncedOperations();

    this.isProcessingQueue = true;
    this.setState("SYNCING");

    let processedCount = 0;
    let errorCount = 0;
    const CONCURRENCY_LIMIT = 4;
    const inFlightKeys = new Set<string>(); // `${entity}:${recordId}`
    const inFlightPromises = new Map<string, Promise<void>>();

    try {
      while (true) {
        // Read fresh queue directly from persistent storage
        const currentQueue = this.getQueue();

        // Check if network dropped mid-process
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          this.setState("OFFLINE");
          break;
        }

        // Identify candidate operations that can be dispatched:
        // 1. Status is PENDING and within retry limit.
        // 2. Its record is NOT currently in flight.
        // 3. Strict FIFO per entity+recordId: no earlier pending/syncing operation on the same record exists.
        const candidates: SyncQueueItem[] = [];
        const blockedKeys = new Set<string>(inFlightKeys);

        for (const item of currentQueue) {
          const key = `${item.entity}:${item.recordId}`;

          if (blockedKeys.has(key)) {
            // An earlier or in-flight operation exists for this record; preserve strict ordering!
            continue;
          }

          if (item.status === "PENDING" && item.retryCount < item.maxRetries) {
            candidates.push(item);
            blockedKeys.add(key);
            if (candidates.length >= CONCURRENCY_LIMIT - inFlightKeys.size) {
              break;
            }
          } else if (item.status === "SYNCING" || item.status === "FAILED") {
            // Block subsequent dependent operations on this record
            blockedKeys.add(key);
          }
        }

        // If no candidates are available and nothing is currently in flight, we're done
        if (candidates.length === 0 && inFlightPromises.size === 0) {
          break;
        }

        // Dispatch candidates up to concurrency limit
        for (const item of candidates) {
          const key = `${item.entity}:${item.recordId}`;
          inFlightKeys.add(key);

          // Mark item as SYNCING in storage immediately
          const qNow = this.getQueue();
          const target = qNow.find((q) => q.id === item.id);
          if (target) {
            target.status = "SYNCING";
            this.saveQueue(qNow);
          }

          const opPromise = (async () => {
            try {
              const result = await this.executeMutationOnServer(item);

              // Always read fresh queue to avoid overwriting concurrent mutations
              const freshQueue = this.getQueue();
              const idx = freshQueue.findIndex((q) => q.id === item.id);

              if (result.success) {
                // Remove confirmed operation from persistent queue ONLY on actual Supabase success
                const filteredQueue = freshQueue.filter((q) => q.id !== item.id);
                this.saveQueue(filteredQueue);
                processedCount++;
                this.lastSyncedAt = new Date().toISOString();
                this.lastError = null;
              } else {
                errorCount++;
                const errorMsg = result.error || "خطأ غير معروف في المزامنة";
                this.lastError = errorMsg;

                if (idx >= 0) {
                  freshQueue[idx].retryCount += 1;
                  freshQueue[idx].lastError = errorMsg;

                  if (freshQueue[idx].retryCount >= freshQueue[idx].maxRetries) {
                    freshQueue[idx].status = "FAILED";
                    console.error(
                      `[SyncManager] Mutation ${freshQueue[idx].id} (${freshQueue[idx].entity}:${freshQueue[idx].recordId}) exceeded max retries:`,
                      errorMsg
                    );
                  } else {
                    freshQueue[idx].status = "PENDING";
                  }
                  this.saveQueue(freshQueue);
                }

                if (result.isNetworkError) {
                  console.warn("[SyncManager] Network error during sync. Pausing queue.");
                  this.setState("OFFLINE");
                }
              }
            } catch (err: any) {
              errorCount++;
              const msg = err?.message || "خطأ عام أثناء إرسال المزامنة";
              this.lastError = msg;
              const freshQueue = this.getQueue();
              const idx = freshQueue.findIndex((q) => q.id === item.id);
              if (idx >= 0) {
                freshQueue[idx].retryCount += 1;
                freshQueue[idx].lastError = msg;
                freshQueue[idx].status =
                  freshQueue[idx].retryCount >= freshQueue[idx].maxRetries ? "FAILED" : "PENDING";
                this.saveQueue(freshQueue);
              }
            } finally {
              inFlightKeys.delete(key);
              inFlightPromises.delete(item.id);
            }
          })();

          inFlightPromises.set(item.id, opPromise);
        }

        // Wait for at least one in-flight operation to finish before scheduling next batch
        if (inFlightPromises.size > 0) {
          await Promise.race(Array.from(inFlightPromises.values()));
        }
      }

      // Await any remaining in-flight operations
      if (inFlightPromises.size > 0) {
        await Promise.all(Array.from(inFlightPromises.values()));
      }
    } catch (err: any) {
      console.error("[SyncManager] Critical queue processing error:", err);
      this.lastError = err?.message || "خطأ عام أثناء معالجة المزامنة";
    } finally {
      this.isProcessingQueue = false;
      this.updateStateAfterQueueChange();
    }

    return { success: errorCount === 0, processed: processedCount, errors: errorCount };
  }

  private async executeMutationOnServer(
    item: SyncQueueItem
  ): Promise<{ success: boolean; error?: string; isNetworkError?: boolean }> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };

    const { entity, type, recordId, payload, householdId } = item;
    const actorUserId = this.currentUserId || payload?.created_by || payload?.updated_by || null;

    try {
      switch (entity) {
        case "missing_items": {
          if (type === "INSERT" || type === "UPSERT") {
            const { error } = await supabase.from("missing_items").upsert(
              {
                id: recordId,
                household_id: householdId,
                name: payload.name,
                category: payload.category,
                category_arabic: payload.categoryArabic || payload.category_arabic || "عام",
                quantity: payload.quantity || "١",
                urgency: payload.urgency || "normal",
                notes: payload.notes || "",
                added_by: payload.addedBy || payload.added_by || "home",
                added_by_name: payload.addedByName || payload.added_by_name || "",
                completed: Boolean(payload.completed),
                completed_at: payload.completedAt || payload.completed_at || null,
                added_at: payload.addedAt || payload.added_at || new Date().toISOString(),
              },
              { onConflict: "id" }
            );
            if (error) throw error;
            return { success: true };
          } else if (type === "UPDATE") {
            const updateBody: any = {};
            if (payload.completed !== undefined) updateBody.completed = Boolean(payload.completed);
            if (payload.completed_at !== undefined) updateBody.completed_at = payload.completed_at;
            if (payload.completedAt !== undefined) updateBody.completed_at = payload.completedAt;
            if (payload.name !== undefined) updateBody.name = payload.name;
            if (payload.quantity !== undefined) updateBody.quantity = payload.quantity;
            if (payload.urgency !== undefined) updateBody.urgency = payload.urgency;
            if (payload.notes !== undefined) updateBody.notes = payload.notes;
            if (payload.category !== undefined) updateBody.category = payload.category;
            if (payload.categoryArabic !== undefined || payload.category_arabic !== undefined) {
              updateBody.category_arabic = payload.categoryArabic || payload.category_arabic;
            }

            const { error } = await supabase
              .from("missing_items")
              .update(updateBody)
              .eq("id", recordId)
              .eq("household_id", householdId);
            if (error) throw error;
            return { success: true };
          } else if (type === "DELETE") {
            const { error } = await supabase
              .from("missing_items")
              .delete()
              .eq("id", recordId)
              .eq("household_id", householdId);
            if (error) throw error;
            return { success: true };
          }
          break;
        }

        case "invoices": {
          if (type === "INSERT" || type === "UPSERT") {
            const { error } = await supabase.from("invoices").upsert(
              {
                id: recordId,
                household_id: householdId,
                invoice_number: payload.invoiceNumber || payload.invoice_number || `INV-${Date.now().toString().slice(-4)}`,
                date: payload.date || new Date().toISOString(),
                category: payload.category || "عام",
                category_arabic: payload.categoryArabic || payload.category_arabic || "عام",
                products: payload.products || [],
                total_price: Number(payload.totalPrice || payload.total_price) || 0,
                notes: payload.notes || "",
                registered_by: payload.registeredBy || payload.registered_by || "المسؤول",
                payment_method: payload.paymentMethod || payload.payment_method || "cash",
                created_at: payload.createdAt || payload.created_at || new Date().toISOString(),
              },
              { onConflict: "id" }
            );
            if (error) throw error;
            return { success: true };
          } else if (type === "UPDATE") {
            const updateBody: any = {};
            if (payload.totalPrice !== undefined || payload.total_price !== undefined) {
              updateBody.total_price = Number(payload.totalPrice || payload.total_price);
            }
            if (payload.notes !== undefined) updateBody.notes = payload.notes;
            if (payload.products !== undefined) updateBody.products = payload.products;
            if (payload.paymentMethod !== undefined || payload.payment_method !== undefined) {
              updateBody.payment_method = payload.paymentMethod || payload.payment_method;
            }
            if (payload.category !== undefined) updateBody.category = payload.category;
            if (payload.categoryArabic !== undefined || payload.category_arabic !== undefined) {
              updateBody.category_arabic = payload.categoryArabic || payload.category_arabic;
            }
            if (payload.date !== undefined) updateBody.date = payload.date;

            const { error } = await supabase
              .from("invoices")
              .update(updateBody)
              .eq("id", recordId)
              .eq("household_id", householdId);
            if (error) throw error;
            return { success: true };
          } else if (type === "DELETE") {
            const { error } = await supabase
              .from("invoices")
              .delete()
              .eq("id", recordId)
              .eq("household_id", householdId);
            if (error) throw error;
            return { success: true };
          }
          break;
        }

        case "household_permissions": {
          const { error } = await supabase.from("household_permissions").upsert(
            {
              household_id: householdId,
              allowed_screens: payload.allowedScreens || payload.allowed_screens,
              can_add_missing_item: payload.canAddMissingItem ?? payload.can_add_missing_item ?? true,
              can_delete_missing_item: payload.canDeleteMissingItem ?? payload.can_delete_missing_item ?? false,
              can_edit_item: payload.canEditItem ?? payload.can_edit_item ?? true,
              can_add_invoice: payload.canAddInvoice ?? payload.can_add_invoice ?? false,
              can_use_ai_assistant: payload.canUseAiAssistant ?? payload.can_use_ai_assistant ?? true,
              can_send_urgent_alert: payload.canSendUrgentAlert ?? payload.can_send_urgent_alert ?? true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "household_id" }
          );
          if (error) throw error;
          return { success: true };
        }

        case "household_budgets": {
          const { error } = await supabase.from("household_budgets").upsert(
            {
              household_id: householdId,
              monthly_limit: Number(payload.monthlyLimit || payload.monthly_limit) || 2500,
              currency: payload.currency || "ج.م",
              month: payload.month || "الشهر الحالي",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "household_id" }
          );
          if (error) throw error;
          return { success: true };
        }

        case "categories": {
          if (type === "INSERT" || type === "UPSERT" || type === "UPDATE") {
            // Note: Schema public.categories has primary key (household_id, id).
            const categoryData: Record<string, any> = {
              id: recordId,
              household_id: householdId,
              name_ar: payload.nameAr || payload.name_ar,
              name_en: payload.nameEn || payload.name_en || "",
              image_url: payload.imageUrl || payload.image_url || "",
              color: payload.color || "emerald",
              bg_light: payload.bgLight || payload.bg_light || "",
              badge_color: payload.badgeColor || payload.badge_color || "",
              description: payload.description || "",
              common_items: payload.commonItems || payload.common_items || [],
              subcategories: payload.subcategories || [],
              is_custom:
                payload.isCustom !== undefined
                  ? Boolean(payload.isCustom)
                  : payload.is_custom !== undefined
                  ? Boolean(payload.is_custom)
                  : false,
            };

            if (payload.source_global_category_id !== undefined || payload.sourceGlobalCategoryId !== undefined) {
              categoryData.source_global_category_id = payload.source_global_category_id ?? payload.sourceGlobalCategoryId ?? null;
            }
            if (payload.is_active !== undefined || payload.isActive !== undefined) {
              categoryData.is_active = Boolean(payload.is_active ?? payload.isActive);
            }
            if (payload.sort_order !== undefined || payload.sortOrder !== undefined) {
              categoryData.sort_order = Number(payload.sort_order ?? payload.sortOrder) || 0;
            }
            if (payload.updated_at !== undefined || payload.updatedAt !== undefined) {
              categoryData.updated_at = payload.updated_at || payload.updatedAt;
            }

            const { error } = await supabase.from("categories").upsert(
              categoryData,
              { onConflict: "household_id,id" }
            );
            if (error) throw error;
            return { success: true };
          } else if (type === "DELETE") {
            const { error } = await supabase
              .from("categories")
              .delete()
              .eq("id", recordId)
              .eq("household_id", householdId);
            if (error) throw error;
            return { success: true };
          }
          break;
        }

        case "notifications": {
          if (type === "INSERT" || type === "UPSERT") {
            const { error } = await supabase.from("notifications").upsert(
              {
                id: recordId,
                household_id: householdId,
                title: payload.title,
                message: payload.message,
                type: payload.type || "item_added",
                target_role: payload.targetRole || payload.target_role || "all",
                read: Boolean(payload.read),
                created_at: payload.timestamp || payload.created_at || new Date().toISOString(),
              },
              { onConflict: "id" }
            );
            if (error) throw error;
            return { success: true };
          } else if (type === "UPDATE") {
            const { error } = await supabase
              .from("notifications")
              .update({ read: Boolean(payload.read) })
              .eq("id", recordId)
              .eq("household_id", householdId);
            if (error) throw error;
            return { success: true };
          } else if (type === "DELETE") {
            const { error } = await supabase
              .from("notifications")
              .delete()
              .eq("id", recordId)
              .eq("household_id", householdId);
            if (error) throw error;
            return { success: true };
          }
          break;
        }

        case "household_products": {
          if (type === "INSERT" || type === "UPSERT" || type === "UPDATE") {
            const { error } = await supabase.from("household_products").upsert(
              {
                id: recordId,
                household_id: householdId,
                category_id: payload.category_id || payload.categoryId,
                subcategory_id: payload.subcategory_id || payload.subcategoryId || null,
                name_ar: payload.name_ar || payload.nameAr,
                name_en: payload.name_en || payload.nameEn || null,
                image_url: payload.image_url || payload.imageUrl || null,
                quantity: payload.quantity || "١",
                unit: payload.unit || "قطعة",
                estimated_price: Number(payload.estimated_price || payload.estimatedPrice) || 0,
                source_global_product_id: payload.source_global_product_id || payload.sourceGlobalProductId || null,
                is_custom: Boolean(payload.is_custom ?? payload.isCustom ?? false),
                is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
                sort_order: Number(payload.sort_order || payload.sortOrder) || 0,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "household_id,id" }
            );
            if (error) throw error;
            return { success: true };
          } else if (type === "DELETE") {
            const { error } = await supabase
              .from("household_products")
              .delete()
              .eq("id", recordId)
              .eq("household_id", householdId);
            if (error) throw error;
            return { success: true };
          }
          break;
        }

        case "recurring_orders": {
          if (type === "INSERT" || type === "UPSERT" || type === "UPDATE") {
            const { error } = await supabase.from("recurring_orders").upsert(
              {
                id: recordId,
                household_id: householdId,
                name: payload.name,
                frequency: payload.frequency || "weekly",
                is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
                created_by: payload.created_by || actorUserId || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );
            if (error) throw error;
            return { success: true };
          } else if (type === "DELETE") {
            const { error } = await supabase
              .from("recurring_orders")
              .delete()
              .eq("id", recordId)
              .eq("household_id", householdId);
            if (error) throw error;
            return { success: true };
          }
          break;
        }

        case "recurring_order_items": {
          if (type === "INSERT" || type === "UPSERT" || type === "UPDATE") {
            const { error } = await supabase.from("recurring_order_items").upsert(
              {
                id: recordId,
                recurring_order_id: payload.recurring_order_id || payload.recurringOrderId,
                product_id: payload.product_id || payload.productId || null,
                product_name_snapshot: payload.product_name_snapshot || payload.productNameSnapshot || payload.name,
                category_id: payload.category_id || payload.categoryId || null,
                category_name_snapshot: payload.category_name_snapshot || payload.categoryNameSnapshot || null,
                quantity: payload.quantity || "١",
                unit: payload.unit || "قطعة",
                estimated_unit_price: Number(payload.estimated_unit_price || payload.estimatedUnitPrice) || 0,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );
            if (error) throw error;
            return { success: true };
          } else if (type === "DELETE") {
            const { error } = await supabase
              .from("recurring_order_items")
              .delete()
              .eq("id", recordId);
            if (error) throw error;
            return { success: true };
          }
          break;
        }

        case "recurring_order_requests": {
          if (type === "INSERT" || type === "UPSERT" || type === "UPDATE") {
            const { error } = await supabase.from("recurring_order_requests").upsert(
              {
                id: recordId,
                household_id: householdId,
                recurring_order_id: payload.recurring_order_id || payload.recurringOrderId || null,
                created_by: payload.created_by || actorUserId || null,
                created_by_role: payload.created_by_role || payload.createdByRole || "home",
                reviewed_by: payload.reviewed_by || payload.reviewedBy || null,
                status: payload.status || "submitted",
                notes: payload.notes || null,
                review_notes: payload.review_notes || payload.reviewNotes || null,
                delivery_order_id: payload.delivery_order_id || payload.deliveryOrderId || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );
            if (error) throw error;
            return { success: true };
          } else if (type === "DELETE") {
            const { error } = await supabase
              .from("recurring_order_requests")
              .delete()
              .eq("id", recordId)
              .eq("household_id", householdId);
            if (error) throw error;
            return { success: true };
          }
          break;
        }

        case "recurring_order_request_items": {
          if (type === "INSERT" || type === "UPSERT" || type === "UPDATE") {
            const { error } = await supabase.from("recurring_order_request_items").upsert(
              {
                id: recordId,
                request_id: payload.request_id || payload.requestId,
                product_id: payload.product_id || payload.productId || null,
                product_name: payload.product_name || payload.productName,
                category_id: payload.category_id || payload.categoryId || null,
                category_name: payload.category_name || payload.categoryName || null,
                quantity: payload.quantity || "١",
                unit: payload.unit || "قطعة",
                unit_price: Number(payload.unit_price || payload.unitPrice) || 0,
                total_price: Number(payload.total_price || payload.totalPrice) || 0,
                is_modified: Boolean(payload.is_modified || payload.isModified || false),
              },
              { onConflict: "id" }
            );
            if (error) throw error;
            return { success: true };
          } else if (type === "DELETE") {
            const { error } = await supabase
              .from("recurring_order_request_items")
              .delete()
              .eq("id", recordId);
            if (error) throw error;
            return { success: true };
          }
          break;
        }

        case "delivery_governorate_settings": {
          if (type === "INSERT" || type === "UPSERT" || type === "UPDATE") {
            const { error } = await supabase.from("delivery_governorate_settings").upsert(
              {
                governorate_name: payload.governorate_name || payload.governorateName,
                governorate_code: payload.governorate_code || payload.governorateCode,
                is_active: Boolean(payload.is_active ?? payload.isActive ?? true),
                delivery_fee: Number(payload.delivery_fee || payload.deliveryFee) || 15,
                updated_by: actorUserId || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "governorate_name" }
            );
            if (error) throw error;
            return { success: true };
          }
          break;
        }

        case "admin_notifications": {
          if (type === "INSERT" || type === "UPSERT" || type === "UPDATE") {
            const { error } = await supabase.from("admin_notifications").upsert(
              {
                id: recordId,
                title: payload.title || null,
                body: payload.body,
                type: payload.type || "top_banner",
                image_url: payload.image_url || payload.imageUrl || null,
                icon_name: payload.icon_name || payload.iconName || "Bell",
                action_type: payload.action_type || payload.actionType || "internal_route",
                action_route: payload.action_route || payload.actionRoute || null,
                target_scope: payload.target_scope || payload.targetScope || "all",
                target_value: payload.target_value || payload.targetValue || null,
                max_display_count: Number(payload.max_display_count || payload.maxDisplayCount) || 3,
                start_at: payload.start_at || payload.startAt || new Date().toISOString(),
                end_at: payload.end_at || payload.endAt || null,
                is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
                created_by: payload.created_by || actorUserId || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );
            if (error) throw error;
            return { success: true };
          } else if (type === "DELETE") {
            const { error } = await supabase
              .from("admin_notifications")
              .delete()
              .eq("id", recordId);
            if (error) throw error;
            return { success: true };
          }
          break;
        }

        default: {
          console.warn(`[SyncManager] Unsupported entity for mutation: ${entity}`);
          return { success: false, error: `كيان غير مدعوم للمزامنة: ${entity}` };
        }
      }

      return { success: true };
    } catch (err: any) {
      console.warn(`[SyncManager] Server mutation failed for ${entity} [${type}]:`, err);
      const isNet =
        err?.message?.includes("fetch") ||
        err?.message?.includes("network") ||
        err?.message?.includes("Failed to fetch") ||
        !navigator.onLine;
      const errorMsg =
        err?.message ||
        err?.details ||
        err?.hint ||
        (typeof err === "object" ? JSON.stringify(err) : String(err)) ||
        "فشلت العملية على الخادم";
      return { success: false, error: errorMsg, isNetworkError: isNet };
    }
  }

  // --------------------------------------------------------------------------
  // Realtime Subscriptions Management (Strictly Household Scoped)
  // --------------------------------------------------------------------------
  public registerRealtimeCallback(
    entity: SyncEntity,
    callback: (eventType: "INSERT" | "UPDATE" | "DELETE", record: any) => void
  ): () => void {
    this.realtimeCallbacks.set(entity, callback);
    return () => {
      this.realtimeCallbacks.delete(entity);
    };
  }

  public setupRealtimeSubscriptions(userId: string, householdId: string, forceReconnect = false): void {
    if (!userId || !householdId || !isSupabaseConfigured() || !supabase) {
      return;
    }

    // If already subscribed to the same household and not forcing reconnect, skip duplicate
    if (!forceReconnect && this.activeChannel && this.currentHouseholdId === householdId && this.currentUserId === userId) {
      return;
    }

    // Clean up any existing channel before establishing new one
    this.cleanupRealtimeSubscriptions();

    this.currentUserId = userId;
    this.currentHouseholdId = householdId;

    const channelName = `realtime:household:${householdId}`;
    console.log(`[SyncManager] Establishing authoritative Realtime channel: ${channelName}`);

    const channel = supabase.channel(channelName);

    const handleRealtimePayload = (entity: SyncEntity, eventType: "INSERT" | "UPDATE" | "DELETE", payload: any) => {
      const record = eventType === "DELETE" ? payload.old : payload.new;
      if (!record) return;

      // Filter to ensure strictly household scope (defense in depth)
      const recordHhId = record.household_id || record.householdId || (entity === "households" ? record.id : undefined);
      if (recordHhId && recordHhId !== this.currentHouseholdId) {
        console.warn(`[SyncManager] Ignoring cross-household Realtime event for ${entity}`);
        return;
      }

      // Check if there is an in-flight or pending local mutation for this record
      const queue = this.getQueue();
      const hasPendingLocal = queue.some(
        (q) => q.entity === entity && q.recordId === record.id && (q.status === "PENDING" || q.status === "SYNCING")
      );

      if (hasPendingLocal) {
        console.log(`[SyncManager] Record ${record.id} has active local mutation in queue. Reconciling deterministically.`);
        // Let the local queue take precedence, server will confirm on sync completion
        return;
      }

      const cb = this.realtimeCallbacks.get(entity);
      if (cb) {
        cb(eventType, record);
      }
    };

    // Subscriptions for all household entities and user-associated records
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "missing_items", filter: `household_id=eq.${householdId}` },
        (payload) => handleRealtimePayload("missing_items", payload.eventType as any, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices", filter: `household_id=eq.${householdId}` },
        (payload) => handleRealtimePayload("invoices", payload.eventType as any, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "household_permissions", filter: `household_id=eq.${householdId}` },
        (payload) => handleRealtimePayload("household_permissions", payload.eventType as any, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "household_budgets", filter: `household_id=eq.${householdId}` },
        (payload) => handleRealtimePayload("household_budgets", payload.eventType as any, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories", filter: `household_id=eq.${householdId}` },
        (payload) => handleRealtimePayload("categories", payload.eventType as any, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `household_id=eq.${householdId}` },
        (payload) => handleRealtimePayload("notifications", payload.eventType as any, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "household_members", filter: `household_id=eq.${householdId}` },
        (payload) => handleRealtimePayload("household_members", payload.eventType as any, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "households", filter: `id=eq.${householdId}` },
        (payload) => handleRealtimePayload("households", payload.eventType as any, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => handleRealtimePayload("profiles", payload.eventType as any, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "household_products", filter: `household_id=eq.${householdId}` },
        (payload) => handleRealtimePayload("household_products", payload.eventType as any, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recurring_orders", filter: `household_id=eq.${householdId}` },
        (payload) => handleRealtimePayload("recurring_orders", payload.eventType as any, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recurring_order_requests", filter: `household_id=eq.${householdId}` },
        (payload) => handleRealtimePayload("recurring_order_requests", payload.eventType as any, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_notifications" },
        (payload) => handleRealtimePayload("admin_notifications", payload.eventType as any, payload)
      );

    channel.subscribe((status) => {
      console.log(`[SyncManager] Realtime subscription status for ${householdId}:`, status);
      if (status === "SUBSCRIBED") {
        this.updateStateAfterQueueChange();
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        if (typeof navigator !== "undefined" && navigator.onLine && this.currentUserId && this.currentHouseholdId) {
          setTimeout(() => {
            if (this.currentUserId && this.currentHouseholdId) {
              this.setupRealtimeSubscriptions(this.currentUserId, this.currentHouseholdId, true);
            }
          }, 3500);
        }
      }
    });

    this.activeChannel = channel;

    // Check for any pending items from earlier session / restart and process them
    this.updateStateAfterQueueChange();
    this.triggerQueueProcessing();
  }

  public reconnectRealtime(): void {
    if (this.currentUserId && this.currentHouseholdId) {
      this.setupRealtimeSubscriptions(this.currentUserId, this.currentHouseholdId, true);
    }
  }

  public cleanupRealtimeSubscriptions(): void {
    if (this.activeChannel && supabase) {
      console.log(`[SyncManager] Cleaning up Realtime channel: ${this.activeChannel.topic}`);
      supabase.removeChannel(this.activeChannel);
      this.activeChannel = null;
    }
  }

  public handleUserLogout(): void {
    this.cleanupRealtimeSubscriptions();
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.currentUserId = null;
    this.currentHouseholdId = null;
    this.isProcessingQueue = false;
    this.setState("INITIALIZING");
  }

  public handleHouseholdSwitch(newHouseholdId: string | null): void {
    this.cleanupRealtimeSubscriptions();
    this.currentHouseholdId = newHouseholdId;
    if (newHouseholdId && this.currentUserId) {
      this.setupRealtimeSubscriptions(this.currentUserId, newHouseholdId);
    } else {
      this.setState("INITIALIZING");
    }
  }
}

export const syncManager = new SyncManager();
