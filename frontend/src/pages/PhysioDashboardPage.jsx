import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  UserIcon,
  DumbbellIcon,
  RefreshIcon,
} from '../components/common/Icons';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import PageHeader from '../components/common/PageHeader';
import ProgressCard from '../components/progress/ProgressCard';
import Sidebar from '../components/common/Sidebar';
import PrescriptionModal from '../components/exercise/PrescriptionModal';
import { getClinicianDashboard, getExercises } from '../api/client';
import { useAuth } from '../context/AuthContext';

const PhysioDashboardPage = ({ onNavigate }) => {
  const { isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState({
    active_patients_count: 0,
    average_compliance_rate: 0,
    kinematic_form_alerts_count: 0,
    weekly_review_hours: 0,
  });
  const [patients, setPatients] = useState([]);
  const [exercises, setExercises] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialPatientId, setModalInitialPatientId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [notificationMsg, setNotificationMsg] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, exRes] = await Promise.all([
        getClinicianDashboard().catch((err) => {
          // If offline / unauthenticated fallback
          throw err;
        }),
        getExercises().catch(() => ({ exercises: [] })),
      ]);

      if (dashRes && dashRes.metrics) {
        setMetrics(dashRes.metrics);
        setPatients(dashRes.patients || []);
      }
      if (exRes && exRes.exercises) {
        setExercises(exRes.exercises);
      }
    } catch (err) {
      setError(
        err?.message ||
        'Unable to load clinical roster. Please ensure the backend is running and you are logged in with a clinician account.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, isAuthenticated]);

  const handleOpenPrescribeModal = (patientId = null) => {
    setModalInitialPatientId(patientId);
    setModalOpen(true);
  };

  const handlePrescriptionCreated = (newAssignment) => {
    const exName = newAssignment?.exercise_name || 'Exercise routine';
    setNotificationMsg(`Successfully prescribed ${exName}!`);
    setTimeout(() => setNotificationMsg(null), 4000);
    fetchDashboardData();
  };

  const filteredPatients = patients.filter((p) => {
    const matchName = p.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCond = p.condition?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchName || matchCond;
  });

  return (
    <div className="dashboard-layout">
      <Sidebar activePage="physio-dashboard" onNavigate={onNavigate} role="physio" />

      <main className="dashboard-content">
        <PageHeader
          badge="Clinician Portal • Live Synced"
          title="Physiotherapist Clinical Dashboard"
          description="Monitor remote patient adherence, review AI kinematic evaluations, and prescribe routines."
          action={
            <Button
              variant="primary"
              size="md"
              icon={DumbbellIcon}
              onClick={() => handleOpenPrescribeModal()}
            >
              + Prescribe New Routine
            </Button>
          }
        />

        {notificationMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.875rem 1.25rem',
            marginBottom: '1.5rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            color: '#059669',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            fontSize: '0.9rem',
          }}>
            <CheckCircleIcon size={18} />
            <span>{notificationMsg}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem 1rem',
            gap: '1rem',
            color: 'var(--text-muted, #64748b)',
          }}>
            <div className="spinner" style={{
              width: 36,
              height: 36,
              border: '3px solid rgba(13, 148, 136, 0.1)',
              borderTopColor: 'var(--primary-color, #0d9488)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{ margin: 0, fontSize: '0.95rem' }}>Loading clinician dashboard and patient roster...</p>
          </div>
        )}

        {/* Error State with Retry */}
        {!loading && error && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2.5rem 1.5rem',
            marginBottom: '2rem',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            textAlign: 'center',
            gap: '1rem',
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--danger-color, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <AlertCircleIcon size={24} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main, #0f172a)' }}>
                Unable to Load Dashboard
              </h4>
              <p style={{ margin: 0, color: 'var(--text-muted, #64748b)', maxWidth: '520px', fontSize: '0.875rem' }}>
                {error}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshIcon}
              onClick={fetchDashboardData}
            >
              Retry Connection
            </Button>
          </div>
        )}

        {/* Live Content */}
        {!loading && !error && (
          <>
            {/* Clinical High-Level Metrics */}
            <div className="dashboard-grid" style={{ marginBottom: 28 }}>
              <div className="col-3">
                <ProgressCard
                  title="Active Patient Roster"
                  value={String(metrics.active_patients_count || 0)}
                  unit="Patients"
                  trend={metrics.active_patients_count > 0 ? "Assigned to AI tracking" : "No patients assigned"}
                  trendDirection="positive"
                  progressPercentage={Math.min(100, (metrics.active_patients_count / 10) * 100)}
                  icon={UserIcon}
                  subtitle="Active rehabilitation cohort"
                />
              </div>

              <div className="col-3">
                <ProgressCard
                  title="Average Compliance Rate"
                  value={String(metrics.average_compliance_rate || 0)}
                  unit="%"
                  trend={metrics.average_compliance_rate >= 80 ? "On clinical standard" : "Needs routine review"}
                  trendDirection={metrics.average_compliance_rate >= 80 ? "positive" : "negative"}
                  progressPercentage={metrics.average_compliance_rate}
                  icon={CheckCircleIcon}
                  subtitle="Target clinic standard: >85%"
                />
              </div>

              <div className="col-3">
                <ProgressCard
                  title="Kinematic Form Alerts"
                  value={String(metrics.kinematic_form_alerts_count || 0)}
                  unit="Flagged"
                  trend={metrics.kinematic_form_alerts_count > 0 ? "Needs posture review" : "Optimal form maintained"}
                  trendDirection={metrics.kinematic_form_alerts_count > 0 ? "negative" : "positive"}
                  progressPercentage={metrics.kinematic_form_alerts_count * 20}
                  icon={AlertCircleIcon}
                  subtitle="Form accuracy < 75%"
                />
              </div>

              <div className="col-3">
                <ProgressCard
                  title="Weekly AI Review Hours"
                  value={String(metrics.weekly_review_hours || 0)}
                  unit="Hrs"
                  trend="Saved clinic hours"
                  trendDirection="positive"
                  progressPercentage={Math.min(100, metrics.weekly_review_hours * 10)}
                  icon={ActivityIcon}
                  subtitle="Automated exercise analysis"
                />
              </div>
            </div>

            {/* Patient Roster Card */}
            <Card
              title="Active Patient Rehabilitation Roster"
              subtitle="Real-time compliance, pose accuracy, and clinical status tracking"
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="text"
                    placeholder="Search patients or conditions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      padding: '0.4rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      fontSize: '0.85rem',
                      width: '220px',
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={RefreshIcon}
                    onClick={fetchDashboardData}
                  >
                    Refresh
                  </Button>
                </div>
              }
            >
              {patients.length === 0 ? (
                <div style={{
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  color: 'var(--text-muted, #64748b)',
                }}>
                  <div style={{
                    width: 54,
                    height: 54,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(13, 148, 136, 0.1)',
                    color: 'var(--primary-color, #0d9488)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto',
                  }}>
                    <UserIcon size={28} />
                  </div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main, #0f172a)' }}>
                    No Assigned Patients Found
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                    There are currently no patients linked to your clinician profile. Patients registered under your care will automatically appear here.
                  </p>
                </div>
              ) : filteredPatients.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No patients match &ldquo;{searchTerm}&rdquo;. Try another search term.
                </div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Patient Name</th>
                        <th>Condition / Injury</th>
                        <th>Protocol Stage</th>
                        <th>Weekly Compliance</th>
                        <th>AI Form Score</th>
                        <th>Clinical Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPatients.map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {p.name}
                            {p.email && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                {p.email}
                              </div>
                            )}
                          </td>
                          <td>{p.condition}</td>
                          <td>
                            <span className="badge badge-neutral">{p.stage}</span>
                          </td>
                          <td>
                            <strong>{p.compliance}</strong>
                          </td>
                          <td>
                            <span className="badge badge-primary">{p.accuracy}</span>
                          </td>
                          <td>
                            <span className={`badge ${
                              p.statusType === 'success'
                                ? 'badge-success'
                                : p.statusType === 'warning'
                                ? 'badge-warning'
                                : 'badge-neutral'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenPrescribeModal(p.id)}
                              >
                                Prescribe
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onNavigate('progress')}
                              >
                                Review
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {/* Prescription Workflow Modal */}
        <PrescriptionModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          patients={patients}
          exercises={exercises}
          initialPatientId={modalInitialPatientId}
          onPrescriptionCreated={handlePrescriptionCreated}
        />
      </main>
    </div>
  );
};

export default PhysioDashboardPage;
