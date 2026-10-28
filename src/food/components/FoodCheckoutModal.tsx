import React, { useState, useEffect } from 'react';
import { useFood } from '../context/FoodContext';
import { useApp } from '../../context/AppContext';
import { FoodCustomerAddress, FoodCenter, FoodArea } from '../types/foodTypes';
import { foodService } from '../services/foodService';
import {
  X,
  MapPin,
  Check,
  AlertCircle,
  Truck,
  Banknote,
  Receipt,
  Phone,
  User,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Navigation,
} from 'lucide-react';

export const FoodCheckoutModal: React.FC = () => {
  const {
    checkoutRestaurantGroup,
    closeCheckoutModal,
    addresses,
    submitRestaurantOrder,
    addNewAddress,
    sectionSettings,
    isSectionDisabled,
    verifyGeographicScope,
    activeGovernorates,
    loadCentersForGov,
    loadAreasForCenter,
    detectGpsConflict,
  } = useFood();

  const { household, supabaseProfile, supabaseUser } = useApp();

  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    addresses[0]?.id || ''
  );

  const [customerName, setCustomerName] = useState<string>(
    supabaseProfile?.fullName || ''
  );
  const [customerPhone, setCustomerPhone] = useState<string>(
    supabaseProfile?.phone || ''
  );
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Geographic scope verification for selected address
  const [addressGeoScope, setAddressGeoScope] = useState<{ isServiceable: boolean; reason?: string } | null>(null);

  // Quick Inline Address form state if adding a new address (No static Cairo or fixed coordinates!)
  const [isAddingNewAddress, setIsAddingNewAddress] = useState<boolean>(
    addresses.length === 0
  );
  const [newLabel, setNewLabel] = useState<string>('عنوان المنزل');
  const [newDetailedAddress, setNewDetailedAddress] = useState<string>('');
  const [newGovernorate, setNewGovernorate] = useState<string>('');
  const [newGovId, setNewGovId] = useState<string>('');
  const [newMarkaz, setNewMarkaz] = useState<string>('');
  const [newCenterId, setNewCenterId] = useState<string>('');
  const [newArea, setNewArea] = useState<string>('');
  const [newAreaId, setNewAreaId] = useState<string>('');

  const [availableCenters, setAvailableCenters] = useState<FoodCenter[]>([]);
  const [availableAreas, setAvailableAreas] = useState<FoodArea[]>([]);
  const [isLoadingCenters, setIsLoadingCenters] = useState<boolean>(false);
  const [isLoadingAreas, setIsLoadingAreas] = useState<boolean>(false);

  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState<boolean>(false);
  const [gpsMode, setGpsMode] = useState<'verified_gps' | 'administrative_manual' | 'none'>('none');
  const [gpsConflict, setGpsConflict] = useState<{ hasConflict: boolean; reason?: string; detectedCenterName?: string } | null>(null);

  // Dynamic delivery fee & restaurant area coverage
  const [dynamicDeliveryFee, setDynamicDeliveryFee] = useState<number>(
    checkoutRestaurantGroup?.deliveryFee || 15
  );
  const [restaurantCoverage, setRestaurantCoverage] = useState<{ isCovered: boolean; reason?: string }>({
    isCovered: true,
  });

  // Sync selected address if addresses loaded later
  useEffect(() => {
    if (!selectedAddressId && addresses.length > 0) {
      const def = addresses.find((a) => a.isDefault) || addresses[0];
      setSelectedAddressId(def.id);
    }
  }, [addresses, selectedAddressId]);

  const currentAddress =
    addresses.find((a) => a.id === selectedAddressId) || addresses[0];

  const restaurant = checkoutRestaurantGroup?.restaurant;

  // Resolve dynamic delivery fee & coverage whenever currentAddress or restaurant changes
  useEffect(() => {
    if (currentAddress && restaurant) {
      foodService
        .resolveDeliveryFee(restaurant.id, currentAddress, Number(restaurant.deliveryFee) || 15)
        .then((res) => {
          setDynamicDeliveryFee(res.fee);
          setRestaurantCoverage({ isCovered: res.isCovered, reason: res.reason });
        });

      // Check GPS conflict on existing address if coordinates exist
      if (currentAddress.latitude && currentAddress.longitude) {
        const conflict = detectGpsConflict(
          currentAddress.governorate,
          currentAddress.markaz,
          currentAddress.latitude,
          currentAddress.longitude
        );
        setGpsConflict(conflict.hasConflict ? conflict : null);
      } else {
        setGpsConflict(null);
      }
    }
  }, [currentAddress, restaurant, detectGpsConflict]);

  // Verify geographic scope whenever selected address changes
  useEffect(() => {
    if (currentAddress) {
      verifyGeographicScope(currentAddress).then((res) => {
        setAddressGeoScope(res);
      });
    }
  }, [currentAddress, verifyGeographicScope]);

  // Auto-fill recipient name and phone from selected address if not yet entered
  useEffect(() => {
    if (currentAddress) {
      if (!customerName && currentAddress.recipientName) {
        setCustomerName(currentAddress.recipientName);
      }
      if (!customerPhone && currentAddress.phone) {
        setCustomerPhone(currentAddress.phone);
      }
    } else if (addresses.length === 0) {
      setIsAddingNewAddress(true);
    }
  }, [currentAddress, addresses.length]);

  if (!checkoutRestaurantGroup || !restaurant) return null;

  // Cascading location handlers
  const handleGovernorateChange = async (govId: string) => {
    setNewGovId(govId);
    const gov = activeGovernorates.find((g) => g.id === govId);
    const govName = gov?.name_ar || '';
    setNewGovernorate(govName);

    setNewCenterId('');
    setNewMarkaz('');
    setNewAreaId('');
    setNewArea('');
    setAvailableAreas([]);

    if (govId) {
      setIsLoadingCenters(true);
      const centers = await loadCentersForGov(govId);
      setAvailableCenters(centers);
      setIsLoadingCenters(false);
    } else {
      setAvailableCenters([]);
    }

    if (gpsLat && gpsLng) {
      const conflict = detectGpsConflict(govName, '', gpsLat, gpsLng);
      setGpsConflict(conflict.hasConflict ? conflict : null);
    }
  };

  const handleCenterChange = async (centerId: string) => {
    setNewCenterId(centerId);
    const center = availableCenters.find((c) => c.id === centerId);
    const centerName = center?.name_ar || '';
    setNewMarkaz(centerName);

    setNewAreaId('');
    setNewArea('');

    if (centerId) {
      setIsLoadingAreas(true);
      const areas = await loadAreasForCenter(centerId);
      setAvailableAreas(areas);
      setIsLoadingAreas(false);
    } else {
      setAvailableAreas([]);
    }

    if (gpsLat && gpsLng) {
      const conflict = detectGpsConflict(newGovernorate, centerName, gpsLat, gpsLng);
      setGpsConflict(conflict.hasConflict ? conflict : null);
    }
  };

  const handleAreaChange = (areaId: string) => {
    setNewAreaId(areaId);
    const area = availableAreas.find((a) => a.id === areaId);
    setNewArea(area?.name_ar || '');
  };

  // GPS acquisition
  const handleRequestGps = () => {
    if (!navigator.geolocation) {
      setGpsMode('administrative_manual');
      return;
    }
    setIsAcquiringGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsAcquiringGps(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGpsLat(lat);
        setGpsLng(lng);
        setGpsMode('verified_gps');

        const conflict = detectGpsConflict(newGovernorate, newMarkaz, lat, lng);
        setGpsConflict(conflict.hasConflict ? conflict : null);
      },
      (err) => {
        setIsAcquiringGps(false);
        setGpsMode('administrative_manual');
        console.warn('Geolocation denied or unavailable:', err.message);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleSaveQuickAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGovernorate.trim() || !newGovId) {
      setErrorMessage('يرجى اختيار المحافظة من القائمة المعتمدة.');
      return;
    }
    if (!newMarkaz.trim() || !newCenterId) {
      setErrorMessage('يرجى اختيار المركز التابع للمحافظة.');
      return;
    }
    if (!newDetailedAddress.trim()) {
      setErrorMessage('يرجى إدخال العنوان التفصيلي (اسم الشارع، رقم المبنى، علامة مميزة).');
      return;
    }

    if (gpsConflict?.hasConflict) {
      setErrorMessage(gpsConflict.reason || 'تعارض في الموقع الفعلي مع المركز المختار. يرجى تصحيح المركز للمتابعة.');
      return;
    }

    try {
      const created = await addNewAddress({
        label: newLabel.trim() || 'عنوان المنزل',
        recipientName: customerName.trim() || 'المستلم',
        phone: customerPhone.trim() || '',
        governorate: newGovernorate.trim(),
        governorateId: newGovId,
        markaz: newMarkaz.trim(),
        centerId: newCenterId,
        area: newArea.trim() || undefined,
        areaId: newAreaId || undefined,
        detailedAddress: newArea.trim()
          ? `${newArea.trim()} - ${newDetailedAddress.trim()}`
          : newDetailedAddress.trim(),
        latitude: gpsLat || 0,
        longitude: gpsLng || 0,
        isDefault: addresses.length === 0,
      });

      setSelectedAddressId(created.id);
      setIsAddingNewAddress(false);
      setErrorMessage(null);
    } catch (addrErr: any) {
      setErrorMessage(addrErr.message || 'فشل حفظ العنوان');
    }
  };

  const calculatedTotal =
    checkoutRestaurantGroup.subtotal -
    checkoutRestaurantGroup.discount +
    dynamicDeliveryFee;

  const handleConfirmOrder = async () => {
    if (isSubmitting) return;

    setErrorMessage(null);

    if (!sectionSettings || !sectionSettings.section_enabled || isSectionDisabled) {
      setErrorMessage(
        sectionSettings?.status_message ||
          'قسم المطاعم غير متاح حالياً؛ لم يتم ضبط أو تفعيل إعدادات القسم في قاعدة البيانات (restaurant_section_settings).'
      );
      return;
    }

    if (!household?.id) {
      setErrorMessage('لم يتم العثور على منزل مسجل لحسابك. يرجى الانضمام إلى منزل أولاً لإتمام الطلب.');
      return;
    }

    if (!currentAddress || !currentAddress.detailedAddress?.trim()) {
      setErrorMessage('يرجى اختيار أو إضافة عنوان توصيل صالح ومكتمل.');
      return;
    }

    if (gpsConflict?.hasConflict) {
      setErrorMessage(
        gpsConflict.reason ||
          'تعارض جغرافي مؤكد بين موقع GPS الفعلي والمركز المختار. يرجى تصحيح المركز للمتابعة.'
      );
      return;
    }

    // Verify Geographic Scope
    if (addressGeoScope && !addressGeoScope.isServiceable) {
      setErrorMessage(addressGeoScope.reason || 'العنوان المختار خارج النطاق الجغرافي المخدوم لقسم المطاعم.');
      return;
    }

    // Verify restaurant coverage
    if (!restaurantCoverage.isCovered) {
      setErrorMessage(
        restaurantCoverage.reason ||
          `المطعم لا يغطي العنوان المختار (${currentAddress.markaz || currentAddress.governorate}) للتوصيل.`
      );
      return;
    }

    if (!customerPhone.trim()) {
      setErrorMessage('يرجى كتابة رقم هاتف العميل للتواصل.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitRestaurantOrder({
        restaurant,
        customerName: customerName.trim() || currentAddress.recipientName || 'العميل',
        customerPhone: customerPhone.trim(),
        address: currentAddress,
        notes: orderNotes.trim() || undefined,
      });

      if (!res.success) {
        setErrorMessage(res.message || 'فشل إرسال الطلب');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage('حدث خطأ أثناء معالجة الطلب.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        
        {/* Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 space-x-reverse">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/25 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Truck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                إتمام طلب طعام — {restaurant.name}
              </h3>
              <p className="text-[11px] text-slate-300">
                الدفع نقداً عند الاستلام فقط
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCheckoutModal}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Checkout Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-right">
          
          {/* Section Disabled / Settings Warning */}
          {(!sectionSettings || !sectionSettings.section_enabled || isSectionDisabled) && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 flex items-start space-x-2.5 space-x-reverse animate-in fade-in shadow-2xs">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-black text-amber-900">إنشاء طلبات المطاعم متوقف حالياً:</p>
                <p className="font-medium text-amber-800">
                  {sectionSettings?.status_message ||
                    'قسم المطاعم غير متاح حالياً أو لم يتم ضبط سجل الإعدادات في جدول restaurant_section_settings.'}
                </p>
              </div>
            </div>
          )}

          {/* Geographic Scope Warning */}
          {addressGeoScope && !addressGeoScope.isServiceable && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-950 flex items-start space-x-2.5 space-x-reverse animate-in fade-in shadow-2xs">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-black text-rose-900">العنوان المختار خارج نطاق التوصيل المعتمد:</p>
                <p className="font-medium text-rose-800">{addressGeoScope.reason}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-950 flex items-start space-x-2.5 space-x-reverse animate-in fade-in shadow-2xs">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-black text-rose-900">تعذر إتمام طلب المطعم:</p>
                <p className="font-medium text-rose-800 whitespace-pre-line">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Delivery Channel Notice Badge */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
            <div className="flex items-center space-x-2 space-x-reverse">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>
                {restaurant.deliveryChannel === 'direct_system'
                  ? 'يستقبل المطعم الطلب إلكترونياً عبر النظام مباشرةً.'
                  : 'يتولى المندوب الاتصال بالمطعم هاتفياً لتأكيد إمكانية التنفيذ.'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {restaurant.deliveryChannel === 'direct_system' ? 'Direct System' : 'Call Dispatch'}
            </span>
          </div>

          {/* 1. Address Selection & GPS Coordinates preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 flex items-center space-x-1.5 space-x-reverse">
                <MapPin className="w-4 h-4 text-emerald-600 ml-1" />
                <span>عنوان وموقع التوصيل</span>
              </span>

              {!isAddingNewAddress && (
                <button
                  type="button"
                  onClick={() => setIsAddingNewAddress(true)}
                  className="text-xs font-bold text-emerald-700 hover:underline"
                >
                  + إضافة عنوان آخر
                </button>
              )}
            </div>

            {isAddingNewAddress ? (
              <form onSubmit={handleSaveQuickAddress} className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      تسمية العنوان
                    </label>
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="المنزل، العمل..."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Governorate select */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      المحافظة <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newGovId}
                      onChange={(e) => handleGovernorateChange(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">-- اختر المحافظة --</option>
                      {activeGovernorates.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Center select */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      المركز / المدينة <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newCenterId}
                      onChange={(e) => handleCenterChange(e.target.value)}
                      disabled={!newGovId || isLoadingCenters}
                      required
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 disabled:bg-slate-100 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">
                        {isLoadingCenters
                          ? 'جاري تحميل المراكز...'
                          : !newGovId
                          ? '-- اختر المحافظة أولاً --'
                          : '-- اختر المركز --'}
                      </option>
                      {availableCenters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Area select */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      المنطقة / الحي (اختياري)
                    </label>
                    <select
                      value={newAreaId}
                      onChange={(e) => handleAreaChange(e.target.value)}
                      disabled={!newCenterId || isLoadingAreas || availableAreas.length === 0}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 disabled:bg-slate-100 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">
                        {isLoadingAreas
                          ? 'جاري تحميل المناطق...'
                          : !newCenterId
                          ? '-- اختر المركز أولاً --'
                          : availableAreas.length === 0
                          ? 'لا توجد مناطق فرعية محددة'
                          : '-- اختر المنطقة / الحي --'}
                      </option>
                      {availableAreas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    العنوان التفصيلي (الشارع، رقم العمارة، علامة مميزة) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={newDetailedAddress}
                    onChange={(e) => setNewDetailedAddress(e.target.value)}
                    placeholder="مثال: شارع الجمهورية، بجوار مسجد سيدي عارف، عمارة 4"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* GPS Location & Conflict verification box */}
                <div className="p-2.5 rounded-xl bg-slate-100/90 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleRequestGps}
                      disabled={isAcquiringGps}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-bold flex items-center space-x-1.5 space-x-reverse transition-all cursor-pointer"
                    >
                      <Navigation className={`w-3.5 h-3.5 ${isAcquiringGps ? 'animate-spin' : ''}`} />
                      <span>{isAcquiringGps ? 'جاري تحديد موقعك...' : 'تحديد موقعي الحالي GPS'}</span>
                    </button>

                    {gpsLat && gpsLng ? (
                      <div className="flex items-center space-x-1.5 space-x-reverse text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md font-bold">
                        <span>GPS: {gpsLat.toFixed(4)}, {gpsLng.toFixed(4)}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-medium">
                        {gpsMode === 'administrative_manual'
                          ? 'معتمد على الاختيار الإداري المختار'
                          : 'لم يتم تحديد إحداثيات GPS (اختياري)'}
                      </span>
                    )}
                  </div>

                  {gpsConflict?.hasConflict && (
                    <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-900 flex items-start space-x-2 space-x-reverse">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-black text-rose-950">تعارض مؤكد بين موقع GPS الفعلي والمركز المختار:</p>
                        <p className="text-[11px] leading-relaxed text-rose-800">{gpsConflict.reason}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-2 space-x-reverse pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewAddress(false)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={gpsConflict?.hasConflict}
                    className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                  >
                    حفظ واعتماد العنوان
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {addresses.map((addr) => {
                    const isSelected = (currentAddress?.id || '') === addr.id;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => setSelectedAddressId(addr.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-500 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-slate-900">
                            {addr.label}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {addr.detailedAddress}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Address Coordinates Badge */}
                {currentAddress && (
                  <div className="p-2.5 bg-white rounded-xl border border-dashed border-emerald-300 flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-1.5 space-x-reverse text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        الموقع الجغرافي المعتمد: {currentAddress.governorate}، {currentAddress.markaz}
                      </span>
                    </div>
                    <span dir="ltr" className="font-mono text-emerald-800 text-[10px] font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      GPS: {currentAddress.latitude.toFixed(4)}, {currentAddress.longitude.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Customer Contact details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم المستلم
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم هاتف التواصل <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
          </div>

          {/* 3. Items Summary */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <span className="text-xs font-black text-slate-900 block pb-1 border-b border-slate-100">
              ملخص الأصناف المطلوبة ({checkoutRestaurantGroup.items.length})
            </span>
            <div className="space-y-2 divide-y divide-slate-100 max-h-40 overflow-y-auto">
              {checkoutRestaurantGroup.items.map((item) => (
                <div key={item.cartItemId} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">
                      {item.quantity} × {item.name}
                    </span>
                    {item.selectedOptions.length > 0 && (
                      <p className="text-[10px] text-slate-500">
                        {item.selectedOptions.map((o) => o.optionName).join(' + ')}
                      </p>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-800">
                    {(item.unitPrice * item.quantity).toFixed(2)} ج.م
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Order Delivery Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ملاحظات التوصيل للطيار / السائق (اختياري)
            </label>
            <input
              type="text"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="مثال: رن الجرس واترك الطلب عند الباب، لا تدق الباب بقوة"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* 5. Payment Method: Cash on delivery only */}
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Banknote className="w-5 h-5 text-emerald-600" />
              <div>
                <span className="text-xs font-black text-emerald-950 block">
                  الدفع نقداً عند الاستلام (COD)
                </span>
                <span className="text-[10px] text-emerald-700 font-medium">
                  تسليم المبلغ لمندوب التوصيل عند استلام وجبتك ساخنة
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">
              مفعل
            </span>
          </div>

          {/* 6. Financial Breakdown */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>مجموع الأصناف</span>
              <span className="font-mono font-bold">
                {checkoutRestaurantGroup.subtotal.toFixed(2)} ج.م
              </span>
            </div>

            {checkoutRestaurantGroup.discount > 0 && (
              <div className="flex items-center justify-between text-emerald-700 font-bold">
                <span>خصم المطعم</span>
                <span className="font-mono">
                  -{checkoutRestaurantGroup.discount.toFixed(2)} ج.م
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-600">
              <span>رسوم التوصيل المعتمدة</span>
              <span className="font-mono font-bold text-emerald-800">
                {dynamicDeliveryFee.toFixed(2)} ج.م
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-slate-900 font-black text-sm">
              <span>المبلغ الإجمالي النهائي</span>
              <span className="font-mono text-emerald-800 text-base">
                {calculatedTotal.toFixed(2)} ج.م
              </span>
            </div>
          </div>

        </div>

        {/* Footer with Submit Button */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={closeCheckoutModal}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleConfirmOrder}
            disabled={
              isSubmitting ||
              !sectionSettings ||
              !sectionSettings.section_enabled ||
              isSectionDisabled ||
              (addressGeoScope !== null && !addressGeoScope.isServiceable) ||
              !restaurantCoverage.isCovered ||
              gpsConflict?.hasConflict
            }
            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center space-x-2 space-x-reverse shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin ml-1" />
                <span>جاري تسجيل الطلب...</span>
              </>
            ) : !sectionSettings || !sectionSettings.section_enabled || isSectionDisabled ? (
              <span>الطلب متوقف (إعدادات القسم غير مفعلة)</span>
            ) : addressGeoScope && !addressGeoScope.isServiceable ? (
              <span>العنوان خارج نطاق التوصيل المتاح</span>
            ) : !restaurantCoverage.isCovered ? (
              <span>المطعم لا يغطي هذه المنطقة</span>
            ) : gpsConflict?.hasConflict ? (
              <span>تعارض مؤكد في موقع GPS</span>
            ) : (
              <>
                <Check className="w-4 h-4 ml-1" />
                <span>تأكيد الطلب الآن ({calculatedTotal.toFixed(2)} ج.م)</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
