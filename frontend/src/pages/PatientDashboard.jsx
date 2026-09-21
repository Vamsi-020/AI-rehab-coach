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
import { getMySessions } from '../api/client';

const PatientDashboard = ({ onNavigate }) => {
  const { user, isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

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
        .catch(() => {
          // Gracefully keep empty array/fallback
        })
        .finally(() => {
          if (isMounted) setLoadingSessions(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const firstName = user?.full_name ? user.full_name.split(' ')[0] : 'Alex';
  const hasLiveSessions = sessions.length > 0;

  return (
    <div className="dashboard-layout">
      <Sidebar activePage="patient-dashboard" onNavigate={onNavigate} role="patient" />

      <main className="dashboard-content">
        <PageHeader
          badge={hasLiveSessions ? "Patient Portal • Live Synced" : "Patient Portal"}
          title={`Welcome back, ${firstName}!`}
          description="You are currently on Week 4 of your Post-Op Knee Rehabilitation Protocol."
          action={
            <Button
              variant="primary"
              size="md"
              icon={PlayIcon}
              onClick={() => onNavigate('session')}
            >
              Start Today's Routine
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
              title={hasLiveSessions ? "Logged Sessions" : "Weekly Adherence"}
              value={hasLiveSessions ? String(sessions.length) : "90"}
              unit={hasLiveSessions ? "Total" : "%"}
              trend={hasLiveSessions ? `${sessions.length} session${sessions.length > 1 ? 's' : ''} logged` : "5 of 6 days completed"}
              trendDirection="positive"
              progressPercentage={hasLiveSessions ? Math.min(100, sessions.length * 20) : 90}
              icon={CheckCircleIcon}
              subtitle={hasLiveSessions ? "Live records from database" : "1 session remaining this week"}
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
              subtitle="Prescribed by Dr. Sarah Jenkins (Updated 2 days ago)"
              action={
                <Button variant="outline" size="sm" onClick={() => onNavigate('exercises')}>
                  View All Exercises
                </Button>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Exercise Item 1 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--primary-100)',
                        color: 'var(--primary-700)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <DumbbellIcon size={22} />
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--text-main)' }}>
                        Seated Knee Extension
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Target: 3 sets × 12 reps • Target Extension: 175°
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="badge badge-success">Completed (96% Form)</span>
                    <Button variant="ghost" size="sm" onClick={() => onNavigate('session')}>
                      Redo
                    </Button>
                  </div>
                </div>

                {/* Exercise Item 2 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    background: 'var(--primary-50)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--primary-200)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
                      }}
                    >
                      <PlayIcon size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--primary-900)' }}>
                        Straight Leg Raises
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--primary-700)' }}>
                        Target: 3 sets × 10 reps • Quad isometric hold
                      </p>
                    </div>
                  </div>
                  <Button variant="primary" size="sm" icon={PlayIcon} onClick={() => onNavigate('session')}>
                    Start AI Session
                  </Button>
                </div>

                {/* Exercise Item 3 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--primary-100)',
                        color: 'var(--primary-700)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <DumbbellIcon size={22} />
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--text-main)' }}>
                        Wall Squats (45° Depth)
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Target: 2 sets × 8 reps • Back flat against wall
                      </p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => onNavigate('session')}>
                    Up Next
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Therapist Note & Next Tele-Checkin */}
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
