import { mkdirSync, existsSync, readdirSync } from 'node:fs';
import { writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { PlayerData } from './players';

const IMAGE_DIR = path.resolve(process.env.IMAGE_DIR || 'data/images');
const CONCURRENCY = 8;
const TIMEOUT_MS = 20_000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];

const remoteByPlayerId = new Map<number, string>();
const fileByPlayerId = new Map<number, string>();

function ensureDir() {
  mkdirSync(IMAGE_DIR, { recursive: true });
  for (const name of readdirSync(IMAGE_DIR)) {
    const m = name.match(/^(\d+)\.([a-z0-9]{2,5})$/i);
    if (!m) continue;
    const ext = m[2].toLowerCase() === 'jpeg' ? 'jpg' : m[2].toLowerCase();
    if (EXTS.includes(ext)) fileByPlayerId.set(Number(m[1]), `${m[1]}.${ext}`);
  }
}

function localPath(id: number): string | null {
  const name = fileByPlayerId.get(id);
  if (!name) return null;
  const abs = path.join(IMAGE_DIR, name);
  return existsSync(abs) ? abs : null;
}

function extFor(url: string, contentType: string | null): string {
  const ct = (contentType ?? '').split(';')[0].trim().toLowerCase();
  if (ct === 'image/jpeg') return 'jpg';
  if (ct === 'image/png') return 'png';
  if (ct === 'image/webp') return 'webp';
  if (ct === 'image/gif') return 'gif';
  if (ct === 'image/avif') return 'avif';
  const m = url.split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
  if (m) {
    const e = m[1].toLowerCase();
    if (EXTS.includes(e)) return e === 'jpeg' ? 'jpg' : e;
  }
  return 'jpg';
}

async function downloadOne(id: number, url: string): Promise<void> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Referer: 'https://www.transfermarkt.com/' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error('empty body');
  const ext = extFor(url, res.headers.get('content-type'));
  const name = `${id}.${ext}`;
  const abs = path.join(IMAGE_DIR, name);
  const tmp = `${abs}.part`;
  await writeFile(tmp, buf);
  try {
    await rename(tmp, abs);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
  fileByPlayerId.set(id, name);
}

export function setupImageCache(data: PlayerData): void {
  ensureDir();
  const jobs: { id: number; url: string }[] = [];
  for (const p of data.players) {
    const remote = p.imageUrl;
    remoteByPlayerId.set(p.id, remote);
    p.imageUrl = `/images/${p.id}`;
    if (fileByPlayerId.has(p.id)) continue;
    jobs.push({ id: p.id, url: remote });
  }
  if (jobs.length === 0) {
    console.log(`[images] all ${data.players.length} player images already cached locally`);
    return;
  }
  console.log(`[images] caching ${jobs.length} player images → ${IMAGE_DIR}`);
  let cursor = 0;
  let inFlight = 0;
  let done = 0;
  const total = jobs.length;
  const pump = () => {
    while (inFlight < CONCURRENCY && cursor < jobs.length) {
      const job = jobs[cursor++];
      inFlight++;
      downloadOne(job.id, job.url)
        .catch(() => {})
        .finally(() => {
          inFlight--;
          done++;
          if (done === total || done % 50 === 0) console.log(`[images] ${done}/${total} cached`);
          pump();
        });
    }
    if (done === total) console.log(`[images] done — ${done}/${total} player images cached locally`);
  };
  pump();
}

export function localFileFor(id: number): string | null {
  return localPath(id);
}

export function remoteFor(id: number): string | null {
  return remoteByPlayerId.get(id) ?? null;
}
