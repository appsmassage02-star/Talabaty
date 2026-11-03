import React from 'react';

interface BiteBaitStarRatingProps {
  rating: number; // 0 to 5
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  showCount?: boolean;
  count?: number;
}

export const BiteBaitStarRating: React.FC<BiteBaitStarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 'md',
  interactive = false,
  onRatingChange,
  showCount = false,
  count,
}) => {
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);

  const activeRating = hoverRating !== null ? hoverRating : rating;

  const starSizePx = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;

  return (
    <div
      className={`star-rating star-${size} ${interactive ? 'interactive' : ''}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}
    >
      {Array.from({ length: maxRating }).map((_, index) => {
        const starValue = index + 1;
        const isFull = starValue <= Math.round(activeRating);

        return (
          <span
            key={starValue}
            className={`star ${isFull ? 'star-full' : 'star-empty'}`}
            style={{
              cursor: interactive ? 'pointer' : 'default',
              color: isFull ? '#f59e0b' : '#cbd5e1',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            onMouseEnter={() => interactive && setHoverRating(starValue)}
            onMouseLeave={() => interactive && setHoverRating(null)}
            onClick={() => interactive && onRatingChange && onRatingChange(starValue)}
          >
            <svg
              width={starSizePx}
              height={starSizePx}
              viewBox="0 0 24 24"
              fill={isFull ? '#f59e0b' : 'none'}
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </span>
        );
      })}

      {showCount && typeof count === 'number' && (
        <span className="star-count" style={{ fontSize: '11.5px', color: '#64748b', marginRight: '6px' }}>
          ({count})
        </span>
      )}
    </div>
  );
};
