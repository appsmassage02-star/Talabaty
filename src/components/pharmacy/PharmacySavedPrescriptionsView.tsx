import React, { useState } from "react";
import { PharmacyPrescription } from "../../types/pharmacy";
import { resolvePrescriptionImageUrl } from "../../lib/pharmacyService";
import {
  FileText,
  Building2,
  Calendar,
  Layers,
  Image as ImageIcon,
  Edit2,
  Trash2,
  ShoppingBag,
  Sparkles,
  ChevronLeft,
  Check,
} from "lucide-react";

interface PharmacySavedPrescriptionsViewProps {
  prescriptions: PharmacyPrescription[];
  onReorder: (prescription: PharmacyPrescription) => void;
  onEdit: (prescription: PharmacyPrescription) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
}

export const PharmacySavedPrescriptionsView: React.FC<
  PharmacySavedPrescriptionsViewProps
> = ({ prescriptions, onReorder, onEdit, onDelete, onAddNew }) => {
  const [prescriptionToDelete, setPrescriptionToDelete] =
    useState<PharmacyPrescription | null>(null);

  return (
    <div className="space-y-4 text-right">
      {/* Header & Quick Action */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">
            الروشتات والعلاجات المحفوظة
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            روشتاتك المجهزة لطلبها بنقرة واحدة في أي وقت
          </p>
        </div>
        <button
          onClick={onAddNew}
          className="flex items-center space-x-1.5 space-x-reverse px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs hover:shadow-xs transition-all cursor-pointer"
        >
          <span>روشتة جديدة</span>
        </button>
      </div>

      {/* Prescriptions List */}
      {prescriptions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h4 className="text-xs font-bold text-slate-800">لا توجد روشتات محفوظة بعد</h4>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
            احفظ روشتاتك الشهرية وأدويتك الدورية لتتمكن من إعادة طلبها بنقرة واحدة لاحقاً.
          </p>
          <button
            onClick={onAddNew}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer"
          >
            إنشاء أول روشتة
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {prescriptions.map((rx) => {
            const hasImages = rx.images && rx.images.length > 0;
            const hasItems = rx.items && rx.items.length > 0;

            return (
              <div
                key={rx.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm hover:border-emerald-300 transition-all p-4 flex flex-col justify-between space-y-3.5 text-right relative group"
              >
                {/* Top: Name & Pharmacy */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                      {rx.title}
                    </h4>
                    {hasImages && (
                      <span className="shrink-0 flex items-center space-x-1 space-x-reverse px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold">
                        <ImageIcon className="w-3 h-3" />
                        <span>{rx.images.length} صور</span>
                      </span>
                    )}
                  </div>

                  {/* Pharmacy Name */}
                  <div className="flex items-center space-x-1.5 space-x-reverse mt-1.5 text-[11px] text-slate-600">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{rx.pharmacyName || "لم تحدد صيدلية (أي صيدلية قريبة)"}</span>
                  </div>
                </div>

                {/* Items Preview Chips & Image Thumbnail */}
                <div className="space-y-2">
                  {hasItems && (
                    <div className="flex flex-wrap gap-1.5">
                      {rx.items.slice(0, 3).map((item) => (
                        <span
                          key={item.id}
                          className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-medium"
                        >
                          {item.name} ({item.quantity} {item.unit})
                        </span>
                      ))}
                      {rx.items.length > 3 && (
                        <span className="px-1.5 py-0.5 bg-slate-200/60 text-slate-600 rounded-lg text-[10px] font-bold">
                          +{rx.items.length - 3} أصناف أخرى
                        </span>
                      )}
                    </div>
                  )}

                  {/* Image Thumbnails Strip */}
                  {hasImages && (
                    <div className="flex items-center space-x-1.5 space-x-reverse pt-1">
                      {rx.images.map((img) => (
                        <img
                          key={img.id}
                          src={resolvePrescriptionImageUrl(img.url)}
                          alt=""
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-2xs"
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
                      ))}
                    </div>
                  )}
                </div>

                {/* Last Order Date Info */}
                <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-2 flex items-center justify-between">
                  <span>
                    عدد الأصناف: <strong className="text-slate-600">{rx.items.length}</strong>
                  </span>
                  <span>
                    {rx.lastOrderedAt
                      ? `آخر طلب: ${new Date(rx.lastOrderedAt).toLocaleDateString("ar-EG")}`
                      : "لم يُطلب مؤخراً"}
                  </span>
                </div>

                {/* Action Buttons: طلب (Re-order clone) / تعديل / حذف */}
                <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-100">
                  {/* Reorder Button: clones into draft and opens review */}
                  <button
                    type="button"
                    onClick={() => onReorder(rx)}
                    className="flex-1 flex items-center justify-center space-x-1.5 space-x-reverse py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                    title="فتح نسخة مستقلة للمراجعة والتعديل قبل الإرسال"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>طلب</span>
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => onEdit(rx)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                    title="تعديل الروشتة المحفوظة"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => setPrescriptionToDelete(rx)}
                    className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer"
                    title="حذف الروشتة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {prescriptionToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 text-right border border-slate-200 shadow-xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-sm font-bold text-slate-900">
                تأكيد حذف الروشتة المحفوظة
              </h4>
              <p className="text-xs text-slate-500">
                هل أنت متأكد من حذف روشتة &quot;{prescriptionToDelete.title}&quot;؟ لا يمكن
                التراجع عن هذا الإجراء.
              </p>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse pt-2">
              <button
                type="button"
                onClick={() => setPrescriptionToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(prescriptionToDelete.id);
                  setPrescriptionToDelete(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
