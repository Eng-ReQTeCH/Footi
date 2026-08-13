import { useState } from 'react';
import type { LobbyState } from '../lib/types';
import { useSocket } from '../lib/socket';
import { useUser } from '../lib/user';
import { cx } from '../lib/theme';
import { AppHeader } from './ui/AppHeader';
import { Button } from './ui/Button';
import { TimerBar } from './GameView';
import { Check, X, Trophy } from './ui/Icons';

export default function GuessWhoView({ state }: { state: LobbyState }) {
  const { endRound, pickGuessWhoWinner, connected } = useSocket();
  const me = useUser();
  const gw = state.guessWho!;
  const isHost = state.hostId === me.id;
  const isWinnerPick = state.phase === 'guesswho_winner';

  const [crossed, setCrossed] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const toggleCross = (id: number) => {
    setCrossed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const endRoundNow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await endRound();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const crown = async (userId: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await pickGuessWhoWinner(userId);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 pt-2">
      <AppHeader connected={connected} showMenu={false} />
      {state.timer?.kind === 'winner' && <TimerBar timer={state.timer} />}

      {/* Secret target */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          {gw.secret ? (
            <>
              <img
                src={gw.secret.imageUrl}
                alt={gw.secret.name}
                className="size-14 shrink-0 rounded-xl object-cover ring-2 ring-purple-500/40"
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-purple-400">Your secret player</p>
                <p className="truncate text-base font-black text-white">{gw.secret.name}</p>
                <p className="text-xs text-slate-500">{gw.secret.position}</p>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-400">Loading your secret player…</div>
          )}
        </div>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
          Everyone sees the same grid. Yours is <b className="text-purple-300">{gw.secret?.name ?? '…'}</b> — ask real-life
          questions and figure out each other's player. When the round is over, the host crowns the winner.
        </p>
      </div>

      {/* Host picks the winner */}
      {isWinnerPick && (
        <div className="glass-card p-4">
          <div className="text-center">
            <Trophy size={24} className="mx-auto text-amber-400" />
            <p className="mt-1 text-sm font-black text-white">Round over — who won?</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {isHost ? 'Tap a player to crown them the winner' : 'The host is choosing the winner…'}
            </p>
          </div>
          {isHost && (
            <div className="mt-3 space-y-1.5">
              {state.players.map((p) => (
                <button
                  key={p.userId}
                  onClick={() => crown(p.userId)}
                  className="flex w-full items-center justify-between rounded-lg bg-pitch-950/50 px-3 py-2 text-left text-sm transition enabled:hover:bg-pitch-800"
                >
                  <span className="truncate font-bold text-slate-200">{p.username}</span>
                  {p.userId === gw.declared && <Trophy size={16} className="text-amber-400" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{gw.grid.length} players in the grid</span>
        <span className="flex items-center gap-1">
          <Check size={12} className="text-emerald-400" /> tap a card to cross it out
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {gw.grid.map((p) => {
          const isCrossed = crossed.has(p.id);
          return (
            <button
              key={p.id}
              disabled={isWinnerPick}
              onClick={() => toggleCross(p.id)}
              className={cx(
                'relative overflow-hidden rounded-xl border bg-pitch-950/60 text-left transition',
                isWinnerPick ? 'opacity-40' : 'border-pitch-bright hover:border-slate-500',
                isCrossed && 'opacity-50',
              )}
            >
              <div className="relative aspect-square w-full">
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
                {isCrossed && (
                  <div className="absolute inset-0 grid place-items-center bg-pitch-950/70">
                    <X size={28} className="text-rose-500" />
                  </div>
                )}
              </div>
              <div className="truncate px-2 py-1.5 text-[10px] font-bold leading-tight text-slate-300">{p.name}</div>
            </button>
          );
        })}
      </div>

      {!isWinnerPick &&
        (isHost ? (
          <Button full variant="purple" disabled={busy} onClick={endRoundNow} className="py-3">
            {busy ? '…' : 'End round & pick winner'}
          </Button>
        ) : (
          <p className="py-3 text-center text-xs font-bold text-slate-500">
            Waiting for <span className="text-slate-300">{state.players.find((p) => p.userId === state.hostId)?.username}</span> to end the round…
          </p>
        ))}
    </div>
  );
}
