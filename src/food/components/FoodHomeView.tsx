import React, { useState, useMemo } from 'react';
import { useFood } from '../context/FoodContext';
import { FOOD_CUISINES } from '../mockData/foodMockData';
import { RestaurantCard } from './RestaurantCard';
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  MapPin,
  Clock,
  Star,
  Tag,
  Lock,
  Bike,
  Heart,
  ChevronLeft,
  X,
  Compass,
} from 'lucide-react';

export const FoodHomeView: React.FC = () => {
  const {
    restaurants,
    isLoadingRestaurants,
    filters,
    setFilters,
    setCurrentView,
    navigateToRestaurant,
  } = useFood();

  const [showFiltersModal, setShowFiltersModal] = useState<boolean>(false);
  const [nearbyOnly, setNearbyOnly] = useState<boolean>(false);

  // Active filters count
  const activeFiltersCount =
    (filters.cuisine && filters.cuisine !== 'الكل' ? 1 : 0) +
    (filters.onlyOpen ? 1 : 0) +
    (filters.maxDeliveryTime ? 1 : 0) +
    (filters.hasDiscount ? 1 : 0) +
    (filters.minRating ? 1 : 0) +
    (nearbyOnly ? 1 : 0);

  // Displayed restaurants after nearby toggle
  const displayedRestaurants = useMemo(() => {
    let list = [...restaurants];
    if (nearbyOnly) {
      // Nearby: within 2.5 km
      list = list.filter((r) => r.distanceKm <= 2.5);
    }
    return list;
  }, [restaurants, nearbyOnly]);

  return (
    <div className="space-y-4 animate-in fade-in duration-150 text-right">
      
      {/* 1. Hero Promo Banner */}
      <div className="bg-gradient-to-l from-emerald-800 via-emerald-700 to-teal-800 text-white rounded-3xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="relative z-10 space-y-2 max-w-xl">
          <div className="inline-flex items-center space-x-1.5 space-x-reverse px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-emerald-100 text-[11px] font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>قسم الأكلات الجاهزة ومطاعم البيت</span>
          </div>

          <h2 className="text-lg sm:text-2xl font-black text-white leading-tight">
            أشهى الأكلات والمطاعم.. توصل لحد باب بيتك ساخنة!
          </h2>

          <p className="text-xs text-emerald-100/90 leading-relaxed">
            مشويات، بيتزا وفطير، شاورما، كشري، مأكولات بحرية، وحلويات من أفضل مطاعم منطقتك بتوصيل معتمد ودفع عند الاستلام.
          </p>

          <div className="pt-1 flex items-center space-x-2 space-x-reverse flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCurrentView('offers')}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black rounded-xl text-xs transition-all shadow-md shadow-amber-400/20 active:scale-95 flex items-center space-x-1 space-x-reverse"
            >
              <Tag className="w-3.5 h-3.5 ml-1" />
              <span>استكشف عروض اليوم والكومبو</span>
            </button>

            <button
              type="button"
              onClick={() => setNearbyOnly(!nearbyOnly)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                nearbyOnly
                  ? 'bg-white text-emerald-900 border-white font-black'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
            >
              <Compass className="w-3.5 h-3.5 ml-1 inline" />
              <span>{nearbyOnly ? 'عرض كل المطاعم' : 'المطاعم الأقرب لك (< 2.5 كم)'}</span>
            </button>
          </div>
        </div>

        {/* Decorative corner glow */}
        <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-emerald-500/30 blur-2xl pointer-events-none" />
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex items-center space-x-2 space-x-reverse">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            value={filters.searchQuery || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
            placeholder="ابحث عن مطعم، كباب، بيتزا، شاورما، حواوشي..."
            className="w-full pr-10 pl-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs"
          />
          {filters.searchQuery && (
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, searchQuery: '' }))}
              className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters Toggle Button */}
        <button
          type="button"
          onClick={() => setShowFiltersModal(true)}
          className={`px-3 py-2.5 rounded-2xl border text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition-all shadow-2xs ${
            activeFiltersCount > 0
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-emerald-600 ml-1" />
          <span>تصفية</span>
          {activeFiltersCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center mr-1">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* 3. Cuisines Chips Slider */}
      <div className="flex items-center space-x-2 space-x-reverse overflow-x-auto pb-1.5 scrollbar-none">
        {FOOD_CUISINES.map((cuisine) => {
          const isSelected = (filters.cuisine || 'الكل') === cuisine;
          return (
            <button
              key={cuisine}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, cuisine }))}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-2xs cursor-pointer ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-emerald-600/20 scale-102'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {cuisine}
            </button>
          );
        })}
      </div>

      {/* 4. Filter chips quick tags */}
      <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => setFilters((prev) => ({ ...prev, onlyOpen: !prev.onlyOpen }))}
          className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
            filters.onlyOpen
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          مفتوح الآن فقط
        </button>

        <button
          type="button"
          onClick={() => setFilters((prev) => ({ ...prev, hasDiscount: !prev.hasDiscount }))}
          className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
            filters.hasDiscount
              ? 'bg-rose-600 text-white border-rose-600'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          عروض وخصومات %
        </button>

        <button
          type="button"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              maxDeliveryTime: prev.maxDeliveryTime === 25 ? undefined : 25,
            }))
          }
          className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
            filters.maxDeliveryTime === 25
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          توصيل سريع (&le; 25 دقيقة)
        </button>

        <button
          type="button"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              minRating: prev.minRating === 4.7 ? undefined : 4.7,
            }))
          }
          className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
            filters.minRating === 4.7
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          الأعلى تقييماً (4.7+)
        </button>

        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setFilters({ cuisine: 'الكل', sortBy: 'recommended' });
              setNearbyOnly(false);
            }}
            className="text-[11px] text-rose-600 font-bold hover:underline px-1"
          >
            مسح الكل
          </button>
        )}
      </div>

      {/* 5. Restaurants List Section Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center space-x-2 space-x-reverse">
          <h3 className="text-sm font-black text-slate-900">
            {nearbyOnly ? 'المطاعم القريبة من موقعك' : 'كل المطاعم المتاحة'}
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            ({displayedRestaurants.length} مطعم)
          </span>
        </div>

        {/* Sort by dropdown */}
        <select
          value={filters.sortBy || 'recommended'}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              sortBy: e.target.value as any,
            }))
          }
          className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
        >
          <option value="recommended">المقترح والمميز</option>
          <option value="rating">الأعلى تقييماً</option>
          <option value="prepTime">الأسرع تحضيراً</option>
          <option value="deliveryFee">الأقل رسوم توصيل</option>
        </select>
      </div>

      {/* 6. Restaurants Cards Grid */}
      {isLoadingRestaurants ? (
        <div className="py-20 text-center space-y-2">
          <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-bold">جاري تحميل المطاعم...</p>
        </div>
      ) : displayedRestaurants.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-slate-200 p-6">
          <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-black text-slate-800">
            لم نجد مطاعم مطابقة لبحثك أو الفلاتر المختارة
          </h4>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            جرّب تغيير كلمات البحث، أو إلغاء بعض الفلاتر لعرض مزيد من المطاعم المتاحة في منطقتك.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilters({ cuisine: 'الكل', sortBy: 'recommended' });
              setNearbyOnly(false);
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs"
          >
            إعادة تعيين كل الفلاتر
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedRestaurants.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </div>
      )}

      {/* 7. Comprehensive Filters Modal */}
      {showFiltersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-sm font-black text-slate-900">
                تصفية وترتيب المطاعم
              </span>
              <button
                type="button"
                onClick={() => setShowFiltersModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Status */}
              <div>
                <span className="font-bold text-slate-800 block mb-1.5">حالة المطعم</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFilters((p) => ({ ...p, onlyOpen: false }))}
                    className={`py-2 px-3 rounded-xl border font-bold ${
                      !filters.onlyOpen
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    كل المطاعم
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilters((p) => ({ ...p, onlyOpen: true }))}
                    className={`py-2 px-3 rounded-xl border font-bold ${
                      filters.onlyOpen
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    مفتوح للطلب الآن
                  </button>
                </div>
              </div>

              {/* Min rating */}
              <div>
                <span className="font-bold text-slate-800 block mb-1.5">التقييم الأدنى</span>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 4.5, 4.8].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() =>
                        setFilters((p) => ({
                          ...p,
                          minRating: rating === 0 ? undefined : rating,
                        }))
                      }
                      className={`py-2 px-2.5 rounded-xl border font-bold ${
                        (filters.minRating || 0) === rating
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {rating === 0 ? 'أي تقييم' : `${rating}+ نجوم`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick checkboxes */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(filters.hasDiscount)}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, hasDiscount: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-slate-700">المطاعم التي لديها عروض وخصومات</span>
                </label>

                <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nearbyOnly}
                    onChange={(e) => setNearbyOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-slate-700">المطاعم القريبة فقط (&lt; 2.5 كم)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 space-x-reverse pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setFilters({ cuisine: 'الكل', sortBy: 'recommended' });
                  setNearbyOnly(false);
                }}
                className="px-3.5 py-2 text-slate-500 font-bold hover:text-slate-800 text-xs"
              >
                مسح الفلاتر
              </button>
              <button
                type="button"
                onClick={() => setShowFiltersModal(false)}
                className="px-5 py-2 bg-emerald-600 text-white font-black rounded-xl text-xs hover:bg-emerald-700"
              >
                تطبيق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
