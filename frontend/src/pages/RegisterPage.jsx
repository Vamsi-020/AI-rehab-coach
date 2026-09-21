import React, { useState } from 'react';
import { HeartPulseIcon, ArrowRightIcon } from '../components/common/Icons';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';

const RegisterPage = ({ onNavigate }) => {
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    conditionType: 'knee_rehab',
    therapistCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await register(formData.fullName, formData.email, formData.password, 'patient');
      onNavigate('patient-dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
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
          <h2>Create Your Account</h2>
          <p>Begin your AI-supervised physical rehabilitation</p>
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
            <label className="form-label" htmlFor="reg-fullName">Full Name</label>
            <input
              id="reg-fullName"
              type="text"
              className="form-input"
              value={formData.fullName}
              onChange={handleChange('fullName')}
              placeholder="e.g., Alex Parker"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email Address</label>
            <input
              id="reg-email"
              type="email"
              className="form-input"
              value={formData.email}
              onChange={handleChange('email')}
              placeholder="name@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">
              Password{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(min 8 characters)</span>
            </label>
            <input
              id="reg-password"
              type="password"
              className="form-input"
              value={formData.password}
              onChange={handleChange('password')}
              placeholder="Create a strong password"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="conditionType">Rehabilitation Focus</label>
            <select
              id="conditionType"
              className="form-select"
              value={formData.conditionType}
              onChange={handleChange('conditionType')}
              disabled={loading}
            >
              <option value="knee_rehab">Knee Rehabilitation (ACL/Meniscus/Post-Op)</option>
              <option value="shoulder_mobility">Shoulder Mobility &amp; Rotator Cuff</option>
              <option value="lumbar_spine">Spine &amp; Lower Back Stability</option>
              <option value="ankle_gait">Ankle &amp; Balance Recovery</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="therapistCode">
              Physiotherapist Referral Code{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <input
              id="therapistCode"
              type="text"
              className="form-input"
              value={formData.therapistCode}
              onChange={handleChange('therapistCode')}
              placeholder="e.g., PHYSIO-1234"
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
            {loading ? 'Creating Account…' : 'Create Patient Account'}
          </Button>
        </form>

        <div className="auth-demo-banner">
          <strong>Phase 4:</strong> Account is created in MongoDB and you are automatically signed in.
        </div>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <button
            onClick={() => onNavigate('login')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary-600)',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
