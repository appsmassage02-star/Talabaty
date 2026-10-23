import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { MissingItem } from "../types";
import {
  ClipboardList,
  CheckCircle2,
  Circle,
  Trash2,
  Sparkles,
  Receipt,
  AlertTriangle,
  Smartphone,
  ShieldCheck,
  Volume2,
  Check,
  Lock,
  WifiOff,
  Plus,
  Minus,
} from "lucide-react";

export const MissingItemsView: React.FC = () => {
  const {
    missingItems,
    toggleItemCompletion,
    deleteMissingItem,
    clearCompletedItems,
    incrementMissingItemQuantity,
    decrementMissingItemQuantity,
    setIsAiModalOpen,
    setIsAddInvoiceModalOpen,
    activeRole,
    categories,
    homePermissions,
    sendHomeAttentionAlert,
    isOnline,
    getRecordSyncStatus,
    refreshActiveStateFromCache,
  } = useApp();

  useEffect(() => {
    refreshActiveStateFromCache();
  }, [refreshActiveStateFromCache]);

  const [selectedFilter, setSelectedFilter] = useState<string | "all">("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [alertSent, setAlertSent] = useState(false);

  const activeItems = missingItems.filter((item) => !item.completed);
  const completedItems = missingItems.filter((item) => item.completed);

  const filteredItems = (showCompleted ? missingItems : activeItems).filter(
    (item) => selectedFilter === "all" || item.category === selectedFilter
  );

  // Group items by category using dynamic categories state
  const groupedByCategory = categories
    .map((cat) => ({
      category: cat,
      items: filteredItems.filter((item) => item.category === cat.id),
    }))
    .filter((group) => group.items.length > 0);

  const knownCatIds = new Set(categories.map((c) => c.id));
  const otherItems = filteredItems.filter((item) => !knownCatIds.has(item.category));
  if (otherItems.length > 0) {
    groupedByCategory.push({
      category: {
        id: "other",
        nameAr: otherItems[0]?.categoryArabic || "أخرى",
        nameEn: "Other",
        imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400",
        color: "slate",
        bgLight: "bg-slate-50 text-slate-800 border-slate-200",
        badgeColor: "bg-slate-100 text-slate-800",
        description: "",
        commonItems: [],
        isCustom: false,
      },
      items: otherItems,
    });
  }

  const canDelete =
    activeRole === "admin" || homePermissions.canDeleteMissingItem;
  const canEdit =
    activeRole === "admin" || homePermissions.canEditItem;
  const canAddAi =
    activeRole === "admin" || homePermissions.canUseAiAssistant;
  const canAddInvoice =
    activeRole === "admin" || homePermissions.canAddInvoice;

  const handleUrgentRing = () => {
    sendHomeAttentionAlert();
    setAlertSent(true);
    setTimeout(() => setAlertSent(false), 3000);
  };

  return (
    <div className="space-y-4 text-right">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <ClipboardList className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">
              قائمة النواقص ومستلزمات البيت
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              {activeItems.length} أغراض متبقية
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            مصنفة بالصور الحقيقية ومزامنة لحظية بين هاتف المسؤول وهاتف المنزل
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-y-1.5">
          {/* Urgent Attention Buzzer on Home Phone */}
          {(activeRole === "home" || activeRole === "household_member") && homePermissions.canSendUrgentAlert && (
            <button
              onClick={handleUrgentRing}
              disabled={alertSent}
              className={`flex items-center justify-center space-x-1.5 space-x-reverse px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all ${
                alertSent
                  ? "bg-emerald-600 text-white"
                  : "bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white animate-pulse"
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>{alertSent ? "تم إرسال الرنين!" : "تنبيه المسؤول"}</span>
            </button>
          )}

          {canAddAi && (
            <button
              id="btn-missing-ai-add"
              onClick={() => setIsAiModalOpen(true)}
              className={`flex items-center justify-center space-x-1.5 space-x-reverse px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all ${
                isOnline
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-105 text-white"
                  : "bg-amber-600 hover:bg-amber-700 text-white"
              }`}
              title={
                isOnline
                  ? "إضافة ذكية عبر المساعد Gemini"
                  : "وضع عدم الاتصال: المساعد الذكي معطل مؤقتاً لتجنب ضياع البيانات"
              }
            >
              {isOnline ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>إضافة ذكية (صوت/نص)</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-amber-200" />
                  <span>Gemini (Offline)</span>
                </>
              )}
            </button>
          )}

          {canAddInvoice && (
            <button
              id="btn-create-invoice-from-missing"
              onClick={() => setIsAddInvoiceModalOpen(true)}
              className="flex items-center justify-center space-x-1.5 space-x-reverse px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Receipt className="w-4 h-4" />
              <span>تسجيل فاتورة شراء</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center space-x-2 space-x-reverse overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setSelectedFilter("all")}
          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
            selectedFilter === "all"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          الكل ({activeItems.length})
        </button>

        {categories.map((cat) => {
          const count = activeItems.filter((i) => i.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap flex items-center space-x-1.5 space-x-reverse transition-colors ${
                selectedFilter === cat.id
                  ? "bg-emerald-600 text-white font-bold"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>{cat.nameAr}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedFilter === cat.id
                      ? "bg-emerald-800 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Missing Items List - Categorized Grouping */}
      {groupedByCategory.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-3">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {selectedFilter === "all"
              ? "رائع! لا توجد نواقص متبقية في البيت"
              : "لا توجد نواقص في هذا القسم حالياً"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isOnline
              ? "يمكنك إضافة أغراض جديدة عبر التحدث للمساعد الذكي Gemini أو اختيارها من الأقسام"
              : "أنت في وضع عدم الاتصال: يمكنك اختيار النواقص وإضافتها مباشرة من الأقسام المحلية"}
          </p>
          {canAddAi && (
            <button
              onClick={() => setIsAiModalOpen(true)}
              className={`inline-flex items-center space-x-1.5 space-x-reverse px-4 py-2 text-white rounded-xl text-xs font-bold transition-colors mt-2 ${
                isOnline
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {isOnline ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>إضافة نواقص جديدة الآن</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-amber-200" />
                  <span>تصفح النواقص والبدائل (Offline)</span>
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByCategory.map(({ category, items }) => (
            <div
              key={category.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden"
            >
              {/* Category Header with Real Image Thumbnail */}
              <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center space-x-2.5 space-x-reverse">
                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-300">
                    <img
                      src={category.imageUrl}
                      alt={category.nameAr}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900 block leading-tight">
                      {category.nameAr}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {category.nameEn}
                    </span>
                  </div>
                </div>

                <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                  {items.filter((i) => !i.completed).length} نواقص
                </span>
              </div>

              {/* Items in Category */}
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 flex items-center justify-between transition-colors ${
                      item.completed ? "bg-slate-50/70 opacity-60" : "hover:bg-slate-50/50"
                    }`}
                  >
                    {/* Right Checkbox & Name */}
                    <div className="flex items-center space-x-3 space-x-reverse flex-1 ml-2">
                      <button
                        onClick={() => canEdit && toggleItemCompletion(item.id)}
                        disabled={!canEdit}
                        className={`text-slate-400 hover:text-emerald-600 transition-colors shrink-0 ${
                          !canEdit ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                        }`}
                        title={canEdit ? "تحديد كتم الشراء" : "مغلق من المسؤول"}
                      >
                        {item.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-y-1">
                          <span
                            className={`text-sm font-bold ${
                              item.completed
                                ? "line-through text-slate-400"
                                : "text-slate-900"
                            }`}
                          >
                            {item.name}
                          </span>

                          {/* Urgency Badge */}
                          {item.urgency === "high" && (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-md flex items-center space-x-1 space-x-reverse">
                              <AlertTriangle className="w-3 h-3" />
                              <span>عاجل</span>
                            </span>
                          )}

                          {/* Quantity & Stepper Controls */}
                          <div className="flex items-center space-x-1 space-x-reverse bg-slate-100/90 rounded-lg p-0.5 border border-slate-200/60">
                            {canEdit && !item.completed && (
                              <button
                                onClick={() => decrementMissingItemQuantity(item.id)}
                                className="w-5 h-5 flex items-center justify-center rounded-md text-slate-500 hover:text-rose-700 hover:bg-white transition-colors"
                                title="إنقاص الكمية"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                            )}
                            <span className="px-1.5 text-slate-800 text-[11px] font-bold min-w-[20px] text-center">
                              {item.quantity || "١"}
                            </span>
                            {canEdit && !item.completed && (
                              <button
                                onClick={() => incrementMissingItemQuantity(item.id)}
                                className="w-5 h-5 flex items-center justify-center rounded-md text-slate-500 hover:text-emerald-700 hover:bg-white transition-colors"
                                title="زيادة الكمية"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Subtitle: Added by and notes */}
                        <div className="flex items-center space-x-3 space-x-reverse text-[11px] text-slate-400 mt-1">
                          <span className="flex items-center space-x-1 space-x-reverse">
                            {item.addedBy === "home" ? (
                              <>
                                <Smartphone className="w-3 h-3 text-blue-500" />
                                <span className="text-blue-600">هاتف المنزل</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700">المسؤول</span>
                              </>
                            )}
                          </span>

                          {item.notes && (
                            <>
                              <span>•</span>
                              <span className="text-slate-500">{item.notes}</span>
                            </>
                          )}

                          {(() => {
                            const status = getRecordSyncStatus("missing_items", item.id);
                            if (status === "PENDING") {
                              return (
                                <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded font-medium">
                                  قيد الانتظار (محلي)
                                </span>
                              );
                            }
                            if (status === "SYNCING") {
                              return (
                                <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-medium animate-pulse">
                                  جارِ المزامنة...
                                </span>
                              );
                            }
                            if (status === "FAILED") {
                              return (
                                <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded font-medium">
                                  فشلت المزامنة
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Left Actions: Delete (if permitted) */}
                    {canDelete && (
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <button
                          onClick={() => deleteMissingItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="حذف من النواقص"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed items toggle & clear */}
      {completedItems.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-slate-100/80 rounded-xl text-xs text-slate-600">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="font-semibold text-slate-700 hover:text-slate-900"
          >
            {showCompleted
              ? `إخفاء المكتملة (${completedItems.length})`
              : `عرض الأغراض التي تم شراؤها (${completedItems.length})`}
          </button>
          {canDelete && (
            <button
              onClick={clearCompletedItems}
              className="text-rose-600 hover:text-rose-700 font-semibold"
            >
              مسح المكتملة
            </button>
          )}
        </div>
      )}
    </div>
  );
};
