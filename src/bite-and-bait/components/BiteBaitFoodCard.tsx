import React from 'react';
import type { MenuItem } from '../types';
import { biteBaitAssets } from '../assets';

interface BiteBaitFoodCardProps {
  item: MenuItem;
  quantityInCart?: number;
  onAddToCart?: (item: MenuItem) => void;
  onRemoveFromCart?: (item: MenuItem) => void;
  onOpenDetails?: (item: MenuItem) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (itemId: string) => void;
}

export const BiteBaitFoodCard: React.FC<BiteBaitFoodCardProps> = ({
  item,
  quantityInCart = 0,
  onAddToCart,
  onRemoveFromCart,
  onOpenDetails,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const imageUrl = item.imageUrl || biteBaitAssets.placeholder;

  return (
    <div
      className="bnb-food-card"
      style={{
        opacity: item.isAvailable ? 1 : 0.75,
        filter: item.isAvailable ? 'none' : 'grayscale(20%)',
        position: 'relative',
      }}
    >
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

        {/* Favorite Heart Button */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            aria-label={isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              zIndex: 3,
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.9)',
              border: 'none',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {isFavorite ? '❤️' : '🤍'}
          </button>
        )}

        {/* Unavailable overlay badge */}
        {!item.isAvailable && (
          <span
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: '#dc2626',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              zIndex: 2,
            }}
          >
            غير متوفر حالياً 🚫
          </span>
        )}

        {/* Popular / Offer Badge */}
        {item.isAvailable && item.isPopular && (
          <span className="bnb-food-badge">
            الأكثر طلباً ⭐
          </span>
        )}
        {item.isAvailable && item.isOffer && (
          <span className="bnb-food-badge" style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }}>
            عرض خاص 🔥
          </span>
        )}

        {/* Add / Counter Controls Overlay */}
        {item.isAvailable ? (
          quantityInCart === 0 ? (
            <button
              type="button"
              className="bnb-add-circle"
              title="إضافة للسلة"
              onClick={(e) => {
                e.stopPropagation();
                if (item.optionGroups && item.optionGroups.length > 0 && onOpenDetails) {
                  onOpenDetails(item);
                } else if (onAddToCart) {
                  onAddToCart(item);
                }
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
                onClick={() => {
                  if (item.optionGroups && item.optionGroups.length > 0 && onOpenDetails) {
                    onOpenDetails(item);
                  } else if (onAddToCart) {
                    onAddToCart(item);
                  }
                }}
              >
                <img
                  src={biteBaitAssets.add_icon_green}
                  alt="زيادة"
                  style={{ width: '18px', height: '18px' }}
                />
              </button>
            </div>
          )
        ) : (
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              background: '#94a3b8',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '50px',
            }}
          >
            غير متاح
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
                color: '#d97706',
                background: '#fef3c7',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: 700,
              }}
            >
              خيارات وأحجام ⚙️
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
