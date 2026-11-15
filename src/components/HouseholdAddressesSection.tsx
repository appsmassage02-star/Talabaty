import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { deliveryService } from '../lib/deliveryService';
import { validateGpsCoordinates } from '../lib/geoService';
import { HouseholdAddress } from '../types';
import {
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Home,
  Phone,
  User,
  Check,
  RefreshCw,
  Star,
  Compass,
  Crosshair,
  ExternalLink,
  Pencil,
  Navigation,
  X,
  Map,
  AlertTriangle,
} from 'lucide-react';
import { MapLocationPickerModal, type MapLocationConfirmMeta } from './MapLocationPickerModal';
import { GeoHierarchySelector, type GeoSelectionValue } from './GeoHierarchySelector';

interface Props {
  onAddressAdded?: (address: HouseholdAddress) => void;
  compact?: boolean;
}

const EMPTY_GEO_SELECTION: GeoSelectionValue = {
  governorateId: '',
  governorateName: '',
  centerId: '',
  centerName: '',
  areaId: '',
  areaName: '',
};

export const HouseholdAddressesSection: React.FC<Props> = ({ onAddressAdded, compact = false }) => {
  const { household, supabaseUser } = useApp();

  const [addresses, setAddresses] = useState<HouseholdAddress[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressLabel, setAddressLabel] = useState<string>('المنزل الرئيسي');
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [geoSelection, setGeoSelection] = useState<GeoSelectionValue>(EMPTY_GEO_SELECTION);
  const [legacyEditNames, setLegacyEditNames] = useState<
    { governorateName?: string; centerName?: string; areaName?: string } | undefined
  >(undefined);
  const [detailedAddress, setDetailedAddress] = useState<string>('');
  const [isDefault, setIsDefault] = useState<boolean>(false);

  // GPS Coordinates & Telemetry State (Mandatory)
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | null>(null);
  const [gpsSource, setGpsSource] = useState<'gps' | 'map_pin' | null>(null);
  const [gpsCapturedAt, setGpsCapturedAt] = useState<string | null>(null);
  const [editingLocationSnapshot, setEditingLocationSnapshot] = useState<{
    location: unknown;
    latitude: number | null;
    longitude: number | null;
  } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState<boolean>(false);

  // Fetch addresses
  const loadAddresses = async () => {
    if (!household?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await deliveryService.getHouseholdAddresses(household.id, supabaseUser?.id);
      setAddresses(data);
      if (data.length === 0) {
        setIsDefault(true);
      }
    } catch (err) {
      console.error('Error loading addresses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
    const handleAddressUpdate = () => {
      loadAddresses();
    };
    window.addEventListener('household-address-updated', handleAddressUpdate);
    return () => {
      window.removeEventListener('household-address-updated', handleAddressUpdate);
    };
  }, [household?.id, supabaseUser?.id]);

  // GPS Geolocation trigger (explicit user action)
  const handleGetCurrentLocation = () => {
    setLocationError(null);
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationError('خاصية تحديد الموقع الجغرافي (GPS) غير مدعومة في هذا الجهاز أو المتصفح.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(7));
        const lng = Number(pos.coords.longitude.toFixed(7));
        const acc =
          typeof pos.coords.accuracy === 'number' && Number.isFinite(pos.coords.accuracy)
            ? Number(pos.coords.accuracy.toFixed(1))
            : null;
        setLatitude(lat);
        setLongitude(lng);
        setGpsAccuracyM(acc);
        setGpsSource('gps');
        setGpsCapturedAt(new Date().toISOString());
        setIsLocating(false);
        setLocationError(null);
      },
      (err) => {
        setIsLocating(false);
        let msg = 'تعذر الحصول على الموقع الجغرافي.';
        if (err.code === 1) {
          msg = 'تم رفض إذن الوصول للموقع. يرجى تفعيل إذن الموقع (GPS) أو استخدام الخريطة التفاعلية لتثبيت الدبوس.';
        } else if (err.code === 2) {
          msg = 'بيانات الموقع غير متوفرة حالياً. تأكد من تفعيل خدمة الموقع (GPS) أو استخدم الخريطة.';
        } else if (err.code === 3) {
          msg = 'انتهت مهلة طلب تحديد الموقع. يرجى إعادة المحاولة أو التحديد من الخريطة.';
        }
        setLocationError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const handleClearLocation = () => {
    setLatitude(null);
    setLongitude(null);
    setGpsAccuracyM(null);
    setGpsSource(null);
    setGpsCapturedAt(null);
    setLocationError(null);
  };

  const handleResetForm = () => {
    setEditingAddressId(null);
    setAddressLabel(addresses.length === 0 ? 'المنزل الرئيسي' : 'عنوان إضافي');
    setFullName('');
    setPhone('');
    setGeoSelection(EMPTY_GEO_SELECTION);
    setLegacyEditNames(undefined);
    setDetailedAddress('');
    setIsDefault(addresses.length === 0);
    setLatitude(null);
    setLongitude(null);
    setGpsAccuracyM(null);
    setGpsSource(null);
    setGpsCapturedAt(null);
    setEditingLocationSnapshot(null);
    setLocationError(null);
    setIsFormOpen(false);
  };

  const handleStartEdit = (addr: HouseholdAddress) => {
    setEditingAddressId(addr.id);
    setAddressLabel(addr.address_label || 'عنوان المنزل');
    setFullName(addr.full_name || '');
    setPhone(addr.phone || '');
    if (addr.governorate_id && addr.center_id && addr.area_id) {
      setGeoSelection({
        governorateId: addr.governorate_id,
        governorateName: addr.governorate_name || '',
        centerId: addr.center_id,
        centerName: addr.markaz_name || '',
        areaId: addr.area_id,
        areaName: addr.area_name || '',
      });
      setLegacyEditNames(undefined);
    } else {
      setGeoSelection(EMPTY_GEO_SELECTION);
      setLegacyEditNames({
        governorateName: addr.governorate_name,
        centerName: addr.markaz_name,
        areaName: addr.area_name || undefined,
      });
    }
    setDetailedAddress(addr.detailed_address || '');
    setIsDefault(!!addr.is_default);

    const gpsCheck = validateGpsCoordinates(addr.latitude, addr.longitude);
    if (gpsCheck.valid && gpsCheck.latitude !== null && gpsCheck.longitude !== null) {
      setLatitude(gpsCheck.latitude);
      setLongitude(gpsCheck.longitude);
      setGpsAccuracyM(addr.gps_accuracy_m ?? null);
      setGpsSource((addr.gps_source as 'gps' | 'map_pin') || 'map_pin');
      setGpsCapturedAt(addr.gps_captured_at || null);
      setEditingLocationSnapshot(
        addr.location !== undefined
          ? {
              location: addr.location,
              latitude: gpsCheck.latitude,
              longitude: gpsCheck.longitude,
            }
          : null
      );
    } else {
      setLatitude(null);
      setLongitude(null);
      setGpsAccuracyM(null);
      setGpsSource(null);
      setGpsCapturedAt(null);
      setEditingLocationSnapshot(null);
    }

    setLocationError(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsFormOpen(true);
  };

  // Handle saving new or edited address
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!household?.id) {
      setErrorMessage('معرّف المنزل غير متاح. يرجى التأكد من الاتصال بالمنزل.');
      return;
    }

    if (!fullName.trim()) {
      setErrorMessage('يرجى إدخال اسم المستلم كاملاً');
      return;
    }

    if (!phone.trim()) {
      setErrorMessage('يرجى إدخال رقم هاتف التواصل');
      return;
    }

    if (!geoSelection.governorateId || !geoSelection.governorateName) {
      setErrorMessage('يرجى اختيار المحافظة من النظام الجغرافي المعتمد');
      return;
    }

    if (!geoSelection.centerId || !geoSelection.centerName) {
      setErrorMessage('يرجى اختيار المركز / المدينة من النظام الجغرافي المعتمد');
      return;
    }

    if (!geoSelection.areaId || !geoSelection.areaName) {
      setErrorMessage('يرجى اختيار المنطقة / الحي من النظام الجغرافي المعتمد');
      return;
    }

    if (!detailedAddress.trim()) {
      setErrorMessage('يرجى كتابة العنوان التفصيلي (الشارع، رقم العمارة، الشقة، علامة مميزة)');
      return;
    }

    const gpsCheck = validateGpsCoordinates(latitude, longitude);
    if (!gpsCheck.valid || gpsCheck.latitude === null || gpsCheck.longitude === null) {
      setErrorMessage(
        gpsCheck.reason ||
          'يجب تحديد موقعك الدقيق عبر GPS أو تثبيت الدبوس على الخريطة قبل حفظ العنوان'
      );
      return;
    }

    const shouldPreserveLocation =
      editingLocationSnapshot &&
      editingLocationSnapshot.latitude === gpsCheck.latitude &&
      editingLocationSnapshot.longitude === gpsCheck.longitude;

    setIsSaving(true);
    try {
      const result = await deliveryService.saveAddress(
        {
          id: editingAddressId || undefined,
          household_id: household.id,
          address_label: addressLabel.trim() || 'عنوان المنزل',
          full_name: fullName.trim(),
          phone: phone.trim(),
          country: 'مصر',
          governorate_id: geoSelection.governorateId,
          governorate_name: geoSelection.governorateName,
          center_id: geoSelection.centerId,
          markaz_name: geoSelection.centerName,
          area_id: geoSelection.areaId,
          area_name: geoSelection.areaName,
          detailed_address: detailedAddress.trim(),
          latitude: gpsCheck.latitude,
          longitude: gpsCheck.longitude,
          gps_accuracy_m: gpsAccuracyM,
          gps_source: gpsSource || 'map_pin',
          gps_captured_at: gpsCapturedAt || new Date().toISOString(),
          ...(shouldPreserveLocation ? { location: editingLocationSnapshot.location } : {}),
          is_default: isDefault || addresses.length === 0,
        },
        supabaseUser?.id
      );

      if (!result.success || !result.address) {
        setErrorMessage(result.message || 'فشل حفظ العنوان');
        setIsSaving(false);
        return;
      }

      const savedAddress = result.address;

      setAddresses((prev) => {
        const isDef = !!savedAddress.is_default;
        const mapped = isDef ? prev.map((a) => ({ ...a, is_default: false })) : [...prev];
        const existingIdx = mapped.findIndex((a) => a.id === savedAddress.id);
        if (existingIdx >= 0) {
          mapped[existingIdx] = savedAddress;
          return mapped;
        }
        return [savedAddress, ...mapped];
      });

      setSuccessMessage(editingAddressId ? 'تم تحديث عنوان المنزل وموقعه بنجاح' : 'تم حفظ عنوان المنزل بنجاح');
      if (onAddressAdded) {
        onAddressAdded(savedAddress);
      }

      handleResetForm();
      window.dispatchEvent(new CustomEvent('household-address-updated', { detail: savedAddress }));
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ العنوان');
    } finally {
      setIsSaving(false);
    }
  };

  // Set address as default
  const handleSetDefault = async (addr: HouseholdAddress) => {
    if (!household?.id) return;
    setAddresses((prev) =>
      prev.map((a) => ({ ...a, is_default: a.id === addr.id }))
    );
    try {
      const res = await deliveryService.setDefaultAddress(addr.id, household.id, supabaseUser?.id);
      if (!res.success) {
        loadAddresses();
        return;
      }
      window.dispatchEvent(new CustomEvent('household-address-updated', { detail: { ...addr, is_default: true } }));
    } catch (err) {
      console.error('Failed to set default address:', err);
      loadAddresses();
    }
  };

  // Delete address
  const handleDeleteAddress = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العنوان؟')) return;
    // Optimistically remove
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    try {
      await deliveryService.deleteAddress(id, household?.id, supabaseUser?.id);
      window.dispatchEvent(new CustomEvent('household-address-updated', { detail: { deletedId: id } }));
    } catch (err) {
      console.error('Failed to delete address:', err);
      loadAddresses();
    }
  };

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
            <MapPin className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              بيانات التواصل للمنزل
            </h3>
            <p className="text-xs text-slate-500">
              عناوين التوصيل المعتمدة لطلبات الشراء الخاصة بالمنزل
            </p>
          </div>
        </div>

        {!isFormOpen && (
          <button
            type="button"
            onClick={() => {
              setIsFormOpen(true);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="flex items-center space-x-1.5 space-x-reverse px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة عنوان جديد</span>
          </button>
        )}
      </div>

      {/* Feedback Messages */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center space-x-2 space-x-reverse animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center space-x-2 space-x-reverse animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Add New Address Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveAddress}
          className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-xs font-black text-slate-800 flex items-center space-x-1.5 space-x-reverse">
              <Plus className="w-4 h-4 text-emerald-600 ml-1" />
              <span>تسجيل عنوان منزل جديد</span>
            </span>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Label */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تسمية العنوان (اختياري)
              </label>
              <input
                type="text"
                value={addressLabel}
                onChange={(e) => setAddressLabel(e.target.value)}
                placeholder="مثال: المنزل الرئيسي، شقة المعادي"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الاسم <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="اسم المستلم كاملاً"
                  className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم الهاتف <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Country: Fixed to Egypt */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الدولة (مصر دائمًا وغير قابلة للتغيير)
              </label>
              <input
                type="text"
                disabled
                value="مصر"
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-500 cursor-not-allowed"
              />
            </div>

            {/* Central Geo Hierarchy Selector: Governorate -> Center -> Area */}
            <div className="sm:col-span-2 pt-1">
              <GeoHierarchySelector
                value={geoSelection}
                onChange={setGeoSelection}
                initialLegacyNames={legacyEditNames}
              />
              <p className="text-[10.5px] text-amber-700 font-bold mt-1.5">
                ℹ️ اختيار المحافظة والمركز والمنطقة لا يغني عن تحديد موقعك الفعلي بدقة على الخريطة أو عبر GPS.
              </p>
            </div>
          </div>

          {/* Detailed Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              العنوان التفصيلي <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={detailedAddress}
              onChange={(e) => setDetailedAddress(e.target.value)}
              placeholder="مثال: شارع النصر، عمارة 14، الدور الثالث، شقة 7، بجوار مسجد الفاروق"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
            />
          </div>

          {/* GPS Coordinates Section (Mandatory via GPS or Leaflet Map Pin) */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 space-x-reverse">
                <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                  <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">
                    الموقع الجغرافي الدقيق (GPS) <span className="text-rose-500">* إجباري</span>
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    مطلوب لتحديد نطاق التغطية بدقة — استخدم زر GPS أو ثبّت الدبوس على الخريطة
                  </p>
                </div>
              </div>

              {latitude !== null && longitude !== null && (
                <button
                  type="button"
                  onClick={handleClearLocation}
                  className="text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center space-x-1 space-x-reverse"
                >
                  <X className="w-3 h-3" />
                  <span>إزالة الإحداثيات</span>
                </button>
              )}
            </div>

            {locationError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-[11px] font-bold flex items-start space-x-2 space-x-reverse">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="flex-1 leading-relaxed">{locationError}</span>
              </div>
            )}

            {latitude !== null && longitude !== null ? (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-xs font-black text-emerald-950 block">
                        تم التقاط الموقع الجغرافي بنجاح ({gpsSource === 'gps' ? 'GPS' : 'دبوس الخريطة'})
                      </span>
                      <span dir="ltr" className="text-[11px] font-mono text-emerald-700">
                        {latitude.toFixed(6)}, {longitude.toFixed(6)}
                        {gpsAccuracyM ? ` (±${gpsAccuracyM}m)` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 space-x-reverse flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsMapPickerOpen(true)}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold inline-flex items-center space-x-1 space-x-reverse transition-colors shadow-2xs"
                    >
                      <Map className="w-3 h-3 ml-1 text-emerald-600" />
                      <span>تعديل على الخريطة</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGetCurrentLocation}
                      disabled={isLocating}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold inline-flex items-center space-x-1 space-x-reverse transition-colors shadow-2xs disabled:opacity-50"
                    >
                      {isLocating ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Crosshair className="w-3 h-3 ml-1" />
                      )}
                      <span>تحديث GPS</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-2 bg-amber-50/70 p-2.5 rounded-xl border border-dashed border-amber-300">
                <div className="flex items-center space-x-2 space-x-reverse text-amber-800">
                  <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-[11px] font-bold">مطلوب تثبيت الموقع على الخريطة أو عبر GPS</span>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={isLocating}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 space-x-reverse transition-all shadow-xs disabled:opacity-50"
                  >
                    {isLocating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري التقاط الموقع...</span>
                      </>
                    ) : (
                      <>
                        <Crosshair className="w-3.5 h-3.5 ml-1" />
                        <span>تحديد موقعي الحالي (GPS)</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMapPickerOpen(true)}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 space-x-reverse transition-all shadow-xs"
                  >
                    <Map className="w-3.5 h-3.5 ml-1 text-emerald-600" />
                    <span>اختيار الموقع من الخريطة</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Default Checkbox */}
          <div className="flex items-center space-x-2 space-x-reverse pt-1">
            <input
              id="chk-default-address"
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <label htmlFor="chk-default-address" className="text-xs font-bold text-slate-700 cursor-pointer">
              تعيين كعنوان افتراضي للمنزل
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 space-x-reverse pt-2">
            <button
              type="button"
              onClick={handleResetForm}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition-all"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 space-x-reverse disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingAddressId ? 'تحديث العنوان' : 'حفظ العنوان'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Addresses List */}
      {isLoading ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
          <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin mx-auto mb-2" />
          <span className="text-xs text-slate-500 font-bold">جاري تحميل بيانات العناوين...</span>
        </div>
      ) : addresses.length === 0 && !isFormOpen ? (
        <div className="p-6 text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-300 space-y-2">
          <Home className="w-8 h-8 text-slate-400 mx-auto" />
          <h4 className="text-xs font-bold text-slate-700">لا يوجد عنوان مسجل للمنزل حتى الآن</h4>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            أضف عنوان المنزل الرئيسي لتسهيل إرسال طلبات التوصيل تلقائياً بضغطة زر
          </p>
          <button
            type="button"
            onClick={() => {
              handleResetForm();
              setIsFormOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 space-x-reverse px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-xs mt-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>تسجيل العنوان الأول للمنزل</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {addresses.map((addr) => {
            const hasCoords = validateGpsCoordinates(addr.latitude, addr.longitude).valid;
            const hasGeoHierarchy = Boolean(addr.governorate_id && addr.center_id && addr.area_id);
            const needsCompletion = !hasCoords || !hasGeoHierarchy;
            return (
              <div
                key={addr.id}
                className={`p-4 rounded-2xl border transition-all relative ${
                  addr.is_default
                    ? 'bg-emerald-50/40 border-emerald-300 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header Badge & Label */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5 space-x-reverse">
                    <span className="text-xs font-black text-slate-800">
                      {addr.address_label || 'عنوان المنزل'}
                    </span>
                    {addr.is_default && (
                      <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center space-x-1 space-x-reverse">
                        <Star className="w-2.5 h-2.5 fill-current ml-1" />
                        <span>العنوان الافتراضي</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 space-x-reverse">
                    {!addr.is_default && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(addr)}
                        title="تعيين كافتراضي"
                        className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 transition-colors"
                      >
                        تعيين كافتراضي
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStartEdit(addr)}
                      title="تعديل العنوان والموقع"
                      className="p-1 text-slate-400 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.id)}
                      title="حذف العنوان"
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Recipient info */}
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex items-center space-x-2 space-x-reverse font-bold text-slate-800">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{addr.full_name}</span>
                    <span className="text-slate-300">•</span>
                    <span dir="ltr" className="text-slate-600 text-[11px] font-mono">
                      {addr.phone}
                    </span>
                  </div>

                  {/* Location */}
                  <div className="flex items-start space-x-2 space-x-reverse pt-1 text-slate-700">
                    <Compass className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-emerald-950">
                        {addr.governorate_name} - {addr.markaz_name}
                        {addr.area_name ? ` - ${addr.area_name}` : ''}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {addr.detailed_address}
                      </p>
                    </div>
                  </div>

                  {/* GPS & Geo Readiness Status */}
                  {!needsCompletion ? (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] flex-wrap gap-1.5">
                      <span className="inline-flex items-center space-x-1 space-x-reverse text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md font-bold border border-emerald-200">
                        <MapPin className="w-3 h-3 text-emerald-600 ml-1" />
                        <span dir="ltr" className="font-mono text-[10px]">
                          {Number(addr.latitude).toFixed(5)}, {Number(addr.longitude).toFixed(5)}
                        </span>
                      </span>
                      <a
                        href={`https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center space-x-1 space-x-reverse hover:underline"
                      >
                        <span>معاينة</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    </div>
                  ) : (
                    <div className="mt-2 pt-1.5 border-t border-amber-100 flex items-center justify-between text-[10.5px] text-amber-700 bg-amber-50/70 px-2 py-1 rounded-lg">
                      <span className="inline-flex items-center gap-1 font-bold">
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                        {!hasGeoHierarchy && !hasCoords
                          ? 'يحتاج استكمال المنطقة وGPS'
                          : !hasGeoHierarchy
                          ? 'يحتاج اختيار المنطقة المعتمدة'
                          : 'يحتاج تثبيت موقع GPS'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(addr)}
                        className="text-emerald-700 hover:text-emerald-800 font-extrabold hover:underline shrink-0"
                      >
                        تحديث الآن
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Map Picker Modal */}
      <MapLocationPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        onConfirm={(lat, lng, meta?: MapLocationConfirmMeta) => {
          setLatitude(lat);
          setLongitude(lng);
          setGpsAccuracyM(meta?.accuracyM ?? null);
          setGpsSource(meta?.source || 'map_pin');
          setGpsCapturedAt(meta?.capturedAt || new Date().toISOString());
          setLocationError(null);
        }}
        initialLat={latitude}
        initialLng={longitude}
        governorateName={geoSelection.governorateName}
        title={editingAddressId ? 'تعديل موقع العنوان على الخريطة' : 'تحديد موقع العنوان على الخريطة'}
      />
    </div>
  );
};
