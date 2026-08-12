export const TEAM_COLORS = [
  '#34d399',
  '#60a5fa',
  '#fbbf24',
  '#f87171',
  '#c084fc',
  '#fb923c',
  '#22d3ee',
  '#a3e635',
];

export function teamColor(idx: number | null): string {
  if (idx === null) return '#94a3b8';
  return TEAM_COLORS[idx % TEAM_COLORS.length];
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}