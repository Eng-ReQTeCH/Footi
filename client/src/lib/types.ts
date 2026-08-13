export type Mode = 'ffa' | 'teams';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameType = 'trivia' | 'guesswho' | 'auction';
export type Phase = 'lobby' | 'starting' | 'playing' | 'judging' | 'review' | 'results' | 'guesswho' | 'guesswho_winner' | 'auction_bid' | 'auction_reveal' | 'auction_winner';
export type Stage = 'question' | 'action';

export interface Settings {
  gameType: GameType;
  questionCount: number;
  secondsPerQuestion: number;
  pauseSeconds: number;
  categories: string[];
  difficulties: Difficulty[];
  mode: Mode;
  teamSizes: number[];
}

export interface PoolCard {
  id: number;
  name: string;
  imageUrl: string;
  position: string;
}

export interface GuessWhoState {
  grid: PoolCard[];
  secret: PoolCard | null;
  declared: number | null;
}

export interface AuctionPlayer {
  id: number;
  name: string;
  imageUrl: string;
  position: string;
  clubName?: string;
}

export interface AuctionManager {
  id: string;
  name: string;
  clubName: string;
}

export type AuctionOffered =
  | { kind: 'player'; player: AuctionPlayer }
  | { kind: 'manager'; manager: AuctionManager };

export interface AuctionXI {
  manager: AuctionManager | null;
  gk: AuctionPlayer | null;
  def: AuctionPlayer[];
  mid: AuctionPlayer[];
  att: AuctionPlayer[];
  sub: AuctionPlayer | null;
}

export interface AuctionSlotInfo {
  label: string;
  position: string;
}

export interface AuctionReplacement {
  userId: number;
  replacement: AuctionPlayer | AuctionManager;
}

export interface AuctionResult {
  winner: number;
  winnerBid: number;
  losers: AuctionReplacement[];
}

export interface AuctionState {
  slotIndex: number;
  slots: AuctionSlotInfo[];
  slot: AuctionSlotInfo | null;
  offered: AuctionOffered | null;
  bid: number | null;
  budget: number;
  xi: AuctionXI;
  result: AuctionResult | null;
  winner: number | null;
  winnerPrompt?: string;
  overview?: { userId: number; username: string; budget: number }[];
}

export interface PublicPlayer {
  userId: number;
  username: string;
  connected: boolean;
  team: number | null;
  score: number;
  done: boolean;
  bid?: number;
}

export interface PublicQuestion {
  id: number;
  type: string;
  question: string;
  category: string;
  difficulty: string;
  view: Record<string, unknown>;
}

export interface TimerInfo {
  kind: 'start' | 'question' | 'action' | 'review' | 'bid' | 'winner';
  endAt: number;
  duration: number;
}

export interface AnswerResult {
  userId: number;
  points: number;
  summary: string;
}

export type Results =
  | { kind: 'ffa'; standings: { userId: number; username: string; score: number; place: number }[] }
  | { kind: 'teams'; standings: { teamIdx: number; score: number; place: number; members: { userId: number; username: string; score: number }[] }[] }
  | { kind: 'guesswho'; standings: { userId: number; username: string; won: boolean }[]; grid: PoolCard[] }
  | { kind: 'auction'; standings: { userId: number; username: string; budget: number; xi: AuctionXI; won: boolean }[] };

export interface LobbyState {
  code: string;
  hostId: number;
  phase: Phase;
  settings: Settings;
  players: PublicPlayer[];
  questionCount: number;
  currentIndex: number;
  stage: Stage | null;
  question?: PublicQuestion;
  timer?: TimerInfo;
  answers?: AnswerResult[];
  results?: Results;
  guessWho?: GuessWhoState;
  auction?: AuctionState;
}

export interface JudgeEntry {
  userId: number;
  username: string;
  team: number | null;
  answered: boolean;
  payload: unknown;
  suggestedPoints: number;
  entries?: { label: string; valid: boolean }[];
}

export interface JudgeView {
  questionIndex: number;
  question: string;
  type: string;
  category: string;
  difficulty: string;
  correctText: string;
  revealPublic: Record<string, unknown>;
  players: JudgeEntry[];
}

export interface Me {
  id: number;
  username: string;
  stats: { played: number; wins: number; losses: number; draws: number };
}

export interface Friend {
  id: number;
  username: string;
  w: number;
  l: number;
  d: number;
}

export interface HistoryMatch {
  id: string;
  lobbyCode: string;
  mode: string;
  settings: Settings;
  finishedAt: string;
  players: { userId: number; username: string; team: string | null; place: number; score: number }[];
}

export interface Meta {
  categories: string[];
  types: { name: string; displayName: string }[];
  difficulties: Difficulty[];
}

export interface QuestionAdmin {
  id: number;
  question: string;
  answer: unknown;
  category: string;
  type: string;
  difficulty: string;
  created_at: string;
}