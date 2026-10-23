import React from "react";
import { PharmacyOrderStatus } from "../../types/pharmacy";
import { Check, Clock, ShoppingBag, Truck, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface PharmacyProgressTrackerProps {
  status: PharmacyOrderStatus;
}

export const PharmacyProgressTracker: React.FC<PharmacyProgressTrackerProps> = ({ status }) => {
  if (status === "cancelled") {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-right flex items-center space-x-2.5 space-x-reverse">
        <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
          <XCircle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-rose-800">تم إلغاء الطلب</h4>
          <p className="text-[11px] text-rose-600 mt-0.5">تم إلغاء هذا الطلب ولا يتم تنفيذه حالياً.</p>
        </div>
      </div>
    );
  }

  if (status === "unable_to_fulfill") {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-right flex items-center space-x-2.5 space-x-reverse">
        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-amber-900">تعذر تجهيز الطلب</h4>
          <p className="text-[11px] text-amber-700 mt-0.5">الأدوية المطلوبة غير متوفرة بالصيدليات المعتمدة.</p>
        </div>
      </div>
    );
  }

  // 4 Main Steps defined in Requirement 9:
  // 1: قيد المراجعة (pending_review)
  // 2: تم القبول وجاري التجهيز (accepted, shopping)
  // 3: تم التجهيز وجاري التوصيل (ready_for_delivery)
  // 4: تم التوصيل (completed)

  const steps = [
    { key: "pending_review", label: "قيد المراجعة", icon: Clock },
    { key: "in_progress", label: "تم القبول وجاري التجهيز", icon: ShoppingBag },
    { key: "ready_for_delivery", label: "تم التجهيز وجاري التوصيل", icon: Truck },
    { key: "completed", label: "تم التوصيل", icon: CheckCircle2 },
  ];

  const getStepState = (stepIndex: number) => {
    let currentStepIndex = 0;
    if (status === "pending_review") currentStepIndex = 0;
    else if (status === "accepted" || status === "shopping") currentStepIndex = 1;
    else if (status === "ready_for_delivery") currentStepIndex = 2;
    else if (status === "completed") currentStepIndex = 3;

    if (stepIndex < currentStepIndex) return "completed";
    if (stepIndex === currentStepIndex) return "current";
    return "upcoming";
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs text-right">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-3">
        <span>مراحل تجهيز وتوصيل الروشتة</span>
        <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
          {status === "pending_review" && "مراجعة الصيدلية"}
          {(status === "accepted" || status === "shopping") && "جاري الشراء والتجهيز"}
          {status === "ready_for_delivery" && "في الطريق إليك"}
          {status === "completed" && "تم الاستلام"}
        </span>
      </div>

      <div className="relative flex items-center justify-between">
        {/* Progress Line */}
        <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-1 bg-slate-100 -z-0">
          <div
            className="h-full bg-emerald-600 transition-all duration-500"
            style={{
              width:
                status === "pending_review"
                  ? "12%"
                  : status === "accepted" || status === "shopping"
                  ? "45%"
                  : status === "ready_for_delivery"
                  ? "78%"
                  : "100%",
            }}
          />
        </div>

        {/* Steps */}
        {steps.map((step, idx) => {
          const state = getStepState(idx);
          const Icon = step.icon;
          return (
            <div key={step.key} className="flex flex-col items-center relative z-10">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                  state === "completed"
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-50"
                    : state === "current"
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-100 animate-pulse"
                    : "bg-white text-slate-400 border-2 border-slate-200"
                }`}
              >
                {state === "completed" ? (
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                ) : (
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
              </div>
              <span
                className={`text-[9px] sm:text-[10px] font-bold mt-1.5 text-center max-w-[70px] sm:max-w-[85px] leading-tight ${
                  state === "completed" || state === "current"
                    ? "text-emerald-900"
                    : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
