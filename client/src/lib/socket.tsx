import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { JudgeView, LobbyState } from './types';

interface SocketCtx {
  connected: boolean;
  state: LobbyState | null;
  judge: JudgeView | null;
  toast: string | null;
  createLobby: (settings?: unknown) => Promise<string>;
  joinLobby: (code: string) => Promise<void>;
  leaveLobby: () => void;
  updateSettings: (settings: unknown) => Promise<void>;
  setTeam: (userId: number, team: number | null) => Promise<void>;
  kick: (userId: number) => Promise<void>;
  start: () => Promise<void>;
  answer: (stage: string, payload: unknown) => Promise<void>;
  submitJudgments: (judgments: { userId: number; points: number }[]) => Promise<void>;
  guess: (playerId: number) => Promise<void>;
  bid: (amount: number) => Promise<void>;
  reveal: () => Promise<void>;
  nextSlot: () => Promise<void>;
  clearToast: () => void;
}

const Ctx = createContext<SocketCtx | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<LobbyState | null>(null);
  const [judge, setJudge] = useState<JudgeView | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('lobby:state', (s: LobbyState) => setState(s));
    socket.on('judge:view', (j: JudgeView) => setJudge(j));
    socket.on('lobby:error', (m: string) => showToast(m));
    socket.on('lobby:kicked', () => {
      setState(null);
      setJudge(null);
      showToast('You were kicked by the host');
    });
    socket.on('lobby:closed', () => {
      setState(null);
      setJudge(null);
      showToast('Lobby closed');
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const emit = async (event: string, ...args: unknown[]) => {
    const socket = socketRef.current!;
    const res = (await socket.emitWithAck(event, ...args)) as { ok: boolean; error?: string; code?: string };
    if (!res.ok) throw new Error(res.error ?? 'Something went wrong');
    return res;
  };

  const value: SocketCtx = {
    connected,
    state,
    judge,
    toast,
    clearToast: () => setToast(null),
    createLobby: async (settings) => (await emit('lobby:create', settings)).code!,
    joinLobby: async (code) => {
      await emit('lobby:join', code);
    },
    leaveLobby: () => socketRef.current?.emit('lobby:leave'),
    updateSettings: async (settings) => {
      await emit('lobby:settings', settings);
    },
    setTeam: async (userId, team) => {
      await emit('lobby:team', userId, team);
    },
    kick: async (userId) => {
      await emit('lobby:kick', userId);
    },
    start: async () => {
      await emit('lobby:start');
    },
    answer: async (stage, payload) => {
      await emit('lobby:answer', stage, payload);
    },
    submitJudgments: async (judgments) => {
      await emit('lobby:judge', judgments);
    },
    guess: async (playerId) => {
      await emit('lobby:guess', playerId);
    },
    bid: async (amount) => {
      await emit('lobby:bid', amount);
    },
    reveal: async () => {
      await emit('lobby:reveal');
    },
    nextSlot: async () => {
      await emit('lobby:nextSlot');
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSocket(): SocketCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSocket must be used inside SocketProvider');
  return ctx;
}