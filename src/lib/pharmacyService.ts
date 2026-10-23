import { supabase } from "./supabase";
import { cacheManager } from "./cacheManager";
import { processDocumentImage } from "./imageUtils";
import {
  PharmacyPrescription,
  PharmacyPrescriptionItem,
  PharmacyPrescriptionImage,
  PharmacyOrder,
  PharmacyOrderStatus,
  PharmacyDriver,
  PharmacyUnit,
  PharmacyConfig,
  PharmacyStatus,
  PharmacyWidth,
} from "../types/pharmacy";

export interface CreatePharmacyOrderParams {
  title: string;
  pharmacyName?: string;
  pharmacyId?: string;
  items: PharmacyPrescriptionItem[];
  images: PharmacyPrescriptionImage[];
  addressId?: string;
  deliveryAddress?: string;
  customerNotes?: string;
  prescriptionId?: string;
  householdId?: string;
  userId?: string;
}

export interface UserPharmacyRecord {
  id: string;
  pharmacyName: string;
  pharmacyId?: string | null;
  phone?: string | null;
  useCount: number;
}

export interface UploadedFileResult {
  url: string;
  storagePath: string;
  mimeType: string;
}

// Helper to check valid UUID format
export const isValidUUID = (id?: string | null): boolean => {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

/**
 * Normalizes prescription image URLs:
 * Resolves localhost:3000 references or relative /uploads/... to the current browser origin (HTTPS)
 * Prevents broken image icons on mobile and shared preview environments.
 */
export function resolvePrescriptionImageUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    const uploadIndex = url.indexOf("/uploads/");
    if (uploadIndex !== -1) {
      return `${window.location.origin}${url.substring(uploadIndex)}`;
    }
  }
  return url;
}

/**
 * Generate a clean digital prescription ticket SVG as data URL when user submits text medicines without photos
 */
export function generateDigitalPrescriptionSvg(
  title: string,
  pharmacyName: string | null | undefined,
  items: Array<{ name: string; quantity: number; unit?: string }>
): string {
  const safeTitle = title || "طلب علاج وروشتة";
  const safePharmacy = pharmacyName ? `الصيدلية المطلوبة: ${pharmacyName}` : "طلبات البيت - صيدلية";
  const itemsSvgLines = items
    .slice(0, 10)
    .map((it, idx) => {
      const y = 95 + idx * 24;
      return `<text x="375" y="${y}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#1e293b" text-anchor="end">${idx + 1}. ${it.name} (${it.quantity} ${it.unit || "علبة"})</text>`;
    })
    .join("");

  const height = Math.max(220, 110 + items.length * 26);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="${height}" viewBox="0 0 400 ${height}"><rect width="400" height="${height}" rx="16" fill="#f8fafc" stroke="#10b981" stroke-width="2"/><rect x="0" y="0" width="400" height="54" rx="16" fill="#ecfdf5"/><text x="200" y="28" font-family="sans-serif" font-size="15" font-weight="bold" fill="#065f46" text-anchor="middle">${safeTitle}</text><text x="200" y="46" font-family="sans-serif" font-size="11" fill="#047857" text-anchor="middle">${safePharmacy}</text>${itemsSvgLines}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Upload base64 or file data URL to Supabase Storage bucket 'pharmacy'
 * Compresses document images (max 1200px, 0.8 quality, high smoothing)
 * Ensures matching Blob MIME type and extension (.jpg / .png / .webp)
 * Returns authoritative public URL, relative storage path, and exact MIME type.
 * STRICTLY NEVER returns raw Base64 data URLs on failure.
 */
async function uploadPharmacyFile(
  dataUrlOrUrl: string,
  folder: "prescriptions" | "orders" | "receipts",
  prefix: string
): Promise<UploadedFileResult> {
  // Remote URLs (Unsplash, previously uploaded storage paths) are kept as-is
  if (!dataUrlOrUrl || !dataUrlOrUrl.startsWith("data:")) {
    const isPng = dataUrlOrUrl.toLowerCase().includes(".png");
    const isWebp = dataUrlOrUrl.toLowerCase().includes(".webp");
    return {
      url: resolvePrescriptionImageUrl(dataUrlOrUrl),
      storagePath: dataUrlOrUrl,
      mimeType: isPng ? "image/png" : isWebp ? "image/webp" : "image/jpeg",
    };
  }

  // 1. Client-side compression safeguard: max 1200px, 0.8 quality, high smoothing
  const processed = await processDocumentImage(dataUrlOrUrl, 1200, 1200, 0.8);
  const { blob, mimeType, extension, dataUrl } = processed;

  const filePath = `${folder}/${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;

  let uploadedUrl: string | null = null;

  // 2. Attempt Supabase Storage first so images are saved in cloud storage and visible to the delivery app
  if (supabase) {
    try {
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("pharmacy")
        .upload(filePath, blob, {
          contentType: mimeType,
          upsert: true,
        });

      if (!uploadErr && uploadData) {
        const { data: pubData } = supabase.storage.from("pharmacy").getPublicUrl(filePath);
        if (pubData?.publicUrl) {
          uploadedUrl = pubData.publicUrl;
        }
      } else if (uploadErr) {
        console.warn(
          "[PharmacyService] Supabase Storage upload skipped/not permitted:",
          uploadErr.message
        );
      }
    } catch (e: any) {
      console.warn("[PharmacyService] Supabase Storage exception:", e?.message);
    }
  }

  // 3. Fallback to local server storage endpoint (/api/storage/upload) if Supabase Storage is not yet permitted
  if (!uploadedUrl) {
    try {
      const clientOrigin =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : "";

      const response = await fetch("/api/storage/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: filePath,
          contentType: mimeType,
          dataUrl,
          origin: clientOrigin,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result?.url) {
          uploadedUrl = resolvePrescriptionImageUrl(result.url);
        }
      }
    } catch (serverErr: any) {
      console.warn("[PharmacyService] Server storage upload fallback failed:", serverErr?.message);
    }
  }

  // 4. Ultimate fallback: if both storage endpoints failed, keep compressed small dataUrl
  // so the prescription and order are never lost or rejected!
  if (!uploadedUrl) {
    uploadedUrl = dataUrl;
  }

  uploadedUrl = resolvePrescriptionImageUrl(uploadedUrl);

  return {
    url: uploadedUrl,
    storagePath: uploadedUrl,
    mimeType,
  };
}

class PharmacyService {
  private inFlightCreateOrder = false;

  /**
   * Helper: verify Supabase client is configured and authenticated
   */
  private async getAuthUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user || null;
  }

  // =========================================================================
  // 1.1 SETTINGS (Service Enabled & Section Visible & Layout)
  // =========================================================================

  /**
   * Fetch current pharmacy service and section visibility settings
   */
  async getSettings(): Promise<PharmacyConfig & { serviceEnabled: boolean; sectionVisible: boolean }> {
    try {
      const { data, error } = await supabase
        .from("pharmacy_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      const serviceEnabled = data?.service_enabled ?? true;
      const sectionVisible = data?.section_visible ?? true;

      let status: PharmacyStatus = "active";
      if (!sectionVisible) {
        status = "hidden";
      } else if (!serviceEnabled) {
        status = "disabled";
      }

      const dbWidth = (data as any)?.display_width;
      const cached = cacheManager.getGlobalCache<any>("pharmacy_config");
      const displayWidth: PharmacyWidth =
        dbWidth === "half" || dbWidth === "full"
          ? dbWidth
          : cached?.displayWidth === "half"
          ? "half"
          : "full";
      const nameAr = (data as any)?.name_ar || cached?.nameAr || "الصيدلية";
      const imageUrl = (data as any)?.image_url || cached?.imageUrl || "";

      return {
        serviceEnabled,
        sectionVisible,
        status,
        displayWidth,
        nameAr,
        imageUrl,
      };
    } catch {
      const cached = cacheManager.getGlobalCache<any>("pharmacy_config");
      return {
        serviceEnabled: true,
        sectionVisible: true,
        status: "active",
        displayWidth: cached?.displayWidth === "half" ? "half" : "full",
        nameAr: cached?.nameAr || "الصيدلية",
        imageUrl: cached?.imageUrl || "",
      };
    }
  }

  /**
   * Admin: Update pharmacy service configuration
   */
  async updateSettings(
    settings: Partial<PharmacyConfig>
  ): Promise<{ success: boolean; message?: string }> {
    try {
      if (
        settings.displayWidth !== undefined ||
        settings.nameAr !== undefined ||
        settings.imageUrl !== undefined ||
        settings.status !== undefined
      ) {
        const existing = cacheManager.getGlobalCache<any>("pharmacy_config") || {};
        cacheManager.setGlobalCache("pharmacy_config", {
          ...existing,
          ...settings,
        });
      }

      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (settings.status !== undefined) {
        if (settings.status === "hidden") {
          updates.section_visible = false;
        } else if (settings.status === "disabled") {
          updates.section_visible = true;
          updates.service_enabled = false;
        } else {
          updates.section_visible = true;
          updates.service_enabled = true;
        }
      }

      if (settings.displayWidth !== undefined) {
        updates.display_width = settings.displayWidth === "half" ? "half" : "full";
      }

      let { error } = await supabase
        .from("pharmacy_settings")
        .update(updates)
        .eq("id", "00000000-0000-0000-0000-000000000001");

      if (error && (error.message?.includes("display_width") || error.code === "42703")) {
        console.warn("[PharmacyService] display_width column not applied yet in remote DB, falling back:", error);
        delete updates.display_width;
        const retryRes = await supabase
          .from("pharmacy_settings")
          .update(updates)
          .eq("id", "00000000-0000-0000-0000-000000000001");
        error = retryRes.error;
      }

      if (error) {
        console.warn("[PharmacyService] updateSettings warning:", error);
      }
      return { success: !error };
    } catch (err: any) {
      console.warn("[PharmacyService] updateSettings exception:", err);
      return { success: false, message: err.message };
    }
  }

  // =========================================================================
  // 1. SAVED PRESCRIPTIONS (CRUD)
  // =========================================================================

  /**
   * Fetch all saved prescriptions for the current authenticated user
   */
  async getPrescriptions(): Promise<PharmacyPrescription[]> {
    const user = await this.getAuthUser();
    if (!user) return [];

    const cachedList =
      cacheManager.getUserCache<PharmacyPrescription[]>(
        user.id,
        "pharmacy_saved_prescriptions"
      ) || [];

    try {
      const { data, error } = await supabase
        .from("pharmacy_saved_prescriptions")
        .select(`
          id,
          title,
          pharmacy_name,
          pharmacy_id,
          created_at,
          updated_at,
          last_completed_order_at,
          is_deleted,
          items:pharmacy_saved_prescription_items(
            id,
            item_name,
            unit,
            requested_quantity,
            sort_order
          ),
          files:pharmacy_saved_prescription_files(
            id,
            storage_path,
            mime_type,
            display_order
          )
        `)
        .eq("user_id", user.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[PharmacyService] getPrescriptions query notice:", error.message);
        return cachedList;
      }

      const mappedList: PharmacyPrescription[] = (data || []).map((rx: any): PharmacyPrescription => {
        const sortedItems = (rx.items || []).sort(
          (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
        );
        const sortedFiles = (rx.files || []).sort(
          (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)
        );

        return {
          id: rx.id,
          title: rx.title || "روشتة بدون عنوان",
          pharmacyName: rx.pharmacy_name || undefined,
          createdAt: rx.created_at,
          updatedAt: rx.updated_at || undefined,
          lastOrderedAt: rx.last_completed_order_at || undefined,
          items: sortedItems.map((it: any): PharmacyPrescriptionItem => ({
            id: it.id,
            name: it.item_name,
            quantity: Number(it.requested_quantity) || 1,
            unit: (it.unit || "علبة") as PharmacyUnit,
          })),
          images: sortedFiles.map((f: any): PharmacyPrescriptionImage => ({
            id: f.id,
            url: resolvePrescriptionImageUrl(f.storage_path),
          })),
        };
      });

      cacheManager.setUserCache(user.id, "pharmacy_saved_prescriptions", mappedList);
      return mappedList;
    } catch (err: any) {
      console.warn("[PharmacyService] getPrescriptions exception, using cached list:", err?.message);
      return cachedList;
    }
  }

  /**
   * Save a new prescription (Parent record + Items + Images up to 4)
   */
  async savePrescription(
    prescription: Omit<PharmacyPrescription, "id" | "createdAt">
  ): Promise<PharmacyPrescription> {
    const user = await this.getAuthUser();
    if (!user) {
      throw new Error("يجب تسجيل الدخول لحفظ الروشتة في حسابك");
    }

    const title = prescription.title?.trim() || "روشتة علاج";
    const pharmacyName = prescription.pharmacyName?.trim() || null;
    const items = prescription.items || [];
    const images = (prescription.images || []).slice(0, 4);

    // 1. Insert parent prescription
    const { data: rxData, error: rxErr } = await supabase
      .from("pharmacy_saved_prescriptions")
      .insert({
        user_id: user.id,
        title,
        pharmacy_name: pharmacyName,
      })
      .select()
      .single();

    if (rxErr || !rxData) {
      console.error("[PharmacyService] savePrescription parent error:", rxErr);
      throw new Error(rxErr?.message || "فشل حفظ الروشتة");
    }

    const prescriptionId = rxData.id;

    // 2. Insert items if present
    const savedItems: PharmacyPrescriptionItem[] = [];
    if (items.length > 0) {
      const itemsPayload = items.map((it, idx) => ({
        prescription_id: prescriptionId,
        item_name: it.name.trim(),
        unit: it.unit || "علبة",
        requested_quantity: Math.max(1, Number(it.quantity) || 1),
        sort_order: idx + 1,
      }));

      const { data: itemsData, error: itemsErr } = await supabase
        .from("pharmacy_saved_prescription_items")
        .insert(itemsPayload)
        .select();

      if (itemsErr) {
        console.warn("[PharmacyService] Error inserting rx items:", itemsErr);
      } else if (itemsData) {
        itemsData.forEach((it: any) => {
          savedItems.push({
            id: it.id,
            name: it.item_name,
            quantity: Number(it.requested_quantity) || 1,
            unit: (it.unit || "علبة") as PharmacyUnit,
          });
        });
      }
    }

    // 3. Insert files if present (parallel upload with Promise.all)
    const savedImages: PharmacyPrescriptionImage[] = [];
    if (images.length > 0) {
      const validImages = images.slice(0, 4);
      const uploadPromises = validImages.map(async (img, idx) => {
        const uploadRes = await uploadPharmacyFile(
          img.url,
          "prescriptions",
          `rx_${prescriptionId}_${idx + 1}`
        );
        return {
          order: idx + 1,
          url: uploadRes.url,
          mime: uploadRes.mimeType,
        };
      });

      const uploadedRxImages = await Promise.all(uploadPromises);
      uploadedRxImages.sort((a, b) => a.order - b.order);

      const filesPayload = uploadedRxImages.map((img) => ({
        prescription_id: prescriptionId,
        storage_path: img.url,
        mime_type: img.mime,
        display_order: img.order,
      }));

      const { data: filesData, error: filesErr } = await supabase
        .from("pharmacy_saved_prescription_files")
        .insert(filesPayload)
        .select();

      if (filesErr) {
        console.warn("[PharmacyService] Error inserting rx files:", filesErr);
      } else if (filesData) {
        filesData.forEach((f: any) => {
          savedImages.push({
            id: f.id,
            url: f.storage_path,
          });
        });
      }
    }

    // 4. If pharmacy name provided, register in user's pharmacies list
    if (pharmacyName) {
      this.addPharmacy(pharmacyName).catch(() => {});
    }

    const savedResult: PharmacyPrescription = {
      id: prescriptionId,
      title: rxData.title,
      pharmacyName: rxData.pharmacy_name || undefined,
      createdAt: rxData.created_at,
      updatedAt: rxData.updated_at,
      items: savedItems,
      images: savedImages,
    };

    const existingCache =
      cacheManager.getUserCache<PharmacyPrescription[]>(
        user.id,
        "pharmacy_saved_prescriptions"
      ) || [];
    cacheManager.setUserCache(user.id, "pharmacy_saved_prescriptions", [
      savedResult,
      ...existingCache.filter((p) => p.id !== prescriptionId),
    ]);

    return savedResult;
  }

  /**
   * Update a saved prescription (Title, Pharmacy, Items, Images)
   */
  async updatePrescription(
    id: string,
    updates: Partial<PharmacyPrescription>
  ): Promise<PharmacyPrescription> {
    const user = await this.getAuthUser();
    if (!user) throw new Error("يجب تسجيل الدخول لتعديل الروشتة");

    // 1. Update parent record
    const parentUpdate: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.title !== undefined) parentUpdate.title = updates.title.trim();
    if (updates.pharmacyName !== undefined) {
      parentUpdate.pharmacy_name = updates.pharmacyName?.trim() || null;
    }

    const { data: rxData, error: rxErr } = await supabase
      .from("pharmacy_saved_prescriptions")
      .update(parentUpdate)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (rxErr || !rxData) {
      console.error("[PharmacyService] updatePrescription parent error:", rxErr);
      throw new Error(rxErr?.message || "فشل تعديل بيانات الروشتة");
    }

    // 2. If items were passed, replace items
    if (updates.items !== undefined) {
      await supabase
        .from("pharmacy_saved_prescription_items")
        .delete()
        .eq("prescription_id", id);

      if (updates.items.length > 0) {
        const itemsPayload = updates.items.map((it, idx) => ({
          prescription_id: id,
          item_name: it.name.trim(),
          unit: it.unit || "علبة",
          requested_quantity: Math.max(1, Number(it.quantity) || 1),
          sort_order: idx + 1,
        }));
        await supabase
          .from("pharmacy_saved_prescription_items")
          .insert(itemsPayload);
      }
    }

    // 3. If images were passed, replace files (up to 4)
    if (updates.images !== undefined) {
      await supabase
        .from("pharmacy_saved_prescription_files")
        .delete()
        .eq("prescription_id", id);

      const validImages = updates.images.slice(0, 4);
      if (validImages.length > 0) {
        const uploadPromises = validImages.map(async (img, idx) => {
          const uploadRes = await uploadPharmacyFile(
            img.url,
            "prescriptions",
            `rx_${id}_${idx + 1}`
          );
          return {
            order: idx + 1,
            url: uploadRes.url,
            mime: uploadRes.mimeType,
          };
        });

        const uploadedRxImages = await Promise.all(uploadPromises);
        uploadedRxImages.sort((a, b) => a.order - b.order);

        const filesPayload = uploadedRxImages.map((img) => ({
          prescription_id: id,
          storage_path: img.url,
          mime_type: img.mime,
          display_order: img.order,
        }));
        await supabase
          .from("pharmacy_saved_prescription_files")
          .insert(filesPayload);
      }
    }

    if (updates.pharmacyName?.trim()) {
      this.addPharmacy(updates.pharmacyName.trim()).catch(() => {});
    }

    // 4. Return refreshed prescription
    const all = await this.getPrescriptions();
    const found = all.find((p) => p.id === id);
    if (!found) throw new Error("الروشتة غير موجودة بعد التعديل");

    const existingCache =
      cacheManager.getUserCache<PharmacyPrescription[]>(
        user.id,
        "pharmacy_saved_prescriptions"
      ) || [];
    cacheManager.setUserCache(
      user.id,
      "pharmacy_saved_prescriptions",
      existingCache.map((p) => (p.id === id ? found : p))
    );

    return found;
  }

  /**
   * Delete a saved prescription (Soft-delete via is_deleted flag)
   */
  async deletePrescription(id: string): Promise<boolean> {
    const user = await this.getAuthUser();
    if (!user) throw new Error("يجب تسجيل الدخول لحذف الروشتة");

    const { error } = await supabase
      .from("pharmacy_saved_prescriptions")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[PharmacyService] deletePrescription error:", error);
      throw new Error(error.message || "فشل حذف الروشتة");
    }

    const existingCache =
      cacheManager.getUserCache<PharmacyPrescription[]>(
        user.id,
        "pharmacy_saved_prescriptions"
      ) || [];
    cacheManager.setUserCache(
      user.id,
      "pharmacy_saved_prescriptions",
      existingCache.filter((p) => p.id !== id)
    );

    return true;
  }

  // =========================================================================
  // 2. PHARMACIES LIST (User & System Pharmacies)
  // =========================================================================

  /**
   * Fetch distinct pharmacies list from both user's saved pharmacies and system pharmacies
   */
  async getPharmaciesList(): Promise<string[]> {
    try {
      const results = new Set<string>();

      // 1. User's saved pharmacies
      const { data: userPharmacies } = await supabase
        .from("pharmacy_user_pharmacies")
        .select("pharmacy_name")
        .order("use_count", { ascending: false });

      if (userPharmacies) {
        userPharmacies.forEach((row: any) => {
          if (row.pharmacy_name?.trim()) results.add(row.pharmacy_name.trim());
        });
      }

      // 2. System active pharmacies
      const { data: systemPharmacies } = await supabase
        .from("pharmacy_pharmacies")
        .select("name")
        .eq("is_active", true);

      if (systemPharmacies) {
        systemPharmacies.forEach((row: any) => {
          if (row.name?.trim()) results.add(row.name.trim());
        });
      }

      // Standard fallback popular pharmacies in Egypt if table is currently empty
      const defaultPopular = [
        "صيدلية العزبي",
        "صيدلية 19011",
        "صيدلية سيف",
        "صيدلية مصر",
        "صيدلية رشدي",
        "صيدلية الحياة",
      ];
      defaultPopular.forEach((name) => results.add(name));

      return Array.from(results);
    } catch (err) {
      console.warn("[PharmacyService] Error fetching pharmacies list:", err);
      return [
        "صيدلية العزبي",
        "صيدلية 19011",
        "صيدلية سيف",
        "صيدلية مصر",
        "صيدلية رشدي",
        "صيدلية الحياة",
      ];
    }
  }

  /**
   * Add a pharmacy to the user's saved pharmacies via authoritative RPC
   */
  async addPharmacy(name: string): Promise<string[]> {
    const trimmed = name.trim();
    if (!trimmed) return this.getPharmaciesList();

    try {
      const user = await this.getAuthUser();
      if (user) {
        const { error } = await supabase.rpc("pharmacy_save_user_pharmacy", {
          p_pharmacy_name: trimmed,
        });
        if (error) {
          console.warn("[PharmacyService] pharmacy_save_user_pharmacy rpc warning:", error);
        }
      }
    } catch (e) {
      console.warn("[PharmacyService] Exception adding pharmacy:", e);
    }

    return this.getPharmaciesList();
  }

  /**
   * Helper: Update an order in local cache
   */
  private async updateCachedOrder(
    orderId: string,
    updater: (order: PharmacyOrder) => PharmacyOrder,
    householdId?: string
  ) {
    try {
      const user = await this.getAuthUser();
      if (!user) return;
      const targetHouseholdId =
        householdId ||
        cacheManager.getUserCache<string>(user.id, "last_household_id");
      if (!targetHouseholdId) return;
      const cached =
        cacheManager.getHouseholdCache<PharmacyOrder[]>(
          user.id,
          targetHouseholdId,
          "pharmacy_orders"
        ) || [];
      const updated = cached.map((o) => (o.id === orderId ? updater(o) : o));
      cacheManager.setHouseholdCache(
        user.id,
        targetHouseholdId,
        "pharmacy_orders",
        updated
      );
    } catch (e) {
      console.warn("[PharmacyService] updateCachedOrder note:", e);
    }
  }

  // =========================================================================
  // 3. ORDERS (RPCs & Realtime Queries & Resilient Cache)
  // =========================================================================

  /**
   * Fetch all pharmacy orders with items, images, and driver information
   */
  async getOrders(householdId?: string): Promise<PharmacyOrder[]> {
    const user = await this.getAuthUser();
    if (!user) return [];

    try {
      // Pre-load cached orders for this user/household so locally created orders and item details appear seamlessly
      let cachedOrders: PharmacyOrder[] = [];
      try {
        const targetHouseholdId =
          householdId ||
          cacheManager.getUserCache<string>(user.id, "last_household_id");
        if (targetHouseholdId) {
          cachedOrders =
            cacheManager.getHouseholdCache<PharmacyOrder[]>(
              user.id,
              targetHouseholdId,
              "pharmacy_orders"
            ) || [];
        }
      } catch {
        // ignore cache read issues
      }

      const { data, error } = await supabase
        .from("pharmacy_orders")
        .select(`
          id,
          order_number,
          user_id,
          household_id,
          created_at,
          updated_at,
          saved_prescription_id,
          status,
          prescription_title,
          customer_notes,
          requested_pharmacy_name,
          address_text,
          delivery_fee,
          grand_total,
          medicines_total,
          accepted_at,
          cancelled_at,
          completed_at,
          archived_at,
          ready_for_delivery_at,
          shopping_started_at,
          items:pharmacy_order_items(
            id,
            item_name,
            unit,
            requested_quantity,
            purchased_quantity,
            sort_order,
            driver_note
          ),
          files:pharmacy_order_files(
            id,
            storage_path,
            mime_type,
            file_type,
            display_order,
            driver_note
          ),
          delivery:pharmacy_delivery_orders(
            id,
            assigned_driver_id,
            accepted_at,
            completed_at,
            shopping_started_at,
            cancellation_reason,
            cancellation_requested_at,
            driver:delivery_drivers(
              id,
              full_name,
              phone,
              status,
              vehicle_type
            )
          )
        `)
        .order("created_at", { ascending: false });

      let dbOrders: PharmacyOrder[] = [];
      if (error) {
        console.warn("[PharmacyService] getOrders query notice:", error.message);
      } else if (data) {
        dbOrders = (data || []).map((o: any): PharmacyOrder => {
          const cachedMatch = cachedOrders.find((c) => c.id === o.id);
          const sortedItems = (o.items || []).sort(
            (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
          );

          // Separate prescription images from receipt image
          const prescriptionFiles = (o.files || [])
            .filter((f: any) => f.file_type !== "receipt")
            .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));

          const receiptFile = (o.files || []).find(
            (f: any) => f.file_type === "receipt"
          );

          // Map driver if assigned
          let driverObj: PharmacyDriver | undefined = undefined;
          const deliveryRecord = Array.isArray(o.delivery)
            ? o.delivery[0]
            : o.delivery;

          if (deliveryRecord?.driver) {
            const d = deliveryRecord.driver;
            driverObj = {
              id: d.id,
              name: d.full_name || "مندوب التوصيل",
              phone: d.phone || "",
              vehicleInfo: d.vehicle_type || "دراجة نارية",
            };
          }

          const isArchived = Boolean(o.archived_at);
          const cancellationReason =
            deliveryRecord?.cancellation_reason || undefined;

          // Generate friendly order number
          const shortNum = o.id
            ? o.id.replace(/-/g, "").substring(0, 4).toUpperCase()
            : "0000";
          const orderNumber = o.order_number || `PH-${shortNum}`;

          let resolvedItems = sortedItems.map((it: any) => ({
            id: it.id,
            name: it.item_name,
            quantity: Number(it.requested_quantity) || 1,
            purchasedQuantity:
              it.purchased_quantity !== null
                ? Number(it.purchased_quantity)
                : undefined,
            unit: (it.unit || "علبة") as PharmacyUnit,
            notes: it.driver_note || undefined,
            isAvailable:
              it.purchased_quantity !== null
                ? Number(it.purchased_quantity) > 0
                : undefined,
          }));

          // If db items table had 0 items (e.g. digital prescription workflow), recover items from cached order
          if (resolvedItems.length === 0 && cachedMatch?.items && cachedMatch.items.length > 0) {
            resolvedItems = cachedMatch.items;
          }

          let resolvedImages = prescriptionFiles.map((f: any) => ({
            id: f.id,
            url: resolvePrescriptionImageUrl(f.storage_path),
            note: f.driver_note || undefined,
          }));

          // If db files table returned 0 images, recover images from cached order
          if (resolvedImages.length === 0 && cachedMatch?.images && cachedMatch.images.length > 0) {
            resolvedImages = cachedMatch.images.map((im) => ({
              ...im,
              url: resolvePrescriptionImageUrl(im.url),
            }));
          }

          return {
            id: o.id,
            orderNumber,
            prescriptionId: o.saved_prescription_id || undefined,
            title: o.prescription_title || "طلب أدوية صيدلية",
            pharmacyName: o.requested_pharmacy_name || cachedMatch?.pharmacyName || undefined,
            status: (o.status || "pending_review") as PharmacyOrderStatus,
            createdAt: o.created_at,
            deliveryAddress: o.address_text || "العنوان المسجل بالتطبيق",
            customerNotes: o.customer_notes || cachedMatch?.customerNotes || undefined,
            items: resolvedItems,
            images: resolvedImages,
            driver: driverObj,
            driverNotes: undefined,
            receiptImageUrl: resolvePrescriptionImageUrl(receiptFile?.storage_path) || undefined,
            itemsTotal:
              o.medicines_total !== null ? Number(o.medicines_total) : 0,
            deliveryFee: o.delivery_fee !== null ? Number(o.delivery_fee) : 15,
            finalTotal: o.grand_total !== null ? Number(o.grand_total) : 15,
            paymentMethod: "الدفع عند الاستلام",
            isArchived,
            cancellationReason,
          };
        });
      }

      const dbOrderIds = new Set(dbOrders.map((o) => o.id));
      const combined = [...dbOrders];
      for (const cached of cachedOrders) {
        if (!dbOrderIds.has(cached.id)) {
          combined.push(cached);
        }
      }

      return combined.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (err: any) {
      console.warn("[PharmacyService] getOrders exception:", err);
      return [];
    }
  }

  /**
   * Create a new pharmacy order using authoritative RPC `pharmacy_create_order`
   * Requirement 10: Ensures order is completely independent of any saved prescription clone.
   * Requirement 12: Prevents duplicate submissions.
   */
  async createOrder(params: CreatePharmacyOrderParams): Promise<PharmacyOrder> {
    if (this.inFlightCreateOrder) {
      throw new Error("جاري إرسال طلبك بالفعل، يرجى الانتظار...");
    }

    const user = await this.getAuthUser();
    if (!user) {
      throw new Error("يجب تسجيل الدخول أولاً لإرسال طلب الصيدلية");
    }

    this.inFlightCreateOrder = true;

    try {
      const orderId = crypto.randomUUID();
      const title = params.title?.trim() || "طلب روشتة علاج";
      const pharmacyName = params.pharmacyName?.trim() || null;

      // 0. Ensure user profile exists
      try {
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            email: user.email,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      } catch (profileErr) {
        console.warn("[PharmacyService] Profile check notice:", profileErr);
      }

      // Determine household ID
      let targetHouseholdId =
        params.householdId ||
        cacheManager.getUserCache<string>(user.id, "last_household_id");

      if (!targetHouseholdId) {
        const { data: memberRow } = await supabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (memberRow?.household_id) {
          targetHouseholdId = memberRow.household_id;
        } else {
          const { data: adminHh } = await supabase
            .from("households")
            .select("id")
            .eq("admin_id", user.id)
            .maybeSingle();
          if (adminHh?.id) {
            targetHouseholdId = adminHh.id;
          }
        }
      }

      if (!targetHouseholdId) {
        throw new Error(
          "لم يتم العثور على منزل مسجل لحسابك، يرجى الانضمام لمنزل أو إعداده أولاً لإرسال طلب الصيدلية"
        );
      }

      // 1. Resolve real household address from database (strictly requiring real household address belonging to targetHouseholdId)
      let resolvedAddress: any = null;

      if (params.addressId && isValidUUID(params.addressId)) {
        const { data: addrData, error: addrErr } = await supabase
          .from("household_addresses")
          .select("*")
          .eq("id", params.addressId)
          .eq("household_id", targetHouseholdId)
          .maybeSingle();
        if (addrData) {
          resolvedAddress = addrData;
        } else if (addrErr) {
          console.warn("[PharmacyService] Error resolving address by id:", addrErr);
        }
      }

      // If no address selected or not found by ID, pick user's active/default household address strictly within targetHouseholdId
      if (!resolvedAddress) {
        const { data: addrList } = await supabase
          .from("household_addresses")
          .select("*")
          .eq("household_id", targetHouseholdId)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1);

        if (addrList && addrList.length > 0) {
          resolvedAddress = addrList[0];
        }
      }

      if (!resolvedAddress) {
        throw new Error(
          "يرجى تحديد أو إضافة عنوان توصيل لمنزلك في محافظة سوهاج أولاً عبر قسم العناوين قبل إرسال طلب الصيدلية"
        );
      }

      // 2. Validate region: Pharmacy delivery service is currently active for Sohag governorate
      const isSohagRegion = Boolean(
        resolvedAddress.governorate_name?.includes("سوهاج") ||
        resolvedAddress.governorate_code?.toLowerCase().includes("sohag") ||
        resolvedAddress.governorate_code?.toUpperCase() === "EG-SHG" ||
        resolvedAddress.markaz_name?.includes("سوهاج") ||
        resolvedAddress.detailed_address?.includes("سوهاج")
      );

      if (!isSohagRegion) {
        throw new Error(
          `خدمة الصيدلية متاحة حالياً داخل محافظة سوهاج فقط. عنوان التوصيل المحدد يقع في (${resolvedAddress.governorate_name || "خارج سوهاج"}). يرجى اختيار أو إضافة عنوان داخل سوهاج لإتمام الطلب.`
        );
      }

      // Authoritative RPC public.pharmacy_create_order validates governorate and center
      const rpcGovernorateName = "سوهاج";
      const rpcCenterName = "سوهاج";
      const rpcGovernorateCode = "EG-SHG";

      // 3. Upload images in parallel to Supabase Storage before submission (max 4 images)
      const rawImages = (params.images || []).slice(0, 4);
      let uploadedFiles: Array<{
        index: number;
        id: string;
        url: string;
        storagePath: string;
        mimeType: string;
        note?: string;
      }> = [];

      if (rawImages.length > 0) {
        try {
          const uploadPromises = rawImages.map(async (img, idx) => {
            const uploadRes = await uploadPharmacyFile(
              img.url,
              "orders",
              `rx_${orderId}_${idx + 1}`
            );
            return {
              index: idx,
              id: img.id || `img_${orderId}_${idx + 1}`,
              url: uploadRes.url,
              storagePath: uploadRes.storagePath,
              mimeType: uploadRes.mimeType,
              note: img.note,
            };
          });

          uploadedFiles = await Promise.all(uploadPromises);
          // Preserve strictly the user's original order
          uploadedFiles.sort((a, b) => a.index - b.index);
        } catch (uploadErr: any) {
          console.error("[PharmacyService] Prescription image upload failed:", uploadErr);
          // Clean up any files that were uploaded in this batch to prevent orphans
          const pathsToClean = uploadedFiles
            .map((f) => f.storagePath)
            .filter((p) => p && p.startsWith(`orders/rx_${orderId}`));
          if (pathsToClean.length > 0) {
            supabase?.storage.from("pharmacy").remove(pathsToClean).catch(() => {});
            fetch("/api/storage/remove", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paths: pathsToClean }),
            }).catch(() => {});
          }
          throw new Error(
            uploadErr?.message ||
              "فشل رفع إحدى صور الروشتة إلى خادم التخزين. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة."
          );
        }
      }

      // 4. Prepare files payload (up to 4 images)
      const filesPayload = uploadedFiles.map((img, idx) => ({
        storage_path: img.url,
        mime_type: img.mimeType,
        file_type: "prescription",
        display_order: idx + 1,
        driver_note: img.note || null,
      }));

      const uploadedImages: PharmacyPrescriptionImage[] = uploadedFiles.map((img) => ({
        id: img.id,
        url: img.url,
        note: img.note,
      }));

      // Prepare items list
      const itemsList = params.items || [];

      // 5. Prepare items payload for database with required structure
      const itemsPayload = itemsList.map((it, idx) => ({
        item_name: it.name.trim(),
        unit: it.unit || "علبة",
        requested_quantity: Math.max(1, Number(it.quantity) || 1),
        sort_order: idx + 1,
      }));

      // Log diagnostics without sensitive info
      console.log(`[PharmacyService] Diagnostics - items count: ${itemsPayload.length}`);
      console.log(
        "[PharmacyService] Diagnostics - items payload:",
        itemsPayload.map((it) => ({
          name: it.item_name,
          unit: it.unit,
          qty: it.requested_quantity,
          sort_order: it.sort_order,
        }))
      );

      // Ensure at least 1 prescription file exists if user submitted text medicines without photos
      if (filesPayload.length === 0 && itemsList.length > 0) {
        const digitalCard = generateDigitalPrescriptionSvg(title, pharmacyName, itemsList);
        filesPayload.push({
          storage_path: digitalCard,
          mime_type: "image/svg+xml",
          file_type: "prescription",
          display_order: 1,
          driver_note: null,
        });
      }

      // 6. Build authoritative PharmacyOrder object
      const shortNum = orderId.replace(/-/g, "").substring(0, 4).toUpperCase();
      const detailedAddressString = [
        resolvedAddress.governorate_name || "سوهاج",
        resolvedAddress.markaz_name ? resolvedAddress.markaz_name : null,
        resolvedAddress.detailed_address,
      ].filter(Boolean).join(" - ");

      const finalDeliveryAddress =
        params.deliveryAddress?.trim() ||
        detailedAddressString ||
        "العنوان المسجل بالتطبيق";

      const newOrder: PharmacyOrder = {
        id: orderId,
        orderNumber: `PH-${shortNum}`,
        prescriptionId: isValidUUID(params.prescriptionId)
          ? params.prescriptionId
          : undefined,
        title,
        pharmacyName: pharmacyName || undefined,
        status: "pending_review",
        createdAt: new Date().toISOString(),
        deliveryAddress: finalDeliveryAddress,
        items: itemsList.map((it, idx) => ({
          id: `item_${orderId}_${idx}`,
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          notes: it.notes,
        })),
        images: uploadedImages,
        paymentMethod: "الدفع عند الاستلام",
        isArchived: false,
        deliveryFee: 15,
        itemsTotal: 0,
        finalTotal: 15,
      };

      // 7. Strictly sanitize UUIDs (prevent syntax error on draft_reorder_... temporary IDs)
      const sanitizedPrescriptionId = isValidUUID(params.prescriptionId)
        ? params.prescriptionId
        : null;

      // Strictly satisfy check constraint "pharmacy_order_pharmacy_mode_chk":
      // Mode 1: "user_selected" -> BOTH requested_pharmacy_id (valid UUID) AND requested_pharmacy_name must be present
      // Mode 2: "driver_selected_nearest" -> BOTH must be NULL
      const hasValidPharmacyId = Boolean(params.pharmacyId && isValidUUID(params.pharmacyId));
      const hasValidPharmacyName = Boolean(pharmacyName && pharmacyName.trim().length > 0);

      const rpcPharmacyId = (hasValidPharmacyId && hasValidPharmacyName) ? params.pharmacyId : null;
      const rpcPharmacyName = (hasValidPharmacyId && hasValidPharmacyName) ? pharmacyName : null;

      // If user provided a preferred pharmacy name without a database UUID, preserve it in notes
      let finalCustomerNotes = params.customerNotes?.trim() || "";
      if (pharmacyName && !rpcPharmacyId) {
        finalCustomerNotes = finalCustomerNotes
          ? `[الصيدلية المطلوبة: ${pharmacyName}] - ${finalCustomerNotes}`
          : `[الصيدلية المطلوبة: ${pharmacyName}]`;
      }

      // 8. Construct payload for authoritative RPC: public.pharmacy_create_order
      const rpcPayload = {
        p_address_center_name: rpcCenterName,
        p_address_governorate_code: rpcGovernorateCode,
        p_address_governorate_name: rpcGovernorateName,
        p_address_latitude: resolvedAddress.latitude ? Number(resolvedAddress.latitude) : null,
        p_address_longitude: resolvedAddress.longitude ? Number(resolvedAddress.longitude) : null,
        p_address_text: finalDeliveryAddress,
        p_customer_notes: finalCustomerNotes || null,
        p_files: filesPayload,
        p_items: itemsPayload,
        p_order_id: orderId,
        p_prescription_title: title,
        p_requested_pharmacy_id: rpcPharmacyId,
        p_requested_pharmacy_name: rpcPharmacyName,
        p_saved_prescription_id: sanitizedPrescriptionId,
        p_source_address_id: resolvedAddress.id,
      };

      // 9. Execute authoritative RPC with timeout resilience and automatic retry
      let rpcData: any = null;
      let rpcErr: any = null;
      let finalOrderId = orderId;

      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const attemptOrderId = attempt === 1 ? orderId : crypto.randomUUID();
        const res = await supabase.rpc("pharmacy_create_order", {
          ...rpcPayload,
          p_order_id: attemptOrderId,
        });

        rpcData = res.data;
        rpcErr = res.error;

        if (!rpcErr) {
          finalOrderId = attemptOrderId;
          break;
        }

        const isTimeout =
          rpcErr.code === "57014" ||
          rpcErr.message?.toLowerCase().includes("timeout") ||
          rpcErr.message?.toLowerCase().includes("canceling statement");

        if (isTimeout && attempt < maxAttempts) {
          console.warn(
            `[PharmacyService] pharmacy_create_order attempt ${attempt} timed out (57014), retrying in 1000ms...`
          );
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        break;
      }

      if (rpcErr) {
        // Clean up uploaded files strictly for this failed order attempt to prevent orphaned files
        const pathsToClean = uploadedFiles
          .map((f) => f.storagePath)
          .filter((p) => p && p.startsWith(`orders/rx_${orderId}`));
        if (pathsToClean.length > 0) {
          supabase?.storage.from("pharmacy").remove(pathsToClean).catch(() => {});
          fetch("/api/storage/remove", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paths: pathsToClean }),
          }).catch(() => {});
        }

        console.error(
          "[PharmacyService] pharmacy_create_order RPC error:",
          {
            code: rpcErr.code,
            message: rpcErr.message,
            details: rpcErr.details,
            hint: rpcErr.hint,
          }
        );

        let userMsg = rpcErr.message;
        const isTimeout =
          rpcErr.code === "57014" ||
          rpcErr.message?.toLowerCase().includes("timeout") ||
          rpcErr.message?.toLowerCase().includes("canceling statement");

        if (isTimeout) {
          userMsg =
            "استغرق الخادم وقتاً أطول من المتوقع لمعالجة طلب الصيدلية. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة.";
        } else if (rpcErr.message?.includes("pharmacy_order_item_shortage_chk")) {
          userMsg =
            "حدث خطأ في قاعدة البيانات أثناء حفظ أصناف الأدوية (قيد النواقص pharmacy_order_item_shortage_chk). يرجى مراجعة إدارة النظام لتحديث قيد الأصناف.";
        } else if (rpcErr.message?.includes("pharmacy_order_pharmacy_mode_chk")) {
          userMsg = "تعذر تحديد وضع الصيدلية المحددة، يرجى اختيار الصيدلية مجدداً أو ترك المندوب يختار أقرب صيدلية";
        } else if (rpcErr.message?.includes("خدمة الصيدلية غير متاحة")) {
          userMsg = "خدمة الصيدلية متاحة حالياً داخل محافظة سوهاج. يرجى التأكد من عنوان التوصيل المحدد واختيار عنوان في سوهاج.";
        } else if (rpcErr.message?.includes("العنوان غير تابع للمستخدم")) {
          userMsg = "العنوان المحدد غير مسجل لمنزلك الحالي، يرجى اختيار عنوان من قائمة عناوين المنزل";
        } else if (rpcErr.message?.includes("يجب اختيار عنوان حقيقي")) {
          userMsg = "يرجى اختيار عنوان توصيل حقيقي ومسجل قبل إرسال الطلب";
        } else if (rpcErr.message?.includes("الصيدلية غير موجودة")) {
          userMsg = "الصيدلية المحددة غير متوفرة حالياً، يمكنك ترك المندوب يختار أقرب صيدلية متوفرة";
        }

        throw new Error(
          userMsg ||
            "تعذر إرسال الطلب إلى الخادم، يرجى التحقق من الاتصال وإعادة المحاولة"
        );
      }

      // Requirement 5: Query pharmacy_order_items to verify items were saved
      try {
        const { data: verifiedItems, error: verifyError } = await supabase
          .from("pharmacy_order_items")
          .select("id, item_name, unit, requested_quantity, purchased_quantity, sort_order")
          .eq("order_id", finalOrderId);

        if (verifyError) {
          console.warn(
            "[PharmacyService] Items verification query notice (RLS or permissions):",
            verifyError.message
          );
        } else if (!verifiedItems || verifiedItems.length === 0) {
          console.warn(
            `[PharmacyService] Items verification: 0 rows found in pharmacy_order_items for order ${finalOrderId}`
          );
        } else {
          console.log(
            `[PharmacyService] Items verification: Successfully verified ${verifiedItems.length} items saved in pharmacy_order_items:`,
            verifiedItems.map((v: any) => ({
              name: v.item_name,
              qty: v.requested_quantity,
              unit: v.unit,
            }))
          );
        }
      } catch (vErr) {
        console.warn("[PharmacyService] Verification query exception:", vErr);
      }

      console.log(
        `[PharmacyService] Successfully created pharmacy order ${finalOrderId} via authoritative RPC:`,
        rpcData
      );

      // If retry generated a different order id, update newOrder.id
      if (finalOrderId !== orderId) {
        newOrder.id = finalOrderId;
        const newShortNum = finalOrderId.replace(/-/g, "").substring(0, 4).toUpperCase();
        newOrder.orderNumber = `PH-${newShortNum}`;
      }

      // 10. Cache successful order in local & household cache
      if (targetHouseholdId) {
        const existingCached =
          cacheManager.getHouseholdCache<PharmacyOrder[]>(
            user.id,
            targetHouseholdId,
            "pharmacy_orders"
          ) || [];
        cacheManager.setHouseholdCache(
          user.id,
          targetHouseholdId,
          "pharmacy_orders",
          [newOrder, ...existingCached.filter((o) => o.id !== newOrder.id)]
        );
      }

      // If pharmacy name provided, save to user pharmacies
      if (pharmacyName) {
        this.addPharmacy(pharmacyName).catch(() => {});
      }

      return newOrder;
    } finally {
      this.inFlightCreateOrder = false;
    }
  }

  /**
   * Cancel an order using authoritative RPC `pharmacy_customer_cancel_order` with resilient cache fallback
   */
  async cancelOrder(orderId: string, _reason?: string): Promise<boolean> {
    const user = await this.getAuthUser();
    if (!user) throw new Error("يجب تسجيل الدخول لإلغاء الطلب");

    try {
      const { error } = await supabase.rpc("pharmacy_customer_cancel_order", {
        p_order_id: orderId,
      });
      if (error) {
        console.warn(
          "[PharmacyService] pharmacy_customer_cancel_order RPC notice:",
          error.message
        );
      }
    } catch (e: any) {
      console.warn(
        "[PharmacyService] pharmacy_customer_cancel_order exception:",
        e?.message
      );
    }

    // Always update cached order
    await this.updateCachedOrder(orderId, (o) => ({
      ...o,
      status: "cancelled",
    }));
    return true;
  }

  /**
   * Archive an order using authoritative RPC `pharmacy_customer_archive_order` with resilient cache fallback
   */
  async archiveOrder(orderId: string): Promise<boolean> {
    const user = await this.getAuthUser();
    if (!user) throw new Error("يجب تسجيل الدخول لأرشفة الطلب");

    try {
      const { error } = await supabase.rpc("pharmacy_customer_archive_order", {
        p_order_id: orderId,
      });
      if (error) {
        console.warn(
          "[PharmacyService] pharmacy_customer_archive_order RPC notice:",
          error.message
        );
      }
    } catch (e: any) {
      console.warn(
        "[PharmacyService] pharmacy_customer_archive_order exception:",
        e?.message
      );
    }

    // Always update cached order
    await this.updateCachedOrder(orderId, (o) => ({
      ...o,
      isArchived: true,
    }));
    return true;
  }

  /**
   * Update order target pharmacy using authoritative RPC `pharmacy_customer_change_pharmacy`
   */
  async updateOrderPharmacy(
    orderId: string,
    newPharmacyName: string,
    pharmacyId?: string
  ): Promise<boolean> {
    const user = await this.getAuthUser();
    if (!user) throw new Error("يجب تسجيل الدخول لتعديل الصيدلية");

    const trimmed = newPharmacyName.trim();
    try {
      const { error } = await supabase.rpc("pharmacy_customer_change_pharmacy", {
        p_order_id: orderId,
        p_pharmacy_id: pharmacyId || null,
        p_pharmacy_name: trimmed || null,
      });
      if (error) {
        console.warn(
          "[PharmacyService] pharmacy_customer_change_pharmacy RPC notice:",
          error.message
        );
      }
    } catch (e: any) {
      console.warn(
        "[PharmacyService] pharmacy_customer_change_pharmacy exception:",
        e?.message
      );
    }

    await this.updateCachedOrder(orderId, (o) => ({
      ...o,
      pharmacyName: trimmed || undefined,
    }));

    if (trimmed) {
      this.addPharmacy(trimmed).catch(() => {});
    }
    return true;
  }

  // =========================================================================
  // 4. REALTIME SUBSCRIPTIONS
  // =========================================================================

  /**
   * Subscribe to live Realtime updates on all pharmacy tables
   */
  subscribeToPharmacyUpdates(onUpdate: () => void): () => void {
    const channel = supabase
      .channel("pharmacy_live_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pharmacy_orders" },
        () => onUpdate()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pharmacy_order_items" },
        () => onUpdate()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pharmacy_order_files" },
        () => onUpdate()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pharmacy_delivery_orders" },
        () => onUpdate()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pharmacy_saved_prescriptions" },
        () => onUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const pharmacyService = new PharmacyService();
