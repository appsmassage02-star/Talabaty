import React, { useState } from 'react';
import type {
  FoodOrder,
  FoodOrderStatus,
  BiteBaitRatingPayload,
  BiteBaitComplaintTicket,
  BiteBaitMissingItemReport,
  BiteBaitPriceChangeProposal,
} from '../types';
import { biteBaitAssets } from '../assets';
import { BiteBaitEmptyState } from '../components/BiteBaitEmptyState';
import { BiteBaitRatingModal } from '../components/BiteBaitRatingModal';

interface BiteBaitOrdersViewProps {
  orders: FoodOrder[];
  onNavigateToHome: () => void;
  onSubmitRating?: (payload: BiteBaitRatingPayload) => Promise<void>;
  onCancelOrder?: (orderId: string, reason: string) => void;
}

const STATUS_CONFIG: Record<
  FoodOrderStatus,
  { label: string; color: string; bg: string; stepIndex: number }
> = {
  pending_restaurant_confirmation: {
    label: 'بانتظار تأكيد المطعم ⏳',
    color: '#b45309',
    bg: '#fef3c7',
    stepIndex: 1,
  },
  restaurant_accepted: {
    label: 'تم قبول الطلب وجاري التحضير 👨‍🍳',
    color: '#1e40af',
    bg: '#dbeafe',
    stepIndex: 2,
  },
  preparing: {
    label: 'جاري التجهيز في المطبخ 🍳',
    color: '#6b21a8',
    bg: '#f3e8ff',
    stepIndex: 2,
  },
  ready_for_pickup: {
    label: 'الوجبة جاهزة وبانتظار المندوب 📦',
    color: '#0369a1',
    bg: '#e0f2fe',
    stepIndex: 2,
  },
  out_for_delivery: {
    label: 'في الطريق إليك مع المندوب 🛵',
    color: '#c2410c',
    bg: '#ffedd5',
    stepIndex: 3,
  },
  delivered: {
    label: 'تم التسليم بنجاح ✅',
    color: '#15803d',
    bg: '#dcfce7',
    stepIndex: 4,
  },
  cancelled: {
    label: 'تم إلغاء الطلب ❌',
    color: '#b91c1c',
    bg: '#fee2e2',
    stepIndex: 0,
  },
  rejected_by_restaurant: {
    label: 'اعتذر المطعم عن التنفيذ 🛑',
    color: '#991b1b',
    bg: '#fee2e2',
    stepIndex: 0,
  },
};

export const BiteBaitOrdersView: React.FC<BiteBaitOrdersViewProps> = ({
  orders: initialOrders,
  onNavigateToHome,
  onSubmitRating,
  onCancelOrder,
}) => {
  const [orders, setOrders] = useState<FoodOrder[]>(initialOrders);
  const [filterType, setFilterType] = useState<'all' | 'active' | 'completed' | 'complaints'>('all');
  const [ratingOrder, setRatingOrder] = useState<FoodOrder | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<FoodOrder | null>(null);

  // Modals state
  const [cancellingOrder, setCancellingOrder] = useState<FoodOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('تأخر في التوصيل');
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);

  const [missingReportOrder, setMissingReportOrder] = useState<FoodOrder | null>(null);
  const [selectedMissingItems, setSelectedMissingItems] = useState<string[]>([]);
  const [missingNotes, setMissingNotes] = useState('');

  const [complaintOrder, setComplaintOrder] = useState<FoodOrder | null>(null);
  const [complaintCategory, setComplaintCategory] = useState<'delay' | 'food_quality' | 'packaging' | 'driver_attitude' | 'other'>('delay');
  const [complaintDetails, setComplaintDetails] = useState('');

  // Local lists for tickets & proposals
  const [complaintTickets, setComplaintTickets] = useState<BiteBaitComplaintTicket[]>([]);
  const [missingReports, setMissingReports] = useState<BiteBaitMissingItemReport[]>([]);

  // Sample local price change proposals
  const [priceChangeProposals, setPriceChangeProposals] = useState<Record<string, BiteBaitPriceChangeProposal>>({
    demo_ord_1: {
      orderId: 'demo_ord_1',
      restaurantName: 'كبابجي ومطعم الأصيل',
      originalTotal: 355,
      newTotal: 370,
      priceDifference: 15,
      reason: 'زيادة في وزن الكباب المشوي بعد التسوية والتقطيع.',
      status: 'pending',
    },
  });

  // Keep orders synced with prop when prop changes
  React.useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const filteredOrders = orders.filter((o) => {
    const isCompleted =
      o.orderStatus === 'delivered' ||
      o.orderStatus === 'cancelled' ||
      o.orderStatus === 'rejected_by_restaurant';

    if (filterType === 'active') return !isCompleted;
    if (filterType === 'completed') return isCompleted;
    return true;
  });

  // Handle Order Cancellation locally
  const handleConfirmCancel = () => {
    if (!cancellingOrder) return;

    if (
      cancellingOrder.orderStatus === 'out_for_delivery' ||
      cancellingOrder.orderStatus === 'delivered'
    ) {
      setCancelFeedback('لا يمكن إلغاء الطلب في هذه المرحلة لأن المندوب قد استلم الوجبة بالفعل أو تم تسليمها.');
      return;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === cancellingOrder.id
          ? {
              ...o,
              orderStatus: 'cancelled',
              cancelReason: cancelReason,
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );

    if (onCancelOrder) {
      onCancelOrder(cancellingOrder.id, cancelReason);
    }

    setCancellingOrder(null);
    setCancelFeedback(null);
  };

  // Handle Missing Items Report
  const handleSubmitMissingReport = () => {
    if (!missingReportOrder || selectedMissingItems.length === 0) return;

    const newReport: BiteBaitMissingItemReport = {
      id: `rep_${Date.now()}`,
      orderId: missingReportOrder.id,
      restaurantName: missingReportOrder.restaurantName,
      missingItems: selectedMissingItems,
      notes: missingNotes.trim(),
      status: 'under_review',
      createdAt: new Date().toISOString(),
    };

    setMissingReports((prev) => [newReport, ...prev]);
    setMissingReportOrder(null);
    setSelectedMissingItems([]);
    setMissingNotes('');
  };

  // Handle Complaint Submission
  const handleSubmitComplaint = () => {
    if (!complaintOrder || !complaintDetails.trim()) return;

    const newTicket: BiteBaitComplaintTicket = {
      id: `cmp_${Date.now()}`,
      orderId: complaintOrder.id,
      restaurantName: complaintOrder.restaurantName,
      category: complaintCategory,
      details: complaintDetails.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      responseNote: 'تم استلام الشكوى وجاري مراجعة المطبخ والمندوب لمعالجة المشكلة.',
    };

    setComplaintTickets((prev) => [newTicket, ...prev]);
    setComplaintOrder(null);
    setComplaintDetails('');
  };

  // Handle Price Change Response
  const handleRespondPriceChange = (orderId: string, accept: boolean) => {
    setPriceChangeProposals((prev) => {
      const prop = prev[orderId];
      if (!prop) return prev;
      return {
        ...prev,
        [orderId]: {
          ...prop,
          status: accept ? 'accepted' : 'rejected',
        },
      };
    });

    if (accept) {
      const prop = priceChangeProposals[orderId];
      if (prop) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, totalAmount: prop.newTotal } : o))
        );
      }
    }
  };

  return (
    <div className="bite-and-bait-scope">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
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
                      قيد المراجعة مع المطعم 🔍
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#334155', marginBottom: '4px' }}>
                    الأصناف المبلغ عنها: <b>{rep.missingItems.join(', ')}</b>
                  </div>
                  {rep.notes && (
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      ملاحظة العميل: {rep.notes}
                    </div>
                  )}
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
                      {cmp.status === 'pending' ? 'تم الاستلام وبانتظار المشرف ⏳' : 'تم الرد'}
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
                const statusConfig = STATUS_CONFIG[order.orderStatus] || {
                  label: order.orderStatus,
                  color: '#334155',
                  bg: '#f1f5f9',
                  stepIndex: 1,
                };

                const priceProposal = priceChangeProposals[order.id];

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
                    {/* Header Row: Restaurant Name, Date & Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
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

                      {/* Status Badge */}
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

                    {/* Visual 4-Step Order Progress Stepper */}
                    {order.orderStatus !== 'cancelled' && order.orderStatus !== 'rejected_by_restaurant' && (
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

                    {/* Price Change Proposal Dialog (Local Simulation) */}
                    {priceProposal && priceProposal.status === 'pending' && (
                      <div
                        style={{
                          background: '#fffbeb',
                          border: '1.5px solid #fde68a',
                          borderRadius: '14px',
                          padding: '12px 16px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '18px' }}>⚠️</span>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#92400e' }}>
                            طلب موافقة العميل على تعديل السعر من المطعم
                          </span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#78350f', margin: '0 0 10px' }}>
                          أخطر المطعم بتعديل الحساب الإجمالي بمقدار <b>+{priceProposal.priceDifference} ج.م</b> (الإجمالي الجديد: <b>{priceProposal.newTotal} ج.م</b>).
                          السبب: {priceProposal.reason}
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleRespondPriceChange(order.id, true)}
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
                            onClick={() => handleRespondPriceChange(order.id, false)}
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
                      </div>
                    )}

                    {priceProposal && priceProposal.status !== 'pending' && (
                      <div
                        style={{
                          background: priceProposal.status === 'accepted' ? '#f0fdf4' : '#fef2f2',
                          border: `1px solid ${priceProposal.status === 'accepted' ? '#bbf7d0' : '#fecaca'}`,
                          borderRadius: '10px',
                          padding: '8px 12px',
                          fontSize: '11.5px',
                          color: priceProposal.status === 'accepted' ? '#166534' : '#991b1b',
                          fontWeight: 700,
                        }}
                      >
                        {priceProposal.status === 'accepted'
                          ? `✓ تم قبول تعديل السعر الجديد (${priceProposal.newTotal} ج.م)`
                          : '✕ تم رفض تعديل السعر والإبقاء على الحساب الأصلي'}
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

                    {/* Bottom Row: Total & Local Interactive Action Buttons */}
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
                        الإجمالي المطلوب: <b style={{ color: '#ea580c', fontSize: '16px' }}>{order.totalAmount} ج.م</b>
                      </div>

                      {/* Interactive local actions */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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

                        {/* Cancel Order Button */}
                        {order.orderStatus !== 'cancelled' && order.orderStatus !== 'delivered' && order.orderStatus !== 'rejected_by_restaurant' && (
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

      {/* Modal 2: Cancel Order Modal */}
      {cancellingOrder && (
        <div className="bnb-modal-overlay" onClick={() => setCancellingOrder(null)}>
          <div className="bnb-modal-box" onClick={(e) => e.stopPropagation()} style={{ padding: '22px', maxWidth: '440px' }}>
            <h3 style={{ fontSize: '16.5px', fontWeight: 800, color: '#991b1b', margin: '0 0 10px' }}>
              طلب إلغاء طلب: {cancellingOrder.restaurantName}
            </h3>
            <p style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.5, margin: '0 0 14px' }}>
              هل ترغب بالتأكيد في إلغاء هذا الطلب؟ يرجى تحديد سبب الإلغاء لمساعدة المطعم في تحسين الخدمة:
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
              <option value="تأخر في التوصيل">تأخر في التوصيل عن الموعد المقدر</option>
              <option value="خطأ في اختيار الأصناف">خطأ في اختيار الأصناف</option>
              <option value="تغيير خطة الوجبة">تغيير خطة الوجبة أو عدم الحاجة</option>
              <option value="أخرى">سبب آخر</option>
            </select>

            {cancelFeedback && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, marginBottom: '14px' }}>
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
                onClick={handleConfirmCancel}
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
                تأكيد الإلغاء محلياً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Report Missing Items */}
      {missingReportOrder && (
        <div className="bnb-modal-overlay" onClick={() => setMissingReportOrder(null)}>
          <div className="bnb-modal-box" onClick={(e) => e.stopPropagation()} style={{ padding: '22px', maxWidth: '440px' }}>
            <h3 style={{ fontSize: '16.5px', fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>
              📋 الإبلاغ عن أصناف ناقصة أو غير مطابقة
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
              حدد الأصناف التي لم تصلك أو بها تلف من مطعم {missingReportOrder.restaurantName}:
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
                    <span>{it.quantity} × {it.name}</span>
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
          <div className="bnb-modal-box" onClick={(e) => e.stopPropagation()} style={{ padding: '22px', maxWidth: '440px' }}>
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
                placeholder="اشرح المشكلة بالتفصيل لمساعدتنا في حلها..."
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
