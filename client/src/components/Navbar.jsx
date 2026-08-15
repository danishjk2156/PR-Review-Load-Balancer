export default function Navbar({ user, activeView, onViewChange, onLogout }) {
  return (
    <nav className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onViewChange('dashboard'); }} className="navbar-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
          PR Load Balancer
        </a>

        {user && (
          <div className="nav-links" style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn btn-sm ${activeView === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onViewChange('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={`btn btn-sm ${activeView === 'assignments' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onViewChange('assignments')}
            >
              PR Assignments
            </button>
            <button
              className={`btn btn-sm ${activeView === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onViewChange('settings')}
            >
              Settings
            </button>
          </div>
        )}
      </div>

      <div className="navbar-right">
        <span className="pulse-dot" title="Live — polling every 30s" />
        <div className="user-info">
          {user?.avatar_url && (
            <img src={user.avatar_url} alt={user.username} className="user-avatar" />
          )}
          <span>{user?.username}</span>
        </div>
        <button className="btn btn-sm btn-danger" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
