import { useState, type FormEvent } from 'react';
import { api, type Me } from '../lib/api';

export default function Auth({ onAuthed }: { onAuthed: (me: Me) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await api<Me>(`/api/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      onAuthed(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-20 place-items-center rounded-3xl bg-emerald-500 text-5xl shadow-lg shadow-emerald-500/20">
            ⚽
          </div>
          <h1 className="text-4xl font-black tracking-tight">
            FOOTI<span className="text-emerald-400">.</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">Soccer trivia — lobbies, bids, and bragging rights</p>
        </div>

        <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-5">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-pitch-950 p-1 text-sm font-bold">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg py-2 capitalize transition-colors ${
                  mode === m ? 'bg-emerald-500 text-pitch-950' : 'text-slate-400'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="3-20 characters"
                className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-4 py-3 text-base placeholder:text-slate-600 focus:border-emerald-500"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6+ characters"
                className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-4 py-3 text-base placeholder:text-slate-600 focus:border-emerald-500"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {error && <p className="text-sm font-semibold text-rose-400">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-emerald-500 py-3 text-base font-black text-pitch-950 transition active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}