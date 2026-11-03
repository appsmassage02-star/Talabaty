import React from 'react';

interface BiteBaitEmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const BiteBaitEmptyState: React.FC<BiteBaitEmptyStateProps> = ({
  icon = '🍽️',
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '50px 20px',
        background: '#ffffff',
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        margin: '20px 0',
      }}
    >
      <div style={{ fontSize: '48px', marginBottom: '14px', lineHeight: 1 }}>{icon}</div>
      <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: '13px',
            color: '#64748b',
            maxWidth: '380px',
            margin: '0 auto 18px',
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="bnb-header-cta"
          style={{ margin: '0 auto', display: 'inline-flex' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
