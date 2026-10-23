import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { CATEGORIES } from "../data/categories";
import {
  PieChart,
  Wallet,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Edit2,
  Check,
  Sparkles,
  ShieldAlert,
  ArrowUpRight,
} from "lucide-react";

export const BudgetView: React.FC = () => {
  const {
    budgetConfig,
    updateBudgetLimit,
    totalSpent,
    remainingBudget,
    spentPercentage,
    invoices,
    categories,
    activeRole,
  } = useApp();

  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [newLimitInput, setNewLimitInput] = useState(
    budgetConfig.monthlyLimit.toString()
  );

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(newLimitInput);
    if (val > 0) {
      updateBudgetLimit(val);
      setIsEditingLimit(false);
    }
  };

  // Spending per category distributed by each product's original category
  const availableCategories = categories && categories.length > 0 ? categories : CATEGORIES;
  const categorySpending = availableCategories.map((cat) => {
    let spentInCat = 0;

    for (const inv of invoices) {
      if (inv.products && inv.products.length > 0) {
        for (const prod of inv.products) {
          // If the product has an original category, use it. Otherwise fallback to invoice category.
          const prodCategory = prod.category || inv.category;
          if (prodCategory === cat.id) {
            spentInCat += Number(prod.price) || 0;
          }
        }
      } else if (inv.category === cat.id) {
        spentInCat += Number(inv.totalPrice) || 0;
      }
    }

    const pctOfTotal = totalSpent > 0 ? Math.round((spentInCat / totalSpent) * 100) : 0;
    return {
      category: cat,
      spent: spentInCat,
      pctOfTotal,
    };
  }).sort((a, b) => b.spent - a.spent);

  // Status color based on percentage
  const getStatusTheme = () => {
    if (spentPercentage >= 90) {
      return {
        bg: "bg-rose-50 border-rose-200 text-rose-800",
        bar: "bg-rose-600",
        text: "text-rose-600",
        badge: "bg-rose-100 text-rose-800",
        label: "تنبيه: اقتربت من استنفاد ميزانية الشهر بالكامل!",
      };
    }
    if (spentPercentage >= 70) {
      return {
        bg: "bg-amber-50 border-amber-200 text-amber-800",
        bar: "bg-amber-500",
        text: "text-amber-600",
        badge: "bg-amber-100 text-amber-800",
        label: "تحذير: تم استهلاك أكثر من ٧٠٪ من الميزانية المحددة",
      };
    }
    return {
      bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
      bar: "bg-emerald-600",
      text: "text-emerald-600",
      badge: "bg-emerald-100 text-emerald-800",
      label: "الميزانية ضمن الحدود الآمنة والمخطط لها ممتاز",
    };
  };

  const statusTheme = getStatusTheme();

  return (
    <div className="space-y-5">
      {/* Top Header & Overview */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                ميزانية ومصروفات المنزل
              </h2>
              <p className="text-xs text-slate-500">
                شهر {budgetConfig.month} • مراقبة فورية للمصروفات
              </p>
            </div>
          </div>

          {/* Edit Budget Limit button for Admin */}
          {activeRole === "admin" && (
            <div>
              {isEditingLimit ? (
                <form
                  onSubmit={handleSaveBudget}
                  className="flex items-center space-x-2 space-x-reverse"
                >
                  <input
                    type="number"
                    value={newLimitInput}
                    onChange={(e) => setNewLimitInput(e.target.value)}
                    className="w-28 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                  >
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingLimit(false)}
                    className="px-2 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs hover:bg-slate-200"
                  >
                    إلغاء
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setIsEditingLimit(true)}
                  className="flex items-center space-x-1.5 space-x-reverse px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>تعديل حد الميزانية</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3 Main KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Card 1: Total Budget */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-xs font-medium text-slate-500 block mb-1">
              الميزانية الكلية للشهر
            </span>
            <div className="flex items-baseline space-x-1.5 space-x-reverse">
              <span className="text-2xl font-black text-slate-900">
                {budgetConfig.monthlyLimit.toLocaleString("ar-SA")}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {budgetConfig.currency}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              الحد الأقصى المخصص للشهر
            </span>
          </div>

          {/* Card 2: Spent */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-xs font-medium text-slate-500 block mb-1">
              إجمالي المنفق حتى الآن
            </span>
            <div className="flex items-baseline space-x-1.5 space-x-reverse">
              <span className="text-2xl font-black text-blue-600">
                {totalSpent.toLocaleString("ar-SA")}
              </span>
              <span className="text-xs font-bold text-blue-500">
                {budgetConfig.currency}
              </span>
            </div>
            <span className="text-[10px] text-blue-500 mt-1 block">
              من {invoices.length} فواتير مسجلة
            </span>
          </div>

          {/* Card 3: Remaining */}
          <div
            className={`p-4 rounded-2xl border ${
              remainingBudget > 0
                ? "bg-emerald-50/70 border-emerald-200"
                : "bg-rose-50 border-rose-200"
            }`}
          >
            <span className="text-xs font-medium text-slate-600 block mb-1">
              المتبقي من الميزانية
            </span>
            <div className="flex items-baseline space-x-1.5 space-x-reverse">
              <span
                className={`text-2xl font-black ${
                  remainingBudget > 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {remainingBudget.toLocaleString("ar-SA")}
              </span>
              <span className="text-xs font-bold text-slate-600">
                {budgetConfig.currency}
              </span>
            </div>
            <span
              className={`text-[10px] font-bold mt-1 block ${
                remainingBudget > 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {remainingBudget > 0 ? "متاح للصرف" : "تجاوزت الميزانية!"}
            </span>
          </div>
        </div>

        {/* Visual Progress Bar Gauge */}
        <div className="mt-5 pt-5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">
              نسبة استهلاك الميزانية:
            </span>
            <span className={`text-sm font-black ${statusTheme.text}`}>
              {spentPercentage}٪ مستهلك
            </span>
          </div>

          {/* Progress Track */}
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${statusTheme.bar}`}
              style={{ width: `${spentPercentage}%` }}
            />
          </div>

          {/* Warning Banner */}
          <div
            className={`mt-3 p-3 rounded-xl border flex items-center space-x-2 space-x-reverse ${statusTheme.bg}`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-xs font-semibold leading-relaxed">
              {statusTheme.label}
            </span>
          </div>
        </div>
      </div>

      {/* Category Expenses Breakdown */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center space-x-2 space-x-reverse">
          <PieChart className="w-4 h-4 text-emerald-600" />
          <span>توزيع المصروفات بحسب الأقسام:</span>
        </h3>

        <div className="space-y-3">
          {categorySpending.map(({ category, spent, pctOfTotal }) => (
            <div key={category.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  {category.nameAr}
                </span>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="font-mono text-slate-600 font-semibold">
                    {spent.toLocaleString("ar-SA")} {budgetConfig.currency}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold w-9 text-left">
                    ({pctOfTotal}%)
                  </span>
                </div>
              </div>

              {/* Progress bar per category */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    category.id === "supermarket"
                      ? "bg-emerald-500"
                      : category.id === "vegetables_fruits"
                      ? "bg-amber-500"
                      : category.id === "meat_poultry"
                      ? "bg-rose-500"
                      : category.id === "spices"
                      ? "bg-orange-500"
                      : category.id === "home_essentials"
                      ? "bg-indigo-500"
                      : "bg-cyan-500"
                  }`}
                  style={{ width: `${pctOfTotal}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
