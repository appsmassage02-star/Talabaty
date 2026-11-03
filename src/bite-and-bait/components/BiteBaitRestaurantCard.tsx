import React from 'react';
import type { Restaurant } from '../types';
import { biteBaitAssets } from '../assets';
import { BiteBaitStarRating } from './BiteBaitStarRating';

interface BiteBaitRestaurantCardProps {
  restaurant: Restaurant;
  onClick?: (restaurant: Restaurant) => void;
}

export const BiteBaitRestaurantCard: React.FC<BiteBaitRestaurantCardProps> = ({
  restaurant,
  onClick,
}) => {
  const banner = restaurant.bannerUrl || restaurant.logoUrl || biteBaitAssets.placeholder;

  return (
    <div
      className="bnb-restaurant-card"
      onClick={() => onClick && onClick(restaurant)}
    >
      {/* Restaurant Image Container */}
      <div className="bnb-restaurant-img-wrap">
        <img
          src={banner}
          alt={restaurant.name}
          className="bnb-restaurant-img"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = biteBaitAssets.placeholder;
          }}
        />

        {/* Closed Overlay */}
        {!restaurant.isOpen && (
          <div className="bnb-restaurant-closed-overlay">
            <span
              style={{
                background: '#dc2626',
                color: '#ffffff',
                padding: '4px 12px',
                borderRadius: '50px',
                fontSize: '11px',
                fontWeight: 800,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              مغلق حالياً 🔒
            </span>
          </div>
        )}

        {/* Prep Time Badge */}
        {restaurant.isOpen && (
          <div className="bnb-restaurant-badge">
            <span>⏱️</span>
            <span>{restaurant.estimatedPrepTimeMinutes || 30} دقيقة</span>
          </div>
        )}
      </div>

      {/* Info Content */}
      <div className="bnb-restaurant-info">
        <div className="bnb-restaurant-header">
          <h3 className="bnb-restaurant-name">
            <span>{restaurant.name}</span>
            <img
              src={biteBaitAssets.verify}
              alt="موثق"
              className="bnb-verified-icon"
              title="مطعم موثق ومعتمد"
            />
          </h3>

          <BiteBaitStarRating
            rating={restaurant.rating || 4.5}
            size="sm"
            showCount
            count={restaurant.reviewsCount || 0}
          />
        </div>

        {/* Cuisine Types & Tags */}
        {restaurant.cuisineTypes && restaurant.cuisineTypes.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {restaurant.cuisineTypes.slice(0, 3).map((c, i) => (
              <span
                key={i}
                style={{
                  fontSize: '11px',
                  color: '#475569',
                  background: '#f1f5f9',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontWeight: 600,
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Meta details (Address, Delivery Fee) */}
        <div className="bnb-meta-row" style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
          <span>📍 {restaurant.address || 'القاهرة'}</span>
          <span>🛵 توصيل: {restaurant.deliveryFee > 0 ? `${restaurant.deliveryFee} ج.م` : 'مجاني'}</span>
        </div>
      </div>
    </div>
  );
};
