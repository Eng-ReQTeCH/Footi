import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../lib/socket';
import { api, type Me } from '../lib/api';

export default function Home({ me }: { me: Me }) {
  const { createLobby, joinLobby, connected } = useSocket();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const c = await createLobby();
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

  return (
    <div className="space-y-6 pt-4">
      <section className="text-center">
        <h1 className="text-2xl font-black lg:text-3xl">
          Good evening, <span className="text-emerald-400">{me.username}</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {connected ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400" /> connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-400" /> reconnecting…
            </span>
          )}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={create}
          disabled={busy || !connected}
          className="group rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-left transition hover:bg-emerald-500/20 disabled:opacity-40"
        >
          <div className="text-3xl">🆕</div>
          <div className="mt-3 text-xl font-black text-emerald-400">Create lobby</div>
          <div className="mt-1 text-sm text-slate-400">You host — pick the mode, timer and questions</div>
        </button>

        <form
          onSubmit={join}
          className="rounded-2xl border border-pitch-700 bg-pitch-900 p-6"
        >
          <div className="text-3xl">🎮</div>
          <label className="mt-3 block text-xl font-black text-slate-200">Join a lobby</label>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="000"
              inputMode="numeric"
              className="w-28 rounded-xl border border-pitch-700 bg-pitch-950 px-4 py-3 text-center text-2xl font-black tracking-[0.4em] placeholder:text-slate-700 focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={code.length !== 3 || busy || !connected}
              className="flex-1 rounded-xl bg-slate-200 px-4 py-3 font-black text-pitch-950 transition active:scale-[0.98] disabled:opacity-40"
            >
              Join
            </button>
          </div>
        </form>
      </section>

      <section className="grid grid-cols-4 gap-3">
        {[
          { label: 'Matches', value: st.played, color: 'text-slate-200' },
          { label: 'Wins', value: st.wins, color: 'text-emerald-400' },
          { label: 'Losses', value: st.losses, color: 'text-rose-400' },
          { label: 'Win rate', value: `${winRate}%`, color: 'text-sky-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-pitch-700 bg-pitch-900 p-4 text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</div>
          </div>
        ))}
      </section>
    </div>
  );
}