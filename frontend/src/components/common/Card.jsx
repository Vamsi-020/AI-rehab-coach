import React from 'react';

const Card = ({
  title,
  subtitle,
  badge,
  action,
  hoverable = false,
  children,
  className = '',
  footer,
  ...props
}) => {
  const cardClasses = [
    'card',
    hoverable ? 'card-hover' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClasses} {...props}>
      {(title || subtitle || badge || action) && (
        <div className="card-header">
          <div className="card-title-group">
            {badge && <div style={{ marginBottom: 6 }}>{badge}</div>}
            {title && <h3>{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {action && <div className="card-action">{action}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>{footer}</div>}
    </div>
  );
};

export default Card;
