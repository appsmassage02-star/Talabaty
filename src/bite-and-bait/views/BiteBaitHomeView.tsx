import React, { useState, useMemo } from 'react';
import type { Restaurant, MenuItem, RestaurantCategory, BiteBaitView, BiteBaitPromoSlide } from '../types';
import { BiteBaitHeader } from '../components/BiteBaitHeader';
import { BiteBaitPromoSlider } from '../components/BiteBaitPromoSlider';
import { BiteBaitExploreMenu } from '../components/BiteBaitExploreMenu';
import { BiteBaitRestaurantGrid } from '../components/BiteBaitRestaurantGrid';
import { BiteBaitFoodGrid } from '../components/BiteBaitFoodGrid';
import { BiteBaitQuickCheckout } from '../components/BiteBaitQuickCheckout';

interface BiteBaitHomeViewProps {
  restaurants: Restaurant[];
  featuredFoods: MenuItem[];
  categories: RestaurantCategory[];
  cartCount: number;
  cartTotal: number;
  cartQuantities?: Record<string, number>;
  favoriteRestaurantIds?: string[];
  favoriteFoodIds?: string[];
  onToggleFavoriteRestaurant?: (restaurantId: string) => void;
  onToggleFavoriteFood?: (foodId: string) => void;
  onNavigateView: (view: BiteBaitView, meta?: { restaurantId?: string }) => void;
  onAddToCart?: (item: MenuItem) => void;
  onRemoveFromCart?: (item: MenuItem) => void;
  onOpenItemDetails?: (item: MenuItem) => void;
  onSelectRestaurant?: (restaurant: Restaurant) => void;
  onOpenNotificationPreferences?: () => void;
}

export const BiteBaitHomeView: React.FC<BiteBaitHomeViewProps> = ({
  restaurants,
  featuredFoods,
  categories,
  cartCount,
  cartTotal,
  cartQuantities = {},
  favoriteRestaurantIds = [],
  favoriteFoodIds = [],
  onToggleFavoriteRestaurant,
  onToggleFavoriteFood,
  onNavigateView,
  onAddToCart,
  onRemoveFromCart,
  onOpenItemDetails,
  onSelectRestaurant,
  onOpenNotificationPreferences,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Filter foods by category and search query
  const filteredFoods = useMemo(() => {
    return featuredFoods.filter((item) => {
      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.restaurantName && item.restaurantName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCategory =
        selectedCategory === 'All' ||
        item.category === selectedCategory ||
        (item.category && item.category.toLowerCase() === selectedCategory.toLowerCase());

      return matchSearch && matchCategory;
    });
  }, [featuredFoods, searchQuery, selectedCategory]);

  // Filter restaurants by search query
  const filteredRestaurants = useMemo(() => {
    if (!searchQuery.trim()) return restaurants;
    const q = searchQuery.toLowerCase();
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.cuisineTypes && r.cuisineTypes.some((c) => c.toLowerCase().includes(q)))
    );
  }, [restaurants, searchQuery]);

  // Handle promo slide click
  const handlePromoSlideClick = (slide: BiteBaitPromoSlide) => {
    if (slide.ctaRestaurantId) {
      const rest = restaurants.find((r) => r.id === slide.ctaRestaurantId);
      if (rest) {
        if (onSelectRestaurant) onSelectRestaurant(rest);
        onNavigateView('restaurant', { restaurantId: rest.id });
        return;
      }
    }
    if (slide.ctaCategory) {
      setSelectedCategory(slide.ctaCategory);
      const el = document.getElementById('bnb-food-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bite-and-bait-scope">
      {/* Interactive Multi-Slide Promotional Banner */}
      <BiteBaitPromoSlider onSlideClick={handlePromoSlideClick} />

      {/* Hero Header & Integrated Search Bar */}
      <BiteBaitHeader
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onExploreClick={() => {
          const el = document.getElementById('bnb-food-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Quick Action Navigation Bar (Offers, Favorites, Notification preferences) */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={() => onNavigateView('offers')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
            border: '1px solid #fdba74',
            padding: '8px 14px',
            borderRadius: '12px',
            fontSize: '12.5px',
            fontWeight: 800,
            color: '#c2410c',
            cursor: 'pointer',
          }}
        >
          <span>🔥</span>
          <span>عروض وخصومات اليوم</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateView('favorites')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            padding: '8px 14px',
            borderRadius: '12px',
            fontSize: '12.5px',
            fontWeight: 700,
            color: '#e11d48',
            cursor: 'pointer',
          }}
        >
          <span>❤️</span>
          <span>المفضلة ({favoriteRestaurantIds.length + favoriteFoodIds.length})</span>
        </button>

        {onOpenNotificationPreferences && (
          <button
            type="button"
            onClick={onOpenNotificationPreferences}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '8px 14px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#475569',
              cursor: 'pointer',
              marginRight: 'auto',
            }}
          >
            <span>🔔</span>
            <span>تفضيلات الإشعارات</span>
          </button>
        )}
      </div>

      {/* Explore Menu Categories Carousel */}
      <BiteBaitExploreMenu
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Verified Restaurants Grid */}
      {selectedCategory === 'All' && !searchQuery.trim() && (
        <BiteBaitRestaurantGrid
          restaurants={filteredRestaurants}
          title="أفضل المطاعم المعتمدة بالقرب منك"
          onSelectRestaurant={(r) => {
            if (onSelectRestaurant) onSelectRestaurant(r);
            onNavigateView('restaurant', { restaurantId: r.id });
          }}
          onViewAll={() => onNavigateView('restaurants')}
          favoriteRestaurantIds={favoriteRestaurantIds}
          onToggleFavorite={onToggleFavoriteRestaurant}
        />
      )}

      {/* Foods Grid */}
      <div id="bnb-food-section">
        <BiteBaitFoodGrid
          items={filteredFoods}
          title={
            searchQuery.trim()
              ? `نتائج البحث عن "${searchQuery}"`
              : selectedCategory === 'All'
              ? 'الأطباق الأكثر طلباً'
              : `أشهى أطباق ${selectedCategory}`
          }
          cartQuantities={cartQuantities}
          favoriteFoodIds={favoriteFoodIds}
          onToggleFavorite={onToggleFavoriteFood}
          onAddToCart={onAddToCart}
          onRemoveFromCart={onRemoveFromCart}
          onOpenDetails={onOpenItemDetails}
        />
      </div>

      {/* Quick Floating Checkout Bar */}
      <BiteBaitQuickCheckout
        totalItems={cartCount}
        totalPrice={cartTotal}
        onOpenCart={() => onNavigateView('cart')}
      />
    </div>
  );
};
