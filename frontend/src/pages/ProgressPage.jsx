/**
 * ProgressPage — Phase 15
 *
 * Patient-facing analytics dashboard. Wired to the live Phase 15 backend
 * endpoints (/progress/analytics, /progress/history, /progress/exercises).
 *
 * Features:
 *  - Summary metric cards (sessions, reps, avg quality, streak)
 *  - Movement quality trend chart (pure SVG line chart)
 *  - Reps-per-session bar chart (pure SVG)
 *  - Exercise selector / filter
 *  - Per-exercise breakdown table
 *  - Session history table (paginated)
 *  - Loading skeleton state
 *  - Error state with retry
 *  - Empty state when no sessions exist
 *
 * Disclaimer: All metrics are application-defined performance indicators.
 * They do NOT constitute medical diagnoses or clinical recovery scores.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIcon,
  BarChartIcon,
  CalendarIcon,
  CheckCircleIcon,
  RefreshIcon,
  SparklesIcon,
} from '../components/common/Icons';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import PageHeader from '../components/common/PageHeader';
import ProgressCard from '../components/progress/ProgressCard';
import Sidebar from '../components/common/Sidebar';
import {
  getMyAnalytics,
  getMyExerciseProgress,
  getMyHistory,
} from '../api/client';
import { useAuth } from '../context/AuthContext';

// ─── Colours ──────────────────────────────────────────────────────────────────
const C = {
  primary: '#0284c7',
  primaryLight: '#38bdf8',
  teal: '#14b8a6',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  muted: '#64748b',
  border: '#e2e8f0',
  bg: '#f8fafc',
  surface: '#ffffff',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diff === 1) return `Yesterday`;
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function qualityColor(score) {
  if (score >= 90) return C.success;
  if (score >= 75) return C.primary;
  if (score >= 60) return C.warning;
  return C.danger;
}

function qualityLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Needs Work';
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

function LineChart({ data, label, color = C.primary, unit = '' }) {
  const W = 100;
  const H = 60;
  const PAD = 6;

  if (!data || data.length === 0) {
    return (
      <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: '0.8rem' }}>
        No data yet
      </div>
    );
  }

  if (data.length === 1) {
    const v = data[0].value;
    return (
      <div style={{ height: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <span style={{ fontSize: '1.8rem', fontWeight: 700, color }}>{v}{unit}</span>
        <span style={{ fontSize: '0.75rem', color: C.muted }}>1 session recorded</span>
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const toSvgX = (i) => PAD + (i / (data.length - 1)) * (W - 2 * PAD);
  const toSvgY = (v) => PAD + (1 - (v - min) / range) * (H - 2 * PAD);

  const points = data.map((d, i) => `${toSvgX(i)},${toSvgY(d.value)}`).join(' ');
  const areaPoints = [
    `${toSvgX(0)},${H}`,
    ...data.map((d, i) => `${toSvgX(i)},${toSvgY(d.value)}`),
    `${toSvgX(data.length - 1)},${H}`,
  ].join(' ');

  const latest = values[values.length - 1];
  const first = values[0];
  const trend = latest - first;
  const trendColor = trend >= 0 ? C.success : C.danger;
  const trendSymbol = trend >= 0 ? '▲' : '▼';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
        <span style={{ fontSize: '0.75rem', color: C.muted }}>{label}</span>
        <span style={{ fontSize: '0.8rem', color: trendColor, fontWeight: 600 }}>
          {trendSymbol} {Math.abs(trend).toFixed(1)}{unit}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 90, display: 'block', overflow: 'visible' }}
      >
        {/* Area fill */}
        <polygon points={areaPoints} fill={color} opacity={0.08} />
        {/* Line */}
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {data.map((d, i) => (
          <circle key={i} cx={toSvgX(i)} cy={toSvgY(d.value)} r="2" fill={color} />
        ))}
        {/* Latest value label */}
        <text
          x={toSvgX(data.length - 1)}
          y={toSvgY(latest) - 4}
          textAnchor="middle"
          fontSize="5"
          fill={color}
          fontWeight="700"
        >
          {Math.round(latest)}{unit}
        </text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: C.muted, marginTop: 2 }}>
        <span>{data[0]?.label || data[0]?.date}</span>
        <span>{data[data.length - 1]?.label || data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────

function BarChart({ data, color = C.teal, unit = '' }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: '0.8rem' }}>
        No data yet
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 1);
  const barW = Math.max(4, Math.floor(200 / data.length) - 2);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90, paddingBottom: 4 }}>
      {data.map((d, i) => {
        const h = Math.round((d.value / maxVal) * 70);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '0.6rem', color, fontWeight: 700, marginBottom: 2 }}>
              {d.value > 0 ? d.value : ''}
            </span>
            <div
              style={{
                width: '70%',
                maxWidth: barW,
                height: `${Math.max(h, 2)}px`,
                background: `linear-gradient(180deg, ${color} 0%, ${C.primary} 100%)`,
                borderRadius: '3px 3px 0 0',
                opacity: 0.85 + 0.15 * (i / data.length),
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ h = 140, borderRadius = 12 }) {
  return (
    <div
      style={{
        height: h,
        borderRadius,
        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onNavigate }) {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: '56px 24px' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>📊</div>
        <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>No sessions logged yet</h3>
        <p style={{ color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto 24px' }}>
          Complete your first exercise session to start tracking your performance here.
          Your session history, movement quality, and repetition data will appear automatically.
        </p>
        <Button
          variant="primary"
          size="md"
          icon={ActivityIcon}
          onClick={() => onNavigate?.('session')}
        >
          Start First Session
        </Button>
      </div>
    </Card>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }) {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
        <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>Could not load progress data</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>{message}</p>
        <Button variant="outline" size="sm" icon={RefreshIcon} onClick={onRetry}>
          Try Again
        </Button>
      </div>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const EXERCISES = ['All Exercises', 'Knee Flexion', 'Shoulder Raise', 'Squat'];

const ProgressPage = ({ onNavigate }) => {
  const { isAuthenticated } = useAuth();

  // ── State ──
  const [analytics, setAnalytics] = useState(null);
  const [history, setHistory] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [errorAnalytics, setErrorAnalytics] = useState(null);
  const [errorHistory, setErrorHistory] = useState(null);

  const [exerciseFilter, setExerciseFilter] = useState('All Exercises');
  const [historyPage, setHistoryPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);

  const cancelledRef = useRef(false);

  // ── Fetch analytics ──
  useEffect(() => {
    if (!isAuthenticated) {
      setLoadingAnalytics(false);
      setErrorAnalytics('Please log in to view your progress.');
      return;
    }

    cancelledRef.current = false;
    setLoadingAnalytics(true);
    setErrorAnalytics(null);

    getMyAnalytics()
      .then((data) => { if (!cancelledRef.current) { setAnalytics(data); setLoadingAnalytics(false); } })
      .catch((err) => { if (!cancelledRef.current) { setErrorAnalytics(err.message || 'Failed to load analytics.'); setLoadingAnalytics(false); } });

    return () => { cancelledRef.current = true; };
  }, [isAuthenticated, retryKey]);

  // ── Fetch history ──
  useEffect(() => {
    if (!isAuthenticated) { setLoadingHistory(false); return; }

    cancelledRef.current = false;
    setLoadingHistory(true);
    setErrorHistory(null);

    const ex = exerciseFilter !== 'All Exercises' ? exerciseFilter : null;
    getMyHistory({ page: historyPage, pageSize: 10, exercise: ex })
      .then((data) => { if (!cancelledRef.current) { setHistory(data); setLoadingHistory(false); } })
      .catch((err) => { if (!cancelledRef.current) { setErrorHistory(err.message || 'Failed to load history.'); setLoadingHistory(false); } });

    return () => { cancelledRef.current = true; };
  }, [isAuthenticated, exerciseFilter, historyPage, retryKey]);

  const handleRetry = useCallback(() => {
    setRetryKey((k) => k + 1);
    setHistoryPage(1);
  }, []);

  const handleFilterChange = (ex) => {
    setExerciseFilter(ex);
    setHistoryPage(1);
  };

  // ── Loading ──
  if (loadingAnalytics) {
    return (
      <div className="dashboard-layout">
        <Sidebar activePage="progress" onNavigate={onNavigate} role="patient" />
        <main className="dashboard-content">
          <PageHeader badge="Loading…" title="Progress & Analytics" description="Fetching your session data…" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} h={130} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <Skeleton h={200} />
            <Skeleton h={200} />
          </div>
          <Skeleton h={300} />
        </main>
      </div>
    );
  }

  // ── Error (analytics) ──
  if (errorAnalytics && !analytics) {
    return (
      <div className="dashboard-layout">
        <Sidebar activePage="progress" onNavigate={onNavigate} role="patient" />
        <main className="dashboard-content">
          <PageHeader badge="Error" title="Progress & Analytics" description="" />
          <ErrorState message={errorAnalytics} onRetry={handleRetry} />
        </main>
      </div>
    );
  }

  const a = analytics;

  // ── Empty state ──
  if (a && a.session_count === 0) {
    return (
      <div className="dashboard-layout">
        <Sidebar activePage="progress" onNavigate={onNavigate} role="patient" />
        <main className="dashboard-content">
          <PageHeader
            badge="No Sessions Yet"
            title="Progress & Analytics"
            description="Your performance data will appear here once you complete sessions."
          />
          <EmptyState onNavigate={onNavigate} />
        </main>
      </div>
    );
  }

  // ── Main view ──
  const totalPages = history ? Math.ceil(history.total / 10) : 1;

  return (
    <div className="dashboard-layout">
      <Sidebar activePage="progress" onNavigate={onNavigate} role="patient" />

      <main className="dashboard-content">
        <PageHeader
          badge="Live Analytics"
          title="Progress & Analytics"
          description="Session performance metrics computed from your training history. Not a medical assessment."
          action={
            <Button variant="outline" size="sm" icon={RefreshIcon} onClick={handleRetry}>
              Refresh
            </Button>
          }
        />

        {/* ── Summary Cards ── */}
        <div className="dashboard-grid" style={{ marginBottom: 28 }}>
          <div className="col-3">
            <ProgressCard
              title="Total Sessions"
              value={String(a?.session_count ?? 0)}
              unit="Sessions"
              trend={`${a?.active_streak_days ?? 0}-day active streak`}
              trendDirection="positive"
              progressPercentage={Math.min(100, (a?.session_count ?? 0) * 5)}
              icon={CheckCircleIcon}
              subtitle="Completed exercise sessions"
            />
          </div>
          <div className="col-3">
            <ProgressCard
              title="Total Repetitions"
              value={String(a?.total_reps_completed ?? 0)}
              unit="Reps"
              trend={`Across ${a?.session_count ?? 0} sessions`}
              trendDirection="positive"
              progressPercentage={Math.min(100, ((a?.total_reps_completed ?? 0) / 500) * 100)}
              icon={ActivityIcon}
              subtitle="Cumulative repetitions"
            />
          </div>
          <div className="col-3">
            <ProgressCard
              title="Avg Movement Quality"
              value={String(Math.round(a?.avg_form_accuracy_pct ?? 0))}
              unit="%"
              trend={qualityLabel(a?.avg_form_accuracy_pct ?? 0)}
              trendDirection={a?.avg_form_accuracy_pct >= 75 ? 'positive' : 'neutral'}
              progressPercentage={Math.round(a?.avg_form_accuracy_pct ?? 0)}
              icon={SparklesIcon}
              subtitle="Application-defined metric"
            />
          </div>
          <div className="col-3">
            <ProgressCard
              title="Performance Score"
              value={String(Math.round(a?.overall_score ?? 0))}
              unit="/ 100"
              trend={`${Math.round(a?.weekly_adherence_pct ?? 0)}% weekly adherence`}
              trendDirection="positive"
              progressPercentage={Math.round(a?.overall_score ?? 0)}
              icon={BarChartIcon}
              subtitle="Not a medical or clinical score"
            />
          </div>
        </div>

        {/* ── Trend Charts ── */}
        <div className="dashboard-grid" style={{ marginBottom: 28 }}>
          <div className="col-6">
            <Card
              title="Movement Quality Over Time"
              subtitle="Form accuracy percentage per session (application-defined)"
            >
              <LineChart
                data={a?.quality_trend ?? []}
                label="Quality %"
                color={C.primary}
                unit="%"
              />
            </Card>
          </div>
          <div className="col-6">
            <Card
              title="Repetitions Per Session"
              subtitle="Number of reps completed each session"
            >
              <BarChart
                data={a?.reps_trend ?? []}
                color={C.teal}
                unit=""
              />
            </Card>
          </div>
        </div>

        {/* ── Exercise Breakdown ── */}
        {a?.exercise_breakdown?.length > 0 && (
          <Card
            title="Exercise Performance Breakdown"
            subtitle="Per-exercise performance metrics from your session history"
            style={{ marginBottom: 28 }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Exercise</th>
                    <th>Sessions</th>
                    <th>Total Reps</th>
                    <th>Avg Quality</th>
                    <th>Best Quality</th>
                    <th>Peak Angle</th>
                    <th>Last Performed</th>
                  </tr>
                </thead>
                <tbody>
                  {a.exercise_breakdown.map((ex) => (
                    <tr key={ex.exercise_name}>
                      <td style={{ fontWeight: 600 }}>{ex.exercise_name}</td>
                      <td>{ex.session_count}</td>
                      <td>{ex.total_reps}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: qualityColor(ex.avg_form_accuracy_pct) + '22',
                            color: qualityColor(ex.avg_form_accuracy_pct),
                            border: `1px solid ${qualityColor(ex.avg_form_accuracy_pct)}44`,
                          }}
                        >
                          {Math.round(ex.avg_form_accuracy_pct)}%
                        </span>
                      </td>
                      <td style={{ color: C.success, fontWeight: 600 }}>{Math.round(ex.best_form_accuracy_pct)}%</td>
                      <td>{ex.peak_angle_degrees ? `${ex.peak_angle_degrees}°` : '—'}</td>
                      <td style={{ color: C.muted, fontSize: '0.85rem' }}>{fmtDate(ex.last_performed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── Session History ── */}
        <Card
          title="Session History"
          subtitle="Complete record of your exercise sessions"
          action={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EXERCISES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => handleFilterChange(ex)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 20,
                    border: `1px solid ${exerciseFilter === ex ? C.primary : C.border}`,
                    background: exerciseFilter === ex ? C.primary : 'transparent',
                    color: exerciseFilter === ex ? '#fff' : C.muted,
                    fontSize: '0.78rem',
                    fontWeight: exerciseFilter === ex ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          }
        >
          {loadingHistory ? (
            <Skeleton h={180} borderRadius={8} />
          ) : errorHistory ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: C.muted }}>
              <p>{errorHistory}</p>
              <Button variant="outline" size="sm" onClick={handleRetry}>Retry</Button>
            </div>
          ) : !history || history.sessions.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: C.muted }}>
              {exerciseFilter !== 'All Exercises'
                ? `No sessions found for "${exerciseFilter}". Try a different filter.`
                : 'No sessions logged yet. Complete your first exercise to see history here.'}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Exercise</th>
                      <th>Sets × Reps</th>
                      <th>Movement Quality</th>
                      <th>Peak Angle</th>
                      <th>Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.sessions.map((s) => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtDate(s.created_at)}</td>
                        <td>{s.exercise_name}</td>
                        <td>{s.sets_completed} × {s.reps_completed}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: qualityColor(s.average_form_accuracy_pct) + '22',
                              color: qualityColor(s.average_form_accuracy_pct),
                              border: `1px solid ${qualityColor(s.average_form_accuracy_pct)}44`,
                            }}
                          >
                            {Math.round(s.average_form_accuracy_pct)}%
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {s.peak_angle_degrees ? `${s.peak_angle_degrees}°` : '—'}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: s.performance_label === 'Excellent' ? '#ecfdf5' : '#f0f9ff',
                              color: s.performance_label === 'Excellent' ? C.success : C.primary,
                              border: `1px solid ${s.performance_label === 'Excellent' ? '#a7f3d0' : '#bae6fd'}`,
                            }}
                          >
                            {s.performance_label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: '0.82rem', color: C.muted }}>
                    Page {historyPage} of {totalPages} • {history.total} total sessions
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={historyPage <= 1}
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    >
                      ← Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={historyPage >= totalPages}
                      onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Disclaimer */}
        <p style={{ fontSize: '0.73rem', color: C.muted, marginTop: 24, textAlign: 'center', maxWidth: 640, margin: '24px auto 0' }}>
          {a?.disclaimer || 'Application-defined performance metrics. Not a medical diagnosis or clinical recovery score.'}
        </p>
      </main>
    </div>
  );
};

export default ProgressPage;
