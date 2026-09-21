import React from 'react';
import {
  ActivityIcon,
  HeartPulseIcon,
  PlayIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StethoscopeIcon,
  VideoCameraIcon,
  BarChartIcon,
  ArrowRightIcon,
} from '../components/common/Icons';
import Button from '../components/common/Button';

const LandingPage = ({ onNavigate }) => {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-pill">
            <SparklesIcon size={16} />
            <span>Next-Gen Physical Therapy & AI Guidance</span>
          </div>

          <h1 className="hero-title">
            Intelligent Rehabilitation <br />
            <span className="hero-title-gradient">Powered by Real-Time AI</span>
          </h1>

          <p className="hero-subtitle">
            Recover faster, prevent re-injury, and maintain proper form with computer-vision pose guidance, clinical range-of-motion tracking, and personalized physical therapy routines.
          </p>

          <div className="hero-cta-group">
            <Button
              variant="primary"
              size="lg"
              icon={PlayIcon}
              onClick={() => onNavigate('exercises')}
            >
              Start Exercise Session
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={ActivityIcon}
              onClick={() => onNavigate('patient-dashboard')}
            >
              Patient Portal Demo
            </Button>
            <Button
              variant="outline"
              size="lg"
              icon={StethoscopeIcon}
              onClick={() => onNavigate('physio-dashboard')}
            >
              Physiotherapist View
            </Button>
          </div>

          {/* Quick Stats Banner */}
          <div className="hero-features-preview">
            <div className="hero-stat-card">
              <div className="hero-stat-icon">
                <VideoCameraIcon size={20} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-main)' }}>Real-Time AI</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Continuous joint angle & posture verification</div>
            </div>

            <div className="hero-stat-card">
              <div className="hero-stat-icon">
                <BarChartIcon size={20} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-main)' }}>94% Accuracy</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Accurate repetition counting & form scoring</div>
            </div>

            <div className="hero-stat-card">
              <div className="hero-stat-icon">
                <ShieldCheckIcon size={20} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-main)' }}>Clinical Oversight</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Direct feedback loop with licensed physiotherapists</div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="landing-section">
        <div className="section-heading">
          <h2>Clinical Precision Meets Artificial Intelligence</h2>
          <p>Designed for orthopedic recovery, post-surgery rehabilitation, and sports injury prevention.</p>
        </div>

        <div className="features-grid">
          <div className="feature-box">
            <div className="feature-box-icon">
              <VideoCameraIcon size={24} />
            </div>
            <h4>Computer Vision Pose Tracking</h4>
            <p>
              Uses standard webcam input to track key skeletal landmarks, ensuring patients adhere to prescribed degrees of joint flexion and extension.
            </p>
          </div>

          <div className="feature-box">
            <div className="feature-box-icon">
              <HeartPulseIcon size={24} />
            </div>
            <h4>Immediate Form Correction</h4>
            <p>
              Visual and acoustic cues provide instant guidance whenever compensation patterns or improper spinal curvature are detected.
            </p>
          </div>

          <div className="feature-box">
            <div className="feature-box-icon">
              <BarChartIcon size={24} />
            </div>
            <h4>Range of Motion (ROM) Analytics</h4>
            <p>
              Tracks day-over-day improvement in joint flexibility and endurance, generating clear clinical progress charts for doctors and patients.
            </p>
          </div>

          <div className="feature-box">
            <div className="feature-box-icon">
              <StethoscopeIcon size={24} />
            </div>
            <h4>Physiotherapist Prescription Portal</h4>
            <p>
              Clinicians can assign customized routines, set target angle thresholds, monitor patient compliance, and review session highlights remotely.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="landing-section" style={{ backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-xl)' }}>
        <div className="section-heading">
          <h2>How It Works</h2>
          <p>Three straightforward steps to effective home rehabilitation.</p>
        </div>

        <div className="steps-container">
          <div className="step-card">
            <div className="step-number">1</div>
            <h4 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>Select Prescribed Exercise</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Choose your prescribed routine from knee extension, shoulder abduction, lumbar bridging, and more.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <h4 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>Position in Front of Camera</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              The AI detects your posture in real time. No wearable sensors or specialized hardware required.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">3</div>
            <h4 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>Receive Real-Time Guidance</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Perform repetitions while receiving live audio-visual feedback, angle measurement, and rep tracking.
            </p>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="landing-section" style={{ textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: 12 }}>Ready to Explore the Platform?</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
            Test the patient interface, exercise library, or physiotherapist monitoring dashboard.
          </p>
          <Button
            variant="primary"
            size="lg"
            icon={ArrowRightIcon}
            iconPosition="right"
            onClick={() => onNavigate('patient-dashboard')}
          >
            Go to Patient Dashboard
          </Button>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
