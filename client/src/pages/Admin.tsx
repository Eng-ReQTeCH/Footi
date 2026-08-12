import { useCallback, useEffect, useState } from 'react';
import { api, adminToken } from '../lib/api';
import type { Meta, QuestionAdmin } from '../lib/types';
import { cx } from '../lib/theme';

const EMPTY_FORM = {
  question: '',
  answer: '',
  category: '',
  type: 'multiple_choice',
  difficulty: 'easy',
};

export default function Admin() {
  const [token, setToken] = useState(adminToken.get());
  const [authed, setAuthed] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [rows, setRows] = useState<QuestionAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState({ category: '', type: '', difficulty: '', q: '' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<QuestionAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authed) return;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v) params.set(k, v);
    const data = await api<{ total: number; rows: QuestionAdmin[] }>(
      `/api/admin/questions?limit=100&${params.toString()}`,
      { headers: { 'x-admin-token': adminToken.get() } },
    );
    setRows(data.rows);
    setTotal(data.total);
  }, [authed, filter]);

  useEffect(() => {
    api<Meta>('/api/meta').then(setMeta).catch(() => {});
  }, []);

  const tryAuth = () => {
    adminToken.set(token);
    api('/api/admin/questions?limit=1', { headers: { 'x-admin-token': token } })
      .then(() => setAuthed(true))
      .catch(() => setError('Invalid token'));
  };

  useEffect(() => {
    if (authed) load().catch(() => setAuthed(false));
  }, [authed, load]);

  const save = async () => {
    setError(null);
    let answer: unknown;
    try {
      answer = JSON.parse(form.answer || 'null');
    } catch {
      setError('answer must be valid JSON');
      return;
    }
    const body = { ...form, answer };
    try {
      if (editing) {
        await api(`/api/admin/questions/${editing.id}`, {
          method: 'PUT',
          headers: { 'x-admin-token': adminToken.get() },
          body: JSON.stringify(body),
        });
      } else {
        await api('/api/admin/questions', {
          method: 'POST',
          headers: { 'x-admin-token': adminToken.get() },
          body: JSON.stringify(body),
        });
      }
      setForm(EMPTY_FORM);
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const remove = async (id: number) => {
    await api(`/api/admin/questions/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': adminToken.get() },
    });
    load();
  };

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm pt-8">
        <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-5">
          <h2 className="text-lg font-black">Admin</h2>
          <p className="mt-1 text-xs text-slate-500">Enter the admin token from your server env.</p>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="admin token"
            type="password"
            className="mt-3 w-full rounded-xl border border-pitch-700 bg-pitch-950 px-4 py-3 focus:border-emerald-500"
          />
          {error && <p className="mt-2 text-sm font-semibold text-rose-400">{error}</p>}
          <button
            onClick={tryAuth}
            className="mt-3 w-full rounded-xl bg-emerald-500 py-3 font-black text-pitch-950"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black">
              Questions <span className="text-sm font-bold text-slate-500">({total})</span>
            </h2>
            <p className="text-xs text-slate-500">Add, edit and delete. You can also bulk-import JSON files with `npm run seed`.</p>
          </div>
          <button onClick={() => { adminToken.set(''); setAuthed(false); }} className="text-xs text-slate-500">
            Lock
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <FilterSelect
            value={filter.category}
            onChange={(v) => setFilter({ ...filter, category: v })}
            options={meta?.categories ?? []}
            placeholder="Category"
          />
          <FilterSelect
            value={filter.type}
            onChange={(v) => setFilter({ ...filter, type: v })}
            options={(meta?.types ?? []).map((t) => t.name)}
            placeholder="Type"
          />
          <FilterSelect
            value={filter.difficulty}
            onChange={(v) => setFilter({ ...filter, difficulty: v })}
            options={['easy', 'medium', 'hard']}
            placeholder="Difficulty"
          />
          <input
            value={filter.q}
            onChange={(e) => setFilter({ ...filter, q: e.target.value })}
            placeholder="Search…"
            className="rounded-lg border border-pitch-700 bg-pitch-950 px-3 py-2"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-5">
        <h3 className="font-black text-slate-200">{editing ? `Edit #${editing.id}` : 'New question'}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <textarea
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
            placeholder="Question text"
            rows={2}
            className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-4 py-3 sm:col-span-2"
          />
          <textarea
            value={form.answer}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
            placeholder={jsonHint(form.type)}
            rows={3}
            className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-4 py-3 font-mono text-xs sm:col-span-2"
          />
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Category, e.g. World Cup"
            className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-4 py-3"
          />
          <select
            value={form.type}
            onChange={(e) => { setForm({ ...form, type: e.target.value, answer: '' }); }}
            className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-4 py-3"
          >
            {(meta?.types ?? []).map((t) => (
              <option key={t.name} value={t.name}>{t.displayName}</option>
            ))}
          </select>
          <select
            value={form.difficulty}
            onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
            className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-4 py-3"
          >
            {['easy', 'medium', 'hard'].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={save}
              className="flex-1 rounded-xl bg-emerald-500 py-3 font-black text-pitch-950"
            >
              {editing ? 'Save changes' : 'Create'}
            </button>
            {editing && (
              <button
                onClick={() => { setEditing(null); setForm(EMPTY_FORM); }}
                className="rounded-xl border border-pitch-700 px-4 py-3 font-bold text-slate-400"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-rose-400">{error}</p>}
      </div>

      <div className="space-y-2">
        {rows.map((q) => (
          <div key={q.id} className="rounded-2xl border border-pitch-700 bg-pitch-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold leading-snug text-slate-100">{q.question}</p>
                <p className="mt-1 text-xs text-slate-500">
                  <span className="rounded bg-pitch-800 px-1.5 py-0.5">{q.type}</span>{' '}
                  <span className="ml-1 rounded bg-pitch-800 px-1.5 py-0.5 capitalize">{q.difficulty}</span>{' '}
                  <span className="ml-1 rounded bg-pitch-800 px-1.5 py-0.5">{q.category}</span>
                </p>
                <p className="mt-1.5 truncate font-mono text-xs text-slate-600">{JSON.stringify(q.answer)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => {
                    setEditing(q);
                    setForm({
                      question: q.question,
                      answer: JSON.stringify(q.answer, null, 2),
                      category: q.category,
                      type: q.type,
                      difficulty: q.difficulty,
                    });
                  }}
                  className="rounded-lg border border-pitch-700 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-pitch-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(q.id)}
                  className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-950"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx('rounded-lg border border-pitch-700 bg-pitch-950 px-3 py-2', !value && 'text-slate-500')}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function jsonHint(type: string): string {
  if (type === 'multiple_choice') return 'JSON answer: {"options": ["A","B","C","D"], "correct": 2}';
  if (type === 'bid') return 'JSON answer: {"suggestions": ["Real Madrid", "Ajax"]} — or leave empty for fully manual judging';
  return 'JSON answer: …';
}