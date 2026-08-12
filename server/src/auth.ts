import express from 'express';
import session from 'express-session';
import ConnectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcryptjs';
import { pool } from './db';
import { config } from './config';
import { outcomeFor, type PlayerRow } from './stats';

const PgStore = ConnectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgStore({ pool, tableName: 'session', createTableIfMissing: true }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 },
});

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
  }
}

export function requireUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.session?.userId) return next();
  res.status(401).json({ error: 'Not logged in' });
}

const USER_RE = /^[A-Za-z0-9_]{3,20}$/;

export function setupAuth(app: express.Express) {
  app.use(sessionMiddleware);
  app.use(express.json({ limit: '512kb' }));

  app.post('/api/register', async (req, res) => {
    const { username, password } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof username !== 'string' || !USER_RE.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters (letters, numbers, _)' });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
      return res.status(400).json({ error: 'Password must be 6-72 characters' });
    }
    const exists = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (exists.rowCount) return res.status(409).json({ error: 'Username already taken' });
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username', [username, hash]);
    req.session.userId = r.rows[0].id;
    req.session.username = username;
    res.json({ id: r.rows[0].id, username });
  });

  app.post('/api/login', async (req, res) => {
    const { username, password } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Missing username or password' });
    }
    const r = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
    const row = r.rows[0] as { id: number; username: string; password_hash: string } | undefined;
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    req.session.userId = row.id;
    req.session.username = row.username;
    res.json({ id: row.id, username: row.username });
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get('/api/me', requireUser, async (req, res) => {
    const r = await pool.query(
      `SELECT m.id, m.mode, mp.user_id, mp.place, mp.team, mp.score
       FROM (SELECT id, mode FROM matches
             WHERE finished_at IS NOT NULL
               AND id IN (SELECT match_id FROM match_players WHERE user_id = $1)
             ORDER BY finished_at DESC LIMIT 200) m
       JOIN match_players mp ON mp.match_id = m.id`,
      [req.session.userId],
    );
    const rows = r.rows as Array<{ id: string; mode: string } & PlayerRow>;
    const byMatch = new Map<string, { mode: string; rows: PlayerRow[] }>();
    for (const row of rows) {
      const entry = byMatch.get(row.id) ?? { mode: row.mode, rows: [] as PlayerRow[] };
      entry.rows.push({ user_id: row.user_id, team: row.team, place: row.place, score: row.score });
      byMatch.set(row.id, entry);
    }
    const counts = { wins: 0, losses: 0, draws: 0 };
    for (const entry of byMatch.values()) {
      const o = outcomeFor(req.session.userId!, entry.rows, entry.mode);
      if (o === 'win') counts.wins++;
      else if (o === 'loss') counts.losses++;
      else if (o === 'draw') counts.draws++;
    }
    res.json({
      id: req.session.userId,
      username: req.session.username ?? `user${req.session.userId}`,
      stats: { played: byMatch.size, wins: counts.wins, losses: counts.losses, draws: counts.draws },
    });
  });
}