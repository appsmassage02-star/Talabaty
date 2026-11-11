import React, { useState, useEffect, useCallback } from 'react';
import type { FoodCartItem, FoodCustomerAddress } from '../types';
import { biteAndBaitService } from '../services/biteAndBaitService';

interface BiteBaitCheckoutViewProps {
  cartItems: FoodCartItem[];
  subtotal: number;
  deliveryFee: number;
  totalPrice: number;
  restaurantName: string;
  restaurantId: string;
  baseRestaurantDeliveryFee?: number;
  householdId?: string;
  userId?: string;
  savedAddresses?: FoodCustomerAddress[];
  defaultCustomerName?: string;
  defaultCustomerPhone?: string;
  onSubmitOrder: (details: {
    customerName: string;
    customerPhone: string;
    address: string;
    addressId: string | null;
    latitude: number;
    longitude: number;
    idempotencyKey: string;
    notes?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  onNavigateBackToCart: () => void;
  isSubmitting?: boolean;
}

export const BiteBaitCheckoutView: React.FC<BiteBaitCheckoutViewProps> = ({
  cartItems,
  subtotal,
  deliveryFee: initialDeliveryFee,
  totalPrice: initialTotalPrice,
  restaurantName,
  restaurantId,
  baseRestaurantDeliveryFee,
  householdId,
  userId,
  savedAddresses = [],
  defaultCustomerName = '',
  defaultCustomerPhone = '',
  onSubmitOrder,
  onNavigateBackToCart,
  isSubmitting = false,
}) => {
  // Select initial address (default saved address or first saved address if available)
  const defaultSavedAddr =
    savedAddresses.find((a) => a.isDefault) || (savedAddresses.length > 0 ? savedAddresses[0] : null);

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    defaultSavedAddr ? defaultSavedAddr.id : null
  );

  const [customerName, setCustomerName] = useState(
    defaultSavedAddr?.recipientName || defaultCustomerName
  );
  const [customerPhone, setCustomerPhone] = useState(
    defaultSavedAddr?.phone || defaultCustomerPhone
  );
  const [addressText, setAddressText] = useState(
    defaultSavedAddr
      ? [defaultSavedAddr.detailedAddress, defaultSavedAddr.area, defaultSavedAddr.markaz, defaultSavedAddr.governorate]
          .filter(Boolean)
          .join('، ')
      : ''
  );

  const [orderNotes, setOrderNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponNotice, setCouponNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Dynamic Geographic Coverage & Delivery Fee state
  const [currentDeliveryFee, setCurrentDeliveryFee] = useState<number>(initialDeliveryFee);
  const [isAddressCovered, setIsAddressCovered] = useState<boolean>(true);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [isCheckingCoverage, setIsCheckingCoverage] = useState<boolean>(false);

  // GPS Coordinates and Location Acquisition State
  const [customGpsCoords, setCustomGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState<boolean>(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<string | null>(null);

  // Idempotency Key: created once on component mount and preserved strictly across retry attempts
  const [idempotencyKey] = useState<string>(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'bnb_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
  });

  // Verify coverage & resolve delivery fee dynamically
  const verifyCoverageAndFee = useCallback(
    async (targetAddr: FoodCustomerAddress | null) => {
      if (!targetAddr) {
        setIsAddressCovered(true);
        setCoverageError(null);
        setCurrentDeliveryFee(baseRestaurantDeliveryFee ?? initialDeliveryFee);
        return;
      }

      setIsCheckingCoverage(true);
      try {
        // 1. Verify general geographic serviceability (governorate, center, area)
        const scopeRes = await biteAndBaitService.verifyGeographicScope(targetAddr, householdId, userId);
        if (!scopeRes.isServiceable) {
          setIsAddressCovered(false);
          setCoverageError(scopeRes.reason || 'المنطقة المحددة تقع خارج النطاق الجغرافي المخدوم حالياً لقسم المطاعم.');
          setIsCheckingCoverage(false);
          return;
        }

        // 2. Resolve restaurant-specific area delivery fee & coverage
        const feeRes = await biteAndBaitService.resolveDeliveryFee(
          restaurantId,
          targetAddr,
          baseRestaurantDeliveryFee ?? initialDeliveryFee
        );

        if (!feeRes.isCovered) {
          setIsAddressCovered(false);
          setCoverageError(feeRes.reason || `المطعم (${restaurantName}) لا يغطي هذه المنطقة حالياً.`);
        } else {
          setIsAddressCovered(true);
          setCoverageError(null);
          setCurrentDeliveryFee(feeRes.fee);
        }
      } catch (err: any) {
        console.warn('[BiteBaitCheckoutView] Error checking coverage and fee:', err);
      } finally {
        setIsCheckingCoverage(false);
      }
    },
    [restaurantId, restaurantName, baseRestaurantDeliveryFee, initialDeliveryFee, householdId, userId]
  );

  // When selectedAddressId changes, update fields and re-verify coverage
  const handleSelectAddress = (addrId: string | null) => {
    setSelectedAddressId(addrId);
    setValidationError(null);
    setGpsStatusMessage(null);

    if (addrId) {
      const addr = savedAddresses.find((a) => a.id === addrId);
      if (addr) {
        if (addr.recipientName) setCustomerName(addr.recipientName);
        if (addr.phone) setCustomerPhone(addr.phone);
        const formatted = [addr.detailedAddress, addr.area, addr.markaz, addr.governorate]
          .filter(Boolean)
          .join('، ');
        setAddressText(formatted || addr.detailedAddress);

        // Check if address has valid GPS
        const hasGps = Boolean(
          addr.latitude &&
            addr.longitude &&
            addr.latitude !== 0 &&
            addr.longitude !== 0 &&
            !isNaN(addr.latitude) &&
            !isNaN(addr.longitude)
        );

        if (hasGps) {
          setGpsStatusMessage(`✓ إحداثيات GPS المعتمدة للعنوان: (${addr.latitude.toFixed(5)}, ${addr.longitude.toFixed(5)})`);
        } else {
          setGpsStatusMessage('⚠️ هذا العنوان المسجل لا يحتوي على إحداثيات GPS. يلزم الضغط على "تحديد موقعي الآن" لتأكيد التوصيل.');
        }

        // Run coverage and fee verification
        verifyCoverageAndFee(addr);
      }
    } else {
      // New / custom address chosen
      setAddressText('');
      setCustomGpsCoords(null);
      setGpsStatusMessage('يرجى كتابة العنوان والضغط على "تحديد موقعي الآن" لقراءة إحداثيات الـ GPS بدقة.');
      verifyCoverageAndFee(null);
    }
  };

  // Check initial coverage and GPS status on load
  useEffect(() => {
    if (defaultSavedAddr) {
      verifyCoverageAndFee(defaultSavedAddr);
      const hasGps = Boolean(
        defaultSavedAddr.latitude &&
          defaultSavedAddr.longitude &&
          defaultSavedAddr.latitude !== 0 &&
          defaultSavedAddr.longitude !== 0 &&
          !isNaN(defaultSavedAddr.latitude) &&
          !isNaN(defaultSavedAddr.longitude)
      );
      if (hasGps) {
        setGpsStatusMessage(
          `✓ إحداثيات GPS المعتمدة للعنوان: (${defaultSavedAddr.latitude.toFixed(5)}, ${defaultSavedAddr.longitude.toFixed(5)})`
        );
      } else {
        setGpsStatusMessage('⚠️ هذا العنوان المسجل لا يحتوي على إحداثيات GPS. يرجى قراءة الموقع الحالي.');
      }
    }
  }, [defaultSavedAddr, verifyCoverageAndFee]);

  // Browser Geolocation Acquisition
  const handleAcquireGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setValidationError('خدمة تحديد الموقع الجغرافي (Geolocation) غير مدعومة في متصفحك.');
      return;
    }

    setIsAcquiringGps(true);
    setValidationError(null);
    setGpsStatusMessage('جاري الاتصال بالأقمار الصناعية وقراءة موقعك الجغرافي الحالي...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsAcquiringGps(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!lat || !lng || lat === 0 || lng === 0 || isNaN(lat) || isNaN(lng)) {
          setValidationError('تعذر الحصول على إحداثيات GPS صالحة من جهازك. يرجى التأكد من تشغيل الـ GPS.');
          setGpsStatusMessage(null);
          return;
        }
        setCustomGpsCoords({ lat, lng });
        setGpsStatusMessage(`✓ تم تحديد موقعك الحالي بدقة عبر GPS: (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
      },
      (err) => {
        setIsAcquiringGps(false);
        let errorMsg = 'تعذر الحصول على إحداثيات الموقع الجغرافي.';
        if (err.code === 1) {
          errorMsg = 'تم رفض إذن الوصول إلى الموقع الجغرافي. يشترط السماح بالموقع لتوصيل الطلب بدقة.';
        } else if (err.code === 2) {
          errorMsg = 'خدمة الموقع غير متاحة على جهازك حالياً. يرجى تفعيل الـ GPS وإعادة المحاولة.';
        } else if (err.code === 3) {
          errorMsg = 'استغرق تحديد الموقع وقتاً أطول من المتوقع. يرجى إعادة المحاولة.';
        }
        setValidationError(errorMsg);
        setGpsStatusMessage(null);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleApplyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (code) {
      setCouponNotice(
        'ملاحظة: أكواد الخصم الترويجية للعرض فقط؛ الأسعار المعتمدة ورسوم التوصيل والخصومات الرسمية يتم احتسابها وتوثيقها مباشرة بواسطة خادم قاعدة البيانات عند تسجيل الطلب.'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent multi-click while in transit
    setValidationError(null);

    // Enforcement: Restaurant Coverage & Geographic Scope Verification
    const currentTargetAddr = selectedAddressId
      ? savedAddresses.find((a) => a.id === selectedAddressId) || null
      : null;
    const freshCheck = await biteAndBaitService.resolveDeliveryFee(
      restaurantId,
      currentTargetAddr,
      baseRestaurantDeliveryFee ?? initialDeliveryFee
    );
    if (!freshCheck.isCovered) {
      setIsAddressCovered(false);
      setCoverageError(freshCheck.reason || 'لا يمكن إتمام الطلب لأن المطعم المختار لا يغطي منطقة عنوان التوصيل.');
      setValidationError(
        freshCheck.reason || 'لا يمكن إتمام الطلب لأن المطعم المختار لا يغطي منطقة عنوان التوصيل.'
      );
      return;
    }

    // Basic Input Validations
    if (!customerName.trim()) {
      setValidationError('يرجى إدخال اسم العميل المستلم لتأكيد الطلب.');
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 8) {
      setValidationError('يرجى إدخال رقم هاتف صالح (8 أرقام على الأقل) للتواصل والتنسيق مع المندوب.');
      return;
    }
    if (!addressText.trim() || addressText.trim().length < 5) {
      setValidationError('يرجى إدخال عنوان التوصيل الفعلي بالتفصيل (الشارع، رقم العقار، الدور أو الشقة).');
      return;
    }

    // Determine GPS Coordinates Following Priority Rules:
    // Rule 1: If saved address has valid non-zero GPS coordinates, use them.
    // Rule 2: If it does not have valid coordinates, use current GPS location from user.
    // Rule 3: If user refuses or unavailable, prevent order submission with clear message.
    // Rule 4: Zero fake coordinates or Cairo defaults!
    // Rule 5: Pass p_address_id when saved address chosen, else null.
    let finalLat: number | null = null;
    let finalLng: number | null = null;
    let finalAddressId: string | null = null;

    if (selectedAddressId) {
      const savedAddr = savedAddresses.find((a) => a.id === selectedAddressId);
      if (
        savedAddr &&
        savedAddr.latitude &&
        savedAddr.longitude &&
        savedAddr.latitude !== 0 &&
        savedAddr.longitude !== 0 &&
        !isNaN(savedAddr.latitude) &&
        !isNaN(savedAddr.longitude)
      ) {
        finalLat = savedAddr.latitude;
        finalLng = savedAddr.longitude;
        finalAddressId = savedAddr.id;
      }
    }

    // Fallback to custom/acquired GPS coordinates if saved address had no coordinates or custom address
    if (!finalLat || !finalLng) {
      if (
        customGpsCoords &&
        customGpsCoords.lat !== 0 &&
        customGpsCoords.lng !== 0 &&
        !isNaN(customGpsCoords.lat) &&
        !isNaN(customGpsCoords.lng)
      ) {
        finalLat = customGpsCoords.lat;
        finalLng = customGpsCoords.lng;
        finalAddressId = selectedAddressId || null;
      }
    }

    // If still no valid GPS coordinates, prompt acquisition or block submission
    if (!finalLat || !finalLng) {
      if (typeof navigator !== 'undefined' && navigator.geolocation && !isAcquiringGps) {
        setIsAcquiringGps(true);
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            setIsAcquiringGps(false);
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            if (!lat || !lng || lat === 0 || lng === 0 || isNaN(lat) || isNaN(lng)) {
              setValidationError('تعذر الحصول على إحداثيات GPS صالحة. يلزم توفير إحداثيات حقيقية لإرسال الطلب.');
              return;
            }
            setCustomGpsCoords({ lat, lng });

            // Proceed with acquired coordinates and current idempotencyKey
            const res = await onSubmitOrder({
              customerName: customerName.trim(),
              customerPhone: customerPhone.trim(),
              address: addressText.trim(),
              addressId: selectedAddressId || null,
              latitude: lat,
              longitude: lng,
              idempotencyKey,
              notes: orderNotes.trim() || undefined,
            });

            if (!res.success && res.message) {
              setValidationError(res.message);
            }
          },
          (err) => {
            setIsAcquiringGps(false);
            setValidationError(
              '⚠️ يلزم توفير إحداثيات موقع جغرافي (GPS) صالحة لتوصيل الوجبة بدقة. تم رفض الإذن أو تعذر جلب الموقع. يرجى الضغط على زر "تحديد موقعي الآن عبر الـ GPS" والسماح للمتصفح بالوصول لموقعك.'
            );
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
        return;
      }

      setValidationError(
        '⚠️ يلزم توفير إحداثيات موقع جغرافي (GPS) صالحة لتوصيل الوجبة بدقة. يرجى الضغط على زر "تحديد موقعي الآن عبر الـ GPS" أو اختيار عنوان محفوظ يحتوي على إحداثيات مسجلة.'
      );
      return;
    }

    // Submit with verified coordinates and persistent idempotency key
    const res = await onSubmitOrder({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      address: addressText.trim(),
      addressId: finalAddressId,
      latitude: finalLat,
      longitude: finalLng,
      idempotencyKey,
      notes: orderNotes.trim() || undefined,
    });

    if (!res.success && res.message) {
      setValidationError(res.message);
    }
  };

  return (
    <div className="bite-and-bait-scope">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={onNavigateBackToCart}
          disabled={isSubmitting}
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
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          <span>→</span>
          <span>العودة للسلة</span>
        </button>

        <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          مراجعة وتأكيد طلب: {restaurantName}
        </h1>
      </div>

      {/* Validation or Server Error Message */}
      {validationError && (
        <div
          style={{
            background: '#fee2e2',
            border: '1.5px solid #fca5a5',
            color: '#b91c1c',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 700,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '18px' }}>⚠️</span>
          <div style={{ flex: 1 }}>{validationError}</div>
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
            {/* Address Selector (Saved Addresses vs Custom Address) */}
            {savedAddresses.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  اختر من العناوين المحفوظة في المنزل:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {savedAddresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id;
                    const hasGps = Boolean(
                      addr.latitude &&
                        addr.longitude &&
                        addr.latitude !== 0 &&
                        addr.longitude !== 0 &&
                        !isNaN(addr.latitude) &&
                        !isNaN(addr.longitude)
                    );

                    return (
                      <div
                        key={addr.id}
                        onClick={() => handleSelectAddress(addr.id)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                          background: isSelected ? '#fffbeb' : '#f8fafc',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>
                            {addr.label || 'عنوان مسجل'} {addr.isDefault && <span style={{ color: '#16a34a', fontSize: '11px' }}>(الافتراضي)</span>}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                            {[addr.detailedAddress, addr.area, addr.markaz].filter(Boolean).join('، ')}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '50px',
                            background: hasGps ? '#dcfce7' : '#fee2e2',
                            color: hasGps ? '#15803d' : '#b91c1c',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {hasGps ? 'GPS معتمد ✓' : 'بدون GPS ⚠️'}
                        </span>
                      </div>
                    );
                  })}

                  <div
                    onClick={() => handleSelectAddress(null)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '12px',
                      border: selectedAddressId === null ? '2px solid #f59e0b' : '1px dashed #cbd5e1',
                      background: selectedAddressId === null ? '#fffbeb' : '#ffffff',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: selectedAddressId === null ? '#92400e' : '#475569',
                      textAlign: 'center',
                    }}
                  >
                    + إدخال عنوان توصيل مخصص / جديد
                  </div>
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                اسم العميل المستلم بالكامل *
              </label>
              <input
                type="text"
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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

            {/* GPS Location Status & Acquisition Control */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
                  📍 إحداثيات الموقع الجغرافي (GPS)
                </span>
                <button
                  type="button"
                  onClick={handleAcquireGps}
                  disabled={isAcquiringGps || isSubmitting}
                  style={{
                    background: isAcquiringGps ? '#cbd5e1' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: isAcquiringGps || isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{isAcquiringGps ? 'جاري القراءة...' : '📍 تحديد موقعي الآن'}</span>
                </button>
              </div>
              {gpsStatusMessage && (
                <div
                  style={{
                    fontSize: '11.5px',
                    color: gpsStatusMessage.startsWith('✓') ? '#15803d' : '#b45309',
                    marginTop: '6px',
                    fontWeight: 600,
                  }}
                >
                  {gpsStatusMessage}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                ملاحظات خاصة للطلب (اختياري)
              </label>
              <input
                type="text"
                disabled={isSubmitting}
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

            {/* Promotional coupon input with server-authoritative notice */}
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                كوبون ترويجي
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  disabled={isSubmitting}
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="ادخل كود الخصم إن وجد..."
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
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 14px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  فحص
                </button>
              </div>
              {couponNotice && (
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', lineHeight: 1.4 }}>
                  ℹ️ {couponNotice}
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
                  المبلغ المعتمد للتسديد يتم احتسابه وإصداره رسمياً بالفاتورة من خادم النظام.
                </div>
              </div>
            </div>

            {/* Coverage Error Banner if restaurant does not deliver to this address */}
            {(!isAddressCovered || coverageError) && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1.5px solid #f87171',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginTop: '12px',
                  color: '#991b1b',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '18px' }}>🚫</span>
                <span>{coverageError || 'المطعم المختار لا يغطي منطقة عنوان التوصيل.'}</span>
              </div>
            )}

            {/* Order Confirmation CTA Button with Multi-click Prevention & Coverage Enforcement */}
            <button
              type="submit"
              disabled={isSubmitting || !isAddressCovered || isCheckingCoverage}
              className="bnb-header-cta"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '14px',
                justifyContent: 'center',
                marginTop: '12px',
                boxSizing: 'border-box',
                opacity: isSubmitting || !isAddressCovered || isCheckingCoverage ? 0.65 : 1,
                cursor: isSubmitting || !isAddressCovered || isCheckingCoverage ? 'not-allowed' : 'pointer',
                pointerEvents: isSubmitting ? 'none' : 'auto',
                background: !isAddressCovered ? '#94a3b8' : undefined,
              }}
            >
              {isSubmitting ? (
                <span>جاري تسجيل الطلب لدى المطعم في قاعدة البيانات... ⏳</span>
              ) : isCheckingCoverage ? (
                <span>جاري التحقق من نطاق التغطية والرسوم... 🔍</span>
              ) : !isAddressCovered ? (
                <span>المطعم لا يغطي هذا العنوان (يرجى اختيار عنوان آخر) 🚫</span>
              ) : (
                <span>تأكيد طلب {restaurantName} الآن 🚀 ({subtotal + (isAddressCovered ? currentDeliveryFee : 0)} ج.م)</span>
              )}
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
              مراجعة أصناف: {restaurantName}
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
            <span>إجمالي قيمة الأصناف:</span>
            <span>{subtotal} ج.م</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
            <span>رسوم التوصيل:</span>
            <span style={{ fontWeight: 700, color: currentDeliveryFee === 0 ? '#16a34a' : '#0f172a' }}>
              {!isAddressCovered
                ? 'خارج التغطية'
                : isCheckingCoverage
                ? 'جاري الحساب...'
                : currentDeliveryFee > 0
                ? `${currentDeliveryFee} ج.م`
                : 'مجاني 0 ج.م'}
            </span>
          </div>

          <div style={{ height: '1px', background: '#e2e8f0', margin: '12px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
            <span>الإجمالي:</span>
            <span style={{ color: '#ea580c' }}>
              {subtotal + (isAddressCovered ? currentDeliveryFee : 0)} ج.م
            </span>
          </div>

          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px', lineHeight: 1.4 }}>
            💡 الإجمالي النهائي المعتمد يتم استخراجه وتأكيده مباشرة من خادم قاعدة البيانات عند إنشاء الفاتورة الرسمية للطلب.
          </div>
        </div>
      </div>
    </div>
  );
};
