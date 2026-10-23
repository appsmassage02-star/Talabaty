import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import {
  Wifi,
  WifiOff,
  Database,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Smartphone,
  HardDrive,
  Layers,
  Cloud,
  CloudCheck,
  CloudOff,
  RotateCcw,
  ArrowUpDown,
  ShieldCheck,
} from "lucide-react";

interface PwaStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PwaStatusModal: React.FC<PwaStatusModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    isOnline,
    isServiceWorkerActive,
    swCacheVersion,
    toggleSimulatedOffline,
    missingItems,
    invoices,
    categories,
    syncState,
    syncMetrics,
    retryFailedSync,
    forceSyncNow,
    isSupabaseConnected,
    household,
  } = useApp();

  const [isSyncingManually, setIsSyncingManually] = useState(false);

  if (!isOpen) return null;

  const handleManualSync = async () => {
    setIsSyncingManually(true);
    try {
      await forceSyncNow();
    } finally {
      setIsSyncingManually(false);
    }
  };

  const handleForceReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const getSyncStateLabel = () => {
    switch (syncState) {
      case "INITIALIZING":
        return { label: "تهيئة المزامنة", color: "text-slate-600 bg-slate-100" };
      case "ONLINE":
      case "SYNCED":
        return { label: "مزامن بالكامل مع Supabase", color: "text-emerald-700 bg-emerald-100" };
      case "SYNCING":
        return { label: "جارِ المزامنة السحابية...", color: "text-blue-700 bg-blue-100" };
      case "PENDING":
        return { label: "توجد عمليات معلقة", color: "text-amber-800 bg-amber-100" };
      case "OFFLINE":
        return { label: "وضع عدم الاتصال (محفوظ محلياً)", color: "text-amber-900 bg-amber-100" };
      case "SYNC_ERROR":
        return { label: "خطأ أثناء المزامنة", color: "text-rose-800 bg-rose-100" };
      default:
        return { label: "جاهز", color: "text-slate-700 bg-slate-100" };
    }
  };

  const syncStateInfo = getSyncStateLabel();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      dir="rtl"
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5 space-x-reverse">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs ${
                isOnline
                  ? "bg-gradient-to-tr from-emerald-600 to-teal-500"
                  : "bg-gradient-to-tr from-amber-600 to-orange-500"
              }`}
            >
              {isOnline ? (
                <Wifi className="w-5 h-5" />
              ) : (
                <WifiOff className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                حالة المزامنة والعمل دون اتصال (PWA & Sync)
              </h3>
              <p className="text-xs text-slate-500">
                Supabase السحابية • طابور العمليات • التخزين المحلي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current State Hero Card */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isOnline
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
              : "bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2 space-x-reverse">
              <span
                className={`w-3 h-3 rounded-full ${
                  isOnline
                    ? "bg-emerald-500 animate-pulse ring-4 ring-emerald-200"
                    : "bg-amber-500 animate-ping"
                }`}
              />
              <span className="text-sm font-black">
                {isOnline
                  ? "متصل بالإنترنت (Online Mode)"
                  : "يعمل دون إنترنت (Offline Mode)"}
              </span>
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${syncStateInfo.color}`}
            >
              {syncStateInfo.label}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {isOnline
              ? "المصدر الموثوق للبيانات هو Supabase السحابية. جميع التعديلات تُزامن فوراً مع قنوات Realtime الفورية."
              : "يمكنك إضافة وحذف وتعديل النواقص والفواتير بلا قلق؛ حيث تُحفظ العمليات في طابور محلي معزول وتُرسل تلقائياً إلى السحابة فور عودة الاتصال."}
          </p>
        </div>

        {/* Synchronization Queue & Metrics Card */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
              <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
              <span>طابور المزامنة التلقائية (Sync Engine)</span>
            </h4>
            {household && (
              <span className="text-[10px] bg-slate-200/70 text-slate-700 font-mono px-1.5 py-0.5 rounded">
                {household.id.slice(0, 10)}...
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
              <p className="text-[10px] text-slate-500 font-medium">العمليات المعلقة</p>
              <p className="text-sm font-black text-amber-600 font-mono">
                {syncMetrics.totalPending}
              </p>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
              <p className="text-[10px] text-slate-500 font-medium">العمليات المتعثرة</p>
              <p
                className={`text-sm font-black font-mono ${
                  syncMetrics.totalFailed > 0 ? "text-rose-600" : "text-slate-700"
                }`}
              >
                {syncMetrics.totalFailed}
              </p>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
              <p className="text-[10px] text-slate-500 font-medium">آخر مزامنة ناجحة</p>
              <p className="text-[10px] font-bold text-emerald-700 truncate mt-0.5">
                {syncMetrics.lastSyncedAt
                  ? new Date(syncMetrics.lastSyncedAt).toLocaleTimeString("ar-SA", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "مزامنة أولية"}
              </p>
            </div>
          </div>

          {syncMetrics.totalFailed > 0 && (
            <div className="space-y-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-rose-700 font-bold">
                  تعثرت {syncMetrics.totalFailed} عملية مزامنة
                </span>
                <button
                  onClick={retryFailedSync}
                  className="flex items-center space-x-1 space-x-reverse text-xs font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>إعادة المحاولة الآن</span>
                </button>
              </div>

              {syncMetrics.failedItems && syncMetrics.failedItems.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {syncMetrics.failedItems.map((fItem) => (
                    <div
                      key={fItem.id}
                      className="bg-white/90 p-2 rounded-lg border border-rose-200 text-xs space-y-1 text-slate-800"
                    >
                      <div className="flex items-center justify-between font-bold text-[11px]">
                        <span className="text-rose-700 font-mono">
                          [{fItem.type}] {fItem.entity}
                        </span>
                        <span className="text-slate-500 font-normal text-[10px]">
                          محاولات: {fItem.retryCount}/{fItem.maxRetries}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">
                        ID: {fItem.recordId} • منزل: {fItem.householdId.slice(0, 8)}...
                      </div>
                      {fItem.lastError && (
                        <p className="text-[10px] text-rose-600 bg-rose-50 p-1 rounded font-mono break-words text-left" dir="ltr">
                          {fItem.lastError}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : syncMetrics.lastError ? (
                <p className="text-[10px] text-rose-600 bg-white/80 p-1.5 rounded border border-rose-200 font-mono break-words text-left" dir="ltr">
                  {syncMetrics.lastError}
                </p>
              ) : null}
            </div>
          )}

          {isOnline && (
            <button
              onClick={handleManualSync}
              disabled={isSyncingManually || syncState === "SYNCING"}
              className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 space-x-reverse disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isSyncingManually || syncState === "SYNCING" ? "animate-spin text-blue-600" : ""
                }`}
              />
              <span>
                {isSyncingManually || syncState === "SYNCING"
                  ? "جارِ المزامنة مع Supabase..."
                  : "مزامنة فورية الآن مع السحابة"}
              </span>
            </button>
          )}
        </div>

        {/* Diagnostic Items Breakdown */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-slate-700 flex items-center space-x-1.5 space-x-reverse">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>تفاصيل سجل الخدمة والذاكرة المؤقتة:</span>
          </h4>

          {/* Service Worker Status */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  سجل الخدمة (Service Worker)
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {swCacheVersion}
                </p>
              </div>
            </div>
            <span className="flex items-center space-x-1 space-x-reverse text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isServiceWorkerActive ? "نشط وفعّال" : "جاهز للتسجيل"}</span>
            </span>
          </div>

          {/* Local Storage & Cache Status */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  التخزين المحلي الدائم (Local Persistence)
                </p>
                <p className="text-[11px] text-slate-500">
                  {missingItems.length} نواقص • {categories.length} أقسام • {invoices.length} فواتير
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
              محفوظ ومحمي
            </span>
          </div>

          {/* Offline Smart Engine Status */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  المحلل الذكي المحلي (Offline Arabic Parser)
                </p>
                <p className="text-[11px] text-slate-500">
                  تصنيف النواقص آلياً حتى عند غياب الإنترنت
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md">
              متاح
            </span>
          </div>
        </div>

        {/* Actions & Simulation Controls */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          {toggleSimulatedOffline && (
            <button
              onClick={toggleSimulatedOffline}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 space-x-reverse border ${
                isOnline
                  ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300"
              }`}
            >
              {isOnline ? (
                <>
                  <WifiOff className="w-4 h-4 text-amber-700" />
                  <span>محاكاة انقطاع الإنترنت (تجربة وضع Offline)</span>
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4 text-emerald-700" />
                  <span>استعادة وضع الاتصال بالإنترنت (Online)</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              onClick={handleForceReload}
              className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 space-x-reverse border border-slate-200"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>تحديث النسخة المخزنة (Reload)</span>
            </button>
            <button
              onClick={onClose}
              className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
