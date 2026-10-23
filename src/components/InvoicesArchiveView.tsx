import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { CATEGORY_MAP } from "../data/categories";
import { ArchivedMonthRecord } from "../types";
import {
  Archive,
  ArrowRight,
  Trash2,
  Calendar,
  DollarSign,
  Receipt,
  Tag,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Building,
  Layers,
  Truck,
} from "lucide-react";

export const InvoicesArchiveView: React.FC = () => {
  const {
    archivedMonths,
    clearAllArchives,
    deleteArchivedMonth,
    setActiveTab,
    budgetConfig,
  } = useApp();

  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>("all");

  const toggleExpand = (id: string) => {
    setExpandedRecordId(expandedRecordId === id ? null : id);
  };

  const filteredArchives = archivedMonths.filter((rec) => {
    if (selectedMonthFilter === "all") return true;
    return rec.id === selectedMonthFilter;
  });

  const totalAllTimeArchivedSpent = archivedMonths.reduce(
    (sum, m) => sum + m.totalSpent,
    0
  );
  const totalAllTimeInvoicesCount = archivedMonths.reduce(
    (sum, m) => sum + m.invoicesCount,
    0
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-200" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <h1 className="text-lg font-black text-slate-900">
                أرشيف الفواتير والمصروفات الشهرية
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                {archivedMonths.length} شهور مؤرشفة
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              سجل تفصيلي بالشهور المنتهية، عدد الفواتير، المبالغ المصروفة، والمتبقي من الميزانية
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse">
          {archivedMonths.length > 0 && (
            <button
              id="btn-clear-archive-open"
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center space-x-1.5 space-x-reverse px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-colors"
              title="تفريغ كافة سجلات الأرشيف"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>تفريغ الأرشيف</span>
            </button>
          )}

          <button
            id="btn-back-to-purchases"
            type="button"
            onClick={() => setActiveTab("purchases")}
            className="flex items-center space-x-1.5 space-x-reverse px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للمشتريات الحالية</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Clearing Archive */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-right">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-black text-slate-900">
                تأكيد تفريغ أرشيف الفواتير بالكامل
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف جميع الفواتير والشهور المؤرشفة ({archivedMonths.length} شهر)؟ لن تتمكن من استرجاعها بعد الحذف.
              </p>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse pt-2">
              <button
                id="btn-confirm-clear-archive"
                type="button"
                onClick={() => {
                  clearAllArchives();
                  setShowClearConfirm(false);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                نعم، تفريغ الأرشيف نهائياً
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Archive Statistics Strip */}
      {archivedMonths.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 block mb-1">
              إجمالي عدد الفواتير المؤرشفة
            </span>
            <div className="flex items-baseline space-x-1.5 space-x-reverse">
              <span className="text-2xl font-black text-blue-600 font-mono">
                {totalAllTimeInvoicesCount}
              </span>
              <span className="text-xs font-bold text-slate-500">فاتورة</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              عبر {archivedMonths.length} شهور سابقة
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 block mb-1">
              إجمالي المبالغ المصروفة تاريخياً
            </span>
            <div className="flex items-baseline space-x-1.5 space-x-reverse">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {totalAllTimeArchivedSpent.toLocaleString("ar-SA")}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {budgetConfig.currency}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              مجموع مصروفات الشهور المغلقة
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 block mb-1">
              تصفية حسب الشهر
            </span>
            <select
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">كافة الشهور السابقة ({archivedMonths.length})</option>
              {archivedMonths.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.monthName} ({m.invoicesCount} فواتير - {m.totalSpent} {m.currency})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Empty State */}
      {archivedMonths.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-xs text-center space-y-4 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
            <Archive className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">
              الأرشيف فارغ حالياً
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              عند انتهاء الشهر المالي الحالي، يمكنك الضغط على زر <strong>"إنهاء الشهر الحالي"</strong> في شاشة المشتريات لأرشفة الفواتير وتصفير العداد وبدء شهر جديد تلقائياً.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("purchases")}
            className="inline-flex items-center space-x-1.5 space-x-reverse px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <Receipt className="w-4 h-4" />
            <span>عرض الفواتير الحالية</span>
          </button>
        </div>
      ) : (
        /* Archived Months List */
        <div className="space-y-4">
          {filteredArchives.map((record) => {
            const isExpanded = expandedRecordId === record.id;
            const isBudgetSurplus = record.remainingBudget >= 0;

            return (
              <div
                key={record.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs transition-all hover:border-slate-300"
              >
                {/* Month Summary Card Header */}
                <div
                  onClick={() => toggleExpand(record.id)}
                  className="p-4 sm:p-5 cursor-pointer hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    {/* Left Info */}
                    <div className="flex items-start space-x-3.5 space-x-reverse">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex flex-col items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-emerald-400" />
                        <span className="text-[9px] font-bold text-slate-300 mt-0.5">مؤرشف</span>
                      </div>

                      <div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <h3 className="text-base font-black text-slate-900">
                            شهر {record.monthName}
                          </h3>
                          <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                            مغلق
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                          <span>
                            تاريخ الأرشفة:{" "}
                            {new Date(record.archivedAt).toLocaleDateString("ar-SA", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          {record.closedBy && (
                            <>
                              <span>•</span>
                              <span>أُغلق بواسطة: {record.closedBy}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right 3 Required Statistics: عدد الفواتير / إجمالي قيمتها / المبلغ المتبقي من الميزانية */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      {/* Metric 1: Invoices Count */}
                      <div className="bg-blue-50/80 border border-blue-200/80 px-3 py-2 rounded-xl text-center min-w-[85px]">
                        <span className="text-[10px] font-bold text-blue-700 block">
                          عدد الفواتير
                        </span>
                        <span className="text-sm font-black text-blue-900 font-mono">
                          {record.invoicesCount} فاتورة
                        </span>
                      </div>

                      {/* Metric 2: Total Spent */}
                      <div className="bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl text-center min-w-[100px]">
                        <span className="text-[10px] font-bold text-slate-600 block">
                          إجمالي المصروف
                        </span>
                        <span className="text-sm font-black text-slate-900 font-mono">
                          {record.totalSpent.toLocaleString("ar-SA")} {record.currency}
                        </span>
                      </div>

                      {/* Metric 3: Remaining Budget at Month End */}
                      <div
                        className={`border px-3 py-2 rounded-xl text-center min-w-[110px] ${
                          isBudgetSurplus
                            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                            : "bg-rose-50 border-rose-200 text-rose-900"
                        }`}
                      >
                        <span className="text-[10px] font-bold block opacity-80">
                          المتبقي من الميزانية
                        </span>
                        <span className="text-sm font-black font-mono">
                          {record.remainingBudget.toLocaleString("ar-SA")} {record.currency}
                        </span>
                      </div>

                      {/* Chevron & Delete button */}
                      <div className="flex items-center space-x-1 space-x-reverse">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`هل أنت متأكد من حذف أرشيف شهر ${record.monthName}؟`)) {
                              deleteArchivedMonth(record.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          title="حذف هذا الشهر من الأرشيف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-xl transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Invoices Details */}
                {isExpanded && (
                  <div className="bg-slate-50 p-4 sm:p-5 border-t border-slate-200 animate-in fade-in duration-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                        <Receipt className="w-4 h-4 text-blue-600" />
                        <span>تفاصيل الفواتير المسجلة في شهر {record.monthName} ({record.invoices.length} فواتير):</span>
                      </h4>
                      <span className="text-[11px] font-bold text-slate-500">
                        الحد المالي الأساسي: {record.budgetLimit.toLocaleString("ar-SA")} {record.currency}
                      </span>
                    </div>

                    {record.invoices.length === 0 ? (
                      <div className="p-4 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                        لا توجد فواتير مفصلة محفوظة في هذا السجل
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {record.invoices.map((inv, idx) => {
                          const cat = CATEGORY_MAP[inv.category];
                          return (
                            <div
                              key={inv.id || idx}
                              className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2.5 space-x-reverse">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                      cat ? cat.bgLight : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    <ShoppingBag className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-1">
                                      <span className="font-bold text-slate-900 text-xs block">
                                        {inv.notes?.replace(/\[ARCHIVED:[^\]]+\]/g, "").trim() || `فاتورة ${inv.categoryArabic}`}
                                      </span>
                                      {(inv.notes?.includes("توصيل") || inv.notes?.includes("طلب توصيل")) && (
                                        <span className="inline-flex items-center space-x-1 space-x-reverse px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                          <Truck className="w-2.5 h-2.5 text-blue-600" />
                                          <span>توصيل</span>
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      #{inv.invoiceNumber} • {inv.date} • {inv.categoryArabic}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-left">
                                  <span className="text-xs font-black text-slate-900 block font-mono">
                                    {inv.totalPrice.toLocaleString("ar-SA")} {record.currency}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {inv.paymentMethod === "card"
                                      ? "بطاقة"
                                      : inv.paymentMethod === "cash"
                                      ? "كاش"
                                      : "تحويل"}
                                  </span>
                                </div>
                              </div>

                              {/* Products List in this invoice */}
                              {inv.products && inv.products.length > 0 && (
                                <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                                  {inv.products.map((p, pIdx) => (
                                    <div
                                      key={pIdx}
                                      className="flex items-center justify-between px-2 py-1 bg-slate-50 rounded-lg text-slate-700"
                                    >
                                      <span className="flex items-center space-x-1.5 space-x-reverse min-w-0">
                                        <span className="truncate">• {p.name}</span>
                                        {p.categoryArabic && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                            {p.categoryArabic}
                                          </span>
                                        )}
                                        {p.quantity && (
                                          <span className="text-slate-400 shrink-0">({p.quantity})</span>
                                        )}
                                      </span>
                                      <span className="font-bold font-mono text-slate-800">
                                        {p.price > 0 ? `${p.price} ${record.currency}` : "—"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Delivery Orders in this Archive Record */}
                    {record.deliveryOrders && record.deliveryOrders.length > 0 && (
                      <div className="pt-3 border-t border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                            <Truck className="w-4 h-4 text-emerald-600" />
                            <span>طلبات التوصيل للمنزل المؤرشفة ({record.deliveryOrders.length} طلبات):</span>
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {record.deliveryOrders.map((ord, oIdx) => {
                            const totalVal = ord.actual_total_amount && ord.actual_total_amount > 0
                              ? ord.actual_total_amount
                              : ord.total_amount || 0;
                            return (
                              <div
                                key={ord.id || oIdx}
                                className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center space-x-2.5 space-x-reverse">
                                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                                    <Truck className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                      <span className="font-mono font-bold text-slate-800">
                                        #{ord.id.slice(-6)}
                                      </span>
                                      <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200 font-bold">
                                        مكتمل ومؤرشف
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400">
                                      {ord.created_at ? new Date(ord.created_at).toLocaleDateString("ar-SA") : ""} • {ord.items?.length || 0} أصناف
                                    </span>
                                  </div>
                                </div>
                                <div className="text-left">
                                  <span className="font-black text-emerald-700 font-mono text-xs block">
                                    {totalVal.toLocaleString("ar-SA")} {record.currency}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    مشتريات: {(ord.actual_items_total || ord.subtotal || 0).toLocaleString("ar-SA")} + توصيل: {(ord.delivery_fee || 0).toLocaleString("ar-SA")}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
