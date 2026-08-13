export interface PlayerRow {
  user_id: number;
  team: string | null;
  place: number | null;
  score: number;
}

export function outcomeFor(meId: number, rows: PlayerRow[], mode: string): 'win' | 'loss' | 'draw' | null {
  const me = rows.find((r) => r.user_id === meId);
  if (!me || rows.length < 2) return null;
  const myTeam = me.team ?? null;
  const contenders = rows.filter((r) => r.user_id !== meId && myTeam === null ? true : r.team !== myTeam);
  if (contenders.length === 0) return null;

  if (mode === 'ffa') {
    const myRank = me.place ?? rows.length;
    const better = contenders.filter((r) => (r.place ?? rows.length) < myRank).length;
    const equal = contenders.filter((r) => (r.place ?? rows.length) === myRank).length;
    if (better === 0) return equal === 0 ? 'win' : 'draw';
    return 'loss';
  }

  const hasTeams = rows.some((r) => r.team !== null);
  if (hasTeams) {
    const totals = new Map<string | null, number>();
    for (const r of rows) totals.set(r.team ?? null, (totals.get(r.team ?? null) ?? 0) + r.score);
    const myTotal = totals.get(myTeam) ?? me.score;
    const others = [...totals.entries()].filter(([t]) => t !== myTeam).map(([, s]) => s);
    if (others.length === 0) return null;
    const best = Math.max(...others);
    if (myTotal > best) return 'win';
    if (myTotal === best) return 'draw';
    return 'loss';
  }

  // head-to-head modes (guesswho, auction): a higher place means winning
  const myRank = me.place ?? 0;
  const better = contenders.filter((r) => (r.place ?? 0) > myRank).length;
  const equal = contenders.filter((r) => (r.place ?? 0) === myRank).length;
  if (better === 0) return equal === 0 ? 'win' : 'draw';
  return 'loss';
}