import React, { useState } from 'react';
import { useFood } from '../context/FoodContext';
import { FoodOrder, FoodOrderStatus } from '../types/foodTypes';
import {
  X,
  Clock,
  CheckCircle2,
  Bike,
  Receipt,
  MapPin,
  Phone,
  AlertCircle,
  PhoneCall,
  User,
  Star,
  FileText,
  RotateCcw,
  Sparkles,
  Ban,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Props {
  order: FoodOrder | null;
  onClose: () => void;
}

export const FoodOrderDetailModal: React.FC<Props> = ({ order, onClose }) => {
  const { cancelOrder, updateOrderStatusForTesting } = useFood();

  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [showStatusTester, setShowStatusTester] = useState<boolean>(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);

  if (!order) return null;

  const isDirect = order.deliveryChannel === 'direct_system';

  // Map status to human-readable Arabic badge
  const getStatusBadge = (status: FoodOrderStatus) => {
    switch (status) {
      case 'pending_restaurant_confirmation':
        return {
          label: isDirect ? 'بانتظار قبول وتأكيد المطعم' : 'بانتظار تأكيد المندوب هاتفياً مع المطعم',
          bg: 'bg-amber-50',
          text: 'text-amber-800',
          border: 'border-amber-300',
        };
      case 'restaurant_accepted':
        return {
          label: 'تم قبول وتأكيد الطلب من المطعم',
          bg: 'bg-blue-50',
          text: 'text-blue-800',
          border: 'border-blue-300',
        };
      case 'preparing':
        return {
          label: 'قيد التجهيز في المطبخ',
          bg: 'bg-indigo-50',
          text: 'text-indigo-800',
          border: 'border-indigo-300',
        };
      case 'ready_for_pickup':
        return {
          label: 'جاهز للاستلام والتسليم للمندوب',
          bg: 'bg-purple-50',
          text: 'text-purple-800',
          border: 'border-purple-300',
        };
      case 'out_for_delivery':
        return {
          label: 'مع المندوب وفي الطريق إليك',
          bg: 'bg-emerald-50',
          text: 'text-emerald-800',
          border: 'border-emerald-300',
        };
      case 'delivered':
        return {
          label: 'تم التوصيل بنجاح',
          bg: 'bg-emerald-600',
          text: 'text-white',
          border: 'border-emerald-600',
        };
      case 'cancelled':
        return {
          label: 'تم إلغاء الطلب',
          bg: 'bg-slate-100',
          text: 'text-slate-600',
          border: 'border-slate-300',
        };
      case 'rejected_by_restaurant':
        return {
          label: 'اعتذر المطعم عن التنفيذ لعدم التوفر',
          bg: 'bg-rose-50',
          text: 'text-rose-800',
          border: 'border-rose-300',
        };
    }
  };

  const badge = getStatusBadge(order.orderStatus);

  // Steps definition for tracker
  const steps = [
    {
      id: 'step-1',
      title: 'تسجيل الطلب',
      desc: 'تم استلام طلبك بالنظام',
      isCompleted: true,
      isCurrent: order.orderStatus === 'pending_restaurant_confirmation',
    },
    {
      id: 'step-2',
      title: isDirect ? 'تأكيد المطعم' : 'التأكيد الهاتفي',
      desc: isDirect ? 'موافقة المطعم على التحضير' : 'اتصال المندوب وتأكيد توفر الوجبة',
      isCompleted:
        order.orderStatus !== 'pending_restaurant_confirmation' &&
        order.orderStatus !== 'cancelled' &&
        order.orderStatus !== 'rejected_by_restaurant',
      isCurrent: order.orderStatus === 'restaurant_accepted',
    },
    {
      id: 'step-3',
      title: 'تجهيز الطعام',
      desc: 'إعداد الوجبة بالمطبخ',
      isCompleted:
        order.orderStatus === 'preparing' ||
        order.orderStatus === 'ready_for_pickup' ||
        order.orderStatus === 'out_for_delivery' ||
        order.orderStatus === 'delivered',
      isCurrent: order.orderStatus === 'preparing' || order.orderStatus === 'ready_for_pickup',
    },
    {
      id: 'step-4',
      title: 'مع المندوب',
      desc: 'الطيار استلم الطلب وفي طريقه لك',
      isCompleted: order.orderStatus === 'out_for_delivery' || order.orderStatus === 'delivered',
      isCurrent: order.orderStatus === 'out_for_delivery',
    },
    {
      id: 'step-5',
      title: 'تم التوصيل',
      desc: 'بالهناء والشفاء',
      isCompleted: order.orderStatus === 'delivered',
      isCurrent: order.orderStatus === 'delivered',
    },
  ];

  const handleCancel = async () => {
    if (confirm('هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟')) {
      setIsCancelling(true);
      await cancelOrder(order.id);
      setIsCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        
        {/* Header */}
        <div className="px-4 py-3.5 sm:px-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 space-x-reverse">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Bike className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <h3 className="text-sm font-black text-white">
                  متابعة الطلب رقم {order.id}
                </h3>
                <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded-md">
                  {order.restaurantName}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {order.estimatedDeliveryTime}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Order Tracker Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-right">
          
          {/* Main Status Banner */}
          <div className={`p-3.5 rounded-2xl border ${badge.bg} ${badge.border} flex items-center justify-between`}>
            <div className="flex items-center space-x-2 space-x-reverse">
              <span className={`w-3 h-3 rounded-full ${order.orderStatus === 'delivered' ? 'bg-white' : 'bg-emerald-600 animate-ping'} shrink-0`} />
              <div>
                <span className={`text-xs font-black block ${badge.text}`}>
                  {badge.label}
                </span>
                <span className="text-[10px] text-slate-500">
                  مسار التوصيل: {isDirect ? 'مباشر عبر نظام المطعم الإلكتروني' : 'تأكيد هاتفي مباشر بواسطة المندوب'}
                </span>
              </div>
            </div>

            {order.invoiceIssued && (
              <button
                type="button"
                onClick={() => setShowInvoiceModal(!showInvoiceModal)}
                className="px-2.5 py-1.5 bg-white text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center space-x-1 space-x-reverse hover:bg-emerald-50 shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 ml-1" />
                <span>{showInvoiceModal ? 'إخفاء الفاتورة' : 'عرض الفاتورة'}</span>
              </button>
            )}
          </div>

          {/* Stepper Progress Timeline */}
          {order.orderStatus !== 'cancelled' && order.orderStatus !== 'rejected_by_restaurant' && (
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 space-y-3">
              <span className="text-xs font-black text-slate-900 block pb-1 border-b border-slate-200">
                مراحل تنفيذ وتوصيل الوجبة
              </span>

              <div className="space-y-3">
                {steps.map((st, idx) => (
                  <div key={st.id} className="flex items-start space-x-3 space-x-reverse relative">
                    {/* Circle icon */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                        st.isCompleted
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : st.isCurrent
                          ? 'bg-amber-500 border-amber-500 text-white animate-pulse'
                          : 'bg-white border-slate-300 text-slate-400'
                      }`}
                    >
                      {st.isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <span className="text-[10px] font-bold font-mono">{idx + 1}</span>
                      )}
                    </div>

                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black ${st.isCompleted ? 'text-slate-900' : 'text-slate-500'}`}>
                          {st.title}
                        </span>
                        {st.isCurrent && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            جاري الآن
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {st.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Official Invoice Preview when issued */}
          {showInvoiceModal && order.invoiceIssued && (
            <div className="p-4 bg-emerald-50/70 border-2 border-emerald-300 rounded-3xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                <div>
                  <span className="text-xs font-black text-emerald-950 block">
                    فاتورة مطعم رسمية {order.invoiceNumber}
                  </span>
                  <span className="text-[10px] text-emerald-700">
                    تم إصدار الفاتورة فور قبول المطعم للطلب
                  </span>
                </div>
                <span className="text-xs font-mono font-black text-emerald-900 bg-white px-2.5 py-1 rounded-xl border border-emerald-200">
                  {order.totalAmount.toFixed(2)} ج.م
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                {order.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between text-slate-700">
                    <span>
                      {it.quantity} × {it.name}
                    </span>
                    <span className="font-mono font-bold">{it.totalPrice.toFixed(2)} ج.م</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-slate-600">
                  <span>رسوم التوصيل</span>
                  <span className="font-mono">{order.deliveryFee.toFixed(2)} ج.م</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex items-center justify-between text-emerald-700 font-bold">
                    <span>الخصم</span>
                    <span className="font-mono">-{order.discount.toFixed(2)} ج.م</span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-emerald-300 flex items-center justify-between font-black text-emerald-950">
                  <span>المبلغ المطلوب نقداً</span>
                  <span className="font-mono text-sm">{order.totalAmount.toFixed(2)} ج.م</span>
                </div>
              </div>
            </div>
          )}

          {/* Driver Card if assigned */}
          {order.driver && (
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-2.5 space-x-reverse">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                  {order.driver.avatarUrl ? (
                    <img src={order.driver.avatarUrl} alt={order.driver.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-1.5 space-x-reverse">
                    <span className="text-xs font-black text-slate-900">{order.driver.name}</span>
                    <div className="flex items-center space-x-0.5 text-amber-500">
                      <Star className="w-3 h-3 fill-current" />
                      <span className="text-[10px] font-bold font-mono">{order.driver.rating}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {order.driver.vehicleType} • {order.driver.vehiclePlate || 'مركبة مرخصة'}
                  </span>
                </div>
              </div>

              <a
                href={`tel:${order.driver.phone}`}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center space-x-1 space-x-reverse"
              >
                <PhoneCall className="w-3.5 h-3.5 ml-1 text-emerald-600" />
                <span>اتصال</span>
              </a>
            </div>
          )}

          {/* Delivery Address & GPS preview */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>{order.address.label}</span>
              </div>
              <span dir="ltr" className="font-mono text-[10px] text-emerald-700 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                GPS: {order.address.latitude.toFixed(4)}, {order.address.longitude.toFixed(4)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {order.address.detailedAddress}
            </p>
          </div>

          {/* Items List */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <span className="text-xs font-black text-slate-900 block pb-1 border-b border-slate-100">
              الأصناف ({order.items.length})
            </span>
            <div className="space-y-1.5 divide-y divide-slate-100 text-xs">
              {order.items.map((it, idx) => (
                <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">
                      {it.quantity} × {it.name}
                    </span>
                    {it.selectedOptionsDescription && (
                      <p className="text-[10px] text-slate-500">
                        {it.selectedOptionsDescription}
                      </p>
                    )}
                    {it.notes && (
                      <p className="text-[10px] text-emerald-700">
                        ملاحظة: {it.notes}
                      </p>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-800">
                    {it.totalPrice.toFixed(2)} ج.م
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tester Helper: Simulate status changes */}
          <div className="border border-dashed border-amber-300 bg-amber-50/50 rounded-2xl p-3 space-y-2">
            <button
              type="button"
              onClick={() => setShowStatusTester(!showStatusTester)}
              className="w-full flex items-center justify-between text-xs font-black text-amber-900"
            >
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>محاكي حالات الطلب (لتجربة دورة حياة الطلب)</span>
              </div>
              {showStatusTester ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showStatusTester && (
              <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => updateOrderStatusForTesting(order.id, 'restaurant_accepted')}
                  className="p-1.5 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg font-bold text-blue-800"
                >
                  قبول المطعم
                </button>
                <button
                  type="button"
                  onClick={() => updateOrderStatusForTesting(order.id, 'preparing')}
                  className="p-1.5 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg font-bold text-indigo-800"
                >
                  قيد التجهيز
                </button>
                <button
                  type="button"
                  onClick={() => updateOrderStatusForTesting(order.id, 'ready_for_pickup')}
                  className="p-1.5 bg-white hover:bg-purple-50 border border-purple-200 rounded-lg font-bold text-purple-800"
                >
                  جاهز للاستلام
                </button>
                <button
                  type="button"
                  onClick={() => updateOrderStatusForTesting(order.id, 'out_for_delivery')}
                  className="p-1.5 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg font-bold text-emerald-800"
                >
                  مع المندوب
                </button>
                <button
                  type="button"
                  onClick={() => updateOrderStatusForTesting(order.id, 'delivered')}
                  className="p-1.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700"
                >
                  تم التوصيل
                </button>
                <button
                  type="button"
                  onClick={() => updateOrderStatusForTesting(order.id, 'rejected_by_restaurant')}
                  className="p-1.5 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg font-bold text-rose-800"
                >
                  اعتذار المطعم
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          {order.orderStatus === 'pending_restaurant_confirmation' && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-colors"
            >
              {isCancelling ? 'جاري الإلغاء...' : 'إلغاء الطلب'}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors text-center"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
