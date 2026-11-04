import React, { useState } from 'react';

interface BiteBaitNotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prefs: {
    discounts: boolean;
    lunchOffers: boolean;
    orderTracking: boolean;
  }) => void;
}

export const BiteBaitNotificationPreferencesModal: React.FC<BiteBaitNotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [discounts, setDiscounts] = useState(true);
  const [lunchOffers, setLunchOffers] = useState(true);
  const [orderTracking, setOrderTracking] = useState(true);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ discounts, lunchOffers, orderTracking });
    onClose();
  };

  return (
    <div className="bnb-modal-overlay" onClick={onClose}>
      <div
        className="bnb-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '24px', maxWidth: '440px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              🔔 تفضيلات إشعارات العروض
            </h3>
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
              إعداد تجريبي محلي للتحكم في تنبيهات بايت آند بيت
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {/* Option 1 */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                🏷️ خصومات وعروض المطاعم الحصرية
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                تنبيهات فورية عند إطلاق كوبونات وخصومات من مطاعمك المفضلة.
              </div>
            </div>
            <input
              type="checkbox"
              checked={discounts}
              onChange={(e) => setDiscounts(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#f59e0b', cursor: 'pointer' }}
            />
          </label>

          {/* Option 2 */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                🍔 عروض وجبات الغداء السريعة
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                اقتراحات يومية مخصصة لوجبات الغداء والكومبو العائلي.
              </div>
            </div>
            <input
              type="checkbox"
              checked={lunchOffers}
              onChange={(e) => setLunchOffers(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#f59e0b', cursor: 'pointer' }}
            />
          </label>

          {/* Option 3 */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                🛵 تنبيهات مراحل وتتبع الطلب
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                إشعارك لحظياً عند قبول المطعم للطلب وخروج المندوب للتوصيل.
              </div>
            </div>
            <input
              type="checkbox"
              checked={orderTracking}
              onChange={(e) => setOrderTracking(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#f59e0b', cursor: 'pointer' }}
            />
          </label>
        </div>

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
            onClick={handleSave}
            style={{
              flex: 2,
              padding: '11px',
              borderRadius: '10px',
              border: 'none',
              background: '#f59e0b',
              color: '#0f172a',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
            }}
          >
            حفظ التفضيلات محلياً ✓
          </button>
        </div>
      </div>
    </div>
  );
};
