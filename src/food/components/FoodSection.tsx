import React from 'react';
import { FoodProvider, useFood } from '../context/FoodContext';
import { FoodHomeView } from './FoodHomeView';
import { RestaurantDetailView } from './RestaurantDetailView';
import { FoodOrdersView } from './FoodOrdersView';
import { FoodOffersView } from './FoodOffersView';
import { FoodFavoritesView } from './FoodFavoritesView';
import { ItemCustomizerModal } from './ItemCustomizerModal';
import { FoodCartDrawer } from './FoodCartDrawer';
import { FoodCheckoutModal } from './FoodCheckoutModal';
import { FoodOrderDetailModal } from './FoodOrderDetailModal';
import {
  UtensilsCrossed,
  ArrowRight,
  ShoppingBag,
  Sparkles,
  Heart,
  Clock,
  Store,
  Tag,
  Bike,
  AlertCircle,
} from 'lucide-react';

interface FoodSectionProps {
  onBackToHome: () => void;
}

const FoodSectionInner: React.FC<FoodSectionProps> = ({ onBackToHome }) => {
  const {
    currentView,
    setCurrentView,
    customizingItem,
    setCustomizingItem,
    setIsCartDrawerOpen,
    totalCartItemCount,
    cartRestaurantGroups,
    orders,
    favoriteRestaurantIds,
    selectedOrderForDetail,
    setSelectedOrderForDetail,
    navigateBackToFoodHome,
    isSectionDisabled,
    isLoadingSectionSettings,
    sectionSettings,
    geoScopeResult,
  } = useFood();

  const activeOrdersCount = orders.filter(
    (o) =>
      o.orderStatus !== 'delivered' &&
      o.orderStatus !== 'cancelled' &&
      o.orderStatus !== 'rejected_by_restaurant'
  ).length;

  const totalCartPrice = cartRestaurantGroups.reduce((sum, g) => sum + g.total, 0);

  // 1. Explicit Loading State: Prevent rendering misleading disabled state before settings load
  if (isLoadingSectionSettings) {
    return (
      <div className="py-24 text-center space-y-4 animate-in fade-in duration-200">
        <div className="w-9 h-9 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-600">جاري التحقق من إعدادات قسم المطاعم والتغطية الجغرافية...</p>
      </div>
    );
  }

  // 2. Hidden Section Visibility Rule: Never show section content if section_visibility === 'hidden'
  if (sectionSettings?.section_visibility === 'hidden') {
    return (
      <div className="py-20 text-center space-y-4 bg-white rounded-3xl border border-slate-200 p-6 text-right">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6 text-slate-500" />
        </div>
        <h3 className="text-base font-bold text-slate-800 text-center">قسم الأكلات الجاهزة غير متاح حالياً</h3>
        <p className="text-xs text-slate-500 text-center max-w-sm mx-auto">
          تم حجب هذا القسم مؤقتاً بقرار من الإدارة.
        </p>
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onBackToHome}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-700 transition-colors"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  // 3. Disabled Mode 'hide': If disabled and configured to hide completely
  if (isSectionDisabled && sectionSettings?.disabled_display_mode === 'hide') {
    return (
      <div className="py-20 text-center space-y-4 bg-white rounded-3xl border border-slate-200 p-6 text-right">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200">
          <AlertCircle className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-base font-bold text-slate-800 text-center">
          {sectionSettings?.status_message || geoScopeResult?.reason || 'قسم المطاعم معطل، سيتم التشغيل لاحقًا'}
        </h3>
        <p className="text-xs text-slate-500 text-center max-w-sm mx-auto">
          تصفح المطاعم متوقف حالياً وفق إعدادات الإدارة أو خارج النطاق الجغرافي المخدوم.
        </p>
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onBackToHome}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-700 transition-colors"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 text-right ${isSectionDisabled && sectionSettings?.disabled_display_mode === 'grayscale' ? 'grayscale contrast-95 opacity-90' : ''}`}>
      {/* Section Disabled Alert Banner (for show_disabled and grayscale modes) */}
      {isSectionDisabled && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-2xl flex items-center space-x-2.5 space-x-reverse text-xs font-bold animate-in fade-in shadow-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {sectionSettings?.status_message ||
              geoScopeResult?.reason ||
              'قسم الأكلات الجاهزة والمطاعم معطل حالياً بقرار من الإدارة لأعمال الصيانة والتحديث. تصفح القوائم متاح للمعاينة فقط.'}
          </span>
        </div>
      )}

      {/* Top Application Bar with Return to Household & Food Nav */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button
          type="button"
          onClick={onBackToHome}
          className="flex items-center space-x-1.5 space-x-reverse text-xs font-bold text-slate-700 hover:text-emerald-700 bg-white px-3.5 py-2 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للرئيسية</span>
        </button>

        {/* Section Title Pill */}
        <div className="flex items-center space-x-2 space-x-reverse bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-1.5 rounded-2xl text-xs font-black">
          <UtensilsCrossed className="w-4 h-4 text-emerald-600 ml-1" />
          <span>قسم الأكلات الجاهزة ومطاعم التوصيل</span>
        </div>

        {/* Cart Quick Button in Top Bar */}
        <button
          type="button"
          onClick={() => setIsCartDrawerOpen(true)}
          className="relative px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl text-xs font-black flex items-center space-x-1.5 space-x-reverse transition-all shadow-md shadow-emerald-600/20"
        >
          <ShoppingBag className="w-4 h-4 ml-1" />
          <span>السلة</span>
          {totalCartItemCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black flex items-center justify-center mr-1">
              {totalCartItemCount}
            </span>
          )}
        </button>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-1.5 flex items-center justify-between overflow-x-auto shadow-2xs gap-1">
        <button
          type="button"
          onClick={navigateBackToFoodHome}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 space-x-reverse whitespace-nowrap ${
            currentView === 'home' || currentView === 'restaurant'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Store className="w-3.5 h-3.5 ml-1" />
          <span>المطاعم</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentView('offers')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 space-x-reverse whitespace-nowrap ${
            currentView === 'offers'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Tag className="w-3.5 h-3.5 ml-1" />
          <span>العروض والوجبات</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentView('orders')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 space-x-reverse whitespace-nowrap relative ${
            currentView === 'orders'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Bike className="w-3.5 h-3.5 ml-1" />
          <span>طلباتي</span>
          {activeOrdersCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center mr-1">
              {activeOrdersCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setCurrentView('favorites')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 space-x-reverse whitespace-nowrap ${
            currentView === 'favorites'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Heart className="w-3.5 h-3.5 ml-1" />
          <span>المفضلة</span>
          {favoriteRestaurantIds.length > 0 && (
            <span className="text-[10px] text-slate-400 font-mono mr-1">
              ({favoriteRestaurantIds.length})
            </span>
          )}
        </button>
      </div>

      {/* Main Sub-view Content */}
      <div className="pt-1">
        {currentView === 'home' && <FoodHomeView />}
        {currentView === 'restaurant' && <RestaurantDetailView />}
        {currentView === 'orders' && <FoodOrdersView />}
        {currentView === 'offers' && <FoodOffersView />}
        {currentView === 'favorites' && <FoodFavoritesView />}
      </div>

      {/* Floating Bottom Cart Bar if items exist */}
      {totalCartItemCount > 0 && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 animate-in slide-in-from-bottom duration-300">
          <div
            onClick={() => setIsCartDrawerOpen(true)}
            className="bg-slate-900/95 hover:bg-slate-900 text-white rounded-3xl p-3.5 px-4 shadow-2xl backdrop-blur-md border border-white/20 flex items-center justify-between cursor-pointer transition-all active:scale-98"
          >
            <div className="flex items-center space-x-2 space-x-reverse">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white relative shadow-md">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black flex items-center justify-center">
                  {totalCartItemCount}
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-white block">
                  سلة أكلات البيت
                </span>
                <span className="text-[10px] text-slate-300">
                  {cartRestaurantGroups.length} {cartRestaurantGroups.length === 1 ? 'مطعم' : 'مطاعم'} • انقر لمعاينة وإتمام الطلب
                </span>
              </div>
            </div>

            <div className="text-left">
              <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono block">
                {totalCartPrice.toFixed(2)} ج.م
              </span>
              <span className="text-[10px] text-slate-300 font-bold">
                عرض السلة &larr;
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ItemCustomizerModal
        item={customizingItem}
        onClose={() => setCustomizingItem(null)}
      />
      <FoodCartDrawer />
      <FoodCheckoutModal />
      <FoodOrderDetailModal
        order={selectedOrderForDetail}
        onClose={() => setSelectedOrderForDetail(null)}
      />

    </div>
  );
};

export const FoodSection: React.FC<FoodSectionProps> = (props) => {
  return (
    <FoodProvider>
      <FoodSectionInner {...props} />
    </FoodProvider>
  );
};
