import React from 'react';
import {
  ActivityIcon,
  BarChartIcon,
  DumbbellIcon,
  PlayIcon,
  StethoscopeIcon,
  UserIcon,
} from './Icons';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ activePage, onNavigate, role = 'patient' }) => {
  const { user } = useAuth();

  const patientLinks = [
    { id: 'patient-dashboard', label: 'Dashboard', icon: ActivityIcon },
    { id: 'exercises', label: 'Exercise Library', icon: DumbbellIcon },
    { id: 'session', label: 'Live AI Session', icon: PlayIcon },
    { id: 'progress', label: 'Recovery Progress', icon: BarChartIcon },
  ];

  const physioLinks = [
    { id: 'physio-dashboard', label: 'Patient Roster', icon: StethoscopeIcon },
    { id: 'exercises', label: 'Exercise Catalog', icon: DumbbellIcon },
    { id: 'progress', label: 'Clinical Analytics', icon: BarChartIcon },
  ];

  const links = role === 'physio' ? physioLinks : patientLinks;

  const initials = user?.full_name
    ? user.full_name.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : (role === 'physio' ? 'DR' : 'AP');

  const displayName = user?.full_name || (role === 'physio' ? 'Dr. Sarah Jenkins' : 'Alex Parker');
  const displayRole = user?.role === 'physio' ? 'Lead Physiotherapist' : 'Knee Rehab (Post-Op Wk 4)';

  return (
    <aside className="sidebar">
      {/* User profile card */}
      <div className="sidebar-user-card">
        <div className="sidebar-avatar">
          {initials}
        </div>
        <div>
          <div className="sidebar-user-name">
            {displayName}
          </div>
          <div className="sidebar-user-role">
            {displayRole}
          </div>
        </div>
      </div>


      {/* Nav groups */}
      <div className="sidebar-nav">
        <div className="sidebar-label">Navigation</div>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = activePage === link.id;
          return (
            <button
              key={link.id}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(link.id)}
            >
              <Icon size={18} />
              <span>{link.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
        <button
          className="sidebar-link"
          onClick={() => onNavigate(role === 'physio' ? 'patient-dashboard' : 'physio-dashboard')}
          style={{ fontSize: '0.85rem', color: 'var(--primary-700)' }}
        >
          <UserIcon size={16} />
          <span>Switch to {role === 'physio' ? 'Patient View' : 'Physio View'}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
