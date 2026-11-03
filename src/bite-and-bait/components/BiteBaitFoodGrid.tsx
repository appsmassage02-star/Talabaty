import React from 'react';
import type { MenuItem } from '../types';
import { BiteBaitFoodCard } from './BiteBaitFoodCard';
import { BiteBaitEmptyState } from './BiteBaitEmptyState';

interface BiteBaitFoodGridProps {
  items: MenuItem[];
  title?: string;
  cartQuantities?: Record<string, number>; // menuItemId -> count
  onAddToCart?: (item: MenuItem) => void;
  onRemoveFromCart?: (item: MenuItem) => void;
  onOpenDetails?: (item: MenuItem) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export const BiteBaitFoodGrid: React.FC<BiteBaitFoodGridProps> = ({
  items,
  title = 'أفضل المأكولات والأطباق',
  cartQuantities = {},
  onAddToCart,
  onRemoveFromCart,
  onOpenDetails,
  emptyTitle = 'لا توجد أطباق متاحة حالياً',
  emptyDescription = 'لم يتم العثور على أطباق تطابق الفئة المحددة أو شروط البحث.',
}) => {
  return (
    <div style={{ marginBottom: '32px' }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 className="bnb-section-heading">
            <span>🍔</span>
            <span>{title}</span>
          </h2>
          <span className="bnb-section-sub">
            ({items.length} صنف)
          </span>
        </div>
      )}

      {items.length === 0 ? (
        <BiteBaitEmptyState
          icon="🍲"
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <div className="bnb-foods-grid">
          {items.map((item) => (
            <BiteBaitFoodCard
              key={item.id}
              item={item}
              quantityInCart={cartQuantities[item.id] || 0}
              onAddToCart={onAddToCart}
              onRemoveFromCart={onRemoveFromCart}
              onOpenDetails={onOpenDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
};
