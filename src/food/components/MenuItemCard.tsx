import React, { useMemo, useState } from 'react';
import { MenuItem } from '../types/foodTypes';
import { useFood } from '../context/FoodContext';
import { Plus, Heart, Check } from 'lucide-react';

interface Props {
  item: MenuItem;
  restaurantIsOpen: boolean;
  viewMode?: 'grid' | 'list';
}

export const MenuItemCard: React.FC<Props> = ({
  item,
  restaurantIsOpen,
  viewMode = 'grid',
}) => {
  const {
    setCustomizingItem,
    isMenuItemFavorite,
    toggleFavoriteMenuItem,
    cartItems,
    addToCart,
  } = useFood();

  const [isAdding, setIsAdding] = useState(false);
  const isFav = isMenuItemFavorite(item.id);

  // Check if item has required customization options
  const hasRequiredOptions = useMemo(() => {
    return (
      item.optionGroups &&
      item.optionGroups.length > 0 &&
      item.optionGroups.some((g) => g.isRequired || g.minSelection > 0)
    );
  }, [item.optionGroups]);

  // Check if item is already in cart
  const cartItem = useMemo(() => {
    return cartItems.find((ci) => ci.menuItemId === item.id);
  }, [cartItems, item.id]);

  const isInCart = Boolean(cartItem && cartItem.quantity > 0);

  // Handle click on Add button
  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAdding) return;

    if (hasRequiredOptions) {
      // Must customize options
      setCustomizingItem(item);
    } else {
      // Direct add to cart
      setIsAdding(true);
      addToCart(item, 1, []);
      setTimeout(() => {
        setIsAdding(false);
      }, 350);
    }
  };

  // Grid view (Vertical card, 2 per row on mobile)
  if (viewMode === 'grid') {
    return (
      <div
        onClick={() => setCustomizingItem(item)}
        className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md hover:border-emerald-400/80 transition-all cursor-pointer flex flex-col justify-between group relative h-full"
      >
        <div>
          {/* Item Thumbnail */}
          <div className="relative aspect-square sm:aspect-4/3 w-full overflow-hidden bg-slate-100">
            <img
              src={item.imageUrl}
              alt={item.name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {item.isOffer && (
              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-rose-600 text-white shadow-xs">
                عرض
              </span>
            )}
            {/* Favorite button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavoriteMenuItem(item.id);
              }}
              className="absolute top-2 left-2 p-1.5 rounded-full bg-white/80 backdrop-blur-xs text-slate-500 hover:text-rose-500 hover:bg-white transition-colors cursor-pointer"
              aria-label={isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  isFav ? 'fill-rose-500 text-rose-500' : ''
                }`}
              />
            </button>
          </div>

          {/* Details */}
          <div className="p-2.5 sm:p-3 space-y-1">
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
              {item.name}
            </h4>

            <p className="text-[10px] sm:text-[11px] text-slate-500 line-clamp-2 leading-relaxed h-7 sm:h-8">
              {item.description}
            </p>
          </div>
        </div>

        {/* Pricing & Add Action */}
        <div className="p-2.5 sm:p-3 pt-0 flex items-center justify-between gap-1 mt-auto">
          <div className="flex items-baseline space-x-1 space-x-reverse min-w-0">
            <span className="text-xs sm:text-sm font-black text-emerald-800 font-mono truncate">
              {item.price.toFixed(2)} ج.م
            </span>
            {item.originalPrice && (
              <span className="text-[9px] text-slate-400 line-through font-mono hidden sm:inline">
                {item.originalPrice.toFixed(2)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddClick}
            disabled={isAdding}
            aria-label={
              isInCart
                ? `تمت إضافة ${item.name} إلى السلة`
                : `إضافة ${item.name} إلى السلة`
            }
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-[11px] font-bold flex items-center space-x-1 space-x-reverse transition-all shrink-0 cursor-pointer active:scale-95 ${
              isInCart
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 shadow-2xs'
            }`}
          >
            {isInCart ? (
              <>
                <Check className="w-3 h-3 ml-0.5" />
                <span>تمت الإضافة 🛒</span>
              </>
            ) : (
              <>
                <Plus className="w-3 h-3 ml-0.5" />
                <span>إضافة</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // List view (Horizontal layout)
  return (
    <div
      onClick={() => setCustomizingItem(item)}
      className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md hover:border-emerald-400/80 transition-all cursor-pointer flex flex-col justify-between group relative"
    >
      <div className="p-3 sm:p-3.5 flex gap-3 items-start">
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
              className="text-slate-400 hover:text-rose-500 p-0.5 shrink-0 cursor-pointer"
              aria-label={isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  isFav ? 'fill-rose-500 text-rose-500' : ''
                }`}
              />
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
              onClick={handleAddClick}
              disabled={isAdding}
              aria-label={
                isInCart
                  ? `تمت إضافة ${item.name} إلى السلة`
                  : `إضافة ${item.name} إلى السلة`
              }
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center space-x-1 space-x-reverse transition-all shrink-0 cursor-pointer active:scale-95 ${
                isInCart
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 shadow-2xs'
              }`}
            >
              {isInCart ? (
                <>
                  <Check className="w-3.5 h-3.5 ml-0.5" />
                  <span>تمت الإضافة 🛒</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 ml-0.5" />
                  <span>إضافة</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
