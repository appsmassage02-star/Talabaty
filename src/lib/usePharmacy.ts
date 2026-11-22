import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  PharmacyPrescription,
  PharmacyOrder,
  PharmacyOrderStatus,
  PharmacyConfig,
} from "../types/pharmacy";
import { pharmacyService } from "./pharmacyService";
import { sectionSettingsService } from "./sectionSettingsService";
import { cacheManager } from "./cacheManager";
import { useApp } from "../context/AppContext";

export type PharmacySectionTab =
  | "active_orders"
  | "new_order"
  | "saved_prescriptions"
  | "past_orders";

export function evaluatePharmacyCompletionNotifications(params: {
  orders: PharmacyOrder[];
  previousStatuses: Map<string, PharmacyOrderStatus>;
  alreadyNotifiedIds: Set<string>;
  isInitialHydration: boolean;
}): {
  notificationsToEmit: PharmacyOrder[];
  newlyMarkedSilentIds: string[];
} {
  const notificationsToEmit: PharmacyOrder[] = [];
  const newlyMarkedSilentIds: string[] = [];

  for (const order of params.orders) {
    const prevStatus = params.previousStatuses.get(order.id);
    if (order.status === "completed") {
      if (!params.alreadyNotifiedIds.has(order.id)) {
        if (prevStatus !== undefined && prevStatus !== "completed") {
          notificationsToEmit.push(order);
        } else if (!params.isInitialHydration && prevStatus === undefined) {
          notificationsToEmit.push(order);
        } else {
          newlyMarkedSilentIds.push(order.id);
        }
      }
    }
    params.previousStatuses.set(order.id, order.status);
  }

  return { notificationsToEmit, newlyMarkedSilentIds };
}

export function usePharmacy() {
  const { household, supabaseUser, addAppNotification } = useApp();

  const [prescriptions, setPrescriptions] = useState<PharmacyPrescription[]>([]);
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [pharmacies, setPharmacies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] =
    useState<PharmacySectionTab>("active_orders");

  // Authoritative detail modal tracking via ID so Realtime/refresh never leaves stale snapshots
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderFallback, setSelectedOrderFallback] =
    useState<PharmacyOrder | null>(null);
  const selectedOrderIdRef = useRef<string | null>(null);

  const [serviceSettings, setServiceSettings] = useState<
    PharmacyConfig & {
      serviceEnabled: boolean;
      sectionVisible: boolean;
      deliveryEnabled: boolean;
      loaded: boolean;
      error: string | null;
    }
  >({
    serviceEnabled: false,
    sectionVisible: false,
    deliveryEnabled: false,
    loaded: false,
    error: null,
    status: "disabled",
    displayWidth: "full",
    nameAr: "الصيدلية",
    imageUrl: "",
  });

  // Cloned draft for editing or reordering a prescription independently
  const [draftPrescription, setDraftPrescription] =
    useState<PharmacyPrescription | null>(null);

  // Refs for lifecycle, duplicate prevention, and completion-notification deduplication
  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false);
  const hasHydratedOrdersRef = useRef(false);
  const orderStatusMapRef = useRef<Map<string, PharmacyOrderStatus>>(new Map());
  const notifiedCompletedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Hydrate persisted notified-order IDs and prior cached order statuses per user/household
  useEffect(() => {
    if (!supabaseUser?.id) return;
    const savedNotifiedIds =
      cacheManager.getUserCache<string[]>(
        supabaseUser.id,
        "pharmacy_completed_notified_ids"
      ) || [];
    notifiedCompletedIdsRef.current = new Set(savedNotifiedIds);

    const targetHouseholdId =
      household?.id ||
      cacheManager.getUserCache<string>(supabaseUser.id, "last_household_id");
    if (targetHouseholdId) {
      const cachedOrders =
        cacheManager.getHouseholdCache<PharmacyOrder[]>(
          supabaseUser.id,
          targetHouseholdId,
          "pharmacy_orders"
        ) || [];
      cachedOrders.forEach((o) => {
        if (!orderStatusMapRef.current.has(o.id)) {
          orderStatusMapRef.current.set(o.id, o.status);
        }
      });
    }
  }, [supabaseUser?.id, household?.id]);

  const processOrderStatusNotifications = useCallback(
    (incomingOrders: PharmacyOrder[], isInitialHydration: boolean) => {
      const { notificationsToEmit, newlyMarkedSilentIds } =
        evaluatePharmacyCompletionNotifications({
          orders: incomingOrders,
          previousStatuses: orderStatusMapRef.current,
          alreadyNotifiedIds: notifiedCompletedIdsRef.current,
          isInitialHydration,
        });

      let dirtyCache = false;
      for (const id of newlyMarkedSilentIds) {
        if (!notifiedCompletedIdsRef.current.has(id)) {
          notifiedCompletedIdsRef.current.add(id);
          dirtyCache = true;
        }
      }

      for (const order of notificationsToEmit) {
        if (notifiedCompletedIdsRef.current.has(order.id)) continue;
        notifiedCompletedIdsRef.current.add(order.id);
        dirtyCache = true;

        addAppNotification({
          id: `pharmacy_completed_${order.id}`,
          title: "تم توصيل طلب الصيدلية بنجاح",
          message: `تم توصيل طلبك رقم ${order.orderNumber} (${order.title}) بنجاح.`,
          type: "purchase_made",
          targetRole: "all",
          meta: {
            category: "pharmacy",
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: "completed",
          },
        });
      }

      if (dirtyCache && supabaseUser?.id) {
        cacheManager.setUserCache(
          supabaseUser.id,
          "pharmacy_completed_notified_ids",
          Array.from(notifiedCompletedIdsRef.current)
        );
      }
    },
    [addAppNotification, supabaseUser?.id]
  );

  // Load all initial authoritative data from Supabase
  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      setErrorMessage(null);
      try {
        const [pRes, oRes, phRes, sRes] = await Promise.allSettled([
          pharmacyService.getPrescriptions(),
          pharmacyService.getOrders(household?.id),
          pharmacyService.getPharmaciesList(),
          pharmacyService.getSettings(),
        ]);

        if (!isMountedRef.current) return;

        if (pRes.status === "fulfilled") setPrescriptions(pRes.value);
        if (oRes.status === "fulfilled") {
          const isInitial = !hasHydratedOrdersRef.current;
          hasHydratedOrdersRef.current = true;
          processOrderStatusNotifications(oRes.value, isInitial);
          setOrders(oRes.value);
        }
        if (phRes.status === "fulfilled") setPharmacies(phRes.value);
        if (sRes.status === "fulfilled") setServiceSettings(sRes.value);
      } catch (err: any) {
        if (!isMountedRef.current) return;
        console.error("[usePharmacy] Failed to load data:", err);
        setErrorMessage(err.message || "فشل تحميل بيانات الصيدلية والروشتات");
      } finally {
        if (isMountedRef.current && !silent) {
          setIsLoading(false);
        }
      }
    },
    [household?.id, processOrderStatusNotifications]
  );

  // Fresh single-order DB fetch (called on modal open and live updates)
  const refreshOrder = useCallback(
    async (orderId: string): Promise<PharmacyOrder | null> => {
      if (!orderId) return null;
      try {
        const fresh = await pharmacyService.getOrderById(orderId, household?.id);
        if (!isMountedRef.current || !fresh) return fresh;

        processOrderStatusNotifications([fresh], false);

        setOrders((prev) => {
          const exists = prev.some((o) => o.id === fresh.id);
          if (!exists) return [fresh, ...prev];
          return prev.map((o) => (o.id === fresh.id ? fresh : o));
        });

        if (selectedOrderIdRef.current === fresh.id) {
          setSelectedOrderFallback(fresh);
        }
        return fresh;
      } catch (err) {
        console.warn("[usePharmacy] refreshOrder note:", err);
        return null;
      }
    },
    [household?.id, processOrderStatusNotifications]
  );

  useEffect(() => {
    loadData();

    // Subscribe to Realtime updates on all pharmacy tables (with auto-reconnect)
    const unsubscribe = pharmacyService.subscribeToPharmacyUpdates((event) => {
      console.log(
        "[usePharmacy] Realtime update event received, refreshing data...",
        event?.table || "sync"
      );
      loadData(true);
      if (selectedOrderIdRef.current) {
        refreshOrder(selectedOrderIdRef.current);
      }
    });

    // Subscribe to centralized `public.app_section_settings` (Realtime + foreground resume)
    const unsubscribeSection = sectionSettingsService.subscribe((snapshot) => {
      const central = snapshot.pharmacy;
      if (!isMountedRef.current) return;
      const serviceEnabled = central.loaded && central.section_enabled === true;
      const sectionVisible = central.loaded && central.section_visible === true;
      const deliveryEnabled = central.loaded && central.delivery_enabled === true;
      const status = !central.loaded
        ? "disabled"
        : !sectionVisible
        ? "hidden"
        : !serviceEnabled
        ? "disabled"
        : "active";

      setServiceSettings((prev) => ({
        ...prev,
        serviceEnabled,
        sectionVisible,
        deliveryEnabled,
        loaded: central.loaded,
        error: central.error,
        status,
      }));
    });

    return () => {
      unsubscribe();
      unsubscribeSection();
    };
  }, [loadData, refreshOrder]);

  // Derived active orders vs past/archived orders
  const activeOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        !o.isArchived &&
        (o.status === "pending_review" ||
          o.status === "accepted" ||
          o.status === "shopping" ||
          o.status === "ready_for_delivery" ||
          o.status === "cancellation_requested")
    );
  }, [orders]);

  const pastOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.isArchived ||
        o.status === "completed" ||
        o.status === "cancelled" ||
        o.status === "unable_to_fulfill"
    );
  }, [orders]);

  // Derive live selectedOrderForDetail cleanly from `orders` + fallback
  const selectedOrderForDetail = useMemo(() => {
    if (!selectedOrderId) return null;
    return (
      orders.find((o) => o.id === selectedOrderId) || selectedOrderFallback
    );
  }, [selectedOrderId, orders, selectedOrderFallback]);

  const setSelectedOrderForDetail = useCallback(
    (order: PharmacyOrder | null) => {
      if (!order) {
        selectedOrderIdRef.current = null;
        setSelectedOrderId(null);
        setSelectedOrderFallback(null);
        return;
      }
      selectedOrderIdRef.current = order.id;
      setSelectedOrderId(order.id);
      setSelectedOrderFallback(order);
      refreshOrder(order.id);
    },
    [refreshOrder]
  );

  // =========================================================================
  // ACTIONS
  // =========================================================================

  const handleSavePrescription = useCallback(
    async (data: Omit<PharmacyPrescription, "id" | "createdAt">) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        const saved = await pharmacyService.savePrescription(data);
        setPrescriptions((prev) => [
          saved,
          ...prev.filter((p) => p.id !== saved.id),
        ]);
        return saved;
      } catch (err: any) {
        console.error("[usePharmacy] Error saving prescription:", err);
        setErrorMessage(err.message || "فشل حفظ الروشتة الطبية");
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const handleUpdatePrescription = useCallback(
    async (id: string, updates: Partial<PharmacyPrescription>) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        const updated = await pharmacyService.updatePrescription(id, updates);
        setPrescriptions((prev) =>
          prev.map((p) => (p.id === id ? updated : p))
        );
        return updated;
      } catch (err: any) {
        console.error("[usePharmacy] Error updating prescription:", err);
        setErrorMessage(err.message || "فشل تعديل بيانات الروشتة");
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const handleDeletePrescription = useCallback(async (id: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await pharmacyService.deletePrescription(id);
      setPrescriptions((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      console.error("[usePharmacy] Error deleting prescription:", err);
      setErrorMessage(err.message || "فشل حذف الروشتة");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleCreateOrder = useCallback(
    async (params: {
      title: string;
      pharmacyName?: string;
      pharmacyId?: string;
      items: PharmacyOrder["items"];
      images: PharmacyOrder["images"];
      deliveryAddress?: string;
      addressId?: string;
      customerNotes?: string;
      prescriptionId?: string;
    }) => {
      if (isSubmittingRef.current) {
        console.warn("[usePharmacy] Blocked duplicate createOrder call");
        return;
      }
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const created = await pharmacyService.createOrder({
          ...params,
          householdId: household?.id,
          userId: supabaseUser?.id,
        });

        orderStatusMapRef.current.set(created.id, created.status);
        setOrders((prev) => [
          created,
          ...prev.filter((o) => o.id !== created.id),
        ]);

        if (params.pharmacyName?.trim()) {
          const phList = await pharmacyService.getPharmaciesList();
          setPharmacies(phList);
        }

        // Reset draft if ordered from draft
        setDraftPrescription(null);
        setActiveSubTab("active_orders");
        return created;
      } catch (err: any) {
        console.error("[usePharmacy] Error creating pharmacy order:", err);
        const isTimeout =
          err.code === "57014" ||
          err.message?.toLowerCase().includes("timeout") ||
          err.message?.toLowerCase().includes("canceling statement");

        const msg = isTimeout
          ? "استغرق الخادم وقتاً أطول من المتوقع لمعالجة طلب الصيدلية. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة."
          : err.message || "فشل إرسال طلب الصيدلية";
        setErrorMessage(msg);
        throw err;
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [household, supabaseUser]
  );

  const handleCancelOrder = useCallback(
    async (orderId: string, reason?: string) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        await pharmacyService.cancelOrder(orderId, reason);
        orderStatusMapRef.current.set(orderId, "cancelled");
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: "cancelled" as PharmacyOrderStatus,
                  cancellationReason: reason || "تم الإلغاء بواسطة المستخدم",
                }
              : o
          )
        );
        if (selectedOrderIdRef.current === orderId) {
          setSelectedOrderFallback((prev) =>
            prev
              ? {
                  ...prev,
                  status: "cancelled" as PharmacyOrderStatus,
                  cancellationReason: reason || "تم الإلغاء بواسطة المستخدم",
                }
              : null
          );
        }
      } catch (err: any) {
        console.error("[usePharmacy] Error cancelling order:", err);
        setErrorMessage(err.message || "فشل إلغاء الطلب");
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const handleArchiveOrder = useCallback(async (orderId: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await pharmacyService.archiveOrder(orderId);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, isArchived: true } : o))
      );
      if (selectedOrderIdRef.current === orderId) {
        setSelectedOrderFallback((prev) =>
          prev ? { ...prev, isArchived: true } : null
        );
      }
    } catch (err: any) {
      console.error("[usePharmacy] Error archiving order:", err);
      setErrorMessage(err.message || "فشل أرشفة الطلب");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleUpdateOrderPharmacy = useCallback(
    async (orderId: string, newPharmacy: string, pharmacyId?: string) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        await pharmacyService.updateOrderPharmacy(
          orderId,
          newPharmacy,
          pharmacyId
        );
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, pharmacyName: newPharmacy.trim() || undefined }
              : o
          )
        );
        if (selectedOrderIdRef.current === orderId) {
          setSelectedOrderFallback((prev) =>
            prev
              ? { ...prev, pharmacyName: newPharmacy.trim() || undefined }
              : null
          );
        }
        if (newPharmacy.trim()) {
          const phList = await pharmacyService.getPharmaciesList();
          setPharmacies(phList);
        }
      } catch (err: any) {
        console.error("[usePharmacy] Error updating pharmacy:", err);
        setErrorMessage(err.message || "فشل تغيير الصيدلية للطلب");
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const handleAddPharmacy = useCallback(async (name: string) => {
    const list = await pharmacyService.addPharmacy(name);
    setPharmacies(list);
    return list;
  }, []);

  // Deep clone prescription for re-ordering/editing independently without mutating original saved Rx
  const startReorderPrescription = useCallback(
    (prescription: PharmacyPrescription) => {
      const clone: PharmacyPrescription = {
        id: `draft_reorder_${Date.now()}`,
        sourcePrescriptionId: prescription.sourcePrescriptionId || prescription.id,
        title: prescription.title,
        pharmacyName: prescription.pharmacyName,
        createdAt: new Date().toISOString(),
        items: prescription.items.map((it) => ({
          ...it,
          id: `draft_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        })),
        images: prescription.images.map((img) => ({
          ...img,
          id: `draft_img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        })),
      };
      setDraftPrescription(clone);
      setActiveSubTab("new_order");
    },
    []
  );

  return {
    isLoading,
    isSubmitting,
    errorMessage,
    serviceSettings,
    clearError: () => setErrorMessage(null),
    prescriptions,
    orders,
    activeOrders,
    pastOrders,
    pharmacies,
    activeSubTab,
    setActiveSubTab,
    selectedOrderForDetail,
    setSelectedOrderForDetail,
    refreshOrder,
    draftPrescription,
    setDraftPrescription,
    startReorderPrescription,
    savePrescription: handleSavePrescription,
    updatePrescription: handleUpdatePrescription,
    deletePrescription: handleDeletePrescription,
    createOrder: handleCreateOrder,
    cancelOrder: handleCancelOrder,
    archiveOrder: handleArchiveOrder,
    updateOrderPharmacy: handleUpdateOrderPharmacy,
    addPharmacy: handleAddPharmacy,
    updateSettings: async (newConfig: Partial<PharmacyConfig>) => {
      setServiceSettings((prev) => ({
        ...prev,
        ...(newConfig.displayWidth !== undefined ? { displayWidth: newConfig.displayWidth } : {}),
        ...(newConfig.nameAr !== undefined ? { nameAr: newConfig.nameAr } : {}),
        ...(newConfig.imageUrl !== undefined ? { imageUrl: newConfig.imageUrl } : {}),
      }));
      const res = await pharmacyService.updateSettings(newConfig);
      return res;
    },
    reload: loadData,
  };
}
