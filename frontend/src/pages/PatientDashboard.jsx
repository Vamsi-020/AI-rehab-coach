import React, { useState, useEffect } from 'react';
import {
  ActivityIcon,
  AwardIcon,
  CalendarIcon,
  CheckCircleIcon,
  DumbbellIcon,
  PlayIcon,
  SparklesIcon,
} from '../components/common/Icons';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import PageHeader from '../components/common/PageHeader';
import ProgressCard from '../components/progress/ProgressCard';
import Sidebar from '../components/common/Sidebar';
import { useAuth } from '../context/AuthContext';
import { getMySessions, getMyPrescriptions } from '../api/client';

// ─── Prescribed Exercise Item ─────────────────────────────────────────────────

const PrescribedExerciseItem = ({ assignment, onStartExercise }) => {
  const isFirst = true; // highlight first active item
  return (
    <div
      id={`prescription-item-${assignment.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        background: 'var(--primary-50, #eff6ff)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--primary-200, #bfdbfe)',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-md)',
            background: 'var(--primary-600)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <DumbbellIcon size={20} />
        </div>
        <div>
          <h4 style={{ margin: '0 0 3px', fontSize: '1rem', color: 'var(--primary-900)' }}>
            {assignment.exercise_name || 'Prescribed Exercise'}
          </h4>
          <p style={{ margin: '0 0 2px', fontSize: '0.82rem', color: 'var(--primary-700)' }}>
            {assignment.prescribed_sets} sets × {assignment.prescribed_reps} reps
            {assignment.target_rom_degrees ? ` • Target ROM: ${assignment.target_rom_degrees}°` : ''}
            {assignment.frequency_per_week ? ` • ${assignment.frequency_per_week}×/week` : ''}
          </p>
          {assignment.custom_instructions && (
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--primary-600)', fontStyle: 'italic', maxWidth: 380 }}>
              <SparklesIcon size={11} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
              {assignment.custom_instructions}
            </p>
          )}
        </div>
      </div>
      <Button
        id={`start-exercise-btn-${assignment.id}`}
        variant="primary"
        size="sm"
        icon={PlayIcon}
        onClick={() => onStartExercise(assignment)}
      >
        Start Exercise
      </Button>
    </div>
  );
};

// ─── Main PatientDashboard ────────────────────────────────────────────────────

const PatientDashboard = ({ onNavigate }) => {
  const { user, isAuthenticated } = useAuth();

  // Live session data
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Phase 17: Live prescribed routine
  const [prescriptions, setPrescriptions] = useState([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const [prescriptionsError, setPrescriptionsError] = useState(false);

  // Load sessions
  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated) {
      setLoadingSessions(true);
      getMySessions()
        .then((data) => {
          if (isMounted && Array.isArray(data)) {
            setSessions(data);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingSessions(false);
        });
    }
    return () => { isMounted = false; };
  }, [isAuthenticated]);

  // Load prescribed routine from API
  const fetchPrescriptions = () => {
    if (!isAuthenticated) return;
    setLoadingPrescriptions(true);
    setPrescriptionsError(false);
    getMyPrescriptions()
      .then((data) => {
        if (Array.isArray(data?.assignments)) {
          setPrescriptions(data.assignments);
        } else {
          setPrescriptions([]);
        }
      })
      .catch(() => {
        setPrescriptionsError(true);
      })
      .finally(() => {
        setLoadingPrescriptions(false);
      });
  };

  useEffect(() => {
    fetchPrescriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const firstName = user?.full_name ? user.full_name.split(' ')[0] : 'Alex';
  const hasLiveSessions = sessions.length > 0;
  const hasPrescriptions = prescriptions.length > 0;

  // Launch a prescribed exercise into session page
  const handleStartPrescribedExercise = (assignment) => {
    onNavigate('session', assignment);
  };

  return (
    <div className="dashboard-layout">
      <Sidebar activePage="patient-dashboard" onNavigate={onNavigate} role="patient" />

      <main className="dashboard-content">
        <PageHeader
          badge={hasLiveSessions ? 'Patient Portal • Live Synced' : 'Patient Portal'}
          title={`Welcome back, ${firstName}!`}
          description={
            hasPrescriptions
              ? `You have ${prescriptions.length} active exercise prescription${prescriptions.length > 1 ? 's' : ''} assigned.`
              : 'You are currently on your rehabilitation protocol.'
          }
          action={
            <Button
              variant="primary"
              size="md"
              icon={PlayIcon}
              onClick={() => onNavigate('session')}
            >
              Start Free Session
            </Button>
          }
        />

        {/* Progress Metric Highlights */}
        <div className="dashboard-grid" style={{ marginBottom: 28 }}>
          <div className="col-3">
            <ProgressCard
              title="Overall Recovery Score"
              value="82"
              unit="/ 100"
              trend="+8% this week"
              trendDirection="positive"
              progressPercentage={82}
              icon={AwardIcon}
              subtitle="Target: 95% for full discharge"
            />
          </div>

          <div className="col-3">
            <ProgressCard
              title={hasLiveSessions ? 'Logged Sessions' : 'Weekly Adherence'}
              value={hasLiveSessions ? String(sessions.length) : '90'}
              unit={hasLiveSessions ? 'Total' : '%'}
              trend={hasLiveSessions ? `${sessions.length} session${sessions.length > 1 ? 's' : ''} logged` : '5 of 6 days completed'}
              trendDirection="positive"
              progressPercentage={hasLiveSessions ? Math.min(100, sessions.length * 20) : 90}
              icon={CheckCircleIcon}
              subtitle={hasLiveSessions ? 'Live records from database' : '1 session remaining this week'}
            />
          </div>

          <div className="col-3">
            <ProgressCard
              title="Max Knee Flexion"
              value="125"
              unit="°"
              trend="+10° improvement"
              trendDirection="positive"
              progressPercentage={85}
              icon={ActivityIcon}
              subtitle="Prescribed target: 130°"
            />
          </div>

          <div className="col-3">
            <ProgressCard
              title="Active Streak"
              value="6"
              unit="Days"
              trend="Personal best!"
              trendDirection="positive"
              progressPercentage={75}
              icon={SparklesIcon}
              subtitle="Consistency is key to joint repair"
            />
          </div>
        </div>

        {/* Today's Prescribed Exercises & Physiotherapist Note */}
        <div className="dashboard-grid">
          {/* Prescribed List */}
          <div className="col-8">
            <Card
              title="Today's Prescribed Routine"
              subtitle={
                hasPrescriptions
                  ? `${prescriptions.length} active prescription${prescriptions.length > 1 ? 's' : ''} from your physiotherapist`
                  : 'Prescribed exercise routine'
              }
              action={
                <Button variant="outline" size="sm" onClick={() => onNavigate('exercises')}>
                  View All Exercises
                </Button>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Loading state */}
                {loadingPrescriptions && (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Loading your prescribed routine…
                  </div>
                )}

                {/* Error state */}
                {!loadingPrescriptions && prescriptionsError && (
                  <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 12px' }}>
                      Unable to load prescribed routine.
                    </p>
                    <Button variant="outline" size="sm" onClick={fetchPrescriptions}>
                      Retry
                    </Button>
                  </div>
                )}

                {/* Empty state — no prescriptions assigned */}
                {!loadingPrescriptions && !prescriptionsError && !hasPrescriptions && (
                  <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                    <DumbbellIcon size={32} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: 10 }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 4px', fontWeight: 600 }}>
                      No active prescriptions assigned yet.
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 16px' }}>
                      Your physiotherapist has not assigned any exercises. Contact them to get started.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => onNavigate('exercises')}>
                      Browse Exercise Library
                    </Button>
                  </div>
                )}

                {/* Live prescribed exercises list */}
                {!loadingPrescriptions && !prescriptionsError && prescriptions.map((assignment) => (
                  <PrescribedExerciseItem
                    key={assignment.id}
                    assignment={assignment}
                    onStartExercise={handleStartPrescribedExercise}
                  />
                ))}
              </div>
            </Card>
          </div>

          {/* Right sidebar: Clinical Note Card + Camera Guidance */}
          <div className="col-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Clinical Note Card */}
              <Card
                title="Physiotherapist Note"
                subtitle="Clinical Feedback"
                badge={<span className="badge badge-primary">Dr. Jenkins</span>}
              >
                <div style={{ fontSize: '0.9rem', color: 'var(--text-body)', lineHeight: '1.6' }}>
                  <p style={{ margin: '0 0 12px' }}>
                    <em>
                      "Great progress on your knee extension range. Make sure not to arch your lower back during the straight leg raises today."
                    </em>
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <CalendarIcon size={14} />
                    <span>Next Review: Thursday, 10:00 AM</span>
                  </div>
                </div>
              </Card>

              {/* Quick AI Tip Card */}
              <Card
                title="AI Camera Guidance"
                subtitle="Setup Advice"
              >
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: '1.5' }}>
                  Position your camera 6-8 feet away in a well-lit space so full body landmarks remain clearly visible.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={() => onNavigate('session')}
                >
                  Test Camera View
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PatientDashboard;
