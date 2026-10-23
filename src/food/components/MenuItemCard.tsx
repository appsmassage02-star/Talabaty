import React from 'react';
import { MenuItem } from '../types/foodTypes';
import { useFood } from '../context/FoodContext';
import { Plus, Heart, Clock, Sparkles } from 'lucide-react';

interface Props {
  item: MenuItem;
  restaurantIsOpen: boolean;
}

export const MenuItemCard: React.FC<Props> = ({ item, restaurantIsOpen }) => {
  const { setCustomizingItem, isMenuItemFavorite, toggleFavoriteMenuItem } = useFood();
  const isFav = isMenuItemFavorite(item.id);

  return (
    <div
      onClick={() => setCustomizingItem(item)}
      className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md hover:border-emerald-400/80 transition-all cursor-pointer flex flex-col justify-between group relative"
    >
      <div className="p-3.5 flex gap-3 items-start">
        {/* Item Thumbnail */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-slate-100 shrink-0">
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {item.isOffer && (
            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-rose-600 text-white shadow-xs">
              عرض
            </span>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-1">
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
              {item.name}
            </h4>

            {/* Favorite button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavoriteMenuItem(item.id);
              }}
              className="text-slate-400 hover:text-rose-500 p-0.5 shrink-0"
            >
              <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          </div>

          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
            {item.description}
          </p>

          {/* Pricing & Add Action */}
          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-baseline space-x-1.5 space-x-reverse">
              <span className="text-sm font-black text-emerald-800 font-mono">
                {item.price.toFixed(2)} ج.م
              </span>
              {item.originalPrice && (
                <span className="text-[10px] text-slate-400 line-through font-mono">
                  {item.originalPrice.toFixed(2)} ج.م
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCustomizingItem(item);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 text-[11px] font-bold flex items-center space-x-1 space-x-reverse transition-all shadow-2xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 ml-0.5" />
              <span>إضافة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
