export interface SeedQuestion {
  question: string;
  answer: unknown;
  category: string;
  type: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuestionRow {
  id: number;
  question: string;
  answer: unknown;
  category: string;
  type: string;
  difficulty: string;
}

export interface JudgeSuggestion {
  points: number;
  entries?: { label: string; valid: boolean }[];
}

export interface QuestionTypeHandler {
  name: string;
  displayName: string;
  validateSeed(q: SeedQuestion): string | null;
  validateAnswer(payload: unknown, q: QuestionRow): string | null;
  publicView(q: QuestionRow, reveal: boolean): unknown;
  correctText(q: QuestionRow): string;
  judgeSuggestion(payload: unknown, q: QuestionRow): JudgeSuggestion;
  summary(payload: unknown, q: QuestionRow): string;
  actionSeconds?: number;
}

const registry: Record<string, QuestionTypeHandler> = {};

export function registerType(h: QuestionTypeHandler) {
  registry[h.name] = h;
}

export function getType(name: string): QuestionTypeHandler | undefined {
  return registry[name];
}

export function listTypes(): QuestionTypeHandler[] {
  return Object.values(registry);
}

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

registerType({
  name: 'multiple_choice',
  displayName: 'Multiple Choice',
  validateSeed(q) {
    const a = q.answer as { options?: unknown; correct?: unknown };
    if (!Array.isArray(a?.options) || a.options.length < 2 || a.options.some((o) => typeof o !== 'string' || !o.trim())) {
      return 'answer.options must be an array of at least 2 non-empty strings';
    }
    if (!Number.isInteger(a.correct) || (a.correct as number) < 0 || (a.correct as number) >= a.options.length) {
      return 'answer.correct must be a valid option index';
    }
    return null;
  },
  validateAnswer(payload, q) {
    const a = q.answer as { options: unknown[] };
    const sel = (payload as { selected?: unknown } | null)?.selected;
    if (!Number.isInteger(sel) || (sel as number) < 0 || (sel as number) >= a.options.length) {
      return 'invalid option selected';
    }
    return null;
  },
  publicView(q, reveal) {
    const a = q.answer as { options: string[]; correct: number };
    return reveal ? { options: a.options, correct: a.correct } : { options: a.options };
  },
  correctText(q) {
    const a = q.answer as { options: string[]; correct: number };
    return a.options[a.correct] ?? '?';
  },
  judgeSuggestion(payload, q) {
    const a = q.answer as { correct: number };
    const right = (payload as { selected: number }).selected === a.correct;
    return { points: right ? 10 : 0 };
  },
  summary(payload, q) {
    const a = q.answer as { options: string[] };
    const sel = (payload as { selected?: number } | null)?.selected;
    return sel === undefined || sel === null ? 'No answer' : a.options[sel] ?? `Option #${sel + 1}`;
  },
});

registerType({
  name: 'bid',
  displayName: 'Bid & Name',
  actionSeconds: 30,
  validateSeed(q) {
    const a = q.answer as { suggestions?: unknown } | null;
    if (a === null || a === undefined) return null;
    if (!Array.isArray(a.suggestions) || a.suggestions.some((s) => typeof s !== 'string')) {
      return 'answer.suggestions must be an array of strings — or omit answer to judge fully manually';
    }
    if (a.suggestions.length > 100) return 'answer.suggestions is limited to 100 entries';
    return null;
  },
  validateAnswer(payload, q) {
    const p = payload as { bid?: unknown; named?: unknown } | null;
    const bid = p?.bid;
    if (!Number.isInteger(bid) || (bid as number) < 0 || (bid as number) > 50) return 'bid must be an integer between 0 and 50';
    const named = p?.named;
    if (!Array.isArray(named) || named.some((n) => typeof n !== 'string')) return 'named must be an array of strings';
    return null;
  },
  publicView(q, reveal) {
    const a = q.answer as { suggestions?: string[] } | null;
    return { suggestions: reveal && Array.isArray(a?.suggestions) ? a.suggestions.slice(0, 100) : undefined };
  },
  correctText(q) {
    const a = q.answer as { suggestions?: string[] } | null;
    return Array.isArray(a?.suggestions) && a.suggestions.length
      ? 'Compare against the official list — the host decides what counts'
      : 'No official list — the host decides what counts';
  },
  judgeSuggestion(payload, q) {
    const p = payload as { bid?: number; named?: string[] };
    const a = q.answer as { suggestions?: string[] } | null;
    const suggestions = Array.isArray(a?.suggestions) ? a.suggestions.map(normalizeName) : [];
    const entries = (p.named ?? []).map((label) => ({
      label,
      valid: suggestions.length > 0 ? suggestions.includes(normalizeName(label)) : false,
    }));
    const bid = p.bid ?? 0;
    const valid = entries.filter((e) => e.valid).length;
    return { points: valid + (valid >= bid ? bid : 0), entries };
  },
  summary(payload, q) {
    const p = payload as { bid?: number; named?: string[] } | null;
    const n = p?.named?.length ?? 0;
    return n === 0 ? 'No answer' : `Bid ${p?.bid ?? 0} · named ${n}`;
  },
});