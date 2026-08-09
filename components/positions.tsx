"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  getAgentFills,
  num,
  type AgentDetail,
  type AgentFill,
  type UniverseAsset,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ErrorState, LoadingState, SignedOutState } from "@/components/states";
import { Badge } from "@/components/ui";

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
}: {
  agentId: number;
  positions: AgentDetail["positions"];
  /** Priced assets, for the mark. Absent while the universe call is in flight. */
  universe: UniverseAsset[];
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
        <OpenTable positions={positions} universe={universe} />
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
  positions,
  universe,
}: {
  positions: AgentDetail["positions"];
  universe: UniverseAsset[];
}) {
  const [open, setOpen] = useState<string | null>(null);
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
      <div className="hidden grid-cols-[1.4fr_repeat(4,1fr)_auto] gap-3 border-b border-grid pb-2 font-mono text-[9.5px] tracking-[0.12em] text-text-dim uppercase sm:grid">
        <span>Asset</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Avg cost</span>
        <span className="text-right">Value</span>
        <span className="text-right">P&amp;L</span>
        <span className="w-8" />
      </div>

      {holdings.map((h) => {
        const expanded = open === h.symbol;
        // One lot is not an accumulation — nothing to expand into.
        const canExpand = h.lots.length > 1;
        return (
          <div key={h.symbol} className="border-b border-grid last:border-b-0">
            <button
              type="button"
              disabled={!canExpand}
              onClick={() => setOpen(expanded ? null : h.symbol)}
              className="grid w-full grid-cols-2 items-center gap-3 py-3 text-left sm:grid-cols-[1.4fr_repeat(4,1fr)_auto]"
            >
              <span className="min-w-0">
                <span className="block truncate font-mono text-[12.5px] text-text-primary">
                  {h.symbol}
                </span>
                <span className="block pt-0.5 font-ui text-[11px] text-text-dim">
                  {h.lots.length === 1
                    ? `since ${shortDate(h.openedAt)}`
                    : `${h.lots.length} entries · since ${shortDate(h.openedAt)}`}
                </span>
              </span>
              <Cell>{h.qty.toFixed(4)}</Cell>
              <Cell>${h.avgUsd.toFixed(2)}</Cell>
              <Cell>{h.valueUsd === null ? "not priced" : `$${h.valueUsd.toFixed(2)}`}</Cell>
              <span
                className={`tnum text-right font-mono text-[12.5px] ${
                  h.pnlPct === null
                    ? "text-text-muted"
                    : h.pnlPct >= 0
                      ? "text-accent"
                      : "text-negative"
                }`}
              >
                {h.pnlPct === null ? "—" : `${h.pnlPct >= 0 ? "+" : "−"}${Math.abs(h.pnlPct).toFixed(1)}%`}
              </span>
              <span className="w-8 text-right font-mono text-[11px] text-text-dim">
                {canExpand ? (expanded ? "−" : "+") : ""}
              </span>
            </button>

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
                      {l.qty.toFixed(4)} @ ${(l.costUsd / (l.qty || 1)).toFixed(2)} ·{" "}
                      ${l.costUsd.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
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
  if (state.phase === "loading") return <LoadingState label="Loading trades" />;
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
      <Cell>{Number(f.qty).toFixed(4)}</Cell>
      <Cell>${Number(f.price_usd).toFixed(2)}</Cell>
      <Cell>${Number(f.filled_usd).toFixed(2)}</Cell>
      <span
        className={`tnum text-right font-mono text-[12.5px] ${
          realised === null ? "text-text-muted" : realised >= 0 ? "text-accent" : "text-negative"
        }`}
      >
        {realised === null
          ? "—"
          : `${realised >= 0 ? "+" : "−"}$${Math.abs(realised).toFixed(2)}`}
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
