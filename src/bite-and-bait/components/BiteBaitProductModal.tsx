import React, { useState, useMemo, useEffect } from 'react';
import type { MenuItem, FoodCartSelectedOption, MenuOptionItem } from '../types';
import { biteBaitAssets } from '../assets';

interface BiteBaitProductModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (
    item: MenuItem,
    selectedOptions: FoodCartSelectedOption[],
    quantity: number,
    notes?: string
  ) => void;
}

export const BiteBaitProductModal: React.FC<BiteBaitProductModalProps> = ({
  item,
  isOpen,
  onClose,
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptionsMap, setSelectedOptionsMap] = useState<Record<string, MenuOptionItem[]>>({});
  const [itemNotes, setItemNotes] = useState('');

  // Reset state when opening modal with a new item
  useEffect(() => {
    if (item) {
      setQuantity(1);
      setItemNotes('');
      const initialMap: Record<string, MenuOptionItem[]> = {};

      // Auto-select the first option for required single-select groups
      (item.optionGroups || []).forEach((grp) => {
        if (grp.isRequired && grp.maxSelection === 1 && grp.options.length > 0) {
          initialMap[grp.id] = [grp.options[0]];
        } else {
          initialMap[grp.id] = [];
        }
      });

      setSelectedOptionsMap(initialMap);
    }
  }, [item]);

  // Calculate dynamic unit price and total price
  const { unitPrice, totalPrice, flatSelectedOptions } = useMemo(() => {
    if (!item) {
      return { unitPrice: 0, totalPrice: 0, flatSelectedOptions: [] };
    }

    let extraPrice = 0;
    const flatList: FoodCartSelectedOption[] = [];

    Object.keys(selectedOptionsMap).forEach((grpId) => {
      const options = selectedOptionsMap[grpId] || [];
      const grp = (item.optionGroups || []).find((g) => g.id === grpId);
      options.forEach((opt: MenuOptionItem) => {
        extraPrice += opt.price || 0;
        flatList.push({
          groupId: grpId,
          groupName: grp?.name || '',
          optionId: opt.id,
          optionName: opt.name,
          price: opt.price || 0,
        });
      });
    });

    const calculatedUnitPrice = item.price + extraPrice;
    const calculatedTotal = calculatedUnitPrice * quantity;

    return {
      unitPrice: calculatedUnitPrice,
      totalPrice: calculatedTotal,
      flatSelectedOptions: flatList,
    };
  }, [item, selectedOptionsMap, quantity]);

  if (!isOpen || !item) return null;

  const handleOptionToggle = (
    grpId: string,
    opt: MenuOptionItem,
    maxSelection: number,
    isRequired: boolean
  ) => {
    setSelectedOptionsMap((prev) => {
      const current = prev[grpId] || [];
      const isSelected = current.some((o) => o.id === opt.id);

      if (maxSelection === 1) {
        // Single select (radio behavior)
        if (isSelected && !isRequired) {
          return { ...prev, [grpId]: [] };
        }
        return { ...prev, [grpId]: [opt] };
      }

      // Multi select (checkbox behavior)
      if (isSelected) {
        return { ...prev, [grpId]: current.filter((o) => o.id !== opt.id) };
      }

      if (current.length < maxSelection) {
        return { ...prev, [grpId]: [...current, opt] };
      }

      return prev;
    });
  };

  const handleConfirmAddToCart = () => {
    if (!item.isAvailable) return;
    onAddToCart(item, flatSelectedOptions, quantity, itemNotes.trim() || undefined);
    onClose();
  };

  return (
    <div className="bnb-modal-overlay" onClick={onClose}>
      <div
        className="bnb-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Modal Header Image */}
        <div style={{ position: 'relative', width: '100%', height: '200px', background: '#0f172a' }}>
          <img
            src={item.imageUrl || biteBaitAssets.placeholder}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = biteBaitAssets.placeholder;
            }}
          />

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.6)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              backdropFilter: 'blur(4px)',
            }}
          >
            ✕
          </button>

          {!item.isAvailable && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  padding: '8px 18px',
                  borderRadius: '50px',
                  fontWeight: 800,
                  fontSize: '14px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                }}
              >
                🚫 غير متوفر حالياً بالمطعم
              </span>
            </div>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {item.name}
            </h2>
            <div style={{ textAlign: 'left', flexShrink: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#ea580c' }}>
                {item.price} ج.م
              </div>
              {item.originalPrice && item.originalPrice > item.price && (
                <div style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'line-through' }}>
                  {item.originalPrice} ج.م
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
            🏪 {item.restaurantName} • {item.category}
          </div>

          {item.description && (
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: '0 0 16px' }}>
              {item.description}
            </p>
          )}

          {/* Unavailability Alert */}
          {!item.isAvailable && (
            <div
              style={{
                background: '#fee2e2',
                border: '1.5px solid #fca5a5',
                borderRadius: '12px',
                padding: '12px 14px',
                color: '#991b1b',
                fontSize: '12.5px',
                fontWeight: 700,
                marginBottom: '16px',
              }}
            >
              ⚠️ هذا الطبق غير متوفر حالياً في قائمة المطعم نظراً لنفاد الكمية. لا يمكن إضافته إلى السلة في الوقت الحالي.
            </div>
          )}

          {/* Option Groups (Sizes / Add-ons) */}
          {item.isAvailable && item.optionGroups && item.optionGroups.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
              {item.optionGroups.map((grp) => {
                const selectedInGrp = selectedOptionsMap[grp.id] || [];
                return (
                  <div
                    key={grp.id}
                    style={{
                      background: '#f8fafc',
                      borderRadius: '14px',
                      padding: '14px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                        {grp.name}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          color: grp.isRequired ? '#b45309' : '#64748b',
                          background: grp.isRequired ? '#fef3c7' : '#e2e8f0',
                          padding: '2px 8px',
                          borderRadius: '50px',
                          fontWeight: 700,
                        }}
                      >
                        {grp.isRequired ? 'إلزامي *' : 'اختياري'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {grp.options.map((opt) => {
                        const isChecked = selectedInGrp.some((o) => o.id === opt.id);
                        return (
                          <label
                            key={opt.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              background: isChecked ? '#fffbeb' : '#ffffff',
                              border: isChecked ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input
                                type={grp.maxSelection === 1 ? 'radio' : 'checkbox'}
                                name={grp.id}
                                checked={isChecked}
                                onChange={() =>
                                  handleOptionToggle(
                                    grp.id,
                                    opt,
                                    grp.maxSelection,
                                    grp.isRequired
                                  )
                                }
                              />
                              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b' }}>
                                {opt.name}
                              </span>
                            </div>

                            <span style={{ fontSize: '12px', fontWeight: 800, color: opt.price > 0 ? '#ea580c' : '#64748b' }}>
                              {opt.price > 0 ? `+${opt.price} ج.م` : 'مجاني'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Special Notes */}
          {item.isAvailable && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                ملاحظات خاصة على هذا الطبق (اختياري)
              </label>
              <input
                type="text"
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                placeholder="مثال: تسوية زيادة، بدون بصل، صوص خارجي..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '12.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>

        {/* Modal Footer (Quantity + Add Button) */}
        <div
          style={{
            padding: '16px 20px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          {/* Quantity Controls */}
          {item.isAvailable && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '4px 8px',
              }}
            >
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#e2e8f0',
                  color: '#0f172a',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                -
              </button>
              <span style={{ fontSize: '14px', fontWeight: 800, minWidth: '20px', textAlign: 'center' }}>
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#fef3c7',
                  color: '#b45309',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                +
              </button>
            </div>
          )}

          {/* Add to Cart CTA */}
          <button
            type="button"
            disabled={!item.isAvailable}
            onClick={handleConfirmAddToCart}
            style={{
              flex: 1,
              padding: '12px 18px',
              borderRadius: '12px',
              border: 'none',
              background: item.isAvailable ? '#f59e0b' : '#cbd5e1',
              color: item.isAvailable ? '#0f172a' : '#64748b',
              fontWeight: 800,
              fontSize: '13.5px',
              cursor: item.isAvailable ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: item.isAvailable ? '0 4px 14px rgba(245, 158, 11, 0.35)' : 'none',
            }}
          >
            {item.isAvailable ? (
              <>
                <span>إضافة إلى السلة</span>
                <span>•</span>
                <span>{totalPrice} ج.م</span>
              </>
            ) : (
              <span>غير متاح للإضافة حالياً 🚫</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
