import React, { useState } from "react";
import { PharmacyOrder } from "../../types/pharmacy";
import { PharmacyProgressTracker } from "./PharmacyProgressTracker";
import { resolvePrescriptionImageUrl } from "../../lib/pharmacyService";
import {
  X,
  Phone,
  User,
  Truck,
  MapPin,
  Building2,
  Calendar,
  Receipt,
  FileText,
  AlertCircle,
  Archive,
  Ban,
  CheckCircle2,
  Image as ImageIcon,
  Edit2,
  Check,
  ChevronRight,
} from "lucide-react";

interface PharmacyOrderDetailModalProps {
  order: PharmacyOrder;
  onClose: () => void;
  onCancelOrder: (orderId: string, reason?: string) => Promise<void>;
  onArchiveOrder: (orderId: string) => Promise<void>;
  onUpdatePharmacy: (orderId: string, newPharmacy: string) => Promise<void>;
  pharmaciesList: string[];
}

export const PharmacyOrderDetailModal: React.FC<
  PharmacyOrderDetailModalProps
> = ({
  order,
  onClose,
  onCancelOrder,
  onArchiveOrder,
  onUpdatePharmacy,
  pharmaciesList,
}) => {
  // Pharmacy editing state (only allowed in pending_review)
  const [isEditingPharmacy, setIsEditingPharmacy] = useState(false);
  const [selectedPharmacyInput, setSelectedPharmacyInput] = useState(
    order.pharmacyName || ""
  );

  // Cancel Confirmation state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Archive Confirmation state
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Image lightbox preview
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(
    null
  );

  const canCancel = order.status === "pending_review";
  const canArchive =
    order.status === "completed" ||
    order.status === "cancelled" ||
    order.status === "unable_to_fulfill";

  const handleConfirmCancel = async () => {
    setIsProcessing(true);
    try {
      await onCancelOrder(order.id, cancelReasonInput.trim() || undefined);
      setShowCancelConfirm(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmArchive = async () => {
    setIsProcessing(true);
    try {
      await onArchiveOrder(order.id);
      setShowArchiveConfirm(false);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSavePharmacyChange = async () => {
    setIsProcessing(true);
    try {
      await onUpdatePharmacy(order.id, selectedPharmacyInput);
      setIsEditingPharmacy(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 my-auto">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <span className="font-mono font-bold text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-lg">
                {order.orderNumber}
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {order.title}
              </h3>
            </div>
            <div className="flex items-center space-x-3 space-x-reverse text-[11px] text-slate-500 mt-1">
              <span className="flex items-center space-x-1 space-x-reverse">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{new Date(order.createdAt).toLocaleString("ar-EG")}</span>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-right">
          {/* 9 — Progress Tracker Bar */}
          <PharmacyProgressTracker status={order.status} />

          {/* Cancellation Alert if cancelled */}
          {order.status === "cancelled" && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs text-rose-800 space-y-1">
              <div className="font-bold flex items-center space-x-1.5 space-x-reverse">
                <Ban className="w-4 h-4 text-rose-600" />
                <span>تم إلغاء هذا الطلب</span>
              </div>
              <p className="text-[11px] text-rose-600">
                السبب: {order.cancellationReason || "تم الإلغاء بواسطة المستخدم"}
              </p>
            </div>
          )}

          {/* Unable to fulfill Alert */}
          {order.status === "unable_to_fulfill" && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center space-x-1.5 space-x-reverse">
                <AlertCircle className="w-4 h-4 text-amber-700" />
                <span>تعذر تجهيز هذا الطلب من الصيدلية</span>
              </div>
              <p className="text-[11px] text-amber-700">
                {order.unableToFulfillReason ||
                  "الأدوية المطلوبة ناقصة وغير متوفرة بالمستودعات."}
              </p>
            </div>
          )}

          {/* 11 — Mock Driver Info (Visible when accepted or shopping) */}
          {(order.status === "accepted" ||
            order.status === "shopping" ||
            order.status === "ready_for_delivery") &&
            order.driver && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center space-x-1.5 space-x-reverse">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span>مندوب التوصيل المعتمد</span>
                  </span>
                  <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                    نشط ومكلف بالطلب
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 space-x-reverse">
                    <div className="w-10 h-10 rounded-full bg-emerald-200/80 text-emerald-800 flex items-center justify-center font-bold text-sm">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {order.driver.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {order.driver.phone}
                      </p>
                      {order.driver.vehicleInfo && (
                        <p className="text-[10px] text-emerald-700">
                          {order.driver.vehicleInfo}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Call Button */}
                  <a
                    href={`tel:${order.driver.phone}`}
                    className="flex items-center space-x-1.5 space-x-reverse px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>اتصال</span>
                  </a>
                </div>

                {order.driverNotes && (
                  <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 text-[11px] text-slate-700">
                    <strong className="text-emerald-800 block mb-0.5">
                      ملاحظة من المندوب:
                    </strong>
                    {order.driverNotes}
                  </div>
                )}
              </div>
            )}

          {/* Delivery Address & Pharmacy info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Delivery Address */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 flex items-center space-x-1 space-x-reverse">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>عنوان التوصيل</span>
              </span>
              <p className="text-xs font-medium text-slate-800">
                {order.deliveryAddress}
              </p>
            </div>

            {/* 15 — Pharmacy Info & Optional Change */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 flex items-center space-x-1 space-x-reverse">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>الصيدلية</span>
                </span>
                {canCancel && !isEditingPharmacy && (
                  <button
                    type="button"
                    onClick={() => setIsEditingPharmacy(true)}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center space-x-0.5 space-x-reverse"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>تغيير</span>
                  </button>
                )}
              </div>

              {!isEditingPharmacy ? (
                <p className="text-xs font-bold text-slate-800">
                  {order.pharmacyName || "لم يتم تحديد صيدلية (أي صيدلية قريبة)"}
                </p>
              ) : (
                <div className="space-y-2 pt-1">
                  <select
                    value={selectedPharmacyInput}
                    onChange={(e) => setSelectedPharmacyInput(e.target.value)}
                    className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="">بدون تحديد (أي صيدلية قريبة)</option>
                    {pharmaciesList.map((ph) => (
                      <option key={ph} value={ph}>
                        {ph}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center space-x-1.5 space-x-reverse">
                    <button
                      type="button"
                      onClick={handleSavePharmacyChange}
                      disabled={isProcessing}
                      className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg"
                    >
                      حفظ
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPharmacy(false)}
                      className="px-2 py-1 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Requested Items List */}
          {order.items && order.items.length > 0 && (
            <div className="space-y-2 pt-1">
              <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>الأدوية والأصناف المطلوبة ({order.items.length})</span>
              </h4>

              <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {order.items.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="p-3 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900 block">
                          {item.name}
                        </span>
                        {item.notes && (
                          <span className={`text-[10px] inline-block mt-0.5 rounded px-1.5 py-0.5 font-medium ${
                            item.purchasedQuantity !== undefined && item.purchasedQuantity < item.quantity
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "text-slate-500"
                          }`}>
                            {item.purchasedQuantity !== undefined && item.purchasedQuantity < item.quantity
                              ? `سبب النقص: ${item.notes}`
                              : item.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 space-x-reverse">
                      {item.purchasedQuantity !== undefined &&
                      item.purchasedQuantity < item.quantity ? (
                        <span className="bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg font-bold text-[11px]">
                          شراء جزئي: {item.purchasedQuantity} من {item.quantity} {item.unit}
                        </span>
                      ) : (
                        <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-bold text-slate-800 text-[11px]">
                          {item.quantity} {item.unit}
                        </span>
                      )}
                      {item.isAvailable !== undefined && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            item.isAvailable
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {item.isAvailable ? "متوفر" : "غير متوفر"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 16 — Prescription Images with Individual Image Notes */}
          {order.images && order.images.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <span>صور الروشتة وملاحظات الصيدلي ({order.images.length})</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {order.images.map((img, i) => (
                  <div
                    key={img.id || i}
                    className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-2xs p-2.5 space-y-2"
                  >
                    <div
                      className="relative aspect-video rounded-xl overflow-hidden bg-slate-200 cursor-pointer group"
                      onClick={() => setActivePreviewImage(resolvePrescriptionImageUrl(img.url))}
                    >
                      <img
                        src={resolvePrescriptionImageUrl(img.url)}
                        alt={`صورة ${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          const currentSrc = target.src;
                          if (currentSrc.includes("/uploads/") && typeof window !== "undefined") {
                            const cleanPath = currentSrc.substring(currentSrc.indexOf("/uploads/"));
                            if (target.src !== `${window.location.origin}${cleanPath}`) {
                              target.src = `${window.location.origin}${cleanPath}`;
                            }
                          }
                        }}
                      />
                      <span className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                        صورة {i + 1}
                      </span>
                      <span className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                        تكبير الصورة
                      </span>
                    </div>

                    {/* Independent Pharmacist/Driver Note for this image (Requirement 16) */}
                    <div className="bg-white p-2 rounded-xl border border-slate-200 text-[11px]">
                      <span className="font-bold text-slate-700 block mb-0.5">
                        ملاحظة الصورة {i + 1}:
                      </span>
                      <p className="text-slate-600 leading-relaxed font-medium">
                        {img.note || "تم فحص الروشتة وجاري مطابقة الأصناف."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 12 — Mock Purchase Receipt Image (when ready_for_delivery or completed) */}
          {(order.status === "ready_for_delivery" ||
            order.status === "completed") && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span>فاتورة الشراء المرفقة من الصيدلية</span>
                </span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-md">
                  تم الشراء والدفع
                </span>
              </div>

              <div
                className="relative aspect-[16/9] sm:aspect-[21/9] rounded-xl overflow-hidden bg-slate-200 border border-slate-200 cursor-pointer group"
                onClick={() =>
                  setActivePreviewImage(
                    order.receiptImageUrl ||
                      "https://images.unsplash.com/photo-1554415707-9e4c019a2e6f?auto=format&fit=crop&w=600&q=80"
                  )
                }
              >
                <img
                  src={
                    order.receiptImageUrl ||
                    "https://images.unsplash.com/photo-1554415707-9e4c019a2e6f?auto=format&fit=crop&w=600&q=80"
                  }
                  alt="فاتورة الصيدلية"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <span className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                  انقر لمعاينة الفاتورة الأصلية
                </span>
              </div>
            </div>
          )}

          {/* Financial Breakdown (Requirements 10 & 21: Computed by pharmacy, NOT user entered) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
              ملخص التكلفة والحساب (مع المندوب)
            </h4>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>إجمالي الأدوية (حسب فاتورة الصيدلية):</span>
                <span className="font-bold text-slate-800">
                  {order.itemsTotal !== undefined && order.itemsTotal > 0
                    ? `${order.itemsTotal} ج.م`
                    : "يُحدد بعد شراء المندوب"}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>رسوم التوصيل:</span>
                <span className="font-bold text-slate-800">
                  {order.deliveryFee ? `${order.deliveryFee} ج.م` : "25 ج.م"}
                </span>
              </div>

              <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-xs font-bold text-emerald-900">
                <span>الإجمالي النهائي المطلوب:</span>
                <span className="text-sm font-black text-emerald-700">
                  {order.finalTotal !== undefined && order.finalTotal > 0
                    ? `${order.finalTotal} ج.م`
                    : "حسب الفاتورة"}
                </span>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-3 py-2 rounded-xl">
              <span>طريقة الدفع:</span>
              <span className="font-bold text-slate-800">
                {order.paymentMethod || "الدفع عند الاستلام"}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>

          <div className="flex items-center space-x-2 space-x-reverse">
            {/* Cancel Button (Strictly pending_review only) */}
            {canCancel && (
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 space-x-reverse cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>إلغاء الطلب</span>
              </button>
            )}

            {/* Archive Button (Requirement 13: Completed only) */}
            {canArchive && !order.isArchived && (
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 space-x-reverse cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>أرشفة الطلب</span>
              </button>
            )}
          </div>
        </div>

        {/* Confirmation Modal for Cancellation */}
        {showCancelConfirm && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 text-right border border-slate-200 shadow-xl animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Ban className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-slate-900">
                  تأكيد إلغاء طلب الصيدلية
                </h4>
                <p className="text-xs text-slate-500">
                  هل أنت متأكد من إلغاء هذا الطلب؟ لن يتم إرساله للصيدلية أو السائق.
                </p>
              </div>

              <input
                type="text"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="سبب الإلغاء (اختياري)..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
              />

              <div className="flex items-center space-x-2 space-x-reverse pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
                >
                  نعم، إلغاء الطلب
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal for Archiving */}
        {showArchiveConfirm && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 text-right border border-slate-200 shadow-xl animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
                <Archive className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-slate-900">
                  أرشفة طلب الصيدلية
                </h4>
                <p className="text-xs text-slate-500">
                  سيتم نقل الطلب لقائمة الأرشيف والطلبات السابقة لإبقاء قائمتك النشطة منظمة.
                </p>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse pt-2">
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(false)}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmArchive}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold"
                >
                  تأكيد الأرشفة
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Fullscreen Lightbox Preview */}
        {activePreviewImage && (
          <div
            className="fixed inset-0 z-70 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setActivePreviewImage(null)}
          >
            <div className="relative max-w-3xl max-h-[90vh]">
              <img
                src={resolvePrescriptionImageUrl(activePreviewImage)}
                alt="معاينة"
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              />
              <button
                onClick={() => setActivePreviewImage(null)}
                className="absolute top-3 left-3 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
