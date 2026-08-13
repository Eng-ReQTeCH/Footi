import { useState } from 'react';
import type { LobbyState } from '../lib/types';
import { useSocket } from '../lib/socket';
import { useUser } from '../lib/user';
import { cx } from '../lib/theme';
import { AppHeader } from './ui/AppHeader';
import { Button } from './ui/Button';
import { Check, X } from './ui/Icons';

const LIVES = 3;

export default function GuessWhoView({ state }: { state: LobbyState }) {
  const { guess, connected } = useSocket();
  const me = useUser();
  const gw = state.guessWho!;
  const mePlayer = state.players.find((p) => p.userId === me.id);

  const [crossed, setCrossed] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<'elim' | 'guess'>('elim');
  const [busy, setBusy] = useState(false);

  const myLives = gw.mine.lives;
  const winner = gw.mine.winner;
  const gameOver = winner !== null || myLives <= 0;
  const iWon = winner === me.id;
  const othersWon = winner !== null && winner !== me.id;

  const toggleCross = (id: number) => {
    setCrossed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitGuess = async (id: number) => {
    if (busy || gameOver) return;
    setBusy(true);
    try {
      await guess(id);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
      setMode('elim');
    }
  };

  const last = gw.mine.lastGuess;

  return (
    <div className="space-y-3 pt-2">
      <AppHeader connected={connected} showMenu={false} />

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
          <div className="ml-auto flex items-center gap-1.5">
            {Array.from({ length: LIVES }, (_, i) => (
              <span
                key={i}
                className={cx(
                  'grid size-7 place-items-center rounded-full text-xs font-black',
                  i < myLives ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400',
                )}
              >
                {i < myLives ? '❤' : '✕'}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
          Ask real-life questions. Cross out players that can't be your target — you have <b className="text-slate-300">{LIVES} guesses</b>.
        </p>
      </div>

      {/* Guess feedback */}
      {last && (
        <div
          className={cx(
            'glass-card-sm p-3 text-center',
            last.correct ? 'border-emerald-500/40' : 'border-rose-500/40',
          )}
        >
          <p className={cx('text-sm font-black', last.correct ? 'text-emerald-400' : 'text-rose-400')}>
            {last.correct ? 'Correct — you found your player!' : 'Wrong guess!'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {last.guesser === me.id ? 'You' : state.players.find((p) => p.userId === last.guesser)?.username ?? 'They'} guessed a player · {last.livesLeft} {last.livesLeft === 1 ? 'life' : 'lives'} left
          </p>
        </div>
      )}

      {/* Game over */}
      {gameOver && (
        <div className="glass-card p-5 text-center">
          <p className={cx('text-lg font-black', iWon ? 'text-emerald-400' : othersWon ? 'text-amber-400' : 'text-rose-400')}>
            {iWon ? 'You found your player! 🎉' : othersWon ? 'The game is over' : 'You ran out of guesses!'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {gw.secret ? `Your player was ${gw.secret.name}` : ''}
          </p>
          {othersWon && (
            <p className="mt-2 text-xs text-slate-400">
              <span className="font-bold text-slate-200">
                {state.players.find((p) => p.userId === winner)?.username}
              </span>{' '}
              found their player first!
            </p>
          )}
        </div>
      )}

      {/* Mode toggle */}
      {!gameOver && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setMode('elim')}
            className={cx(
              'rounded-lg border px-3 py-1.5 text-xs font-bold',
              mode === 'elim' ? 'border-slate-400 bg-pitch-800 text-slate-200' : 'border-pitch-bright text-slate-500',
            )}
          >
            Cross out ✕
          </button>
          <button
            onClick={() => setMode('guess')}
            className={cx(
              'rounded-lg border px-3 py-1.5 text-xs font-bold',
              mode === 'guess' ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-pitch-bright text-slate-500',
            )}
          >
            Guess 🎯
          </button>
        </div>
      )}

      {mode === 'guess' && !gameOver && (
        <p className="text-center text-xs font-bold text-emerald-400">
          Guess mode — tap a player to submit your guess
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {gw.grid.map((p) => {
          const isCrossed = crossed.has(p.id);
          const isWrong = gw.mine.wrong.includes(p.id);
          return (
            <button
              key={p.id}
              disabled={gameOver || busy || myLives <= 0}
              onClick={() => (mode === 'guess' ? submitGuess(p.id) : toggleCross(p.id))}
              className={cx(
                'relative overflow-hidden rounded-xl border bg-pitch-950/60 text-left transition',
                mode === 'guess' && !gameOver
                  ? 'border-emerald-500/50 hover:border-emerald-400'
                  : 'border-pitch-bright hover:border-slate-500',
                (isCrossed || isWrong) && 'opacity-50',
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
                {(isCrossed || isWrong) && (
                  <div className="absolute inset-0 grid place-items-center bg-pitch-950/70">
                    <X size={28} className="text-rose-500" />
                  </div>
                )}
              </div>
              <div className="truncate px-2 py-1.5 text-[10px] font-bold leading-tight text-slate-300">
                {p.name}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {mePlayer?.username ?? 'You'}: {myLives} {myLives === 1 ? 'life' : 'lives'}
        </span>
        <span className="flex items-center gap-1">
          <Check size={12} className="text-emerald-400" /> not eliminated
        </span>
      </div>

      {busy && <Button full disabled className="py-3">Submitting guess…</Button>}
    </div>
  );
}
