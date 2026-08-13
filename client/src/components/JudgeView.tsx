import { useEffect, useState } from 'react';
import type { LobbyState, JudgeEntry } from '../lib/types';
import { useSocket } from '../lib/socket';
import { useUser } from '../lib/user';
import { teamColor, cx } from '../lib/theme';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';

export default function JudgeView({ state }: { state: LobbyState }) {
  const { submitJudgments } = useSocket();
  const me = useUser();

  if (state.hostId !== me.id) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 pt-8 text-center">
        <div className="text-5xl">🧑‍⚖️</div>
        <p className="font-black text-slate-200">The host is judging answers…</p>
        <p className="text-sm text-slate-500">Sit tight — points are coming.</p>
      </div>
    );
  }

  return (
    <JudgePanel
      state={state}
      onDone={(judgments) => {
        submitJudgments(judgments).catch(() => {});
      }}
    />
  );
}

function JudgePanel({ state, onDone }: { state: LobbyState; onDone: (j: { userId: number; points: number }[]) => void }) {
  const { judge } = useSocket();
  const [overrides, setOverrides] = useState<Map<number, number>>(new Map());
  const [entryToggles, setEntryToggles] = useState<Map<number, boolean[]>>(new Map());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOverrides(new Map());
    setEntryToggles(new Map());
  }, [judge?.questionIndex]);

  if (!judge) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-400">Loading answers…</p>
      </div>
    );
  }

  const isBid = judge.type === 'bid';

  const setOverride = (userId: number, points: number) => {
    setOverrides((m) => {
      const next = new Map(m);
      next.set(userId, points);
      return next;
    });
  };

  const validityOf = (userId: number): boolean[] => {
    const toggled = entryToggles.get(userId);
    if (toggled) return toggled;
    const e = judge.players.find((p) => p.userId === userId);
    return (e?.entries ?? []).map((en) => en.valid);
  };

  const autoPoints = (e: JudgeEntry): number => {
    const bid = (e.payload as { bid?: number })?.bid ?? 0;
    const valid = validityOf(e.userId).filter(Boolean).length;
    return valid + (valid >= bid ? bid : 0);
  };

  const pointsFor = (e: JudgeEntry): number => {
    if (overrides.has(e.userId)) return overrides.get(e.userId)!;
    return isBid ? autoPoints(e) : e.suggestedPoints;
  };

  const toggleEntry = (userId: number, index: number) => {
    setEntryToggles((m) => {
      const next = new Map(m);
      const arr = [...validityOf(userId)];
      arr[index] = !arr[index];
      next.set(userId, arr);
      return next;
    });
    setOverrides((m) => {
      if (!m.has(userId)) return m;
      const next = new Map(m);
      next.delete(userId);
      return next;
    });
  };

  const submitAll = () => {
    setBusy(true);
    onDone(judge.players.map((e) => ({ userId: e.userId, points: pointsFor(e) })));
  };

  const reveal = judge.revealPublic as { options?: string[]; correct?: number; suggestions?: string[] };
  const options = reveal.options ?? [];

  return (
    <div className="space-y-4 pt-2 pb-6">
      <div className="glass-card border-amber-500/30 bg-amber-500/10 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Judge mode</p>
        <p className="mt-1 text-base font-black leading-snug text-white">
          Q{state.currentIndex + 1}: {judge.question}
        </p>
        <p className="mt-2 rounded-xl bg-pitch-950/60 px-3 py-2 text-sm text-slate-300">
          <b className="text-emerald-300">Correct:</b> {judge.correctText}
        </p>
        {reveal.options && (
          <p className="mt-1 px-1 text-xs leading-relaxed text-slate-500">
            {reveal.options.map((o, i) => `${i + 1}. ${o}`).join('  ·  ')}
          </p>
        )}
        {isBid && reveal.suggestions && reveal.suggestions.length > 0 && (
          <p className="mt-1 px-1 text-xs leading-relaxed text-slate-500">
            Official: {reveal.suggestions.join(' · ')}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {judge.players.map((e) => (
          <PlayerJudge
            key={e.userId}
            entry={e}
            isBid={isBid}
            options={options}
            points={pointsFor(e)}
            validity={validityOf(e.userId)}
            setOverride={setOverride}
            onToggle={toggleEntry}
          />
        ))}
      </div>

      <Button
        full
        disabled={busy}
        onClick={submitAll}
        className="bg-gradient-to-b from-amber-400 to-amber-500 py-4 text-base text-pitch-950 shadow-warning"
      >
        {busy ? '…' : 'Submit judgments → next question'}
      </Button>
      <p className="text-center text-xs text-slate-500">
        Suggestions are pre-filled — use +/- to fine-tune, or tap an answer on bid questions to toggle.
      </p>
    </div>
  );
}

function PlayerJudge({
  entry,
  isBid,
  options,
  points,
  validity,
  setOverride,
  onToggle,
}: {
  entry: JudgeEntry;
  isBid: boolean;
  options: string[];
  points: number;
  validity: boolean[];
  setOverride: (userId: number, points: number) => void;
  onToggle: (userId: number, index: number) => void;
}) {
  const bid = (entry.payload as { bid?: number })?.bid ?? 0;

  return (
    <div className="glass-card-sm p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={entry.username} teamIdx={entry.team} size="sm" />
          <span className="truncate font-black text-slate-100">{entry.username}</span>
          {!entry.answered && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-400">no answer</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setOverride(entry.userId, Math.max(0, points - 1))}
            className="grid size-8 place-items-center rounded-lg bg-pitch-850 font-black text-slate-300 active:scale-95"
          >
            −
          </button>
          <span className={cx('w-10 text-center font-mono text-lg font-black', points > 0 ? 'text-emerald-400' : 'text-slate-400')}>
            {points}
          </span>
          <button
            onClick={() => setOverride(entry.userId, points + 1)}
            className="grid size-8 place-items-center rounded-lg bg-pitch-850 font-black text-slate-300 active:scale-95"
          >
            +
          </button>
        </div>
      </div>

      {entry.answered && (
        <div className="mt-3">
          {isBid ? (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Bid {bid} · named {validity.length}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {validity.map((valid, i) => (
                  <button
                    key={i}
                    onClick={() => onToggle(entry.userId, i)}
                    className={cx(
                      'rounded-full border px-2.5 py-1 text-xs font-semibold transition',
                      valid
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                        : 'border-slate-700 bg-pitch-950 text-slate-500 hover:border-slate-500',
                    )}
                  >
                    {valid ? '✓' : '✕'} {entry.entries![i].label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="rounded-xl bg-pitch-950/60 px-3 py-2 text-sm font-semibold text-slate-200">
              Picked: {stringifySelected(entry.payload, options)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function stringifySelected(payload: unknown, options: string[]): string {
  const sel = (payload as { selected?: number } | null)?.selected;
  if (sel === undefined || sel === null) return '—';
  return options[sel] ?? `Option #${sel + 1}`;
}
