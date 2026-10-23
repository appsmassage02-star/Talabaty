import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { WifiOff, Wifi, AlertTriangle, CheckCircle2, X, Sparkles, ArrowLeft } from "lucide-react";

export const OfflineNotificationToast: React.FC = () => {
  const { isOnline, setActiveTab, isAuthenticated } = useApp();
  const [showBanner, setShowBanner] = useState(false);
  const [toastType, setToastType] = useState<"offline" | "online">("offline");
  const [isFirstRender, setIsFirstRender] = useState(true);

  useEffect(() => {
    if (isFirstRender) {
      setIsFirstRender(false);
      // If initially offline, show notice
      if (!isOnline) {
        setToastType("offline");
        setShowBanner(true);
      }
      return;
    }

    if (!isOnline) {
      setToastType("offline");
      setShowBanner(true);
    } else {
      setToastType("online");
      setShowBanner(true);
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!showBanner) return null;

  return (
    <div
      className="fixed top-16 sm:top-20 inset-x-3 sm:inset-x-auto sm:left-6 sm:max-w-md z-50 animate-in slide-in-from-top-4 duration-300 pointer-events-auto"
      dir="rtl"
    >
      {toastType === "offline" ? (
        <div className="bg-slate-900/95 text-white border-2 border-amber-500/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md space-y-2.5">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 space-x-reverse">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <WifiOff className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <h4 className="text-xs sm:text-sm font-black text-amber-400">
                    انقطع الاتصال بالإنترنت (وضع Offline)
                  </h4>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded-md">
                    محلي
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  تطبيق <strong>طلباتي</strong> يعمل بدون إنترنت عبر Service Worker؛ نواقصك وتعديلاتك محفوظة محلياً على الجهاز.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              title="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Warning regarding Gemini AI */}
          <div className="bg-amber-950/60 border border-amber-500/30 rounded-xl p-2.5 flex items-center space-x-2 space-x-reverse text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[11px] leading-tight">
              <strong>تنبيه ذكي:</strong> تم إيقاف المساعد الذكي <strong>Gemini API</strong> مؤقتاً لتجنب ضياع طلباتك الصوتية والنصية حتى عودة الاتصال.
            </span>
          </div>

          {/* Quick Action to Categories (Authenticated only) */}
          {isAuthenticated && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400">
                يمكنك إضافة النواقص مباشرة من قائمة الأقسام:
              </span>
              <button
                onClick={() => {
                  setActiveTab("categories");
                  setShowBanner(false);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center space-x-1 space-x-reverse transition-colors"
              >
                <span>تصفح الأقسام</span>
                <ArrowLeft className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-emerald-900/95 text-white border-2 border-emerald-500/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-emerald-300">
                  تمت استعادة الاتصال بالإنترنت بنجاح!
                </h4>
                <p className="text-xs text-emerald-100 flex items-center space-x-1 space-x-reverse mt-0.5">
                  <Sparkles className="w-3 h-3 text-emerald-300" />
                  <span>المساعد الذكي (Gemini) والمزامنة السحابية متاحان الآن.</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="text-emerald-300 hover:text-white p-1 rounded-lg hover:bg-emerald-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
