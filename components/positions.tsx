"use client";

import { useEffect, useState } from "react";
import { shortDate, tokenPrice, tokenQty, usd } from "@/lib/format";
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
import { useLocale } from "@/lib/i18n";

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
  const { t } = useLocale();

  return (
    <div>
      <div className="flex items-center gap-1 pt-4">
        <TabButton active={tab === "open"} onClick={() => setTab("open")}>
          {positions.length > 0
            ? t("positions_tab_open_count", {
                count: aggregate(positions, universe).length,
              })
            : t("positions_tab_open")}
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          {t("positions_tab_history")}
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
        <HistoryTable agentId={agentId} universe={universe} />
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
  /**
   * The universe's remote icon, and who wrapped it.
   *
   * Both come off the same lookup as the mark. Without the URL `AssetLogo`
   * falls back to a two-letter monogram for everything that has no bundled
   * ticker file — which is every Solana token but a dozen tokenized RWAs, so
   * the book looked iconless in practice. `issuer` is what separates two gold
   * wrappers, whose underlying is XAU either way.
   */
  logoSrc: string | null;
  issuer: string | null;
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
  // Kept whole, not just its price: the row needs the icon and the issuer too.
  const bySymbolAsset = new Map(universe.map((a) => [a.symbol, a]));

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
      const asset = bySymbolAsset.get(symbol);
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
        logoSrc: asset?.iconUrl ?? null,
        issuer: asset?.issuer ?? null,
        valueUsd,
        pnlUsd: valueUsd === null ? null : valueUsd - costUsd,
        pnlPct:
          valueUsd === null || costUsd <= 0
            ? null
            : ((valueUsd - costUsd) / costUsd) * 100,
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
  const { t, locale } = useLocale();
  const holdings = aggregate(positions, universe);

  if (holdings.length === 0) {
    return (
      <p className="pt-5 font-ui text-[13px] text-text-secondary">
        {t("positions_empty")}
      </p>
    );
  }

  return (
    <div className="pt-4">
      {/* Header and rows are both `flex-1` grid + a fixed trailing column, so
          the data columns line up exactly whatever the × column costs. */}
      <div className="hidden items-center gap-3 border-b border-grid pb-2 font-mono text-[9.5px] tracking-[0.12em] text-text-dim uppercase sm:flex">
        <div className="grid flex-1 grid-cols-[1.4fr_repeat(4,1fr)_auto] gap-3">
          <span>{t("positions_col_asset")}</span>
          <span className="text-right">{t("positions_col_qty")}</span>
          <span className="text-right">{t("positions_col_cost")}</span>
          <span className="text-right">{t("positions_col_value")}</span>
          <span className="text-right">{t("positions_col_pnl")}</span>
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
                    <AssetLogo
                      symbol={h.symbol}
                      issuer={h.issuer}
                      src={h.logoSrc}
                    />
                    <span className="truncate font-mono text-[12.5px] text-text-primary">
                      {h.symbol}
                    </span>
                  </span>
                  <span className="block pt-0.5 font-ui text-[11px] text-text-dim">
                    {h.lots.length === 1
                      ? t("positions_since", {
                          date: shortDate(h.openedAt, locale),
                        })
                      : t("positions_entries_since", {
                          count: h.lots.length,
                          date: shortDate(h.openedAt, locale),
                        })}
                  </span>
                </span>
                <Cell>{tokenQty(h.qty, h.markUsd)}</Cell>
                {/* WHAT IT COST, AND WHAT THAT BOUGHT — one cell.
              
                  This column used to be the average price alone, which left the
                  owner to multiply it by the quantity to learn what they had
                  put in. The dollar figure is what P&L is measured against, so
                  it leads; the price it was bought at sits under it, which is
                  the same shape the P&L cell next door already uses and the
                  same "qty @ price · total" idiom the lot rows use.

                  The price stays a PRICE, never rounded to two decimals: that
                  rendered a memecoin at $0.00005835 as "$0.00" — a wrong
                  number, not a rounded one, and the owner reads it as
                  worthless. */}
                <Amount
                  main={usd(h.costUsd)}
                  sub={t("positions_at_price", {
                    price: tokenPrice(h.avgUsd).display,
                  })}
                  subTitle={tokenPrice(h.avgUsd).label}
                />
                {/* The same pair, marked to now. Both lines come off the mark, so
                  a row cannot show a value its price disagrees with — and an
                  unpriceable asset says so on both rather than carrying cost
                  forward, which would render as "flat" and claim something. */}
                <Amount
                  main={
                    h.valueUsd === null
                      ? t("positions_not_priced")
                      : usd(h.valueUsd)
                  }
                  sub={
                    h.markUsd === null
                      ? null
                      : t("positions_at_price", {
                          price: tokenPrice(h.markUsd).display,
                        })
                  }
                  subTitle={
                    h.markUsd === null ? undefined : tokenPrice(h.markUsd).label
                  }
                  muted={h.valueUsd === null}
                />
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
                    {h.pnlUsd === null ? "—" : usd(h.pnlUsd, { sign: true })}
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
                aria-label={t("positions_close_aria", { symbol: h.symbol })}
                title={t("positions_close_title")}
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
                  {t("positions_entries")}
                </p>
                {h.lots.map((l, i) => (
                  <div
                    key={l.id}
                    className="flex items-baseline justify-between gap-3 border-l border-grid py-1 pl-3"
                  >
                    <span className="font-ui text-[11.5px] text-text-secondary">
                      {i + 1}. {shortDate(l.openedAt, locale)}
                    </span>
                    <span className="tnum font-mono text-[11.5px] text-text-dim">
                      {tokenQty(l.qty, l.costUsd / (l.qty || 1))} @{" "}
                      {tokenPrice(l.qty > 0 ? l.costUsd / l.qty : null).display}{" "}
                      · {usd(l.costUsd)}
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

/**
 * A dollar figure with the price behind it underneath.
 *
 * DOLLARS LEAD. A price alone cannot be weighed against the rest of the book —
 * the owner had to multiply it by the quantity to learn what the position was
 * worth — and the same argument the P&L cell makes for dollars over percent
 * applies here. The price stays, one line down, because it is what tells them
 * whether the mark has moved.
 */
function Amount({
  main,
  sub,
  subTitle,
  muted = false,
}: {
  main: string;
  sub?: string | null;
  subTitle?: string;
  muted?: boolean;
}) {
  return (
    <span className="text-right">
      <span
        className={`tnum block font-mono text-[12.5px] ${
          muted ? "text-text-muted" : "text-text-secondary"
        }`}
      >
        {main}
      </span>
      {sub ? (
        <span
          title={subTitle}
          className="tnum block pt-0.5 font-mono text-[11px] text-text-dim"
        >
          {sub}
        </span>
      ) : null}
    </span>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <span className="tnum text-right font-mono text-[12.5px] text-text-secondary">
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- history -- */

function HistoryTable({
  agentId,
  universe,
}: {
  agentId: number;
  /** For the row icons. A fill carries no icon of its own. */
  universe: UniverseAsset[];
}) {
  // `token`, not `t` — the translator holds that name below.
  const state = useApi((token) => getAgentFills(token, agentId), [agentId]);
  const { getAccessToken } = usePrivy();
  const { t } = useLocale();

  // Pages AFTER the first. useApi replaces its data on each fetch, which is
  // right for a single view and wrong for an accumulating list — so the first
  // page stays under useApi (it owns the loading, signed-out and error phases)
  // and everything fetched by "load more" is held here.
  const [extra, setExtra] = useState<AgentFill[]>([]);
  const [cursor, setCursor] = useState<{
    before: string | null;
    beforeId: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const firstId =
    state.phase === "ready" ? (state.data.fills[0]?.id ?? "none") : "";

  // A reload — retry, or a different agent — invalidates everything appended to
  // it. Without this the old pages stay stitched under a new first page.
  useEffect(() => {
    setExtra([]);
    setCursor(null);
    setPageError(null);
  }, [firstId, agentId]);

  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "loading")
    return (
      <SkeletonRows
        labelKey="loading_trades"
        cols="1.4fr 1fr 1fr 1fr auto"
        rows={5}
      />
    );
  if (state.phase === "error")
    return <ErrorState message={state.message} onRetry={state.reload} />;

  const fills = [...state.data.fills, ...extra];
  const assetOf = (symbol: string) => universe.find((a) => a.symbol === symbol);
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
      if (!token) throw new Error(t("positions_sign_in_more"));
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
        {t("positions_history_empty")}
      </p>
    );
  }

  return (
    <div className="pt-4">
      {/* Same shape as the open book above: the dollar figure leads and the
          price it was struck at sits under it, so the two tabs do not describe
          a trade two different ways. */}
      <div className="hidden grid-cols-[auto_1.2fr_repeat(3,1fr)] gap-3 border-b border-grid pb-2 font-mono text-[9.5px] tracking-[0.12em] text-text-dim uppercase sm:grid">
        <span>{t("positions_col_side")}</span>
        <span>{t("positions_col_asset")}</span>
        <span className="text-right">{t("positions_col_qty")}</span>
        <span className="text-right">{t("positions_col_value")}</span>
        <span className="text-right">{t("positions_col_realised")}</span>
      </div>

      {fills.map((f) => (
        <FillRow key={f.id} fill={f} asset={assetOf(f.symbol)} />
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
            {t(loading ? "positions_loading" : "positions_load_more")}
          </button>
        ) : null}
        {/* One sentence per case: "so far" and "all of them" attach to the
            count differently in the two languages, and the singular drops the
            plural pronoun entirely. */}
        <p className="font-ui text-[11.5px] text-text-dim">
          {hasMore
            ? fills.length === 1
              ? t("positions_count_one_partial")
              : t("positions_count_many_partial", { count: fills.length })
            : fills.length === 1
              ? t("positions_count_one_all")
              : t("positions_count_many_all", { count: fills.length })}
        </p>
      </div>
    </div>
  );
}

function FillRow({
  fill: f,
  asset,
}: {
  fill: AgentFill;
  asset?: UniverseAsset;
}) {
  const { t, locale } = useLocale();
  const sell = f.side === "sell" || f.side === "remove_liquidity";
  const realised =
    f.realized_pnl_usd === null ? null : Number(f.realized_pnl_usd);

  /**
   * What that result was, as a percentage of what the closed lots cost.
   *
   * The cost is not on a fill row, but it is exactly the proceeds minus the
   * result — a sell that returned $1,100 and realised $100 closed $1,000 of
   * cost. Same reasoning the open book uses for showing dollars beside
   * percent: −$40 is a rounding error on one trade and the worst of the month
   * on another, and a reader cannot tell which from the dollars alone.
   *
   * Null on a buy (no result yet) and on a zero basis, where the percentage
   * would be a division by nothing rather than a break-even.
   */
  const basis = realised === null ? 0 : Number(f.filled_usd) - realised;
  const realisedPct =
    realised === null || basis <= 0 ? null : (realised / basis) * 100;

  return (
    <div className="grid grid-cols-2 items-center gap-3 border-b border-grid py-3 last:border-b-0 sm:grid-cols-[auto_1.2fr_repeat(3,1fr)]">
      <span
        className={`font-mono text-[10px] tracking-[0.08em] uppercase ${
          sell ? "text-negative" : "text-accent"
        }`}
      >
        {t(sell ? "positions_side_sell" : "positions_side_buy")}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <AssetLogo
            symbol={f.symbol}
            issuer={asset?.issuer}
            src={asset?.iconUrl}
          />
          <span className="truncate font-mono text-[12.5px] text-text-primary">
            {f.symbol}
          </span>
          {/* Labelled, not hidden. Every agent is paper today, so a history
              that silently implied real fills would mislead every reader. */}
          {f.is_paper ? (
            <Badge tone="muted">{t("positions_badge_paper")}</Badge>
          ) : null}
        </span>
        <span className="block pt-0.5 font-ui text-[11px] text-text-dim">
          {f.tick_seq
            ? t("positions_fill_cycle", {
                date: shortDate(f.executed_at, locale),
                cycle: f.tick_seq,
              })
            : shortDate(f.executed_at, locale)}
        </span>
      </span>
      <Cell>{tokenQty(Number(f.qty), Number(f.price_usd))}</Cell>
      {/* What it moved, and the price it moved at. */}
      <Amount
        main={usd(Number(f.filled_usd))}
        sub={t("positions_at_price", {
          price: tokenPrice(Number(f.price_usd)).display,
        })}
        subTitle={tokenPrice(Number(f.price_usd)).label}
      />
      <span
        className={`text-right ${
          realised === null
            ? "text-text-muted"
            : realised >= 0
              ? "text-accent"
              : "text-negative"
        }`}
      >
        <span className="tnum block font-mono text-[12.5px]">
          {realised === null ? "—" : usd(realised, { sign: true })}
        </span>
        {realisedPct === null ? null : (
          <span className="tnum block pt-0.5 font-mono text-[11px] opacity-70">
            {realisedPct >= 0 ? "+" : "−"}
            {Math.abs(realisedPct).toFixed(1)}%
          </span>
        )}
      </span>
    </div>
  );
}

// `shortDate` moved to lib/format, where it takes the locale.
