import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import {
  CalendarCheck,
  X,
  AlertTriangle,
  Receipt,
  Wallet,
  TrendingDown,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Calendar,
} from "lucide-react";

interface EndMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export const EndMonthModal: React.FC<EndMonthModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    invoices,
    totalSpent,
    remainingBudget,
    budgetConfig,
    endCurrentFiscalMonth,
    setActiveTab,
  } = useApp();

  // Suggest next month
  const getSuggestedNextMonth = () => {
    try {
      const current = budgetConfig.month; // e.g. "أغسطس 2026"
      const parts = current.split(" ");
      if (parts.length >= 2) {
        const monthName = parts[0];
        const year = parseInt(parts[1], 10);
        const idx = ARABIC_MONTHS.indexOf(monthName);
        if (idx !== -1) {
          const nextIdx = (idx + 1) % 12;
          const nextYear = nextIdx === 0 ? year + 1 : year;
          return `${ARABIC_MONTHS[nextIdx]} ${nextYear}`;
        }
      }
    } catch {
      // fallback
    }
    return "الشهر الجديد";
  };

  const [nextMonthName, setNextMonthName] = useState<string>(getSuggestedNextMonth());
  const [nextBudgetLimit, setNextBudgetLimit] = useState<number>(
    budgetConfig.monthlyLimit
  );
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    endCurrentFiscalMonth(
      nextMonthName.trim() || getSuggestedNextMonth(),
      nextBudgetLimit > 0 ? nextBudgetLimit : budgetConfig.monthlyLimit
    );
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
      setActiveTab("archive");
    }, 1500);
  };

  const isSurplus = remainingBudget >= 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 border border-slate-200 shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-150 text-right"
        dir="rtl"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-5 left-5 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 space-x-reverse pr-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-500/30">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              إنهاء الشهر الحالي وأرشفة الفواتير
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              إغلاق حسابات شهر ({budgetConfig.month}) وتصفير قائمة المشتريات للبدء من جديد
            </p>
          </div>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-base font-black text-slate-900">
              تم إنهاء وأرشفة الشهر بنجاح!
            </h3>
            <p className="text-xs text-slate-600">
              تم حفظ سجلات شهر {budgetConfig.month} في الأرشيف وتجهيز ميزانية شهر {nextMonthName}. جاري نقلك لصفحة الأرشيف...
            </p>
          </div>
        ) : (
          <>
            {/* Month Summary Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <div className="text-xs font-bold text-slate-700 flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span>ملخص حسابات شهر {budgetConfig.month}:</span>
                <span className="font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                  جاهز للأرشفة
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 block mb-0.5">عدد الفواتير</span>
                  <span className="font-black text-blue-600 font-mono text-sm block">
                    {invoices.length}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 block mb-0.5">إجمالي المصروف</span>
                  <span className="font-black text-slate-900 font-mono text-sm block">
                    {totalSpent.toLocaleString("ar-SA")}
                  </span>
                  <span className="text-[9px] text-slate-400">{budgetConfig.currency}</span>
                </div>

                <div
                  className={`p-2.5 rounded-xl border ${
                    isSurplus
                      ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                      : "bg-rose-50/80 border-rose-200 text-rose-900"
                  }`}
                >
                  <span className="text-[10px] block mb-0.5 font-bold">المتبقي</span>
                  <span className="font-black font-mono text-sm block">
                    {remainingBudget.toLocaleString("ar-SA")}
                  </span>
                  <span className="text-[9px] font-bold">
                    {isSurplus ? "وفر مالي" : "عجز"}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-start space-x-2 space-x-reverse">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  عند التأكيد، سيتم نقل كافة الفواتير المسجلة ({invoices.length} فاتورة) إلى <strong>أرشيف الفواتير</strong>، وتصفير المشتريات الحالية لتبدأ من الصفر في الشهر الجديد.
                </p>
              </div>
            </div>

            {/* Next Month Configuration */}
            <div className="space-y-3 pt-1">
              <h4 className="text-xs font-bold text-slate-800">
                إعدادات الشهر المالي القادم:
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    اسم الشهر الجديد
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={nextMonthName}
                      onChange={(e) => setNextMonthName(e.target.value)}
                      placeholder="مثال: سبتمبر 2026"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    حد ميزانية الشهر الجديد ({budgetConfig.currency})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={nextBudgetLimit}
                      onChange={(e) => setNextBudgetLimit(Number(e.target.value) || 0)}
                      placeholder="2500"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white font-mono"
                    />
                    <Wallet className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 space-x-reverse pt-3 border-t border-slate-100">
              <button
                id="btn-confirm-end-month"
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center space-x-1.5 space-x-reverse"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>تأكيد إغلاق وأرشفة الشهر</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                إلغاء
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
