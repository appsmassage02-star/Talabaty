import { DeliveryOrderStatus } from '../types';

export interface StatusConfig {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  description: string;
}

export const DELIVERY_STATUS_MAP: Record<DeliveryOrderStatus, StatusConfig> = {
  pending_review: {
    label: 'قيد المراجعة',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    dotColor: 'bg-amber-500',
    description: 'تم إرسال الطلب وهو قيد المراجعة وبانتظار الموافقة والتجهيز',
  },
  accepted: {
    label: 'تم القبول وجاري التوصيل',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    dotColor: 'bg-blue-500',
    description: 'تم قبول الطلب وجاري تجهيزه وتوصيله للمنزل',
  },
  shopping: {
    label: 'جاري التسوق وشراء الأصناف',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200',
    dotColor: 'bg-indigo-500',
    description: 'السائق متواجد الآن في المتجر ويقوم بشراء وتسجيل أسعار الأصناف المطلوبة',
  },
  cancellation_pending: {
    label: 'بانتظار موافقة الإدارة على الإلغاء',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
    dotColor: 'bg-purple-500',
    description: 'تم تقديم طلب إلغاء وبانتظار موافقة أو رفض الإدارة',
  },
  cancelled: {
    label: 'مرفوض',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
    dotColor: 'bg-rose-500',
    description: 'تم رفض أو إلغاء هذا الطلب من قبل الإدارة',
  },
  completed: {
    label: 'مكتمل',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
    description: 'تم توصيل الطلب واستلامه بنجاح',
  },
};

export function formatOrderId(id: string): string {
  if (!id) return '#ORD';
  const clean = id.replace(/-/g, '').toUpperCase();
  return `#ORD-${clean.slice(0, 6)}`;
}

export function formatDateTimeAr(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(d);
  } catch {
    return isoString;
  }
}
