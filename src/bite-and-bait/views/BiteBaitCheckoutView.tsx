import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { FoodCartItem, FoodCustomerAddress } from '../types';
import { biteAndBaitService } from '../services/biteAndBaitService';
import { GeoHierarchySelector, type GeoSelectionValue } from '../../components/GeoHierarchySelector';
import {
  MapLocationPickerModal,
  type MapLocationConfirmMeta,
} from '../../components/MapLocationPickerModal';
import { validateGpsCoordinates, type DeliveryOwnerType } from '../../lib/geoService';

interface BiteBaitCheckoutViewProps {
  cartItems: FoodCartItem[];
  subtotal: number;
  deliveryFee: number | null;
  totalPrice: number;
  restaurantName: string;
  restaurantId: string;
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
    governorateId: string;
    centerId: string;
    areaId: string;
    latitude: number;
    longitude: number;
    idempotencyKey: string;
    notes?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  onNavigateBackToCart: () => void;
  isSubmitting?: boolean;
  isDeliveryDisabled?: boolean;
  isSectionDisabled?: boolean;
  sectionNotice?: string;
}

const EMPTY_GEO: GeoSelectionValue = {
  governorateId: '',
  governorateName: '',
  centerId: '',
  centerName: '',
  areaId: '',
  areaName: '',
};

export const BiteBaitCheckoutView: React.FC<BiteBaitCheckoutViewProps> = ({
  cartItems,
  subtotal,
  deliveryFee: initialDeliveryFee,
  restaurantName,
  restaurantId,
  householdId,
  userId,
  savedAddresses = [],
  defaultCustomerName = '',
  defaultCustomerPhone = '',
  onSubmitOrder,
  onNavigateBackToCart,
  isSubmitting = false,
  isDeliveryDisabled = false,
  isSectionDisabled = false,
  sectionNotice,
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
      ? [
          defaultSavedAddr.detailedAddress,
          defaultSavedAddr.area,
          defaultSavedAddr.markaz,
          defaultSavedAddr.governorate,
        ]
          .filter(Boolean)
          .join('، ')
      : ''
  );

  // Central geo hierarchy for custom / new address entry
  const [customGeo, setCustomGeo] = useState<GeoSelectionValue>(EMPTY_GEO);

  const [orderNotes, setOrderNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponNotice, setCouponNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Dynamic Central Coverage & Delivery Tariff state
  const [currentDeliveryFee, setCurrentDeliveryFee] = useState<number | null>(initialDeliveryFee);
  const [isFreeDelivery, setIsFreeDelivery] = useState<boolean>(false);
  const [estimatedDeliveryMinutes, setEstimatedDeliveryMinutes] = useState<number | null>(null);
  const [applicableDeliveryOwner, setApplicableDeliveryOwner] =
    useState<DeliveryOwnerType | null>(null);
  const [tariffResolved, setTariffResolved] = useState<boolean>(false);
  const [isAddressCovered, setIsAddressCovered] = useState<boolean>(false);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [isCheckingCoverage, setIsCheckingCoverage] = useState<boolean>(false);

  // GPS Coordinates & Map Picker state
  const [customGpsCoords, setCustomGpsCoords] = useState<{
    lat: number;
    lng: number;
    accuracyM?: number | null;
    source?: 'gps' | 'map_pin';
    capturedAt?: string;
  } | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState<boolean>(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState<boolean>(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<string | null>(null);

  // Idempotency Key: created once on component mount and preserved strictly across retry attempts
  const [idempotencyKey] = useState<string>(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'bnb_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
  });

  // Construct target address snapshot combining selected saved address or custom entry + latest GPS
  const targetAddressSnapshot = useMemo<FoodCustomerAddress | null>(() => {
    if (selectedAddressId) {
      const addr = savedAddresses.find((a) => a.id === selectedAddressId);
      if (!addr) return null;
      const customGpsValid = Boolean(
        customGpsCoords && validateGpsCoordinates(customGpsCoords.lat, customGpsCoords.lng).valid
      );
      const savedGpsValid = validateGpsCoordinates(addr.latitude, addr.longitude).valid;
      const effLat = customGpsValid ? customGpsCoords!.lat : savedGpsValid ? addr.latitude : 0;
      const effLng = customGpsValid ? customGpsCoords!.lng : savedGpsValid ? addr.longitude : 0;
      return {
        ...addr,
        latitude: effLat,
        longitude: effLng,
      };
    }

    if (!customGeo.governorateId || !customGeo.centerId || !customGeo.areaId) {
      return null;
    }

    return {
      id: 'custom-checkout-address',
      label: 'عنوان توصيل مخصص',
      recipientName: customerName,
      phone: customerPhone,
      governorate: customGeo.governorateName,
      governorateId: customGeo.governorateId,
      markaz: customGeo.centerName,
      centerId: customGeo.centerId,
      area: customGeo.areaName,
      areaId: customGeo.areaId,
      detailedAddress: addressText,
      latitude: customGpsCoords?.lat ?? 0,
      longitude: customGpsCoords?.lng ?? 0,
      gpsAccuracyM: customGpsCoords?.accuracyM ?? null,
      gpsSource: customGpsCoords?.source ?? null,
      gpsCapturedAt: customGpsCoords?.capturedAt ?? null,
    };
  }, [
    selectedAddressId,
    savedAddresses,
    customGeo,
    customGpsCoords,
    customerName,
    customerPhone,
    addressText,
  ]);

  // Verify coverage & resolve central delivery tariff dynamically
  const verifyCoverageAndFee = useCallback(
    async (targetAddr: FoodCustomerAddress | null) => {
      if (!targetAddr) {
        setIsAddressCovered(false);
        setTariffResolved(false);
        setCurrentDeliveryFee(null);
        setIsFreeDelivery(false);
        setEstimatedDeliveryMinutes(null);
        setApplicableDeliveryOwner(null);
        setCoverageError(
          'يرجى اختيار عنوان محفوظ مكتمل أو تحديد المحافظة والمركز والمنطقة للتحقق من التغطية والتسعيرة.'
        );
        return;
      }

      if (!targetAddr.governorateId || !targetAddr.centerId || !targetAddr.areaId) {
        setIsAddressCovered(false);
        setTariffResolved(false);
        setCurrentDeliveryFee(null);
        setIsFreeDelivery(false);
        setEstimatedDeliveryMinutes(null);
        setApplicableDeliveryOwner(null);
        setCoverageError(
          'هذا العنوان يفتقد ربط المحافظة والمركز والمنطقة بالنظام الجغرافي المركزي. يرجى اختيار عنوان مكتمل أو إدخال عنوان جديد.'
        );
        return;
      }

      const gpsCheck = validateGpsCoordinates(targetAddr.latitude, targetAddr.longitude);
      if (!gpsCheck.valid) {
        setIsAddressCovered(false);
        setTariffResolved(false);
        setCurrentDeliveryFee(null);
        setIsFreeDelivery(false);
        setEstimatedDeliveryMinutes(null);
        setApplicableDeliveryOwner(null);
        setCoverageError(
          gpsCheck.reason ||
            'إحداثيات الموقع الجغرافي (GPS) مطلوبة لهذا العنوان قبل حساب التسعيرة والتغطية.'
        );
        return;
      }

      setIsCheckingCoverage(true);
      try {
        // Resolve restaurant `ready_food` scope & central tariff (checks geo_* hierarchy, boundary, restaurant -> platform)
        const feeRes = await biteAndBaitService.resolveDeliveryFee(restaurantId, targetAddr);

        if (!feeRes.isCovered || feeRes.fee === null) {
          setIsAddressCovered(false);
          setTariffResolved(true);
          setCurrentDeliveryFee(null);
          setIsFreeDelivery(false);
          setEstimatedDeliveryMinutes(null);
          setApplicableDeliveryOwner(feeRes.applicableDeliveryOwner);
          setCoverageError(feeRes.reason || 'أنت خارج نطاق التوصيل');
        } else {
          setIsAddressCovered(true);
          setTariffResolved(true);
          setCoverageError(null);
          setCurrentDeliveryFee(feeRes.fee);
          setIsFreeDelivery(feeRes.isFreeDelivery);
          setEstimatedDeliveryMinutes(feeRes.estimatedDeliveryMinutes);
          setApplicableDeliveryOwner(feeRes.applicableDeliveryOwner);
        }
      } catch (err: any) {
        setIsAddressCovered(false);
        setTariffResolved(true);
        setCurrentDeliveryFee(null);
        setCoverageError(
          err?.message || 'تعذر التحقق من نطاق التغطية والتسعيرة المركزية حالياً.'
        );
      } finally {
        setIsCheckingCoverage(false);
      }
    },
    [restaurantId, restaurantName, householdId, userId]
  );

  // Re-verify automatically whenever the effective target address snapshot changes
  useEffect(() => {
    verifyCoverageAndFee(targetAddressSnapshot);
  }, [targetAddressSnapshot, verifyCoverageAndFee]);

  // Update GPS status banner on address selection change
  useEffect(() => {
    if (selectedAddressId) {
      const addr = savedAddresses.find((a) => a.id === selectedAddressId);
      if (addr) {
        const savedGps = validateGpsCoordinates(addr.latitude, addr.longitude);
        if (customGpsCoords && validateGpsCoordinates(customGpsCoords.lat, customGpsCoords.lng).valid) {
          setGpsStatusMessage(
            `✓ تم تحديد موقع التوصيل الحالي: (${customGpsCoords.lat.toFixed(5)}, ${customGpsCoords.lng.toFixed(5)})`
          );
        } else if (savedGps.valid && savedGps.latitude !== null && savedGps.longitude !== null) {
          setGpsStatusMessage(
            `✓ إحداثيات GPS المعتمدة للعنوان: (${savedGps.latitude.toFixed(5)}, ${savedGps.longitude.toFixed(5)})`
          );
        } else {
          setGpsStatusMessage(
            '⚠️ هذا العنوان المسجل يفتقد إحداثيات GPS صالحة. يرجى تحديد الموقع عبر الخريطة أو الـ GPS.'
          );
        }
      }
    } else if (customGpsCoords && validateGpsCoordinates(customGpsCoords.lat, customGpsCoords.lng).valid) {
      setGpsStatusMessage(
        `✓ تم تحديد موقع التوصيل: (${customGpsCoords.lat.toFixed(5)}, ${customGpsCoords.lng.toFixed(5)})`
      );
    } else {
      setGpsStatusMessage(
        'يرجى تحديد المحافظة والمركز والمنطقة ثم تحديد الموقع عبر الـ GPS أو الخريطة.'
      );
    }
  }, [selectedAddressId, savedAddresses, customGpsCoords]);

  const handleSelectAddress = (addrId: string | null) => {
    setSelectedAddressId(addrId);
    setValidationError(null);
    setCustomGpsCoords(null);

    if (addrId) {
      const addr = savedAddresses.find((a) => a.id === addrId);
      if (addr) {
        if (addr.recipientName) setCustomerName(addr.recipientName);
        if (addr.phone) setCustomerPhone(addr.phone);
        const formatted = [addr.detailedAddress, addr.area, addr.markaz, addr.governorate]
          .filter(Boolean)
          .join('، ');
        setAddressText(formatted || addr.detailedAddress);
      }
    } else {
      setAddressText('');
      setCustomGeo(EMPTY_GEO);
    }
  };

  // Browser Geolocation Acquisition
  const handleAcquireGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setValidationError('خدمة تحديد الموقع الجغرافي (Geolocation) غير مدعومة في متصفحك.');
      return;
    }

    setIsAcquiringGps(true);
    setValidationError(null);
    setGpsStatusMessage('جاري قراءة إحداثيات GPS بدقة...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsAcquiringGps(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const check = validateGpsCoordinates(lat, lng);
        if (!check.valid) {
          setValidationError(
            check.reason || 'تعذر الحصول على إحداثيات GPS صالحة من جهازك.'
          );
          setGpsStatusMessage(null);
          return;
        }
        setCustomGpsCoords({
          lat,
          lng,
          accuracyM:
            typeof pos.coords.accuracy === 'number' && Number.isFinite(pos.coords.accuracy)
              ? Math.round(pos.coords.accuracy)
              : null,
          source: 'gps',
          capturedAt: new Date().toISOString(),
        });
      },
      (err) => {
        setIsAcquiringGps(false);
        let errorMsg = 'تعذر الحصول على إحداثيات الموقع الجغرافي.';
        if (err.code === 1) {
          errorMsg = 'تم رفض إذن الوصول إلى الموقع الجغرافي. يمكنك استخدام الخريطة لتحديد الدبوس.';
        } else if (err.code === 2) {
          errorMsg = 'خدمة الموقع غير متاحة حالياً. يمكنك استخدام الخريطة لتحديد الموقع.';
        } else if (err.code === 3) {
          errorMsg = 'استغرق تحديد الموقع وقتاً أطول من المتوقع. يرجى المحاولة أو استخدام الخريطة.';
        }
        setValidationError(errorMsg);
        setGpsStatusMessage(null);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleConfirmMapPin = (lat: number, lng: number, meta?: MapLocationConfirmMeta) => {
    const check = validateGpsCoordinates(lat, lng);
    if (!check.valid) {
      setValidationError(check.reason || 'الإحداثيات المحددة على الخريطة غير صالحة.');
      return;
    }
    setValidationError(null);
    setCustomGpsCoords({
      lat,
      lng,
      accuracyM: meta?.accuracyM ?? null,
      source: meta?.source || 'map_pin',
      capturedAt: meta?.capturedAt || new Date().toISOString(),
    });
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
    if (isSubmitting) return;
    setValidationError(null);

    if (isSectionDisabled) {
      setValidationError(
        sectionNotice || 'قسم الأكلات الجاهزة متوقف حالياً ولا يمكن بدء طلبات جديدة منه.'
      );
      return;
    }

    if (isDeliveryDisabled) {
      setValidationError('خدمة التوصيل متوقفة مؤقتًا');
      return;
    }

    if (!customerName.trim()) {
      setValidationError('يرجى إدخال اسم العميل المستلم لتأكيد الطلب.');
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 8) {
      setValidationError('يرجى إدخال رقم هاتف صالح (8 أرقام على الأقل) للتواصل مع المندوب.');
      return;
    }
    if (!addressText.trim() || addressText.trim().length < 5) {
      setValidationError(
        'يرجى إدخال عنوان التوصيل الفعلي بالتفصيل (الشارع، رقم العقار، الدور أو الشقة).'
      );
      return;
    }

    if (
      !targetAddressSnapshot ||
      !targetAddressSnapshot.governorateId ||
      !targetAddressSnapshot.centerId ||
      !targetAddressSnapshot.areaId
    ) {
      setValidationError(
        'يرجى تحديد عنوان يحتوي على المحافظة والمركز والمنطقة من النظام الجغرافي المركزي.'
      );
      return;
    }

    const gpsCheck = validateGpsCoordinates(
      targetAddressSnapshot.latitude,
      targetAddressSnapshot.longitude
    );
    if (!gpsCheck.valid || gpsCheck.latitude === null || gpsCheck.longitude === null) {
      setValidationError(
        gpsCheck.reason ||
          'يلزم توفير إحداثيات موقع جغرافي (GPS) صالحة غير صفرية عبر GPS أو الخريطة.'
      );
      return;
    }

    // Re-run authoritative central `ready_food` scope & boundary check right before calling create_bite_bait_order RPC
    const freshCheck = await biteAndBaitService.resolveDeliveryFee(
      restaurantId,
      targetAddressSnapshot
    );
    if (!freshCheck.isCovered || freshCheck.fee === null) {
      setIsAddressCovered(false);
      setCurrentDeliveryFee(null);
      const msg = freshCheck.reason || 'أنت خارج نطاق التوصيل';
      setCoverageError(msg);
      setValidationError(msg);
      return;
    }

    // Pass only real p_address_id when saved address chosen, else null (never pass fulfillment_route from client)
    const res = await onSubmitOrder({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      address: addressText.trim(),
      addressId: selectedAddressId || null,
      governorateId: targetAddressSnapshot.governorateId!,
      centerId: targetAddressSnapshot.centerId!,
      areaId: targetAddressSnapshot.areaId!,
      latitude: gpsCheck.latitude,
      longitude: gpsCheck.longitude,
      idempotencyKey,
      notes: orderNotes.trim() || undefined,
    });

    if (!res.success && res.message) {
      setValidationError(res.message);
    }
  };

  const canSubmit = Boolean(
    !isSubmitting &&
      !isSectionDisabled &&
      !isDeliveryDisabled &&
      !isCheckingCoverage &&
      isAddressCovered &&
      tariffResolved &&
      currentDeliveryFee !== null
  );

  return (
    <div className="bite-and-bait-scope">
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
        }}
      >
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

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            {/* Address Selector (Saved Addresses vs Custom Address) */}
            {savedAddresses.length > 0 && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  اختر من العناوين المحفوظة في المنزل:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {savedAddresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id;
                    const hasGps = validateGpsCoordinates(addr.latitude, addr.longitude).valid;
                    const hasGeoIds = Boolean(addr.governorateId && addr.centerId && addr.areaId);

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
                            {addr.label || 'عنوان مسجل'}{' '}
                            {addr.isDefault && (
                              <span style={{ color: '#16a34a', fontSize: '11px' }}>
                                (الافتراضي)
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                            {[addr.detailedAddress, addr.area, addr.markaz, addr.governorate]
                              .filter(Boolean)
                              .join('، ')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                          <span
                            style={{
                              fontSize: '10.5px',
                              padding: '2px 8px',
                              borderRadius: '8px',
                              background: hasGps && hasGeoIds ? '#dcfce7' : '#fee2e2',
                              color: hasGps && hasGeoIds ? '#15803d' : '#b91c1c',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {!hasGeoIds
                              ? 'يحتاج استكمال المنطقة'
                              : hasGps
                              ? 'مكتمل + GPS ✓'
                              : 'يحتاج GPS ⚠️'}
                          </span>
                        </div>
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

            {/* Central Geographic Selector for custom/new address */}
            {selectedAddressId === null && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                  النطاق الجغرافي المعتمد للتوصيل *
                </div>
                <GeoHierarchySelector
                  value={customGeo}
                  onChange={setCustomGeo}
                  disabled={isSubmitting}
                />
              </div>
            )}

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
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
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
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
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
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

            {/* GPS Location Status & Acquisition / Map Pin Control */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
                  📍 إحداثيات الموقع الجغرافي (GPS)
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                    }}
                  >
                    {isAcquiringGps ? 'جاري القراءة...' : '📍 تحديد موقعي الآن'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMapPickerOpen(true)}
                    disabled={isSubmitting}
                    style={{
                      background: '#059669',
                      color: '#ffffff',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    🗺️ الخريطة
                  </button>
                </div>
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
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
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
            <div
              style={{
                background: '#f8fafc',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
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
                  التسعيرة ومسار التنفيذ النهائي يتم اعتمادهم وحفظهم رسمياً من خادم النظام عند تسجيل الطلب.
                </div>
              </div>
            </div>

            {/* Centralized Section / Delivery Stopped Banner (Distinct from Geo Coverage) */}
            {(isSectionDisabled || isDeliveryDisabled) && (
              <div
                style={{
                  background: isSectionDisabled ? '#fef2f2' : '#fffbeb',
                  border: isSectionDisabled ? '1.5px solid #fca5a5' : '1.5px solid #f59e0b',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginTop: '4px',
                  color: isSectionDisabled ? '#991b1b' : '#92400e',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '18px' }}>{isSectionDisabled ? '🔒' : '🛵'}</span>
                <span>
                  {isSectionDisabled
                    ? sectionNotice || 'قسم الأكلات الجاهزة متوقف حالياً ولا يمكن إنشاء طلبات جديدة منه.'
                    : 'خدمة التوصيل متوقفة مؤقتًا'}
                </span>
              </div>
            )}

            {/* Coverage Error Banner */}
            {(!isAddressCovered || coverageError) && !isCheckingCoverage && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1.5px solid #f87171',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginTop: '4px',
                  color: '#991b1b',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '18px' }}>🚫</span>
                <span>
                  {coverageError || 'أنت خارج نطاق التوصيل'}
                </span>
              </div>
            )}

            {/* Order Confirmation CTA Button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="bnb-header-cta"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '14px',
                justifyContent: 'center',
                marginTop: '8px',
                boxSizing: 'border-box',
                opacity: !canSubmit ? 0.65 : 1,
                cursor: !canSubmit ? 'not-allowed' : 'pointer',
                pointerEvents: isSubmitting ? 'none' : 'auto',
                background:
                  (!isAddressCovered && !isCheckingCoverage) ||
                  isDeliveryDisabled ||
                  isSectionDisabled
                    ? '#94a3b8'
                    : undefined,
              }}
            >
              {isSubmitting ? (
                <span>جاري تسجيل الطلب لدى المطعم في قاعدة البيانات... ⏳</span>
              ) : isSectionDisabled ? (
                <span>القسم متوقف حالياً 🔒</span>
              ) : isDeliveryDisabled ? (
                <span>خدمة التوصيل متوقفة مؤقتًا</span>
              ) : isCheckingCoverage ? (
                <span>جاري التحقق من نطاق التغطية والتسعيرة المركزية... 🔍</span>
              ) : !canSubmit ? (
                <span>الطلب غير متاح لهذا العنوان أو تنقصه بيانات التغطية 🚫</span>
              ) : (
                <span>
                  تأكيد طلب {restaurantName} الآن 🚀 ({subtotal + (currentDeliveryFee ?? 0)} ج.م)
                </span>
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

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: '#475569',
              marginBottom: '8px',
            }}
          >
            <span>إجمالي قيمة الأصناف:</span>
            <span>{subtotal} ج.م</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: '#475569',
              marginBottom: '8px',
            }}
          >
            <span>رسوم التوصيل المعتمدة:</span>
            <span
              style={{
                fontWeight: 700,
                color: isCheckingCoverage
                  ? '#64748b'
                  : !tariffResolved || !isAddressCovered || currentDeliveryFee === null
                  ? '#dc2626'
                  : isFreeDelivery || currentDeliveryFee === 0
                  ? '#16a34a'
                  : '#0f172a',
              }}
            >
              {isCheckingCoverage
                ? 'جاري الحساب...'
                : !tariffResolved
                ? 'يلزم استكمال العنوان'
                : !isAddressCovered || currentDeliveryFee === null
                ? 'خارج التغطية'
                : isFreeDelivery || currentDeliveryFee === 0
                ? 'توصيل مجاني (0 ج.م)'
                : `${currentDeliveryFee} ج.م`}
            </span>
          </div>

          {isAddressCovered && tariffResolved && estimatedDeliveryMinutes && estimatedDeliveryMinutes > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12.5px',
                color: '#475569',
                marginBottom: '8px',
              }}
            >
              <span>الوقت التقديري للتوصيل:</span>
              <span style={{ fontWeight: 700, color: '#0369a1' }}>
                ⏱️ حوالي {estimatedDeliveryMinutes} دقيقة
              </span>
            </div>
          )}

          {isAddressCovered && tariffResolved && applicableDeliveryOwner && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#475569',
                marginBottom: '8px',
              }}
            >
              <span>نطاق التسعيرة المرجعي:</span>
              <span style={{ fontWeight: 700, color: '#334155' }}>
                {applicableDeliveryOwner === 'restaurant' ? 'نطاق توصيل المطعم' : 'توصيل طلباتي'}
              </span>
            </div>
          )}

          <div style={{ height: '1px', background: '#e2e8f0', margin: '12px 0' }} />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '15px',
              fontWeight: 800,
              color: '#0f172a',
            }}
          >
            <span>الإجمالي المتوقع:</span>
            <span style={{ color: '#ea580c' }}>
              {isAddressCovered && currentDeliveryFee !== null
                ? `${subtotal + currentDeliveryFee} ج.م`
                : 'يُحدد بعد تأكيد التغطية'}
            </span>
          </div>

          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px', lineHeight: 1.4 }}>
            💡 الإجمالي النهائي المعتمد وتوجيه مسار التوصيل يتم تأكيدهما مباشرة من خادم قاعدة البيانات عند إنشاء الطلب.
          </div>
        </div>
      </div>

      {/* Interactive Map Picker Modal (Leaflet OSM preserved) */}
      <MapLocationPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        initialLat={targetAddressSnapshot?.latitude || customGpsCoords?.lat || null}
        initialLng={targetAddressSnapshot?.longitude || customGpsCoords?.lng || null}
        governorateName={
          selectedAddressId
            ? savedAddresses.find((a) => a.id === selectedAddressId)?.governorate
            : customGeo.governorateName
        }
        onConfirm={handleConfirmMapPin}
      />
    </div>
  );
};
