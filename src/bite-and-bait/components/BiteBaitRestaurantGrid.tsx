import React from 'react';
import type { Restaurant } from '../types';
import { BiteBaitRestaurantCard } from './BiteBaitRestaurantCard';
import { BiteBaitEmptyState } from './BiteBaitEmptyState';

interface BiteBaitRestaurantGridProps {
  restaurants: Restaurant[];
  title?: string;
  onSelectRestaurant?: (restaurant: Restaurant) => void;
  onViewAll?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export const BiteBaitRestaurantGrid: React.FC<BiteBaitRestaurantGridProps> = ({
  restaurants,
  title = 'المطاعم المعتمدة بالقرب منك',
  onSelectRestaurant,
  onViewAll,
  emptyTitle = 'لا توجد مطاعم متاحة حالياً',
  emptyDescription = 'لم يتم العثور على مطاعم مفعلة في منطقتك حالياً. سيتم ربط مطاعم جديدة قريباً.',
}) => {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h2 className="bnb-section-heading">
          <span>🏪</span>
          <span>{title}</span>
        </h2>
        {onViewAll && restaurants.length > 0 && (
          <button
            type="button"
            onClick={onViewAll}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#d97706',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            عرض الكل ({restaurants.length}) 👈
          </button>
        )}
      </div>

      {restaurants.length === 0 ? (
        <BiteBaitEmptyState
          icon="🏪"
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <div className="bnb-restaurants-grid">
          {restaurants.map((restaurant) => (
            <BiteBaitRestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              onClick={onSelectRestaurant}
            />
          ))}
        </div>
      )}
    </div>
  );
};
