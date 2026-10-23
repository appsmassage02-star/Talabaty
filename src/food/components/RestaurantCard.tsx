import React from 'react';
import { Restaurant } from '../types/foodTypes';
import { useFood } from '../context/FoodContext';
import {
  Star,
  Clock,
  Bike,
  Heart,
  MapPin,
  ChevronLeft,
  Sparkles,
  Lock,
} from 'lucide-react';

interface Props {
  restaurant: Restaurant;
}

export const RestaurantCard: React.FC<Props> = ({ restaurant }) => {
  const { navigateToRestaurant, isRestaurantFavorite, toggleFavoriteRestaurant } = useFood();
  const isFav = isRestaurantFavorite(restaurant.id);

  return (
    <div
      onClick={() => navigateToRestaurant(restaurant.id)}
      className="group bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md hover:border-emerald-500/70 transition-all duration-300 cursor-pointer flex flex-col justify-between relative"
    >
      {/* Top Banner Image with Gradient & Badges */}
      <div className="relative h-40 sm:h-44 w-full overflow-hidden bg-slate-100">
        <img
          src={restaurant.bannerUrl}
          alt={restaurant.name}
          loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${
            !restaurant.isOpen ? 'grayscale contrast-95 opacity-80' : ''
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent" />

        {/* Favorite Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavoriteRestaurant(restaurant.id);
          }}
          className={`absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md shadow-md transition-all active:scale-90 ${
            isFav
              ? 'bg-rose-500 text-white'
              : 'bg-white/85 text-slate-700 hover:text-rose-500 hover:bg-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
        </button>

        {/* Open / Closed Status Stamp */}
        <div className="absolute top-3 right-3 flex items-center space-x-1.5 space-x-reverse">
          {restaurant.isOpen ? (
            <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-600/95 text-white shadow-sm backdrop-blur-xs flex items-center space-x-1 space-x-reverse border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse" />
              <span>مفتوح للطلب</span>
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-slate-900/90 text-white shadow-sm backdrop-blur-xs flex items-center space-x-1 space-x-reverse border border-white/20">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>مغلق حالياً</span>
            </span>
          )}

          {restaurant.isFeatured && restaurant.isOpen && (
            <span className="px-2 py-1 rounded-xl text-[10px] font-black bg-amber-500 text-white shadow-sm flex items-center space-x-1 space-x-reverse">
              <Sparkles className="w-3 h-3" />
              <span>مميز</span>
            </span>
          )}
        </div>

        {/* Discount Badge if available */}
        {restaurant.discountBadge && (
          <div className="absolute bottom-3 right-3">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-rose-600 text-white shadow-md flex items-center space-x-1 space-x-reverse">
              <span>{restaurant.discountBadge}</span>
            </span>
          </div>
        )}

        {/* Distance km badge */}
        <div className="absolute bottom-3 left-3">
          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-900/80 text-slate-100 backdrop-blur-xs flex items-center space-x-1 space-x-reverse">
            <MapPin className="w-2.5 h-2.5 text-emerald-400" />
            <span>{restaurant.distanceKm} كم</span>
          </span>
        </div>
      </div>

      {/* Restaurant Content Body */}
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5 flex-1">
              <h3 className="font-black text-sm text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                {restaurant.name}
              </h3>
              <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed">
                {restaurant.cuisineTypes.join(' • ')}
              </p>
            </div>

            {/* Rating */}
            <div className="flex items-center space-x-1 space-x-reverse px-2 py-1 bg-amber-50 border border-amber-200/80 rounded-xl shrink-0">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-black text-amber-900 font-mono">
                {restaurant.rating.toFixed(1)}
              </span>
              <span className="text-[10px] text-amber-700 font-medium">
                ({restaurant.reviewsCount})
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 line-clamp-2 mt-2 leading-relaxed">
            {restaurant.description}
          </p>
        </div>

        {/* Meta Bar: Prep Time, Delivery Fee, Delivery Channel */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
          <div className="flex items-center space-x-1 space-x-reverse text-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{restaurant.estimatedPrepTimeMinutes} دقيقة</span>
          </div>

          <div className="flex items-center space-x-1 space-x-reverse text-emerald-700 font-bold">
            <Bike className="w-3.5 h-3.5 text-emerald-600" />
            <span>توصيل {restaurant.deliveryFee} ج.م</span>
          </div>

          <div className="flex items-center space-x-0.5 text-emerald-700 font-black group-hover:-translate-x-0.5 transition-transform">
            <span>المنيو</span>
            <ChevronLeft className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};
