import React from 'react';

const NavigationTabs = ({
  tabs = [],
  activeTab,
  onTabChange,
  className = '',
}) => {
  return (
    <div className={`nav-tabs ${className}`}>
      {tabs.map((tab) => {
        const id = typeof tab === 'string' ? tab : tab.id;
        const label = typeof tab === 'string' ? tab : tab.label;
        const count = tab.count;
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            type="button"
            className={`nav-tab-item ${isActive ? 'active' : ''}`}
            onClick={() => onTabChange(id)}
          >
            {label}
            {count !== undefined && (
              <span
                style={{
                  marginLeft: 6,
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  background: isActive ? 'var(--primary-100)' : 'var(--bg-subtle)',
                  color: isActive ? 'var(--primary-800)' : 'var(--text-muted)',
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default NavigationTabs;
