import React, { useState, useMemo } from 'react';
import type { Restaurant, MenuItem } from '../types';
import { biteBaitAssets } from '../assets';
import { BiteBaitStarRating } from '../components/BiteBaitStarRating';
import { BiteBaitFoodGrid } from '../components/BiteBaitFoodGrid';
import { BiteBaitQuickCheckout } from '../components/BiteBaitQuickCheckout';

interface BiteBaitRestaurantDetailViewProps {
  restaurant: Restaurant;
  menuItems: MenuItem[];
  cartCount: number;
  cartTotal: number;
  cartQuantities?: Record<string, number>;
  favoriteFoodIds?: string[];
  isRestaurantFavorite?: boolean;
  isLoadingMenu?: boolean;
  menuError?: string | null;
  onRetryMenu?: () => void;
  onToggleFavoriteRestaurant?: (restaurantId: string) => void;
  onToggleFavoriteFood?: (foodId: string) => void;
  onNavigateBack: () => void;
  onOpenCart: () => void;
  onAddToCart?: (item: MenuItem) => void;
  onRemoveFromCart?: (item: MenuItem) => void;
  onOpenItemDetails?: (item: MenuItem) => void;
}

export const BiteBaitRestaurantDetailView: React.FC<BiteBaitRestaurantDetailViewProps> = ({
  restaurant,
  menuItems,
  cartCount,
  cartTotal,
  cartQuantities = {},
  favoriteFoodIds = [],
  isRestaurantFavorite = false,
  isLoadingMenu = false,
  menuError = null,
  onRetryMenu,
  onToggleFavoriteRestaurant,
  onToggleFavoriteFood,
  onNavigateBack,
  onOpenCart,
  onAddToCart,
  onRemoveFromCart,
  onOpenItemDetails,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract menu categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set);
  }, [menuItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCategory =
        selectedCategory === 'All' || item.category === selectedCategory;

      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchCategory && matchSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  const banner = restaurant.bannerUrl || restaurant.logoUrl || biteBaitAssets.placeholder;

  return (
    <div className="bite-and-bait-scope">
      {/* Back Button */}
      <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={onNavigateBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            padding: '7px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 700,
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          <span>→</span>
          <span>العودة لقائمة المطاعم</span>
        </button>

        {onToggleFavoriteRestaurant && (
          <button
            type="button"
            onClick={() => onToggleFavoriteRestaurant(restaurant.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: '7px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              color: isRestaurantFavorite ? '#e11d48' : '#64748b',
              cursor: 'pointer',
            }}
          >
            <span>{isRestaurantFavorite ? '❤️ في المفضلة' : '🤍 إضافة للمفضلة'}</span>
          </button>
        )}
      </div>

      {/* Restaurant Header Banner Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          marginBottom: '24px',
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '190px', background: '#0f172a' }}>
          <img
            src={banner}
            alt={restaurant.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = biteBaitAssets.placeholder;
            }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.88) 0%, transparent 65%)' }} />

          <div style={{ position: 'absolute', bottom: '16px', right: '20px', left: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', color: 'white' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'white' }}>
                  {restaurant.name}
                </h1>
                <img
                  src={biteBaitAssets.verify}
                  alt="موثق"
                  style={{ width: '18px', height: '18px' }}
                />
              </div>
              <p style={{ fontSize: '12.5px', color: '#cbd5e1', margin: '4px 0 0' }}>
                📍 {restaurant.address || 'العنوان غير محدد'} • 🕒 {restaurant.openingHours || (restaurant.isOpen ? 'مفتوح للطلب' : 'مغلق حالياً')}
              </p>
            </div>

            <div style={{ textAlign: 'left' }}>
              {restaurant.rating && restaurant.rating > 0 ? (
                <BiteBaitStarRating
                  rating={restaurant.rating}
                  size="md"
                  showCount
                  count={restaurant.reviewsCount || 0}
                />
              ) : (
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    padding: '4px 10px',
                    borderRadius: '50px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  جديد / بدون تقييم
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Restaurant Stats Bar (Authentic DB data only) */}
        <div
          style={{
            padding: '14px 20px',
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            alignItems: 'center',
            fontSize: '12.5px',
            color: '#475569',
            background: '#fafafa',
            borderTop: '1px solid #f1f5f9',
          }}
        >
          <span>⏱️ وقت التجهيز: <b>{restaurant.estimatedPrepTimeMinutes && restaurant.estimatedPrepTimeMinutes > 0 ? `${restaurant.estimatedPrepTimeMinutes} دقيقة` : 'غير محدد'}</b></span>
          <span>🛵 رسوم التوصيل: <b>{(restaurant.deliveryFee || 0) > 0 ? `${restaurant.deliveryFee} ج.م` : 'مجاني'}</b></span>
          <span>💵 الحد الأدنى: <b>{(restaurant.minOrderAmount || 0) > 0 ? `${restaurant.minOrderAmount} ج.م` : 'بدون حد أدنى'}</b></span>
          <span>
            الحالة:{' '}
            <b style={{ color: restaurant.isOpen ? '#16a34a' : '#dc2626' }}>
              {restaurant.isOpen ? 'مفتوح ويستقبل الطلبات 🟢' : 'مغلق حالياً 🔴'}
            </b>
            {!restaurant.isOpen && restaurant.nextOpeningTime && (
              <span style={{ marginRight: '6px', color: '#92400e', fontWeight: 700 }}>
                (يفتح: {restaurant.nextOpeningTime})
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Menu Filter and Search Bar */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="ابحث في قائمة أطباق المطعم..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '9px 12px',
            borderRadius: '12px',
            border: '1.5px solid #e2e8f0',
            fontSize: '13px',
            outline: 'none',
          }}
        />

        {/* Categories Pills */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              style={{
                border: 'none',
                background: selectedCategory === 'All' ? '#f59e0b' : '#f1f5f9',
                color: selectedCategory === 'All' ? '#0f172a' : '#475569',
                padding: '5px 12px',
                borderRadius: '50px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              الكل ({menuItems.length})
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCategory(c)}
                style={{
                  border: 'none',
                  background: selectedCategory === c ? '#f59e0b' : '#f1f5f9',
                  color: selectedCategory === c ? '#0f172a' : '#475569',
                  padding: '5px 12px',
                  borderRadius: '50px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Menu Loading & Error States */}
      {isLoadingMenu ? (
        <div
          style={{
            padding: '48px 20px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid #f3f4f6',
              borderTopColor: '#f59e0b',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
            جاري تحميل قائمة الطعام من قاعدة البيانات...
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            يتم جلب الأصناف والخيارات والأسعار المعتمدة لهذا المطعم
          </div>
        </div>
      ) : menuError ? (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            background: '#fef2f2',
            borderRadius: '16px',
            border: '1.5px solid #fca5a5',
            marginBottom: '24px',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚠️</div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#991b1b', marginBottom: '4px' }}>
            تعذر تحميل قائمة طعام المطعم
          </div>
          <div style={{ fontSize: '12px', color: '#b91c1c', marginBottom: '14px' }}>
            {menuError}
          </div>
          {onRetryMenu && (
            <button
              type="button"
              onClick={onRetryMenu}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🔄 إعادة المحاولة
            </button>
          )}
        </div>
      ) : (
        /* Menu Items Grid */
        <BiteBaitFoodGrid
          items={filteredItems}
          title={selectedCategory === 'All' ? 'قائمة الطعام' : selectedCategory}
          cartQuantities={cartQuantities}
          favoriteFoodIds={favoriteFoodIds}
          onToggleFavorite={onToggleFavoriteFood}
          onAddToCart={onAddToCart}
          onRemoveFromCart={onRemoveFromCart}
          onOpenDetails={onOpenItemDetails}
          emptyTitle="لا توجد أطباق في هذه الفئة"
          emptyDescription="لم نجد أي طبق في منيو المطعم يطابق البحث أو الفئة المحددة."
        />
      )}

      {/* Quick Floating Checkout Bar */}
      <BiteBaitQuickCheckout
        totalItems={cartCount}
        totalPrice={cartTotal}
        onOpenCart={onOpenCart}
      />
    </div>
  );
};
