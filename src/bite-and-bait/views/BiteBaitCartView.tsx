import React from 'react';
import type { FoodCartItem } from '../types';
import { biteBaitAssets } from '../assets';
import { BiteBaitEmptyState } from '../components/BiteBaitEmptyState';

interface BiteBaitCartViewProps {
  cartItems: FoodCartItem[];
  subtotal: number;
  deliveryFee: number;
  totalPrice: number;
  onUpdateQuantity: (cartItemId: string, newQuantity: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart?: () => void;
  onProceedToCheckout: () => void;
  onContinueShopping: () => void;
}

export const BiteBaitCartView: React.FC<BiteBaitCartViewProps> = ({
  cartItems,
  subtotal,
  deliveryFee,
  totalPrice,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
  onContinueShopping,
}) => {
  if (cartItems.length === 0) {
    return (
      <div className="bite-and-bait-scope">
        <div style={{ marginBottom: '14px' }}>
          <button
            type="button"
            onClick={onContinueShopping}
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
            <span>العودة للتسوق</span>
          </button>
        </div>

        <BiteBaitEmptyState
          icon="🛒"
          title="سلة المشتريات فارغة"
          description="لم تقم بإضافة أي وجبات أو أطباق إلى سلتك بعد. تصفح المطاعم واختر ما تشتهيه الآن!"
          actionLabel="تصفح قائمة الأطعمة 👈"
          onAction={onContinueShopping}
        />
      </div>
    );
  }

  return (
    <div className="bite-and-bait-scope">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={onContinueShopping}
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
          <span>متابعة التسوق</span>
        </button>

        <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          سلة المشتريات ({cartItems.length} أصناف)
        </h1>

        {onClearCart && (
          <button
            type="button"
            onClick={onClearCart}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#dc2626',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            إفراغ السلة 🗑️
          </button>
        )}
      </div>

      {/* Cart Container Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Left: Items List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cartItems.map((item) => (
            <div
              key={item.cartItemId}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}
            >
              <img
                src={item.imageUrl || biteBaitAssets.placeholder}
                alt={item.name}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  objectFit: 'cover',
                  flexShrink: 0,
                  background: '#f8fafc',
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = biteBaitAssets.placeholder;
                }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: '0 0 3px' }}>
                  {item.name}
                </h4>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '4px' }}>
                  🏪 {item.restaurantName}
                </div>
                {item.selectedOptions && item.selectedOptions.length > 0 && (
                  <div style={{ fontSize: '11px', color: '#d97706', marginBottom: '4px' }}>
                    {item.selectedOptions.map((o) => o.optionName).join(' + ')}
                  </div>
                )}
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#ea580c' }}>
                  {item.unitPrice * item.quantity} ج.م
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500, marginRight: '4px' }}>
                    ({item.unitPrice} ج.م للقطعة)
                  </span>
                </div>
              </div>

              {/* Quantity controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button
                  type="button"
                  className="bnb-counter-btn"
                  onClick={() => onUpdateQuantity(item.cartItemId, item.quantity - 1)}
                  style={{ width: '28px', height: '28px', background: '#f1f5f9' }}
                >
                  -
                </button>
                <span style={{ fontSize: '13px', fontWeight: 800, minWidth: '18px', textAlign: 'center' }}>
                  {item.quantity}
                </span>
                <button
                  type="button"
                  className="bnb-counter-btn"
                  onClick={() => onUpdateQuantity(item.cartItemId, item.quantity + 1)}
                  style={{ width: '28px', height: '28px', background: '#fef3c7', color: '#b45309' }}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.cartItemId)}
                  title="حذف الصنف"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '4px',
                    marginRight: '6px',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Order Summary Box */}
        <div>
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              padding: '22px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
              position: 'sticky',
              top: '20px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 16px' }}>
              ملخص الحساب
            </h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
              <span>إجمالي قيمة الأصناف:</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{subtotal} ج.م</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
              <span>رسوم التوصيل المقدرة:</span>
              <span style={{ fontWeight: 700, color: deliveryFee > 0 ? '#0f172a' : '#16a34a' }}>
                {deliveryFee > 0 ? `${deliveryFee} ج.م` : 'مجاني'}
              </span>
            </div>

            <div style={{ height: '1px', background: '#f1f5f9', margin: '14px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '20px' }}>
              <span>المبلغ الإجمالي:</span>
              <span style={{ color: '#ea580c' }}>{totalPrice} ج.م</span>
            </div>

            <button
              type="button"
              onClick={onProceedToCheckout}
              className="bnb-header-cta"
              style={{
                width: '100%',
                padding: '13px',
                fontSize: '14px',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              متابعة تأكيد الطلب والعنوان 👈
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
