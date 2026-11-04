import React, { useState, useEffect } from 'react';
import type { BiteBaitPromoSlide } from '../types';
import { PREVIEW_PROMO_SLIDES } from '../previewData';

interface BiteBaitPromoSliderProps {
  slides?: BiteBaitPromoSlide[];
  onSlideClick?: (slide: BiteBaitPromoSlide) => void;
}

export const BiteBaitPromoSlider: React.FC<BiteBaitPromoSliderProps> = ({
  slides = PREVIEW_PROMO_SLIDES,
  onSlideClick,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto transition every 4.5 seconds unless hovered/paused
  useEffect(() => {
    if (isPaused || slides.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [isPaused, slides.length]);

  if (!slides || slides.length === 0) return null;

  const currentSlide = slides[currentIndex];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  return (
    <div
      className="bnb-promo-slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        position: 'relative',
        borderRadius: '20px',
        overflow: 'hidden',
        marginBottom: '20px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        background: currentSlide.backgroundColor,
        minHeight: '210px',
        display: 'flex',
        alignItems: 'center',
        transition: 'background 0.5s ease',
      }}
    >
      {/* Background Hero Image with Fade */}
      <img
        src={currentSlide.imageUrl}
        alt={currentSlide.title}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.35,
          transition: 'opacity 0.5s ease',
        }}
      />

      {/* Gradient Overlay for Readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.65) 60%, rgba(15,23,42,0.4) 100%)',
        }}
      />

      {/* Slide Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '24px 28px',
          maxWidth: '560px',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              background: '#f59e0b',
              color: '#0f172a',
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '50px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {currentSlide.badge}
          </span>

          {currentSlide.discountTag && (
            <span
              style={{
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '50px',
              }}
            >
              🏷️ {currentSlide.discountTag}
            </span>
          )}
        </div>

        <h2
          style={{
            fontSize: '20px',
            fontWeight: 800,
            margin: '4px 0 0',
            color: '#ffffff',
            lineHeight: 1.3,
          }}
        >
          {currentSlide.title}
        </h2>

        <p
          style={{
            fontSize: '12.5px',
            color: '#e2e8f0',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {currentSlide.subtitle}
        </p>

        <div style={{ marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => onSlideClick && onSlideClick(currentSlide)}
            style={{
              background: '#f59e0b',
              color: '#0f172a',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
              transition: 'transform 0.15s ease',
            }}
          >
            <span>{currentSlide.ctaText}</span>
            <span>👈</span>
          </button>
        </div>
      </div>

      {/* Manual Navigation Arrows */}
      <button
        type="button"
        onClick={handlePrev}
        aria-label="الشريحة السابقة"
        style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 3,
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 800,
          transition: 'background 0.2s ease',
        }}
      >
        ❯
      </button>

      <button
        type="button"
        onClick={handleNext}
        aria-label="الشريحة التالية"
        style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 3,
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 800,
          transition: 'background 0.2s ease',
        }}
      >
        ❮
      </button>

      {/* Slide Indicators (Dots) */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 3,
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
        }}
      >
        {slides.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(idx);
            }}
            aria-label={`شريحة ${idx + 1}`}
            style={{
              width: currentIndex === idx ? '22px' : '7px',
              height: '7px',
              borderRadius: '50px',
              background: currentIndex === idx ? '#f59e0b' : 'rgba(255, 255, 255, 0.5)',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
};
