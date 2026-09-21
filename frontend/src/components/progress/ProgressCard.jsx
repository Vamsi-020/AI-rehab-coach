import React from 'react';
import Card from '../common/Card';

const ProgressCard = ({
  title,
  value,
  unit = '',
  trend,
  trendDirection = 'positive', // 'positive', 'neutral', 'negative'
  progressPercentage,
  subtitle,
  icon: Icon,
  className = '',
}) => {
  return (
    <Card className={`progress-card ${className}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {title}
        </span>
        {Icon && (
          <div
            style={{
              padding: 8,
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary-50)',
              color: 'var(--primary-600)',
            }}
          >
            <Icon size={18} />
          </div>
        )}
      </div>

      <div className="stat-value">
        {value}
        {unit && <span style={{ fontSize: '1rem', fontWeight: 500, marginLeft: 4, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>

      {trend && (
        <div className={`stat-trend ${trendDirection}`}>
          <span>{trendDirection === 'positive' ? '↑' : trendDirection === 'negative' ? '↓' : '•'}</span>
          <span>{trend}</span>
        </div>
      )}

      {progressPercentage !== undefined && (
        <div className="progress-bar-container">
          <div
            className={`progress-bar-fill ${progressPercentage >= 80 ? 'success' : ''}`}
            style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
          />
        </div>
      )}

      {subtitle && (
        <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {subtitle}
        </div>
      )}
    </Card>
  );
};

export default ProgressCard;
