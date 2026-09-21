import React, { useState } from 'react';
import { HeartPulseIcon, UserIcon, StethoscopeIcon, ArrowRightIcon } from '../components/common/Icons';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';

const LoginPage = ({ onNavigate }) => {
  const { login } = useAuth();

  const [role, setRole] = useState('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      // Route based on user's actual role from the server
      if (user.role === 'therapist' || user.role === 'admin') {
        onNavigate('physio-dashboard');
      } else {
        onNavigate('patient-dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <div
            style={{
              width: 48,
              height: 48,
              margin: '0 auto 12px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--primary-600), var(--secondary-600))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            <HeartPulseIcon size={24} />
          </div>
          <h2>Welcome Back</h2>
          <p>Sign in to access your rehabilitation plan</p>
        </div>

        {/* Role Selector */}
        <div className="auth-role-tabs">
          <button
            type="button"
            className={`auth-role-btn ${role === 'patient' ? 'active' : ''}`}
            onClick={() => {
              setRole('patient');
              setError('');
            }}
          >
            <UserIcon size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            Patient
          </button>
          <button
            type="button"
            className={`auth-role-btn ${role === 'physio' ? 'active' : ''}`}
            onClick={() => {
              setRole('physio');
              setError('');
            }}
          >
            <StethoscopeIcon size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            Physiotherapist
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Error Banner */}
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                color: 'var(--danger-text)',
                fontSize: '0.87rem',
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="form-label" htmlFor="login-password" style={{ margin: 0 }}>Password</label>
              <a href="#forgot" style={{ fontSize: '0.8rem', color: 'var(--primary-600)', textDecoration: 'none' }}>
                Forgot?
              </a>
            </div>
            <input
              id="login-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            icon={ArrowRightIcon}
            iconPosition="right"
            disabled={loading}
          >
            {loading ? 'Signing In…' : `Sign In as ${role === 'physio' ? 'Physiotherapist' : 'Patient'}`}
          </Button>
        </form>

        <div className="auth-demo-banner">
          <strong>Phase 4:</strong> Real API authentication — credentials are verified against MongoDB.
        </div>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <button
            onClick={() => onNavigate('register')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary-600)',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Register Here
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
