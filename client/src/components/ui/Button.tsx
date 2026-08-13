import { cx } from '../../lib/theme';

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'purple' | 'ghost' | 'danger';
  icon?: React.ReactNode;
  full?: boolean;
};

export function Button({ variant = 'primary', icon, full, className, children, ...props }: BtnProps) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-black transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
        full && 'w-full',
        variant === 'primary' && 'btn-primary px-5 py-3.5 text-pitch-950',
        variant === 'purple' && 'btn-purple px-5 py-3.5 text-white',
        variant === 'secondary' && 'border border-pitch-bright bg-pitch-850/80 px-5 py-3.5 text-slate-200 hover:bg-pitch-800',
        variant === 'ghost' && 'px-3 py-2 text-slate-400 hover:text-white',
        variant === 'danger' && 'border border-rose-500/40 px-4 py-2 text-sm font-bold text-rose-400 hover:bg-rose-950',
        className,
      )}
      {...props}
    >
      {children}
      {icon}
    </button>
  );
}
