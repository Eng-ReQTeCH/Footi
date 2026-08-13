import type { Server, Socket } from 'socket.io';
import { LobbyManager } from './lobbies';

type Callback = (r: { ok: boolean; error?: string; code?: string }) => void;

function errOf(e: unknown): string {
  return e instanceof Error ? e.message : 'Unexpected error';
}

export function setupSockets(io: Server, manager: LobbyManager) {
  io.use((socket, next) => {
    const req = socket.request as { session?: { userId?: number; username?: string } };
    const userId = req.session?.userId;
    if (!userId) return next(new Error('Not signed in'));
    socket.data.userId = userId;
    socket.data.username = req.session?.username ?? `user${userId}`;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = () => ({ id: socket.data.userId as number, username: socket.data.username as string });
    const code = () => socket.data.code as string | null;

    manager.attachSocket(socket, socket.data.userId as number);
    socket.on('disconnect', () => manager.detachSocket(socket));

    socket.on('lobby:create', (settings: unknown, cb?: Callback) => {
      try {
        const prev = socket.data.code as string | null;
        const c = manager.create(user());
        if (prev && prev !== c) manager.leave(socket.data.userId, prev);
        manager.attachSocket(socket, socket.data.userId);
        if (settings && typeof settings === 'object') manager.setSettings(socket.data.userId, c, settings);
        cb?.({ ok: true, code: c });
      } catch (e) {
        cb?.({ ok: false, error: errOf(e) });
      }
    });

    socket.on('lobby:join', (rawCode: string, cb?: Callback) => {
      try {
        const c = String(rawCode ?? '').trim().replace(/\D/g, '').padStart(3, '0').slice(0, 3);
        if (c.length !== 3) throw new Error('Enter a 3-digit code');
        const prev = socket.data.code as string | null;
        manager.join(c, user());
        if (prev && prev !== c) manager.leave(socket.data.userId, prev);
        manager.attachSocket(socket, socket.data.userId);
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: errOf(e) });
      }
    });

    socket.on('lobby:leave', () => {
      if (code()) manager.leave(socket.data.userId as number, code()!);
      socket.data.code = null;
    });

    socket.on('lobby:settings', (settings: unknown, cb?: Callback) => {
      try {
        manager.setSettings(socket.data.userId as number, code()!, settings);
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: errOf(e) });
      }
    });

    socket.on('lobby:team', (targetUserId: number, teamIndex: number | null, cb?: Callback) => {
      try {
        manager.setTeam(socket.data.userId as number, code()!, Number(targetUserId), teamIndex);
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: errOf(e) });
      }
    });

    socket.on('lobby:kick', (targetUserId: number, cb?: Callback) => {
      try {
        manager.kick(socket.data.userId as number, code()!, Number(targetUserId));
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: errOf(e) });
      }
    });

    socket.on('lobby:start', async (cb?: Callback) => {
      try {
        await manager.start(socket.data.userId as number, code()!);
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: errOf(e) });
      }
    });

    socket.on('lobby:answer', (stage: string, payload: unknown, cb?: Callback) => {
      try {
        manager.answer(socket.data.userId as number, code()!, stage, payload);
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: errOf(e) });
      }
    });

    socket.on('lobby:judge', (judgments: { userId: number; points: number }[], cb?: Callback) => {
      try {
        manager.judge(socket.data.userId as number, code()!, judgments);
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: errOf(e) });
      }
    });

    socket.on('lobby:guess', (playerId: number, cb?: Callback) => {
      try {
        manager.guess(socket.data.userId as number, code()!, Number(playerId));
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: errOf(e) });
      }
    });

    socket.on('lobby:bid', (amount: number, cb?: Callback) => {
      try {
        manager.bid(socket.data.userId as number, code()!, Number(amount));
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: errOf(e) });
      }
    });

    socket.on('lobby:reveal', (cb?: Callback) => {
      try {
        manager.revealAuctionByHost(socket.data.userId as number, code()!);
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: errOf(e) });
      }
    });

    socket.on('lobby:nextSlot', (cb?: Callback) => {
      try {
        manager.nextAuctionSlotByHost(socket.data.userId as number, code()!);
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: errOf(e) });
      }
    });

    socket.on('lobby:pickWinner', (winnerUserId: number, cb?: Callback) => {
      try {
        manager.pickAuctionWinnerByHost(socket.data.userId as number, code()!, Number(winnerUserId));
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: errOf(e) });
      }
    });
  });
}