import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  CheckCircleIcon,
  AlertCircleIcon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  VideoCameraIcon,
  SparklesIcon,
} from '../components/common/Icons';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import PageHeader from '../components/common/PageHeader';
import Sidebar from '../components/common/Sidebar';
import { useAuth } from '../context/AuthContext';
import PoseCameraView from '../components/camera/PoseCameraView';
import { createSessionController, SESSION_STATES } from '../services/sessionController';

/**
 * ExerciseSessionPage — Phase 14 Integration.
 *
 * Wires the complete rehabilitation pipeline (camera → pose → rep counter →
 * movement quality → feedback engine) into a SessionController-managed workflow.
 *
 * Session Flow:
 *   READY → ACTIVE ↔ PAUSED → COMPLETING → COMPLETED → SessionResultsPage
 */
const ExerciseSessionPage = ({ onNavigate }) => {
  const { isAuthenticated } = useAuth();

  // ── Session Controller (singleton ref, stable across renders) ──
  const controllerRef = useRef(null);
  const [sessionStatus, setSessionStatus] = useState(SESSION_STATES.READY);
  const [sessionTime, setSessionTime] = useState('00:00');
  const timerIntervalRef = useRef(null);

  // ── UI / pipeline state ──
  const [isPaused, setIsPaused] = useState(false);
  const [currentReps, setCurrentReps] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [poseData, setPoseData] = useState({ landmarks: null, score: 0, isTracking: false });
  const [cameraStatus, setCameraStatus] = useState('starting');
  const [peakAngle, setPeakAngle] = useState(0);
  const [latestQuality, setLatestQuality] = useState(null);
  const [sessionQuality, setSessionQuality] = useState(null);
  const [realtimeFeedback, setRealtimeFeedback] = useState(null);

  const totalReps = 12;
  const currentSet = 2;
  const totalSets = 3;

  // ── Initialise controller once ──
  useEffect(() => {
    const ctrl = createSessionController({
      exerciseId: 'knee-flexion',
      exerciseName: 'Seated Knee Extension',
      targetReps: totalReps,
      targetSets: totalSets,
      currentSet,
      onStateChange: (status) => {
        setSessionStatus(status);
      },
    });
    controllerRef.current = ctrl;
    ctrl.start();

    // ── Live timer ticker ──
    timerIntervalRef.current = setInterval(() => {
      const ctrl = controllerRef.current;
      if (ctrl && ctrl.status === SESSION_STATES.ACTIVE) {
        setSessionTime(ctrl.formatDuration(ctrl.getActiveDurationSec()));
      }
    }, 1000);

    return () => {
      clearInterval(timerIntervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Forward pose pipeline data into SessionController ──
  const handlePoseDetected = useCallback((data) => {
    setPoseData(data);

    if (typeof data?.repCount === 'number') {
      setCurrentReps(data.repCount);
    }
    if (data?.qualityData) {
      setLatestQuality(data.qualityData);
    }
    if (data?.sessionQuality) {
      setSessionQuality(data.sessionQuality);
    }
    if (data?.feedbackData) {
      setRealtimeFeedback(data.feedbackData);
    }

    const activeAngle =
      data?.activeAngle?.angle ||
      data?.angles?.leftKnee?.angle ||
      data?.angles?.rightKnee?.angle;
    if (typeof activeAngle === 'number' && activeAngle > 0) {
      setPeakAngle((prev) => Math.max(prev, activeAngle));
    }

    // Push live telemetry into session controller
    if (controllerRef.current) {
      controllerRef.current.updateTelemetry({
        repCount: typeof data?.repCount === 'number' ? data.repCount : undefined,
        activeAngle: typeof activeAngle === 'number' ? activeAngle : undefined,
        qualityData: data?.qualityData,
        sessionQuality: data?.sessionQuality,
        feedbackData: data?.feedbackData,
      });
    }
  }, []);

  // ── Pause / Resume ──
  const handlePauseResume = useCallback(() => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    if (isPaused) {
      ctrl.resume();
      setIsPaused(false);
    } else {
      ctrl.pause();
      setIsPaused(true);
    }
  }, [isPaused]);

  // ── Reset ──
  const handleReset = useCallback(() => {
    setCurrentReps(0);
    setLatestQuality(null);
    setSessionQuality(null);
    setRealtimeFeedback(null);
    setPeakAngle(0);
    setResetKey((prev) => prev + 1);
    // If paused, resume so the new set can start
    if (isPaused && controllerRef.current) {
      controllerRef.current.resume();
      setIsPaused(false);
    }
  }, [isPaused]);

  // ── Complete Routine → SessionController → SessionResultsPage ──
  const handleCompleteRoutine = async () => {
    if (isSaving) return;
    const ctrl = controllerRef.current;
    if (!ctrl) return;

    setIsSaving(true);
    clearInterval(timerIntervalRef.current);

    try {
      const results = await ctrl.complete({ isAuthenticated });
      // Navigate to results page, passing structured session results
      onNavigate('session-results', results);
    } catch (err) {
      console.warn('Session completion error (safe fallback):', err.message);
      // Still navigate even if persistence fails
      const fallbackResults = ctrl.buildSessionResults(SESSION_STATES.COMPLETED);
      onNavigate('session-results', fallbackResults);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Exit / Cancel ──
  const handleExitSession = useCallback(() => {
    clearInterval(timerIntervalRef.current);
    if (controllerRef.current) {
      controllerRef.current.cancel();
    }
    onNavigate('exercises');
  }, [onNavigate]);

  return (
    <div className="dashboard-layout">
      <Sidebar activePage="session" onNavigate={onNavigate} role="patient" />

      <main className="dashboard-content">
        <PageHeader
          badge="Live AI Coaching Session"
          title="Seated Knee Extension"
          description="Maintain upright posture and extend your lower leg steadily to target angle."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={handleExitSession}
            >
              Exit Session
            </Button>
          }
        />

        <div className="session-container">
          {/* Main Camera Frame & AI Pose Tracking View */}
          <div>
            <PoseCameraView
              onPoseDetected={handlePoseDetected}
              onStatusChange={setCameraStatus}
              isPaused={isPaused}
              exerciseId="knee-flexion"
              resetKey={resetKey}
            />

            {/* Real-Time Live Coaching Feedback Banner */}
            <div
              className="coaching-banner"
              style={{
                borderLeft:
                  realtimeFeedback?.severity === 'CRITICAL'
                    ? '4px solid #ef4444'
                    : realtimeFeedback?.severity === 'WARNING'
                    ? '4px solid #eab308'
                    : '4px solid #22c55e',
                transition: 'border-color 0.2s ease',
              }}
            >
              {realtimeFeedback?.severity === 'CRITICAL' || realtimeFeedback?.severity === 'WARNING' ? (
                <AlertCircleIcon
                  size={26}
                  style={{
                    color: realtimeFeedback?.severity === 'CRITICAL' ? '#ef4444' : '#eab308',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <CheckCircleIcon size={26} style={{ color: '#22c55e', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color:
                        realtimeFeedback?.severity === 'CRITICAL'
                          ? '#ef4444'
                          : realtimeFeedback?.severity === 'WARNING'
                          ? '#eab308'
                          : 'var(--primary-600)',
                    }}
                  >
                    REAL-TIME FEEDBACK
                  </span>
                  {realtimeFeedback?.feedback_type && (
                    <span
                      style={{
                        fontSize: '0.62rem',
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {realtimeFeedback.feedback_type.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                  {realtimeFeedback?.message || 'Ready. Begin your movement steadily.'}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {isPaused
                    ? 'Session is currently paused. Click Resume to continue.'
                    : poseData.isTracking
                    ? `Movement State: ${poseData.analysis?.state || 'Active'} • Reps: ${currentReps}`
                    : 'Place device 6-8 feet away in a well-lit area.'}
                </div>
              </div>
            </div>


            {/* Session Controls Dock */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                marginTop: 16,
              }}
            >
              {/* Timer display */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Duration
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '0.04em' }}>
                    {sessionTime}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Button
                    variant={isPaused ? 'success' : 'secondary'}
                    size="md"
                    icon={isPaused ? PlayIcon : PauseIcon}
                    onClick={handlePauseResume}
                  >
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    icon={RefreshIcon}
                    onClick={handleReset}
                  >
                    Reset Reps
                  </Button>
                </div>
              </div>

              <Button
                id="complete-routine-btn"
                variant="primary"
                size="md"
                disabled={isSaving}
                onClick={handleCompleteRoutine}
              >
                {isSaving ? 'Saving Session...' : 'Complete Routine'}
              </Button>
            </div>
          </div>


          {/* Right Column: Rep Counters, Movement Quality & Clinical Guidance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Rep Counter Card */}
            <Card title="Session Progress" subtitle={`Set ${currentSet} of ${totalSets}`}>
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: 'var(--primary-600)',
                    background: 'rgba(59, 130, 246, 0.08)',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    marginBottom: 10,
                  }}
                >
                  Repetitions: {currentReps}
                </div>
                <div style={{ fontSize: '3.2rem', fontWeight: 800, color: 'var(--primary-600)', lineHeight: 1 }}>
                  {currentReps} <span style={{ fontSize: '1.4rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {totalReps}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  Reps Completed this Set
                </div>

                <div className="progress-bar-container" style={{ height: 10, marginTop: 16 }}>
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(100, (currentReps / totalReps) * 100)}%` }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: '1px solid var(--border-subtle)',
                  textAlign: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target Hold</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>2.0s</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rest Between Sets</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>45s</div>
                </div>
              </div>
            </Card>

            {/* Movement Quality Card */}
            <Card
              title="Movement Quality"
              subtitle={latestQuality ? `Repetition ${latestQuality.rep_number} Assessment` : 'Application-defined Metric'}
            >
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--primary-600)', lineHeight: 1 }}>
                  {latestQuality ? latestQuality.score : (sessionQuality?.score ? sessionQuality.score : '--')}{' '}
                  <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ 100</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {latestQuality ? 'Latest Repetition Score' : 'Complete a rep to evaluate quality'}
                </div>

                {/* Sub-Score Breakdown (ROM 30%, Posture 25%, Consistency 20%, Speed 15%, Completion 10%) */}
                {latestQuality && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 6,
                      marginTop: 12,
                      padding: '8px',
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.74rem',
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>ROM (30%)</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                        {latestQuality.range_of_motion_score}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Posture (25%)</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                        {latestQuality.posture_score}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Consistency (20%)</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                        {latestQuality.consistency_score}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Speed (15%)</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                        {latestQuality.speed_score}
                      </div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ color: 'var(--text-muted)' }}>Completion (10%)</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                        {latestQuality.completion_score}
                      </div>
                    </div>
                  </div>
                )}

                {/* Feedback List */}
                <div style={{ textAlign: 'left', marginTop: 12 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Feedback:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: 'var(--text-body)', lineHeight: 1.5 }}>
                    {(latestQuality?.feedback?.length ? latestQuality.feedback : ['Maintain steady pacing and full range of motion.']).map(
                      (item, idx) => (
                        <li key={idx}>{item}</li>
                      )
                    )}
                  </ul>
                </div>

                {/* Regulatory / Clinical Disclaimer */}
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 8,
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.4,
                    textAlign: 'center',
                    fontStyle: 'italic',
                  }}
                >
                  Application-defined movement-quality metric. Not a medical diagnosis or clinical recovery score.
                </div>
              </div>
            </Card>

            {/* Exercise Guidance Card */}
            <Card title="Technique Checklist" subtitle="Clinical Safety Rules">
              <ul style={{ paddingLeft: 18, margin: 0, fontSize: '0.86rem', color: 'var(--text-body)', lineHeight: 1.6 }}>
                <li style={{ marginBottom: 8 }}>Sit tall with back supported against chair.</li>
                <li style={{ marginBottom: 8 }}>Squeeze quad muscle at top for full 2-second hold.</li>
                <li style={{ marginBottom: 8 }}>Avoid swinging hips or leaning backward.</li>
                <li>Lower leg under smooth control.</li>
              </ul>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExerciseSessionPage;
