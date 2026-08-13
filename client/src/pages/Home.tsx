import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../lib/socket';
import { type Me } from '../lib/api';
import { AppHeader } from '../components/ui/AppHeader';
import { SoccerBall, LogIn } from '../components/ui/Icons';

export default function Home({ me }: { me: Me }) {
  const { createLobby, joinLobby, connected } = useSocket();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      await createLobby();
      navigate('/room');
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 3) return;
    setBusy(true);
    try {
      await joinLobby(code);
      navigate('/room');
    } finally {
      setBusy(false);
    }
  };

  const st = me.stats;
  const winRate = st.played ? Math.round((st.wins / st.played) * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6 pt-2">
      <AppHeader connected={connected} />

      <section>
        <h1 className="text-2xl font-black text-white">
          {greeting}, {me.username} 👋
        </h1>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          onClick={create}
          disabled={busy || !connected}
          className="glass-card group flex flex-col items-start p-4 text-left transition hover:border-emerald-500/40 hover:shadow-brand disabled:opacity-40"
        >
          <div className="mb-3 grid size-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <SoccerBall size={22} />
          </div>
          <div className="text-sm font-black text-white">Create lobby</div>
          <div className="mt-0.5 text-xs text-slate-500">Host a game</div>
        </button>

        <form
          onSubmit={join}
          className="glass-card flex flex-col items-start p-4"
        >
          <div className="mb-3 grid size-10 place-items-center rounded-xl bg-pitch-850 text-slate-300">
            <LogIn size={22} />
          </div>
          <div className="text-sm font-black text-white">Join a lobby</div>
          <div className="mt-2 flex w-full gap-1.5">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="000"
              inputMode="numeric"
              className="w-full rounded-lg border border-pitch-bright bg-pitch-950/80 px-2 py-2 text-center text-lg font-black tracking-[0.3em] placeholder:text-slate-700 focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={code.length !== 3 || busy || !connected}
            className="mt-2 w-full rounded-lg bg-slate-200 py-2 text-xs font-black text-pitch-950 transition active:scale-[0.98] disabled:opacity-40"
          >
            Join
          </button>
        </form>
      </section>

      <section className="grid grid-cols-4 gap-2">
        {[
          { label: 'Matches', value: st.played },
          { label: 'Wins', value: st.wins, accent: 'text-emerald-400' },
          { label: 'Losses', value: st.losses, accent: 'text-rose-400' },
          { label: 'Win rate', value: `${winRate}%`, accent: 'text-sky-400' },
        ].map((s) => (
          <div key={s.label} className="glass-card-sm p-3 text-center">
            <div className={`text-xl font-black ${s.accent ?? 'text-white'}`}>{s.value}</div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
