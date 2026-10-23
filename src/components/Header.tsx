import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import {
  Smartphone,
  ShieldCheck,
  QrCode,
  Bell,
  Sparkles,
  Code2,
  Home,
  Settings,
  Volume2,
  PhoneCall,
  User,
  LogIn,
  Wifi,
  WifiOff,
  Download,
  Info,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Repeat,
} from "lucide-react";
import { PwaStatusModal } from "./PwaStatusModal";

export const Header: React.FC = () => {
  const [isPwaStatusModalOpen, setIsPwaStatusModalOpen] = useState(false);

  const {
    activeRole,
    setActiveRole,
    household,
    activeTab,
    setActiveTab,
    selectedCategory,
    setSelectedCategory,
    unreadCount,
    setIsQrModalOpen,
    setIsAiModalOpen,
    setIsNotificationsModalOpen,
    setIsRecurringOrdersModalOpen,
    recurringOrders,
    supabaseUser,
    supabaseProfile,
    incomingAlert,
    dismissIncomingAlert,
    sendHomeAttentionAlert,
    homePermissions,
    syncState,
    syncMetrics,
    isOnline,
    isServiceWorkerActive,
    isInstallable,
    promptInstallPwa,
  } = useApp();

  const userDisplayName =
    supabaseProfile?.fullName ||
    supabaseUser?.user_metadata?.full_name ||
    (activeRole === "admin" ? household?.adminName || "المسؤول" : "هاتف المنزل");

  const avatarInitial = userDisplayName
    ? userDisplayName.trim().charAt(0).toUpperCase()
    : "م";

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      {/* Offline / Sync Status Warning Bar - Clickable to open PWA diagnostics */}
      {!isOnline ? (
        <div
          onClick={() => setIsPwaStatusModalOpen(true)}
          className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 cursor-pointer text-white px-3.5 py-1.5 shadow-xs flex items-center justify-between text-[11px] font-bold transition-all"
        >
          <div className="flex items-center space-x-2 space-x-reverse">
            <WifiOff className="w-3.5 h-3.5 animate-pulse text-amber-200" />
            <span>
              وضع عدم الاتصال بالإنترنت - التعديلات محفوظة محلياً
              {syncMetrics.totalPending > 0 ? ` (${syncMetrics.totalPending} عملية معلقة للمزامنة)` : ""} (انقر للتفاصيل) ⚡
            </span>
          </div>
          <span className="text-[10px] bg-black/25 px-2 py-0.5 rounded-md font-mono flex items-center space-x-1 space-x-reverse">
            <span>Offline</span>
            <Info className="w-3 h-3 text-amber-200" />
          </span>
        </div>
      ) : syncMetrics.totalFailed > 0 ? (
        <div
          onClick={() => setIsPwaStatusModalOpen(true)}
          className="bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 cursor-pointer text-white px-3.5 py-1.5 shadow-xs flex items-center justify-between text-[11px] font-bold transition-all"
        >
          <div className="flex items-center space-x-2 space-x-reverse">
            <AlertCircle className="w-3.5 h-3.5 animate-pulse text-rose-200" />
            <span>توجد {syncMetrics.totalFailed} عمليات تعثرت مزامنتها - انقر للمعاينة وإعادة المحاولة</span>
          </div>
          <span className="text-[10px] bg-black/25 px-2 py-0.5 rounded-md font-mono">Sync Error</span>
        </div>
      ) : syncState === "SYNCING" ? (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3.5 py-1 shadow-xs flex items-center justify-between text-[11px] font-bold">
          <div className="flex items-center space-x-2 space-x-reverse">
            <RefreshCw className="w-3 h-3 animate-spin text-blue-200" />
            <span>جارِ مزامنة البيانات مع السحابة ({syncMetrics.totalPending} متبقية)...</span>
          </div>
          <span className="text-[10px] bg-black/25 px-2 py-0.5 rounded-md font-mono">Syncing</span>
        </div>
      ) : null}

      {/* Active Incoming Ring Banner for Admin / Home */}
      {incomingAlert?.active && (
        <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 text-white px-3.5 py-2.5 shadow-md flex items-center justify-between text-xs font-bold animate-pulse">
          <div className="flex items-center space-x-2 space-x-reverse">
            <div className="w-6 h-6 rounded-full bg-white text-rose-600 flex items-center justify-center animate-bounce">
              <PhoneCall className="w-3.5 h-3.5" />
            </div>
            <span>🚨 رنين تنبيه عاجل: {incomingAlert.message}</span>
          </div>
          <div className="flex items-center space-x-1.5 space-x-reverse">
            <button
              onClick={() => {
                setActiveTab("missing");
                dismissIncomingAlert();
              }}
              className="px-2.5 py-1 bg-white text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors"
            >
              عرض النواقص
            </button>
            <button
              onClick={dismissIncomingAlert}
              className="px-2 py-1 bg-black/20 hover:bg-black/30 text-white rounded-lg text-xs transition-colors"
            >
              إيقاف
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Right: Logo and App Title + Connection Status Badge */}
          <div className="flex items-center space-x-2.5 space-x-reverse">
            <div
              onClick={() => {
                setSelectedCategory(null);
                setActiveTab("categories");
              }}
              className="flex items-center space-x-2.5 space-x-reverse cursor-pointer group"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-emerald-200 p-0.5 shadow-xs overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <img
                  src="/app-logo.png"
                  alt="طلباتي"
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    // Fallback to vector icon if image fails
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
              <div>
                <div className="flex items-center space-x-1.5 space-x-reverse">
                  <h1 className="text-base sm:text-lg font-black text-slate-900 leading-none">
                    طلباتي
                  </h1>
                  <span className="hidden md:inline text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {household ? household.name : "المنزل"}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 block leading-tight mt-0.5 sm:hidden">
                  {household ? household.name : "طلبات ومشتريات المنزل"}
                </span>
              </div>
            </div>

            {/* Visual Connection & Service Worker Status Badge */}
            <button
              id="btn-connection-status-badge"
              onClick={() => setIsPwaStatusModalOpen(true)}
              className={`flex items-center space-x-1.5 space-x-reverse px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border shadow-2xs ${
                !isOnline
                  ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 animate-pulse"
                  : syncMetrics.totalFailed > 0
                  ? "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200"
                  : syncState === "SYNCING"
                  ? "bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200"
                  : "bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800 border-emerald-200 hover:border-emerald-300"
              }`}
              title={
                !isOnline
                  ? "يعمل دون إنترنت (Offline Mode) • التعديلات محفوظة محلياً - انقر للتفاصيل"
                  : syncMetrics.totalFailed > 0
                  ? `توجد ${syncMetrics.totalFailed} عمليات تعثرت مزامنتها - انقر للتفاصيل`
                  : syncState === "SYNCING"
                  ? `جارِ المزامنة السحابية (${syncMetrics.totalPending} متبقية)`
                  : "متصل ومزامن بالكامل مع السحابة • PWA نشط"
              }
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    !isOnline
                      ? "bg-amber-400"
                      : syncMetrics.totalFailed > 0
                      ? "bg-rose-400"
                      : syncState === "SYNCING"
                      ? "bg-blue-400"
                      : "bg-emerald-400"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    !isOnline
                      ? "bg-amber-500"
                      : syncMetrics.totalFailed > 0
                      ? "bg-rose-500"
                      : syncState === "SYNCING"
                      ? "bg-blue-500"
                      : "bg-emerald-500"
                  }`}
                />
              </span>
              {!isOnline ? (
                <WifiOff className="w-3 h-3 text-amber-700" />
              ) : syncState === "SYNCING" ? (
                <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
              ) : (
                <Wifi className="w-3 h-3 text-emerald-600" />
              )}
              <span className="font-bold">
                {!isOnline
                  ? "Offline"
                  : syncState === "SYNCING"
                  ? "مزامنة..."
                  : syncMetrics.totalPending > 0
                  ? `${syncMetrics.totalPending} معلق`
                  : "متصل ومزامن"}
              </span>
              {isServiceWorkerActive && isOnline && (
                <span className="hidden xl:inline text-[9px] bg-emerald-200/60 text-emerald-900 px-1 py-0.2 rounded font-mono">
                  PWA
                </span>
              )}
            </button>
          </div>

          {/* Left: Controls and Actions */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 space-x-reverse">
            {/* Quick Urgent Alert Button for Home Phone */}
            {(activeRole === "home" || activeRole === "household_member") && homePermissions.canSendUrgentAlert && (
              <button
                id="btn-urgent-alert-header"
                onClick={sendHomeAttentionAlert}
                className="flex items-center space-x-1 space-x-reverse px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white text-[11px] font-bold shadow-xs transition-all animate-pulse"
                title="إرسال رنين صوتي عاجل للمسؤول"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تنبيه المسؤول</span>
              </button>
            )}

            {/* Active Device / Role Status Badge */}
            <div
              className={`flex items-center space-x-1.5 space-x-reverse px-2.5 py-1 rounded-xl text-[11px] font-bold border shadow-2xs ${
                activeRole === "admin"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : !household
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-blue-50 text-blue-800 border-blue-200"
              }`}
              title={
                activeRole === "admin"
                  ? "جلسة المسؤول (الأب / الأم) - كامل الصلاحيات"
                  : !household
                  ? "غير مرتبط بمنزل"
                  : "هاتف المنزل المتصل - صلاحيات البيت"
              }
            >
              {activeRole === "admin" ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              ) : !household ? (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>
                {activeRole === "admin"
                  ? "المسؤول"
                  : !household
                  ? "غير مرتبط"
                  : "هاتف المنزل"}
              </span>
            </div>

            {/* PWA Install Button when available */}
            {isInstallable && (
              <button
                id="btn-install-pwa"
                onClick={() => promptInstallPwa()}
                className="flex items-center space-x-1 space-x-reverse px-2 sm:px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition-all animate-pulse"
                title="تثبيت تطبيق طلباتي كـ PWA على الهاتف"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تثبيت التطبيق</span>
              </button>
            )}

            {/* QR Code Action Button */}
            <button
              id="btn-qr-modal"
              onClick={() => setIsQrModalOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
              title={activeRole === "admin" ? "توليد كود QR لربط هاتف المنزل" : "مسح كود QR"}
            >
              <QrCode className="w-4 h-4" />
            </button>

            {/* Recurring Orders ("طلباتي") Button */}
            <button
              id="btn-recurring-orders-header"
              onClick={() => setIsRecurringOrdersModalOpen(true)}
              className="flex items-center space-x-1.5 space-x-reverse px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
              title="طلباتي — الطلبات الدورية والمسودات"
            >
              <Repeat className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">طلباتي</span>
              {recurringOrders.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                  {recurringOrders.length}
                </span>
              )}
            </button>

            {/* Notifications Bell Button */}
            <button
              id="btn-notifications"
              onClick={() => setIsNotificationsModalOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 relative"
              title="عرض التنبيهات والإشعارات"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* User Profile Avatar Button */}
            <button
              id="btn-user-avatar-profile"
              onClick={() =>
                setActiveTab(activeTab === "profile" ? "categories" : "profile")
              }
              className={`flex items-center space-x-1.5 space-x-reverse p-1 sm:px-2.5 sm:py-1 rounded-xl text-xs font-bold transition-all border ${
                activeTab === "profile"
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-emerald-500/30"
                  : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200"
              }`}
              title="الملف الشخصي وإعدادات الحساب"
            >
              <div className="relative">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white shadow-2xs ${
                    activeRole === "admin"
                      ? "bg-gradient-to-tr from-emerald-600 to-teal-500"
                      : "bg-gradient-to-tr from-blue-600 to-indigo-500"
                  }`}
                >
                  {avatarInitial}
                </div>
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                    supabaseUser ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
              </div>
              <span className="hidden sm:inline font-bold truncate max-w-[80px]">
                {userDisplayName}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* PWA Connection & Service Worker Status Modal */}
      <PwaStatusModal
        isOpen={isPwaStatusModalOpen}
        onClose={() => setIsPwaStatusModalOpen(false)}
      />
    </header>
  );
};

