import React from 'react';
import { useFood } from '../context/FoodContext';
import { RestaurantCard } from './RestaurantCard';
import { Heart, ShoppingBag, ArrowRight } from 'lucide-react';

export const FoodFavoritesView: React.FC = () => {
  const { restaurants, favoriteRestaurantIds, setCurrentView } = useFood();

  const favRestaurants = restaurants.filter((r) =>
    favoriteRestaurantIds.includes(r.id)
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-150 text-right">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center space-x-2.5 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
            <Heart className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900">
              المطاعم المفضلة ({favRestaurants.length})
            </h2>
            <p className="text-[11px] text-slate-500">
              المطاعم التي قمت بحفظها لسرعة الوصول إليها وتكرار الطلب
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCurrentView('home')}
          className="text-xs font-bold text-emerald-700 hover:underline"
        >
          تصفح المزيد
        </button>
      </div>

      {favRestaurants.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-slate-200 p-6">
          <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Heart className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-black text-slate-800">
            قائمة المفضلة فارغة حالياً
          </h4>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            اضغط على علامة القلب في أي بطاقة مطعم لإضافته إلى قائمتك المفضلة والوصول السريع له دائماً.
          </p>
          <button
            type="button"
            onClick={() => setCurrentView('home')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs"
          >
            تصفح كل المطاعم
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favRestaurants.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </div>
      )}

    </div>
  );
};
