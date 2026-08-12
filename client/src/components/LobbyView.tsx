import { useEffect, useState } from 'react';
import type { LobbyState, Settings } from '../lib/types';
import { useSocket } from '../lib/socket';
import { useUser } from '../lib/user';
import { teamColor, cx } from '../lib/theme';

const DIFFS = ['easy', 'medium', 'hard'] as const;
const QUESTION_COUNTS = [5, 10, 15, 20];
const TIMES = [15, 20, 30, 45, 60];
const PAUSES = [2, 4, 6];

export default function LobbyView({ state }: { state: LobbyState }) {
  const { updateSettings, start, kick, setTeam, leaveLobby } = useSocket();
  const me = useUser();
  const [settings, setSettings] = useState<Settings>(state.settings);
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const splitEvenly = () => {
    const n = state.players.length;
    const sizes: number[] = [];
    while (sizes.reduce((a, b) => a + b, 0) < n) {
      sizes.push(1);
    }
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

  return (
    <div className="space-y-4 pt-2 lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-6">
      <section className="rounded-2xl border border-pitch-700 bg-pitch-900 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Lobby code</p>
            <p className="font-mono text-4xl font-black tracking-[0.35em] text-emerald-400">{state.code}</p>
          </div>
          <button
            onClick={leaveLobby}
            className="rounded-xl border border-rose-500/40 px-4 py-2 text-sm font-bold text-rose-400 hover:bg-rose-950"
          >
            Leave
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {players.map((p) => (
            <div
              key={p.userId}
              className={cx(
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold',
                p.userId === state.hostId ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-pitch-700 bg-pitch-950 text-slate-300',
              )}
              style={p.team !== null ? { borderColor: teamColor(p.team), color: teamColor(p.team) } : undefined}
            >
              <span
                className={cx('size-2 rounded-full', p.connected ? 'bg-emerald-400' : 'bg-slate-600')}
              />
              {p.username}
              {p.userId === state.hostId && ' 👑'}
              {isHost && p.userId !== state.hostId && (
                <button
                  onClick={() => kick(p.userId)}
                  className="ml-1 text-xs text-rose-400 hover:text-rose-300"
                  title="Kick"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <span className="text-xs text-slate-500">{players.length}/12</span>
        </div>

        {settings.mode === 'teams' && (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-300">Teams</p>
              {isHost && (
                <button
                  onClick={splitEvenly}
                  className="rounded-lg border border-pitch-700 px-2.5 py-1 text-xs font-bold text-slate-300 hover:bg-pitch-800"
                >
                  Split evenly
                </button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {settings.teamSizes.map((size, i) => (
                <div key={i} className="rounded-xl border bg-pitch-950 p-3" style={{ borderColor: teamColor(i) }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black" style={{ color: teamColor(i) }}>
                      Team {i + 1}
                    </span>
                    <span className="text-xs text-slate-500">{players.filter((p) => p.team === i).length}/{size}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {players
                      .filter((p) => p.team === i)
                      .map((p) => (
                        <span key={p.userId} className="rounded-full bg-pitch-900 px-2 py-0.5 text-xs font-semibold text-slate-300">
                          {p.username}
                          {isHost && (
                            <button
                              onClick={() => setTeam(p.userId, null)}
                              className="ml-1 text-slate-500 hover:text-rose-400"
                              title="Unassign"
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      ))}
                    {isHost &&
                      players
                        .filter((p) => p.team !== i && p.team !== null && p.team !== undefined)
                        .map(
                          (p) =>
                            players.filter((x) => x.team === i).length < size && (
                              <button
                                key={p.userId}
                                onClick={() => setTeam(p.userId, i)}
                                className="rounded-full border border-dashed border-slate-700 px-2 py-0.5 text-xs text-slate-500 hover:text-slate-300"
                              >
                                +{p.username}
                              </button>
                            ),
                        )}
                  </div>
                </div>
              ))}
              {settings.teamSizes.length === 0 && (
                <p className="text-sm text-slate-500">
                  No teams yet — pick team sizes in the settings (host).
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {players
                .filter((p) => p.team === null)
                .map((p) => (
                  <span key={p.userId} className="rounded-full bg-pitch-800 px-2.5 py-1 text-xs font-semibold text-slate-400">
                    {p.username} — unassigned
                    {isHost && (
                      <span className="ml-1">
                        {settings.teamSizes.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setTeam(p.userId, i)}
                            className="ml-1 text-slate-500 hover:text-white"
                            style={{ color: teamColor(i) }}
                          >
                            T{i + 1}
                          </button>
                        ))}
                      </span>
                    )}
                  </span>
                ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-pitch-700 bg-pitch-900 p-5">
        <h2 className="text-lg font-black text-slate-100">Game settings</h2>
        <p className="mt-0.5 text-xs text-slate-500">{isHost ? 'You are the host — changes apply live' : 'Host controls these'}</p>

        <div className="mt-4 space-y-5">
          <SettingGroup label="Mode">
            <div className="grid grid-cols-2 gap-2">
              {(['ffa', 'teams'] as const).map((m) => (
                <button
                  key={m}
                  disabled={!isHost}
                  onClick={() =>
                    save({ ...settings, mode: m, teamSizes: m === 'teams' && settings.teamSizes.length === 0 ? [2, 2] : settings.teamSizes })
                  }
                  className={cx(
                    'rounded-xl border px-3 py-2.5 text-sm font-bold transition',
                    settings.mode === m
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                      : 'border-pitch-700 text-slate-400 disabled:opacity-50',
                  )}
                >
                  {m === 'ffa' ? 'Free for all' : 'Teams'}
                </button>
              ))}
            </div>
          </SettingGroup>

          <SettingGroup label="Questions">
            <div className="flex flex-wrap gap-2">
              {QUESTION_COUNTS.map((n) => (
                <Chip
                  key={n}
                  active={settings.questionCount === n}
                  disabled={!isHost}
                  onClick={() => save({ ...settings, questionCount: n })}
                >
                  {n}
                </Chip>
              ))}
            </div>
          </SettingGroup>

          <SettingGroup label={`Seconds per question — ${settings.secondsPerQuestion}s`}>
            <div className="flex flex-wrap gap-2">
              {TIMES.map((t) => (
                <Chip
                  key={t}
                  active={settings.secondsPerQuestion === t}
                  disabled={!isHost}
                  onClick={() => save({ ...settings, secondsPerQuestion: t })}
                >
                  {t}
                </Chip>
              ))}
            </div>
          </SettingGroup>

          <SettingGroup label={`Pause between questions — ${settings.pauseSeconds}s`}>
            <div className="flex flex-wrap gap-2">
              {PAUSES.map((p) => (
                <Chip
                  key={p}
                  active={settings.pauseSeconds === p}
                  disabled={!isHost}
                  onClick={() => save({ ...settings, pauseSeconds: p })}
                >
                  {p}
                </Chip>
              ))}
            </div>
          </SettingGroup>

          <SettingGroup label="Difficulty">
            <div className="flex flex-wrap gap-2">
              {DIFFS.map((d) => {
                const on = settings.difficulties.includes(d);
                return (
                  <button
                    key={d}
                    disabled={!isHost}
                    onClick={() =>
                      save({
                        ...settings,
                        difficulties: on
                          ? settings.difficulties.filter((x) => x !== d)
                          : [...settings.difficulties, d],
                      })
                    }
                    className={cx(
                      'rounded-xl border px-3 py-2 text-sm font-bold capitalize transition',
                      on ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-pitch-700 text-slate-400 disabled:opacity-50',
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </SettingGroup>

          <SettingGroup label="Categories">
            {categories.length === 0 ? (
              <p className="text-sm text-slate-500">No questions imported yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={!isHost}
                  onClick={() => save({ ...settings, categories: [] })}
                  className={cx(
                    'rounded-xl border px-3 py-1.5 text-xs font-bold',
                    settings.categories.length === 0
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                      : 'border-pitch-700 text-slate-400',
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
                        save({
                          ...settings,
                          categories: on
                            ? settings.categories.filter((x) => x !== c)
                            : [...settings.categories, c],
                        })
                      }
                      className={cx(
                        'rounded-xl border px-3 py-1.5 text-xs font-bold',
                        on ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-pitch-700 text-slate-400 disabled:opacity-50',
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
          </SettingGroup>

          {settings.mode === 'teams' && (
            <SettingGroup label="Team sizes">
              <div className="flex flex-wrap items-center gap-2">
                {settings.teamSizes.map((size, i) => (
                  <div key={i} className="flex items-center gap-1 rounded-xl border border-pitch-700 px-2 py-1.5">
                    <span className="text-xs font-black" style={{ color: teamColor(i) }}>
                      T{i + 1}
                    </span>
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
                      className="w-10 rounded bg-pitch-950 px-1 py-0.5 text-center text-sm font-bold text-slate-200 disabled:opacity-50"
                    />
                    {isHost && (
                      <button
                        onClick={() => save({ ...settings, teamSizes: settings.teamSizes.filter((_, j) => j !== i) })}
                        className="text-xs text-rose-400"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {isHost && settings.teamSizes.length < 8 && (
                  <button
                    onClick={() => save({ ...settings, teamSizes: [...settings.teamSizes, 2] })}
                    className="rounded-xl border border-dashed border-slate-600 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-200"
                  >
                    + team
                  </button>
                )}
              </div>
            </SettingGroup>
          )}

          {error && <p className="text-sm font-semibold text-rose-400">{error}</p>}

          {isHost && (
            <button
              onClick={doStart}
              disabled={busy || players.length < 2}
              className="w-full rounded-2xl bg-emerald-500 py-4 text-lg font-black text-pitch-950 transition active:scale-[0.98] disabled:opacity-40"
            >
              {busy ? '…' : `Start game (${players.length} players)`}
            </button>
          )}
          {!isHost && (
            <p className="text-center text-sm text-slate-500">
              Waiting for <span className="font-bold text-slate-300">{hostName(state)}</span> to start…
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function hostName(state: LobbyState): string {
  return state.players.find((p) => p.userId === state.hostId)?.username ?? 'host';
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  );
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'rounded-xl border px-3 py-2 text-sm font-bold transition',
        active ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-pitch-700 text-slate-400 disabled:opacity-50',
      )}
    >
      {children}
    </button>
  );
}