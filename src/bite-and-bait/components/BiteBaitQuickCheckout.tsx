import React from 'react';
import { biteBaitAssets } from '../assets';

interface BiteBaitQuickCheckoutProps {
  totalItems: number;
  totalPrice: number;
  onOpenCart: () => void;
  onDismiss?: () => void;
}

export const BiteBaitQuickCheckout: React.FC<BiteBaitQuickCheckoutProps> = ({
  totalItems,
  totalPrice,
  onOpenCart,
  onDismiss,
}) => {
  if (totalItems <= 0) return null;

  return (
    <div className="bnb-quick-toast">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img
          src={biteBaitAssets.basket_icon}
          alt="سلة"
          style={{ width: '22px', height: '22px' }}
        />
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
            {totalItems} {totalItems === 1 ? 'صنف في السلة' : 'أصناف في السلة'}
          </div>
          <div style={{ fontSize: '11.5px', color: '#ea580c', fontWeight: 700 }}>
            الإجمالي: {totalPrice} ج.م
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          className="bnb-quick-btn"
          onClick={onOpenCart}
        >
          مراجعة السلة والطلب
        </button>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '4px',
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};
