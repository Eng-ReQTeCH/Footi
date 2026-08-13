import { teamColor } from '../../lib/theme';

export function Avatar({
  name,
  teamIdx,
  size = 'md',
}: {
  name: string;
  teamIdx?: number | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dims = size === 'sm' ? 'size-8 text-xs' : size === 'lg' ? 'size-12 text-base' : 'size-10 text-sm';
  const bg = teamIdx !== undefined && teamIdx !== null ? teamColor(teamIdx) : '#00E58B';
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full font-black text-pitch-950 ${dims}`}
      style={{ background: bg }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
