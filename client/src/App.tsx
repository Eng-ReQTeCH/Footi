import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError, type Me } from './lib/api';
import { useSocket } from './lib/socket';
import { UserProvider } from './lib/user';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Room from './pages/Room';
import Friends from './pages/Friends';
import History from './pages/History';
import Admin from './pages/Admin';

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast, clearToast } = useSocket();
  const location = useLocation();

  useEffect(() => {
    api<Me>('/api/me')
      .then(setMe)
      .catch((e) => {
        if (!(e instanceof ApiError)) console.error(e);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-emerald-400 text-lg font-bold">
        Footi…
      </div>
    );
  }

  if (!me) {
    if (location.pathname === '/login') return <Auth onAuthed={setMe} />;
    return <Navigate to="/login" replace />;
  }

  return (
    <UserProvider value={me}>
      <div className="min-h-full pb-16 lg:pb-0">
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-pitch-700 bg-pitch-900/95 backdrop-blur lg:top-0 lg:bottom-auto lg:border-b lg:border-t-0">
        <div className="mx-auto flex max-w-5xl items-center justify-around lg:justify-between px-4 py-2.5">
          <span className="hidden lg:block font-black text-emerald-400 text-xl tracking-tight">
            FOOTI<span className="text-slate-400">/</span>
          </span>
          <div className="flex items-center gap-1 lg:gap-2 text-xs lg:text-sm font-semibold">
            <NavTab to="/" label="Play" />
            <NavTab to="/friends" label="Friends" />
            <NavTab to="/history" label="History" />
            <NavTab to="/admin" label="Admin" />
          </div>
          <span className="hidden lg:flex items-center gap-2 text-sm text-slate-300">
            <span className="grid size-8 place-items-center rounded-full bg-emerald-500 text-pitch-950 font-black">
              {me.username.charAt(0).toUpperCase()}
            </span>
            {me.username}
          </span>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-4 pt-4 lg:pt-20">
        <Routes>
          <Route path="/login" element={<Auth onAuthed={setMe} />} />
          <Route path="/" element={<Home me={me} />} />
          <Route path="/room" element={<Room />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/history" element={<History />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {toast && (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <button
            onClick={clearToast}
            className="max-w-md rounded-xl border border-rose-500/40 bg-rose-950 px-4 py-2.5 text-sm font-semibold text-rose-100 shadow-lg"
          >
            {toast}
          </button>
        </div>
      )}
    </div>
    </UserProvider>
  );
}

function NavTab({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const active = location.pathname === to;
  return (
    <button
      onClick={() => navigate(to)}
      className={`rounded-lg px-3 py-2 transition-colors ${
        active ? 'bg-emerald-500 text-pitch-950' : 'text-slate-300 hover:bg-pitch-800 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}