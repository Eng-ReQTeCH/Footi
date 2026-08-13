import { useEffect, useMemo, useState } from 'react';
import type { LobbyState } from '../lib/types';
import { useSocket } from '../lib/socket';
import { useUser } from '../lib/user';
import { teamColor, cx } from '../lib/theme';
import { AppHeader } from './ui/AppHeader';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Lock, Check, X } from './ui/Icons';

export default function GameView({ state }: { state: LobbyState }) {
  const { answer, connected } = useSocket();
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
    <div className="space-y-3 pt-2">
      <AppHeader connected={connected} showMenu={false} />
      <Scoreboard state={state} />
      <TimerBar timer={state.timer} />

      {state.phase === 'starting' && (
        <div className="py-16 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Get ready</p>
          <p className="mt-4 text-6xl">🏆</p>
        </div>
      )}

      {(state.phase === 'playing' || state.phase === 'review') && q && (
        <>
          <div className={cx('glass-card p-5', isBid && state.phase === 'playing' && 'border-purple-500/30')}>
            <div className="flex flex-wrap items-center gap-2">
              {isBid && state.phase === 'playing' && (
                <span className="tag-pill border-purple-500/40 bg-purple-500/10 text-purple-300">Type: Bid</span>
              )}
              <span className="tag-pill">{q.category}</span>
              <span className="text-xs font-semibold text-slate-500">
                Q {state.currentIndex + 1} / {state.questionCount}
              </span>
              <span className="tag-pill capitalize">{q.difficulty}</span>
            </div>
            <h2 className="mt-3 text-lg font-black leading-snug text-white">{q.question}</h2>

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

          {answered && state.phase === 'playing' && (
            <div className="glass-card-sm p-4 text-center">
              <p className="font-bold text-emerald-300">Locked in!</p>
              <p className="mt-1 text-xs text-slate-500">
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
              'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-bold transition',
              chosen === i
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200'
                : 'border-pitch-bright bg-pitch-950/60 text-slate-200 hover:border-slate-500',
              answered && chosen !== i && 'opacity-40',
            )}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-pitch-850 text-xs font-black text-slate-400">
              {String.fromCharCode(65 + i)}
            </span>
            {opt}
          </button>
        );
      })}
      {selected !== null && !answered && (
        <Button
          full
          disabled={submitBusy}
          icon={<Lock size={18} />}
          className="mt-2"
          onClick={() => {
            setLocked(selected);
            onSubmit({ selected });
          }}
        >
          {submitBusy ? '…' : 'Lock in answer'}
        </Button>
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
        <div className="mt-4 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-center">
          <p className="text-lg font-black text-purple-300">Bid locked: {myBid}</p>
          <p className="mt-1 text-xs text-slate-400">Wait for everyone to bid — then you'll have 30s to name them!</p>
        </div>
      );
    }
    return (
      <div className="mt-4 space-y-4">
        <p className="text-center text-sm text-slate-400">How many answers can you name?</p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setBid(Math.max(0, bid - 1))} className="grid size-12 place-items-center rounded-xl border border-pitch-bright bg-pitch-850 text-2xl font-black text-slate-200 active:scale-95">
            −
          </button>
          <div className="w-20 rounded-xl bg-pitch-950 py-3 text-center text-5xl font-black text-purple-400">
            {bid}
          </div>
          <button onClick={() => setBid(Math.min(20, bid + 1))} className="grid size-12 place-items-center rounded-xl border border-pitch-bright bg-pitch-850 text-2xl font-black text-slate-200 active:scale-95">
            +
          </button>
        </div>
        <Button variant="purple" full disabled={submitBusy} onClick={() => onSubmit('question', { bid })}>
          {submitBusy ? '…' : 'Place bid'}
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-slate-500">
          Bid on how many you can name. Bonus points if you reach your bid — then 30 seconds to type them.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-center gap-3 rounded-xl bg-pitch-950/60 p-3 text-sm font-bold">
        <span className="text-slate-400">Your bid:</span>
        <span className="text-xl font-black text-purple-400">{myBid ?? '—'}</span>
      </div>
      {others.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {others.map((p) => (
            <span key={p.userId} className="rounded-full bg-pitch-850 px-2.5 py-1 text-xs font-semibold text-slate-300">
              {p.username}: <b className="text-purple-300">{p.bid}</b>
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
        className="input-field resize-none"
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
        <Button full disabled={submitBusy} onClick={() => onSubmit('action', { named: names.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) })}>
          {submitBusy ? '…' : 'Submit answers'}
        </Button>
      )}
    </div>
  );
}

function ReviewBox({ state }: { state: LobbyState }) {
  const me = useUser();
  const q = state.question!;
  const isBid = q.type === 'bid';
  const reveal = q.view as { correct?: number; options?: string[]; suggestions?: string[] };
  const answers = state.answers ?? [];

  const correctText = isBid
    ? 'Host decides — see official list'
    : (reveal.options?.[reveal.correct ?? 0] ?? '?');

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">Correct answer</p>
        <div className="mt-1 flex items-center gap-2">
          <Check size={18} className="text-emerald-400" />
          <p className="text-base font-black text-white">{correctText}</p>
        </div>
        {isBid && reveal.suggestions && reveal.suggestions.length > 0 && (
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            {reveal.suggestions.join(' · ')}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {answers.map((a) => {
          const player = state.players.find((p) => p.userId === a.userId);
          const correct = a.points > 0;
          return (
            <div key={a.userId} className="flex items-center gap-3 rounded-xl bg-pitch-950/50 px-3 py-2.5">
              <Avatar name={player?.username ?? '?'} teamIdx={player?.team} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-200">
                {player?.username ?? 'Unknown'}
              </span>
              <span className={cx('text-sm font-black', correct ? 'text-emerald-400' : 'text-slate-500')}>
                {a.points > 0 ? `+${a.points}` : '0'} pts
              </span>
              <div className={cx(
                'grid size-6 place-items-center rounded-full',
                correct ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400',
              )}>
                {correct ? <Check size={14} /> : <X size={14} />}
              </div>
            </div>
          );
        })}
      </div>

      {answers.length === 0 && (
        <div className="rounded-xl bg-pitch-950/50 p-4 text-sm">
          {(() => {
            const my = answers.find((a) => a.userId === me.id);
            if (!my) return <p className="text-slate-500">Waiting for results…</p>;
            return (
              <>
                <p className="text-slate-400">Your answer: <b className="text-slate-200">{my.summary}</b></p>
                <p className={cx('mt-1 text-lg font-black', my.points > 0 ? 'text-emerald-400' : 'text-rose-400')}>
                  {my.points > 0 ? `+${my.points} points` : '0 points'}
                </p>
              </>
            );
          })()}
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
    timer.kind === 'start' ? 'Starting…' : timer.kind === 'question' ? 'Answer!' : timer.kind === 'action' ? 'Name them!' : timer.kind === 'bid' ? 'Bid now!' : timer.kind === 'winner' ? 'Pick the winner!' : 'Next up…';

  return (
    <div className="glass-card-sm px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
        <span className={cx('font-mono text-lg font-black', remaining <= 5 ? 'text-rose-400' : 'text-emerald-400')}>
          {remaining} s
        </span>
      </div>
      <div className="score-bar mt-2">
        <div
          className={cx(
            'score-bar-fill',
            remaining <= 5 && 'from-rose-600 to-rose-400',
          )}
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
      <div className="no-scrollbar flex justify-center gap-3 overflow-x-auto py-1">
        {rows.map(([idx, e]) => (
          <div key={idx} className="flex shrink-0 flex-col items-center gap-0.5">
            <div className="grid size-9 place-items-center rounded-full text-xs font-black text-pitch-950" style={{ background: teamColor(idx) }}>
              T{idx + 1}
            </div>
            <span className="font-mono text-xs font-black text-emerald-400">{e.score}</span>
          </div>
        ))}
      </div>
    );
  }
  const rows = [...state.players].sort((a, b) => b.score - a.score).slice(0, 4);
  return (
    <div className="no-scrollbar flex justify-center gap-4 overflow-x-auto py-1">
      {rows.map((p) => (
        <div key={p.userId} className={cx('flex shrink-0 flex-col items-center gap-0.5', p.userId === me.id && 'scale-105')}>
          <Avatar name={p.username} teamIdx={p.team} size="sm" />
          <span className="max-w-14 truncate text-[10px] font-bold text-slate-400">{p.username}</span>
          <span className="font-mono text-xs font-black text-emerald-400">{p.score}</span>
        </div>
      ))}
    </div>
  );
}
