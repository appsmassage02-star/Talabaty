import React, { useState, useMemo } from 'react';
import type { Restaurant, MenuItem } from '../types';
import { biteBaitAssets } from '../assets';
import { BiteBaitStarRating } from '../components/BiteBaitStarRating';
import { BiteBaitFoodGrid } from '../components/BiteBaitFoodGrid';
import { BiteBaitQuickCheckout } from '../components/BiteBaitQuickCheckout';

interface BiteBaitRestaurantDetailViewProps {
  restaurant: Restaurant;
  menuItems: MenuItem[];
  cartCount: number;
  cartTotal: number;
  cartQuantities?: Record<string, number>;
  onNavigateBack: () => void;
  onOpenCart: () => void;
  onAddToCart?: (item: MenuItem) => void;
  onRemoveFromCart?: (item: MenuItem) => void;
  onOpenItemDetails?: (item: MenuItem) => void;
}

export const BiteBaitRestaurantDetailView: React.FC<BiteBaitRestaurantDetailViewProps> = ({
  restaurant,
  menuItems,
  cartCount,
  cartTotal,
  cartQuantities = {},
  onNavigateBack,
  onOpenCart,
  onAddToCart,
  onRemoveFromCart,
  onOpenItemDetails,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract menu categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set);
  }, [menuItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCategory =
        selectedCategory === 'All' || item.category === selectedCategory;

      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchCategory && matchSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  const banner = restaurant.bannerUrl || restaurant.logoUrl || biteBaitAssets.placeholder;

  return (
    <div className="bite-and-bait-scope">
      {/* Back Button */}
      <div style={{ marginBottom: '14px' }}>
        <button
          type="button"
          onClick={onNavigateBack}
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
          <span>العودة لقائمة المطاعم</span>
        </button>
      </div>

      {/* Restaurant Header Banner Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          marginBottom: '24px',
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '180px', background: '#0f172a' }}>
          <img
            src={banner}
            alt={restaurant.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = biteBaitAssets.placeholder;
            }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 70%)' }} />

          <div style={{ position: 'absolute', bottom: '16px', right: '20px', left: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', color: 'white' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'white' }}>
                  {restaurant.name}
                </h1>
                <img
                  src={biteBaitAssets.verify}
                  alt="موثق"
                  style={{ width: '18px', height: '18px' }}
                />
              </div>
              <p style={{ fontSize: '12.5px', color: '#cbd5e1', margin: '4px 0 0' }}>
                📍 {restaurant.address || 'القاهرة'}
              </p>
            </div>

            <div style={{ textAlign: 'left' }}>
              <BiteBaitStarRating
                rating={restaurant.rating || 4.5}
                size="md"
                showCount
                count={restaurant.reviewsCount || 0}
              />
            </div>
          </div>
        </div>

        {/* Restaurant Stats Bar */}
        <div
          style={{
            padding: '14px 20px',
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            alignItems: 'center',
            fontSize: '12.5px',
            color: '#475569',
            background: '#fafafa',
            borderTop: '1px solid #f1f5f9',
          }}
        >
          <span>⏱️ وقت التجهيز: <b>{restaurant.estimatedPrepTimeMinutes || 30} دقيقة</b></span>
          <span>🛵 رسوم التوصيل: <b>{restaurant.deliveryFee > 0 ? `${restaurant.deliveryFee} ج.م` : 'مجاني'}</b></span>
          <span>💵 الحد الأدنى: <b>{restaurant.minOrderAmount || 0} ج.م</b></span>
          <span>
            الحالة:{' '}
            <b style={{ color: restaurant.isOpen ? '#16a34a' : '#dc2626' }}>
              {restaurant.isOpen ? 'مفتوح ويستقبل الطلبات 🟢' : 'مغلق حالياً 🔴'}
            </b>
          </span>
        </div>
      </div>

      {/* Menu Filter and Search Bar */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="ابحث في قائمة أطباق المطعم..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '9px 12px',
            borderRadius: '12px',
            border: '1.5px solid #e2e8f0',
            fontSize: '13px',
            outline: 'none',
          }}
        />

        {/* Categories Pills */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              style={{
                border: 'none',
                background: selectedCategory === 'All' ? '#f59e0b' : '#f1f5f9',
                color: selectedCategory === 'All' ? '#0f172a' : '#475569',
                padding: '5px 12px',
                borderRadius: '50px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              الكل ({menuItems.length})
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
                  padding: '5px 12px',
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
      </div>

      {/* Menu Items Grid */}
      <BiteBaitFoodGrid
        items={filteredItems}
        title={selectedCategory === 'All' ? 'قائمة الطعام' : selectedCategory}
        cartQuantities={cartQuantities}
        onAddToCart={onAddToCart}
        onRemoveFromCart={onRemoveFromCart}
        onOpenDetails={onOpenItemDetails}
        emptyTitle="لا توجد أطباق في هذه الفئة"
        emptyDescription="لم نجد أي طبق في منيو المطعم يطابق البحث أو الفئة المحددة."
      />

      {/* Quick Floating Checkout Bar */}
      <BiteBaitQuickCheckout
        totalItems={cartCount}
        totalPrice={cartTotal}
        onOpenCart={onOpenCart}
      />
    </div>
  );
};
