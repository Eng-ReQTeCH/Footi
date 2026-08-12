import { useSocket } from '../lib/socket';
import LobbyView from '../components/LobbyView';
import GameView from '../components/GameView';
import JudgeView from '../components/JudgeView';
import ResultsView from '../components/ResultsView';
import { useNavigate } from 'react-router-dom';

export default function Room() {
  const { state, connected } = useSocket();
  const navigate = useNavigate();

  if (!state) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <div className="text-5xl">🛋️</div>
        <p className="text-slate-300">
          {connected ? 'You are not in a lobby.' : 'Reconnecting…'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="rounded-xl bg-emerald-500 px-6 py-3 font-black text-pitch-950"
        >
          Back to home
        </button>
      </div>
    );
  }

  if (state.phase === 'lobby') return <LobbyView state={state} />;
  if (state.phase === 'results') return <ResultsView state={state} />;
  if (state.phase === 'judging') return <JudgeView state={state} />;
  return <GameView state={state} />;
}