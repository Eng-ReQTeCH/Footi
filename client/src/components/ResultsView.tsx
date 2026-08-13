import { useState } from 'react';
import type { LobbyState } from '../lib/types';
import { useSocket } from '../lib/socket';
import { useUser } from '../lib/user';
import { useNavigate } from 'react-router-dom';
import { teamColor, cx } from '../lib/theme';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Trophy } from './ui/Icons';

export default function ResultsView({ state }: { state: LobbyState }) {
  const { createLobby, leaveLobby } = useSocket();
  const me = useUser();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const results = state.results;

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

  const maxScore = results?.kind === 'ffa'
    ? Math.max(...results.standings.map((s) => s.score), 1)
    : results?.kind === 'teams'
      ? Math.max(...results.standings.map((t) => t.score), 1)
      : 1;

  return (
    <div className="space-y-4 pt-4 pb-6">
      <div className="text-center">
        <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-amber-500/15 text-amber-400">
          <Trophy size={28} />
        </div>
        <h2 className="text-xl font-black text-white">Final standings</h2>
      </div>

      {results?.kind === 'ffa' ? (
        <div className="space-y-2">
          {results.standings.map((s, i) => {
            const pct = maxScore > 0 ? (s.score / maxScore) * 100 : 0;
            return (
              <div
                key={s.userId}
                className={cx(
                  'glass-card-sm p-3',
                  i === 0 && 'border-amber-500/40',
                  s.userId === me.id && 'border-emerald-500/40',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cx(
                    'w-6 text-center text-sm font-black',
                    i === 0 ? 'text-amber-400' : 'text-slate-500',
                  )}>
                    {s.place}
                  </span>
                  <Avatar name={s.username} size="sm" />
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-sm font-bold text-slate-100">{s.username}</span>
                    <div className="score-bar mt-1.5">
                      <div className="score-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="font-mono text-base font-black text-emerald-400">{s.score}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {results?.kind === 'teams' &&
            results.standings.map((t) => {
              const pct = maxScore > 0 ? (t.score / maxScore) * 100 : 0;
              return (
                <div key={t.teamIdx} className="glass-card-sm p-4" style={{ borderColor: teamColor(t.teamIdx) }}>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black" style={{ color: teamColor(t.teamIdx) }}>
                      Team {t.teamIdx + 1} {t.place === 1 ? '🏆' : `#${t.place}`}
                    </span>
                    <span className="font-mono text-base font-black text-emerald-400">{t.score}</span>
                  </div>
                  <div className="score-bar mt-2">
                    <div className="score-bar-fill" style={{ width: `${pct}%`, background: teamColor(t.teamIdx) }} />
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
              );
            })}
        </div>
      )}

      <div className="py-4 text-center">
        <p className="text-lg font-black text-white">Great game! 🎉</p>
      </div>

      <div className="space-y-2">
        <Button full disabled={busy} onClick={playAgain} className="py-4 text-base">
          {busy ? '…' : 'Play again'}
        </Button>
        <button
          onClick={() => {
            leaveLobby();
            navigate('/');
          }}
          className="w-full py-3 text-sm font-bold text-slate-400 transition hover:text-white"
        >
          Back to home
        </button>
      </div>
    </div>
  );
}
