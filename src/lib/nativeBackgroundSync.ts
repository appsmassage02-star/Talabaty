import { Capacitor, registerPlugin } from "@capacitor/core";
import { SyncQueueItem } from "./syncManager";

export interface BackgroundSyncPluginInterface {
  scheduleSync(options: {
    queue: any[];
    supabaseUrl: string;
    supabaseKey: string;
    accessToken?: string;
    refreshToken?: string;
    userId: string;
    householdId: string;
  }): Promise<{ scheduled: boolean; count: number }>;

  getSyncedOperations(): Promise<{ syncedIds: string[] }>;
  clearSyncedOperations(): Promise<{ cleared: boolean }>;
  getNativeStatus(): Promise<{ pendingCount: number; lastNativeSyncTime: number }>;
}

let nativePluginInstance: BackgroundSyncPluginInterface | null = null;

function getNativePlugin(): BackgroundSyncPluginInterface | null {
  if (typeof window === "undefined") return null;
  if (!Capacitor.isNativePlatform()) return null;

  if (!nativePluginInstance) {
    try {
      nativePluginInstance = registerPlugin<BackgroundSyncPluginInterface>("BackgroundSync");
    } catch (e) {
      console.warn("[NativeBackgroundSync] Could not register BackgroundSync plugin:", e);
      return null;
    }
  }
  return nativePluginInstance;
}

export const nativeBackgroundSync = {
  isAvailable(): boolean {
    return typeof window !== "undefined" && Capacitor.isNativePlatform();
  },

  async scheduleNativeSync(
    queue: SyncQueueItem[],
    supabaseUrl: string,
    supabaseKey: string,
    userId: string,
    householdId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<boolean> {
    const plugin = getNativePlugin();
    if (!plugin) return false;

    try {
      const pendingItems = queue.filter((q) => q.status === "PENDING" || q.status === "SYNCING");
      await plugin.scheduleSync({
        queue: pendingItems,
        supabaseUrl,
        supabaseKey,
        accessToken,
        refreshToken,
        userId,
        householdId,
      });
      return true;
    } catch (err) {
      console.warn("[NativeBackgroundSync] Failed to schedule native sync:", err);
      return false;
    }
  },

  async fetchSyncedItemIds(): Promise<string[]> {
    const plugin = getNativePlugin();
    if (!plugin) return [];

    try {
      const res = await plugin.getSyncedOperations();
      if (res && res.syncedIds && res.syncedIds.length > 0) {
        // Clear them natively once fetched so we don't re-process
        await plugin.clearSyncedOperations();
        return res.syncedIds;
      }
      return [];
    } catch (err) {
      console.warn("[NativeBackgroundSync] Error fetching synced item IDs:", err);
      return [];
    }
  },

  async getStatus(): Promise<{ pendingCount: number; lastNativeSyncTime: number } | null> {
    const plugin = getNativePlugin();
    if (!plugin) return null;

    try {
      return await plugin.getNativeStatus();
    } catch (err) {
      return null;
    }
  },
};
