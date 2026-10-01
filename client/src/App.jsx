import { useEffect } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { PetProvider } from './context/PetContext.jsx';
import Pet from './pet/Pet.jsx';
import Journal from './pages/Journal.jsx';
import Community from './pages/Community.jsx';
import Settings from './pages/Settings.jsx';
import { Login, Register, Unlock } from './pages/AuthPages.jsx';

const SYNC_LABEL = { idle: 'Ready', syncing: 'Syncing…', synced: 'Synced', offline: 'Offline — saved locally', error: 'Sync error' };

function ThemeEffect() {
  const { user } = useAuth();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = user?.settings?.theme || 'parchment';
    root.dataset.font = user?.settings?.font || 'serif';
  }, [user?.settings?.theme, user?.settings?.font]);
  return null;
}

function Layout({ children }) {
  const { user, syncStatus, lock } = useAuth();
  return (
    <div className="app">
      <nav className="topbar">
        <NavLink to="/journal" className="brand">🐾 Inkpaw</NavLink>
        <div className="nav-links">
          <NavLink to="/journal">Journal</NavLink>
          <NavLink to="/community">Community</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </div>
        <span className={`sync-pill ${syncStatus.state}`} title={syncStatus.error || ''}>
          <span className="dot" /> {SYNC_LABEL[syncStatus.state] || syncStatus.state}
          {syncStatus.pending > 0 && ` (${syncStatus.pending})`}
        </span>
        <span className="hello">Hi, {user?.displayName}</span>
        <button className="icon-btn" onClick={lock} title="Lock journal" aria-label="Lock journal">🔒</button>
      </nav>
      <main>{children}</main>
      <Pet />
    </div>
  );
}

function AppRoutes() {
  const { phase } = useAuth();

  if (phase === 'loading') return <div className="splash">🐾</div>;

  if (phase === 'anon') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (phase === 'locked') return <Unlock />;

  return (
    <Layout>
      <Routes>
        <Route path="/journal" element={<Journal />} />
        <Route path="/journal/:id" element={<Journal />} />
        <Route path="/community" element={<Community />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/journal" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PetProvider>
          <ThemeEffect />
          <AppRoutes />
        </PetProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
