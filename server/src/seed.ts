import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool, runMigrations } from './db';
import { getType, listTypes, type SeedQuestion } from './questionTypes';

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.log('Usage: npm run seed -- <file1.json> [file2.json ...]');
    console.log('Each file must contain a JSON array of questions.');
    process.exit(1);
  }
  await runMigrations();

  let total = 0;
  const counts = new Map<string, { ok: number; bad: number }>();
  const bad: Array<{ file: string; index: number; error: string }> = [];
  const validTypes = listTypes().map((t) => t.name).join(', ');

  for (const file of files) {
    const raw = await readFile(resolve(file), 'utf8');
    const data = JSON.parse(raw) as unknown;
    const list = Array.isArray(data) ? data : [data];
    for (let i = 0; i < list.length; i++) {
      const item = list[i] as Partial<SeedQuestion>;
      const type = String(item.type ?? 'unknown');
      const entry = counts.get(type) ?? { ok: 0, bad: 0 };
      const fail = (error: string) => {
        bad.push({ file, index: i, error });
        entry.bad++;
        counts.set(type, entry);
      };
      const handler = getType(type);
      if (!handler) {
        fail(`Unknown question type "${type}" (valid: ${validTypes})`);
        continue;
      }
      if (typeof item.question !== 'string' || item.question.length < 3) {
        fail('question must be a string of at least 3 characters');
        continue;
      }
      if (typeof item.category !== 'string' || !item.category.trim()) {
        fail('category is required');
        continue;
      }
      if (!['easy', 'medium', 'hard'].includes(String(item.difficulty))) {
        fail('difficulty must be "easy", "medium" or "hard"');
        continue;
      }
      const err = handler.validateSeed(item as SeedQuestion);
      if (err) {
        fail(err);
        continue;
      }
      await pool.query(
        `INSERT INTO questions (question, answer, category, type, difficulty)
         VALUES ($1, $2, $3, $4, $5)`,
        [item.question, JSON.stringify(item.answer), String(item.category).trim(), item.type, String(item.difficulty)],
      );
      entry.ok++;
      counts.set(type, entry);
      total++;
    }
  }

  console.log(`Imported ${total} questions:`);
  for (const [type, c] of counts) console.log(`  ${type}: ${c.ok} ok, ${c.bad} failed`);
  if (bad.length) {
    console.log('\nErrors:');
    for (const b of bad.slice(0, 20)) console.log(`  ${b.file} #${b.index}: ${b.error}`);
  }
  await pool.end();
  process.exit(bad.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});