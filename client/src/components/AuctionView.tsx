import { useState } from 'react';
import type { LobbyState, AuctionOffered, AuctionPlayer, AuctionManager } from '../lib/types';
import { useSocket } from '../lib/socket';
import { useUser } from '../lib/user';
import { cx } from '../lib/theme';
import { AppHeader } from './ui/AppHeader';
import { Button } from './ui/Button';
import { TimerBar } from './GameView';
import { Trophy } from './ui/Icons';

const QUICK_BIDS = [0, 5, 10, 20, 50];

export default function AuctionView({ state }: { state: LobbyState }) {
  const { bid, reveal, nextSlot, pickWinner, connected } = useSocket();
  const me = useUser();
  const a = state.auction!;
  const isHost = state.hostId === me.id;

  const [amount, setAmount] = useState(5);
  const [busy, setBusy] = useState(false);
  const isBidPhase = state.phase === 'auction_bid';
  const isReveal = state.phase === 'auction_reveal';
  const isWinnerPick = state.phase === 'auction_winner';
  const myBid = a.bid;

  const submitBid = async () => {
    if (busy || !isBidPhase) return;
    setBusy(true);
    try {
      await bid(Math.max(0, Math.floor(Number(amount) || 0)));
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const endEarly = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await reveal();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await nextSlot();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const crown = async (userId: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await pickWinner(userId);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 pt-2">
      <AppHeader connected={connected} showMenu={false} />
      {(state.timer?.kind === 'bid' || state.timer?.kind === 'winner') && <TimerBar timer={state.timer} />}

      {/* Budget + slot */}
      <div className="glass-card-sm flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Your budget</p>
          <p className="font-mono text-2xl font-black text-emerald-400">{a.budget}M €</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Slot</p>
          <p className="text-base font-black text-white">
            {Math.min(a.slotIndex + 1, a.slots.length)}/{a.slots.length}
          </p>
          <p className="text-xs font-bold text-purple-300">{a.slot?.label}</p>
        </div>
      </div>

      {/* Offered player */}
      {a.offered && (
        <div className={cx('glass-card p-4', isBidPhase && 'border-purple-500/30')}>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            {isBidPhase ? 'Up for auction' : 'Awarded to the highest bidder'}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <OfferedImage offered={a.offered} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black text-white">{offeredName(a.offered)}</p>
              <p className="text-xs text-slate-400">{offeredSub(a.offered)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Bid phase */}
      {isBidPhase && (
        <div className="glass-card p-4">
          {myBid === null ? (
            <>
              <div className="flex items-center justify-center gap-2">
                {QUICK_BIDS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(q)}
                    className={cx(
                      'rounded-lg border px-3 py-1.5 text-xs font-black',
                      amount === q ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-pitch-bright text-slate-400',
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={a.budget}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className="input-field w-32 text-center text-2xl font-black"
                />
                <span className="text-xs font-bold text-slate-500">/ {a.budget}M</span>
              </div>
              <Button
                full
                variant="purple"
                disabled={busy}
                onClick={submitBid}
                className="mt-4"
              >
                {busy ? '…' : 'Place bid'}
              </Button>
              {isHost && (
                <button onClick={endEarly} className="mt-2 w-full py-2 text-center text-xs font-bold text-slate-500 hover:text-slate-300">
                  End round now (host)
                </button>
              )}
            </>
          ) : (
            <div className="text-center">
              <p className="text-sm font-black text-purple-300">Your bid is locked: {myBid}M €</p>
              <p className="mt-1 text-xs text-slate-500">Waiting for the round to close…</p>
              {isHost && (
                <button onClick={endEarly} className="mt-3 rounded-lg border border-pitch-bright px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-pitch-800">
                  End round now
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reveal phase */}
      {isReveal && a.result && (
        <div className="glass-card p-4">
          <div className="text-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Round result</p>
            {a.result.winner > 0 ? (
              <>
                <p className="mt-1 text-base font-black text-emerald-400">
                  {state.players.find((p) => p.userId === a.result!.winner)?.username ?? 'Winner'} won with {a.result!.winnerBid}M €
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {(a.result!.winner === me.id ? 'You won ' : 'They got ') + offeredName(a.offered!)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-base font-black text-slate-300">Nobody bid — everyone gets a replacement</p>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            {a.result.losers.map((l) => {
              const isMe = l.userId === me.id;
              return (
                <div key={l.userId} className="flex items-center gap-2 rounded-lg bg-pitch-950/50 px-3 py-2 text-xs">
                  <span className={cx('flex-1 truncate font-bold', isMe ? 'text-emerald-300' : 'text-slate-300')}>
                    {state.players.find((p) => p.userId === l.userId)?.username ?? 'Player'}
                  </span>
                  <span className="font-black text-slate-200">{replacementName(l.replacement)}</span>
                </div>
              );
            })}
          </div>
          {isHost && (
            <Button full onClick={next} disabled={busy} className="mt-4">
              {busy ? '…' : a.slotIndex + 1 >= a.slots.length ? 'Finalize squads' : 'Next slot'}
            </Button>
          )}
        </div>
      )}

      {isReveal && a.slotIndex + 1 >= a.slots.length && (
        <div className="glass-card-sm p-4 text-center">
          <Trophy size={20} className="mx-auto text-amber-400" />
          <p className="mt-1 text-sm font-black text-white">All slots drafted</p>
          <p className="text-xs text-slate-400">Results are coming up…</p>
        </div>
      )}

      {/* Host picks the winner */}
      {isWinnerPick && (
        <div className="glass-card p-4">
          <div className="text-center">
            <Trophy size={24} className="mx-auto text-amber-400" />
            <p className="mt-1 text-sm font-black text-white">Draft complete — who built the best squad?</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {isHost ? 'Tap a player to crown them the winner' : 'The host is choosing the winner…'}
            </p>
          </div>
          {a.overview && (
            <div className="mt-3 space-y-1.5">
              {a.overview.map((o) => (
                <button
                  key={o.userId}
                  disabled={!isHost}
                  onClick={() => crown(o.userId)}
                  className="flex w-full items-center justify-between rounded-lg bg-pitch-950/50 px-3 py-2 text-left text-sm transition enabled:hover:bg-pitch-800"
                >
                  <span className="truncate font-bold text-slate-200">{o.username}</span>
                  <span className="font-mono font-black text-emerald-400">{o.budget}M €</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My squad so far */}
      <div className="glass-card p-4">
        <p className="text-sm font-black text-slate-100">Your squad</p>
        <div className="mt-3 space-y-2">
          <XiRow label="Manager" item={a.xi.manager ? { name: a.xi.manager.name, club: a.xi.manager.clubName } : null} />
          <XiRow label="GK" item={a.xi.gk ? { name: a.xi.gk.name, club: '' } : null} />
          <XiRow label="Def" items={a.xi.def.map((p) => p.name)} emptyText="0/4 defenders" />
          <XiRow label="Mid" items={a.xi.mid.map((p) => p.name)} emptyText="0/3 midfielders" />
          <XiRow label="Att" items={a.xi.att.map((p) => p.name)} emptyText="0/3 attackers" />
          <XiRow label="Sub" item={a.xi.sub ? { name: a.xi.sub.name, club: '' } : null} emptyText="super sub" />
        </div>
      </div>
    </div>
  );
}

function OfferedImage({ offered }: { offered: AuctionOffered }) {
  if (offered.kind === 'player') {
    return (
      <img
        src={offered.player.imageUrl}
        alt={offered.player.name}
        className="size-16 shrink-0 rounded-xl object-cover ring-2 ring-purple-500/40"
        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
      />
    );
  }
  return (
    <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-pitch-800 text-2xl">
      🧑‍💼
    </div>
  );
}

function offeredName(o: AuctionOffered): string {
  return o.kind === 'player' ? o.player.name : o.manager.name;
}

function offeredSub(o: AuctionOffered): string {
  return o.kind === 'player'
    ? `${o.player.position} · ${o.player.clubName || 'Free agent'}`
    : `Manager · ${o.manager.clubName}`;
}

function replacementName(r: AuctionPlayer | AuctionManager): string {
  return r.name;
}

function XiRow({
  label,
  item,
  items,
  emptyText,
}: {
  label: string;
  item?: { name: string; club: string } | null;
  items?: string[];
  emptyText?: string;
}) {
  const list = items ?? (item ? [item.name] : []);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-pitch-950/50 px-3 py-2">
      <span className="w-14 shrink-0 text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span>
      {list.length > 0 ? (
        <span className="flex-1 truncate text-sm font-bold text-slate-200">{list.join(', ')}</span>
      ) : (
        <span className="flex-1 truncate text-xs text-slate-600">{emptyText ?? 'empty'}</span>
      )}
    </div>
  );
}
