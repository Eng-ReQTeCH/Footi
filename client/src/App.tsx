import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
  const inRoom = location.pathname === '/room';

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
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse-soft text-2xl font-black italic text-emerald-400">FOOTI</div>
      </div>
    );
  }

  if (!me) {
    if (location.pathname === '/login') return <Auth onAuthed={setMe} />;
    return <Navigate to="/login" replace />;
  }

  return (
    <UserProvider value={me}>
      <div className={`mx-auto min-h-full max-w-lg px-4 ${inRoom ? 'pb-6' : 'pb-6'}`}>
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
            className="max-w-md animate-fade-up rounded-xl border border-rose-500/40 bg-rose-950/95 px-4 py-2.5 text-sm font-semibold text-rose-100 shadow-lg backdrop-blur-sm"
          >
            {toast}
          </button>
        </div>
      )}
    </UserProvider>
  );
}
