import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Friend } from '../lib/types';
import { cx } from '../lib/theme';
import { AppHeader } from '../components/ui/AppHeader';
import { useSocket } from '../lib/socket';

export default function Friends() {
  const { connected } = useSocket();
  const [tab, setTab] = useState<'friends' | 'requests' | 'add'>('friends');
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [requests, setRequests] = useState<{ id: number; username: string }[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: number; username: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Friend[]>('/api/friends').then(setFriends).catch(() => {});
    api<{ id: number; username: string }[]>('/api/friends/requests').then(setRequests).catch(() => {});
  }, []);

  useEffect(load, [load]);

  const search = async (q: string) => {
    setQuery(q);
    if (!q.trim()) return setResults([]);
    api<{ id: number; username: string }[]>(`/api/users/search?q=${encodeURIComponent(q.trim())}`)
      .then(setResults)
      .catch(() => setResults([]));
  };

  const sendRequest = async (username: string) => {
    setBusy(true);
    setError(null);
    try {
      await api('/api/friends/requests', { method: 'POST', body: JSON.stringify({ username }) });
      setResults([]);
      setQuery('');
      load();
      setTab('friends');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const respond = async (username: string, accept: boolean) => {
    setBusy(true);
    try {
      await api('/api/friends/respond', { method: 'POST', body: JSON.stringify({ username, accept }) });
      load();
      setTab('friends');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (username: string) => {
    await api(`/api/friends/${encodeURIComponent(username)}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-4 pt-2">
      <AppHeader connected={connected} />
      <div className="grid grid-cols-3 rounded-2xl border border-pitch-bright bg-pitch-900/80 p-1 text-sm font-bold">
        {(['friends', 'requests', 'add'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              'rounded-xl py-2.5 capitalize transition',
              tab === t ? 'bg-emerald-500 text-pitch-950' : 'text-slate-400',
            )}
          >
            {t === 'add' ? 'Add friend' : t}
            {t === 'requests' && requests.length > 0 && (
              <span className={cx('ml-1.5 rounded-full px-1.5 py-0.5 text-xs', tab === t ? 'bg-pitch-950 text-emerald-300' : 'bg-amber-500 text-pitch-950')}>
                {requests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <p className="text-sm font-semibold text-rose-400">{error}</p>}

      {tab === 'friends' && (
        <div className="space-y-2">
          {friends === null ? (
            <p className="py-8 text-center text-slate-500">Loading…</p>
          ) : friends.length === 0 ? (
            <div className="py-10 text-center">
              <div className="text-4xl">🤝</div>
              <p className="mt-3 font-bold text-slate-300">No friends yet</p>
              <p className="mt-1 text-sm text-slate-500">Add friends to track who wins the bragging rights.</p>
            </div>
          ) : (
            friends.map((f) => (
              <div key={f.id} className="glass-card-sm flex items-center gap-3 p-4">
                <span className="grid size-11 place-items-center rounded-full bg-emerald-500/20 text-lg font-black text-emerald-300">
                  {f.username.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-slate-100">{f.username}</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">
                    <span className="text-emerald-400">{f.w}W</span> ·{' '}
                    <span className="text-rose-400">{f.l}L</span> ·{' '}
                    <span className="text-slate-400">{f.d}D</span> against each other
                  </p>
                </div>
                <button
                  onClick={() => remove(f.username)}
                  className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-950"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-2">
          {requests.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No pending requests.</p>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="glass-card-sm flex items-center gap-3 p-4">
                <span className="grid size-11 place-items-center rounded-full bg-sky-500/20 text-lg font-black text-sky-300">
                  {r.username.charAt(0).toUpperCase()}
                </span>
                <p className="flex-1 truncate font-black text-slate-100">{r.username}</p>
                <button
                  disabled={busy}
                  onClick={() => respond(r.username, true)}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-pitch-950 disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  disabled={busy}
                  onClick={() => respond(r.username, false)}
                  className="rounded-xl border border-pitch-700 px-4 py-2 text-sm font-bold text-slate-400"
                >
                  Decline
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'add' && (
        <div className="glass-card p-5">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Search by username</label>
          <input
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="e.g. messi10"
            className="input-field mt-2"
          />
          <div className="mt-3 space-y-2">
            {results.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl bg-pitch-950 px-4 py-3">
                <span className="font-bold text-slate-200">{u.username}</span>
                <button
                  disabled={busy}
                  onClick={() => sendRequest(u.username)}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-black text-pitch-950 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            ))}
            {query && results.length === 0 && (
              <p className="py-4 text-center text-sm text-slate-500">
                {query.trim() ? 'No users found' : ''}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}