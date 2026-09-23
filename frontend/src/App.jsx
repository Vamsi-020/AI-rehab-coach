import React, { useState, useEffect } from 'react';
import Navbar from './components/common/Navbar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PatientDashboard from './pages/PatientDashboard';
import ExerciseListPage from './pages/ExerciseListPage';
import ExerciseSessionPage from './pages/ExerciseSessionPage';
import SessionResultsPage from './pages/SessionResultsPage';
import ProgressPage from './pages/ProgressPage';
import PhysioDashboardPage from './pages/PhysioDashboardPage';
import { AuthProvider } from './context/AuthContext';

const validPages = [
  'landing',
  'login',
  'register',
  'patient-dashboard',
  'exercises',
  'session',
  'session-results',
  'progress',
  'physio-dashboard',
];

function App() {
  // Initialize from hash if available
  const getInitialPage = () => {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && validPages.includes(hash)) {
      return hash;
    }
    return 'landing';
  };

  const [activePage, setActivePage] = useState(getInitialPage);
  // Structured session results passed from ExerciseSessionPage → SessionResultsPage
  const [sessionResults, setSessionResults] = useState(null);
  // Phase 17: Prescription payload passed from PatientDashboard → ExerciseSessionPage
  const [sessionPrescription, setSessionPrescription] = useState(null);

  // Sync state to URL hash; optionally accept a results or prescription payload
  const navigateTo = (page, payload = null) => {
    if (page === 'session-results' && payload) {
      setSessionResults(payload);
    }
    // Phase 17: When navigating to session from prescription, store prescription config
    if (page === 'session' && payload && payload.exercise_slug) {
      setSessionPrescription(payload);
    } else if (page === 'session' && !payload) {
      // Clear prescription when starting a free (non-prescribed) session
      setSessionPrescription(null);
    }
    setActivePage(page);
    window.location.hash = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Listen for browser back/forward
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash && validPages.includes(hash)) {
        setActivePage(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const renderCurrentPage = () => {
    switch (activePage) {
      case 'landing':
        return <LandingPage onNavigate={navigateTo} />;
      case 'login':
        return <LoginPage onNavigate={navigateTo} />;
      case 'register':
        return <RegisterPage onNavigate={navigateTo} />;
      case 'patient-dashboard':
        return <PatientDashboard onNavigate={navigateTo} />;
      case 'exercises':
        return <ExerciseListPage onNavigate={navigateTo} />;
      case 'session':
        return <ExerciseSessionPage onNavigate={navigateTo} prescription={sessionPrescription} />;
      case 'session-results':
        return (
          <SessionResultsPage
            results={sessionResults}
            onNavigate={navigateTo}
            onRestart={() => {
              setSessionResults(null);
              navigateTo('session');
            }}
          />
        );
      case 'progress':
        return <ProgressPage onNavigate={navigateTo} />;
      case 'physio-dashboard':
        return <PhysioDashboardPage onNavigate={navigateTo} />;
      default:
        return <LandingPage onNavigate={navigateTo} />;
    }
  };

  return (
    <AuthProvider>
    <div className="app-root">
      {/* College Project Demo Quick Navigator Bar */}
      <div className="demo-quickbar">
        <div className="demo-quickbar-left">
          <span className="demo-quickbar-tag">Phase 4 Demo</span>
          <span>Switch Page View:</span>
        </div>
        <div className="demo-quickbar-buttons">
          <button
            className={`demo-quick-btn ${activePage === 'landing' ? 'active' : ''}`}
            onClick={() => navigateTo('landing')}
          >
            1. Landing
          </button>
          <button
            className={`demo-quick-btn ${activePage === 'login' ? 'active' : ''}`}
            onClick={() => navigateTo('login')}
          >
            2. Login
          </button>
          <button
            className={`demo-quick-btn ${activePage === 'register' ? 'active' : ''}`}
            onClick={() => navigateTo('register')}
          >
            3. Register
          </button>
          <button
            className={`demo-quick-btn ${activePage === 'patient-dashboard' ? 'active' : ''}`}
            onClick={() => navigateTo('patient-dashboard')}
          >
            4. Patient Dashboard
          </button>
          <button
            className={`demo-quick-btn ${activePage === 'exercises' ? 'active' : ''}`}
            onClick={() => navigateTo('exercises')}
          >
            5. Exercise Page
          </button>
          <button
            className={`demo-quick-btn ${activePage === 'session' ? 'active' : ''}`}
            onClick={() => navigateTo('session')}
          >
            6. Exercise Session
          </button>
          <button
            className={`demo-quick-btn ${activePage === 'session-results' ? 'active' : ''}`}
            onClick={() => navigateTo('session-results')}
          >
            7. Session Results
          </button>
          <button
            className={`demo-quick-btn ${activePage === 'progress' ? 'active' : ''}`}
            onClick={() => navigateTo('progress')}
          >
            8. Progress Page
          </button>
          <button
            className={`demo-quick-btn ${activePage === 'physio-dashboard' ? 'active' : ''}`}
            onClick={() => navigateTo('physio-dashboard')}
          >
            9. Physio Dashboard
          </button>
        </div>
      </div>

      {/* Main Top Navigation */}
      <Navbar activePage={activePage} onNavigate={navigateTo} />

      {/* Dynamic Main View */}
      {renderCurrentPage()}
    </div>
    </AuthProvider>
  );
}

export default App;
