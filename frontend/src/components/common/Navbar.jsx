import React, { useState } from 'react';
import { HeartPulseIcon, MenuIcon, CloseIcon, UserIcon, LogOutIcon } from './Icons';
import Button from './Button';
import { useAuth } from '../../context/AuthContext';

const Navbar = ({ activePage, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  const handleNav = (page) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    onNavigate('login');
  };

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Brand */}
        <div className="navbar-brand" onClick={() => handleNav('landing')}>
          <div className="brand-icon-wrapper">
            <HeartPulseIcon size={22} />
          </div>
          <div>
            <div className="brand-title">AI Rehab Coach</div>
            <div className="brand-subtitle">Smart Physical Therapy</div>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <nav className={`navbar-links ${mobileMenuOpen ? 'open' : ''}`}>
          <button
            className={`nav-link ${activePage === 'landing' ? 'active' : ''}`}
            onClick={() => handleNav('landing')}
          >
            Overview
          </button>
          <button
            className={`nav-link ${activePage === 'patient-dashboard' ? 'active' : ''}`}
            onClick={() => handleNav('patient-dashboard')}
          >
            Patient Portal
          </button>
          <button
            className={`nav-link ${activePage === 'exercises' || activePage === 'session' ? 'active' : ''}`}
            onClick={() => handleNav('exercises')}
          >
            Exercises & AI
          </button>
          <button
            className={`nav-link ${activePage === 'progress' ? 'active' : ''}`}
            onClick={() => handleNav('progress')}
          >
            Progress
          </button>
          <button
            className={`nav-link ${activePage === 'physio-dashboard' ? 'active' : ''}`}
            onClick={() => handleNav('physio-dashboard')}
          >
            Physiotherapist
          </button>
        </nav>

        {/* Right CTA / Auth buttons */}
        <div className="navbar-right">
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="nav-link"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--primary-50)',
                  color: 'var(--primary-700)',
                  border: '1px solid var(--primary-200)',
                }}
                onClick={() => handleNav(user?.role === 'physio' ? 'physio-dashboard' : 'patient-dashboard')}
                title={`Logged in as ${user?.email}`}
              >
                <UserIcon size={16} />
                <span>{user?.full_name?.split(' ')[0] || 'My Account'}</span>
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                icon={LogOutIcon}
                title="Log out"
              >
                Logout
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNav('login')}
                className={activePage === 'login' ? 'active' : ''}
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleNav('register')}
                icon={UserIcon}
              >
                Get Started
              </Button>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

