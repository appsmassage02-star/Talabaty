import React from 'react';
import type { RestaurantCategory } from '../types';

interface BiteBaitExploreMenuProps {
  categories: RestaurantCategory[];
  selectedCategory: string; // 'All' or category name
  onSelectCategory: (categoryName: string) => void;
}

export const BiteBaitExploreMenu: React.FC<BiteBaitExploreMenuProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="bnb-explore-menu">
      <div className="bnb-explore-title-row">
        <div>
          <h2 className="bnb-section-heading">
            <span>🍕</span>
            <span>استكشف تصنيفات الطعام</span>
          </h2>
          <p className="bnb-section-sub">
            اختر الفئة المفضلة لتصفية أشهى الأطباق والوجبات السريعة
          </p>
        </div>
      </div>

      <div className="bnb-categories-scroll">
        {/* Special 'All' / الكل Chip */}
        <button
          type="button"
          className={`bnb-category-chip ${selectedCategory === 'All' ? 'active' : ''}`}
          onClick={() => onSelectCategory('All')}
        >
          <div className={`bnb-category-circle ${selectedCategory === 'All' ? 'active' : ''}`}>
            <span>🍽️</span>
          </div>
          <span className="bnb-category-label">الكل</span>
        </button>

        {/* Dynamic Categories */}
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.name;
          return (
            <button
              key={cat.id}
              type="button"
              className={`bnb-category-chip ${isActive ? 'active' : ''}`}
              onClick={() => onSelectCategory(cat.name)}
            >
              <div className={`bnb-category-circle ${isActive ? 'active' : ''}`}>
                {cat.image_url ? (
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span>{cat.icon || '🍲'}</span>
                )}
              </div>
              <span className="bnb-category-label">{cat.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
