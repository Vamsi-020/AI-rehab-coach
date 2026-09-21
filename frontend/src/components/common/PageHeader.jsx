import React from 'react';

const PageHeader = ({
  title,
  description,
  badge,
  action,
  className = '',
}) => {
  return (
    <div className={`page-header ${className}`}>
      <div className="page-header-info">
        {badge && <span className="page-badge">{badge}</span>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-header-actions">{action}</div>}
    </div>
  );
};

export default PageHeader;
