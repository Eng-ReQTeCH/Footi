import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogoMark, LogoWordmark } from './Logo';
import { Crown, Menu } from './Icons';
import { cx } from '../../lib/theme';

export function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-pitch-bright bg-pitch-900/60 px-2.5 py-1 text-xs font-semibold text-slate-300">
      <span className={cx('size-2 rounded-full', connected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(0,229,139,0.8)]' : 'bg-amber-400 animate-pulse-soft')} />
      {connected ? 'Connected' : 'Reconnecting…'}
    </span>
  );
}

export function AppHeader({
  connected,
  isHost,
  showMenu = true,
}: {
  connected?: boolean;
  isHost?: boolean;
  showMenu?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: '/', label: 'Play' },
    { to: '/friends', label: 'Friends' },
    { to: '/history', label: 'History' },
    { to: '/admin', label: 'Admin' },
  ];

  return (
    <header className="relative z-30 flex items-center justify-between py-3">
      <button onClick={() => navigate('/')} className="flex items-center gap-2">
        <LogoMark size="sm" />
        <LogoWordmark className="hidden text-lg sm:inline" />
      </button>

      <div className="flex items-center gap-2">
        {isHost && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300">
            <Crown size={14} className="text-amber-400" />
            Host
          </span>
        )}
        {connected !== undefined && <ConnectionBadge connected={connected} />}
        {showMenu && (
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="grid size-9 place-items-center rounded-lg border border-pitch-bright bg-pitch-900/60 text-slate-300"
            aria-label="Menu"
          >
            <Menu size={18} />
          </button>
        )}
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setMenuOpen(false)} />
          <nav className="absolute right-0 top-full z-50 mt-2 w-44 animate-pop rounded-xl border border-pitch-bright bg-pitch-900/95 p-2 shadow-card-lg backdrop-blur-md">
            {links.map((l) => (
              <button
                key={l.to}
                onClick={() => {
                  navigate(l.to);
                  setMenuOpen(false);
                }}
                className={cx(
                  'w-full rounded-lg px-3 py-2.5 text-left text-sm font-bold transition',
                  location.pathname === l.to ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-300 hover:bg-pitch-800',
                )}
              >
                {l.label}
              </button>
            ))}
          </nav>
        </>
      )}
    </header>
  );
}
