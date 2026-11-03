import React from 'react';
import type { MenuItem } from '../types';
import { biteBaitAssets } from '../assets';
import { BiteBaitStarRating } from './BiteBaitStarRating';

interface BiteBaitFoodCardProps {
  item: MenuItem;
  quantityInCart?: number;
  onAddToCart?: (item: MenuItem) => void;
  onRemoveFromCart?: (item: MenuItem) => void;
  onOpenDetails?: (item: MenuItem) => void;
}

export const BiteBaitFoodCard: React.FC<BiteBaitFoodCardProps> = ({
  item,
  quantityInCart = 0,
  onAddToCart,
  onRemoveFromCart,
  onOpenDetails,
}) => {
  const imageUrl = item.imageUrl || biteBaitAssets.placeholder;

  return (
    <div className="bnb-food-card">
      {/* Food Image with Floating Badge & Controls */}
      <div
        className="bnb-food-img-wrap"
        onClick={() => onOpenDetails && onOpenDetails(item)}
        style={{ cursor: onOpenDetails ? 'pointer' : 'default' }}
      >
        <img
          src={imageUrl}
          alt={item.name}
          className="bnb-food-img"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = biteBaitAssets.placeholder;
          }}
        />

        {/* Popular / Offer Badge */}
        {item.isPopular && (
          <span className="bnb-food-badge">
            الأكثر طلباً ⭐
          </span>
        )}
        {item.isOffer && (
          <span className="bnb-food-badge" style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }}>
            عرض خاص 🔥
          </span>
        )}

        {/* Add / Counter Controls Overlay */}
        {quantityInCart === 0 ? (
          <button
            type="button"
            className="bnb-add-circle"
            title="إضافة للسلة"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart && onAddToCart(item);
            }}
          >
            <img
              src={biteBaitAssets.add_icon_white}
              alt="إضافة"
              style={{ width: '16px', height: '16px' }}
            />
          </button>
        ) : (
          <div
            className="bnb-counter-pill"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="bnb-counter-btn"
              title="إنقاص"
              onClick={() => onRemoveFromCart && onRemoveFromCart(item)}
            >
              <img
                src={biteBaitAssets.remove_icon_red}
                alt="إنقاص"
                style={{ width: '18px', height: '18px' }}
              />
            </button>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', minWidth: '16px', textAlign: 'center' }}>
              {quantityInCart}
            </span>
            <button
              type="button"
              className="bnb-counter-btn"
              title="زيادة"
              onClick={() => onAddToCart && onAddToCart(item)}
            >
              <img
                src={biteBaitAssets.add_icon_green}
                alt="زيادة"
                style={{ width: '18px', height: '18px' }}
              />
            </button>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bnb-food-info">
        <h3
          className="bnb-food-title"
          onClick={() => onOpenDetails && onOpenDetails(item)}
          style={{ cursor: onOpenDetails ? 'pointer' : 'default' }}
        >
          {item.name}
        </h3>

        {item.restaurantName && (
          <span className="bnb-food-restaurant">
            🏪 {item.restaurantName}
          </span>
        )}

        {item.description && (
          <p className="bnb-food-desc">
            {item.description}
          </p>
        )}

        <div className="bnb-food-price-row">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span className="bnb-food-price">
              {item.price} ج.م
            </span>
            {item.originalPrice && item.originalPrice > item.price && (
              <span style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'line-through' }}>
                {item.originalPrice} ج.م
              </span>
            )}
          </div>

          {/* Quick options indicator */}
          {item.optionGroups && item.optionGroups.length > 0 && (
            <span
              style={{
                fontSize: '10.5px',
                color: '#f59e0b',
                background: '#fef3c7',
                padding: '2px 6px',
                borderRadius: '6px',
                fontWeight: 700,
              }}
            >
              خيارات متوفرة
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
