import React, { useState } from 'react';
import type { FoodCartItem, FoodCustomerAddress } from '../types';

interface BiteBaitCheckoutViewProps {
  cartItems: FoodCartItem[];
  subtotal: number;
  deliveryFee: number;
  totalPrice: number;
  restaurantName: string;
  savedAddresses?: FoodCustomerAddress[];
  defaultCustomerName?: string;
  defaultCustomerPhone?: string;
  onSubmitOrder: (details: {
    customerName: string;
    customerPhone: string;
    address: string;
    notes?: string;
    discount?: number;
  }) => void;
  onNavigateBackToCart: () => void;
  isSubmitting?: boolean;
}

export const BiteBaitCheckoutView: React.FC<BiteBaitCheckoutViewProps> = ({
  cartItems,
  subtotal,
  deliveryFee,
  totalPrice: initialTotalPrice,
  restaurantName,
  savedAddresses = [],
  defaultCustomerName = '',
  defaultCustomerPhone = '',
  onSubmitOrder,
  onNavigateBackToCart,
  isSubmitting = false,
}) => {
  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [customerPhone, setCustomerPhone] = useState(defaultCustomerPhone);
  const [addressText, setAddressText] = useState(
    savedAddresses.length > 0 ? savedAddresses[0].detailedAddress : ''
  );
  const [orderNotes, setOrderNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Recalculate dynamic total with applied local coupon
  const finalTotal = Math.max(0, subtotal - appliedDiscount + deliveryFee);

  const handleApplyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (code === 'BITE20' || code === 'TALABATY' || code === 'OFFER20') {
      const discountVal = 20;
      setAppliedDiscount(discountVal);
      setCouponMessage(`🎉 تم تطبيق كود الخصم التجريبي بنجاح! خصم ${discountVal} ج.م`);
    } else if (code) {
      setCouponMessage('⚠️ كود الخصم التجريبي غير صالح. جرب إدخال "BITE20" للتجربة.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validation requirements
    if (!customerName.trim()) {
      setValidationError('يرجى إدخال اسم المستلم بالكامل لتأكيد الطلب.');
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 8) {
      setValidationError('يرجى إدخال رقم هاتف صالح (8 أرقام على الأقل) للتواصل عند وصول المندوب.');
      return;
    }
    if (!addressText.trim() || addressText.trim().length < 5) {
      setValidationError('يرجى إدخال عنوان التوصيل الفعلي بالتفصيل (الشارع، رقم العمارة، الشقة).');
      return;
    }

    onSubmitOrder({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      address: addressText.trim(),
      notes: orderNotes.trim() || undefined,
      discount: appliedDiscount,
    });
  };

  return (
    <div className="bite-and-bait-scope">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={onNavigateBackToCart}
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
          <span>العودة للسلة</span>
        </button>

        <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          مراجعة وتأكيد طلب: {restaurantName}
        </h1>
      </div>

      {validationError && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 700,
            marginBottom: '16px',
          }}
        >
          ⚠️ {validationError}
        </div>
      )}

      {/* Grid Layout: Left form, Right order summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Left Form: Delivery details */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 16px' }}>
            بيانات العميل وعنوان التوصيل
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                اسم العميل المستلم بالكامل *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="مثال: محمد أحمد"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                رقم الهاتف للتواصل وتنسيق التوصيل *
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="مثال: 01012345678"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                عنوان التوصيل التفصيلي الفعلي *
              </label>
              <textarea
                rows={2}
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder="اكتب الشارع، رقم العقار، الدور، رقم الشقة، وأي علامة مميزة..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                ملاحظات خاصة للطلب (اختياري)
              </label>
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="مثال: رن الجرس، بدون بصل، زيادة سلطة..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            {/* Local Coupon Input */}
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                كوبون خصم تجريبي (جرب: BITE20)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="ادخل كود الخصم..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  style={{
                    padding: '8px 14px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  تطبيق
                </button>
              </div>
              {couponMessage && (
                <div style={{ fontSize: '11.5px', color: appliedDiscount > 0 ? '#16a34a' : '#dc2626', marginTop: '6px', fontWeight: 700 }}>
                  {couponMessage}
                </div>
              )}
            </div>

            {/* Payment Method Notice (Cash on Delivery Only) */}
            <div
              style={{
                marginTop: '4px',
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#f0fdf4',
                border: '1.5px solid #86efac',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '22px' }}>💵</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#166534' }}>
                  طريقة الدفع: الدفع نقداً عند الاستلام فقط (COD)
                </div>
                <div style={{ fontSize: '11px', color: '#15803d' }}>
                  يتم تسليم المبلغ لمندوب التوصيل يداً بيد بعد استلام الوجبة ساخنة وطازجة.
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="bnb-header-cta"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '14px',
                justifyContent: 'center',
                marginTop: '12px',
                boxSizing: 'border-box',
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'جاري تأكيد وتسجيل الطلب...' : `تأكيد طلب ${restaurantName} الآن 🚀 (${finalTotal} ج.م)`}
            </button>
          </form>
        </div>

        {/* Right Box: Order Summary for This Selected Restaurant */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
            height: 'fit-content',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ fontSize: '20px' }}>🏪</span>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              مراجعة منتجات: {restaurantName}
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {cartItems.map((item) => (
              <div
                key={item.cartItemId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12.5px',
                  padding: '8px 0',
                  borderBottom: '1px dashed #f1f5f9',
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    {item.quantity} × {item.name}
                  </span>
                  {item.selectedOptions && item.selectedOptions.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#d97706', marginTop: '2px' }}>
                      ({item.selectedOptions.map((o) => `${o.optionName} +${o.price}ج`).join(', ')})
                    </div>
                  )}
                  {item.notes && (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      ملاحظة: {item.notes}
                    </div>
                  )}
                </div>
                <span style={{ fontWeight: 700, color: '#ea580c' }}>
                  {item.unitPrice * item.quantity} ج.م
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
            <span>إجمالي قيمة الأطعمة:</span>
            <span>{subtotal} ج.م</span>
          </div>

          {appliedDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#16a34a', marginBottom: '8px', fontWeight: 700 }}>
              <span>خصم الكوبون:</span>
              <span>-{appliedDiscount} ج.م</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
            <span>رسوم التوصيل:</span>
            <span>{deliveryFee > 0 ? `${deliveryFee} ج.م` : 'مجاني'}</span>
          </div>

          <div style={{ height: '1px', background: '#e2e8f0', margin: '12px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
            <span>الإجمالي النهائي المطلوب سداده:</span>
            <span style={{ color: '#ea580c' }}>{finalTotal} ج.م</span>
          </div>
        </div>
      </div>
    </div>
  );
};
