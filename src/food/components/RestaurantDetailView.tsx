import React, { useState, useEffect, useMemo } from 'react';
import { useFood } from '../context/FoodContext';
import { MenuItemCard } from './MenuItemCard';
import {
  ArrowRight,
  Star,
  Clock,
  Bike,
  Heart,
  Search,
  MapPin,
  Lock,
  Sparkles,
  Phone,
  Info,
  Tag,
  LayoutGrid,
  List,
} from 'lucide-react';
import { foodService } from '../services/foodService';
import { MenuItem } from '../types/foodTypes';

export const RestaurantDetailView: React.FC = () => {
  const {
    selectedRestaurantId,
    restaurants,
    navigateBackToFoodHome,
    isRestaurantFavorite,
    toggleFavoriteRestaurant,
  } = useFood();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [itemSearchQuery, setItemSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('talabaty_menu_view_mode');
      return saved === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleToggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('talabaty_menu_view_mode', mode);
    } catch {
      // ignore
    }
  };

  const restaurant = useMemo(() => {
    return restaurants.find((r) => r.id === selectedRestaurantId);
  }, [restaurants, selectedRestaurantId]);

  const isFav = restaurant ? isRestaurantFavorite(restaurant.id) : false;

  useEffect(() => {
    if (selectedRestaurantId) {
      setIsLoadingMenu(true);
      foodService.getRestaurantMenu(selectedRestaurantId).then((items) => {
        setMenuItems(items);
        setIsLoadingMenu(false);
      });
    }
  }, [selectedRestaurantId]);

  if (!restaurant) {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-sm text-slate-500">لم يتم العثور على المطعم المطلوب.</p>
        <button
          onClick={navigateBackToFoodHome}
          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
        >
          العودة لقائمة المطاعم
        </button>
      </div>
    );
  }

  // Filter menu items by search and category
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCat =
        selectedCategory === 'الكل' || item.category === selectedCategory;
      const q = itemSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [menuItems, selectedCategory, itemSearchQuery]);

  const allCategories = ['الكل', ...restaurant.menuCategories];

  return (
    <div className="space-y-4 animate-in fade-in duration-150 text-right">
      
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={navigateBackToFoodHome}
          className="flex items-center space-x-1.5 space-x-reverse text-xs font-bold text-slate-700 hover:text-emerald-700 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لقائمة المطاعم</span>
        </button>

        <button
          type="button"
          onClick={() => toggleFavoriteRestaurant(restaurant.id)}
          className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition-all shadow-2xs ${
            isFav
              ? 'bg-rose-50 border-rose-300 text-rose-700'
              : 'bg-white border-slate-200 text-slate-600 hover:text-rose-600'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current text-rose-600' : ''}`} />
          <span>{isFav ? 'في المفضلة' : 'أضف للمفضلة'}</span>
        </button>
      </div>

      {/* Restaurant Hero Card */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        {/* Banner */}
        <div className="relative h-48 sm:h-56 w-full bg-slate-900">
          <img
            src={restaurant.bannerUrl}
            alt={restaurant.name}
            className={`w-full h-full object-cover ${
              !restaurant.isOpen ? 'grayscale contrast-90 opacity-80' : ''
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />

          {/* Status Badges */}
          <div className="absolute top-3 right-3 flex items-center space-x-1.5 space-x-reverse">
            {restaurant.isOpen ? (
              <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-md">
                مفتوح للطلب
              </span>
            ) : (
              <span className="px-3 py-1 rounded-xl text-xs font-black bg-slate-900/90 text-white shadow-md flex items-center space-x-1 space-x-reverse">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>مغلق حالياً</span>
              </span>
            )}

            {restaurant.discountBadge && (
              <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-rose-600 text-white shadow-md">
                {restaurant.discountBadge}
              </span>
            )}
          </div>

          {/* Restaurant Title & Info overlay */}
          <div className="absolute bottom-4 right-4 left-4 text-white flex items-end justify-between flex-wrap gap-2">
            <div>
              <span className="text-[11px] font-bold text-emerald-300 block mb-0.5">
                {restaurant.cuisineTypes.join(' • ')}
              </span>
              <h1 className="text-xl sm:text-2xl font-black drop-shadow-md">
                {restaurant.name}
              </h1>
            </div>

            {/* Rating badge */}
            <div className="flex items-center space-x-1.5 space-x-reverse px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-2xl border border-white/20">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-sm font-black text-white font-mono">
                {restaurant.rating.toFixed(1)}
              </span>
              <span className="text-[11px] text-slate-300">
                ({restaurant.reviewsCount} تقييم)
              </span>
            </div>
          </div>
        </div>

        {/* Hero Details Meta Strip */}
        <div className="p-4 sm:p-5 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            {restaurant.description}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex items-center space-x-2 space-x-reverse">
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">وقت التجهيز</span>
                <span className="font-bold text-slate-800 font-mono">
                  {restaurant.estimatedPrepTimeMinutes} دقيقة
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex items-center space-x-2 space-x-reverse">
              <Bike className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">رسوم التوصيل</span>
                <span className="font-bold text-slate-800 font-mono">
                  {restaurant.deliveryFee} ج.م
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex items-center space-x-2 space-x-reverse">
              <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">المسافة والعنوان</span>
                <span className="font-bold text-slate-800 truncate block">
                  {restaurant.distanceKm} كم • {restaurant.governorate}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex items-center space-x-2 space-x-reverse">
              <Info className="w-4 h-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">مواعيد العمل</span>
                <span className="font-bold text-slate-800 text-[11px] truncate block">
                  {restaurant.openingHours}
                </span>
              </div>
            </div>
          </div>

          {/* Closed Warning Banner if restaurant is closed */}
          {!restaurant.isOpen && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold text-amber-900 flex items-center space-x-2 space-x-reverse">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                المطعم مغلق حالياً. يمكنك تصفح الأصناف وإضافتها إلى السلة، وسيتم تفعيل إتمام الطلب فور إعادة فتح المطعم.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Menu Search and Categories Navigation */}
      <div className="space-y-3">
        {/* Search inside menu */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            value={itemSearchQuery}
            onChange={(e) => setItemSearchQuery(e.target.value)}
            placeholder="ابحث في أصناف ووجبات هذا المطعم..."
            className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs"
          />
        </div>

        {/* Menu Category Chips & View Switcher */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 space-x-reverse overflow-x-auto pb-1.5 scrollbar-none flex-1">
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-2xs cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs shrink-0 mb-1.5">
            <button
              type="button"
              onClick={() => handleToggleViewMode('grid')}
              title="عرض شبكة (بطاقتين بالصف)"
              aria-label="عرض شبكة"
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleToggleViewMode('list')}
              title="عرض قائمة"
              aria-label="عرض قائمة"
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Menu Dishes Grid or List */}
      {isLoadingMenu ? (
        <div className="py-16 text-center space-y-2">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-bold">جاري تحميل قائمة الطعام...</p>
        </div>
      ) : filteredMenuItems.length === 0 ? (
        <div className="py-12 text-center space-y-2 bg-white rounded-3xl border border-slate-200 p-6">
          <p className="text-xs font-bold text-slate-600">
            لا توجد أصناف مطابقة في هذا التصنيف أو البحث.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('الكل');
              setItemSearchQuery('');
            }}
            className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5'
              : 'flex flex-col gap-3'
          }
        >
          {filteredMenuItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              restaurantIsOpen={restaurant.isOpen}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}

    </div>
  );
};
