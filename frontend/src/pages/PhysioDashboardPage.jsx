import React, { useState } from 'react';
import {
  ActivityIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  UserIcon,
  DumbbellIcon,
} from '../components/common/Icons';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import PageHeader from '../components/common/PageHeader';
import ProgressCard from '../components/progress/ProgressCard';
import Sidebar from '../components/common/Sidebar';

const PhysioDashboardPage = ({ onNavigate }) => {
  const [patients] = useState([
    {
      id: 'p-1',
      name: 'Alex Parker',
      condition: 'Right Knee Post-Op (ACL)',
      stage: 'Week 4 Protocol',
      compliance: '92%',
      accuracy: '94%',
      status: 'On Track',
      statusType: 'success',
    },
    {
      id: 'p-2',
      name: 'Maria Santos',
      condition: 'Rotator Cuff Tendinopathy',
      stage: 'Week 2 Protocol',
      compliance: '68%',
      accuracy: '81%',
      status: 'Needs Form Review',
      statusType: 'warning',
    },
    {
      id: 'p-3',
      name: 'David Chen',
      condition: 'Lumbar Spine Herniation',
      stage: 'Week 6 Protocol',
      compliance: '96%',
      accuracy: '97%',
      status: 'Near Discharge',
      statusType: 'success',
    },
    {
      id: 'p-4',
      name: 'Emma Watson',
      condition: 'Left Ankle Inversion Sprain',
      stage: 'Week 1 Acute',
      compliance: '85%',
      accuracy: '89%',
      status: 'On Track',
      statusType: 'success',
    },
  ]);

  return (
    <div className="dashboard-layout">
      <Sidebar activePage="physio-dashboard" onNavigate={onNavigate} role="physio" />

      <main className="dashboard-content">
        <PageHeader
          badge="Clinician Portal"
          title="Physiotherapist Clinical Dashboard"
          description="Monitor remote patient adherence, review AI kinematic evaluations, and prescribe routines."
          action={
            <Button
              variant="primary"
              size="md"
              icon={DumbbellIcon}
              onClick={() => alert('Prescription protocol wizard placeholder')}
            >
              + Prescribe New Routine
            </Button>
          }
        />

        {/* Clinical High-Level Metrics */}
        <div className="dashboard-grid" style={{ marginBottom: 28 }}>
          <div className="col-3">
            <ProgressCard
              title="Active Patient Roster"
              value="18"
              unit="Patients"
              trend="+3 new this week"
              trendDirection="positive"
              progressPercentage={90}
              icon={UserIcon}
              subtitle="All assigned to AI tracking"
            />
          </div>

          <div className="col-3">
            <ProgressCard
              title="Average Compliance Rate"
              value="88.4"
              unit="%"
              trend="+5.2% vs last month"
              trendDirection="positive"
              progressPercentage={88}
              icon={CheckCircleIcon}
              subtitle="Target clinic standard: >85%"
            />
          </div>

          <div className="col-3">
            <ProgressCard
              title="Kinematic Form Alerts"
              value="2"
              unit="Flagged"
              trend="1 patient needs feedback"
              trendDirection="negative"
              progressPercentage={30}
              icon={AlertCircleIcon}
              subtitle="Excessive trunk compensation"
            />
          </div>

          <div className="col-3">
            <ProgressCard
              title="Weekly AI Review Hours"
              value="14.5"
              unit="Hrs"
              trend="Saved ~12 clinic hours"
              trendDirection="positive"
              progressPercentage={80}
              icon={ActivityIcon}
              subtitle="Automated exercise analysis"
            />
          </div>
        </div>

        {/* Patient Roster Table */}
        <Card
          title="Active Patient Rehabilitation Roster"
          subtitle="Real-time compliance, pose accuracy, and clinical status tracking"
        >
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</td>
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
                      <span className={`badge ${p.statusType === 'success' ? 'badge-success' : 'badge-warning'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onNavigate('progress')}
                      >
                        Review Analytics
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default PhysioDashboardPage;
