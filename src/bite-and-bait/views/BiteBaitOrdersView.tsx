import React, { useState } from 'react';
import type {
  BiteBaitFoodOrder,
  FoodOrderStatus,
  BiteBaitRatingPayload,
  BiteBaitComplaintTicket,
  BiteBaitMissingItemReport,
  BiteBaitPriceChangeProposal,
  OrderCancellationStatus,
} from '../types';
import { biteBaitAssets } from '../assets';
import { BiteBaitEmptyState } from '../components/BiteBaitEmptyState';
import { BiteBaitRatingModal } from '../components/BiteBaitRatingModal';

interface BiteBaitOrdersViewProps {
  orders: BiteBaitFoodOrder[];
  complaintTickets: BiteBaitComplaintTicket[];
  missingReports: BiteBaitMissingItemReport[];
  priceChangeProposals: Record<string, BiteBaitPriceChangeProposal>;
  onNavigateToHome: () => void;
  onSubmitRating?: (payload: BiteBaitRatingPayload) => Promise<void>;
  onRequestCancellation: (orderId: string, reason: string) => void;
  onSimulateCancellationReview?: (
    orderId: string,
    decision: 'approve' | 'reject',
    reviewNote?: string
  ) => void;
  onSubmitComplaint: (ticket: Omit<BiteBaitComplaintTicket, 'id' | 'createdAt'>) => void;
  onSubmitMissingReport: (report: Omit<BiteBaitMissingItemReport, 'id' | 'createdAt'>) => void;
  onRespondPriceChange: (orderId: string, accept: boolean) => void;
  onCreatePriceChangeProposal?: (proposal: BiteBaitPriceChangeProposal) => void;
}

export const DB_ORDER_STATUSES: Record<
  string,
  { label: string; color: string; bg: string; stepIndex: number; isCompleted: boolean }
> = {
  // Pending variations
  pending: {
    label: 'في انتظار المراجعة ⏳',
    color: '#b45309',
    bg: '#fef3c7',
    stepIndex: 1,
    isCompleted: false,
  },
  awaiting_restaurant_confirmation: {
    label: 'بانتظار تأكيد المطعم ⏳',
    color: '#b45309',
    bg: '#fef3c7',
    stepIndex: 1,
    isCompleted: false,
  },
  pending_restaurant_confirmation: {
    label: 'بانتظار تأكيد المطعم ⏳',
    color: '#b45309',
    bg: '#fef3c7',
    stepIndex: 1,
    isCompleted: false,
  },
  // Accepted
  accepted: {
    label: 'تم قبول الطلب 👨‍🍳',
    color: '#1e40af',
    bg: '#dbeafe',
    stepIndex: 2,
    isCompleted: false,
  },
  restaurant_accepted: {
    label: 'تم قبول الطلب وجاري التحضير 👨‍🍳',
    color: '#1e40af',
    bg: '#dbeafe',
    stepIndex: 2,
    isCompleted: false,
  },
  // Preparing
  preparing: {
    label: 'جاري تحضير الوجبة بالمطبخ 🍳',
    color: '#6b21a8',
    bg: '#f3e8ff',
    stepIndex: 2,
    isCompleted: false,
  },
  // Ready
  ready: {
    label: 'الوجبة جاهزة للاستلام 📦',
    color: '#0369a1',
    bg: '#e0f2fe',
    stepIndex: 2,
    isCompleted: false,
  },
  ready_for_pickup: {
    label: 'الوجبة جاهزة وبانتظار المندوب 📦',
    color: '#0369a1',
    bg: '#e0f2fe',
    stepIndex: 2,
    isCompleted: false,
  },
  // Driver assigned
  assigned_to_driver: {
    label: 'تم إسناد الطلب للمندوب 🛵',
    color: '#0284c7',
    bg: '#e0f2fe',
    stepIndex: 3,
    isCompleted: false,
  },
  // Picked up
  picked_up: {
    label: 'استلم المندوب الوجبة 🛵',
    color: '#c2410c',
    bg: '#ffedd5',
    stepIndex: 3,
    isCompleted: false,
  },
  // On the way
  on_the_way: {
    label: 'الطلب في الطريق إليك 🛵',
    color: '#ea580c',
    bg: '#ffedd5',
    stepIndex: 3,
    isCompleted: false,
  },
  out_for_delivery: {
    label: 'في الطريق إليك مع المندوب 🛵',
    color: '#c2410c',
    bg: '#ffedd5',
    stepIndex: 3,
    isCompleted: false,
  },
  // Delivered
  delivered: {
    label: 'تم التسليم بنجاح ✅',
    color: '#15803d',
    bg: '#dcfce7',
    stepIndex: 4,
    isCompleted: true,
  },
  // Rejected
  rejected: {
    label: 'اعتذر المطعم عن التنفيذ 🛑',
    color: '#991b1b',
    bg: '#fee2e2',
    stepIndex: 0,
    isCompleted: true,
  },
  rejected_by_restaurant: {
    label: 'اعتذر المطعم عن التنفيذ 🛑',
    color: '#991b1b',
    bg: '#fee2e2',
    stepIndex: 0,
    isCompleted: true,
  },
  // Cancelled
  cancelled: {
    label: 'تم إلغاء الطلب ❌',
    color: '#b91c1c',
    bg: '#fee2e2',
    stepIndex: 0,
    isCompleted: true,
  },
};

export function getOrderStatusConfig(order: BiteBaitFoodOrder): {
  label: string;
  color: string;
  bg: string;
  stepIndex: number;
  isCompleted: boolean;
} {
  const statusKey = (order.rawStatus || order.orderStatus || '').toLowerCase();
  if (statusKey && DB_ORDER_STATUSES[statusKey]) {
    return DB_ORDER_STATUSES[statusKey];
  }
  // Unknown statuses: NEVER fallback to pending
  return {
    label: `حالة غير محددة: ${order.rawStatus || order.orderStatus || 'غير معروف'}`,
    color: '#475569',
    bg: '#f1f5f9',
    stepIndex: 0,
    isCompleted: false,
  };
}

export const BiteBaitOrdersView: React.FC<BiteBaitOrdersViewProps> = ({
  orders,
  complaintTickets,
  missingReports,
  priceChangeProposals,
  onNavigateToHome,
  onSubmitRating,
  onRequestCancellation,
  onSimulateCancellationReview,
  onSubmitComplaint,
  onSubmitMissingReport,
  onRespondPriceChange,
  onCreatePriceChangeProposal,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'active' | 'completed' | 'complaints'>('all');
  const [ratingOrder, setRatingOrder] = useState<BiteBaitFoodOrder | null>(null);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Record<string, boolean>>({});

  const toggleHistory = (orderId: string) => {
    setExpandedHistoryIds((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Modals state
  const [cancellingOrder, setCancellingOrder] = useState<BiteBaitFoodOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('تأخر في التوصيل عن الموعد');
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);

  const [missingReportOrder, setMissingReportOrder] = useState<BiteBaitFoodOrder | null>(null);
  const [selectedMissingItems, setSelectedMissingItems] = useState<string[]>([]);
  const [missingNotes, setMissingNotes] = useState('');

  const [complaintOrder, setComplaintOrder] = useState<BiteBaitFoodOrder | null>(null);
  const [complaintCategory, setComplaintCategory] = useState<
    'delay' | 'food_quality' | 'packaging' | 'driver_attitude' | 'other'
  >('delay');
  const [complaintDetails, setComplaintDetails] = useState('');

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    const statusCfg = getOrderStatusConfig(o);
    const isCompleted = statusCfg.isCompleted;

    if (filterType === 'active') return !isCompleted;
    if (filterType === 'completed') return isCompleted;
    return true;
  });

  // Handle client requesting cancellation
  const handleClientRequestCancellation = () => {
    if (!cancellingOrder) return;

    if (cancellingOrder.cancellationStatus === 'pending') {
      setCancelFeedback('يوجد طلب إلغاء معلق بالفعل قيد المراجعة لهذا الطلب.');
      return;
    }

    if (
      cancellingOrder.orderStatus === 'delivered' ||
      cancellingOrder.orderStatus === 'cancelled' ||
      cancellingOrder.orderStatus === 'rejected_by_restaurant'
    ) {
      setCancelFeedback('لا يمكن تقديم طلب إلغاء لهذا الطلب نظراً لحالته الحالية.');
      return;
    }

    onRequestCancellation(cancellingOrder.id, cancelReason);
    setCancellingOrder(null);
    setCancelFeedback(null);
  };

  // Handle Missing Items Report
  const handleSubmitMissingReport = () => {
    if (!missingReportOrder || selectedMissingItems.length === 0) return;

    onSubmitMissingReport({
      orderId: missingReportOrder.id,
      restaurantName: missingReportOrder.restaurantName,
      missingItems: selectedMissingItems,
      notes: missingNotes.trim(),
      status: 'under_review',
    });

    setMissingReportOrder(null);
    setSelectedMissingItems([]);
    setMissingNotes('');
  };

  // Handle Complaint Submission
  const handleSubmitComplaint = () => {
    if (!complaintOrder || !complaintDetails.trim()) return;

    onSubmitComplaint({
      orderId: complaintOrder.id,
      restaurantName: complaintOrder.restaurantName,
      category: complaintCategory,
      details: complaintDetails.trim(),
      status: 'pending',
      responseNote: 'تم استلام الشكوى محلياً في وضع المعاينة وجاري مراجعتها مع قسم المطبخ.',
    });

    setComplaintOrder(null);
    setComplaintDetails('');
  };

  return (
    <div className="bite-and-bait-scope">
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <button
          type="button"
          onClick={onNavigateToHome}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            padding: '7px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 700,
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          <span>→</span>
          <span>الرئيسية</span>
        </button>

        <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          سجل طلباتي وتتبع الوجبات ({orders.length})
        </h1>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            style={{
              border: 'none',
              background: filterType === 'all' ? '#f59e0b' : '#f1f5f9',
              color: filterType === 'all' ? '#0f172a' : '#475569',
              padding: '5px 12px',
              borderRadius: '50px',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            الكل ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('active')}
            style={{
              border: 'none',
              background: filterType === 'active' ? '#f59e0b' : '#f1f5f9',
              color: filterType === 'active' ? '#0f172a' : '#475569',
              padding: '5px 12px',
              borderRadius: '50px',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            الطلبات الجارية
          </button>
          <button
            type="button"
            onClick={() => setFilterType('completed')}
            style={{
              border: 'none',
              background: filterType === 'completed' ? '#f59e0b' : '#f1f5f9',
              color: filterType === 'completed' ? '#0f172a' : '#475569',
              padding: '5px 12px',
              borderRadius: '50px',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            المكتملة والملغية
          </button>
          <button
            type="button"
            onClick={() => setFilterType('complaints')}
            style={{
              border: 'none',
              background: filterType === 'complaints' ? '#ef4444' : '#f1f5f9',
              color: filterType === 'complaints' ? '#ffffff' : '#475569',
              padding: '5px 12px',
              borderRadius: '50px',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            الشكاوى والنواقص ({complaintTickets.length + missingReports.length})
          </button>
        </div>
      </div>

      {/* Complaints & Reports Tab View */}
      {filterType === 'complaints' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '12px',
              color: '#64748b',
            }}
          >
            💡 يتم الاحتفاظ بجميع الشكاوى وبلاغات النواقص في الذاكرة المشتركة للمنسق الرئيسي طوال الجلسة المحلية (وضع المعاينة التجريبي).
          </div>

          {complaintTickets.length === 0 && missingReports.length === 0 ? (
            <BiteBaitEmptyState
              icon="🛡️"
              title="لا توجد بلاغات أو شكاوى مسجلة"
              description="إذا واجهت أي تأخير أو نقص في صنف من وجبتك، يمكنك استخدام أزرار 'الإبلاغ عن نقص' أو 'تقديم شكوى' الموجودة على بطاقة كل طلب."
            />
          ) : (
            <>
              {missingReports.map((rep) => (
                <div
                  key={rep.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1.5px solid #fed7aa',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#9a3412' }}>
                      📋 بلاغ أصناف ناقصة: {rep.restaurantName}
                    </span>
                    <span
                      style={{
                        background: '#fef3c7',
                        color: '#b45309',
                        padding: '3px 10px',
                        borderRadius: '50px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {rep.status === 'under_review' ? 'قيد المراجعة مع المطعم 🔍' : rep.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#334155', marginBottom: '4px' }}>
                    الأصناف المبلغ عنها: <b>{rep.missingItems.join(', ')}</b>
                  </div>
                  {rep.notes && (
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      ملاحظة العميل: {rep.notes}
                    </div>
                  )}
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '6px' }}>
                    تاريخ البلاغ: {new Date(rep.createdAt).toLocaleString('ar-EG')}
                  </div>
                </div>
              ))}

              {complaintTickets.map((cmp) => (
                <div
                  key={cmp.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1.5px solid #fecaca',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#991b1b' }}>
                      ⚠️ شكوى خدمة عملاء: {cmp.restaurantName}
                    </span>
                    <span
                      style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        padding: '3px 10px',
                        borderRadius: '50px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {cmp.status === 'pending' ? 'تم الاستلام وبانتظار المشرف ⏳' : 'تمت المعالجة'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#334155', marginBottom: '6px' }}>
                    تفاصيل الشكوى: {cmp.details}
                  </div>
                  {cmp.responseNote && (
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '11.5px',
                        color: '#15803d',
                        fontWeight: 600,
                      }}
                    >
                      رد الدعم الفني: {cmp.responseNote}
                    </div>
                  )}
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '6px' }}>
                    تاريخ التقديم: {new Date(cmp.createdAt).toLocaleString('ar-EG')}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Orders List View */}
      {filterType !== 'complaints' && (
        <>
          {filteredOrders.length === 0 ? (
            <BiteBaitEmptyState
              icon="📦"
              title="لا توجد طلبات في هذا القسم"
              description="لم تقم بطلب أي وجبات تطابق هذا الفلتر. تصفح قوائم مطاعم بايت آند بيت واختر وجبتك المفضلة."
              actionLabel="تصفح قائمة المطاعم 👈"
              onAction={onNavigateToHome}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {filteredOrders.map((order) => {
                const statusConfig = getOrderStatusConfig(order);

                const priceProposal = priceChangeProposals[order.id];
                const cancellationStatus: OrderCancellationStatus = order.cancellationStatus || 'none';

                return (
                  <div
                    key={order.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '20px',
                      border: '1px solid #e2e8f0',
                      padding: '20px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    {/* Header Row: Restaurant Name, Date & Order Status */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={biteBaitAssets.parcel_icon}
                          alt="طرد"
                          style={{ width: '30px', height: '30px' }}
                        />
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                            {order.restaurantName}
                          </h3>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                            رقم الطلب: #{order.invoiceNumber || order.id.slice(0, 8)} •{' '}
                            {new Date(order.createdAt).toLocaleDateString('ar-EG', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Main Order Status Badge */}
                      <span
                        style={{
                          background: statusConfig.bg,
                          color: statusConfig.color,
                          fontSize: '12px',
                          fontWeight: 800,
                          padding: '4px 14px',
                          borderRadius: '50px',
                          border: `1px solid ${statusConfig.color}25`,
                        }}
                      >
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Cancellation Status Banner (Independent Lifecycle State) */}
                    {cancellationStatus === 'pending' && (
                      <div
                        style={{
                          background: '#fffbeb',
                          border: '1.5px solid #fde68a',
                          borderRadius: '12px',
                          padding: '12px 14px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '16px' }}>⏳</span>
                            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#92400e' }}>
                              طلب الإلغاء قيد المراجعة لدى المطعم / الإدارة
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#b45309' }}>
                            سبب الإلغاء: {order.cancellationReason || 'طلب العميل'}
                          </span>
                        </div>
                        <p style={{ fontSize: '11.5px', color: '#78350f', margin: '4px 0 8px' }}>
                          تنويه: يظل الطلب بحالته الأصلية ({statusConfig.label}) ولا يتم اعتماده كملغى إلا بموافقة صريحة من جهة المراجعة.
                        </p>

                        {/* Testing Simulation Control (Clearly Separated for Preview Testing) */}
                        {onSimulateCancellationReview && (
                          <div
                            style={{
                              background: '#ffffff',
                              borderRadius: '8px',
                              padding: '8px 10px',
                              border: '1px dashed #f59e0b',
                              marginTop: '6px',
                            }}
                          >
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', display: 'block', marginBottom: '4px' }}>
                              🧪 محاكاة نتيجة مراجعة المطعم (لأغراض الاختبار والتجربة فقط):
                            </span>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  onSimulateCancellationReview(
                                    order.id,
                                    'approve',
                                    'تم قبول الإلغاء من المطعم لعدم بدء الطهي بعد'
                                  )
                                }
                                style={{
                                  background: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                [محاكاة: موافقة المطعم على الإلغاء]
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onSimulateCancellationReview(
                                    order.id,
                                    'reject',
                                    'تم رفض الإلغاء لأن الوجبة تم طهيها بالفعل'
                                  )
                                }
                                style={{
                                  background: '#dc2626',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                [محاكاة: رفض المطعم للإلغاء]
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {cancellationStatus === 'approved' && (
                      <div
                        style={{
                          background: '#fef2f2',
                          border: '1.5px solid #fecaca',
                          borderRadius: '12px',
                          padding: '10px 14px',
                          fontSize: '12px',
                          color: '#991b1b',
                          fontWeight: 700,
                        }}
                      >
                        ✓ تمت الموافقة على طلب الإلغاء واعتماد إلغاء الطلب رسمياً ({order.cancellationReviewNote || 'بناءً على طلب العميل'})
                      </div>
                    )}

                    {cancellationStatus === 'rejected' && (
                      <div
                        style={{
                          background: '#fff7ed',
                          border: '1.5px solid #fed7aa',
                          borderRadius: '12px',
                          padding: '10px 14px',
                          fontSize: '12px',
                          color: '#9a3412',
                          fontWeight: 700,
                        }}
                      >
                        ✕ تم رفض طلب الإلغاء ({order.cancellationReviewNote || 'تعذر الإلغاء'}) — الطلب مستمر في مساره الفعلي بحالته الأصلية: ({statusConfig.label}).
                      </div>
                    )}

                    {/* Visual 4-Step Stepper - only displayed for active non-completed orders with positive stepIndex */}
                    {!statusConfig.isCompleted && statusConfig.stepIndex > 0 && (
                      <div
                        style={{
                          background: '#fafafa',
                          border: '1px solid #f1f5f9',
                          borderRadius: '14px',
                          padding: '14px 16px',
                        }}
                      >
                        <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569', marginBottom: '10px' }}>
                          ⏱️ مراحل سير وتوصيل الطلب:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
                          {[
                            { step: 1, title: 'استلام الطلب', icon: '📝' },
                            { step: 2, title: 'تحضير بالمطبخ', icon: '🍳' },
                            { step: 3, title: 'مع المندوب', icon: '🛵' },
                            { step: 4, title: 'تم التسليم', icon: '✅' },
                          ].map((s) => {
                            const isPassed = statusConfig.stepIndex >= s.step;
                            const isCurrent = statusConfig.stepIndex === s.step;
                            return (
                              <div
                                key={s.step}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <div
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: isPassed ? '#f59e0b' : '#e2e8f0',
                                    color: isPassed ? '#0f172a' : '#94a3b8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    fontWeight: 800,
                                    border: isCurrent ? '2px solid #ea580c' : 'none',
                                  }}
                                >
                                  {s.icon}
                                </div>
                                <span
                                  style={{
                                    fontSize: '10.5px',
                                    fontWeight: isCurrent ? 800 : 600,
                                    color: isPassed ? '#0f172a' : '#94a3b8',
                                  }}
                                >
                                  {s.title}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Price Change Proposal Dialog (Maintained by Coordinator) */}
                    {priceProposal && (
                      <div
                        style={{
                          background: priceProposal.status === 'pending' ? '#fffbeb' : priceProposal.status === 'accepted' ? '#f0fdf4' : '#fef2f2',
                          border: `1.5px solid ${priceProposal.status === 'pending' ? '#fde68a' : priceProposal.status === 'accepted' ? '#bbf7d0' : '#fecaca'}`,
                          borderRadius: '14px',
                          padding: '12px 16px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                            💰 اقتراح تعديل سعر من مطعم {order.restaurantName}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '50px',
                              background: priceProposal.status === 'pending' ? '#fef3c7' : priceProposal.status === 'accepted' ? '#dcfce7' : '#fee2e2',
                              color: priceProposal.status === 'pending' ? '#92400e' : priceProposal.status === 'accepted' ? '#166534' : '#991b1b',
                            }}
                          >
                            {priceProposal.status === 'pending'
                              ? 'بانتظار قرارك ⏳'
                              : priceProposal.status === 'accepted'
                              ? 'تمت موافقتك ✓'
                              : 'تم رفضك ✕'}
                          </span>
                        </div>

                        <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.5, marginBottom: '8px' }}>
                          <div>• الإجمالي الأصلي للطلب: <b>{priceProposal.originalTotal} ج.م</b></div>
                          <div>• الإجمالي المقترح بعد التعديل: <b>{priceProposal.newTotal} ج.م</b> ({priceProposal.priceDifference > 0 ? `+${priceProposal.priceDifference}` : priceProposal.priceDifference} ج.م)</div>
                          <div>• سبب التعديل من المطعم: <b>{priceProposal.reason}</b></div>
                        </div>

                        {priceProposal.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => onRespondPriceChange(order.id, true)}
                              style={{
                                background: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              موافقة على التعديل ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => onRespondPriceChange(order.id, false)}
                              style={{
                                background: '#dc2626',
                                color: '#ffffff',
                                border: 'none',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              رفض التعديل ✕
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '11.5px', color: priceProposal.status === 'accepted' ? '#166534' : '#991b1b', fontWeight: 700 }}>
                            {priceProposal.status === 'accepted'
                              ? `تم اعتماد الإجمالي الجديد (${order.totalAmount} ج.م).`
                              : `تم رفض الاقتراح وبقي الإجمالي المعتمد (${order.totalAmount} ج.م).`}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Order Items List */}
                    <div
                      style={{
                        background: '#f8fafc',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        fontSize: '12px',
                        color: '#475569',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      {order.items &&
                        order.items.map((it, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span>
                              {it.quantity} × {it.name}
                              {it.selectedOptionsDescription && (
                                <span style={{ fontSize: '11px', color: '#d97706', marginRight: '6px' }}>
                                  ({it.selectedOptionsDescription})
                                </span>
                              )}
                            </span>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>
                              {it.totalPrice} ج.م
                            </span>
                          </div>
                        ))}
                    </div>

                    {/* Delivery Address & Authentic Delivery Details */}
                    {order.address && (
                      <div
                        style={{
                          background: '#f8fafc',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          fontSize: '11.5px',
                          color: '#475569',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          border: '1px solid #f1f5f9',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>📍</span>
                          <span>
                            عنوان التوصيل المسجل:{' '}
                            <b style={{ color: '#0f172a' }}>
                              {[order.address.detailedAddress, order.address.area, order.address.markaz, order.address.governorate]
                                .filter(Boolean)
                                .join('، ') || 'غير محدد بالتفصيل'}
                            </b>
                          </span>
                          {order.address.phone && (
                            <span style={{ color: '#64748b', marginRight: '6px' }}>
                              • هاتف: {order.address.phone}
                            </span>
                          )}
                        </div>
                        {/* Only display GPS coordinates if genuinely present and non-zero */}
                        {Boolean(
                          order.address.latitude &&
                          order.address.longitude &&
                          order.address.latitude !== 0 &&
                          order.address.longitude !== 0
                        ) && (
                          <div style={{ fontSize: '10.5px', color: '#0284c7' }}>
                            إحداثيات الموقع المعتمدة: ({order.address.latitude.toFixed(5)}, {order.address.longitude.toFixed(5)})
                          </div>
                        )}
                        {/* Only display estimated delivery time if non-empty and authentic */}
                        {Boolean(order.estimatedDeliveryTime && order.estimatedDeliveryTime.trim() !== '') && (
                          <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 700 }}>
                            ⏱️ وقت التوصيل المتوقع المسجل: {order.estimatedDeliveryTime}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Status History Timeline from restaurant_order_status_history */}
                    <div
                      style={{
                        borderTop: '1px solid #f1f5f9',
                        paddingTop: '6px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleHistory(order.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#475569',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 0',
                        }}
                      >
                        <span>⏱️ سجل حركات الحالة الفعلي ({order.statusHistory?.length || 0})</span>
                        <span style={{ fontSize: '10px' }}>{expandedHistoryIds[order.id] ? '▲ إخفاء' : '▼ عرض التفاصيل'}</span>
                      </button>

                      {expandedHistoryIds[order.id] && (
                        <div
                          style={{
                            marginTop: '8px',
                            padding: '12px 14px',
                            background: '#f8fafc',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          {order.statusHistory && order.statusHistory.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {order.statusHistory.map((h, hIdx) => {
                                const oldCfg = h.oldStatus ? (DB_ORDER_STATUSES[h.oldStatus.toLowerCase()] || { label: h.oldStatus }) : null;
                                const newCfg = DB_ORDER_STATUSES[h.newStatus.toLowerCase()] || { label: h.newStatus };
                                return (
                                  <div
                                    key={h.id || hIdx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '8px',
                                      fontSize: '11.5px',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: '#f59e0b',
                                        marginTop: '4px',
                                        flexShrink: 0,
                                      }}
                                    />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                        <span style={{ fontWeight: 800, color: '#0f172a' }}>
                                          {oldCfg ? `${oldCfg.label} ← ` : ''}
                                          {newCfg.label}
                                        </span>
                                        <span style={{ color: '#94a3b8', fontSize: '10.5px' }}>
                                          {new Date(h.createdAt).toLocaleString('ar-EG', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </span>
                                      </div>
                                      {h.changedBy && (
                                        <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                                          بواسطة: {h.changedBy}
                                        </div>
                                      )}
                                      {h.note && (
                                        <div style={{ color: '#334155', fontSize: '11px', marginTop: '2px', fontStyle: 'italic' }}>
                                          ملاحظة: {h.note}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ fontSize: '11.5px', color: '#64748b', textAlign: 'center' }}>
                              لا توجد حركات مسجلة في جدول سجل التغييرات لهذا الطلب حتى الآن.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Total & Action Buttons */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '6px',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div style={{ fontSize: '13.5px', color: '#0f172a' }}>
                        الإجمالي المعتمد:{' '}
                        <b style={{ color: '#ea580c', fontSize: '16px' }}>{order.totalAmount} ج.م</b>
                      </div>

                      {/* Interactive local actions */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Rating button */}
                        {order.orderStatus === 'delivered' && (
                          <button
                            type="button"
                            onClick={() => setRatingOrder(order)}
                            style={{
                              background: '#fef3c7',
                              color: '#b45309',
                              border: '1px solid #fde68a',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            ⭐ تقييم بالنجوم
                          </button>
                        )}

                        {/* Report Missing Items Button */}
                        {order.orderStatus === 'delivered' && (
                          <button
                            type="button"
                            onClick={() => {
                              setMissingReportOrder(order);
                              setSelectedMissingItems([]);
                              setMissingNotes('');
                            }}
                            style={{
                              background: '#fff7ed',
                              color: '#c2410c',
                              border: '1px solid #fed7aa',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            📋 إبلاغ عن نقص
                          </button>
                        )}

                        {/* File Complaint Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setComplaintOrder(order);
                            setComplaintDetails('');
                          }}
                          style={{
                            background: '#ffffff',
                            color: '#64748b',
                            border: '1px solid #cbd5e1',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          تقديم شكوى ⚠️
                        </button>

                        {/* Request Cancellation Button */}
                        {order.orderStatus !== 'delivered' &&
                          order.orderStatus !== 'cancelled' &&
                          order.orderStatus !== 'rejected_by_restaurant' &&
                          cancellationStatus !== 'pending' &&
                          cancellationStatus !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancellingOrder(order);
                                setCancelFeedback(null);
                              }}
                              style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              طلب إلغاء الطلب ✕
                            </button>
                          )}

                        {/* Simulation helper: create price proposal for testing if none exists */}
                        {!priceProposal && onCreatePriceChangeProposal && (
                          <button
                            type="button"
                            onClick={() =>
                              onCreatePriceChangeProposal({
                                orderId: order.id,
                                restaurantName: order.restaurantName,
                                originalTotal: order.totalAmount,
                                newTotal: order.totalAmount + 20,
                                priceDifference: 20,
                                reason: 'إضافة صوصات ومقبلات خاصة بالمطعم بناءً على تحضير الشيف.',
                                createdAt: new Date().toISOString(),
                                status: 'pending',
                              })
                            }
                            style={{
                              background: '#f1f5f9',
                              color: '#475569',
                              border: '1px dashed #cbd5e1',
                              padding: '5px 10px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            [تجربة: اقتراح تعديل سعر]
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal 1: Star Rating Modal */}
      {ratingOrder && (
        <BiteBaitRatingModal
          order={ratingOrder}
          isOpen={Boolean(ratingOrder)}
          onClose={() => setRatingOrder(null)}
          onSubmitRating={async (payload) => {
            if (onSubmitRating) await onSubmitRating(payload);
            setRatingOrder(null);
          }}
        />
      )}

      {/* Modal 2: Client Request Cancellation Modal */}
      {cancellingOrder && (
        <div className="bnb-modal-overlay" onClick={() => setCancellingOrder(null)}>
          <div
            className="bnb-modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '22px', maxWidth: '440px' }}
          >
            <h3 style={{ fontSize: '16.5px', fontWeight: 800, color: '#991b1b', margin: '0 0 10px' }}>
              تقديم طلب إلغاء لطلب: {cancellingOrder.restaurantName}
            </h3>
            <p style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.5, margin: '0 0 14px' }}>
              سيتم إرسال طلبك إلى المطعم وقسم المتابعة لمراجعته. يرجى اختيار سبب الإلغاء:
            </p>

            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1.5px solid #e2e8f0',
                fontSize: '12.5px',
                marginBottom: '14px',
                outline: 'none',
              }}
            >
              <option value="تأخر في التوصيل عن الموعد">تأخر في التوصيل عن الموعد المقدر</option>
              <option value="خطأ في اختيار الأصناف">خطأ في اختيار الأصناف</option>
              <option value="تغيير خطة الوجبة">تغيير خطة الوجبة أو عدم الحاجة</option>
              <option value="أخرى">سبب آخر</option>
            </select>

            {cancelFeedback && (
              <div
                style={{
                  background: '#fee2e2',
                  color: '#b91c1c',
                  padding: '10px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  marginBottom: '14px',
                }}
              >
                ⚠️ {cancelFeedback}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleClientRequestCancellation}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                إرسال طلب الإلغاء للمراجعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Report Missing Items */}
      {missingReportOrder && (
        <div className="bnb-modal-overlay" onClick={() => setMissingReportOrder(null)}>
          <div
            className="bnb-modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '22px', maxWidth: '440px' }}
          >
            <h3 style={{ fontSize: '16.5px', fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>
              📋 الإبلاغ عن أصناف ناقصة أو غير مطابقة
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
              حدد الأصناف التي لم تصلك من مطعم {missingReportOrder.restaurantName}:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {missingReportOrder.items.map((it, idx) => {
                const isSelected = selectedMissingItems.includes(it.name);
                return (
                  <label
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: isSelected ? '#fff7ed' : '#f8fafc',
                      border: isSelected ? '1.5px solid #ea580c' : '1px solid #e2e8f0',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      fontWeight: 700,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMissingItems((prev) => [...prev, it.name]);
                        } else {
                          setSelectedMissingItems((prev) => prev.filter((n) => n !== it.name));
                        }
                      }}
                    />
                    <span>
                      {it.quantity} × {it.name}
                    </span>
                  </label>
                );
              })}
            </div>

            <textarea
              rows={2}
              value={missingNotes}
              onChange={(e) => setMissingNotes(e.target.value)}
              placeholder="اكتب ملاحظات إضافية عن الصنف الناقص..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1.5px solid #e2e8f0',
                fontSize: '12px',
                marginBottom: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setMissingReportOrder(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={selectedMissingItems.length === 0}
                onClick={handleSubmitMissingReport}
                style={{
                  flex: 2,
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: selectedMissingItems.length === 0 ? '#cbd5e1' : '#f59e0b',
                  color: '#0f172a',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  cursor: selectedMissingItems.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                تسجيل البلاغ محلياً ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: File Complaint */}
      {complaintOrder && (
        <div className="bnb-modal-overlay" onClick={() => setComplaintOrder(null)}>
          <div
            className="bnb-modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '22px', maxWidth: '440px' }}
          >
            <h3 style={{ fontSize: '16.5px', fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>
              ⚠️ تقديم شكوى على طلب #{complaintOrder.id.slice(0, 8)}
            </h3>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                نوع الشكوى
              </label>
              <select
                value={complaintCategory}
                onChange={(e) => setComplaintCategory(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '12.5px',
                  outline: 'none',
                }}
              >
                <option value="delay">تأخر في وصول الطلب</option>
                <option value="food_quality">جودة الطعام أو درجة الحرارة</option>
                <option value="packaging">تغليف غير مناسب أو انسكاب</option>
                <option value="driver_attitude">سلوك أو تعامل المندوب</option>
                <option value="other">أخرى</option>
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                تفاصيل الشكوى
              </label>
              <textarea
                rows={3}
                value={complaintDetails}
                onChange={(e) => setComplaintDetails(e.target.value)}
                placeholder="اشرح المشكلة بالتفصيل لمساعدتنا في معالجتها..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setComplaintOrder(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={!complaintDetails.trim()}
                onClick={handleSubmitComplaint}
                style={{
                  flex: 2,
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: !complaintDetails.trim() ? '#cbd5e1' : '#dc2626',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  cursor: !complaintDetails.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                إرسال الشكوى محلياً ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
