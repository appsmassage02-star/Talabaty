import React, { useState, useMemo } from 'react';
import type { MenuItem, BiteBaitView } from '../types';
import { BiteBaitFoodCard } from '../components/BiteBaitFoodCard';
import { BiteBaitEmptyState } from '../components/BiteBaitEmptyState';

interface BiteBaitOffersViewProps {
  foods: MenuItem[];
  cartQuantities?: Record<string, number>;
  favoriteFoodIds?: string[];
  onNavigateView: (view: BiteBaitView, meta?: { restaurantId?: string }) => void;
  onAddToCart?: (item: MenuItem) => void;
  onRemoveFromCart?: (item: MenuItem) => void;
  onOpenDetails?: (item: MenuItem) => void;
  onToggleFavoriteFood?: (foodId: string) => void;
}

export const BiteBaitOffersView: React.FC<BiteBaitOffersViewProps> = ({
  foods,
  cartQuantities = {},
  favoriteFoodIds = [],
  onNavigateView,
  onAddToCart,
  onRemoveFromCart,
  onOpenDetails,
  onToggleFavoriteFood,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Filter items that have offers or discounts
  const offerFoods = useMemo(() => {
    return foods.filter((f) => f.isOffer || (f.originalPrice && f.originalPrice > f.price));
  }, [foods]);

  // Extract categories available among offers
  const categories = useMemo(() => {
    const set = new Set<string>();
    offerFoods.forEach((f) => {
      if (f.category) set.add(f.category);
    });
    return Array.from(set);
  }, [offerFoods]);

  const filtered = useMemo(() => {
    if (selectedCategory === 'All') return offerFoods;
    return offerFoods.filter((f) => f.category === selectedCategory);
  }, [offerFoods, selectedCategory]);

  return (
    <div className="bite-and-bait-scope">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => onNavigateView('home')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            padding: '7px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 700,
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          <span>→</span>
          <span>الرئيسية</span>
        </button>

        <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          🔥 عروض وتخفيضات بايت آند بيت ({offerFoods.length})
        </h1>
      </div>

      {/* Local Simulation Disclaimer Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
          border: '1.5px solid #fdba74',
          borderRadius: '16px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span style={{ fontSize: '20px' }}>🏷️</span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#9a3412' }}>
            عروض وخصومات تجريبية محتسبة محلياً
          </div>
          <div style={{ fontSize: '11px', color: '#c2410c' }}>
            توضح هذه الشاشة طريقة حساب نسبة الخصم ومبلغ التوفير محلياً لكل وجبة دون ادعاء أسعار حقيقية.
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            style={{
              border: 'none',
              background: selectedCategory === 'All' ? '#f59e0b' : '#f1f5f9',
              color: selectedCategory === 'All' ? '#0f172a' : '#475569',
              padding: '6px 14px',
              borderRadius: '50px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            جميع العروض ({offerFoods.length})
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCategory(c)}
              style={{
                border: 'none',
                background: selectedCategory === c ? '#f59e0b' : '#f1f5f9',
                color: selectedCategory === c ? '#0f172a' : '#475569',
                padding: '6px 14px',
                borderRadius: '50px',
                fontSize: '12px',
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

      {/* Offers Grid */}
      {filtered.length === 0 ? (
        <BiteBaitEmptyState
          icon="🏷️"
          title="لا توجد عروض في هذا القسم حالياً"
          description="تابعنا باستمرار للاستفادة من أقوى العروض والخصومات القادمة."
          actionLabel="العودة لجميع العروض 👈"
          onAction={() => setSelectedCategory('All')}
        />
      ) : (
        <div className="bnb-foods-grid">
          {filtered.map((item) => {
            const savings = item.originalPrice ? item.originalPrice - item.price : 0;
            const discountPct = item.originalPrice
              ? Math.round((savings / item.originalPrice) * 100)
              : 0;

            return (
              <div key={item.id} style={{ position: 'relative' }}>
                {savings > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '12px',
                      zIndex: 4,
                      background: '#dc2626',
                      color: '#ffffff',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '50px',
                      boxShadow: '0 2px 6px rgba(220, 38, 38, 0.35)',
                    }}
                  >
                    وفر {savings} ج.م ({discountPct}%)
                  </div>
                )}
                <BiteBaitFoodCard
                  item={item}
                  quantityInCart={cartQuantities[item.id] || 0}
                  onAddToCart={onAddToCart}
                  onRemoveFromCart={onRemoveFromCart}
                  onOpenDetails={onOpenDetails}
                  isFavorite={favoriteFoodIds.includes(item.id)}
                  onToggleFavorite={onToggleFavoriteFood}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
