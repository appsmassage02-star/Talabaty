import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { CATEGORY_MAP } from "../data/categories";
import {
  Receipt,
  Plus,
  Calendar,
  Tag,
  CreditCard,
  Banknote,
  Building,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Archive,
  CalendarCheck2,
  Truck,
} from "lucide-react";
import { MyOrdersSection } from "./MyOrdersSection";

export const PurchasesView: React.FC = () => {
  const {
    invoices,
    setIsAddInvoiceModalOpen,
    setIsEndMonthModalOpen,
    setActiveTab,
    archivedMonths,
    budgetConfig,
    totalSpent,
    activeRole,
    getRecordSyncStatus,
  } = useApp();
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"invoices" | "orders">("invoices");

  useEffect(() => {
    const handleOrderCreated = () => {
      setActiveSection("orders");
    };
    window.addEventListener("delivery-order-created", handleOrderCreated);
    return () => {
      window.removeEventListener("delivery-order-created", handleOrderCreated);
    };
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedInvoiceId(expandedInvoiceId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              سجل الفواتير والمشتريات
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {invoices.length} فواتير نشطة
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              شهر: {budgetConfig.month}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            توثيق كامل لعمليات الشراء، المنتجات المستلمة، وتحديث الميزانية تلقائياً
          </p>
        </div>

        {/* Actions Cluster */}
        <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-2">
          {/* Archive View Navigation */}
          <button
            id="btn-nav-archive"
            onClick={() => setActiveTab("archive")}
            className="flex items-center space-x-1.5 space-x-reverse px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors border border-slate-200"
          >
            <Archive className="w-4 h-4 text-slate-600" />
            <span>أرشيف الفواتير</span>
            {archivedMonths.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-white font-black mr-1">
                {archivedMonths.length}
              </span>
            )}
          </button>

          {/* End Fiscal Month Button (Admin / Home) */}
          <button
            id="btn-end-fiscal-month"
            onClick={() => setIsEndMonthModalOpen(true)}
            className="flex items-center space-x-1.5 space-x-reverse px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            title="إغلاق الشهر الحالي وأرشفة جميع فواتيره وبدء شهر وميزانية جديدة"
          >
            <CalendarCheck2 className="w-4 h-4" />
            <span>إنهاء الشهر الحالي</span>
          </button>

          {/* Add Invoice Button */}
          <button
            id="btn-add-invoice-main"
            onClick={() => setIsAddInvoiceModalOpen(true)}
            className="flex items-center justify-center space-x-1.5 space-x-reverse px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة فاتورة</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-400 block">
            إجمالي مشتريات الشهر
          </span>
          <span className="text-lg font-black text-slate-900 mt-0.5 block">
            {totalSpent.toLocaleString("ar-SA")} {budgetConfig.currency}
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-400 block">
            عدد الفواتير
          </span>
          <span className="text-lg font-black text-blue-600 mt-0.5 block">
            {invoices.length} فاتورة
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-slate-400 block">
            متوسط قيمة الفاتورة
          </span>
          <span className="text-lg font-black text-emerald-600 mt-0.5 block">
            {invoices.length > 0
              ? Math.round(totalSpent / invoices.length).toLocaleString("ar-SA")
              : 0}{" "}
            {budgetConfig.currency}
          </span>
        </div>
      </div>

      {/* Section Navigation Tabs: Invoices vs My Orders */}
      <div className="flex items-center space-x-2 space-x-reverse bg-slate-100/80 p-1 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSection("invoices")}
          className={`flex-1 flex items-center justify-center space-x-2 space-x-reverse py-2.5 px-4 rounded-xl text-xs font-black transition-all ${
            activeSection === "invoices"
              ? "bg-white text-blue-700 shadow-xs border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Receipt className="w-4 h-4 ml-1.5" />
          <span>سجل الفواتير والمشتريات ({invoices.length})</span>
        </button>

        <button
          type="button"
          id="btn-tab-my-orders"
          onClick={() => setActiveSection("orders")}
          className={`flex-1 flex items-center justify-center space-x-2 space-x-reverse py-2.5 px-4 rounded-xl text-xs font-black transition-all ${
            activeSection === "orders"
              ? "bg-white text-blue-700 shadow-xs border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Truck className="w-4 h-4 ml-1.5" />
          <span>طلباتي (التوصيل للمنزل)</span>
        </button>
      </div>

      {/* Conditional Rendering: Invoices List vs My Orders Section */}
      {activeSection === "orders" ? (
        <MyOrdersSection />
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-3">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto">
            <Receipt className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            لا توجد فواتير مسجلة حتى الآن
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            اضغط على "إضافة فاتورة جديدة" لتوثيق مشترياتك وخصمها من ميزانية المنزل
          </p>
          <button
            onClick={() => setIsAddInvoiceModalOpen(true)}
            className="inline-flex items-center space-x-1.5 space-x-reverse px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل فاتورة الآن</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const isExpanded = expandedInvoiceId === invoice.id;
            const category = CATEGORY_MAP[invoice.category];

            return (
              <div
                key={invoice.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs transition-all"
              >
                {/* Invoice Main Row */}
                <div
                  onClick={() => toggleExpand(invoice.id)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold ${
                        category ? category.bgLight : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <ShoppingBag className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-1.5">
                        <span className="font-bold text-slate-900 text-sm">
                          {invoice.notes?.replace(/\[ARCHIVED:[^\]]+\]/g, "").trim() || `فاتورة ${invoice.categoryArabic}`}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          #{invoice.invoiceNumber}
                        </span>
                        {(invoice.notes?.includes("توصيل") || invoice.notes?.includes("طلب توصيل")) && (
                          <span className="inline-flex items-center space-x-1 space-x-reverse px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Truck className="w-3 h-3 text-blue-600" />
                            <span>توصيل للمنزل</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 space-x-reverse text-xs text-slate-500 mt-1">
                        <span className="flex items-center space-x-1 space-x-reverse">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{invoice.date}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center space-x-1 space-x-reverse">
                          <Tag className="w-3.5 h-3.5 text-slate-400" />
                          <span>{invoice.categoryArabic}</span>
                        </span>
                        <span>•</span>
                        <span>{invoice.products.length} أصناف</span>
                      </div>
                    </div>
                  </div>

                  {/* Price & Chevron */}
                  <div className="flex items-center space-x-3 space-x-reverse text-left">
                    <div className="text-left">
                      <span className="text-base font-black text-slate-900 block leading-tight">
                        {invoice.totalPrice.toLocaleString("ar-SA")}{" "}
                        <span className="text-xs font-bold text-slate-500">
                          {budgetConfig.currency}
                        </span>
                      </span>
                      {(() => {
                        const status = getRecordSyncStatus("invoices", invoice.id);
                        if (status === "PENDING") {
                          return (
                            <span className="text-[10px] text-amber-600 font-medium">
                              في انتظار المزامنة
                            </span>
                          );
                        }
                        if (status === "SYNCING") {
                          return (
                            <span className="text-[10px] text-blue-600 font-medium animate-pulse">
                              جارِ المزامنة...
                            </span>
                          );
                        }
                        if (status === "FAILED") {
                          return (
                            <span className="text-[10px] text-rose-600 font-medium">
                              فشلت المزامنة (محلي)
                            </span>
                          );
                        }
                        if (status === "OFFLINE_CACHED") {
                          return (
                            <span className="text-[10px] text-slate-500 font-medium">
                              محفوظ محلياً
                            </span>
                          );
                        }
                        return (
                          <span className="text-[10px] text-emerald-600 font-medium">
                            متزامن سحابياً
                          </span>
                        );
                      })()}
                    </div>

                    <button className="text-slate-400 hover:text-slate-600 p-1">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Products Details */}
                {isExpanded && (
                  <div className="bg-slate-50/80 p-4 border-t border-slate-100 text-xs animate-in fade-in duration-100">
                    <h4 className="font-bold text-slate-700 mb-2">
                      الأصناف المشتراة في هذه الفاتورة:
                    </h4>
                    <div className="divide-y divide-slate-200/60 bg-white rounded-xl border border-slate-200 overflow-hidden mb-3">
                      {invoice.products.map((p, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2 space-x-reverse min-w-0">
                            <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-medium text-slate-900 truncate">
                              {p.name}
                            </span>
                            {p.categoryArabic && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                {p.categoryArabic}
                              </span>
                            )}
                            {p.quantity && (
                              <span className="text-slate-400 text-[11px] shrink-0">
                                ({p.quantity})
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-slate-800">
                            {p.price > 0
                              ? `${p.price} ${budgetConfig.currency}`
                              : "سعر إجمالي"}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                      <span>
                        سُجلت بواسطة: <strong>{invoice.registeredBy}</strong>
                      </span>
                      <span>
                        طريقة الدفع:{" "}
                        {invoice.paymentMethod === "card"
                          ? "بطاقة مدى / ائتمان"
                          : invoice.paymentMethod === "cash"
                          ? "نقداً (كاش)"
                          : "تحويل بنكي"}
                      </span>
                    </div>
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
