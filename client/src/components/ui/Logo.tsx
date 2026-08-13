import { Crown, SoccerBall } from './Icons';

export function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'size-8' : size === 'lg' ? 'size-16' : 'size-12';
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 32 : 24;
  return (
    <div className={`relative ${dims}`}>
      <div className="absolute inset-0 rounded-xl border border-emerald-500/30 bg-pitch-900/80 backdrop-blur-sm" />
      <div className="relative flex h-full w-full items-center justify-center">
        <SoccerBall size={iconSize} className="text-emerald-400" />
        <Crown size={iconSize * 0.45} className="absolute -top-1 text-amber-400" />
      </div>
    </div>
  );
}

export function LogoWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-black italic tracking-tight text-white ${className}`}>
      FOOTI
    </span>
  );
}

export function LogoFull({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <LogoMark size={size === 'lg' ? 'lg' : 'sm'} />
      <LogoWordmark className={size === 'lg' ? 'text-5xl' : 'text-xl'} />
    </div>
  );
}
