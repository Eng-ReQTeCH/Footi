import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { pool } from './db';
import { config } from './config';
import { requireUser } from './auth';
import { outcomeFor, type PlayerRow } from './stats';
import { getType, listTypes, type SeedQuestion } from './questionTypes';
import { localFileFor, remoteFor } from './imageCache';

function checkAdmin(req: express.Request): boolean {
  const got = Buffer.from(String(req.headers['x-admin-token'] ?? ''));
  const want = Buffer.from(config.adminToken);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function wlBetween(aId: number, bId: number) {
  const r = await pool.query(
    `SELECT m.id, m.mode, mp.user_id, mp.team, mp.place, mp.score
     FROM matches m
     JOIN match_players mp ON mp.match_id = m.id
     WHERE m.finished_at IS NOT NULL
       AND m.id IN (
         SELECT match_id FROM match_players
         WHERE user_id IN ($1, $2)
         GROUP BY match_id HAVING COUNT(DISTINCT user_id) = 2
       )
     ORDER BY m.finished_at DESC
     LIMIT 500`,
    [aId, bId],
  );
  const rows = r.rows as Array<{ id: string; mode: string } & PlayerRow>;
  const byMatch = new Map<string, { mode: string; rows: PlayerRow[] }>();
  for (const row of rows) {
    const entry = byMatch.get(row.id) ?? { mode: row.mode, rows: [] as PlayerRow[] };
    entry.rows.push({ user_id: row.user_id, team: row.team, place: row.place, score: row.score });
    byMatch.set(row.id, entry);
  }
  const counts = { w: 0, l: 0, d: 0 };
  for (const entry of byMatch.values()) {
    const o = outcomeFor(aId, entry.rows, entry.mode);
    if (o === 'win') counts.w++;
    else if (o === 'loss') counts.l++;
    else if (o === 'draw') counts.d++;
  }
  return counts;
}

export function setupRoutes(app: express.Express) {
  app.get('/images/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).end();
    const local = localFileFor(id);
    if (local) return res.sendFile(local, { maxAge: '7d' });
    const remote = remoteFor(id);
    if (remote) return res.redirect(302, remote);
    res.status(404).end();
  });

  app.get('/api/meta', async (_req, res) => {
    const cats = await pool.query('SELECT DISTINCT category FROM questions ORDER BY category');
    const types = listTypes().map((t) => ({ name: t.name, displayName: t.displayName }));
    res.json({ categories: cats.rows.map((r) => r.category), types, difficulties: ['easy', 'medium', 'hard'] });
  });

  app.get('/api/users/search', requireUser, async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.json([]);
    const r = await pool.query(
      `SELECT id, username FROM users
       WHERE username ILIKE $1 AND id <> $2
       ORDER BY username LIMIT 10`,
      [`${q}%`, req.session.userId],
    );
    res.json(r.rows);
  });

  app.get('/api/friends', requireUser, async (req, res) => {
    const mine = req.session.userId!;
    const r = await pool.query(
      `SELECT u.id, u.username, f.created_at
       FROM friends f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 AND f.status = 'accepted'
       ORDER BY u.username`,
      [mine],
    );
    const friends = await Promise.all(
      r.rows.map(async (row) => {
        const counts = await wlBetween(mine, row.id);
        return { id: row.id, username: row.username, ...counts };
      }),
    );
    res.json(friends);
  });

  app.get('/api/friends/requests', requireUser, async (req, res) => {
    const r = await pool.query(
      `SELECT u.id, u.username
       FROM friends f
       JOIN users u ON u.id = f.user_id
       WHERE f.friend_id = $1 AND f.status = 'pending' AND f.requester_id = f.user_id`,
      [req.session.userId],
    );
    res.json(r.rows);
  });

  app.post('/api/friends/requests', requireUser, async (req, res) => {
    const username = String((req.body ?? {}).username ?? '').trim();
    const me = req.session.userId!;
    const found = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    const other = found.rows[0]?.id as number | undefined;
    if (!other) return res.status(404).json({ error: 'User not found' });
    if (other === me) return res.status(400).json({ error: 'You cannot befriend yourself' });
    const existing = await pool.query(
      'SELECT status FROM friends WHERE user_id = $1 AND friend_id = $2',
      [me, other],
    );
    if (existing.rowCount) {
      const st = existing.rows[0].status as string;
      if (st === 'accepted') return res.status(400).json({ error: 'Already friends' });
      await pool.query('UPDATE friends SET status = $1 WHERE user_id IN ($2, $3) AND friend_id IN ($2, $3)', ['accepted', me, other]);
      return res.json({ ok: true, accepted: true });
    }
    const incoming = await pool.query(
      'SELECT 1 FROM friends WHERE user_id = $1 AND friend_id = $2 AND status = $3',
      [other, me, 'pending'],
    );
    if (incoming.rowCount) {
      await pool.query('UPDATE friends SET status = $1 WHERE user_id IN ($2, $3) AND friend_id IN ($2, $3)', ['accepted', me, other]);
      return res.json({ ok: true, accepted: true });
    }
    await pool.query(
      `INSERT INTO friends (user_id, friend_id, status, requester_id)
       VALUES ($1, $2, 'pending', $1), ($2, $1, 'pending', $1)`,
      [me, other],
    );
    res.json({ ok: true, accepted: false });
  });

  app.post('/api/friends/respond', requireUser, async (req, res) => {
    const username = String((req.body ?? {}).username ?? '').trim();
    const accept = Boolean((req.body ?? {}).accept);
    const me = req.session.userId!;
    const found = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    const other = found.rows[0]?.id as number | undefined;
    if (!other) return res.status(404).json({ error: 'User not found' });
    if (accept) {
      await pool.query('UPDATE friends SET status = $1 WHERE user_id IN ($2, $3) AND friend_id IN ($2, $3)', ['accepted', me, other]);
    } else {
      await pool.query('DELETE FROM friends WHERE user_id IN ($1, $2) AND friend_id IN ($1, $2)', [me, other]);
    }
    res.json({ ok: true });
  });

  app.delete('/api/friends/:username', requireUser, async (req, res) => {
    const me = req.session.userId!;
    const found = await pool.query('SELECT id FROM users WHERE username = $1', [req.params.username]);
    const other = found.rows[0]?.id as number | undefined;
    if (!other) return res.status(404).json({ error: 'User not found' });
    await pool.query('DELETE FROM friends WHERE user_id IN ($1, $2) AND friend_id IN ($1, $2)', [me, other]);
    res.json({ ok: true });
  });

  app.get('/api/history', requireUser, async (req, res) => {
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const r = await pool.query(
      `SELECT m.id, m.mode, m.settings, m.finished_at, m.lobby_code,
              mp.user_id, u.username AS mp_username, mp.team, mp.place, mp.score
       FROM matches m
       JOIN match_players mp ON mp.match_id = m.id
       JOIN users u ON u.id = mp.user_id
       WHERE m.finished_at IS NOT NULL
         AND m.id IN (SELECT match_id FROM match_players WHERE user_id = $1)
       ORDER BY m.finished_at DESC
       LIMIT $2 OFFSET $3`,
      [req.session.userId, limit, offset],
    );
    const byMatch = new Map<string, Record<string, unknown>>();
    for (const row of r.rows) {
      const entry = byMatch.get(row.id) ?? {
        id: row.id,
        lobbyCode: row.lobby_code,
        mode: row.mode,
        settings: row.settings,
        finishedAt: row.finished_at,
        players: [] as unknown[],
      };
      entry.players.push({
        userId: row.user_id,
        username: row.mp_username,
        team: row.team,
        place: row.place,
        score: row.score,
      });
      byMatch.set(row.id, entry);
    }
    res.json([...byMatch.values()]);
  });

  app.use('/api/admin', (req, res, next) => {
    if (checkAdmin(req)) return next();
    res.status(401).json({ error: 'Invalid admin token' });
  });

  app.get('/api/admin/questions', async (req, res) => {
    const cond: string[] = [];
    const vals: unknown[] = [];
    const add = (c: string) => {
      cond.push(`${c} = ANY($${vals.length + 1}::text[])`);
    };
    const { category, type, difficulty, q } = req.query as Record<string, string | undefined>;
    if (category) add('category');
    if (type) add('type');
    if (difficulty) add('difficulty');
    if (q) {
      cond.push(`(question ILIKE $${vals.length + 1} OR category ILIKE $${vals.length + 1})`);
    }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    if (category) vals.push(category);
    if (type) vals.push(type);
    if (difficulty) vals.push(difficulty);
    if (q) vals.push(`%${q}%`);
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM questions ${where}`, vals);
    const rows = await pool.query(
      `SELECT id, question, answer, category, type, difficulty, created_at
       FROM questions ${where}
       ORDER BY id DESC LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
      [...vals, limit, offset],
    );
    res.json({ total: count.rows[0].total, rows: rows.rows });
  });

  const validateQuestion = (q: unknown): { ok: true; q: SeedQuestion } | { ok: false; error: string } => {
    const body = (q ?? {}) as Record<string, unknown>;
    const seed: SeedQuestion = {
      question: String(body.question ?? ''),
      answer: body.answer,
      category: String(body.category ?? ''),
      type: String(body.type ?? ''),
      difficulty: String(body.difficulty ?? '') as SeedQuestion['difficulty'],
    };
    if (seed.question.trim().length < 3) return { ok: false, error: 'Question must be at least 3 characters' };
    if (!seed.category.trim()) return { ok: false, error: 'Category is required' };
    if (!['easy', 'medium', 'hard'].includes(seed.difficulty)) return { ok: false, error: 'Difficulty must be easy, medium or hard' };
    const handler = getType(seed.type);
    if (!handler) return { ok: false, error: `Unknown question type "${seed.type}"` };
    const err = handler.validateSeed(seed);
    if (err) return { ok: false, error: err };
    return { ok: true, q: seed };
  };

  app.post('/api/admin/questions', async (req, res) => {
    const v = validateQuestion(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const r = await pool.query(
      `INSERT INTO questions (question, answer, category, type, difficulty)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [v.q.question, JSON.stringify(v.q.answer), v.q.category.trim(), v.q.type, v.q.difficulty],
    );
    res.json({ id: r.rows[0].id });
  });

  app.put('/api/admin/questions/:id', async (req, res) => {
    const v = validateQuestion(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const r = await pool.query(
      `UPDATE questions SET question = $1, answer = $2, category = $3, type = $4, difficulty = $5
       WHERE id = $6 RETURNING id`,
      [v.q.question, JSON.stringify(v.q.answer), v.q.category.trim(), v.q.type, v.q.difficulty, req.params.id],
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Question not found' });
    res.json({ ok: true });
  });

  app.delete('/api/admin/questions/:id', async (req, res) => {
    const r = await pool.query('DELETE FROM questions WHERE id = $1', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Question not found' });
    res.json({ ok: true });
  });
}