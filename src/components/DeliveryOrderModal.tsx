import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { deliveryService } from '../lib/deliveryService';
import { HouseholdAddress, DeliverySettings, InvoiceProduct } from '../types';
import { EGYPT_GOVERNORATES } from '../data/egyptLocations';
import {
  Truck,
  MapPin,
  Plus,
  AlertCircle,
  CheckCircle2,
  X,
  User,
  Phone,
  Building,
  Calendar,
  Compass,
  FileText,
  Star,
  RefreshCw,
  Ban,
  Crosshair,
  Map,
} from 'lucide-react';
import { MapLocationPickerModal } from './MapLocationPickerModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: InvoiceProduct[];
  subtotal: number;
  onConfirm: (data: {
    addressId: string;
    deliveryNotes: string;
    deliveryFee: number;
    addressSnapshot: HouseholdAddress;
  }) => Promise<{ success: boolean; message?: string }>;
}

export const DeliveryOrderModal: React.FC<Props> = ({
  isOpen,
  onClose,
  products,
  subtotal,
  onConfirm,
}) => {
  const { household, supabaseUser, budgetConfig } = useApp();

  const [settings, setSettings] = useState<DeliverySettings | null>(null);
  const [addresses, setAddresses] = useState<HouseholdAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Address inline form state
  const [isAddingNewAddress, setIsAddingNewAddress] = useState<boolean>(false);
  const [newLabel, setNewLabel] = useState<string>('عنوان التوصيل');
  const [newName, setNewName] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [selectedGovCode, setSelectedGovCode] = useState<string>('cairo');
  const [selectedGovName, setSelectedGovName] = useState<string>('القاهرة');
  const [selectedMarkazName, setSelectedMarkazName] = useState<string>('');
  const [newDetailedAddress, setNewDetailedAddress] = useState<string>('');
  const [newIsDefault, setNewIsDefault] = useState<boolean>(false);
  const [newLatitude, setNewLatitude] = useState<number | null>(null);
  const [newLongitude, setNewLongitude] = useState<number | null>(null);
  const [isLocatingNewAddress, setIsLocatingNewAddress] = useState<boolean>(false);
  const [locationErrorNewAddress, setLocationErrorNewAddress] = useState<string | null>(null);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState<boolean>(false);
  const [isSavingAddress, setIsSavingAddress] = useState<boolean>(false);

  const handleGetLocationForNewAddress = () => {
    setLocationErrorNewAddress(null);
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationErrorNewAddress('تحديد الموقع عبر GPS غير مدعوم في هذا الجهاز.');
      return;
    }
    setIsLocatingNewAddress(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewLatitude(Number(pos.coords.latitude.toFixed(7)));
        setNewLongitude(Number(pos.coords.longitude.toFixed(7)));
        setIsLocatingNewAddress(false);
      },
      (err) => {
        setIsLocatingNewAddress(false);
        if (err.code === 1) {
          setLocationErrorNewAddress('تم رفض إذن الموقع. يرجى تفعيل الـ GPS في جهازك.');
        } else {
          setLocationErrorNewAddress('تعذر تحديد الموقع الجغرافي حالياً.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Load settings and addresses on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setFormError(null);
    setIsAddingNewAddress(false);

    const fetchData = async () => {
      try {
        const [settingsData, addressesData] = await Promise.all([
          deliveryService.getSettings(),
          household?.id
            ? deliveryService.getHouseholdAddresses(household.id, supabaseUser?.id)
            : Promise.resolve([]),
        ]);

        if (!isMounted) return;

        setSettings(settingsData);
        setAddresses(addressesData);

        // Select default address or first address
        if (addressesData.length > 0) {
          const defaultAddr = addressesData.find((a) => a.is_default) || addressesData[0];
          setSelectedAddressId(defaultAddr.id);
        } else {
          // Open address form automatically if no address exists
          setIsAddingNewAddress(true);
        }
      } catch (err) {
        console.error('Error fetching delivery initial data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, household?.id, supabaseUser?.id]);

  // Update markaz list when governorate changes
  const currentGov = EGYPT_GOVERNORATES.find((g) => g.code === selectedGovCode) || EGYPT_GOVERNORATES[0];
  const marakezList = currentGov?.marakez || [];

  useEffect(() => {
    if (marakezList.length > 0 && !marakezList.includes(selectedMarkazName)) {
      setSelectedMarkazName(marakezList[0]);
    }
  }, [selectedGovCode, marakezList]);

  // Governorate Delivery Fee resolution state
  const [resolvedGovFee, setResolvedGovFee] = useState<{
    allowed: boolean;
    deliveryFee: number;
    reason?: string;
    source: 'governorate' | 'default';
  }>({
    allowed: true,
    deliveryFee: 15,
    source: 'default',
  });

  // Re-resolve fee whenever selected address changes
  useEffect(() => {
    let isMounted = true;
    const resolveFee = async () => {
      const addr = addresses.find((a) => a.id === selectedAddressId);
      if (!addr) return;
      const res = await deliveryService.resolveDeliveryFeeForGovernorate(
        addr.governorate_name,
        addr.governorate_code
      );
      if (isMounted) {
        setResolvedGovFee(res);
      }
    };
    if (selectedAddressId && addresses.length > 0) {
      resolveFee();
    }
    return () => {
      isMounted = false;
    };
  }, [selectedAddressId, addresses]);

  if (!isOpen) return null;

  const isDeliveryEnabled = (settings?.delivery_enabled ?? true) && resolvedGovFee.allowed;
  const deliveryFee = resolvedGovFee.deliveryFee;
  const totalAmount = subtotal + (isDeliveryEnabled ? deliveryFee : 0);

  // Handle adding a new address inline
  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!household?.id) {
      setFormError('معرّف المنزل غير متاح.');
      return;
    }

    if (!newName.trim()) {
      setFormError('يرجى إدخال اسم المستلم');
      return;
    }
    if (!newPhone.trim()) {
      setFormError('يرجى إدخال رقم هاتف التواصل');
      return;
    }
    if (!selectedGovName.trim()) {
      setFormError('يرجى اختيار المحافظة');
      return;
    }
    if (!selectedMarkazName.trim()) {
      setFormError('يرجى اختيار المركز أو الحي');
      return;
    }
    if (!newDetailedAddress.trim()) {
      setFormError('يرجى كتابة العنوان التفصيلي');
      return;
    }

    setIsSavingAddress(true);
    try {
      const res = await deliveryService.saveAddress(
        {
          household_id: household.id,
          address_label: newLabel.trim() || 'عنوان جديد',
          full_name: newName.trim(),
          phone: newPhone.trim(),
          country: 'مصر',
          governorate_code: selectedGovCode,
          governorate_name: selectedGovName,
          markaz_code: selectedMarkazName,
          markaz_name: selectedMarkazName,
          detailed_address: newDetailedAddress.trim(),
          latitude: newLatitude,
          longitude: newLongitude,
          is_default: newIsDefault || addresses.length === 0,
        },
        supabaseUser?.id
      );

      if (!res.success || !res.address) {
        setFormError(res.message || 'فشل حفظ العنوان');
        setIsSavingAddress(false);
        return;
      }

      // Add to addresses list and select it
      const updatedList = [res.address, ...addresses];
      setAddresses(updatedList);
      setSelectedAddressId(res.address.id);
      setIsAddingNewAddress(false);
      setNewDetailedAddress('');
      setNewLatitude(null);
      setNewLongitude(null);
      setLocationErrorNewAddress(null);
    } catch (err: any) {
      setFormError(err.message || 'حدث خطأ أثناء حفظ العنوان');
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Submit delivery order
  const handleConfirmOrder = async () => {
    setFormError(null);

    // 1. Validate service is enabled
    if (!isDeliveryEnabled || !resolvedGovFee.allowed) {
      setFormError(
        resolvedGovFee.reason ||
          'خدمة التوصيل معطلة حالياً. لا يمكن إنشاء طلبات جديدة في الوقت الحالي.'
      );
      return;
    }

    // 2. Validate products
    if (!products || products.length === 0) {
      setFormError('لا توجد منتجات في الفاتورة.');
      return;
    }

    // 3. Validate address selection
    const selectedAddr = addresses.find((a) => a.id === selectedAddressId);
    if (!selectedAddr) {
      setFormError('يرجى اختيار عنوان التوصيل من القائمة أو إضافة عنوان جديد.');
      return;
    }

    // 4. Validate mandatory address fields
    if (
      !selectedAddr.full_name?.trim() ||
      !selectedAddr.phone?.trim() ||
      !selectedAddr.governorate_name?.trim() ||
      !selectedAddr.markaz_name?.trim() ||
      !selectedAddr.detailed_address?.trim()
    ) {
      setFormError('بيانات العنوان المحدد غير مكتملة، يرجى استكمال بيانات العنوان.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onConfirm({
        addressId: selectedAddr.id,
        deliveryNotes: deliveryNotes.trim(),
        deliveryFee: deliveryFee,
        addressSnapshot: selectedAddr,
      });

      if (!res.success) {
        setFormError(res.message || 'فشل تسجيل طلب التوصيل');
        setIsSubmitting(false);
        return;
      }

      onClose();
    } catch (err: any) {
      setFormError(err.message || 'حدث خطأ أثناء معالجة طلب التوصيل');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[92vh] flex flex-col text-right overflow-hidden animate-in zoom-in-95 duration-150" dir="rtl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50/50 shrink-0">
          <div className="flex items-center space-x-3 space-x-reverse min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">
                طلب التوصيل للمنزل
              </h3>
              <p className="text-xs text-slate-500 truncate">
                توصيل مشتريات الفاتورة مباشرة إلى باب المنزل
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Service Disabled Notice */}
          {!isDeliveryEnabled && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-2.5 space-x-reverse text-rose-800">
              <Ban className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black">خدمة التوصيل معطلة حالياً</h4>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  تم إيقاف استقبال طلبات الدليفري الجديدة مؤقتاً بواسطة الإدارة. يمكنك حفظ الفاتورة كشراء شخصي عادي.
                </p>
              </div>
            </div>
          )}

          {/* Form Error Alert */}
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center space-x-2 space-x-reverse animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Delivery Fee Notice (Read-only, cannot be edited) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center space-x-2 space-x-reverse">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                ج.م
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  تكلفة التوصيل المعتمدة
                </span>
                <span className="text-[10px] text-slate-400 block">
                  محددة رسمياً من الإدارة (غير قابلة للتعديل)
                </span>
              </div>
            </div>
            <span className="text-base font-black text-emerald-700 font-mono">
              {deliveryFee.toFixed(2)} {budgetConfig.currency}
            </span>
          </div>

          {/* Address Selection Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                <MapPin className="w-4 h-4 text-blue-600 ml-1" />
                <span>عنوان التوصيل</span>
              </label>
              {!isAddingNewAddress && (
                <button
                  type="button"
                  onClick={() => setIsAddingNewAddress(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1 space-x-reverse"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة عنوان جديد</span>
                </button>
              )}
            </div>

            {/* If adding new address inline */}
            {isAddingNewAddress ? (
              <form
                onSubmit={handleSaveNewAddress}
                className="bg-blue-50/40 border border-blue-200 rounded-2xl p-3.5 space-y-3 animate-in fade-in"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-blue-200/60">
                  <span className="text-xs font-black text-blue-900">
                    إضافة عنوان توصيل جديد
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewAddress(false)}
                    className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
                  >
                    رجوع للعناوين المحفوظة
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      الاسم <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="اسم المستلم"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      رقم الهاتف <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="010XXXXXXXX"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      الدولة
                    </label>
                    <input
                      type="text"
                      disabled
                      value="مصر"
                      className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-500 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      المحافظة <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedGovCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const gov = EGYPT_GOVERNORATES.find((g) => g.code === code);
                        setSelectedGovCode(code);
                        if (gov) {
                          setSelectedGovName(gov.nameAr);
                          setSelectedMarkazName(gov.marakez[0] || '');
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {EGYPT_GOVERNORATES.map((gov) => (
                        <option key={gov.code} value={gov.code}>
                          {gov.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      المركز / الحي <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedMarkazName}
                      onChange={(e) => setSelectedMarkazName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {marakezList.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    العنوان التفصيلي <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={newDetailedAddress}
                    onChange={(e) => setNewDetailedAddress(e.target.value)}
                    placeholder="الشارع، رقم العمارة، الشقة، علامة مميزة"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  />
                </div>

                {/* GPS / Map Location Section (Optional) */}
                <div className="pt-1.5 border-t border-blue-200/50 flex items-center justify-between flex-wrap gap-1.5">
                  <div className="flex items-center space-x-1.5 space-x-reverse text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    {newLatitude !== null && newLongitude !== null ? (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                        محدد ({newLatitude.toFixed(4)}, {newLongitude.toFixed(4)})
                      </span>
                    ) : (
                      <span className="text-slate-500">إرفاق إحداثيات العنوان (اختياري)</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1.5 space-x-reverse flex-wrap gap-1">
                    {newLatitude !== null && (
                      <button
                        type="button"
                        onClick={() => { setNewLatitude(null); setNewLongitude(null); }}
                        className="text-[10px] text-rose-600 hover:underline px-1"
                      >
                        إلغاء الموقع
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsMapPickerOpen(true)}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold inline-flex items-center space-x-1 space-x-reverse"
                    >
                      <Map className="w-3 h-3 ml-1 text-emerald-600" />
                      <span>{newLatitude !== null ? 'تعديل على الخريطة' : 'اختيار من الخريطة'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGetLocationForNewAddress}
                      disabled={isLocatingNewAddress}
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 rounded-lg text-[11px] font-bold inline-flex items-center space-x-1 space-x-reverse disabled:opacity-50"
                    >
                      {isLocatingNewAddress ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Crosshair className="w-3 h-3 ml-1" />
                      )}
                      <span>{newLatitude !== null ? 'تحديث GPS' : 'تحديد عبر GPS'}</span>
                    </button>
                  </div>
                </div>

                {locationErrorNewAddress && (
                  <p className="text-[10px] text-rose-600 font-bold">{locationErrorNewAddress}</p>
                )}

                <div className="flex items-center justify-end space-x-2 space-x-reverse pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewAddress(false)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingAddress}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 space-x-reverse"
                  >
                    {isSavingAddress ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>حفظ واستخدام هذا العنوان</span>
                    )}
                  </button>
                </div>
              </form>
            ) : isLoading ? (
              <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-200">
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin mx-auto mb-1" />
                <span className="text-xs text-slate-400">جاري تحميل العناوين...</span>
              </div>
            ) : addresses.length === 0 ? (
              <div className="p-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <p className="text-xs text-slate-500 mb-2">لا توجد عناوين محفوظة للمنزل</p>
                <button
                  type="button"
                  onClick={() => setIsAddingNewAddress(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold"
                >
                  + إضافة عنوان التوصيل الآن
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                {addresses.map((addr) => {
                  const hasCoords = addr.latitude != null && addr.longitude != null && !isNaN(Number(addr.latitude)) && !isNaN(Number(addr.longitude));
                  return (
                    <label
                      key={addr.id}
                      className={`p-3 rounded-xl border flex items-start space-x-3 space-x-reverse cursor-pointer transition-all ${
                        selectedAddressId === addr.id
                          ? 'bg-blue-50/50 border-blue-400 ring-1 ring-blue-400/30'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="delivery_address"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <div className="flex-1 min-w-0 text-xs">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <span className="font-black text-slate-800">
                            {addr.address_label || 'عنوان المنزل'}
                          </span>
                          {addr.is_default && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-1.5 py-0.2 rounded">
                              افتراضي
                            </span>
                          )}
                          {hasCoords && (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center space-x-0.5 space-x-reverse">
                              <MapPin className="w-2.5 h-2.5 ml-0.5 text-emerald-600" />
                              <span>GPS</span>
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 font-bold mt-0.5">
                          {addr.full_name} ({addr.phone})
                        </p>
                        <p className="text-slate-500 text-[11px] truncate mt-0.5">
                          {addr.governorate_name}، {addr.markaz_name} - {addr.detailed_address}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Delivery Notes Field */}
          <div>
            <label className="block text-xs font-black text-slate-800 mb-1">
              ملاحظات التوصيل (اختياري)
            </label>
            <textarea
              rows={2}
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder='مثال: "سأكون متواجدًا الساعة 2 PM" أو "طلب عاجل"'
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Governorate Warning Banner if Delivery is Disabled */}
          {!resolvedGovFee.allowed && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 space-x-reverse text-rose-700 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 ml-1.5" />
              <span>{resolvedGovFee.reason || 'خدمة التوصيل غير مفعلة حالياً في هذه المحافظة.'}</span>
            </div>
          )}

          {/* Cost Summary Breakdown */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>قيمة المنتجات بالفاتورة ({products.length} أصناف)</span>
              <span className="font-bold font-mono">
                {subtotal.toFixed(2)} {budgetConfig.currency}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <span>رسوم التوصيل للمنزل</span>
                {resolvedGovFee.source === 'governorate' && (
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-bold mr-1">
                    محافظة {addresses.find((a) => a.id === selectedAddressId)?.governorate_name}
                  </span>
                )}
                {resolvedGovFee.source === 'default' && (
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-medium mr-1">
                    السعر الافتراضي العام
                  </span>
                )}
              </div>
              <span className="font-bold font-mono text-emerald-700">
                +{deliveryFee.toFixed(2)} {budgetConfig.currency}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-slate-900 font-black text-sm">
              <span>إجمالي المصروف المتوقع (منتجات + توصيل)</span>
              <span className="text-blue-700 font-mono text-base">
                {totalAmount.toFixed(2)} {budgetConfig.currency}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end space-x-2.5 space-x-reverse shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirmOrder}
            disabled={!isDeliveryEnabled || !resolvedGovFee.allowed || isSubmitting || addresses.length === 0}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5 space-x-reverse"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري إرسال الطلب...</span>
              </>
            ) : (
              <>
                <Truck className="w-4 h-4 ml-1" />
                <span>تأكيد طلب التوصيل وحفظ الفاتورة</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Map Location Picker */}
      <MapLocationPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        onConfirm={(lat, lng) => {
          setNewLatitude(lat);
          setNewLongitude(lng);
          setLocationErrorNewAddress(null);
        }}
        initialLat={newLatitude}
        initialLng={newLongitude}
        governorateName={selectedGovName}
        title="تحديد موقع عنوان التوصيل على الخريطة"
      />
    </div>
  );
};
