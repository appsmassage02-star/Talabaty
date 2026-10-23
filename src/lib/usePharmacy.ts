import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  PharmacyPrescription,
  PharmacyOrder,
  PharmacyOrderStatus,
  PharmacyConfig,
} from "../types/pharmacy";
import { pharmacyService } from "./pharmacyService";
import { useApp } from "../context/AppContext";

export type PharmacySectionTab =
  | "active_orders"
  | "new_order"
  | "saved_prescriptions"
  | "past_orders";

export function usePharmacy() {
  const { household, supabaseUser } = useApp();

  const [prescriptions, setPrescriptions] = useState<PharmacyPrescription[]>([]);
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [pharmacies, setPharmacies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] =
    useState<PharmacySectionTab>("active_orders");
  const [selectedOrderForDetail, setSelectedOrderForDetail] =
    useState<PharmacyOrder | null>(null);
  const [serviceSettings, setServiceSettings] = useState<
    PharmacyConfig & { serviceEnabled: boolean; sectionVisible: boolean }
  >({
    serviceEnabled: true,
    sectionVisible: true,
    status: "active",
    displayWidth: "full",
    nameAr: "الصيدلية",
    imageUrl: "",
  });

  // Cloned draft for editing or reordering a prescription independently
  const [draftPrescription, setDraftPrescription] =
    useState<PharmacyPrescription | null>(null);

  // Prevent race conditions and duplicate calls
  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load all initial authoritative data from Supabase
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMessage(null);
    try {
      const [pRes, oRes, phRes, sRes] = await Promise.allSettled([
        pharmacyService.getPrescriptions(),
        pharmacyService.getOrders(),
        pharmacyService.getPharmaciesList(),
        pharmacyService.getSettings(),
      ]);

      if (!isMountedRef.current) return;

      if (pRes.status === "fulfilled") setPrescriptions(pRes.value);
      if (oRes.status === "fulfilled") setOrders(oRes.value);
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
  }, []);

  useEffect(() => {
    loadData();

    // Subscribe to Realtime updates on all pharmacy tables
    const unsubscribe = pharmacyService.subscribeToPharmacyUpdates(() => {
      console.log("[usePharmacy] Realtime update event received, refreshing data...");
      loadData(true);
    });

    return () => {
      unsubscribe();
    };
  }, [loadData]);

  // Derived active orders vs past/archived orders
  const activeOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        !o.isArchived &&
        (o.status === "pending_review" ||
          o.status === "accepted" ||
          o.status === "shopping" ||
          o.status === "ready_for_delivery")
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

  // Keep selected order modal in sync with live order updates
  useEffect(() => {
    if (selectedOrderForDetail) {
      const live = orders.find((o) => o.id === selectedOrderForDetail.id);
      if (live) {
        setSelectedOrderForDetail(live);
      }
    }
  }, [orders, selectedOrderForDetail]);

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
        if (selectedOrderForDetail?.id === orderId) {
          setSelectedOrderForDetail((prev) =>
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
    [selectedOrderForDetail]
  );

  const handleArchiveOrder = useCallback(
    async (orderId: string) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        await pharmacyService.archiveOrder(orderId);
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, isArchived: true } : o))
        );
        if (selectedOrderForDetail?.id === orderId) {
          setSelectedOrderForDetail((prev) =>
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
    },
    [selectedOrderForDetail]
  );

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
        if (selectedOrderForDetail?.id === orderId) {
          setSelectedOrderForDetail((prev) =>
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
    [selectedOrderForDetail]
  );

  const handleAddPharmacy = useCallback(async (name: string) => {
    const list = await pharmacyService.addPharmacy(name);
    setPharmacies(list);
    return list;
  }, []);

  // Requirement 10: Deep clone prescription for re-ordering ensuring order is completely independent
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
        ...newConfig,
        serviceEnabled:
          newConfig.status !== undefined
            ? newConfig.status === "active"
            : prev.serviceEnabled,
        sectionVisible:
          newConfig.status !== undefined
            ? newConfig.status !== "hidden"
            : prev.sectionVisible,
      }));
      const res = await pharmacyService.updateSettings(newConfig);
      return res;
    },
    reload: loadData,
  };
}
