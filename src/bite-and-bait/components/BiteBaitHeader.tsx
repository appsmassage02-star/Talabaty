import React from 'react';
import { biteBaitAssets } from '../assets';

interface BiteBaitHeaderProps {
  onSearch?: (query: string) => void;
  searchQuery?: string;
  onExploreClick?: () => void;
}

export const BiteBaitHeader: React.FC<BiteBaitHeaderProps> = ({
  onSearch,
  searchQuery = '',
  onExploreClick,
}) => {
  return (
    <div className="bnb-header">
      {/* Background Image */}
      <img
        src={biteBaitAssets.header_img}
        alt="Bite & Bait"
        className="bnb-header-bg"
      />
      <div className="bnb-header-overlay" />

      {/* Content */}
      <div className="bnb-header-content">
        <div className="bnb-header-badge">
          <span>✨</span>
          <span>بايت آند بيت | Bite & Bait</span>
        </div>

        <h1 className="bnb-header-title">
          اطلب أشهى الوجبات والمأكولات المنزلية السريعة
        </h1>

        <p className="bnb-header-desc">
          اكتشف أفضل المطابخ والمطاعم المعتمدة القريبة منك، مع توصيل مباشر وسريع لباب منزلك.
        </p>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
          {onExploreClick && (
            <button
              type="button"
              className="bnb-header-cta"
              onClick={onExploreClick}
            >
              استعراض قائمة الأطعمة 👈
            </button>
          )}

          {/* Integrated Search Input */}
          {onSearch && (
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '12px',
                padding: '0 12px',
                minWidth: '220px',
                flex: '1',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <img
                src={biteBaitAssets.search_icon}
                alt="بحث"
                style={{ width: '16px', height: '16px', opacity: 0.6 }}
              />
              <input
                type="text"
                placeholder="ابحث عن مطعم أو وجبة..."
                value={searchQuery}
                onChange={(e) => onSearch(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  padding: '9px 8px',
                  fontSize: '12.5px',
                  width: '100%',
                  color: '#0f172a',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearch('')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#94a3b8',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
