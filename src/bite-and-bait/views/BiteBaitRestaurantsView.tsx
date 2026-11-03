import React, { useState, useMemo } from 'react';
import type { Restaurant, BiteBaitView } from '../types';
import { BiteBaitRestaurantGrid } from '../components/BiteBaitRestaurantGrid';

interface BiteBaitRestaurantsViewProps {
  restaurants: Restaurant[];
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onNavigateBack: () => void;
}

export const BiteBaitRestaurantsView: React.FC<BiteBaitRestaurantsViewProps> = ({
  restaurants,
  onSelectRestaurant,
  onNavigateBack,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [selectedCuisine, setSelectedCuisine] = useState<string>('All');

  // Extract all unique cuisines
  const availableCuisines = useMemo(() => {
    const set = new Set<string>();
    restaurants.forEach((r) => {
      (r.cuisineTypes || []).forEach((c) => set.add(c));
    });
    return Array.from(set);
  }, [restaurants]);

  // Filter restaurants
  const filtered = useMemo(() => {
    return restaurants.filter((r) => {
      const matchSearch =
        !searchQuery.trim() ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchOpen = !onlyOpen || r.isOpen;

      const matchCuisine =
        selectedCuisine === 'All' ||
        (r.cuisineTypes && r.cuisineTypes.includes(selectedCuisine));

      return matchSearch && matchOpen && matchCuisine;
    });
  }, [restaurants, searchQuery, onlyOpen, selectedCuisine]);

  return (
    <div className="bite-and-bait-scope">
      {/* Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
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
          دليل المطاعم المعتمدة ({filtered.length})
        </h1>
      </div>

      {/* Filter and Search Controls */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="ابحث باسم المطعم أو المنطقة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '9px 12px',
              borderRadius: '10px',
              border: '1.5px solid #e2e8f0',
              fontSize: '13px',
              outline: 'none',
            }}
          />

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer',
              background: '#f8fafc',
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
            }}
          >
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(e) => setOnlyOpen(e.target.checked)}
            />
            <span>المطاعم المفتوحة فقط 🟢</span>
          </label>
        </div>

        {/* Cuisine Filter Tags */}
        {availableCuisines.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            <button
              type="button"
              onClick={() => setSelectedCuisine('All')}
              style={{
                border: 'none',
                background: selectedCuisine === 'All' ? '#f59e0b' : '#f1f5f9',
                color: selectedCuisine === 'All' ? '#0f172a' : '#475569',
                padding: '4px 12px',
                borderRadius: '50px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              جميع المطابخ
            </button>
            {availableCuisines.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCuisine(c)}
                style={{
                  border: 'none',
                  background: selectedCuisine === c ? '#f59e0b' : '#f1f5f9',
                  color: selectedCuisine === c ? '#0f172a' : '#475569',
                  padding: '4px 12px',
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
        restaurants={filtered}
        title="نتائج المطاعم"
        onSelectRestaurant={onSelectRestaurant}
      />
    </div>
  );
};
