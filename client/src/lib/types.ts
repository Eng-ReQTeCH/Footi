export type Mode = 'ffa' | 'teams';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Phase = 'lobby' | 'starting' | 'playing' | 'judging' | 'review' | 'results';
export type Stage = 'question' | 'action';

export interface Settings {
  questionCount: number;
  secondsPerQuestion: number;
  pauseSeconds: number;
  categories: string[];
  difficulties: Difficulty[];
  mode: Mode;
  teamSizes: number[];
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
  kind: 'start' | 'question' | 'action' | 'review';
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
  | { kind: 'teams'; standings: { teamIdx: number; score: number; place: number; members: { userId: number; username: string; score: number }[] }[] };

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