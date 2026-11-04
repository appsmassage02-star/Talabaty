import React, { useState } from 'react';
import type { FoodOrder, BiteBaitRatingPayload } from '../types';
import { BiteBaitStarRating } from './BiteBaitStarRating';

interface BiteBaitRatingModalProps {
  order: FoodOrder;
  isOpen: boolean;
  onClose: () => void;
  onSubmitRating: (payload: BiteBaitRatingPayload) => void;
  isSubmitting?: boolean;
}

export const BiteBaitRatingModal: React.FC<BiteBaitRatingModalProps> = ({
  order,
  isOpen,
  onClose,
  onSubmitRating,
  isSubmitting = false,
}) => {
  const [restaurantRating, setRestaurantRating] = useState<number>(5);
  const [driverRating, setDriverRating] = useState<number>(5);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitRating({
      orderId: order.id,
      restaurantId: order.restaurantId,
      restaurantRating,
      driverRating,
    });
  };

  return (
    <div className="bnb-modal-overlay" onClick={onClose}>
      <div
        className="bnb-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '24px', maxWidth: '440px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              تقييم الطلب بالنجوم ⭐
            </h3>
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
              طلب رقم #{order.invoiceNumber || order.id.slice(0, 8)} • {order.restaurantName}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            style={{
              border: 'none',
              background: '#f1f5f9',
              borderRadius: '8px',
              width: '30px',
              height: '30px',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: '14px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Section 1: Restaurant Rating (Strictly stars only, no text reviews) */}
        <div
          style={{
            background: '#f8fafc',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid #e2e8f0',
            marginBottom: '14px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
            🏪 تقييم المطعم وجودة الطعام
          </div>
          <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 10px' }}>
            حدد تقييمك لمطعم {order.restaurantName}
          </p>

          <BiteBaitStarRating
            rating={restaurantRating}
            size="lg"
            interactive
            onRatingChange={(r) => setRestaurantRating(r)}
          />

          <div style={{ fontSize: '12px', fontWeight: 800, color: '#d97706', marginTop: '6px' }}>
            {restaurantRating === 5
              ? 'ممتاز جداً 🌟'
              : restaurantRating === 4
              ? 'جيد جداً 👍'
              : restaurantRating === 3
              ? 'متوسط 😐'
              : restaurantRating === 2
              ? 'دون المستوى 👎'
              : 'تجربة سيئة 😞'}
          </div>
        </div>

        {/* Section 2: Delivery Driver Rating (Strictly stars only) */}
        <div
          style={{
            background: '#f8fafc',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid #e2e8f0',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
            🛵 تقييم مندوب التوصيل
          </div>
          <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 10px' }}>
            حدد تقييمك لسرعة وتعامل كابتن التوصيل
          </p>

          <BiteBaitStarRating
            rating={driverRating}
            size="lg"
            interactive
            onRatingChange={(r) => setDriverRating(r)}
          />

          <div style={{ fontSize: '12px', fontWeight: 800, color: '#16a34a', marginTop: '6px' }}>
            {driverRating === 5
              ? 'توصيل سريع وممتاز 🚀'
              : driverRating === 4
              ? 'كابتن محترم وسريع 👍'
              : driverRating === 3
              ? 'توصيل عادي 😐'
              : driverRating === 2
              ? 'تأخر التوصيل 👎'
              : 'تجربة توصيل سيئة 😞'}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: '10px',
              border: '1.5px solid #e2e8f0',
              background: '#ffffff',
              color: '#64748b',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            style={{
              flex: 2,
              padding: '11px',
              borderRadius: '10px',
              border: 'none',
              background: '#f59e0b',
              color: '#0f172a',
              fontWeight: 800,
              fontSize: '13px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
            }}
          >
            {isSubmitting ? 'جاري التأكيد...' : 'تأكيد التقييم بالنجوم ⭐'}
          </button>
        </div>
      </div>
    </div>
  );
};
