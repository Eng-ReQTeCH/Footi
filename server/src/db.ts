import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://footi:footi@db:5432/footi',
  max: 10,
});

const CANDIDATES = ['/app/db/init/001_schema.sql', 'db/init/001_schema.sql', '../db/init/001_schema.sql'];

export async function runMigrations() {
  let file = CANDIDATES.find((f) => existsSync(path.resolve(f)));
  if (!file) throw new Error('Could not find db/init/001_schema.sql — run migrations manually');
  const sql = await readFile(path.resolve(file), 'utf8');
  await pool.query(sql);
}