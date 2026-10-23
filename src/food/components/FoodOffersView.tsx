import React, { useState, useEffect } from 'react';
import { useFood } from '../context/FoodContext';
import { FoodOffer } from '../types/foodTypes';
import { foodService } from '../services/foodService';
import { Sparkles, ArrowRight, Tag, ChevronLeft, Store } from 'lucide-react';

export const FoodOffersView: React.FC = () => {
  const { navigateToRestaurant, setCurrentView } = useFood();
  const [offers, setOffers] = useState<FoodOffer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    foodService.getRestaurantOffers().then((data) => {
      setOffers(data);
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4 animate-in fade-in duration-150 text-right">
      
      {/* View Header */}
      <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-emerald-700 text-white rounded-3xl p-4 sm:p-5 shadow-sm relative overflow-hidden flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5 space-x-reverse">
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span className="text-xs font-bold text-amber-100 uppercase tracking-wider">
              عروض وتوفير أكلات البيت
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-white">
            أقوى وجبات الكومبو والخصومات الحصرية
          </h2>
          <p className="text-xs text-white/80">
            خصومات حقيقية على المشويات، البيتزا، الشاورما، والمأكولات البحرية
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCurrentView('home')}
          className="px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold backdrop-blur-md transition-colors"
        >
          كل المطاعم
        </button>
      </div>

      {/* Offers Cards List */}
      {isLoading ? (
        <div className="py-16 text-center space-y-2">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-bold">جاري تحميل العروض...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {offers.map((offer) => (
            <div
              key={offer.id}
              onClick={() => navigateToRestaurant(offer.restaurantId)}
              className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md hover:border-emerald-500 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                <img
                  src={offer.bannerUrl}
                  alt={offer.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-transparent" />

                <div className="absolute top-3 right-3">
                  <span className="px-3 py-1 rounded-xl text-xs font-black bg-rose-600 text-white shadow-md flex items-center space-x-1 space-x-reverse">
                    <Tag className="w-3 h-3 ml-0.5" />
                    <span>{offer.badge}</span>
                  </span>
                </div>

                <div className="absolute bottom-3 right-3 left-3 text-white">
                  <span className="text-[10px] text-emerald-300 font-bold block mb-0.5">
                    {offer.restaurantName}
                  </span>
                  <h3 className="text-sm sm:text-base font-black leading-snug drop-shadow-md">
                    {offer.title}
                  </h3>
                </div>
              </div>

              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {offer.description}
                </p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                  <span className="text-[11px] text-slate-400">
                    {offer.validUntil}
                  </span>

                  <button
                    type="button"
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-black flex items-center space-x-1 space-x-reverse group-hover:bg-emerald-600 group-hover:text-white transition-colors"
                  >
                    <span>طلب العرض من المطعم</span>
                    <ChevronLeft className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
