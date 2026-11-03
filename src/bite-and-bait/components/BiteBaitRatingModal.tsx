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
  const [rating, setRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitRating({
      orderId: order.id,
      restaurantId: order.restaurantId,
      rating,
      reviewText: reviewText.trim() || undefined,
    });
  };

  return (
    <div className="bnb-modal-overlay" onClick={onClose}>
      <div
        className="bnb-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '24px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              تقييم الطلب من {order.restaurantName}
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              طلب رقم #{order.orderNumber || order.id.slice(0, 8)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        {/* Rating Stars */}
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <p style={{ fontSize: '13px', color: '#475569', marginBottom: '10px', fontWeight: 600 }}>
            كيف كانت تجربتك مع هذا المطعم؟
          </p>
          <BiteBaitStarRating
            rating={rating}
            size="lg"
            interactive
            onRatingChange={(r) => setRating(r)}
          />
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#d97706', marginTop: '6px' }}>
            {rating === 5
              ? 'ممتاز جداً 🌟'
              : rating === 4
              ? 'جيد جداً 👍'
              : rating === 3
              ? 'متوسط 😐'
              : rating === 2
              ? 'غير راضٍ 👎'
              : 'سيء 😞'}
          </div>
        </div>

        {/* Review Notes */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
            ملاحظاتك الإضافية (اختياري)
          </label>
          <textarea
            rows={3}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="اكتب رأيك في جودة الوجبة، سرعة التوصيل، أو التغليف..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1.5px solid #e2e8f0',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'none',
              fontFamily: 'inherit',
            }}
          />
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
            {isSubmitting ? 'جاري الإرسال...' : 'إرسال التقييم'}
          </button>
        </div>
      </div>
    </div>
  );
};
