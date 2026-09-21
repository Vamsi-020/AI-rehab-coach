import React from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import PageHeader from '../components/common/PageHeader';
import Sidebar from '../components/common/Sidebar';
import {
  CheckCircleIcon,
  ActivityIcon,
  BarChartIcon,
  RefreshIcon,
  AlertCircleIcon,
} from '../components/common/Icons';

/**
 * SessionResultsPage Component.
 *
 * Phase 14: Displays structured session summary results upon routine completion or early exit.
 *
 * Clearly displays:
 * - SESSION COMPLETE (or SESSION CANCELLED)
 * - Repetitions completed vs target
 * - Movement Score (0–100)
 * - Elapsed Active Duration (MM:SS)
 * - Actionable Key Feedback
 * - Compliance / Non-diagnostic Disclaimer
 */
const SessionResultsPage = ({
  results,
  onNavigate,
  onRestart,
}) => {
  // Fallback defaults if accessed directly
  const data = results || {
    exercise_name: 'Seated Knee Extension',
    completed_reps: 12,
    target_reps: 12,
    duration: '04:15',
    movement_score: 88,
    key_feedback: [
      'Good range of motion',
      'Movement was consistent',
      'Great consistency. Continue following your prescribed plan.',
    ],
    completion_status: 'COMPLETED',
    disclaimer:
      'Application-defined exercise performance metric. Not a medical diagnosis or clinical recovery score.',
  };

  const isCancelled = data.completion_status === 'CANCELLED';

  return (
    <div className="dashboard-layout">
      <Sidebar activePage="session" onNavigate={onNavigate} role="patient" />

      <main className="dashboard-content">
        <PageHeader
          badge={isCancelled ? 'Session Exited Early' : 'Routine Summary'}
          title={isCancelled ? 'Session Cancelled' : 'Session Results'}
          description={`Comprehensive exercise performance overview for ${data.exercise_name}.`}
          action={
            <Button
              variant="outline"
              size="sm"
              icon={BarChartIcon}
              onClick={() => onNavigate('progress')}
            >
              View Progress
            </Button>
          }
        />

        <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Main Success / Summary Banner */}
          <div
            style={{
              padding: '24px 28px',
              borderRadius: 'var(--radius-lg)',
              background: isCancelled
                ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.12), rgba(234, 179, 8, 0.04))'
                : 'linear-gradient(135deg, rgba(34, 197, 94, 0.14), rgba(59, 130, 246, 0.08))',
              border: `1px solid ${isCancelled ? 'rgba(234, 179, 8, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: isCancelled ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                color: isCancelled ? '#eab308' : '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {isCancelled ? <AlertCircleIcon size={32} /> : <CheckCircleIcon size={32} />}
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isCancelled ? '#eab308' : '#22c55e',
                  marginBottom: 4,
                }}
              >
                {isCancelled ? 'SESSION CANCELLED' : 'SESSION COMPLETE'}
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                {isCancelled ? 'Session Finished Early' : 'Outstanding Effort! Routine Completed.'}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {isCancelled
                  ? 'Your partial movements were logged. Rest and resume your prescribed exercise when ready.'
                  : 'Your therapeutic repetition telemetry and movement quality have been safely saved.'}
              </p>
            </div>
          </div>

          {/* Three Key Telemetry Highlights */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
            }}
          >
            {/* 1. Repetitions */}
            <Card>
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Repetitions
                </div>
                <div style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--primary-600)', lineHeight: 1.1, marginTop: 8 }}>
                  {data.completed_reps}{' '}
                  <span style={{ fontSize: '1.3rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    / {data.target_reps} Reps
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  {data.completed_reps >= data.target_reps
                    ? '100% Target Goal Met'
                    : `${Math.round((data.completed_reps / data.target_reps) * 100)}% Prescribed Target`}
                </div>
              </div>
            </Card>

            {/* 2. Movement Score */}
            <Card>
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Movement Score
                </div>
                <div style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--primary-600)', lineHeight: 1.1, marginTop: 8 }}>
                  {data.movement_score}{' '}
                  <span style={{ fontSize: '1.3rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    / 100
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  {data.movement_score >= 85
                    ? 'Excellent Biomechanical Quality'
                    : 'Controlled Form Accuracy'}
                </div>
              </div>
            </Card>

            {/* 3. Duration */}
            <Card>
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Duration
                </div>
                <div style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--primary-600)', lineHeight: 1.1, marginTop: 8 }}>
                  {data.duration}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  Active Time Under Tension
                </div>
              </div>
            </Card>
          </div>

          {/* Key Feedback Card */}
          <Card title="Key Feedback" subtitle="Biomechanical Insights & Form Guidance">
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                fontSize: '0.94rem',
                color: 'var(--text-body)',
                lineHeight: 1.5,
              }}
            >
              {data.key_feedback.map((msg, i) => (
                <li key={i} style={{ fontWeight: 500 }}>
                  {msg}
                </li>
              ))}
            </ul>

            {/* Quote banner */}
            <div
              style={{
                marginTop: 16,
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-subtle)',
                fontSize: '0.86rem',
                color: 'var(--text-main)',
                fontStyle: 'italic',
                borderLeft: '3px solid var(--primary-600)',
              }}
            >
              "Great consistency. Continue following your prescribed plan."
            </div>
          </Card>

          {/* Action Dock */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                variant="outline"
                size="md"
                onClick={() => onNavigate('exercises')}
              >
                Choose Another Exercise
              </Button>
              {onRestart && (
                <Button
                  variant="secondary"
                  size="md"
                  icon={RefreshIcon}
                  onClick={onRestart}
                >
                  Repeat Session
                </Button>
              )}
            </div>

            <Button
              variant="primary"
              size="md"
              icon={BarChartIcon}
              onClick={() => onNavigate('progress')}
            >
              View Progress Analytics
            </Button>
          </div>

          {/* Mandatory Clinical Disclaimer */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              padding: '8px 16px',
            }}
          >
            {data.disclaimer}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SessionResultsPage;
