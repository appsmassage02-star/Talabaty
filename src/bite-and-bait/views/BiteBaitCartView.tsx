import React from 'react';
import type { FoodCartItem, Restaurant } from '../types';
import { biteBaitAssets } from '../assets';
import { BiteBaitEmptyState } from '../components/BiteBaitEmptyState';

export interface RestaurantCartGroup {
  restaurantId: string;
  restaurantName: string;
  restaurant?: Restaurant;
  items: FoodCartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  isOpen: boolean;
  nextOpeningTime?: string;
}

interface BiteBaitCartViewProps {
  cartItems: FoodCartItem[];
  restaurantGroups: RestaurantCartGroup[];
  overallSubtotal: number;
  overallDelivery: number;
  overallTotal: number;
  totalItemsCount: number;
  onUpdateQuantity: (cartItemId: string, newQuantity: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart?: () => void;
  onProceedToCheckoutRestaurant: (restaurantId: string) => void;
  onContinueShopping: () => void;
}

export const BiteBaitCartView: React.FC<BiteBaitCartViewProps> = ({
  cartItems,
  restaurantGroups,
  overallSubtotal,
  overallDelivery,
  overallTotal,
  totalItemsCount,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onProceedToCheckoutRestaurant,
  onContinueShopping,
}) => {
  if (cartItems.length === 0 || restaurantGroups.length === 0) {
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
          description="لم تقم بإضافة أي وجبات إلى سلتك بعد. تصفح المطاعم واختر أشهى الأطباق الآن!"
          actionLabel="تصفح قائمة الأطعمة 👈"
          onAction={onContinueShopping}
        />
      </div>
    );
  }

  return (
    <div className="bite-and-bait-scope">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
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
          سلة المشتريات متعددة المطاعم ({restaurantGroups.length} {restaurantGroups.length > 1 ? 'مطاعم' : 'مطعم'} • {totalItemsCount} صنف)
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
            إفراغ السلة بالكامل 🗑️
          </button>
        )}
      </div>

      {/* Multi-Restaurant Informational Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          border: '1.5px solid #86efac',
          borderRadius: '16px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span style={{ fontSize: '20px' }}>🏪</span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#166534' }}>
            نظام السلة الذكي متعدد المطاعم (Multi-Restaurant Cart)
          </div>
          <div style={{ fontSize: '11.5px', color: '#15803d' }}>
            يمكنك تجميع أصناف من أكثر من مطعم في سلة واحدة؛ يتم تأكيد طلب كل مطعم بشكل مستقل وتظل منتجات باقي المطاعم محفوظة في سلتك دون حذف.
          </div>
        </div>
      </div>

      {/* Layout Grid: Left = Grouped Restaurant Carts, Right = Aggregate Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* Left: Restaurant Groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {restaurantGroups.map((group) => {
            const isClosed = !group.isOpen;

            return (
              <div
                key={group.restaurantId}
                style={{
                  background: '#ffffff',
                  borderRadius: '20px',
                  border: isClosed ? '2px solid #fecaca' : '1.5px solid #fed7aa',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                  overflow: 'hidden',
                }}
              >
                {/* Restaurant Group Header */}
                <div
                  style={{
                    padding: '14px 18px',
                    background: isClosed ? '#fff1f2' : '#fffbeb',
                    borderBottom: isClosed ? '1px solid #fee2e2' : '1px solid #fef3c7',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>🏪</span>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        {group.restaurantName}
                      </h3>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {group.items.length} أصناف في هذه المجموعة
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isClosed ? (
                      <span
                        style={{
                          background: '#dc2626',
                          color: '#ffffff',
                          padding: '3px 10px',
                          borderRadius: '50px',
                          fontSize: '11px',
                          fontWeight: 800,
                        }}
                      >
                        مغلق حالياً 🔴
                      </span>
                    ) : (
                      <span
                        style={{
                          background: '#16a34a',
                          color: '#ffffff',
                          padding: '3px 10px',
                          borderRadius: '50px',
                          fontSize: '11px',
                          fontWeight: 800,
                        }}
                      >
                        مفتوح ويستقبل الطلبات 🟢
                      </span>
                    )}
                  </div>
                </div>

                {/* Closed Restaurant Warning Notice */}
                {isClosed && (
                  <div
                    style={{
                      background: '#fee2e2',
                      padding: '10px 16px',
                      fontSize: '11.5px',
                      color: '#991b1b',
                      fontWeight: 700,
                      borderBottom: '1px solid #fecaca',
                    }}
                  >
                    ⚠️ هذا المطعم مغلق حالياً{' '}
                    {group.nextOpeningTime ? `(موعد الفتح القادم: ${group.nextOpeningTime})` : ''}،
                    لذلك تم تعطيل تأكيد طلبه لحين فتحه. أصنافك محفوظة في السلة ويمكنك طلب المطاعم الأخرى الآن.
                  </div>
                )}

                {/* Items in this Restaurant */}
                <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {group.items.map((item) => (
                    <div
                      key={item.cartItemId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        paddingBottom: '12px',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      <img
                        src={item.imageUrl || biteBaitAssets.placeholder}
                        alt={item.name}
                        style={{
                          width: '54px',
                          height: '54px',
                          borderRadius: '10px',
                          objectFit: 'cover',
                          flexShrink: 0,
                          background: '#f8fafc',
                        }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = biteBaitAssets.placeholder;
                        }}
                      />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', margin: '0 0 2px' }}>
                          {item.name}
                        </h4>

                        {/* Selected Options List */}
                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                          <div style={{ fontSize: '11px', color: '#d97706', marginBottom: '2px' }}>
                            {item.selectedOptions.map((o) => `${o.optionName} (+${o.price}ج)`).join(' • ')}
                          </div>
                        )}

                        {item.notes && (
                          <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                            ملاحظة: {item.notes}
                          </div>
                        )}

                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#ea580c' }}>
                          {item.unitPrice * item.quantity} ج.م
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500, marginRight: '4px' }}>
                            ({item.unitPrice} ج.م للقطعة)
                          </span>
                        </div>
                      </div>

                      {/* Quantity & Delete Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          className="bnb-counter-btn"
                          onClick={() => onUpdateQuantity(item.cartItemId, item.quantity - 1)}
                          style={{ width: '26px', height: '26px', background: '#f1f5f9' }}
                        >
                          -
                        </button>
                        <span style={{ fontSize: '12.5px', fontWeight: 800, minWidth: '16px', textAlign: 'center' }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="bnb-counter-btn"
                          onClick={() => onUpdateQuantity(item.cartItemId, item.quantity + 1)}
                          style={{ width: '26px', height: '26px', background: '#fef3c7', color: '#b45309' }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.cartItemId)}
                          title="حذف هذا الصنف"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            padding: '4px',
                            marginRight: '4px',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Restaurant Group Totals & Checkout Button */}
                <div
                  style={{
                    padding: '14px 18px',
                    background: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
                    <span>قيمة أطعمة المطعم:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{group.subtotal} ج.م</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
                    <span>رسوم توصيل هذا المطعم:</span>
                    <span style={{ fontWeight: 700, color: group.deliveryFee > 0 ? '#0f172a' : '#16a34a' }}>
                      {group.deliveryFee > 0 ? `${group.deliveryFee} ج.م` : 'مجاني'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800, color: '#0f172a', paddingTop: '4px', borderTop: '1px dashed #cbd5e1' }}>
                    <span>إجمالي طلب هذا المطعم:</span>
                    <span style={{ color: '#ea580c' }}>{group.total} ج.م</span>
                  </div>

                  {/* Independent Checkout Button for This Restaurant */}
                  <button
                    type="button"
                    disabled={isClosed}
                    onClick={() => onProceedToCheckoutRestaurant(group.restaurantId)}
                    style={{
                      marginTop: '6px',
                      padding: '11px',
                      borderRadius: '10px',
                      border: 'none',
                      background: isClosed ? '#cbd5e1' : '#f59e0b',
                      color: isClosed ? '#64748b' : '#0f172a',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: isClosed ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: isClosed ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.35)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isClosed ? (
                      <span>المطعم مغلق حالياً - يفتح {group.nextOpeningTime || 'لاحقاً'} 🔒</span>
                    ) : (
                      <span>إتمام طلب {group.restaurantName} فقط 👈 ({group.total} ج.م)</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Overall Cart Aggregation Box */}
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
              📊 الحساب التراكمي الإجمالي للسلة
            </h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
              <span>عدد المطاعم في السلة:</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{restaurantGroups.length}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
              <span>إجمالي عدد الأصناف:</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{totalItemsCount} صنف</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
              <span>مجموع الأطعمة (لكل المطاعم):</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{overallSubtotal} ج.م</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
              <span>مجموع رسوم التوصيل:</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{overallDelivery} ج.م</span>
            </div>

            <div style={{ height: '1px', background: '#f1f5f9', margin: '14px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '16px' }}>
              <span>الإجمالي الكلي للسلة:</span>
              <span style={{ color: '#ea580c' }}>{overallTotal} ج.م</span>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '11.5px',
                color: '#64748b',
                lineHeight: 1.5,
              }}
            >
              💡 يتم إتمام طلب كل مطعم وتوصيله بشكل مستقل عبر الزر المخصص له في قائمته، مع بقاء أطباق المطاعم الأخرى محفوظة داخل سلتك دون أي حذف أو إلغاء.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
