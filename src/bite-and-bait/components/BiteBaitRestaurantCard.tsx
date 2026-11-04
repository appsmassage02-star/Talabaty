import React from 'react';
import type { Restaurant } from '../types';
import { biteBaitAssets } from '../assets';
import { BiteBaitStarRating } from './BiteBaitStarRating';

interface BiteBaitRestaurantCardProps {
  restaurant: Restaurant;
  onClick?: (restaurant: Restaurant) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (restaurantId: string) => void;
}

export const BiteBaitRestaurantCard: React.FC<BiteBaitRestaurantCardProps> = ({
  restaurant,
  onClick,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const banner = restaurant.bannerUrl || restaurant.logoUrl || biteBaitAssets.placeholder;

  return (
    <div
      className="bnb-restaurant-card"
      onClick={() => onClick && onClick(restaurant)}
      style={{ position: 'relative' }}
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

        {/* Favorite Heart Button */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(restaurant.id);
            }}
            aria-label={isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              zIndex: 3,
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.9)',
              border: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            {isFavorite ? '❤️' : '🤍'}
          </button>
        )}

        {/* Discount Badge */}
        {restaurant.discountBadge && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '50px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              zIndex: 2,
            }}
          >
            {restaurant.discountBadge}
          </div>
        )}

        {/* Closed Overlay with next opening time */}
        {!restaurant.isOpen && (
          <div
            className="bnb-restaurant-closed-overlay"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                background: '#dc2626',
                color: '#ffffff',
                padding: '4px 14px',
                borderRadius: '50px',
                fontSize: '11.5px',
                fontWeight: 800,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              مغلق حالياً 🔒
            </span>
            {restaurant.nextOpeningTime && (
              <span
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  color: '#fef08a',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                }}
              >
                موعد الفتح: {restaurant.nextOpeningTime}
              </span>
            )}
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

        {/* Working Hours & Min Order Row */}
        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          <span>🕒 {restaurant.openingHours || '10:00 ص - 12:00 م'}</span>
          <span>الحد الأدنى: <b>{restaurant.minOrderAmount || 50} ج.م</b></span>
        </div>

        {/* Meta details (Address, Delivery Fee) */}
        <div className="bnb-meta-row" style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
          <span>📍 {restaurant.address || 'القاهرة'}</span>
          <span style={{ fontWeight: 700, color: restaurant.deliveryFee > 0 ? '#0f172a' : '#16a34a' }}>
            🛵 توصيل: {restaurant.deliveryFee > 0 ? `${restaurant.deliveryFee} ج.م` : 'مجاني'}
          </span>
        </div>
      </div>
    </div>
  );
};
