import { useState } from 'react';
import type { LobbyState } from '../lib/types';
import { useSocket } from '../lib/socket';
import { useUser } from '../lib/user';
import { useNavigate } from 'react-router-dom';
import { teamColor, cx } from '../lib/theme';

export default function ResultsView({ state }: { state: LobbyState }) {
  const { createLobby, leaveLobby } = useSocket();
  const me = useUser();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const results = state.results;
  const myRank = results?.kind === 'ffa' ? results.standings.find((s) => s.userId === me.id)?.place : undefined;

  const playAgain = async () => {
    setBusy(true);
    try {
      await createLobby(state.settings);
      navigate('/room');
    } catch (e) {
      console.error(e);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pt-2">
      <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-6 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Final whistle</p>
        <h2 className="mt-1 text-2xl font-black text-slate-50">🏁 Full time!</h2>
        {myRank && <p className="mt-1 text-sm text-slate-400">You finished #{myRank}</p>}
      </div>

      {results?.kind === 'ffa' ? (
        <div className="space-y-2">
          {results.standings.map((s, i) => (
            <div
              key={s.userId}
              className={cx(
                'flex items-center gap-3 rounded-2xl border px-4 py-3',
                i === 0
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : s.userId === me.id
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-pitch-700 bg-pitch-900',
              )}
            >
              <span className="w-8 text-center text-xl font-black text-slate-400">
                {s.place === 1 ? '🥇' : s.place === 2 ? '🥈' : s.place === 3 ? '🥉' : `#${s.place}`}
              </span>
              <span className="flex-1 truncate font-bold text-slate-100">{s.username}</span>
              <span className="font-mono text-lg font-black text-emerald-400">{s.score}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {results?.kind === 'teams' &&
            results.standings.map((t, i) => (
              <div key={t.teamIdx} className="rounded-2xl border bg-pitch-900 p-4" style={{ borderColor: teamColor(t.teamIdx) }}>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black" style={{ color: teamColor(t.teamIdx) }}>
                    Team {t.teamIdx + 1} {t.place === 1 ? '🏆' : `#${t.place}`}
                  </span>
                  <span className="font-mono text-lg font-black text-emerald-400">{t.score}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.members.map((m) => (
                    <span
                      key={m.userId}
                      className={cx(
                        'rounded-full px-2.5 py-1 text-xs font-bold',
                        m.userId === me.id ? 'bg-emerald-500/20 text-emerald-300' : 'bg-pitch-950 text-slate-300',
                      )}
                    >
                      {m.username} · {m.score}
                    </span>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={playAgain}
          disabled={busy}
          className="flex-1 rounded-2xl bg-emerald-500 py-3.5 font-black text-pitch-950 transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? '…' : 'Play again'}
        </button>
        <button
          onClick={() => {
            leaveLobby();
            navigate('/');
          }}
          className="rounded-2xl border border-pitch-700 bg-pitch-900 px-5 py-3.5 font-black text-slate-300"
        >
          Home
        </button>
      </div>
    </div>
  );
}