import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HeartPulseIcon, MenuIcon, CloseIcon, UserIcon, LogOutIcon, BellIcon } from './Icons';
import Button from './Button';
import { useAuth } from '../../context/AuthContext';
import { getNotifications, markNotificationRead } from '../../api/client';

// ─── Notification type → badge style ─────────────────────────────────────────

const NOTIF_BADGE_STYLES = {
  milestone_unlocked: { bg: 'var(--success-100, #dcfce7)', color: 'var(--success-700, #15803d)', label: 'Milestone' },
  routine_reminder:   { bg: 'var(--primary-100, #dbeafe)', color: 'var(--primary-700, #1d4ed8)', label: 'Reminder' },
  clinical_feedback:  { bg: 'var(--warning-100, #fef9c3)', color: 'var(--warning-700, #a16207)', label: 'Clinical' },
  kinematic_alert:    { bg: 'var(--error-100, #fee2e2)',   color: 'var(--error-700, #b91c1c)',   label: 'Alert' },
  system:             { bg: 'var(--bg-subtle, #f4f4f5)',   color: 'var(--text-muted, #6b7280)',  label: 'System' },
};

function getBadgeStyle(type) {
  return NOTIF_BADGE_STYLES[type] || NOTIF_BADGE_STYLES.system;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── NotificationPopover ──────────────────────────────────────────────────────

const NotificationPopover = ({ notifications, unreadCount, loading, error, onMarkRead, onClose }) => {
  return (
    <div
      id="notification-popover"
      role="dialog"
      aria-label="Notifications"
      style={{
        position: 'absolute',
        top: 'calc(100% + 10px)',
        right: 0,
        width: 360,
        maxHeight: 480,
        overflowY: 'auto',
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border-subtle, #e5e7eb)',
        borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.14)',
        zIndex: 1000,
        fontFamily: 'inherit',
      }}
    >
      {/* Popover header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px 10px',
        borderBottom: '1px solid var(--border-subtle, #e5e7eb)',
        position: 'sticky',
        top: 0,
        background: 'var(--bg-card, #fff)',
        zIndex: 1,
      }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: '0.97rem', color: 'var(--text-main)' }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <span style={{
              marginLeft: 8,
              fontSize: '0.73rem',
              fontWeight: 700,
              background: 'var(--primary-600, #2563eb)',
              color: '#fff',
              borderRadius: 999,
              padding: '1px 7px',
              verticalAlign: 'middle',
            }}>
              {unreadCount} new
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close notifications"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}
        >
          <CloseIcon size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 0' }}>
        {loading && (
          <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Loading notifications…
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--error-600, #dc2626)', fontSize: '0.875rem' }}>
            Unable to load notifications.
          </div>
        )}

        {!loading && !error && notifications.length === 0 && (
          <div style={{ padding: '36px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <BellIcon size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p style={{ margin: '8px 0 0' }}>You're all caught up!</p>
          </div>
        )}

        {!loading && !error && notifications.map((n) => {
          const badge = getBadgeStyle(n.type);
          return (
            <div
              key={n.id}
              id={`notification-item-${n.id}`}
              style={{
                display: 'flex',
                gap: 12,
                padding: '12px 18px',
                background: n.is_read ? 'transparent' : 'var(--primary-50, #eff6ff)',
                borderLeft: n.is_read ? '3px solid transparent' : '3px solid var(--primary-400, #60a5fa)',
                transition: 'background 0.15s',
              }}
            >
              {/* Type badge */}
              <div style={{ flexShrink: 0, paddingTop: 2 }}>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  background: badge.bg,
                  color: badge.color,
                  borderRadius: 999,
                  padding: '2px 7px',
                  whiteSpace: 'nowrap',
                }}>
                  {badge.label}
                </span>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 3px', fontSize: '0.875rem', fontWeight: n.is_read ? 500 : 700, color: 'var(--text-main)', lineHeight: 1.4 }}>
                  {n.title}
                </p>
                <p style={{ margin: '0 0 6px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  {n.message}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {timeAgo(n.created_at)}
                  </span>
                  {!n.is_read && (
                    <button
                      id={`mark-read-btn-${n.id}`}
                      onClick={() => onMarkRead(n.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.74rem',
                        color: 'var(--primary-600, #2563eb)',
                        cursor: 'pointer',
                        padding: 0,
                        fontWeight: 600,
                        fontFamily: 'inherit',
                      }}
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Navbar ──────────────────────────────────────────────────────────────

const Navbar = ({ activePage, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef(null);
  const bellRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setNotifLoading(true);
    setNotifError(false);
    try {
      const data = await getNotifications();
      if (Array.isArray(data?.notifications)) {
        setNotifications(data.notifications);
        setUnreadCount(typeof data.unread_count === 'number' ? data.unread_count : 0);
      }
    } catch {
      setNotifError(true);
    } finally {
      setNotifLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch notifications when authenticated, and periodically refresh every 90s
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 90_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchNotifications]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popoverOpen]);

  const handleMarkRead = async (notifId) => {
    try {
      await markNotificationRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently ignore — notification stays unread
    }
  };

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
            Exercises &amp; AI
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

              {/* ── Notification Bell ─────────────────────────── */}
              <div style={{ position: 'relative' }}>
                <button
                  id="notification-bell-btn"
                  ref={bellRef}
                  onClick={() => {
                    setPopoverOpen((prev) => {
                      if (!prev) fetchNotifications();
                      return !prev;
                    });
                  }}
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                  aria-expanded={popoverOpen}
                  aria-haspopup="dialog"
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md)',
                    border: popoverOpen
                      ? '1px solid var(--primary-300, #93c5fd)'
                      : '1px solid var(--border-subtle, #e5e7eb)',
                    background: popoverOpen
                      ? 'var(--primary-50, #eff6ff)'
                      : 'transparent',
                    color: popoverOpen ? 'var(--primary-600, #2563eb)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <BellIcon size={17} />
                  {unreadCount > 0 && (
                    <span
                      id="notification-badge"
                      aria-live="polite"
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        minWidth: 17,
                        height: 17,
                        borderRadius: 999,
                        background: 'var(--primary-600, #2563eb)',
                        color: '#fff',
                        fontSize: '0.67rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid var(--bg-main, #fff)',
                        paddingInline: 2,
                      }}
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Popover */}
                {popoverOpen && (
                  <div ref={popoverRef}>
                    <NotificationPopover
                      notifications={notifications}
                      unreadCount={unreadCount}
                      loading={notifLoading}
                      error={notifError}
                      onMarkRead={handleMarkRead}
                      onClose={() => setPopoverOpen(false)}
                    />
                  </div>
                )}
              </div>

              {/* ── User account button ───────────────────────── */}
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
