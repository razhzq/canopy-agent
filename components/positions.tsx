"use client";

import { useEffect, useState } from "react";
import { tokenPrice, tokenQty, usd } from "@/lib/format";
import { usePrivy } from "@privy-io/react-auth";
import {
  getAgentFills,
  num,
  type AgentDetail,
  type AgentFill,
  type UniverseAsset,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonRows } from "@/components/skeleton";
import { AssetLogo, Badge } from "@/components/ui";
import { ClosePositionModal } from "@/components/closePosition";

/**
 * What the agent owns, and what it has done.
 *
 * REPLACES THE MARKET CARDS.
 *
 * Those answered "what is it waiting for", which is the same question the
 * Watching-now section answers directly and better — and their proximity bar
 * only ever worked for a dip rule, so a strategy built on RSI, MACD or
 * Bollinger showed an empty card. The universe list now lives under the
 * condition it belongs to, and this space shows the thing the page had nowhere
 * to put: the book.
 *
 * AGGREGATED BY ASSET, EXPANDABLE TO LOTS.
 *
 * Every buy writes its own row, so an accumulated asset is several rows in the
 * database — but nobody thinks in lots. They think "I own gold, I'm down 4%".
 * The aggregate also matches how the exits are now judged: a stop measures the
 * blend, so a page that showed tranches separately would invite someone to read
 * a stop against a number it does not apply to. Tranches are one click away,
 * which is where an accumulating strategy wants them.
 */

type Tab = "open" | "history";

export function Positions({
  agentId,
  positions,
  universe,
  onChanged,
}: {
  agentId: number;
  positions: AgentDetail["positions"];
  /** Priced assets, for the mark. Absent while the universe call is in flight. */
  universe: UniverseAsset[];
  /** Re-read the book after the owner closes something out from under it. */
  onChanged?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("open");

  return (
    <div>
      <div className="flex items-center gap-1 pt-4">
        <TabButton active={tab === "open"} onClick={() => setTab("open")}>
          Open{positions.length > 0 ? ` · ${aggregate(positions, universe).length}` : ""}
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          History
        </TabButton>
      </div>

      {tab === "open" ? (
        <OpenTable
          agentId={agentId}
          positions={positions}
          universe={universe}
          onChanged={onChanged}
        />
      ) : (
        <HistoryTable agentId={agentId} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`border-b-2 px-3 py-2 font-mono text-[10.5px] tracking-[0.08em] uppercase transition-colors ${
        active
          ? "border-accent text-accent"
          : "border-transparent text-text-muted hover:text-text-secondary"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ open -- */

interface Lot {
  id: number;
  qty: number;
  costUsd: number;
  openedAt: string;
}

interface Holding {
  /** The asset's identity, and what the close endpoint is keyed on. */
  mint: string;
  symbol: string;
  underlying: string | null;
  qty: number;
  costUsd: number;
  /** Blended cost per unit — "my average". */
  avgUsd: number;
  /** Null when the asset could not be priced. Never substituted with cost. */
  markUsd: number | null;
  valueUsd: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  openedAt: string;
  lots: Lot[];
}

/**
 * One row per asset, summing its lots.
 *
 * A missing mark yields null value and null PnL rather than falling back to
 * cost. Carrying an unpriceable position at cost renders as "flat", which is a
 * claim — the honest answer is that we do not know, and the row says so.
 */
export function aggregate(
  positions: AgentDetail["positions"],
  universe: UniverseAsset[],
): Holding[] {
  const bySymbol = new Map<string, AgentDetail["positions"]>();
  for (const p of positions) {
    const list = bySymbol.get(p.symbol);
    if (list) list.push(p);
    else bySymbol.set(p.symbol, [p]);
  }

  const priced = new Map(universe.map((a) => [a.symbol, num(a.priceUsd)]));

  return [...bySymbol.entries()]
    .map(([symbol, group]) => {
      const lots: Lot[] = group
        .map((p) => ({
          id: p.id,
          qty: Number(p.qty),
          costUsd: Number(p.cost_basis_usd),
          openedAt: p.opened_at,
        }))
        .sort((a, b) => +new Date(a.openedAt) - +new Date(b.openedAt));

      const qty = lots.reduce((s, l) => s + l.qty, 0);
      const costUsd = lots.reduce((s, l) => s + l.costUsd, 0);
      const markUsd = priced.get(symbol) ?? null;
      const valueUsd = markUsd === null ? null : markUsd * qty;

      return {
        // Every lot in the group is the same asset, so any lot's mint will do.
        mint: group[0].mint,
        symbol,
        underlying: group[0].underlying,
        qty,
        costUsd,
        avgUsd: qty > 0 ? costUsd / qty : 0,
        markUsd,
        valueUsd,
        pnlUsd: valueUsd === null ? null : valueUsd - costUsd,
        pnlPct: valueUsd === null || costUsd <= 0 ? null : ((valueUsd - costUsd) / costUsd) * 100,
        // Oldest lot: when this position started, not when it was last added to.
        openedAt: lots[0].openedAt,
        lots,
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);
}

function OpenTable({
  agentId,
  positions,
  universe,
  onChanged,
}: {
  agentId: number;
  positions: AgentDetail["positions"];
  universe: UniverseAsset[];
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  /** The holding awaiting confirmation, or null when no dialog is up. */
  const [closing, setClosing] = useState<Holding | null>(null);
  const holdings = aggregate(positions, universe);

  if (holdings.length === 0) {
    return (
      <p className="pt-5 font-ui text-[13px] text-text-secondary">
        Nothing open. The agent is in cash until its entry rule is met.
      </p>
    );
  }

  return (
    <div className="pt-4">
      {/* Header and rows are both `flex-1` grid + a fixed trailing column, so
          the data columns line up exactly whatever the × column costs. */}
      <div className="hidden items-center gap-3 border-b border-grid pb-2 font-mono text-[9.5px] tracking-[0.12em] text-text-dim uppercase sm:flex">
        <div className="grid flex-1 grid-cols-[1.4fr_repeat(4,1fr)_auto] gap-3">
          <span>Asset</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Avg cost</span>
          <span className="text-right">Value</span>
          <span className="text-right">P&amp;L</span>
          <span className="w-8" />
        </div>
        <span className="w-9" />
      </div>

      {holdings.map((h) => {
        const expanded = open === h.symbol;
        // One lot is not an accumulation — nothing to expand into.
        const canExpand = h.lots.length > 1;
        return (
          <div key={h.symbol} className="border-b border-grid last:border-b-0">
            {/* SIBLINGS, not nested. A × inside the expand button would be a
                button inside a button — invalid, and every click on it would
                also toggle the row underneath the dialog it opened. */}
            <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!canExpand}
              onClick={() => setOpen(expanded ? null : h.symbol)}
              className="grid flex-1 grid-cols-2 items-center gap-3 py-3 text-left sm:grid-cols-[1.4fr_repeat(4,1fr)_auto]"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  {/* The wrapper's own symbol, not the underlying: it resolves
                      just as well for equities ("TSLAx" → TSLA) and is the only
                      one of the two that identifies a gold position, where the
                      underlying is XAU for both issuers. */}
                  <AssetLogo symbol={h.symbol} />
                  <span className="truncate font-mono text-[12.5px] text-text-primary">
                    {h.symbol}
                  </span>
                </span>
                <span className="block pt-0.5 font-ui text-[11px] text-text-dim">
                  {h.lots.length === 1
                    ? `since ${shortDate(h.openedAt)}`
                    : `${h.lots.length} entries · since ${shortDate(h.openedAt)}`}
                </span>
              </span>
              <Cell>{tokenQty(h.qty, h.markUsd)}</Cell>
              {/* A PRICE, not a dollar amount. Two fixed decimals rendered a
                  memecoin at $0.00005835 as "$0.00" — a wrong number, not a
                  rounded one, and the owner reads it as worthless. */}
              <Cell>
                <span title={tokenPrice(h.avgUsd).label}>{tokenPrice(h.avgUsd).display}</span>
              </Cell>
              <Cell>{h.valueUsd === null ? "not priced" : usd(h.valueUsd)}</Cell>
              {/* Dollars lead, percent underneath. A percentage alone cannot be
                  weighed: −6% is a rounding error on one holding and the worst
                  loss on the book on another, and the reader had to work it out
                  from Value against Avg cost. Both figures come off the same
                  mark, so they cannot disagree. */}
              <span
                className={`text-right ${
                  h.pnlUsd === null
                    ? "text-text-muted"
                    : h.pnlUsd >= 0
                      ? "text-accent"
                      : "text-negative"
                }`}
              >
                <span className="tnum block font-mono text-[12.5px]">
                  {h.pnlUsd === null
                    ? "—"
                    : usd(h.pnlUsd, { sign: true })}
                </span>
                {h.pnlPct === null ? null : (
                  <span className="tnum block pt-0.5 font-mono text-[11px] opacity-70">
                    {h.pnlPct >= 0 ? "+" : "−"}
                    {Math.abs(h.pnlPct).toFixed(1)}%
                  </span>
                )}
              </span>
              <span className="w-8 text-right font-mono text-[11px] text-text-dim">
                {canExpand ? (expanded ? "−" : "+") : ""}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setClosing(h)}
              aria-label={`Close the ${h.symbol} position`}
              title="Close this position"
              // Dim until hovered or focused. It sells something, so it should
              // not compete for attention with the figures — but it must be
              // reachable by keyboard, which is why focus-visible lights it too.
              className="flex size-9 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-surface hover:text-negative focus-visible:bg-surface focus-visible:text-negative focus-visible:outline-1 focus-visible:outline-accent"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
                <path
                  d="m4.5 4.5 7 7m0-7-7 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            </div>

            {expanded ? (
              <div className="pb-3 pl-3">
                <p className="pb-1.5 font-mono text-[9.5px] tracking-[0.12em] text-text-dim uppercase">
                  Entries
                </p>
                {h.lots.map((l, i) => (
                  <div
                    key={l.id}
                    className="flex items-baseline justify-between gap-3 border-l border-grid py-1 pl-3"
                  >
                    <span className="font-ui text-[11.5px] text-text-secondary">
                      {i + 1}. {shortDate(l.openedAt)}
                    </span>
                    <span className="tnum font-mono text-[11.5px] text-text-dim">
                      {tokenQty(l.qty, l.costUsd / (l.qty || 1))} @{" "}
                      {tokenPrice(l.qty > 0 ? l.costUsd / l.qty : null).display} ·{" "}
                      {usd(l.costUsd)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}

      {closing ? (
        <ClosePositionModal
          agentId={agentId}
          holding={closing}
          onClose={() => setClosing(null)}
          // The book has changed, so the page re-reads it. Without this the row
          // stays on screen after a successful sale and the owner clicks it
          // again — which the backend refuses, but only after alarming them.
          onClosed={() => onChanged?.()}
        />
      ) : null}
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <span className="tnum text-right font-mono text-[12.5px] text-text-secondary">{children}</span>
  );
}

/* --------------------------------------------------------------- history -- */

function HistoryTable({ agentId }: { agentId: number }) {
  const state = useApi((t) => getAgentFills(t, agentId), [agentId]);
  const { getAccessToken } = usePrivy();

  // Pages AFTER the first. useApi replaces its data on each fetch, which is
  // right for a single view and wrong for an accumulating list — so the first
  // page stays under useApi (it owns the loading, signed-out and error phases)
  // and everything fetched by "load more" is held here.
  const [extra, setExtra] = useState<AgentFill[]>([]);
  const [cursor, setCursor] = useState<{ before: string | null; beforeId: string | null } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const firstId = state.phase === "ready" ? (state.data.fills[0]?.id ?? "none") : "";

  // A reload — retry, or a different agent — invalidates everything appended to
  // it. Without this the old pages stay stitched under a new first page.
  useEffect(() => {
    setExtra([]);
    setCursor(null);
    setPageError(null);
  }, [firstId, agentId]);

  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "loading") return <SkeletonRows label="Loading trades" cols="1.4fr 1fr 1fr 1fr 1fr auto" rows={5} />;
  if (state.phase === "error") return <ErrorState message={state.message} onRetry={state.reload} />;

  const fills = [...state.data.fills, ...extra];
  const next = cursor ?? {
    before: state.data.nextBefore,
    beforeId: state.data.nextBeforeId,
  };
  const hasMore = !!(next.before && next.beforeId);

  async function loadMore(): Promise<void> {
    if (loading || !hasMore) return;
    setLoading(true);
    setPageError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in to load more.");
      const page = await getAgentFills(token, agentId, next);
      setExtra((prev) => [...prev, ...page.fills]);
      setCursor({ before: page.nextBefore, beforeId: page.nextBeforeId });
    } catch (err) {
      // Kept local: a failed page must not blank the trades already on screen.
      setPageError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (fills.length === 0) {
    return (
      <p className="pt-5 font-ui text-[13px] text-text-secondary">
        Nothing filled yet. Every cycle is still recorded in the activity log below.
      </p>
    );
  }

  return (
    <div className="pt-4">
      <div className="hidden grid-cols-[auto_1.2fr_repeat(4,1fr)] gap-3 border-b border-grid pb-2 font-mono text-[9.5px] tracking-[0.12em] text-text-dim uppercase sm:grid">
        <span>Side</span>
        <span>Asset</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Price</span>
        <span className="text-right">Value</span>
        <span className="text-right">Realised</span>
      </div>

      {fills.map((f) => (
        <FillRow key={f.id} fill={f} />
      ))}

      {pageError ? (
        <p className="pt-3 font-ui text-[12px] text-negative">{pageError}</p>
      ) : null}

      <div className="flex items-center gap-3 pt-3">
        {hasMore ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="border border-grid px-3 py-1.5 font-mono text-[10.5px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : null}
        <p className="font-ui text-[11.5px] text-text-dim">
          {fills.length} {fills.length === 1 ? "trade" : "trades"}
          {hasMore ? " so far" : " — all of them"}
        </p>
      </div>
    </div>
  );
}

function FillRow({ fill: f }: { fill: AgentFill }) {
  const sell = f.side === "sell" || f.side === "remove_liquidity";
  const realised = f.realized_pnl_usd === null ? null : Number(f.realized_pnl_usd);

  return (
    <div className="grid grid-cols-2 items-center gap-3 border-b border-grid py-3 last:border-b-0 sm:grid-cols-[auto_1.2fr_repeat(4,1fr)]">
      <span
        className={`font-mono text-[10px] tracking-[0.08em] uppercase ${
          sell ? "text-negative" : "text-accent"
        }`}
      >
        {sell ? "Sell" : "Buy"}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <AssetLogo symbol={f.symbol} />
          <span className="truncate font-mono text-[12.5px] text-text-primary">{f.symbol}</span>
          {/* Labelled, not hidden. Every agent is paper today, so a history
              that silently implied real fills would mislead every reader. */}
          {f.is_paper ? <Badge tone="muted">Paper</Badge> : null}
        </span>
        <span className="block pt-0.5 font-ui text-[11px] text-text-dim">
          {shortDate(f.executed_at)}
          {f.tick_seq ? ` · cycle ${f.tick_seq}` : ""}
        </span>
      </span>
      <Cell>{tokenQty(Number(f.qty), Number(f.price_usd))}</Cell>
      <Cell>
        <span title={tokenPrice(Number(f.price_usd)).label}>
          {tokenPrice(Number(f.price_usd)).display}
        </span>
      </Cell>
      <Cell>{usd(Number(f.filled_usd))}</Cell>
      <span
        className={`tnum text-right font-mono text-[12.5px] ${
          realised === null ? "text-text-muted" : realised >= 0 ? "text-accent" : "text-negative"
        }`}
      >
        {realised === null
          ? "—"
          : usd(realised, { sign: true })}
      </span>
    </div>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}
