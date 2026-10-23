import React, { useState } from 'react';
import { useFood } from '../context/FoodContext';
import { FoodCustomerAddress } from '../types/foodTypes';
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
} from 'lucide-react';

export const FoodCheckoutModal: React.FC = () => {
  const {
    checkoutRestaurantGroup,
    closeCheckoutModal,
    addresses,
    submitRestaurantOrder,
    addNewAddress,
  } = useFood();

  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    addresses[0]?.id || ''
  );

  const [customerName, setCustomerName] = useState<string>('محمد أبو طالب');
  const [customerPhone, setCustomerPhone] = useState<string>('01012345678');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick Inline Address form state if adding a new address
  const [isAddingNewAddress, setIsAddingNewAddress] = useState<boolean>(false);
  const [newLabel, setNewLabel] = useState<string>('عنوان إضافي');
  const [newDetailedAddress, setNewDetailedAddress] = useState<string>('');
  const [newGovernorate, setNewGovernorate] = useState<string>('القاهرة');
  const [newMarkaz, setNewMarkaz] = useState<string>('مدينة نصر');
  const [newLat, setNewLat] = useState<number>(30.0524);
  const [newLng, setNewLng] = useState<number>(31.3412);

  if (!checkoutRestaurantGroup) return null;

  const restaurant = checkoutRestaurantGroup.restaurant;
  if (!restaurant) return null;

  const currentAddress =
    addresses.find((a) => a.id === selectedAddressId) || addresses[0];

  const handleSaveQuickAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDetailedAddress.trim()) return;

    const created = await addNewAddress({
      label: newLabel.trim() || 'عنوان جديد',
      recipientName: customerName,
      phone: customerPhone,
      governorate: newGovernorate,
      markaz: newMarkaz,
      detailedAddress: newDetailedAddress.trim(),
      latitude: newLat,
      longitude: newLng,
      isDefault: false,
    });

    setSelectedAddressId(created.id);
    setIsAddingNewAddress(false);
  };

  const handleConfirmOrder = async () => {
    if (isSubmitting) return; // Prevent double submission!

    setErrorMessage(null);

    if (!currentAddress) {
      setErrorMessage('يرجى اختيار أو إضافة عنوان توصيل.');
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
        customerName,
        customerPhone,
        address: currentAddress,
        notes: orderNotes,
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
          
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center space-x-2 space-x-reverse animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
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
              <form onSubmit={handleSaveQuickAddress} className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      تسمية العنوان
                    </label>
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="المنزل، الشغل"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      المحافظة والمركز
                    </label>
                    <input
                      type="text"
                      value={`${newGovernorate} - ${newMarkaz}`}
                      onChange={(e) => setNewMarkaz(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    العنوان التفصيلي (الشارع، رقم العمارة، الشقة)
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={newDetailedAddress}
                    onChange={(e) => setNewDetailedAddress(e.target.value)}
                    placeholder="شارع النصر، عمارة 5، شقة 12"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold resize-none"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 space-x-reverse pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewAddress(false)}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
                  >
                    حفظ العنوان
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
              <span>رسوم التوصيل الثابتة</span>
              <span className="font-mono font-bold">
                {checkoutRestaurantGroup.deliveryFee.toFixed(2)} ج.م
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-slate-900 font-black text-sm">
              <span>المبلغ الإجمالي النهائي</span>
              <span className="font-mono text-emerald-800 text-base">
                {checkoutRestaurantGroup.total.toFixed(2)} ج.م
              </span>
            </div>
          </div>

        </div>

        {/* Footer with Submit Button */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={closeCheckoutModal}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleConfirmOrder}
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center space-x-2 space-x-reverse shadow-lg shadow-emerald-600/25 transition-all"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin ml-1" />
                <span>جاري تسجيل الطلب...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 ml-1" />
                <span>تأكيد الطلب الآن ({checkoutRestaurantGroup.total.toFixed(2)} ج.م)</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
