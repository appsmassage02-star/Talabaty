import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { adminNotificationService } from '../lib/adminNotificationService';
import {
  Bell,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';

export const AdminNotificationBanner: React.FC = () => {
  const { adminNotifications, dismissAdminNotification, setActiveTab, household, activeRole } = useApp();
  const recordedViewsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!adminNotifications || adminNotifications.length === 0 || !household?.id) return;
    adminNotifications.forEach((notif) => {
      if (!recordedViewsRef.current.has(notif.id)) {
        recordedViewsRef.current.add(notif.id);
        adminNotificationService.recordViewOrDismiss(
          notif.id,
          household.id,
          activeRole === 'admin' ? 'admin' : 'home',
          false
        );
      }
    });
  }, [adminNotifications, household?.id, activeRole]);

  if (!adminNotifications || adminNotifications.length === 0) {
    return null;
  }

  // Filter top banners vs modals vs bottom alerts
  const topBanners = adminNotifications.filter((n) => n.type === 'top_banner');
  const modals = adminNotifications.filter((n) => n.type === 'modal');
  const bottomBanners = adminNotifications.filter((n) => n.type === 'bottom_banner');

  const handleActionClick = (route?: string | null) => {
    if (!route) return;
    if (route.startsWith('http://') || route.startsWith('https://')) {
      window.open(route, '_blank');
    } else {
      // Internal navigation
      const cleanRoute = route.replace('/', '') as any;
      if (['categories', 'missing', 'purchases', 'budget', 'settings', 'profile'].includes(cleanRoute)) {
        setActiveTab(cleanRoute);
      }
    }
  };

  return (
    <>
      {/* 1. TOP BANNERS */}
      {topBanners.map((notif) => (
        <div
          id={`admin-top-banner-${notif.id}`}
          key={notif.id}
          className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs transition-all animate-in slide-in-from-top duration-300 select-none z-40"
          dir="rtl"
        >
          <div className="flex items-center space-x-2.5 space-x-reverse flex-1 pr-1">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Bell className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1">
              {notif.title && <span className="font-extrabold ml-1.5">{notif.title}:</span>}
              <span className="font-medium text-emerald-50">{notif.body}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse shrink-0">
            {notif.action_route && (
              <button
                onClick={() => handleActionClick(notif.action_route)}
                className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[11px] font-bold transition-colors inline-flex items-center space-x-1 space-x-reverse cursor-pointer"
              >
                <span>عرض التفاصيل</span>
                <ChevronLeft className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => dismissAdminNotification(notif.id)}
              className="p-1 hover:bg-white/20 rounded-md text-emerald-100 hover:text-white transition-colors cursor-pointer"
              title="إغلاق الإشعار"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {/* 2. MODAL POPUPS */}
      {modals.map((notif) => (
        <div
          id={`admin-modal-notif-${notif.id}`}
          key={notif.id}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none"
          dir="rtl"
        >
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Info className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-800">
                  {notif.title || 'إشعار هام من الإدارة'}
                </h3>
                <span className="text-[11px] text-slate-400 font-semibold">إشعار رسمي</span>
              </div>
              <button
                onClick={() => dismissAdminNotification(notif.id)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {notif.image_url && (
              <img
                src={notif.image_url}
                alt="إشعار"
                className="w-full h-36 object-cover rounded-2xl"
                referrerPolicy="no-referrer"
              />
            )}

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
              {notif.body}
            </p>

            <div className="flex justify-end space-x-2 space-x-reverse pt-2">
              {notif.action_route && (
                <button
                  onClick={() => {
                    handleActionClick(notif.action_route);
                    dismissAdminNotification(notif.id);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center space-x-1.5 space-x-reverse"
                >
                  <span>متابعة</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => dismissAdminNotification(notif.id)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                فهمت ذلك
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* 3. BOTTOM BANNERS */}
      {bottomBanners.map((notif) => (
        <div
          id={`admin-bottom-banner-${notif.id}`}
          key={notif.id}
          className="fixed bottom-18 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-40 bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700/50 backdrop-blur-md flex items-center justify-between text-xs select-none"
          dir="rtl"
        >
          <div className="flex items-center space-x-2.5 space-x-reverse flex-1">
            <Info className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex-1 text-[11px] leading-snug">
              {notif.title && <span className="font-bold ml-1">{notif.title}:</span>}
              <span>{notif.body}</span>
            </div>
          </div>
          <button
            onClick={() => dismissAdminNotification(notif.id)}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer mr-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </>
  );
};
