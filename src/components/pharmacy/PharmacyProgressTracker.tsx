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
          <h4 className="text-xs font-bold text-rose-800">تم الإلغاء</h4>
          <p className="text-[11px] text-rose-600 mt-0.5">تم إلغاء هذا الطلب ولا يتم تنفيذه حالياً.</p>
        </div>
      </div>
    );
  }

  if (status === "cancellation_requested") {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3.5 text-right flex items-center space-x-2.5 space-x-reverse">
        <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-orange-900">طلب إلغاء</h4>
          <p className="text-[11px] text-orange-700 mt-0.5">تم إرسال طلب إلغاء الطلب وجاري مراجعته.</p>
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

  const steps = [
    { key: "pending_review", label: "قيد المراجعة", icon: Clock },
    { key: "accepted", label: "تم القبول", icon: Check },
    { key: "shopping", label: "جاري التجهيز", icon: ShoppingBag },
    { key: "ready_for_delivery", label: "جاري التوصيل", icon: Truck },
    { key: "completed", label: "تم التوصيل", icon: CheckCircle2 },
  ];

  const getStepIndex = (s: PharmacyOrderStatus): number => {
    switch (s) {
      case "pending_review":
        return 0;
      case "accepted":
        return 1;
      case "shopping":
        return 2;
      case "ready_for_delivery":
        return 3;
      case "completed":
        return 4;
      default:
        return 0;
    }
  };

  const currentStepIndex = getStepIndex(status);

  const getStepState = (stepIndex: number) => {
    if (stepIndex < currentStepIndex) return "completed";
    if (stepIndex === currentStepIndex) return status === "completed" ? "completed" : "current";
    return "upcoming";
  };

  const progressWidth =
    status === "pending_review"
      ? "10%"
      : status === "accepted"
      ? "30%"
      : status === "shopping"
      ? "55%"
      : status === "ready_for_delivery"
      ? "80%"
      : "100%";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs text-right">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-3">
        <span>مراحل تجهيز وتوصيل الروشتة</span>
        <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
          {status === "pending_review" && "قيد المراجعة"}
          {status === "accepted" && "تم القبول"}
          {status === "shopping" && "جاري التجهيز"}
          {status === "ready_for_delivery" && "جاري التوصيل"}
          {status === "completed" && "تم التوصيل"}
        </span>
      </div>

      <div className="relative flex items-center justify-between">
        {/* Progress Line */}
        <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-1 bg-slate-100 -z-0">
          <div
            className="h-full bg-emerald-600 transition-all duration-500"
            style={{ width: progressWidth }}
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
                className={`text-[9px] sm:text-[10px] font-bold mt-1.5 text-center max-w-[60px] sm:max-w-[78px] leading-tight ${
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
