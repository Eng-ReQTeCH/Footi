import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const TOP5_COMPETITIONS = ['GB1', 'L1', 'ES1', 'IT1', 'FR1'];
const HIGH_MV_FLOOR = Number(process.env.PLAYER_MV_FLOOR) || 40_000_000;
const GK_MV_FLOOR = Number(process.env.PLAYER_GK_MV_FLOOR) || 15_000_000;
const TOP_CLUB_MV_FLOOR = Number(process.env.TOP_CLUB_MV_FLOOR) || 18_000_000;
const FC_RATING_FLOOR = Number(process.env.PLAYER_FC_RATING_FLOOR) || 83;
const GUESS_GK_MV_FLOOR = Number(process.env.GUESS_GK_MV_FLOOR) || 30_000_000;
const GUESS_DEF_MV_FLOOR = Number(process.env.GUESS_DEF_MV_FLOOR) || 60_000_000;
const GUESS_MID_MV_FLOOR = Number(process.env.GUESS_MID_MV_FLOOR) || 70_000_000;
const GUESS_ATT_MV_FLOOR = Number(process.env.GUESS_ATT_MV_FLOOR) || 80_000_000;
const GUESS_FC_RATING_FLOOR = Number(process.env.GUESS_FC_RATING_FLOOR) || 85;
const ADD_ID_OFFSET = 10_000_000;
const POSITIONS = ['Goalkeeper', 'Defender', 'Midfield', 'Attack'];

const FIFA_POSITION_MAP: Record<string, string> = {
  GK: 'Goalkeeper',
  CB: 'Defender',
  LB: 'Defender',
  RB: 'Defender',
  LWB: 'Defender',
  RWB: 'Defender',
  SW: 'Defender',
  CDM: 'Midfield',
  CM: 'Midfield',
  CAM: 'Midfield',
  LM: 'Midfield',
  RM: 'Midfield',
  LW: 'Attack',
  RW: 'Attack',
  ST: 'Attack',
  CF: 'Attack',
};

const PLAYER_CANDIDATES = ['/app/database/players.csv', '../Database/players.csv', 'Database/players.csv'];
const CLUB_CANDIDATES = ['/app/database/clubs.csv', '../Database/clubs.csv', 'Database/clubs.csv'];
const FC26_CANDIDATES = ['/app/database/FC26_20250921.csv', '../Database/FC26_20250921.csv', 'Database/FC26_20250921.csv'];
const ADDITIONAL_CANDIDATES = [
  '/app/database/additionalMensFROMFIFAS.csv',
  '../Database/additionalMensFROMFIFAS.csv',
  'Database/additionalMensFROMFIFAS.csv',
];

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
  guessWhoPlayers: PoolPlayer[];
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

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Fc26Index {
  long: Map<string, Map<number, string>>;
  short: Map<string, Map<number, string>>;
  last: Map<string, Map<number, string>>;
  lastClub: Map<string, Map<number, string>>;
  ids: Set<number>;
}

function addFc26(m: Map<string, Map<number, string>>, key: string, overall: number, id: string): void {
  let entry = m.get(key);
  if (!entry) {
    entry = new Map();
    m.set(key, entry);
  }
  if (!entry.has(overall)) entry.set(overall, id);
}

function bestOverall(m: Map<number, string> | undefined): number {
  if (!m || m.size === 0) return 0;
  let best = 0;
  for (const k of m.keys()) if (k > best) best = k;
  return best;
}

function loadFc26(rows: string[][], idx: Map<string, number>): Fc26Index {
  const long = new Map<string, Map<number, string>>();
  const short = new Map<string, Map<number, string>>();
  const last = new Map<string, Map<number, string>>();
  const lastClub = new Map<string, Map<number, string>>();
  const ids = new Set<number>();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && row[0].trim() === '') continue;
    const longName = normalize(field(row, idx, 'long_name'));
    const shortName = normalize(field(row, idx, 'short_name'));
    if (!longName && !shortName) continue;
    const overall = num(field(row, idx, 'overall'));
    if (overall <= 0) continue;
    const id = field(row, idx, 'player_id');
    const pid = num(id);
    if (pid) ids.add(pid);
    const club = normalize(field(row, idx, 'club_name'));
    const words = longName.split(' ');
    const lastWord = words[words.length - 1];
    if (!lastWord) continue;
    addFc26(long, longName, overall, id);
    if (shortName) addFc26(short, shortName, overall, id);
    addFc26(last, lastWord, overall, id);
    if (club) addFc26(lastClub, `${lastWord}|${club}`, overall, id);
  }
  return { long, short, last, lastClub, ids };
}

function fcRating(row: string[], idx: Map<string, number>, fc26: Fc26Index): number {
  const full = normalize(field(row, idx, 'name'));
  const first = normalize(field(row, idx, 'first_name'));
  const last = normalize(field(row, idx, 'last_name'));
  const club = normalize(field(row, idx, 'current_club_name'));

  let r = bestOverall(fc26.long.get(full));
  if (r > 0) return r;
  if (first && last) {
    r = bestOverall(fc26.long.get(`${first} ${last}`));
    if (r > 0) return r;
    r = bestOverall(fc26.long.get(`${last} ${first}`));
    if (r > 0) return r;
    const al = `${first[0]} ${last}`;
    r = bestOverall(fc26.long.get(al));
    if (r > 0) return r;
    r = bestOverall(fc26.short.get(al));
    if (r > 0) return r;
  }
  if (last) {
    if (first) {
      r = bestOverall(fc26.short.get(`${first[0]} ${last}`));
      if (r > 0) return r;
    }
    r = bestOverall(fc26.short.get(full));
    if (r > 0) return r;
    if (club) {
      r = bestOverall(fc26.lastClub.get(`${last}|${club}`));
      if (r > 0) return r;
    }
    r = bestOverall(fc26.last.get(last));
    if (r > 0) return r;
  }
  return 0;
}

interface AdditionalRec {
  id: number;
  name: string;
  position: string;
  overall: number;
  clubName: string;
  shortNorm: string;
  longNorm: string;
}

function sofifaUrl(id: number): string {
  const s = String(id).padStart(6, '0');
  return `https://cdn.sofifa.net/players/${s.slice(0, 3)}/${s.slice(3)}/26_120.png`;
}

function loadAdditional(rows: string[][], idx: Map<string, number>): Map<number, AdditionalRec> {
  const byId = new Map<number, AdditionalRec>();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && row[0].trim() === '') continue;
    const id = num(field(row, idx, 'player_id'));
    if (!id) continue;
    const overall = num(field(row, idx, 'overall'));
    const existing = byId.get(id);
    if (existing && existing.overall >= overall) continue;
    const position = FIFA_POSITION_MAP[field(row, idx, 'player_positions').split(',')[0].trim()];
    if (!position) continue;
    const shortName = field(row, idx, 'short_name');
    const longName = field(row, idx, 'long_name');
    byId.set(id, {
      id,
      name: shortName || longName || `Player #${id}`,
      position,
      overall,
      clubName: field(row, idx, 'club_name'),
      shortNorm: normalize(shortName),
      longNorm: normalize(longName),
    });
  }
  return byId;
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

  let fc26: Fc26Index = { long: new Map(), short: new Map(), last: new Map(), lastClub: new Map(), ids: new Set() };
  let fc26Path: string | undefined;
  try {
    fc26Path = firstExisting(FC26_CANDIDATES);
  } catch {
    // FC26 ratings are optional; the rating floor simply won't apply without the file.
  }
  if (fc26Path) {
    const fRows = parseCsv(await readFile(fc26Path, 'utf8'));
    fc26 = loadFc26(fRows, indexHeaders(fRows[0]));
  }

  let additionalPath: string | undefined;
  try {
    additionalPath = firstExisting(ADDITIONAL_CANDIDATES);
  } catch {
    // Additional FIFA players are optional.
  }

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

  const floorsStd = {
    gk: GK_MV_FLOOR,
    def: HIGH_MV_FLOOR,
    mid: HIGH_MV_FLOOR,
    att: HIGH_MV_FLOOR,
  };
  const floorsGuess = {
    gk: GUESS_GK_MV_FLOOR,
    def: GUESS_DEF_MV_FLOOR,
    mid: GUESS_MID_MV_FLOOR,
    att: GUESS_ATT_MV_FLOOR,
  };

  const players: PoolPlayer[] = [];
  const guessWhoPlayers: PoolPlayer[] = [];
  const byId = new Map<number, PoolPlayer>();
  const seen = new Set<number>();
  const standardNames = new Set<string>();
  const guessNames = new Set<string>();

  const floorFor = (position: string, floors: typeof floorsStd) =>
    floors[position === 'Goalkeeper' ? 'gk' : position === 'Defender' ? 'def' : position === 'Midfield' ? 'mid' : 'att'] as number;

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
    const rating = fcRating(row, pIdx, fc26);
    const first = field(row, pIdx, 'first_name');
    const last = field(row, pIdx, 'last_name');
    const name = (field(row, pIdx, 'name') || `${first} ${last}`).trim() || `Player #${id}`;
    const passes = (floors: typeof floorsStd, ratingFloor: number) => {
      const passesMv = highestMV >= floorFor(position, floors) || (inTopClub && highestMV >= TOP_CLUB_MV_FLOOR);
      return passesMv || rating >= ratingFloor || isEgyptian(row, pIdx);
    };
    const inStd = passes(floorsStd, FC_RATING_FLOOR);
    const inGuess = passes(floorsGuess, GUESS_FC_RATING_FLOOR);
    if (!inStd && !inGuess) continue;
    const p: PoolPlayer = {
      id,
      name,
      position,
      imageUrl,
      clubName: field(row, pIdx, 'current_club_name'),
      highestMV,
      lastSeason: num(field(row, pIdx, 'last_season')),
    };
    const nk = normalize(name);
    if (inStd) {
      players.push(p);
      standardNames.add(nk);
    }
    if (inGuess) {
      guessWhoPlayers.push(p);
      guessNames.add(nk);
    }
    byId.set(id, p);
    seen.add(id);
  }

  if (additionalPath) {
    const aRows = parseCsv(await readFile(additionalPath, 'utf8'));
    const additional = loadAdditional(aRows, indexHeaders(aRows[0]));
    for (const a of additional.values()) {
      const inStd = (a.shortNorm && standardNames.has(a.shortNorm)) || (a.longNorm && standardNames.has(a.longNorm));
      const inGuess = (a.shortNorm && guessNames.has(a.shortNorm)) || (a.longNorm && guessNames.has(a.longNorm));
      const p: PoolPlayer = {
        id: ADD_ID_OFFSET + a.id,
        name: a.name,
        position: a.position,
        imageUrl: fc26.ids.has(a.id) ? sofifaUrl(a.id) : `https://cdn.futbin.com/content/fifa26/img/players/${a.id}.png`,
        clubName: a.clubName,
        highestMV: 0,
        lastSeason: 0,
      };
      const addedStd = a.overall >= FC_RATING_FLOOR && !inStd;
      const addedGuess = a.overall >= GUESS_FC_RATING_FLOOR && !inGuess;
      if (addedStd) players.push(p);
      if (addedGuess) guessWhoPlayers.push(p);
      if (addedStd || addedGuess) byId.set(p.id, p);
    }
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

  return { players, guessWhoPlayers, managers, byId };
}
