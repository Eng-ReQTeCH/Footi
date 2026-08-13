import { useState, type FormEvent } from 'react';
import { api, type Me } from '../lib/api';
import { LogoFull } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { ChevronRight, Eye, EyeOff, AlertTriangle } from '../components/ui/Icons';
import { cx } from '../lib/theme';

export default function Auth({ onAuthed }: { onAuthed: (me: Me) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="flex min-h-[100dvh] flex-col items-center justify-center py-8">
      <div className="mb-8">
        <LogoFull size="lg" />
        <p className="mt-3 text-center text-sm text-slate-400">Soccer Trivia. Friends. Fun.</p>
      </div>

      <div className="glass-card w-full max-w-sm p-5">
        <div className="mb-6 flex border-b border-pitch-bright">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cx(
                'flex-1 tab-underline capitalize',
                mode === m ? 'tab-underline-active' : 'tab-underline-inactive',
              )}
            >
              {m === 'login' ? 'Log in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-400">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="input-field"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-400">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="input-field pr-12"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <Button type="submit" full disabled={busy} icon={<ChevronRight size={20} />}>
            {busy ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
          </Button>

          {error && (
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-400">
              <AlertTriangle size={16} className="shrink-0" />
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
