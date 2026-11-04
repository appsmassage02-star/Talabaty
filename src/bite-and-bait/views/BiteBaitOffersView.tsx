import React, { useState, useMemo } from 'react';
import type { MenuItem, BiteBaitView, FoodOffer } from '../types';
import { BiteBaitFoodCard } from '../components/BiteBaitFoodCard';
import { BiteBaitEmptyState } from '../components/BiteBaitEmptyState';

interface BiteBaitOffersViewProps {
  foods?: MenuItem[];
  offers?: FoodOffer[];
  isLoadingOffers?: boolean;
  offersError?: string | null;
  onRetryOffers?: () => void;
  cartQuantities?: Record<string, number>;
  favoriteFoodIds?: string[];
  onNavigateView: (view: BiteBaitView, meta?: { restaurantId?: string }) => void;
  onAddToCart?: (item: MenuItem) => void;
  onRemoveFromCart?: (item: MenuItem) => void;
  onOpenDetails?: (item: MenuItem) => void;
  onToggleFavoriteFood?: (foodId: string) => void;
}

export const BiteBaitOffersView: React.FC<BiteBaitOffersViewProps> = ({
  foods = [],
  offers = [],
  isLoadingOffers = false,
  offersError = null,
  onRetryOffers,
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
          🔥 عروض وتخفيضات بايت آند بيت ({offers.length + offerFoods.length})
        </h1>
      </div>

      {/* Loading & Error States */}
      {isLoadingOffers ? (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              border: '3px solid #f3f4f6',
              borderTopColor: '#f59e0b',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 10px',
            }}
          />
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#334155' }}>
            جاري قراءة العروض الحالية من قاعدة البيانات...
          </div>
        </div>
      ) : offersError ? (
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
            background: '#fef2f2',
            borderRadius: '16px',
            border: '1.5px solid #fca5a5',
            marginBottom: '20px',
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '6px' }}>⚠️</div>
          <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#991b1b', marginBottom: '4px' }}>
            تعذر استرجاع عروض المطاعم
          </div>
          <div style={{ fontSize: '12px', color: '#b91c1c', marginBottom: '12px' }}>
            {offersError}
          </div>
          {onRetryOffers && (
            <button
              type="button"
              onClick={onRetryOffers}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🔄 إعادة المحاولة
            </button>
          )}
        </div>
      ) : null}

      {/* Real Restaurant Offers Section (from restaurant_offers) */}
      {offers.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🏷️</span>
            <span>عروض المطاعم الحصرية المعتمدة</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {offers.map((offer) => (
              <div
                key={offer.id}
                onClick={() => onNavigateView('restaurant', { restaurantId: offer.restaurantId })}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ position: 'relative', height: '130px', width: '100%', background: '#0f172a' }}>
                  <img
                    src={offer.bannerUrl}
                    alt={offer.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#dc2626', color: '#ffffff', fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '50px', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                    {offer.badge}
                  </div>
                </div>
                <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', marginBottom: '4px' }}>
                    🏪 {offer.restaurantName}
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                    {offer.title}
                  </h3>
                  {offer.description && (
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px', flex: 1 }}>
                      {offer.description}
                    </p>
                  )}
                  <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      ⏳ {offer.validUntil}
                    </span>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563eb' }}>
                      طلب العرض 👈
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter Pills for Foods with Offers */}
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
            وجبات العروض ({offerFoods.length})
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

      {/* Offers / Dishes Grid */}
      {filtered.length === 0 && offers.length === 0 && !isLoadingOffers ? (
        <BiteBaitEmptyState
          icon="🏷️"
          title="لا توجد عروض حالياً في قاعدة البيانات"
          description="لم يتم تسجيل عروض نشطة في جدول restaurant_offers حالياً. ترقبوا أحدث العروض قريباً."
          actionLabel="تصفح قائمة المطاعم 👈"
          onAction={() => onNavigateView('restaurants')}
        />
      ) : (
        filtered.length > 0 && (
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
        )
      )}
    </div>
  );
};
