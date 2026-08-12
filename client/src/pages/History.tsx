import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { HistoryMatch } from '../lib/types';
import { teamColor } from '../lib/theme';

export default function History() {
  const [matches, setMatches] = useState<HistoryMatch[] | null>(null);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (off: number, append: boolean) => {
    const rows = await api<HistoryMatch[]>(`/api/history?limit=20&offset=${off}`);
    setMatches((prev) => (append && prev ? [...prev, ...rows] : rows));
  }, []);

  useEffect(() => {
    load(0, false).catch(() => setMatches([]));
  }, [load]);

  const dateFmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  if (matches === null) return <p className="py-10 text-center text-slate-500">Loading…</p>;
  if (matches.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-5xl">📜</div>
        <p className="mt-3 font-bold text-slate-300">No matches yet</p>
        <p className="mt-1 text-sm text-slate-500">Finish a game and it'll show up here.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3 pt-2">
      {matches.map((m) => {
        const isTeams = m.mode === 'teams';
        const rows = [...m.players].sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
        const byTeam = new Map<string, HistoryMatch['players']>();
        for (const p of rows) {
          const key = p.team ?? '__ffa__';
          if (!byTeam.has(key)) byTeam.set(key, []);
          byTeam.get(key)!.push(p);
        }
        return (
          <div key={m.id} className="rounded-2xl border border-pitch-700 bg-pitch-900 p-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span className="rounded-full bg-pitch-800 px-2.5 py-1 uppercase tracking-wide">
                {isTeams ? 'Teams' : 'Free for all'} · code {m.lobbyCode}
              </span>
              <span>{dateFmt(m.finishedAt)}</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {[...byTeam.entries()].map(([team, ps]) => (
                <div key={team} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {team !== '__ffa__' && (
                    <span className="w-16 font-black" style={{ color: teamColor(Number(team.split(' ')[1]) - 1) }}>
                      {team}
                    </span>
                  )}
                  {ps.map((p) => (
                    <span key={p.userId} className="flex items-center gap-1.5">
                      <span className={p.place === 1 ? 'text-amber-400' : 'text-slate-500'}>{p.place === 1 ? '🥇' : `#${p.place}`}</span>
                      <span className="font-semibold text-slate-200">{p.username}</span>
                      <span className="font-mono font-black text-emerald-400">{p.score}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <button
        onClick={() => {
          const off = offset + 20;
          setOffset(off);
          load(off, true).catch(() => {});
        }}
        className="w-full rounded-2xl border border-pitch-700 bg-pitch-900 py-3.5 font-black text-slate-300 hover:bg-pitch-800"
      >
        Load more
      </button>
    </div>
  );
}