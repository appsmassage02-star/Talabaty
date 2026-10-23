import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { adminNotificationService } from '../lib/adminNotificationService';
import { AdminNotification } from '../types';
import {
  Bell,
  Plus,
  Trash2,
  X,
  Send,
  Calendar,
  Layers,
  AlertTriangle,
  Info,
  CheckCircle,
} from 'lucide-react';

export const AdminNotificationManagerModal: React.FC = () => {
  const {
    isAdminNotifManagerModalOpen,
    setIsAdminNotifManagerModalOpen,
    refreshAdminNotifications,
    activeRole,
  } = useApp();

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'top_banner' | 'modal' | 'bottom_banner'>('top_banner');
  const [targetScope, setTargetScope] = useState<'all' | 'admin' | 'home' | 'governorate'>('all');
  const [targetValue, setTargetValue] = useState('');
  const [actionRoute, setActionRoute] = useState('');
  const [maxDisplayCount, setMaxDisplayCount] = useState('3');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const loadAll = async () => {
    setIsLoading(true);
    const data = await adminNotificationService.getAllNotifications();
    setNotifications(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAdminNotifManagerModalOpen) {
      loadAll();
    }
  }, [isAdminNotifManagerModalOpen]);

  if (!isAdminNotifManagerModalOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      showToast('يرجى كتابة نص الإشعار');
      return;
    }

    setIsLoading(true);
    const res = await adminNotificationService.saveNotification({
      title: title.trim() || null,
      body: body.trim(),
      type,
      target_scope: targetScope,
      target_value: targetValue.trim() || null,
      action_type: actionRoute ? 'internal_route' : null,
      action_route: actionRoute.trim() || null,
      max_display_count: Number(maxDisplayCount) || 3,
      is_active: true,
      start_at: new Date().toISOString(),
    });
    setIsLoading(false);

    if (res.success) {
      showToast('تم نشر الإشعار بنجاح');
      setIsCreating(false);
      setTitle('');
      setBody('');
      setActionRoute('');
      loadAll();
      refreshAdminNotifications();
    } else {
      showToast(res.message || 'حدث خطأ أثناء النشر');
    }
  };

  const handleDelete = async (id: string) => {
    const res = await adminNotificationService.deleteNotification(id);
    if (res.success) {
      showToast('تم حذف الإشعار');
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      refreshAdminNotifications();
    }
  };

  return (
    <div
      id="admin-notification-manager-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none"
      dir="rtl"
    >
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                إدارة الإعلانات والإشعارات العامة
              </h2>
              <p className="text-xs text-slate-500">
                إرسال إشعارات وشريط تنبيهات موجه لمستخدمي التطبيق والهواتف
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAdminNotifManagerModalOpen(false)}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast */}
        {toastMsg && (
          <div className="mx-4 mt-3 p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold text-center animate-in fade-in">
            {toastMsg}
          </div>
        )}

        {/* Action button */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">
            الإشعارات الحالية ({notifications.length})
          </span>
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center space-x-1.5 space-x-reverse cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إشعار جديد</span>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isCreating ? (
            <form onSubmit={handleSave} className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold text-slate-800">إنشاء إشعار أو بانر جديد</h3>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  إلغاء
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  العنوان (اختياري)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: تنبيه هام، عرض اليوم..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  نص الرسالة / التنبيه
                </label>
                <textarea
                  rows={2}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="اكتب التنبيه أو الرسالة التي ستظهر للمستخدمين..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    طريقة العرض
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="top_banner">شريط علوي (Top Banner)</option>
                    <option value="modal">نافذة منبثقة (Modal)</option>
                    <option value="bottom_banner">شريط سفلي (Bottom Bar)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    الفئة المستهدفة
                  </label>
                  <select
                    value={targetScope}
                    onChange={(e) => setTargetScope(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="all">الجميع</option>
                    <option value="admin">المسؤول فقط</option>
                    <option value="home">هاتف المنزل فقط</option>
                    <option value="governorate">محافظة محددة</option>
                    <option value="household">منزل محدد</option>
                    <option value="user">مستخدم محدد</option>
                  </select>
                </div>
              </div>

              {['governorate', 'household', 'user'].includes(targetScope) && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {targetScope === 'governorate' && 'اسم المحافظة المستهدفة'}
                    {targetScope === 'household' && 'معرف المنزل المستهدف (Household ID)'}
                    {targetScope === 'user' && 'معرف المستخدم المستهدف (User ID)'}
                  </label>
                  <input
                    type="text"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder={
                      targetScope === 'governorate'
                        ? 'مثال: القاهرة'
                        : targetScope === 'household'
                        ? 'مثال: hh-123...'
                        : 'معرف المستخدم UUID'
                    }
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    مسار الزر (اختياري)
                  </label>
                  <input
                    type="text"
                    value={actionRoute}
                    onChange={(e) => setActionRoute(e.target.value)}
                    placeholder="مثال: purchases أو رابط خارجي"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    الحد الأقصى للظهور
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={maxDisplayCount}
                    onChange={(e) => setMaxDisplayCount(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 space-x-reverse pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  نشر الإشعار
                </button>
              </div>
            </form>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                      {notif.type === 'top_banner'
                        ? 'شريط علوي'
                        : notif.type === 'modal'
                        ? 'نافذة منبثقة'
                        : 'شريط سفلي'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      الهدف: {notif.target_scope}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 mt-1">
                    {notif.title || notif.body}
                  </h4>
                  {notif.title && <p className="text-[11px] text-slate-500">{notif.body}</p>}
                </div>

                <button
                  onClick={() => handleDelete(notif.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="حذف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
