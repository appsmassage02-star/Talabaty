import React, { useState } from 'react';
import type { FoodOrder, FoodOrderStatus, BiteBaitRatingPayload } from '../types';
import { biteBaitAssets } from '../assets';
import { BiteBaitEmptyState } from '../components/BiteBaitEmptyState';
import { BiteBaitRatingModal } from '../components/BiteBaitRatingModal';

interface BiteBaitOrdersViewProps {
  orders: FoodOrder[];
  onNavigateToHome: () => void;
  onSubmitRating?: (payload: BiteBaitRatingPayload) => Promise<void>;
  onTrackOrder?: (order: FoodOrder) => void;
}

const STATUS_LABELS: Record<FoodOrderStatus, { label: string; color: string; bg: string }> = {
  pending_restaurant_confirmation: { label: 'بانتظار تأكيد المطعم ⏳', color: '#b45309', bg: '#fef3c7' },
  restaurant_accepted: { label: 'تم قبول الطلب وجاري التحضير 👨‍🍳', color: '#1e40af', bg: '#dbeafe' },
  preparing: { label: 'جاري التجهيز في المطبخ 🍳', color: '#6b21a8', bg: '#f3e8ff' },
  ready_for_pickup: { label: 'الوجبة جاهزة وبانتظار المندوب 📦', color: '#0369a1', bg: '#e0f2fe' },
  out_for_delivery: { label: 'في الطريق إليك مع المندوب 🛵', color: '#c2410c', bg: '#ffedd5' },
  delivered: { label: 'تم التسليم بنجاح ✅', color: '#15803d', bg: '#dcfce7' },
  cancelled: { label: 'ملغي ❌', color: '#b91c1c', bg: '#fee2e2' },
  rejected_by_restaurant: { label: 'اعتذر المطعم عن التنفيذ 🛑', color: '#991b1b', bg: '#fee2e2' },
};

export const BiteBaitOrdersView: React.FC<BiteBaitOrdersViewProps> = ({
  orders,
  onNavigateToHome,
  onSubmitRating,
  onTrackOrder,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'active' | 'completed'>('all');
  const [ratingOrder, setRatingOrder] = useState<FoodOrder | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const filteredOrders = orders.filter((o) => {
    const isCompleted = o.orderStatus === 'delivered' || o.orderStatus === 'cancelled' || o.orderStatus === 'rejected_by_restaurant';
    if (filterType === 'active') return !isCompleted;
    if (filterType === 'completed') return isCompleted;
    return true;
  });

  const handleRatingSubmit = async (payload: BiteBaitRatingPayload) => {
    if (!onSubmitRating) {
      setRatingOrder(null);
      return;
    }
    try {
      setIsSubmittingRating(true);
      await onSubmitRating(payload);
      setRatingOrder(null);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  return (
    <div className="bite-and-bait-scope">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
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
          سجل طلباتي من المطاعم ({orders.length})
        </h1>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            style={{
              border: 'none',
              background: filterType === 'all' ? '#f59e0b' : '#f1f5f9',
              color: filterType === 'all' ? '#0f172a' : '#475569',
              padding: '4px 10px',
              borderRadius: '50px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            الكل
          </button>
          <button
            type="button"
            onClick={() => setFilterType('active')}
            style={{
              border: 'none',
              background: filterType === 'active' ? '#f59e0b' : '#f1f5f9',
              color: filterType === 'active' ? '#0f172a' : '#475569',
              padding: '4px 10px',
              borderRadius: '50px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            النشطة
          </button>
          <button
            type="button"
            onClick={() => setFilterType('completed')}
            style={{
              border: 'none',
              background: filterType === 'completed' ? '#f59e0b' : '#f1f5f9',
              color: filterType === 'completed' ? '#0f172a' : '#475569',
              padding: '4px 10px',
              borderRadius: '50px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            المكتملة
          </button>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <BiteBaitEmptyState
          icon="📦"
          title="لا توجد طلبات مطاعم سابقة"
          description="لم تقم بطلب أي وجبات حتى الآن. تصفح قوائم مطاعم بايت آند بيت واختر وجبتك المفضلة."
          actionLabel="تصفح قائمة المطاعم 👈"
          onAction={onNavigateToHome}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredOrders.map((order) => {
            const statusConfig = STATUS_LABELS[order.orderStatus] || {
              label: order.orderStatus,
              color: '#334155',
              bg: '#f1f5f9',
            };

            return (
              <div
                key={order.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '18px',
                  border: '1px solid #e2e8f0',
                  padding: '18px 20px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={biteBaitAssets.parcel_icon}
                      alt="طرد"
                      style={{ width: '28px', height: '28px' }}
                    />
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
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

                  {/* Status badge */}
                  <span
                    style={{
                      background: statusConfig.bg,
                      color: statusConfig.color,
                      fontSize: '11.5px',
                      fontWeight: 800,
                      padding: '4px 12px',
                      borderRadius: '50px',
                      border: `1px solid ${statusConfig.color}25`,
                    }}
                  >
                    {statusConfig.label}
                  </span>
                </div>

                {/* Items summary */}
                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontSize: '12px',
                    color: '#475569',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {order.items && order.items.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        {it.quantity} × {it.name}
                        {it.selectedOptionsDescription && (
                          <span style={{ fontSize: '11px', color: '#d97706', marginRight: '4px' }}>
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

                {/* Bottom Row: Total & Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ fontSize: '14px', color: '#0f172a' }}>
                    الإجمالي: <b style={{ color: '#ea580c', fontSize: '16px' }}>{order.totalAmount} ج.م</b>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {order.orderStatus === 'delivered' && (
                      <button
                        type="button"
                        onClick={() => setRatingOrder(order)}
                        style={{
                          background: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          padding: '6px 14px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ⭐ تقييم الطلب
                      </button>
                    )}

                    {onTrackOrder && (
                      <button
                        type="button"
                        onClick={() => onTrackOrder(order)}
                        style={{
                          background: '#ffffff',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          padding: '6px 14px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        تتبع الطلب 🔍
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rating Modal */}
      {ratingOrder && (
        <BiteBaitRatingModal
          order={ratingOrder}
          isOpen={Boolean(ratingOrder)}
          onClose={() => setRatingOrder(null)}
          onSubmitRating={handleRatingSubmit}
          isSubmitting={isSubmittingRating}
        />
      )}
    </div>
  );
};
