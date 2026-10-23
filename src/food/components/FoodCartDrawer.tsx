import React, { useState } from 'react';
import { useFood, FoodCartRestaurantGroup } from '../context/FoodContext';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  Bike,
  Sparkles,
  Lock,
  AlertTriangle,
  Info,
  Store,
} from 'lucide-react';

export const FoodCartDrawer: React.FC = () => {
  const {
    isCartDrawerOpen,
    setIsCartDrawerOpen,
    cartRestaurantGroups,
    totalCartItemCount,
    updateCartItemQuantity,
    removeCartItem,
    clearRestaurantCart,
    startCheckoutForRestaurant,
  } = useFood();

  // Price change simulation confirmation state
  const [acknowledgedChanges, setAcknowledgedChanges] = useState<Record<string, boolean>>({});

  if (!isCartDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-y-0 left-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-r border-slate-200">
          
          {/* Drawer Header */}
          <div className="px-4 py-3.5 sm:px-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2 space-x-reverse">
              <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">
                  سلة أكلات البيت
                </h3>
                <span className="text-[11px] text-slate-300">
                  {totalCartItemCount} {totalCartItemCount === 1 ? 'صنف' : totalCartItemCount === 2 ? 'صنفان' : 'أصناف'} في السلة
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCartDrawerOpen(false)}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Single restaurant per order rule banner */}
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-[11px] font-bold flex items-center space-x-2 space-x-reverse shrink-0">
            <Info className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              يتم تجميع الأصناف لكل مطعم على حدة، وتأكيد طلب كل مطعم بشكل مستقل.
            </span>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {cartRestaurantGroups.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-black text-slate-800">
                  السلة فارغة حالياً
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  تصفح مطاعم الأكلات الجاهزة المفضلة لديك وأضف أشهى الأطباق إلى سلتك.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-700 transition-colors"
                >
                  تصفح المطاعم الآن
                </button>
              </div>
            ) : (
              cartRestaurantGroups.map((group) => {
                const isRestaurantOpen = group.isOpen;

                return (
                  <div
                    key={group.restaurantId}
                    className="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-xs space-y-3"
                  >
                    {/* Restaurant Group Header */}
                    <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                          <Store className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 line-clamp-1">
                            {group.restaurantName}
                          </h4>
                          <div className="flex items-center space-x-1 space-x-reverse text-[10px]">
                            {isRestaurantOpen ? (
                              <span className="text-emerald-700 font-bold">مفتوح للطلب</span>
                            ) : (
                              <span className="text-rose-600 font-black flex items-center space-x-0.5">
                                <Lock className="w-2.5 h-2.5 ml-0.5" />
                                <span>المطعم مغلق حالياً</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => clearRestaurantCart(group.restaurantId)}
                        title="حذف أصناف هذا المطعم"
                        className="text-slate-400 hover:text-rose-600 p-1.5 transition-colors rounded-lg hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Group Closed Warning */}
                    {!isRestaurantOpen && (
                      <div className="mx-3.5 p-2.5 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 font-bold flex items-center space-x-2 space-x-reverse">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          المطعم مغلق الآن، تم الاحتفاظ بأصنافك وسيتاح الطلب فور فتح المطعم.
                        </span>
                      </div>
                    )}

                    {/* Group Items List */}
                    <div className="px-3.5 space-y-3 divide-y divide-slate-100">
                      {group.items.map((cartItem) => (
                        <div key={cartItem.cartItemId} className="pt-2 first:pt-0 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5 flex-1">
                              <span className="text-xs font-bold text-slate-900 block leading-snug">
                                {cartItem.name}
                              </span>
                              {cartItem.selectedOptions.length > 0 && (
                                <p className="text-[10px] text-slate-500 leading-tight">
                                  {cartItem.selectedOptions.map((o) => o.optionName).join(' + ')}
                                </p>
                              )}
                              {cartItem.notes && (
                                <p className="text-[10px] text-emerald-700 font-medium bg-emerald-50/80 px-2 py-0.5 rounded-md inline-block">
                                  ملاحظة: {cartItem.notes}
                                </p>
                              )}
                            </div>

                            <span className="text-xs font-black text-slate-900 font-mono shrink-0">
                              {(cartItem.unitPrice * cartItem.quantity).toFixed(2)} ج.م
                            </span>
                          </div>

                          {/* Item Quantity Controller */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-slate-400 font-mono">
                              {cartItem.unitPrice.toFixed(2)} × {cartItem.quantity}
                            </span>

                            <div className="flex items-center space-x-1.5 space-x-reverse bg-slate-100 rounded-xl p-0.5">
                              <button
                                type="button"
                                onClick={() =>
                                  updateCartItemQuantity(cartItem.cartItemId, cartItem.quantity - 1)
                                }
                                className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs transition-colors shadow-2xs"
                              >
                                {cartItem.quantity === 1 ? (
                                  <Trash2 className="w-3 h-3 text-rose-500" />
                                ) : (
                                  <Minus className="w-3 h-3" />
                                )}
                              </button>
                              <span className="w-6 text-center text-xs font-black font-mono">
                                {cartItem.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateCartItemQuantity(cartItem.cartItemId, cartItem.quantity + 1)
                                }
                                className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs transition-colors shadow-2xs"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Financial Summary per Restaurant Group */}
                    <div className="p-3.5 bg-slate-50/70 border-t border-slate-200 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>المجموع الفرعي للأصناف</span>
                        <span className="font-mono font-bold">{group.subtotal.toFixed(2)} ج.م</span>
                      </div>

                      {group.discount > 0 && (
                        <div className="flex items-center justify-between text-emerald-700 font-bold">
                          <span>خصم المطعم</span>
                          <span className="font-mono">-{group.discount.toFixed(2)} ج.م</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-slate-600">
                        <span>رسوم التوصيل المعتمدة</span>
                        <span className="font-mono font-bold">{group.deliveryFee.toFixed(2)} ج.م</span>
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-slate-900 font-black">
                        <span className="text-xs">الإجمالي المطلوب لمطعم {group.restaurantName}</span>
                        <span className="text-sm font-mono text-emerald-800">
                          {group.total.toFixed(2)} ج.م
                        </span>
                      </div>

                      {/* Independent Checkout Button for this Restaurant */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => startCheckoutForRestaurant(group.restaurantId)}
                          disabled={!isRestaurantOpen}
                          className={`w-full py-2.5 px-4 rounded-2xl text-xs font-black flex items-center justify-between transition-all shadow-md ${
                            isRestaurantOpen
                              ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white shadow-emerald-600/20'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                          }`}
                        >
                          <div className="flex items-center space-x-1.5 space-x-reverse">
                            <ShoppingBag className="w-4 h-4 ml-1" />
                            <span>
                              {isRestaurantOpen
                                ? `إتمام طلب (${group.restaurantName})`
                                : 'المطعم مغلق - لا يمكن الإتمام الآن'}
                            </span>
                          </div>
                          <span className="font-mono bg-black/20 px-2 py-0.5 rounded-lg text-xs">
                            {group.total.toFixed(2)} ج.م
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
