import { useEffect, useMemo, useState } from 'react';
import type { LobbyState, Settings } from '../lib/types';
import { useSocket } from '../lib/socket';
import { useUser } from '../lib/user';
import { teamColor, cx } from '../lib/theme';

export default function GameView({ state }: { state: LobbyState }) {
  const { answer } = useSocket();
  const me = useUser();
  const q = state.question!;
  const stage = state.stage ?? 'question';
  const isBid = q.type === 'bid';
  const mePlayer = state.players.find((p) => p.userId === me.id)!;
  const answered = stage === 'action' ? mePlayer.bid === undefined || mePlayer.done : mePlayer.done;

  const [selected, setSelected] = useState<number | null>(null);
  const [bid, setBid] = useState(3);
  const [names, setNames] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);

  const options = q.view.options as string[] | undefined;
  const suggestions = q.view.suggestions as string[] | undefined;

  const namedCount = useMemo(
    () => names.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).length,
    [names],
  );

  useEffect(() => {
    setSelected(null);
    setBid(3);
    setNames('');
  }, [state.currentIndex, stage]);

  const submit = async (stage: string, payload: unknown) => {
    setSubmitBusy(true);
    try {
      await answer(stage, payload);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitBusy(false);
    }
  };

  const doneCount = state.players.filter((p) => p.done).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pt-2">
      <Scoreboard state={state} />
      <TimerBar timer={state.timer} />

      {state.phase === 'starting' && (
        <div className="py-16 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Get ready</p>
          <p className="mt-2 text-6xl font-black text-emerald-400">🏆</p>
        </div>
      )}

      {(state.phase === 'playing' || state.phase === 'review') && q && (
        <>
          <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-pitch-800 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-300">
                {q.category}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Q {state.currentIndex + 1}/{state.questionCount} · {q.difficulty}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-black leading-snug text-slate-50">{q.question}</h2>

            {state.phase === 'review' ? (
              <ReviewBox state={state} />
            ) : isBid ? (
              <BidBody
                key={`${state.currentIndex}-${stage}`}
                stage={stage}
                bid={bid}
                setBid={setBid}
                names={names}
                setNames={setNames}
                namedCount={namedCount}
                answered={answered}
                myBid={mePlayer.bid}
                players={state.players}
                suggestions={suggestions}
                submitBusy={submitBusy}
                onSubmit={(s, p) => submit(s, p)}
              />
            ) : (
              <McBody
                key={state.currentIndex}
                options={options ?? []}
                selected={selected}
                setSelected={setSelected}
                answered={answered}
                submitBusy={submitBusy}
                onSubmit={(payload) => submit('question', payload)}
              />
            )}
          </div>

          {answered && (
            <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-4 text-center">
              <p className="font-bold text-slate-200">🎯 Locked in!</p>
              <p className="mt-1 text-sm text-slate-500">
                Waiting for others… {doneCount}/{state.players.length}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function McBody({
  options,
  selected,
  setSelected,
  answered,
  submitBusy,
  onSubmit,
}: {
  options: string[];
  selected: number | null;
  setSelected: (i: number) => void;
  answered: boolean;
  submitBusy: boolean;
  onSubmit: (payload: { selected: number }) => void;
}) {
  const [locked, setLocked] = useState<number | null>(null);
  return (
    <div className="mt-4 space-y-2">
      {options.map((opt, i) => {
        const chosen = locked !== null ? locked : selected;
        return (
          <button
            key={i}
            disabled={answered}
            onClick={() => setSelected(i)}
            className={cx(
              'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-base font-bold transition',
              chosen === i
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200'
                : 'border-pitch-700 bg-pitch-950 text-slate-200 hover:border-slate-500',
              answered && chosen !== i && 'opacity-40',
            )}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-pitch-800 text-sm font-black text-slate-400">
              {String.fromCharCode(65 + i)}
            </span>
            {opt}
          </button>
        );
      })}
      {selected !== null && !answered && (
        <button
          onClick={() => {
            setLocked(selected);
            onSubmit({ selected });
          }}
          disabled={submitBusy}
          className="mt-2 w-full rounded-xl bg-emerald-500 py-3.5 font-black text-pitch-950 transition active:scale-[0.98] disabled:opacity-50"
        >
          {submitBusy ? '…' : 'Lock in answer'}
        </button>
      )}
    </div>
  );
}

function BidBody({
  stage,
  bid,
  setBid,
  names,
  setNames,
  namedCount,
  answered,
  myBid,
  players,
  suggestions,
  submitBusy,
  onSubmit,
}: {
  stage: string;
  bid: number;
  setBid: (n: number) => void;
  names: string;
  setNames: (s: string) => void;
  namedCount: number;
  answered: boolean;
  myBid: number | undefined;
  players: { userId: number; username: string; bid?: number }[];
  suggestions: string[] | undefined;
  submitBusy: boolean;
  onSubmit: (stage: string, payload: unknown) => void;
}) {
  const others = players.filter((p) => p.bid !== undefined);

  if (stage === 'question') {
    if (answered) {
      return (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
          <p className="text-lg font-black text-emerald-300">Bid locked: {myBid}</p>
          <p className="mt-1 text-sm text-slate-400">Wait for everyone to bid — then you'll have 30s to name them!</p>
        </div>
      );
    }
    return (
      <div className="mt-4 space-y-3">
        <p className="text-sm text-slate-400">
          Bid on how many you can name. You'll get <b className="text-emerald-300">{bid}</b> bonus points if you reach it —
          then <b className="text-emerald-300">30 seconds</b> to type them.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setBid(Math.max(0, bid - 1))} className="grid size-12 place-items-center rounded-2xl bg-pitch-800 text-2xl font-black text-slate-200 active:scale-95">
            −
          </button>
          <div className="w-24 rounded-2xl bg-pitch-950 py-3 text-center text-5xl font-black text-emerald-400">
            {bid}
          </div>
          <button onClick={() => setBid(Math.min(20, bid + 1))} className="grid size-12 place-items-center rounded-2xl bg-pitch-800 text-2xl font-black text-slate-200 active:scale-95">
            +
          </button>
        </div>
        <button
          onClick={() => onSubmit('question', { bid })}
          disabled={submitBusy}
          className="w-full rounded-xl bg-emerald-500 py-3.5 font-black text-pitch-950 transition active:scale-[0.98] disabled:opacity-50"
        >
          {submitBusy ? '…' : 'Place bid'}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-center gap-3 rounded-xl bg-pitch-950 p-3 text-sm font-bold">
        <span className="text-slate-400">Your bid:</span>
        <span className="text-xl font-black text-emerald-400">{myBid ?? '—'}</span>
      </div>
      {others.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {others.map((p) => (
            <span key={p.userId} className="rounded-full bg-pitch-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
              {p.username}: <b className="text-emerald-300">{p.bid}</b>
            </span>
          ))}
        </div>
      )}
      <textarea
        value={names}
        onChange={(e) => setNames(e.target.value)}
        disabled={answered}
        placeholder={'One per line, e.g.\nReal Madrid\nLiverpool'}
        rows={5}
        className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-4 py-3 text-base placeholder:text-slate-600 focus:border-emerald-500"
      />
      {suggestions && (
        <p className="text-xs text-slate-500">Official list has {suggestions.length} entries.</p>
      )}
      <div className="flex items-center justify-between text-sm font-bold">
        <span className="text-slate-400">Named: {namedCount}</span>
        <span className={cx(namedCount >= (myBid ?? 0) ? 'text-emerald-400' : 'text-amber-400')}>
          {namedCount >= (myBid ?? 0) ? '✓ bid reached' : `needs ${(myBid ?? 0) - namedCount} more for bonus`}
        </span>
      </div>
      {!answered && (
        <button
          onClick={() => onSubmit('action', { named: names.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) })}
          disabled={submitBusy}
          className="w-full rounded-xl bg-emerald-500 py-3.5 font-black text-pitch-950 transition active:scale-[0.98] disabled:opacity-50"
        >
          {submitBusy ? '…' : 'Submit answers'}
        </button>
      )}
    </div>
  );
}

function ReviewBox({ state }: { state: LobbyState }) {
  const me = useUser();
  const q = state.question!;
  const isBid = q.type === 'bid';
  const reveal = q.view as { correct?: number; options?: string[]; suggestions?: string[] };
  const my = state.answers?.find((a) => a.userId === me.id);

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">Correct answer</p>
        <p className="mt-1 text-lg font-black text-slate-50">
          {isBid
            ? 'Host decides — see the official list below'
            : (reveal.options?.[reveal.correct ?? 0] ?? '?')}
        </p>
        {isBid && reveal.suggestions && reveal.suggestions.length > 0 && (
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            {reveal.suggestions.join(' · ')}
          </p>
        )}
      </div>
      {my && (
        <div className="rounded-xl bg-pitch-950 p-4 text-sm">
          <p className="text-slate-400">
            Your answer: <b className="text-slate-200">{my.summary}</b>
          </p>
          <p className={cx('mt-1 text-lg font-black', my.points > 0 ? 'text-emerald-400' : 'text-rose-400')}>
            {my.points > 0 ? `+${my.points} points` : '0 points'}
          </p>
        </div>
      )}
    </div>
  );
}

export function TimerBar({ timer }: { timer: LobbyState['timer'] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [timer?.endAt, timer?.kind]);

  if (!timer) return null;
  const remaining = Math.max(0, Math.ceil((timer.endAt - now) / 1000));
  const pct = Math.max(0, Math.min(100, ((timer.endAt - now) / timer.duration) * 100));

  const label =
    timer.kind === 'start' ? 'Starting…' : timer.kind === 'question' ? 'Answer!' : timer.kind === 'action' ? 'Name them!' : 'Next up…';

  return (
    <div className="rounded-2xl border border-pitch-700 bg-pitch-900 px-4 py-3">
      <div className="flex items-center justify-between text-sm font-black">
        <span className="uppercase tracking-widest text-slate-400 text-xs">{label}</span>
        <span className={cx('font-mono text-xl', remaining <= 5 ? 'text-rose-400' : 'text-emerald-400')}>{remaining}s</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-pitch-950">
        <div
          className={cx('h-full rounded-full transition-[width] duration-200', remaining <= 5 ? 'bg-rose-500' : 'bg-emerald-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Scoreboard({ state }: { state: LobbyState }) {
  const me = useUser();
  if (state.settings.mode === 'teams') {
    const byTeam = new Map<number, { score: number; count: number }>();
    for (const p of state.players) {
      if (p.team === null) continue;
      const e = byTeam.get(p.team) ?? { score: 0, count: 0 };
      e.score += p.score;
      e.count++;
      byTeam.set(p.team, e);
    }
    const rows = [...byTeam.entries()].sort((a, b) => b[1].score - a[1].score);
    return (
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {rows.map(([idx, e]) => (
          <div
            key={idx}
            className="flex shrink-0 items-center gap-2 rounded-xl border bg-pitch-900 px-3 py-2"
            style={{ borderColor: teamColor(idx) }}
          >
            <span className="text-sm font-black" style={{ color: teamColor(idx) }}>
              T{idx + 1}
            </span>
            <span className="font-mono text-lg font-black text-slate-100">{e.score}</span>
            <span className="text-xs text-slate-500">{e.count}p</span>
          </div>
        ))}
      </div>
    );
  }
  const rows = [...state.players].sort((a, b) => b.score - a.score).slice(0, 4);
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      {rows.map((p, i) => (
        <div
          key={p.userId}
          className={cx(
            'flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm',
            p.userId === me.id ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-pitch-700 bg-pitch-900',
          )}
        >
          <span className="font-mono text-xs text-slate-500">#{i + 1}</span>
          <span className="max-w-24 truncate font-bold text-slate-200">{p.username}</span>
          <span className="font-mono font-black text-emerald-400">{p.score}</span>
        </div>
      ))}
    </div>
  );
}