import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const TOP5_COMPETITIONS = ['GB1', 'L1', 'ES1', 'IT1', 'FR1'];
const HIGH_MV_FLOOR = 15_000_000;
const TOP_CLUB_MV_FLOOR = 5_000_000;
const POSITIONS = ['Goalkeeper', 'Defender', 'Midfield', 'Attack'];

const PLAYER_CANDIDATES = ['/app/database/players.csv', '../Database/players.csv', 'Database/players.csv'];
const CLUB_CANDIDATES = ['/app/database/clubs.csv', '../Database/clubs.csv', 'Database/clubs.csv'];

export interface PoolPlayer {
  id: number;
  name: string;
  position: string;
  imageUrl: string;
  clubName: string;
  highestMV: number;
  lastSeason: number;
}

export interface Manager {
  id: string;
  name: string;
  clubName: string;
}

export interface PlayerData {
  players: PoolPlayer[];
  managers: Manager[];
  byId: Map<number, PoolPlayer>;
}

function firstExisting(candidates: string[]): string {
  for (const c of candidates) {
    if (existsSync(path.resolve(c))) return path.resolve(c);
  }
  throw new Error('Could not find player database CSVs — expected Database/players.csv and Database/clubs.csv');
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function indexHeaders(headers: string[]): Map<string, number> {
  const m = new Map<string, number>();
  headers.forEach((h, i) => m.set(h.trim(), i));
  return m;
}

function num(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function field(row: string[], idx: Map<string, number>, name: string): string {
  const i = idx.get(name);
  return i === undefined || i >= row.length ? '' : (row[i] ?? '').trim();
}

function isEgyptian(row: string[], idx: Map<string, number>): boolean {
  const comp = field(row, idx, 'current_club_domestic_competition_id');
  return (
    field(row, idx, 'country_of_birth') === 'Egypt' ||
    field(row, idx, 'country_of_citizenship') === 'Egypt' ||
    comp.startsWith('EGY')
  );
}

const FALLBACK_MANAGERS: { name: string; clubName: string }[] = [
  { name: 'Pep Guardiola', clubName: 'Manchester City' },
  { name: 'Jürgen Klopp', clubName: 'Liverpool' },
  { name: 'Mikel Arteta', clubName: 'Arsenal' },
  { name: 'Carlo Ancelotti', clubName: 'Real Madrid' },
  { name: 'Xavi Hernández', clubName: 'FC Barcelona' },
  { name: 'Diego Simeone', clubName: 'Atlético de Madrid' },
  { name: 'José Mourinho', clubName: 'Roma' },
  { name: 'Simone Inzaghi', clubName: 'Inter Milan' },
  { name: 'Luciano Spalletti', clubName: 'Napoli' },
  { name: 'Thomas Tuchel', clubName: 'Bayern Munich' },
  { name: 'Julian Nagelsmann', clubName: 'RB Leipzig' },
  { name: 'Xabi Alonso', clubName: 'Bayer Leverkusen' },
  { name: 'Erik ten Hag', clubName: 'Manchester United' },
  { name: 'Unai Emery', clubName: 'Aston Villa' },
  { name: 'Eddie Howe', clubName: 'Newcastle United' },
  { name: 'Arne Slot', clubName: 'Feyenoord' },
  { name: 'Luis Enrique', clubName: 'Paris Saint-Germain' },
  { name: 'Roberto De Zerbi', clubName: 'Brighton' },
  { name: 'Gian Piero Gasperini', clubName: 'Atalanta' },
  { name: 'Massimiliano Allegri', clubName: 'Juventus' },
  { name: 'Paulo Fonseca', clubName: 'Milan' },
  { name: 'Adi Hütter', clubName: 'Monaco' },
  { name: 'Bruno Génésio', clubName: 'Lille' },
  { name: 'Sergio Conceição', clubName: 'Porto' },
  { name: 'Hansi Flick', clubName: 'Barcelona' },
  { name: 'Marcelino', clubName: 'Villarreal' },
  { name: 'Marcelo Gallardo', clubName: 'River Plate' },
];

export async function loadPlayerData(): Promise<PlayerData> {
  const playersPath = firstExisting(PLAYER_CANDIDATES);
  const clubsPath = firstExisting(CLUB_CANDIDATES);
  const pRows = parseCsv(await readFile(playersPath, 'utf8'));
  const cRows = parseCsv(await readFile(clubsPath, 'utf8'));
  if (pRows.length < 2 || cRows.length < 2) throw new Error('Player/club CSVs are empty');
  const pIdx = indexHeaders(pRows[0]);
  const cIdx = indexHeaders(cRows[0]);

  const clubScores = new Map<string, number>();
  for (let i = 1; i < pRows.length; i++) {
    const row = pRows[i];
    if (row.length === 1 && row[0].trim() === '') continue;
    const comp = field(row, pIdx, 'current_club_domestic_competition_id');
    const cid = field(row, pIdx, 'current_club_id');
    if (!comp || !cid) continue;
    const key = `${comp}:${cid}`;
    clubScores.set(key, (clubScores.get(key) ?? 0) + num(field(row, pIdx, 'highest_market_value_in_eur')));
  }

  const topClubKeys = new Set<string>();
  for (const comp of TOP5_COMPETITIONS) {
    const entries = [...clubScores.entries()]
      .filter(([k]) => k.startsWith(`${comp}:`))
      .sort((a, b) => b[1] - a[1]);
    for (const [k] of entries.slice(0, 10)) topClubKeys.add(k);
  }

  const players: PoolPlayer[] = [];
  const byId = new Map<number, PoolPlayer>();
  const seen = new Set<number>();
  for (let i = 1; i < pRows.length; i++) {
    const row = pRows[i];
    if (row.length === 1 && row[0].trim() === '') continue;
    const id = num(field(row, pIdx, 'player_id'));
    if (!id || seen.has(id)) continue;
    const position = field(row, pIdx, 'position');
    if (!POSITIONS.includes(position)) continue;
    const imageUrl = field(row, pIdx, 'image_url');
    if (!imageUrl.startsWith('http') || imageUrl.includes('default.jpg')) continue;
    const highestMV = num(field(row, pIdx, 'highest_market_value_in_eur'));
    if (highestMV <= 0) continue;
    const comp = field(row, pIdx, 'current_club_domestic_competition_id');
    const cid = field(row, pIdx, 'current_club_id');
    const inTopClub = topClubKeys.has(`${comp}:${cid}`);
    if (!(highestMV >= HIGH_MV_FLOOR || (inTopClub && highestMV >= TOP_CLUB_MV_FLOOR) || isEgyptian(row, pIdx))) continue;
    const first = field(row, pIdx, 'first_name');
    const last = field(row, pIdx, 'last_name');
    const name = (field(row, pIdx, 'name') || `${first} ${last}`).trim();
    const p: PoolPlayer = {
      id,
      name: name || `Player #${id}`,
      position,
      imageUrl,
      clubName: field(row, pIdx, 'current_club_name'),
      highestMV,
      lastSeason: num(field(row, pIdx, 'last_season')),
    };
    players.push(p);
    byId.set(id, p);
    seen.add(id);
  }

  const managers: Manager[] = [];
  for (let i = 1; i < cRows.length; i++) {
    const row = cRows[i];
    const comp = field(row, cIdx, 'domestic_competition_id');
    const coach = field(row, cIdx, 'coach_name');
    if (!coach) continue;
    if (!TOP5_COMPETITIONS.includes(comp) && !comp.startsWith('EGY')) continue;
    managers.push({ id: `${field(row, cIdx, 'club_id')}:${coach}`, name: coach, clubName: field(row, cIdx, 'name') });
  }

  if (managers.length === 0) {
    FALLBACK_MANAGERS.forEach((m, i) => managers.push({ id: `fallback:${i}`, name: m.name, clubName: m.clubName }));
  }

  if (players.length === 0) {
    throw new Error('Player pool is empty — check that Database/players.csv is mounted and readable');
  }

  return { players, managers, byId };
}
