import React from 'react';
import { PlayIcon, ActivityIcon, DumbbellIcon } from '../common/Icons';
import Button from '../common/Button';

const ExerciseCard = ({
  title,
  category,
  difficulty = 'Gentle', // 'Gentle', 'Moderate', 'Advanced'
  targetReps = '10-12 Reps',
  targetSets = '3 Sets',
  targetJoint = 'Knee Extension',
  description,
  onStart,
}) => {
  const getDifficultyBadge = (diff) => {
    switch (diff) {
      case 'Gentle':
        return <span className="badge badge-success">Gentle</span>;
      case 'Moderate':
        return <span className="badge badge-warning">Moderate</span>;
      case 'Advanced':
        return <span className="badge badge-danger">Advanced</span>;
      default:
        return <span className="badge badge-neutral">{diff}</span>;
    }
  };

  return (
    <div className="exercise-card">
      <div className="exercise-card-thumb">
        <DumbbellIcon size={48} />
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          {getDifficultyBadge(difficulty)}
        </div>
      </div>

      <div className="exercise-card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="badge badge-primary">{category}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{targetJoint}</span>
        </div>

        <h4 style={{ margin: '12px 0 6px', fontSize: '1.15rem', color: 'var(--text-main)' }}>
          {title}
        </h4>

        {description && (
          <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            {description}
          </p>
        )}

        <div className="exercise-meta">
          <div className="exercise-meta-item">
            <ActivityIcon size={14} />
            <span>{targetReps}</span>
          </div>
          <span>•</span>
          <div className="exercise-meta-item">
            <span>{targetSets}</span>
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            icon={PlayIcon}
            onClick={onStart}
          >
            Start AI Guidance
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExerciseCard;
