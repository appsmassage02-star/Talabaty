import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import {
  Bell,
  X,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Smartphone,
  ShieldCheck,
  Trash2,
  CheckCheck,
  Volume2,
  Sparkles,
} from "lucide-react";
import { playUrgentAlertRing } from "../utils/audioAlert";

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    notifications,
    unreadCount,
    markNotificationsAsRead,
    clearNotifications,
    deleteNotification,
    activeRole,
  } = useApp();

  const [filter, setFilter] = useState<"all" | "urgent" | "items" | "invoices">("all");

  useEffect(() => {
    if (isOpen && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "urgent") return n.type === "urgent_alert" || n.type === "budget_warning";
    if (filter === "items") return n.type === "item_added";
    if (filter === "invoices") return n.type === "purchase_made";
    return true;
  });

  const handleTestRing = () => {
    playUrgentAlertRing();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[88vh] flex flex-col text-right overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  مركز التنبيهات والإشعارات
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                    {unreadCount} غير مقروء
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                تنبيهات فورية متزامنة بين هاتف المسؤول وهاتف المنزل
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Toolbar */}
        <div className="px-5 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
          {/* Filters */}
          <div className="flex items-center space-x-1.5 space-x-reverse">
            <button
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${
                filter === "all"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              الكل ({notifications.length})
            </button>
            <button
              onClick={() => setFilter("urgent")}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${
                filter === "urgent"
                  ? "bg-rose-600 text-white"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100"
              }`}
            >
              🚨 عاجل
            </button>
            <button
              onClick={() => setFilter("items")}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${
                filter === "items"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              📦 نواقص
            </button>
            <button
              onClick={() => setFilter("invoices")}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${
                filter === "invoices"
                  ? "bg-blue-600 text-white"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              🛒 فواتير
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              onClick={handleTestRing}
              className="flex items-center space-x-1 space-x-reverse px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 font-bold text-[11px] transition-colors"
              title="تجربة صوت الرنين التنبيهي"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>تجربة النغمة</span>
            </button>

            {unreadCount > 0 && (
              <button
                onClick={markNotificationsAsRead}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1 space-x-reverse"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>تحديد كمقروء</span>
              </button>
            )}
          </div>
        </div>

        {/* Notification Items List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">لا توجد إشعارات في هذا التصنيف</p>
              <p className="text-xs text-slate-400">ستظهر هنا أي تنبيهات واردة لحظياً</p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isUrgent = notif.type === "urgent_alert" || notif.type === "budget_warning";
              return (
                <div
                  key={notif.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isUrgent
                      ? "bg-rose-50 border-rose-200 shadow-xs"
                      : notif.type === "item_added"
                      ? "bg-emerald-50/70 border-emerald-200"
                      : notif.type === "purchase_made"
                      ? "bg-blue-50/70 border-blue-200"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                          isUrgent
                            ? "bg-rose-600 text-white animate-bounce"
                            : notif.type === "item_added"
                            ? "bg-emerald-600 text-white"
                            : "bg-blue-600 text-white"
                        }`}
                      >
                        {isUrgent ? "🚨" : notif.type === "item_added" ? "📦" : "🛒"}
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        {notif.title}
                      </h4>
                    </div>

                    <div className="flex items-center space-x-1.5 space-x-reverse">
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {new Date(notif.timestamp).toLocaleTimeString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                        title="حذف الإشعار"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 mt-2 leading-relaxed pr-9">
                    {notif.message}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-semibold">
                      المستهدف:{" "}
                      {notif.targetRole === "admin"
                        ? "هاتف المسؤول"
                        : notif.targetRole === "home"
                        ? "هاتف المنزل"
                        : "الجميع"}
                    </span>

                    {isUrgent && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 font-bold">
                        أولوية قصوى
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={clearNotifications}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center space-x-1 space-x-reverse"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>مسح جميع الإشعارات</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
