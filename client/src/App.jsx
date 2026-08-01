import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUser, fetchTeamLoad, fetchStuckPRs, logout } from './api';
import Navbar from './components/Navbar';
import StatsRow from './components/StatsRow';
import LoadChart from './components/LoadChart';
import StuckTable from './components/StuckTable';
import SettingsPage from './components/SettingsPage';
import PRAssignmentsPage from './components/PRAssignmentsPage';

function LoginPage() {
  return (
    <div className="login-page">
      <h1>PR Review Load Balancer</h1>
      <p>
        Automatically distribute code reviews across your team based on real-time workload.
        Sign in with GitHub to access your team dashboard.
      </p>
      <a href="/auth/github" className="login-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
        Sign in with GitHub
      </a>
    </div>
  );
}

function DashboardView({ user, onNavigateSettings }) {
  const { data: loadData, isLoading: loadLoading } = useQuery({
    queryKey: ['teamLoad'],
    queryFn: fetchTeamLoad,
    enabled: !!user?.team_id,
    refetchInterval: 30000,
  });

  const { data: stuckData, isLoading: stuckLoading } = useQuery({
    queryKey: ['stuckPRs'],
    queryFn: fetchStuckPRs,
    enabled: !!user?.team_id,
    refetchInterval: 30000,
  });

  if (!user?.team_id) {
    return (
      <main className="dashboard">
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <h2>Welcome, @{user.username}!</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px' }}>
            You are not part of any team yet. Create a new team or ask your team lead to add your GitHub username to an existing team.
          </p>
          <button className="btn btn-primary" onClick={onNavigateSettings}>
            Go to Team Settings
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <div className="dashboard-header">
        <h1>Team Dashboard</h1>
      </div>

      {loadLoading || stuckLoading ? (
        <div className="stats-row">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card stat-card">
              <div className="skeleton skeleton-bar" style={{ width: '60%', margin: '0 auto' }} />
              <div className="skeleton skeleton-bar" style={{ width: '40%', margin: '8px auto 0' }} />
            </div>
          ))}
        </div>
      ) : (
        <StatsRow loadData={loadData} stuckData={stuckData} />
      )}

      {loadLoading ? (
        <div className="card">
          <div className="card-header"><h2>Team Reviewer Load</h2></div>
          <div className="chart-container">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton skeleton-row" style={{ width: `${90 - i * 15}%` }} />
            ))}
          </div>
        </div>
      ) : (
        <LoadChart data={loadData} />
      )}

      {stuckLoading ? (
        <div className="card">
          <div className="card-header"><h2>Stuck PRs</h2></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      ) : (
        <StuckTable data={stuckData} />
      )}
    </main>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');

  const { data: user, isLoading, refetch: refetchUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    retry: false,
  });

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="login-page">
        <div className="skeleton" style={{ width: 200, height: 32 }} />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <>
      <Navbar user={user} activeView={activeView} onViewChange={setActiveView} onLogout={handleLogout} />
      {activeView === 'dashboard' && (
        <DashboardView user={user} onNavigateSettings={() => setActiveView('settings')} />
      )}
      {activeView === 'assignments' && <PRAssignmentsPage user={user} />}
      {activeView === 'settings' && (
        <SettingsPage user={user} onTeamUpdated={() => refetchUser()} />
      )}
    </>
  );
}
