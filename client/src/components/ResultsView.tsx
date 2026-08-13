import { useState } from 'react';
import type { LobbyState, Results } from '../lib/types';
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

  return (
    <div className="space-y-4 pt-4 pb-6">
      <div className="text-center">
        <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-amber-500/15 text-amber-400">
          <Trophy size={28} />
        </div>
        <h2 className="text-xl font-black text-white">
          {results?.kind === 'guesswho' ? 'Guess Who results' : results?.kind === 'auction' ? 'Auction draft results' : 'Final standings'}
        </h2>
      </div>

      {results?.kind === 'guesswho' ? (
        <GuessWhoResults results={results} />
      ) : results?.kind === 'auction' ? (
        <AuctionResults results={results} meId={me.id} />
      ) : results?.kind === 'ffa' ? (
        <FfaResults results={results} meId={me.id} />
      ) : (
        <TeamsResults results={results} meId={me.id} />
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

function FfaResults({ results, meId }: { results: Extract<Results, { kind: 'ffa' }>; meId: number }) {
  const maxScore = Math.max(...results.standings.map((s) => s.score), 1);
  return (
    <div className="space-y-2">
      {results.standings.map((s, i) => {
        const pct = maxScore > 0 ? (s.score / maxScore) * 100 : 0;
        return (
          <div key={s.userId} className={cx('glass-card-sm p-3', i === 0 && 'border-amber-500/40', s.userId === meId && 'border-emerald-500/40')}>
            <div className="flex items-center gap-3">
              <span className={cx('w-6 text-center text-sm font-black', i === 0 ? 'text-amber-400' : 'text-slate-500')}>{s.place}</span>
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
  );
}

function TeamsResults({ results, meId }: { results: Extract<Results, { kind: 'teams' }>; meId: number }) {
  const maxScore = Math.max(...results.standings.map((t) => t.score), 1);
  return (
    <div className="space-y-2">
      {results.standings.map((t) => {
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
                <span key={m.userId} className={cx('rounded-full px-2.5 py-1 text-xs font-bold', m.userId === meId ? 'bg-emerald-500/20 text-emerald-300' : 'bg-pitch-950 text-slate-300')}>
                  {m.username} · {m.score}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GuessWhoResults({ results }: { results: Extract<Results, { kind: 'guesswho' }> }) {
  const me = useUser();
  const winner = results.standings.find((s) => s.won);
  return (
    <div className="space-y-3">
      <div className="glass-card-sm p-4 text-center">
        <p className={cx('text-lg font-black', winner?.userId === me.id ? 'text-emerald-400' : 'text-amber-400')}>
          {winner ? `${winner.username} found their player! 🎉` : "It's a draw — the grid was exhausted"}
        </p>
      </div>
      <div className="space-y-2">
        {results.standings.map((s) => (
          <div key={s.userId} className={cx('glass-card-sm flex items-center gap-3 p-3', s.userId === me.id && 'border-emerald-500/40')}>
            <Avatar name={s.username} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-100">{s.username}</span>
            <span className={cx('rounded-full px-2 py-0.5 text-xs font-black', s.won ? 'bg-emerald-500/20 text-emerald-300' : 'bg-pitch-950 text-slate-400')}>
              {s.won ? 'WINNER' : `${s.lives} lives`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuctionResults({ results, meId }: { results: Extract<Results, { kind: 'auction' }>; meId: number }) {
  return (
    <div className="space-y-4">
      {results.standings.map((s) => (
        <div key={s.userId} className={cx('glass-card p-4', s.userId === meId && 'border-emerald-500/40')}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-slate-100">{s.username}</span>
            <span className="font-mono text-sm font-black text-emerald-400">{s.budget}M €</span>
          </div>
          {s.xi && <XIView xi={s.xi} />}
        </div>
      ))}
      <div className="glass-card p-4">
        <p className="text-sm font-black text-slate-100">Send to the LLM</p>
        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-pitch-950/60 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
          {llmPrompt(results)}
        </p>
      </div>
    </div>
  );
}

function XIView({ xi }: { xi: { manager: { name: string } | null; gk: { name: string } | null; def: { name: string }[]; mid: { name: string }[]; att: { name: string }[]; sub: { name: string } | null } }) {
  const lineup: string[] = [];
  if (xi.gk) lineup.push(xi.gk.name);
  lineup.push(...xi.def.map((p) => p.name));
  lineup.push(...xi.mid.map((p) => p.name));
  lineup.push(...xi.att.map((p) => p.name));
  const elems = lineup.map((n, i) => (
    <span key={i} className="rounded-full bg-pitch-950 px-2 py-0.5 text-xs font-bold text-slate-300">
      {n}
    </span>
  ));
  if (xi.sub) elems.push(<span key="sub" className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-bold text-purple-300">[sub] {xi.sub.name}</span>);
  if (xi.manager) elems.push(<span key="mgr" className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-300">🧑‍💼 {xi.manager.name}</span>);
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {elems.length > 0 ? elems : <span className="text-xs text-slate-600">No squad drafted</span>}
    </div>
  );
}

function llmPrompt(results: Extract<Results, { kind: 'auction' }>): string {
  const lines: string[] = [];
  for (const s of [...results.standings].sort((a, b) => b.budget - a.budget)) {
    const xi = s.xi;
    if (!xi) continue;
    const starters = [xi.gk?.name, ...xi.def.map((p) => p.name), ...xi.mid.map((p) => p.name), ...xi.att.map((p) => p.name)].filter(Boolean) as string[];
    const name = s.username;
    const mgr = xi.manager ? `, manager ${xi.manager.name}` : '';
    const sub = xi.sub ? ` [sub] ${xi.sub.name}` : '';
    lines.push(`${name}: ${starters.join(', ')}${sub}${mgr} — ${s.budget}M left`);
  }
  return [
    'Here are the auction draft squads from our "Auction" mode game.',
    'Act as a football analyst and rate or rank these squads against each other. You may also answer questions about them.',
    '',
    ...lines,
  ].join('\n');
}
