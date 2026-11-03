import React, { useState, useMemo } from 'react';
import type { Restaurant, MenuItem, RestaurantCategory, BiteBaitView } from '../types';
import { BiteBaitHeader } from '../components/BiteBaitHeader';
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
  onNavigateView: (view: BiteBaitView, meta?: { restaurantId?: string }) => void;
  onAddToCart?: (item: MenuItem) => void;
  onRemoveFromCart?: (item: MenuItem) => void;
  onOpenItemDetails?: (item: MenuItem) => void;
  onSelectRestaurant?: (restaurant: Restaurant) => void;
}

export const BiteBaitHomeView: React.FC<BiteBaitHomeViewProps> = ({
  restaurants,
  featuredFoods,
  categories,
  cartCount,
  cartTotal,
  cartQuantities = {},
  onNavigateView,
  onAddToCart,
  onRemoveFromCart,
  onOpenItemDetails,
  onSelectRestaurant,
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

  return (
    <div className="bite-and-bait-scope">
      {/* Hero Header & Search */}
      <BiteBaitHeader
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onExploreClick={() => {
          const el = document.getElementById('bnb-food-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Explore Menu Categories */}
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
