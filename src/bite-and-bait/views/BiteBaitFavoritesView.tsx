import React, { useState } from 'react';
import type { Restaurant, MenuItem, BiteBaitView } from '../types';
import { BiteBaitRestaurantCard } from '../components/BiteBaitRestaurantCard';
import { BiteBaitFoodCard } from '../components/BiteBaitFoodCard';
import { BiteBaitEmptyState } from '../components/BiteBaitEmptyState';

interface BiteBaitFavoritesViewProps {
  favoriteRestaurants: Restaurant[];
  favoriteFoods: MenuItem[];
  cartQuantities?: Record<string, number>;
  onNavigateView: (view: BiteBaitView, meta?: { restaurantId?: string }) => void;
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onAddToCart?: (item: MenuItem) => void;
  onRemoveFromCart?: (item: MenuItem) => void;
  onOpenDetails?: (item: MenuItem) => void;
  onToggleFavoriteRestaurant: (restaurantId: string) => void;
  onToggleFavoriteFood: (foodId: string) => void;
}

export const BiteBaitFavoritesView: React.FC<BiteBaitFavoritesViewProps> = ({
  favoriteRestaurants,
  favoriteFoods,
  cartQuantities = {},
  onNavigateView,
  onSelectRestaurant,
  onAddToCart,
  onRemoveFromCart,
  onOpenDetails,
  onToggleFavoriteRestaurant,
  onToggleFavoriteFood,
}) => {
  const [activeTab, setActiveTab] = useState<'restaurants' | 'foods'>('restaurants');

  return (
    <div className="bite-and-bait-scope">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => onNavigateView('home')}
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
          <span>الرئيسية</span>
        </button>

        <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          قائمة المفضلة ❤️
        </h1>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('restaurants')}
            style={{
              border: 'none',
              background: activeTab === 'restaurants' ? '#f59e0b' : '#f1f5f9',
              color: activeTab === 'restaurants' ? '#0f172a' : '#475569',
              padding: '6px 14px',
              borderRadius: '50px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            المطاعم ({favoriteRestaurants.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('foods')}
            style={{
              border: 'none',
              background: activeTab === 'foods' ? '#f59e0b' : '#f1f5f9',
              color: activeTab === 'foods' ? '#0f172a' : '#475569',
              padding: '6px 14px',
              borderRadius: '50px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            الأطباق ({favoriteFoods.length})
          </button>
        </div>
      </div>

      {/* Read-Only Status & Local Modification Notice */}
      <div
        style={{
          background: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          borderRadius: '14px',
          padding: '12px 16px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <span style={{ fontSize: '20px' }}>ℹ️</span>
        <div style={{ fontSize: '12px', color: '#1e40af', lineHeight: 1.5 }}>
          <b>تنبيه مرحلة القراءة فقط:</b> يتم استرجاع قائمة المفضلة الحالية من جداول قاعدة البيانات الفعلية. بينما أي تعديل بالضغط على علامة القلب (إضافة أو إزالة) هو تعديل محلي ومؤقت في جلسة العمل الحالية، ولن يُحفظ في Supabase حتى تفعيل تصاريح الكتابة في المراحل اللاحقة.
        </div>
      </div>

      {/* Render Active Tab */}
      {activeTab === 'restaurants' && (
        <div>
          {favoriteRestaurants.length === 0 ? (
            <BiteBaitEmptyState
              icon="❤️"
              title="لم تقم بإضافة مطاعم للمفضلة بعد"
              description="تصفح قائمة المطاعم واضغط على رمز القلب لحفظ مطاعمك المفضلة والوصول إليها بسرعة."
              actionLabel="تصفح المطاعم 👈"
              onAction={() => onNavigateView('restaurants')}
            />
          ) : (
            <div className="bnb-restaurants-grid">
              {favoriteRestaurants.map((restaurant) => (
                <BiteBaitRestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  onClick={(r) => {
                    onSelectRestaurant(r);
                    onNavigateView('restaurant', { restaurantId: r.id });
                  }}
                  isFavorite={true}
                  onToggleFavorite={onToggleFavoriteRestaurant}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'foods' && (
        <div>
          {favoriteFoods.length === 0 ? (
            <BiteBaitEmptyState
              icon="🍔"
              title="لم تقم بإضافة أطباق للمفضلة بعد"
              description="استكشف أشهى المأكولات والأطباق واضغط على علامة القلب لتثبيت وجباتك المفضلة هنا."
              actionLabel="استعراض قائمة الأطعمة 👈"
              onAction={() => onNavigateView('home')}
            />
          ) : (
            <div className="bnb-foods-grid">
              {favoriteFoods.map((item) => (
                <BiteBaitFoodCard
                  key={item.id}
                  item={item}
                  quantityInCart={cartQuantities[item.id] || 0}
                  onAddToCart={onAddToCart}
                  onRemoveFromCart={onRemoveFromCart}
                  onOpenDetails={onOpenDetails}
                  isFavorite={true}
                  onToggleFavorite={onToggleFavoriteFood}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
