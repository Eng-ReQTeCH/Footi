import { useEffect, useState } from 'react';
import type { LobbyState, Settings } from '../lib/types';
import { useSocket } from '../lib/socket';
import { useUser } from '../lib/user';
import { teamColor, cx } from '../lib/theme';
import { AppHeader } from './ui/AppHeader';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Copy, Crown, Play } from './ui/Icons';

const DIFFS = ['easy', 'medium', 'hard'] as const;
const QUESTION_COUNTS = [5, 10, 15, 20];
const TIMES = [15, 20, 30, 45, 60];
const PAUSES = [2, 4, 6];

export default function LobbyView({ state }: { state: LobbyState }) {
  const { updateSettings, start, kick, setTeam, leaveLobby, connected } = useSocket();
  const me = useUser();
  const [settings, setSettings] = useState<Settings>(state.settings);
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isHost = state.hostId === me.id;

  useEffect(() => {
    fetch('/api/meta')
      .then((r) => r.json())
      .then((m) => setCategories(m.categories))
      .catch(() => {});
  }, []);

  const save = async (next: Settings) => {
    setSettings(next);
    if (!isHost) return;
    try {
      await updateSettings(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const doStart = async () => {
    setBusy(true);
    setError(null);
    try {
      await start();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(state.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const splitEvenly = () => {
    const n = state.players.length;
    const sizes: number[] = [];
    while (sizes.reduce((a, b) => a + b, 0) < n) sizes.push(1);
    while (true) {
      const biggest = sizes.indexOf(Math.max(...sizes));
      const smallest = sizes.indexOf(Math.min(...sizes));
      if (sizes[biggest] - sizes[smallest] <= 1) break;
      sizes[biggest]--;
      sizes[smallest]++;
    }
    save({ ...settings, teamSizes: sizes });
  };

  const players = [...state.players];
  const codeSpaced = state.code.split('').join(' ');

  return (
    <div className="space-y-4 pt-2">
      <AppHeader connected={connected} isHost={isHost} />

      {/* Lobby code */}
      <section className="glass-card p-5 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Lobby</p>
        <div className="mt-1 flex items-center justify-center gap-3">
          <p className="font-mono text-4xl font-black tracking-[0.25em] text-emerald-400">{codeSpaced}</p>
          <button
            onClick={copyCode}
            className="grid size-9 place-items-center rounded-lg border border-pitch-bright bg-pitch-850 text-slate-400 hover:text-emerald-400"
            title="Copy code"
          >
            <Copy size={16} />
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {copied ? 'Copied!' : 'Share this code with your friends'}
        </p>
      </section>

      {/* Player list */}
      <section className="glass-card p-4">
        <div className="space-y-2">
          {players.map((p) => (
            <div
              key={p.userId}
              className="flex items-center gap-3 rounded-xl bg-pitch-950/50 px-3 py-2.5"
            >
              <Avatar name={p.username} teamIdx={p.team} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-slate-100">{p.username}</span>
                  {p.userId === state.hostId && (
                    <Crown size={14} className="shrink-0 text-amber-400" />
                  )}
                </div>
              </div>
              <span className={cx('size-2 shrink-0 rounded-full', p.connected ? 'bg-emerald-500' : 'bg-slate-600')} />
              {isHost && p.userId !== state.hostId && (
                <button
                  onClick={() => kick(p.userId)}
                  className="shrink-0 rounded-lg border border-rose-500/30 px-2.5 py-1 text-xs font-bold text-rose-400 hover:bg-rose-950"
                >
                  Kick
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">{players.length} / 12 players</p>
      </section>

      {/* Teams panel */}
      {settings.mode === 'teams' && (
        <section className="glass-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-300">Teams</p>
            {isHost && (
              <button onClick={splitEvenly} className="rounded-lg border border-pitch-bright px-2.5 py-1 text-xs font-bold text-slate-300 hover:bg-pitch-800">
                Split evenly
              </button>
            )}
          </div>
          <div className="grid gap-2">
            {settings.teamSizes.map((size, i) => (
              <div key={i} className="rounded-xl border bg-pitch-950/50 p-3" style={{ borderColor: teamColor(i) }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black" style={{ color: teamColor(i) }}>Team {i + 1}</span>
                  <span className="text-xs text-slate-500">{players.filter((p) => p.team === i).length}/{size}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {players.filter((p) => p.team === i).map((p) => (
                    <span key={p.userId} className="rounded-full bg-pitch-900 px-2 py-0.5 text-xs font-semibold text-slate-300">
                      {p.username}
                      {isHost && (
                        <button onClick={() => setTeam(p.userId, null)} className="ml-1 text-slate-500 hover:text-rose-400">✕</button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Settings */}
      <section className="glass-card p-4">
        <h2 className="text-sm font-black text-slate-100">Game settings</h2>
        <p className="mt-0.5 text-xs text-slate-500">{isHost ? 'Changes apply live' : 'Host controls these'}</p>

        <div className="mt-4 space-y-4">
          <SettingRow label="Mode">
            <SelectToggle
              value={settings.mode}
              options={[
                { value: 'ffa', label: 'Free-for-all' },
                { value: 'teams', label: 'Teams' },
              ]}
              disabled={!isHost}
              onChange={(v) =>
                save({ ...settings, mode: v as 'ffa' | 'teams', teamSizes: v === 'teams' && settings.teamSizes.length === 0 ? [2, 2] : settings.teamSizes })
              }
            />
          </SettingRow>

          <SettingRow label="Questions">
            <SelectToggle
              value={String(settings.questionCount)}
              options={QUESTION_COUNTS.map((n) => ({ value: String(n), label: String(n) }))}
              disabled={!isHost}
              onChange={(v) => save({ ...settings, questionCount: Number(v) })}
            />
          </SettingRow>

          <SettingRow label="Seconds per question">
            <SelectToggle
              value={String(settings.secondsPerQuestion)}
              options={TIMES.map((t) => ({ value: String(t), label: `${t}s` }))}
              disabled={!isHost}
              onChange={(v) => save({ ...settings, secondsPerQuestion: Number(v) })}
            />
          </SettingRow>

          <SettingRow label="Pause between">
            <SelectToggle
              value={String(settings.pauseSeconds)}
              options={PAUSES.map((p) => ({ value: String(p), label: `${p}s` }))}
              disabled={!isHost}
              onChange={(v) => save({ ...settings, pauseSeconds: Number(v) })}
            />
          </SettingRow>

          <SettingRow label="Difficulty">
            <div className="flex flex-wrap gap-1.5">
              {DIFFS.map((d) => {
                const on = settings.difficulties.includes(d);
                return (
                  <button
                    key={d}
                    disabled={!isHost}
                    onClick={() =>
                      save({ ...settings, difficulties: on ? settings.difficulties.filter((x) => x !== d) : [...settings.difficulties, d] })
                    }
                    className={cx(
                      'rounded-lg border px-2.5 py-1.5 text-xs font-bold capitalize transition',
                      on ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-pitch-bright text-slate-500 disabled:opacity-50',
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </SettingRow>

          {categories.length > 0 && (
            <SettingRow label="Categories">
              <div className="flex flex-wrap gap-1.5">
                <button
                  disabled={!isHost}
                  onClick={() => save({ ...settings, categories: [] })}
                  className={cx(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-bold',
                    settings.categories.length === 0 ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-pitch-bright text-slate-500',
                  )}
                >
                  All
                </button>
                {categories.map((c) => {
                  const on = settings.categories.includes(c);
                  return (
                    <button
                      key={c}
                      disabled={!isHost}
                      onClick={() =>
                        save({ ...settings, categories: on ? settings.categories.filter((x) => x !== c) : [...settings.categories, c] })
                      }
                      className={cx(
                        'rounded-lg border px-2.5 py-1.5 text-xs font-bold',
                        on ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-pitch-bright text-slate-500 disabled:opacity-50',
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </SettingRow>
          )}

          {settings.mode === 'teams' && (
            <SettingRow label="Team sizes">
              <div className="flex flex-wrap items-center gap-2">
                {settings.teamSizes.map((size, i) => (
                  <div key={i} className="flex items-center gap-1 rounded-lg border border-pitch-bright px-2 py-1">
                    <span className="text-xs font-black" style={{ color: teamColor(i) }}>T{i + 1}</span>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      disabled={!isHost}
                      value={size}
                      onChange={(e) => {
                        const sizes = [...settings.teamSizes];
                        sizes[i] = Math.max(1, Math.min(6, Number(e.target.value) || 1));
                        save({ ...settings, teamSizes: sizes });
                      }}
                      className="w-8 rounded bg-pitch-950 px-1 py-0.5 text-center text-sm font-bold text-slate-200 disabled:opacity-50"
                    />
                    {isHost && (
                      <button onClick={() => save({ ...settings, teamSizes: settings.teamSizes.filter((_, j) => j !== i) })} className="text-xs text-rose-400">✕</button>
                    )}
                  </div>
                ))}
                {isHost && settings.teamSizes.length < 8 && (
                  <button
                    onClick={() => save({ ...settings, teamSizes: [...settings.teamSizes, 2] })}
                    className="rounded-lg border border-dashed border-slate-600 px-2 py-1 text-xs font-bold text-slate-500"
                  >
                    + team
                  </button>
                )}
              </div>
            </SettingRow>
          )}
        </div>

        {error && <p className="mt-3 text-sm font-semibold text-rose-400">{error}</p>}
      </section>

      {/* Actions */}
      <div className="space-y-2 pb-4">
        {isHost ? (
          <Button full disabled={busy || players.length < 2} onClick={doStart} icon={<Play size={18} />} className="py-4 text-base">
            {busy ? '…' : 'Start game'}
          </Button>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">
            Waiting for <span className="font-bold text-slate-300">{hostName(state)}</span> to start…
          </p>
        )}
        <Button variant="ghost" full onClick={leaveLobby} className="text-rose-400">
          Leave lobby
        </Button>
      </div>
    </div>
  );
}

function hostName(state: LobbyState): string {
  return state.players.find((p) => p.userId === state.hostId)?.username ?? 'host';
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-xs font-semibold text-slate-400">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SelectToggle({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-pitch-bright bg-pitch-950/80 px-3 py-1.5 text-xs font-bold text-slate-200 disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
