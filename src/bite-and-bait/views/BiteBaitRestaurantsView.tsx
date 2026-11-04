import React, { useState, useMemo } from 'react';
import type { Restaurant } from '../types';
import { BiteBaitRestaurantGrid } from '../components/BiteBaitRestaurantGrid';

interface BiteBaitRestaurantsViewProps {
  restaurants: Restaurant[];
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onNavigateBack: () => void;
  favoriteRestaurantIds?: string[];
  onToggleFavorite?: (restaurantId: string) => void;
}

export const BiteBaitRestaurantsView: React.FC<BiteBaitRestaurantsViewProps> = ({
  restaurants,
  onSelectRestaurant,
  onNavigateBack,
  favoriteRestaurantIds = [],
  onToggleFavorite,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [selectedCuisine, setSelectedCuisine] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'prepTime' | 'deliveryFee'>('popular');

  // Extract all unique cuisines
  const availableCuisines = useMemo(() => {
    const set = new Set<string>();
    restaurants.forEach((r) => {
      (r.cuisineTypes || []).forEach((c) => set.add(c));
    });
    return Array.from(set);
  }, [restaurants]);

  // Filter and sort restaurants
  const processedRestaurants = useMemo(() => {
    let result = restaurants.filter((r) => {
      const matchSearch =
        !searchQuery.trim() ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.address && r.address.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchOpen = !onlyOpen || r.isOpen;

      const matchOffers = !onlyOffers || Boolean(r.discountBadge);

      const matchRating = minRating === 0 || (r.rating || 0) >= minRating;

      const matchCuisine =
        selectedCuisine === 'All' ||
        (r.cuisineTypes && r.cuisineTypes.includes(selectedCuisine));

      return matchSearch && matchOpen && matchOffers && matchRating && matchCuisine;
    });

    // Sorting
    return result.sort((a, b) => {
      if (sortBy === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortBy === 'prepTime') {
        return (a.estimatedPrepTimeMinutes || 30) - (b.estimatedPrepTimeMinutes || 30);
      }
      if (sortBy === 'deliveryFee') {
        return (a.deliveryFee || 0) - (b.deliveryFee || 0);
      }
      // default: most popular (featured first, then review count)
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return (b.reviewsCount || 0) - (a.reviewsCount || 0);
    });
  }, [restaurants, searchQuery, onlyOpen, onlyOffers, minRating, selectedCuisine, sortBy]);

  return (
    <div className="bite-and-bait-scope">
      {/* Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <button
          type="button"
          onClick={onNavigateBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            padding: '8px 16px',
            borderRadius: '12px',
            fontSize: '12.5px',
            fontWeight: 700,
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          <span>→</span>
          <span>العودة للرئيسية</span>
        </button>

        <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          دليل مطاعم بايت آند بيت المعتمدة ({processedRestaurants.length})
        </h1>
      </div>

      {/* Comprehensive Filter and Search Controls Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
        }}
      >
        {/* Row 1: Search & Sort Dropdown */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="ابحث باسم المطعم، نوع الطعام، أو المنطقة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: '220px',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1.5px solid #e2e8f0',
              fontSize: '13px',
              outline: 'none',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>الترتيب:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1.5px solid #e2e8f0',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#0f172a',
                outline: 'none',
                background: '#f8fafc',
                cursor: 'pointer',
              }}
            >
              <option value="popular">الأكثر طلباً ⭐</option>
              <option value="rating">الأعلى تقييماً 🌟</option>
              <option value="prepTime">الأسرع تجهيزاً ⏱️</option>
              <option value="deliveryFee">الأقل رسوم توصيل 🛵</option>
            </select>
          </div>
        </div>

        {/* Row 2: Checkbox Filters (Open Only, Offers Only, Rating) */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer',
              background: onlyOpen ? '#ecfdf5' : '#f8fafc',
              border: onlyOpen ? '1.5px solid #10b981' : '1px solid #e2e8f0',
              padding: '6px 12px',
              borderRadius: '8px',
            }}
          >
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(e) => setOnlyOpen(e.target.checked)}
            />
            <span>المفتوحة فقط 🟢</span>
          </label>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer',
              background: onlyOffers ? '#fff1f2' : '#f8fafc',
              border: onlyOffers ? '1.5px solid #ef4444' : '1px solid #e2e8f0',
              padding: '6px 12px',
              borderRadius: '8px',
            }}
          >
            <input
              type="checkbox"
              checked={onlyOffers}
              onChange={(e) => setOnlyOffers(e.target.checked)}
            />
            <span>عروض وخصومات 🔥</span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>التقييم:</span>
            {[
              { val: 0, label: 'الكل' },
              { val: 4.5, label: '4.5+ ⭐' },
              { val: 4.7, label: '4.7+ ⭐' },
            ].map((r) => (
              <button
                key={r.val}
                type="button"
                onClick={() => setMinRating(r.val)}
                style={{
                  border: 'none',
                  background: minRating === r.val ? '#f59e0b' : '#f1f5f9',
                  color: minRating === r.val ? '#0f172a' : '#475569',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Cuisine Filter Tags */}
        {availableCuisines.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            <button
              type="button"
              onClick={() => setSelectedCuisine('All')}
              style={{
                border: 'none',
                background: selectedCuisine === 'All' ? '#0f172a' : '#f1f5f9',
                color: selectedCuisine === 'All' ? '#ffffff' : '#475569',
                padding: '5px 12px',
                borderRadius: '50px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              جميع المطابخ ({restaurants.length})
            </button>
            {availableCuisines.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCuisine(c)}
                style={{
                  border: 'none',
                  background: selectedCuisine === c ? '#0f172a' : '#f1f5f9',
                  color: selectedCuisine === c ? '#ffffff' : '#475569',
                  padding: '5px 12px',
                  borderRadius: '50px',
                  fontSize: '11.5px',
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

      {/* Grid */}
      <BiteBaitRestaurantGrid
        restaurants={processedRestaurants}
        title="نتائج البحث والمطاعم المتاحة"
        onSelectRestaurant={onSelectRestaurant}
        favoriteRestaurantIds={favoriteRestaurantIds}
        onToggleFavorite={onToggleFavorite}
        emptyTitle="لم نجد مطاعم مطابقة"
        emptyDescription="جرّب تعديل كلمات البحث أو إلغاء بعض الفلاتر (مثل المطاعم المفتوحة فقط أو تصنيف المطبخ)."
      />
    </div>
  );
};
