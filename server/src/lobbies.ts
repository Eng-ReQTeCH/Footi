import { randomInt } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import type { Pool } from 'pg';
import { getType, type QuestionRow } from './questionTypes';

const MAX_PLAYERS = 12;
const JUDGING_TIMEOUT_MS = 180_000;
const LOBBY_TTL_EMPTY_MS = 10 * 60_000;
const LOBBY_TTL_FINISHED_MS = 10 * 60_000;

export interface Settings {
  questionCount: number;
  secondsPerQuestion: number;
  pauseSeconds: number;
  categories: string[];
  difficulties: string[];
  mode: 'ffa' | 'teams';
  teamSizes: number[];
}

export const DEFAULT_SETTINGS: Settings = {
  questionCount: 10,
  secondsPerQuestion: 20,
  pauseSeconds: 4,
  categories: [],
  difficulties: ['easy', 'medium', 'hard'],
  mode: 'ffa',
  teamSizes: [],
};

interface Player {
  userId: number;
  username: string;
  sockets: Set<string>;
  connected: boolean;
  team: number | null;
  manualTeam: number | null;
  score: number;
  doneQuestion: boolean;
  doneAction: boolean;
  bid: number | null;
  named: string[] | null;
  answerPayload: unknown;
}

type Phase = 'lobby' | 'starting' | 'playing' | 'judging' | 'review' | 'results';
type Stage = 'question' | 'action';

interface Timer {
  kind: 'start' | 'question' | 'action' | 'review';
  endAt: number;
  duration: number;
}

interface Lobby {
  code: string;
  hostId: number;
  settings: Settings;
  players: Map<number, Player>;
  phase: Phase;
  stage: Stage | null;
  questions: QuestionRow[];
  currentIndex: number;
  timer: Timer | null;
  timerHandle: NodeJS.Timeout | null;
  judgeHandle: NodeJS.Timeout | null;
  answersLog: { questionIndex: number; userId: number; payload: unknown; points: number }[];
  resultsPayload: unknown;
  matchId: string | null;
  createdAt: number;
  finishedAt: number | null;
}

export class LobbyError extends Error {}

export interface LobbyUser {
  id: number;
  username: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function sanitizeSettings(s: unknown): Settings {
  const raw = (s ?? {}) as Record<string, unknown>;
  const difficulties = ['easy', 'medium', 'hard'].filter((d) => Array.isArray(raw.difficulties) && raw.difficulties.includes(d));
  const categories = Array.isArray(raw.categories) ? raw.categories.filter((c) => typeof c === 'string' && c.trim()).slice(0, 50) : [];
  const mode = raw.mode === 'teams' ? 'teams' : 'ffa';
  let teamSizes: number[] = [];
  if (mode === 'teams') {
    teamSizes = (Array.isArray(raw.teamSizes) ? raw.teamSizes : [])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 8)
      .slice(0, 8);
  }
  return {
    questionCount: clamp(Number(raw.questionCount) || 10, 1, 30),
    secondsPerQuestion: clamp(Number(raw.secondsPerQuestion) || 20, 10, 120),
    pauseSeconds: clamp(Number(raw.pauseSeconds) || 4, 0, 30),
    categories,
    difficulties,
    mode,
    teamSizes,
  };
}

export class LobbyManager {
  private lobbies = new Map<string, Lobby>();

  constructor(
    private io: Server,
    private pool: Pool,
  ) {
    setInterval(() => this.sweep(), 60_000);
  }

  private room(code: string) {
    return `lobby:${code}`;
  }

  private require(code: string): Lobby {
    const l = this.lobbies.get(code);
    if (!l) throw new LobbyError('Lobby not found');
    return l;
  }

  private newPlayer(user: LobbyUser): Player {
    return {
      userId: user.id,
      username: user.username,
      sockets: new Set(),
      connected: false,
      team: null,
      manualTeam: null,
      score: 0,
      doneQuestion: false,
      doneAction: false,
      bid: null,
      named: null,
      answerPayload: null,
    };
  }

  create(user: LobbyUser): string {
    let code: string;
    do {
      code = String(randomInt(0, 1000)).padStart(3, '0');
    } while (this.lobbies.has(code));
    const lobby: Lobby = {
      code,
      hostId: user.id,
      settings: structuredClone(DEFAULT_SETTINGS),
      players: new Map(),
      phase: 'lobby',
      stage: null,
      questions: [],
      currentIndex: -1,
      timer: null,
      timerHandle: null,
      judgeHandle: null,
      answersLog: [],
      resultsPayload: null,
      matchId: null,
      createdAt: Date.now(),
      finishedAt: null,
    };
    lobby.players.set(user.id, this.newPlayer(user));
    this.lobbies.set(code, lobby);
    return code;
  }

  join(code: string, user: LobbyUser) {
    const l = this.require(code);
    if (l.players.has(user.id)) return;
    if (l.phase !== 'lobby' && l.phase !== 'results') throw new LobbyError('Game already in progress');
    if (l.phase === 'lobby') {
      if (l.players.size >= MAX_PLAYERS) throw new LobbyError('Lobby is full');
      l.players.set(user.id, this.newPlayer(user));
      if (l.settings.mode === 'teams') this.assignTeamsIdle(l);
    } else {
      const existing = [...l.players.values()].find((p) => p.userId === user.id);
      if (!existing) throw new LobbyError('Spectators are not allowed');
      return;
    }
    this.broadcast(l);
  }

  attachSocket(socket: Socket, userId: number) {
    for (const l of this.lobbies.values()) {
      const p = l.players.get(userId);
      if (!p) continue;
      p.sockets.add(socket.id);
      p.connected = true;
      socket.data.code = l.code;
      socket.join(this.room(l.code));
      this.broadcast(l);
      this.syncJudge(l);
      return;
    }
    socket.data.code = null;
  }

  detachSocket(socket: Socket) {
    const code = socket.data.code as string | null;
    if (!code) return;
    const l = this.lobbies.get(code);
    if (!l) return;
    for (const p of l.players.values()) {
      if (p.sockets.delete(socket.id) && p.sockets.size === 0) {
        p.connected = false;
        this.broadcast(l);
      }
    }
  }

  setSettings(userId: number, code: string, raw: unknown) {
    const l = this.require(code);
    if (l.hostId !== userId) throw new LobbyError('Only the host can change settings');
    if (l.phase !== 'lobby') throw new LobbyError('Settings can only be changed before the game starts');
    const s = sanitizeSettings(raw);
    if (s.mode !== l.settings.mode) {
      for (const p of l.players.values()) {
        p.team = null;
        p.manualTeam = null;
      }
    }
    l.settings = s;
    if (s.mode === 'teams') this.assignTeamsIdle(l);
    this.broadcast(l);
  }

  setTeam(userId: number, code: string, targetUserId: number, teamIndex: number | null) {
    const l = this.require(code);
    if (l.hostId !== userId) throw new LobbyError('Only the host can assign teams');
    if (l.phase !== 'lobby') throw new LobbyError('Teams can only be changed before the game starts');
    if (l.settings.mode !== 'teams') throw new LobbyError('This lobby is not in team mode');
    const p = l.players.get(targetUserId);
    if (!p) throw new LobbyError('Player not found');
    p.manualTeam = teamIndex;
    this.assignTeamsIdle(l);
    this.broadcast(l);
  }

  private assignTeamsIdle(l: Lobby) {
    if (l.settings.mode !== 'teams') {
      for (const p of l.players.values()) {
        p.team = null;
        p.manualTeam = null;
      }
      return;
    }
    const sizes = l.settings.teamSizes;
    const total = sizes.reduce((a, b) => a + b, 0);
    for (const p of l.players.values()) p.team = null;
    if (total !== l.players.size) return;
    const slots: number[] = [];
    sizes.forEach((n, i) => {
      for (let k = 0; k < n; k++) slots.push(i);
    });
    const players = [...l.players.values()];
    const used = new Map<number, number>();
    for (const p of players) {
      if (p.manualTeam === null) continue;
      const t = p.manualTeam;
      if (t < 0 || t >= sizes.length) throw new LobbyError('Invalid team');
      used.set(t, (used.get(t) ?? 0) + 1);
      if (used.get(t)! > sizes[t]) throw new LobbyError('Team is over capacity — adjust team sizes');
    }
    const remaining = slots.slice();
    for (const t of used.keys()) {
      for (let k = 0; k < used.get(t)!; k++) {
        const idx = remaining.indexOf(t);
        if (idx >= 0) remaining.splice(idx, 1);
      }
    }
    for (const p of shuffle(players.filter((x) => x.manualTeam === null))) {
      const pick = remaining[randomInt(remaining.length)];
      remaining.splice(remaining.indexOf(pick), 1);
      p.team = pick;
    }
  }

  kick(userId: number, code: string, targetUserId: number) {
    const l = this.require(code);
    if (l.hostId !== userId) throw new LobbyError('Only the host can kick players');
    if (l.phase !== 'lobby') throw new LobbyError('Players can only be kicked before the game starts');
    const p = l.players.get(targetUserId);
    if (!p || targetUserId === userId) return;
    if (p.sockets.size > 0) this.io.to(this.room(l.code)).emit('lobby:kicked');
    l.players.delete(targetUserId);
    if (p.sockets.size > 0) for (const sid of p.sockets) this.io.sockets.sockets.get(sid)?.leave(this.room(l.code));
    this.broadcast(l);
  }

  leave(userId: number, code: string) {
    const l = this.lobbies.get(code);
    if (!l) return;
    const p = l.players.get(userId);
    if (!p) return;
    for (const sid of p.sockets) this.io.sockets.sockets.get(sid)?.leave(this.room(code));
    if (l.phase === 'lobby') {
      l.players.delete(userId);
      if (l.hostId === userId) {
        const next = [...l.players.values()][0];
        if (!next) {
          this.lobbies.delete(code);
          this.io.to(this.room(code)).emit('lobby:closed');
          return;
        }
        l.hostId = next.userId;
      }
      this.broadcast(l);
    } else if (l.phase === 'results') {
      l.players.delete(userId);
      this.broadcast(l);
    }
  }

  async start(userId: number, code: string) {
    const l = this.require(code);
    if (l.hostId !== userId) throw new LobbyError('Only the host can start the game');
    if (l.phase !== 'lobby') throw new LobbyError('Game already started');
    if (l.players.size < 2) throw new LobbyError('Need at least 2 players');
    if (l.settings.mode === 'ffa') {
      l.players.forEach((p) => {
        p.team = null;
        p.manualTeam = null;
      });
    } else {
      if (l.settings.teamSizes.length === 0) throw new LobbyError('Choose team sizes first');
      const total = l.settings.teamSizes.reduce((a, b) => a + b, 0);
      if (total !== l.players.size) {
        throw new LobbyError(`Team sizes must add up to the number of players (${l.players.size})`);
      }
      this.assignTeamsIdle(l);
    }
    const questions = await this.pickQuestions(l.settings);
    if (questions.length < l.settings.questionCount) {
      throw new LobbyError(`Only ${questions.length} questions match your filters — add more questions or loosen the filters`);
    }
    l.questions = shuffle(questions).slice(0, l.settings.questionCount);
    l.phase = 'starting';
    l.currentIndex = -1;
    this.startTimer(l, 'start', 3_000);
    this.broadcast(l);
  }

  private async pickQuestions(settings: Settings): Promise<QuestionRow[]> {
    const cond: string[] = [];
    const vals: unknown[] = [];
    if (settings.categories.length) {
      cond.push(`category = ANY($${vals.length + 1}::text[])`);
      vals.push(settings.categories);
    }
    if (settings.difficulties.length) {
      cond.push(`difficulty = ANY($${vals.length + 1}::text[])`);
      vals.push(settings.difficulties);
    }
    const sql =
      `SELECT id, question, answer, category, type, difficulty FROM questions` +
      (cond.length ? ` WHERE ${cond.join(' AND ')}` : '') +
      ` ORDER BY random() LIMIT ${Math.min(30, settings.questionCount)}`;
    const r = await this.pool.query(sql, vals);
    return r.rows.map((row) => ({ ...row, answer: row.answer }));
  }

  answer(userId: number, code: string, stage: string, payload: unknown) {
    const l = this.require(code);
    const p = l.players.get(userId);
    if (!p) throw new LobbyError('You are not in this lobby');
    if (l.phase !== 'playing' || l.stage !== stage) throw new LobbyError('Not accepting answers right now');
    const q = l.questions[l.currentIndex];
    const h = getType(q.type);
    if (!h) throw new LobbyError('Unknown question type');

    if (stage === 'question') {
      if (h.actionSeconds) {
        const bid = Number((payload as { bid?: unknown } | null)?.bid);
        if (!Number.isInteger(bid) || bid < 0 || bid > 50) throw new LobbyError('Bid must be an integer between 0 and 50');
        p.bid = bid;
        p.doneQuestion = true;
      } else {
        const err = h.validateAnswer(payload, q);
        if (err) throw new LobbyError(err);
        p.answerPayload = payload;
        p.doneQuestion = true;
      }
    } else {
      if (p.bid === null) throw new LobbyError('You did not place a bid');
      const named = Array.isArray(payload) ? payload : (payload as { named?: unknown })?.named;
      if (!Array.isArray(named) || named.some((n) => typeof n !== 'string')) throw new LobbyError('Invalid answer');
      const cleaned = named.map((n) => n.trim()).filter((n) => n.length > 0).slice(0, 40);
      if (cleaned.some((n) => n.length > 80)) throw new LobbyError('Answers are limited to 80 characters');
      p.named = cleaned;
      p.doneAction = true;
    }
    this.broadcast(l);
    this.checkStageComplete(l);
  }

  private checkStageComplete(l: Lobby) {
    if (l.phase !== 'playing') return;
    const q = l.questions[l.currentIndex];
    const h = getType(q.type)!;
    const players = [...l.players.values()];
    if (l.stage === 'question') {
      if (!players.every((p) => p.doneQuestion)) return;
      if (h.actionSeconds) this.beginBidAction(l);
      else this.judgePhase(l);
    } else {
      if (players.every((p) => p.doneAction || p.bid === null)) this.judgePhase(l);
    }
  }

  private typeHasAction(l: Lobby): boolean {
    const h = getType(l.questions[l.currentIndex].type);
    return !!h?.actionSeconds;
  }

  private beginBidAction(l: Lobby) {
    l.stage = 'action';
    this.startTimer(l, 'action', getType(l.questions[l.currentIndex].type)!.actionSeconds! * 1000);
  }

  private judgePhase(l: Lobby) {
    this.clearGameTimer(l);
    l.phase = 'judging';
    l.stage = null;
    this.broadcast(l);
    this.syncJudge(l);
    l.judgeHandle = setTimeout(() => this.autoJudge(l), JUDGING_TIMEOUT_MS);
  }

  private syncJudge(l: Lobby) {
    if (l.phase === 'judging') this.emitJudge(l);
  }

  private emitJudge(l: Lobby) {
    const host = l.players.get(l.hostId);
    if (!host || host.sockets.size === 0) return;
    const q = l.questions[l.currentIndex];
    const h = getType(q.type)!;
    const view = {
      questionIndex: l.currentIndex,
      question: q.question,
      type: q.type,
      category: q.category,
      difficulty: q.difficulty,
      correctText: h.correctText(q),
      revealPublic: h.publicView(q, true),
      players: [...l.players.values()].map((p) => this.judgeRow(l, p, h, q)),
    };
    for (const sid of host.sockets) this.io.to(sid).emit('judge:view', view);
  }

  private judgeRow(l: Lobby, p: Player, h: ReturnType<typeof getType>, q: QuestionRow) {
    const hasAction = !!h!.actionSeconds;
    const payload = hasAction ? { bid: p.bid ?? 0, named: p.named ?? [] } : p.answerPayload;
    const answered = hasAction ? p.bid !== null && p.doneAction : p.doneQuestion;
    const suggestion = answered ? h!.judgeSuggestion(payload, q) : { points: 0, entries: [] as { label: string; valid: boolean }[] };
    return {
      userId: p.userId,
      username: p.username,
      team: p.team,
      answered,
      payload,
      suggestedPoints: suggestion.points,
      entries: suggestion.entries ?? [],
    };
  }

  private autoJudge(l: Lobby) {
    if (l.phase !== 'judging') return;
    const q = l.questions[l.currentIndex];
    const h = getType(q.type)!;
    const judgments = [...l.players.values()].map((p) => {
      const hasAction = !!h.actionSeconds;
      const payload = hasAction ? { bid: p.bid ?? 0, named: p.named ?? [] } : p.answerPayload;
      const answered = hasAction ? p.bid !== null && p.doneAction : p.doneQuestion;
      return { userId: p.userId, points: answered ? h.judgeSuggestion(payload, q).points : 0 };
    });
    this.applyJudgments(l, judgments);
  }

  judge(userId: number, code: string, judgments: { userId: number; points: number }[]) {
    const l = this.require(code);
    if (l.hostId !== userId) throw new LobbyError('Only the host can submit judgments');
    this.applyJudgments(l, judgments);
  }

  private applyJudgments(l: Lobby, judgments: { userId: number; points: number }[]) {
    if (l.phase !== 'judging') return;
    const q = l.questions[l.currentIndex];
    const h = getType(q.type)!;
    const byId = new Map<number, number>(
      judgments.map((j) => [j.userId, clamp(Math.round(Number(j.points)) || 0, 0, 1000)]),
    );
    const expected = [...l.players.keys()].sort((a, b) => a - b);
    const given = [...byId.keys()].sort((a, b) => a - b);
    if (JSON.stringify(expected) !== JSON.stringify(given)) throw new LobbyError('Missing judgments for some players');
    for (const p of l.players.values()) {
      const points = byId.get(p.userId) ?? 0;
      p.score += points;
      const payload = h.actionSeconds ? { bid: p.bid ?? 0, named: p.named ?? [] } : p.answerPayload;
      l.answersLog.push({ questionIndex: l.currentIndex, userId: p.userId, payload, points });
    }
    if (l.judgeHandle) clearTimeout(l.judgeHandle);
    l.judgeHandle = null;
    l.phase = 'review';
    this.startTimer(l, 'review', l.settings.pauseSeconds * 1000);
  }

  private onTimer(l: Lobby, kind: Timer['kind']) {
    if (!l.timer || l.timer.kind !== kind) return;
    l.timer = null;
    if (l.phase === 'starting' && kind === 'start') {
      this.beginQuestion(l);
    } else if (l.phase === 'playing' && kind === 'question') {
      if (this.typeHasAction(l)) this.beginBidAction(l);
      else this.judgePhase(l);
    } else if (l.phase === 'playing' && kind === 'action') {
      this.judgePhase(l);
    } else if (l.phase === 'review' && kind === 'review') {
      this.nextOrFinish(l);
    }
  }

  private beginQuestion(l: Lobby) {
    l.currentIndex++;
    const q = l.questions[l.currentIndex];
    if (!q) {
      this.finish(l);
      return;
    }
    for (const p of l.players.values()) {
      p.doneQuestion = false;
      p.doneAction = false;
      p.bid = null;
      p.named = null;
      p.answerPayload = null;
    }
    l.phase = 'playing';
    l.stage = 'question';
    this.startTimer(l, 'question', l.settings.secondsPerQuestion * 1000);
  }

  private nextOrFinish(l: Lobby) {
    if (l.currentIndex + 1 >= l.questions.length) this.finish(l);
    else this.beginQuestion(l);
  }

  private finish(l: Lobby) {
    this.clearGameTimer(l);
    if (l.judgeHandle) clearTimeout(l.judgeHandle);
    l.phase = 'results';
    l.finishedAt = Date.now();
    l.resultsPayload = this.buildResults(l);
    this.broadcast(l);
    this.persistMatch(l).catch((err) => console.error('persist failed', err));
  }

  private buildResults(l: Lobby) {
    const players = [...l.players.values()];
    if (l.settings.mode === 'ffa') {
      const sorted = [...players].sort((a, b) => b.score - a.score);
      const standings = sorted.map((p, i) => {
        const place = i > 0 && sorted[i - 1].score === p.score ? standings0(i, sorted) : i + 1;
        return { userId: p.userId, username: p.username, score: p.score, place };
      });
      return { kind: 'ffa' as const, standings };
    }
    const byTeam = new Map<number, Player[]>();
    for (const p of players) {
      if (p.team === null) continue;
      if (!byTeam.has(p.team)) byTeam.set(p.team, []);
      byTeam.get(p.team)!.push(p);
    }
    const teamRows = [...byTeam.entries()]
      .map(([teamIdx, members]) => ({
        teamIdx,
        score: members.reduce((s, m) => s + m.score, 0),
        members: [...members].sort((a, b) => b.score - a.score).map((m) => ({ userId: m.userId, username: m.username, score: m.score })),
      }))
      .sort((a, b) => b.score - a.score);
    const ranked = teamRows.map((t, i) => {
      const place = i > 0 && teamRows[i - 1].score === t.score ? rankedPlace(i) : i + 1;
      return { ...t, place };
    });
    return { kind: 'teams' as const, standings: ranked };

    function rankedPlace(i: number): number {
      let p = i;
      while (p > 0 && teamRows[p - 1].score === teamRows[i].score) p--;
      return p + 1;
    }
  }

  private async persistMatch(l: Lobby) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query<{ id: string }>(
        `INSERT INTO matches (lobby_code, mode, host_id, settings, question_ids, finished_at)
         VALUES ($1, $2, $3, $4, $5::int[], now()) RETURNING id`,
        [l.code, l.settings.mode, l.hostId, JSON.stringify(l.settings), l.questions.map((q) => q.id)],
      );
      const matchId = res.rows[0].id;
      const results = l.resultsPayload as
        | { kind: 'ffa'; standings: { userId: number; place: number; score: number }[] }
        | { kind: 'teams'; standings: { teamIdx: number; place: number; members: { userId: number; score: number }[] }[] };
      if (results.kind === 'ffa') {
        for (const s of results.standings) {
          await client.query(
            `INSERT INTO match_players (match_id, user_id, team, place, score) VALUES ($1, $2, NULL, $3, $4)`,
            [matchId, s.userId, s.place, s.score],
          );
        }
      } else {
        for (const t of results.standings) {
          for (const m of t.members) {
            await client.query(
              `INSERT INTO match_players (match_id, user_id, team, place, score) VALUES ($1, $2, $3, $4, $5)`,
              [matchId, m.userId, `Team ${t.teamIdx + 1}`, t.place, m.score],
            );
          }
        }
      }
      for (const a of l.answersLog) {
        await client.query(
          `INSERT INTO answers (match_id, question_index, user_id, payload, points) VALUES ($1, $2, $3, $4, $5)`,
          [matchId, a.questionIndex, a.userId, JSON.stringify(a.payload), a.points],
        );
      }
      await client.query('COMMIT');
      l.matchId = matchId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private startTimer(l: Lobby, kind: Timer['kind'], ms: number) {
    this.clearGameTimer(l);
    l.timer = { kind, endAt: Date.now() + ms, duration: ms };
    l.timerHandle = setTimeout(() => this.onTimer(l, kind), ms + 100);
    this.broadcast(l);
  }

  private clearGameTimer(l: Lobby) {
    if (l.timerHandle) clearTimeout(l.timerHandle);
    l.timerHandle = null;
    l.timer = null;
  }

  broadcast(l: Lobby) {
    this.io.to(this.room(l.code)).emit('lobby:state', this.snapshot(l));
    this.syncJudge(l);
  }

  private snapshot(l: Lobby): Record<string, unknown> {
    const reveal = l.phase === 'review' || l.phase === 'results';
    const q = l.currentIndex >= 0 ? l.questions[l.currentIndex] : null;
    const h = q ? getType(q.type) : undefined;
    const stage = l.phase === 'playing' ? l.stage : null;

    const players = [...l.players.values()].map((p) => {
      const done = stage === 'action' ? p.bid === null || p.doneAction : p.doneQuestion;
      return {
        userId: p.userId,
        username: p.username,
        connected: p.connected,
        team: p.team,
        score: p.score,
        done: l.phase === 'judging' ? false : done,
        bid: stage === 'action' || reveal ? (p.bid ?? undefined) : undefined,
      };
    });

    let answers: unknown;
    if (reveal && q) {
      const last = l.answersLog.filter((a) => a.questionIndex === l.currentIndex);
      answers = last.map((a) => ({ userId: a.userId, points: a.points, summary: h!.summary(a.payload as never, q) }));
    }

    return {
      code: l.code,
      hostId: l.hostId,
      phase: l.phase,
      settings: l.settings,
      players,
      questionCount: l.questions.length,
      currentIndex: l.phase === 'lobby' || l.phase === 'starting' ? -1 : l.currentIndex,
      stage,
      question: q && h
        ? {
            id: q.id,
            type: q.type,
            question: q.question,
            category: q.category,
            difficulty: q.difficulty,
            view: h.publicView(q, reveal),
          }
        : undefined,
      timer: l.timer,
      answers,
      results: l.phase === 'results' ? l.resultsPayload : undefined,
    };
  }

  private sweep() {
    const now = Date.now();
    for (const [code, l] of this.lobbies) {
      const alive = [...l.players.values()].filter((p) => p.connected).length;
      if (l.phase === 'lobby' && alive === 0 && now - l.createdAt > LOBBY_TTL_EMPTY_MS) this.close(l);
      else if (l.phase === 'results' && l.finishedAt && now - l.finishedAt > LOBBY_TTL_FINISHED_MS) this.close(l);
    }
  }

  private close(l: Lobby) {
    this.clearGameTimer(l);
    if (l.judgeHandle) clearTimeout(l.judgeHandle);
    this.lobbies.delete(l.code);
    this.io.to(this.room(l.code)).emit('lobby:closed');
  }
}

function standings0(i: number, sorted: { score: number }[]): number {
  let p = i;
  while (p > 0 && sorted[p - 1].score === sorted[i].score) p--;
  return p + 1;
}