import React, { useState } from 'react';
import { useFood } from '../context/FoodContext';
import { FoodOrder } from '../types/foodTypes';
import {
  Bike,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ShoppingBag,
  Store,
  RefreshCw,
  AlertCircle,
  FileText,
} from 'lucide-react';

export const FoodOrdersView: React.FC = () => {
  const { orders, isLoadingOrders, setSelectedOrderForDetail, refreshOrders, setCurrentView } = useFood();
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');

  const activeOrders = orders.filter(
    (o) =>
      o.orderStatus !== 'delivered' &&
      o.orderStatus !== 'cancelled' &&
      o.orderStatus !== 'rejected_by_restaurant'
  );

  const pastOrders = orders.filter(
    (o) =>
      o.orderStatus === 'delivered' ||
      o.orderStatus === 'cancelled' ||
      o.orderStatus === 'rejected_by_restaurant'
  );

  const currentList = activeTab === 'active' ? activeOrders : pastOrders;

  return (
    <div className="space-y-4 animate-in fade-in duration-150 text-right">
      
      {/* View Header with Tabs */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900">
              طلباتي من المطاعم
            </h2>
            <p className="text-[11px] text-slate-500">
              متابعة حالة الوجبات وتتبع خط سير المندوب والفواتير
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refreshOrders()}
          className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors"
          title="تحديث الطلبات"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingOrders ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Segmented Controls: Active vs Past */}
      <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 space-x-reverse ${
            activeTab === 'active'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bike className="w-3.5 h-3.5 ml-1" />
          <span>الطلبات الجارية ({activeOrders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('past')}
          className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 space-x-reverse ${
            activeTab === 'past'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5 ml-1" />
          <span>السجل والسابقة ({pastOrders.length})</span>
        </button>
      </div>

      {/* Orders List */}
      {isLoadingOrders ? (
        <div className="py-16 text-center space-y-2">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-bold">جاري تحميل طلباتك...</p>
        </div>
      ) : currentList.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-slate-200 p-6">
          <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-black text-slate-800">
            {activeTab === 'active' ? 'لا توجد طلبات جارية حالياً' : 'لا توجد طلبات سابقة حتى الآن'}
          </h4>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            استكشف المطاعم والأكلات المتوفرة واستمتع بوجباتك المفضلة حتى باب بيتك.
          </p>
          <button
            type="button"
            onClick={() => setCurrentView('home')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs"
          >
            تصفح المطاعم واطلب الآن
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {currentList.map((order) => {
            const isDelivered = order.orderStatus === 'delivered';
            const isCancelled = order.orderStatus === 'cancelled' || order.orderStatus === 'rejected_by_restaurant';

            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrderForDetail(order)}
                className="bg-white rounded-3xl border border-slate-200 p-4 shadow-2xs hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer space-y-3 group"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5 space-x-reverse">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5 space-x-reverse">
                        <h3 className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {order.restaurantName}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-mono">
                          #{order.id}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {new Date(order.createdAt).toLocaleDateString('ar-EG', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 ${
                      isDelivered
                        ? 'bg-emerald-100 text-emerald-800'
                        : isCancelled
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-900 animate-pulse'
                    }`}
                  >
                    {isDelivered
                      ? 'تم التوصيل'
                      : isCancelled
                      ? 'ملغي / غير متوفر'
                      : order.orderStatus === 'out_for_delivery'
                      ? 'مع المندوب'
                      : 'قيد التجهيز'}
                  </span>
                </div>

                {/* Items Summary */}
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="line-clamp-1 font-medium">
                      {order.items.map((i) => `${i.quantity}× ${i.name}`).join(' ، ')}
                    </span>
                    <span className="text-slate-400 text-[10px] shrink-0 font-mono mr-2">
                      ({order.items.length} أصناف)
                    </span>
                  </div>

                  {order.driver && (
                    <div className="pt-1 text-[10px] text-emerald-800 font-bold flex items-center space-x-1 space-x-reverse border-t border-slate-200/60">
                      <Bike className="w-3 h-3 text-emerald-600 ml-1" />
                      <span>المندوب: {order.driver.name} ({order.driver.phone})</span>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="flex items-baseline space-x-1.5 space-x-reverse">
                    <span className="text-slate-500 text-[11px]">المبلغ المطلوب:</span>
                    <span className="text-sm font-black text-slate-900 font-mono">
                      {order.totalAmount.toFixed(2)} ج.م
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 text-emerald-700 font-black text-xs group-hover:-translate-x-1 transition-transform">
                    <span>تتبع وحالة الطلب</span>
                    <ChevronLeft className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
