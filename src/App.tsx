import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './store/AppState';
import { AuthProvider, useAuth } from './store/AuthState';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import Today from './pages/Today';
import Learn from './pages/Learn';
import Markets from './pages/Markets';
import Projects from './pages/Projects';
import Research from './pages/Research';
import Insights from './pages/Insights';
import Inbox from './pages/Inbox';
import Settings from './pages/Settings';
import Career from './pages/Career';
import Drill from './pages/Drill';
import Aptitude from './pages/Aptitude';
import Books from './pages/Books';
import Reviews from './pages/Reviews';
import Roadmap from './pages/Roadmap';

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { enabled, session, loading } = useAuth();

  // Cloud sync configured but still resolving the session -> avoid a flash of the login screen.
  if (enabled && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400 dark:bg-slate-950">
        Loading…
      </div>
    );
  }

  // Cloud sync configured and no signed-in user yet -> require sign-in before showing any data.
  if (enabled && !session) {
    return <Login />;
  }

  // Either sync isn't configured (local-only mode) or the user is signed in.
  return (
    <AppProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/today" element={<Today />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/research" element={<Research />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/career" element={<Career />} />
            <Route path="/drill" element={<Drill />} />
            {/* Renamed in v3 — keep old bookmarks working. */}
            <Route path="/knowledge" element={<Navigate to="/drill" replace />} />
            <Route path="/aptitude" element={<Aptitude />} />
            <Route path="/books" element={<Books />} />
            <Route path="/resources" element={<Navigate to="/books" replace />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/roadmap" element={<Roadmap />} />
          </Routes>
        </Layout>
      </HashRouter>
    </AppProvider>
  );
}
