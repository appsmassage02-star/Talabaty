import React, { useState, useMemo } from "react";
import { usePharmacy, PharmacySectionTab } from "../../lib/usePharmacy";
import { useApp } from "../../context/AppContext";
import { PharmacyNewOrderView } from "./PharmacyNewOrderView";
import { PharmacySavedPrescriptionsView } from "./PharmacySavedPrescriptionsView";
import { PharmacyOrdersView } from "./PharmacyOrdersView";
import { PharmacyOrderDetailModal } from "./PharmacyOrderDetailModal";
import {
  Pill,
  ArrowRight,
  Plus,
  ShoppingBag,
  FileText,
  Clock,
  Archive,
  Sparkles,
  RefreshCw,
  Building2,
  AlertCircle,
} from "lucide-react";

interface PharmacySectionProps {
  onBackToHome: () => void;
}

export const PharmacySection: React.FC<PharmacySectionProps> = ({
  onBackToHome,
}) => {
  const {
    isLoading,
    errorMessage,
    clearError,
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
    savePrescription,
    updatePrescription,
    deletePrescription,
    createOrder,
    cancelOrder,
    archiveOrder,
    updateOrderPharmacy,
    addPharmacy,
    serviceSettings,
    reload,
  } = usePharmacy();

  const { categories } = useApp();
  const pharmacyCategory = useMemo(() => {
    return categories.find((c) => c.id === "pharmacy");
  }, [categories]);

  // Central name and image strictly from global_categories
  const pharmacyTitle = pharmacyCategory?.nameAr || "الصيدلية";
  const pharmacyImageUrl = pharmacyCategory?.imageUrl || "";

  return (
    <div className="space-y-4 text-right">
      {/* Error Message Banner */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-fadeIn">
          <div className="flex items-center space-x-2 space-x-reverse">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={clearError}
            className="text-rose-500 hover:text-rose-700 text-sm font-bold px-2 py-0.5 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Service Status Inactive Notice (Requirement 1) */}
      {!serviceSettings.serviceEnabled && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl flex items-center space-x-2.5 space-x-reverse text-xs font-bold">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>خدمة الصيدلية والتوصيل متوقفة مؤقتاً للصيانة حالياً، يمكنك مراجعة روشتاتك المحفوظة وطلباتك السابقة.</span>
        </div>
      )}

      {/* Top Section Header with Back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToHome}
          className="flex items-center space-x-1.5 space-x-reverse text-xs font-bold text-slate-700 hover:text-emerald-700 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للرئيسية</span>
        </button>

        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center space-x-1.5 space-x-reverse">
          <Pill className="w-3.5 h-3.5 text-emerald-600" />
          <span>قسم {pharmacyTitle} والروشتات الطبية</span>
        </span>
      </div>

      {/* Category Hero Banner (Aligned with standard category hero banner) */}
      <div className="relative rounded-3xl overflow-hidden shadow-sm border border-slate-200 bg-slate-900 min-h-[150px] sm:min-h-[180px] flex flex-col justify-end text-white p-5 sm:p-6">
        {pharmacyImageUrl ? (
          <img
            src={pharmacyImageUrl}
            alt={pharmacyTitle}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        {/* Rich gradient overlay for high contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/70 to-slate-900/25" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2 space-x-reverse mb-1">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/80 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-xs border border-white/20">
                خدمة صيدلية المنزل
              </span>
              <span className="text-[10px] text-emerald-200 font-medium">
                توصيل فوري من أقرب صيدلية
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black drop-shadow-md text-white">
              {pharmacyTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-lg leading-relaxed drop-shadow-sm">
              {pharmacyCategory?.description ||
                "ارفع صورة الروشتة أو اكتب الأدوية المطلوبة. يتولى المندوب شراءها فوراً وتوصيلها حتى باب المنزل مع الفاتورة."}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center space-x-2 space-x-reverse self-start sm:self-auto">
            <div className="bg-black/40 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/20 text-center shadow-xs">
              <span className="text-xl font-black block leading-none text-white">
                {activeOrders.length}
              </span>
              <span className="text-[10px] text-emerald-300 font-bold">
                طلبات نشطة
              </span>
            </div>
            <div className="bg-black/40 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/20 text-center shadow-xs">
              <span className="text-xl font-black block leading-none text-white">
                {prescriptions.length}
              </span>
              <span className="text-[10px] text-emerald-300 font-bold">
                روشتات محفوظة
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-1 overflow-x-auto">
        {/* 1. إنشاء طلب جديد */}
        <button
          type="button"
          onClick={() => {
            setDraftPrescription(null);
            setActiveSubTab("new_order");
          }}
          className={`flex-1 min-w-[100px] flex items-center justify-center space-x-1.5 space-x-reverse py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === "new_order"
              ? "bg-emerald-600 text-white shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>طلب جديد</span>
        </button>

        {/* 2. الروشتات المحفوظة */}
        <button
          type="button"
          onClick={() => setActiveSubTab("saved_prescriptions")}
          className={`flex-1 min-w-[110px] flex items-center justify-center space-x-1.5 space-x-reverse py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === "saved_prescriptions"
              ? "bg-emerald-600 text-white shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>الروشتات المحفوظة ({prescriptions.length})</span>
        </button>

        {/* 3. الطلبات الحالية */}
        <button
          type="button"
          onClick={() => setActiveSubTab("active_orders")}
          className={`flex-1 min-w-[100px] flex items-center justify-center space-x-1.5 space-x-reverse py-2 px-2.5 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
            activeSubTab === "active_orders"
              ? "bg-emerald-600 text-white shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>الطلبات ({activeOrders.length})</span>
          {activeOrders.length > 0 && activeSubTab !== "active_orders" && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        {/* 4. الأرشيف */}
        <button
          type="button"
          onClick={() => setActiveSubTab("past_orders")}
          className={`flex-1 min-w-[90px] flex items-center justify-center space-x-1.5 space-x-reverse py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === "past_orders"
              ? "bg-emerald-600 text-white shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>الأرشيف ({pastOrders.length})</span>
        </button>
      </div>

      {/* Content Rendering based on SubTab */}
      {isLoading ? (
        <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">جاري تحميل بيانات الصيدلية والروشتات...</p>
        </div>
      ) : activeSubTab === "new_order" ? (
        <PharmacyNewOrderView
          initialPrescription={draftPrescription}
          pharmaciesList={pharmacies}
          onSavePrescription={async (data) => {
            const saved = await savePrescription(data);
            return saved;
          }}
          onCreateOrder={async (data) => {
            const isUuid = (val?: string) =>
              Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));

            const realPrescriptionId =
              (isUuid(data.prescriptionId) ? data.prescriptionId : undefined) ||
              (isUuid(draftPrescription?.sourcePrescriptionId)
                ? draftPrescription?.sourcePrescriptionId
                : undefined) ||
              (isUuid(draftPrescription?.id)
                ? draftPrescription?.id
                : undefined);

            const created = await createOrder({
              title: data.title,
              pharmacyName: data.pharmacyName,
              items: data.items,
              images: data.images,
              prescriptionId: realPrescriptionId,
              addressId: data.addressId,
              deliveryAddress: data.deliveryAddress,
              customerNotes: data.customerNotes,
            });
            setActiveSubTab("active_orders");
            setSelectedOrderForDetail(created);
            return created;
          }}
          onCancel={() => {
            setDraftPrescription(null);
            setActiveSubTab(activeOrders.length > 0 ? "active_orders" : "saved_prescriptions");
          }}
          onAddPharmacy={addPharmacy}
        />
      ) : activeSubTab === "saved_prescriptions" ? (
        <PharmacySavedPrescriptionsView
          prescriptions={prescriptions}
          onReorder={(rx) => {
            startReorderPrescription(rx);
          }}
          onEdit={(rx) => {
            startReorderPrescription(rx);
          }}
          onDelete={(id) => {
            deletePrescription(id);
          }}
          onAddNew={() => {
            setDraftPrescription(null);
            setActiveSubTab("new_order");
          }}
        />
      ) : (
        <PharmacyOrdersView
          activeOrders={activeOrders}
          pastOrders={pastOrders}
          onSelectOrder={(order) => setSelectedOrderForDetail(order)}
          onCancelOrder={async (id, reason) => {
            await cancelOrder(id, reason);
          }}
          onArchiveOrder={async (id) => {
            await archiveOrder(id);
          }}
          onAddNewOrder={() => {
            setDraftPrescription(null);
            setActiveSubTab("new_order");
          }}
        />
      )}

      {/* Order Detail Modal */}
      {selectedOrderForDetail && (
        <PharmacyOrderDetailModal
          order={selectedOrderForDetail}
          onClose={() => setSelectedOrderForDetail(null)}
          onCancelOrder={async (id, reason) => {
            await cancelOrder(id, reason);
          }}
          onArchiveOrder={async (id) => {
            await archiveOrder(id);
          }}
          onUpdatePharmacy={async (id, newPh) => {
            await updateOrderPharmacy(id, newPh);
          }}
          pharmaciesList={pharmacies}
        />
      )}
    </div>
  );
};
