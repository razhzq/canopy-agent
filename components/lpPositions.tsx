"use client";

import { useEffect, useState } from "react";
import { compactAge, shortDate, tokenPrice, tokenQty, usd } from "@/lib/format";
import {
  getClosedLpPositions,
  type AgentDetail,
  type AgentLpLeg,
  type ClosedLpPosition,
  type LpDistribution,
  type UniverseAsset,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonRows } from "@/components/skeleton";
import { AssetLogo } from "@/components/ui";
import { Tick } from "@/components/kit";
import { CloseLpModal, type ClosableLp } from "@/components/closeLpPosition";
import { useLocale } from "@/lib/i18n";

/**
 * The book of a liquidity agent.
 *
 * NOT THE SPOT TABLE WITH DIFFERENT NUMBERS. A spot row is a quantity at a
 * price; an LP position is a deposit spread across a price RANGE in a pool,
 * earning fees while the price stays inside it. The questions an owner asks
 * are the ones every LP dashboard answers: what went in, what it is worth,
 * what it has earned in fees, and whether the price is still in range — so
 * those are the columns, and the range is drawn rather than written as bins.
 *
 * Every figure comes from the server's valuation (`lp.now`), computed by the
 * same functions a close uses. The browser never does bin arithmetic.
 */

type Tab = "open" | "history";

export function LpPositions({
  agentId,
  positions,
  universe,
  book,
  onChanged,
}: {
  agentId: number;
  positions: AgentDetail["positions"];
  universe: UniverseAsset[];
  /** Which book the open rows came from — history lists the same one. */
  book: "paper" | "live";
  onChanged?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("open");
  const { t } = useLocale();
  const rows = lpRows(positions);

  return (
    <div>
      <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1">
        <TabButton active={tab === "open"} onClick={() => setTab("open")}>
          {rows.length > 0 ? t("positions_tab_open_count", { count: rows.length }) : t("positions_tab_open")}
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          {t("positions_tab_history")}
        </TabButton>
      </div>

      {tab === "open" ? (
        <OpenLp agentId={agentId} rows={rows} universe={universe} onChanged={onChanged} />
      ) : (
        <ClosedLp agentId={agentId} book={book} universe={universe} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-8 items-center rounded-full px-3.5 font-ui text-[12.5px] font-medium transition-colors ${
        active ? "bg-surface-2 text-text-primary" : "text-text-dim hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ rows -- */

interface LpRow {
  id: number;
  mint: string;
  symbol: string;
  openedAt: string;
  investedUsd: number;
  leg: AgentLpLeg;
  /** Null when neither a fresh valuation nor a last mark exists. */
  valueUsd: number | null;
  /** True when `valueUsd` is the tick's last mark, not this request's read. */
  stale: boolean;
  feesUsd: number | null;
  /** What closing now would leave, against what went in. */
  pnlUsd: number | null;
}

function lpRows(positions: AgentDetail["positions"]): LpRow[] {
  return positions
    .filter((p): p is AgentDetail["positions"][number] & { lp: AgentLpLeg } => !!p.lp)
    .map((p) => {
      const leg = p.lp;
      const now = leg.now;
      const invested = Number(p.cost_basis_usd);
      const value = now ? now.valueUsd : leg.last_mark_usd;
      return {
        id: p.id,
        mint: p.mint,
        symbol: p.symbol,
        openedAt: p.opened_at,
        investedUsd: invested,
        leg,
        valueUsd: value,
        stale: !now && value !== null,
        feesUsd: now ? now.unclaimedFeesUsd + now.claimedFeesUsd : null,
        pnlUsd: now ? now.pnlUsd : null,
      };
    })
    .sort((a, b) => +new Date(b.openedAt) - +new Date(a.openedAt));
}

/** "WIF/SOL" → ["WIF", "SOL"]. A symbol without a slash is its own base. */
function pairOf(symbol: string): [string, string | null] {
  const [x, y] = symbol.split("/");
  return [x ?? symbol, y ?? null];
}

/** A price in the QUOTE token, so no dollar sign. */
function quotePrice(v: number | null | undefined): string {
  return tokenPrice(v).display.replace("$", "");
}

function pct(part: number | null, whole: number): string | null {
  if (part === null || !(whole > 0)) return null;
  const v = (part / whole) * 100;
  return `${v >= 0 ? "+" : "−"}${Math.abs(v) < 0.01 && v !== 0 ? "<0.01" : Math.abs(v).toFixed(2)}%`;
}

function tone(v: number | null): string {
  return v === null ? "text-text-muted" : v >= 0 ? "text-accent" : "text-negative";
}

/* ------------------------------------------------------------------ open -- */

const OPEN_COLS = "grid-cols-[minmax(180px,1.6fr)_56px_repeat(4,minmax(84px,1fr))_minmax(150px,1.3fr)_36px]";

function OpenLp({
  agentId,
  rows,
  universe,
  onChanged,
}: {
  agentId: number;
  rows: LpRow[];
  universe: UniverseAsset[];
  onChanged?: () => void;
}) {
  const { t } = useLocale();
  const [closing, setClosing] = useState<ClosableLp | null>(null);

  if (rows.length === 0) {
    return <p className="pt-5 font-ui text-[13px] text-text-secondary">{t("lp_empty")}</p>;
  }

  const sum = (pick: (r: LpRow) => number | null) =>
    rows.every((r) => pick(r) !== null) ? rows.reduce((s, r) => s + (pick(r) ?? 0), 0) : null;
  const invested = rows.reduce((s, r) => s + r.investedUsd, 0);
  const value = sum((r) => r.valueUsd);
  const fees = sum((r) => r.feesUsd);
  const pnl = sum((r) => r.pnlUsd);
  const claimed = sum((r) => r.leg.now?.claimedFeesUsd ?? null);
  const unclaimed = sum((r) => r.leg.now?.unclaimedFeesUsd ?? null);
  const inRange = rows.filter((r) => r.leg.now?.inRange).length;
  const estimated = rows.some((r) => r.leg.fees_estimated);

  const asClosable = (r: LpRow): ClosableLp => ({
    mint: r.mint,
    symbol: r.symbol,
    investedUsd: r.investedUsd,
    now: r.leg.now,
  });

  return (
    <div className="pt-4">
      {/* The book in one line, before any row. */}
      <div className="flex flex-wrap gap-x-7 gap-y-2 pb-4 font-ui text-[12px] text-text-muted">
        <Summary label={t("lp_total_value")}>{value === null ? "—" : usd(value)}</Summary>
        <Summary label={t("lp_total_pnl")}>
          <span className={tone(pnl)}>
            {pnl === null ? "—" : usd(pnl, { sign: true })}
            {pct(pnl, invested) ? <span className="pl-1.5 text-[11px] opacity-70">{pct(pnl, invested)}</span> : null}
          </span>
        </Summary>
        <Summary label={t("lp_claimed_fees")}>{claimed === null ? "—" : usd(claimed)}</Summary>
        <Summary label={t("lp_unclaimed_fees")}>
          <span className={unclaimed ? "text-accent" : undefined}>{unclaimed === null ? "—" : usd(unclaimed)}</span>
        </Summary>
        <Summary label={t("lp_in_range")}>
          {inRange} / {rows.length}
        </Summary>
      </div>

      {/* Wide screens: the table. Scrolls inside itself, never the page. */}
      <div className="hidden overflow-x-auto sm:block">
        <div className="min-w-[860px]">
          <div className={`grid ${OPEN_COLS} items-center gap-3 border-y border-grid py-2 font-ui text-[11.5px] text-text-muted`}>
            <span>{t("lp_col_position")}</span>
            <span className="text-right">{t("lp_col_age")}</span>
            <span className="text-right">{t("lp_col_invested")}</span>
            <span className="text-right">{t("lp_col_value")}</span>
            <span className="text-right" title={estimated ? t("lp_fees_estimated_title") : undefined}>
              {t("lp_col_fees")}
              {estimated ? "*" : ""}
            </span>
            <span className="text-right" title={t("lp_pnl_title")}>
              {t("lp_col_pnl")}
            </span>
            <span className="pl-2">{t("lp_col_range")}</span>
            <span />
          </div>

          {rows.map((r) => (
            <div key={r.id} className={`grid ${OPEN_COLS} items-center gap-3 border-b border-grid py-3`}>
              <PoolCell symbol={r.symbol} leg={{ ...r.leg, shape: r.leg.now?.distribution?.shape }} universe={universe} />
              <span className="tnum text-right font-mono text-[12.5px] text-text-secondary">{compactAge(r.openedAt, t)}</span>
              <Money main={usd(r.investedUsd)} />
              <Tick value={r.valueUsd} className="text-right">
                <Money
                  main={r.valueUsd === null ? t("positions_not_priced") : usd(r.valueUsd)}
                  sub={r.stale ? t("lp_last_mark") : holdsLine(r)}
                  muted={r.valueUsd === null || r.stale}
                />
              </Tick>
              <Money
                main={r.feesUsd === null ? "—" : usd(r.feesUsd)}
                sub={pct(r.feesUsd, r.investedUsd)}
                tone={r.feesUsd ? "text-accent" : undefined}
              />
              <Tick value={r.pnlUsd} className="text-right">
                <Money
                  main={r.pnlUsd === null ? "—" : usd(r.pnlUsd, { sign: true })}
                  sub={pct(r.pnlUsd, r.investedUsd)}
                  tone={tone(r.pnlUsd)}
                />
              </Tick>
              <div className="pl-2">
                <RangeBar leg={r.leg} symbol={r.symbol} />
              </div>
              <CloseButton symbol={r.symbol} onClick={() => setClosing(asClosable(r))} />
            </div>
          ))}

          {rows.length > 1 ? (
            <div className={`grid ${OPEN_COLS} items-center gap-3 py-3`}>
              <span className="font-ui text-[12.5px] font-medium text-text-primary">{t("lp_total")}</span>
              <span />
              <Money main={usd(invested)} />
              <Money main={value === null ? "—" : usd(value)} />
              <Money main={fees === null ? "—" : usd(fees)} sub={pct(fees, invested)} tone={fees ? "text-accent" : undefined} />
              <Money main={pnl === null ? "—" : usd(pnl, { sign: true })} sub={pct(pnl, invested)} tone={tone(pnl)} />
              <span />
              <span />
            </div>
          ) : null}
        </div>
      </div>

      {/* Phones: one card per position, the same figures stacked. */}
      <div className="sm:hidden">
        {rows.map((r) => (
          <div key={r.id} className="border-t border-grid py-3">
            <div className="flex items-start justify-between gap-3">
              <PoolCell symbol={r.symbol} leg={{ ...r.leg, shape: r.leg.now?.distribution?.shape }} universe={universe} />
              <CloseButton symbol={r.symbol} onClick={() => setClosing(asClosable(r))} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3">
              <Pair label={t("lp_col_invested")} value={usd(r.investedUsd)} />
              <Pair label={t("lp_col_value")} value={r.valueUsd === null ? "—" : usd(r.valueUsd)} />
              <Pair
                label={t("lp_col_fees")}
                value={r.feesUsd === null ? "—" : usd(r.feesUsd)}
                tone={r.feesUsd ? "text-accent" : undefined}
              />
              <Pair
                label={t("lp_col_pnl")}
                value={r.pnlUsd === null ? "—" : usd(r.pnlUsd, { sign: true })}
                tone={tone(r.pnlUsd)}
              />
            </div>
            <div className="pt-3">
              <RangeBar leg={r.leg} symbol={r.symbol} />
            </div>
          </div>
        ))}
      </div>

      {estimated ? <p className="pt-3 font-ui text-[11.5px] text-text-dim">* {t("lp_fees_estimated_title")}</p> : null}

      {closing ? (
        <CloseLpModal agentId={agentId} position={closing} onClose={() => setClosing(null)} onClosed={() => onChanged?.()} />
      ) : null}
    </div>
  );
}

function holdsLine(r: LpRow): string | null {
  const h = r.leg.now?.holds;
  if (!h) return null;
  const [x, y] = pairOf(r.symbol);
  const parts: string[] = [];
  if (h.x > 0) parts.push(`${tokenQty(h.x, h.x > 0 ? h.xUsd / h.x : null)} ${x}`);
  if (h.y > 0) parts.push(`${tokenQty(h.y, h.y > 0 ? h.yUsd / h.y : null)} ${y ?? ""}`.trim());
  return parts.length ? parts.join(" + ") : null;
}

/* --------------------------------------------------------------- pieces -- */

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      {label}
      <span className="tnum font-mono text-[13px] text-text-primary">{children}</span>
    </span>
  );
}

function Money({
  main,
  sub,
  tone: toneClass,
  muted = false,
}: {
  main: string;
  sub?: string | null;
  tone?: string;
  muted?: boolean;
}) {
  return (
    <span className={`block text-right ${toneClass ?? (muted ? "text-text-muted" : "text-text-secondary")}`}>
      <span className="tnum block font-mono text-[13px]">{main}</span>
      {sub ? <span className="tnum block truncate pt-0.5 font-mono text-[11px] opacity-70">{sub}</span> : null}
    </span>
  );
}

function Pair({ label, value, tone: toneClass }: { label: string; value: string; tone?: string }) {
  return (
    <span className="block">
      <span className="block font-ui text-[11px] text-text-muted">{label}</span>
      <span className={`tnum block font-mono text-[13px] ${toneClass ?? "text-text-secondary"}`}>{value}</span>
    </span>
  );
}

interface PoolFacts {
  venue: string;
  pool: string;
  binStepBps?: number | null;
  token_x_mint?: string;
  token_y_mint?: string;
  token_x_icon?: string | null;
  token_y_icon?: string | null;
  shape?: LpDistribution["shape"];
}

function PoolCell({ symbol, leg, universe }: { symbol: string; leg: PoolFacts; universe: UniverseAsset[] }) {
  const { t } = useLocale();
  const [x, y] = pairOf(symbol);
  // The server's icon first (the token universe, by mint); the page's own
  // universe second, for a backend that does not send one.
  const icon = (sent: string | null | undefined, mint: string | undefined, sym: string | null) =>
    sent ?? universe.find((a) => (mint && a.mint === mint) || (sym !== null && a.symbol === sym))?.iconUrl ?? null;
  const dlmm = leg.venue === "meteora-dlmm";
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="flex shrink-0 items-center">
        <span className="rounded-full ring-2 ring-bg">
          <AssetLogo symbol={x} src={icon(leg.token_x_icon, leg.token_x_mint, x)} size={22} />
        </span>
        {y ? (
          <span className="-ml-2 rounded-full ring-2 ring-bg">
            <AssetLogo symbol={y} src={icon(leg.token_y_icon, leg.token_y_mint, y)} size={22} />
          </span>
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-mono text-[13px] text-text-primary">
          {x}
          {y ? <span className="text-text-muted"> / {y}</span> : null}
        </span>
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 whitespace-nowrap pt-0.5 font-ui text-[11px] text-text-dim">
          <span className="inline-flex h-[17px] items-center rounded border border-border px-1 font-mono text-[10px] text-text-secondary">
            {dlmm ? "DLMM" : t("lp_venue_damm")}
          </span>
          <a
            href={dlmm ? `https://app.meteora.ag/dlmm/${leg.pool}` : `https://solscan.io/account/${leg.pool}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono hover:text-text-primary"
            title={leg.pool}
          >
            {leg.pool.slice(0, 4)}…{leg.pool.slice(-4)}
          </a>
          {leg.shape ? (
            <span className="inline-flex h-[17px] items-center rounded border border-border px-1 font-ui text-[10px] text-text-secondary">
              {t(leg.shape === "spot" ? "lp_shape_spot" : leg.shape === "curve" ? "lp_shape_curve" : "lp_shape_bid_ask")}
            </span>
          ) : null}
          {leg.binStepBps ? <span className="font-mono">{t("lp_bin_step", { bps: leg.binStepBps })}</span> : null}
        </span>
      </span>
    </span>
  );
}

/**
 * The range, drawn: its two edges as prices, the pool's price as a marker.
 *
 * The marker is clamped to the bar when the price has left the range, and the
 * edge it left through turns red — the one fact on the row that says the
 * position has stopped earning.
 */
function RangeBar({ leg, symbol }: { leg: AgentLpLeg; symbol: string }) {
  const { t } = useLocale();
  const now = leg.now;
  const prices = now?.prices;
  if (!now || !prices || !(prices.max > prices.min)) {
    return (
      <span className="tnum font-mono text-[11.5px] text-text-dim">
        {t("lp_bins", { min: leg.range.minBinId, max: leg.range.maxBinId })}
      </span>
    );
  }
  // Bins are geometric, so position on the bar is measured in bins, not price.
  const span = Math.log(prices.max / prices.min);
  const raw = Math.log(prices.active / prices.min) / span;
  const at = Math.min(1, Math.max(0, raw));
  const below = raw < 0;
  const above = raw > 1;
  const out = below || above;
  const dist = now.distribution;
  const [x, y] = pairOf(symbol);

  return (
    <span className="block" title={t("lp_range_title", { price: quotePrice(prices.active) })}>
      <span className="tnum flex justify-between font-mono text-[11px] text-text-dim">
        <span>{quotePrice(prices.min)}</span>
        <span>{quotePrice(prices.max)}</span>
      </span>
      {dist && dist.bins.length > 0 ? (
        <LiquidityBars dist={dist} at={at} out={out} below={below} above={above} base={x} quote={y} />
      ) : (
        <span className="relative mt-1.5 block h-1.5">
          <span className={`absolute inset-y-0 left-0 right-0 rounded-full ${out ? "bg-grid-strong" : "bg-accent/35"}`} />
          {below ? <span className="absolute inset-y-0 left-0 w-1 rounded-l-full bg-negative" /> : null}
          {above ? <span className="absolute inset-y-0 right-0 w-1 rounded-r-full bg-negative" /> : null}
          <span
            className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-bg ${out ? "bg-negative" : "bg-accent"}`}
            style={{ left: `${at * 100}%` }}
          />
        </span>
      )}
      <span className={`block pt-1 font-ui text-[11px] ${out ? "text-negative" : "text-text-dim"}`}>
        {out
          ? leg.out_of_range_since
            ? t("lp_out_of_range_since", { age: compactAge(leg.out_of_range_since, t) })
            : t("lp_out_of_range")
          : t("lp_in_range_at", { price: quotePrice(prices.active) })}
      </span>
    </span>
  );
}

/** More columns than this and bins are summed in groups: a 150px cell cannot draw 1,400 bars. */
const MAX_BARS = 48;

/**
 * The liquidity, bin by bin — the picture that says spot, curve or bid-ask.
 *
 * Each bar is one bin (or a group of neighbours on a wide range), its height
 * the bin's value, split into the base token on top and the quote token below.
 * Heights are in quote units, so the picture does not change as price moves.
 * The line is where the pool's price is now.
 */
function LiquidityBars({
  dist,
  at,
  out,
  below,
  above,
  base,
  quote,
}: {
  dist: LpDistribution;
  at: number;
  out: boolean;
  below: boolean;
  above: boolean;
  base: string;
  quote: string | null;
}) {
  const group = Math.ceil(dist.bins.length / MAX_BARS);
  const bars: { x: number; y: number }[] = [];
  for (let i = 0; i < dist.bins.length; i += group) {
    const slice = dist.bins.slice(i, i + group);
    bars.push({ x: slice.reduce((s, b) => s + b.x, 0), y: slice.reduce((s, b) => s + b.y, 0) });
  }
  const peak = Math.max(...bars.map((b) => b.x + b.y), 0);

  return (
    <span className="relative mt-1.5 block h-7" aria-label={`${base} / ${quote ?? ""}`}>
      <span className="flex h-full items-end gap-px">
        {bars.map((b, i) => {
          const total = b.x + b.y;
          const h = peak > 0 ? (total / peak) * 100 : 0;
          return (
            <span key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={undefined}>
              <span className="flex w-full flex-col overflow-hidden rounded-t-[1px]" style={{ height: `${Math.max(h, total > 0 ? 4 : 0)}%` }}>
                <span className={out ? "bg-text-muted/60" : "bg-accent"} style={{ flexGrow: b.x }} />
                <span className="bg-text-secondary/45" style={{ flexGrow: b.y }} />
              </span>
            </span>
          );
        })}
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-grid-strong" />
      {below ? <span className="absolute bottom-0 left-0 top-0 w-0.5 bg-negative" /> : null}
      {above ? <span className="absolute bottom-0 right-0 top-0 w-0.5 bg-negative" /> : null}
      {out ? null : (
        <span className="pointer-events-none absolute -top-0.5 bottom-0 w-px bg-text-primary" style={{ left: `${at * 100}%` }} />
      )}
    </span>
  );
}

function CloseButton({ symbol, onClick }: { symbol: string; onClick: () => void }) {
  const { t } = useLocale();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("positions_close_aria", { symbol })}
      title={t("positions_close_title")}
      className="flex size-8 shrink-0 items-center justify-center justify-self-end rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-negative focus-visible:bg-surface-2 focus-visible:text-negative focus-visible:outline-1 focus-visible:outline-accent"
    >
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
        <path d="m4.5 4.5 7 7m0-7-7 7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/* --------------------------------------------------------------- history -- */

const PAGE_SIZE = 20;
const CLOSED_COLS = "grid-cols-[minmax(180px,1.6fr)_repeat(5,minmax(84px,1fr))_minmax(130px,1.1fr)]";

function held(openedAt: string, closedAt: string): number {
  return +new Date(closedAt) - +new Date(openedAt);
}

function duration(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

function ClosedLp({ agentId, book, universe }: { agentId: number; book: "paper" | "live"; universe: UniverseAsset[] }) {
  const [page, setPage] = useState(1);
  const { t, locale } = useLocale();
  useEffect(() => setPage(1), [agentId, book]);
  const state = useApi((token) => getClosedLpPositions(token, agentId, page, PAGE_SIZE, book), [agentId, book, page]);

  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "loading") return <SkeletonRows labelKey="loading_trades" cols="1.6fr 1fr 1fr 1fr 1fr" rows={4} />;
  if (state.phase === "error") return <ErrorState message={state.message} onRetry={state.reload} />;

  const { positions, total } = state.data;
  if (total === 0) return <p className="pt-5 font-ui text-[13px] text-text-secondary">{t("lp_history_empty")}</p>;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const estimated = positions.some((r) => r.fees_estimated && r.fees_earned_usd != null);

  const reason = (r: ClosedLpPosition) =>
    r.close_reason === "manual"
      ? t("lp_reason_manual")
      : r.close_reason === "breaker"
        ? t("lp_reason_breaker")
        : r.leader_position
          ? t("lp_reason_leader")
          : t("lp_reason_exit");

  return (
    <div className="pt-4">
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <div className={`grid ${CLOSED_COLS} items-center gap-3 border-b border-grid pb-2 font-ui text-[11.5px] text-text-muted`}>
            <span>{t("lp_col_position")}</span>
            <span className="text-right">{t("lp_col_held")}</span>
            <span className="text-right">{t("lp_col_invested")}</span>
            <span className="text-right">{t("lp_col_withdrawn")}</span>
            <span className="text-right" title={estimated ? t("lp_fees_estimated_title") : undefined}>
              {t("lp_col_fees")}
              {estimated ? "*" : ""}
            </span>
            <span className="text-right">{t("lp_col_realised")}</span>
            <span className="pl-2">{t("lp_col_closed")}</span>
          </div>
          {positions.map((r) => (
            <div key={r.id} className={`grid ${CLOSED_COLS} items-center gap-3 border-b border-grid py-3 last:border-b-0`}>
              <PoolCell
                symbol={r.symbol}
                leg={{
                  venue: r.venue,
                  pool: r.pool,
                  binStepBps: r.bin_step_bps,
                  token_x_mint: r.token_x_mint,
                  token_y_mint: r.token_y_mint,
                  token_x_icon: r.token_x_icon,
                  token_y_icon: r.token_y_icon,
                  shape: r.distribution?.shape,
                }}
                universe={universe}
              />
              <Money
                main={duration(held(r.opened_at, r.closed_at))}
                sub={r.rebalance_count > 0 ? t("lp_rebalances", { count: r.rebalance_count }) : null}
              />
              <Money
                main={usd(r.invested_usd ?? r.deposited_usd)}
                sub={
                  r.price_range.min !== null && r.price_range.max !== null
                    ? `${quotePrice(r.price_range.min)} – ${quotePrice(r.price_range.max)}`
                    : null
                }
              />
              <Money main={r.closed_value_usd === null ? "—" : usd(r.closed_value_usd)} />
              <Money
                main={r.fees_earned_usd == null ? "—" : usd(r.fees_earned_usd)}
                sub={r.fees_earned_usd == null ? null : pct(r.fees_earned_usd, r.invested_usd ?? r.deposited_usd)}
                tone={r.fees_earned_usd ? "text-accent" : undefined}
                muted={r.fees_earned_usd == null}
              />
              <Money
                main={usd(r.realized_pnl_usd, { sign: true })}
                sub={r.return_pct == null ? null : pct(r.return_pct, 100)}
                tone={tone(r.realized_pnl_usd)}
              />
              <span className="block pl-2">
                <span className="block font-ui text-[12px] text-text-secondary">{shortDate(r.closed_at, locale)}</span>
                <span className="block pt-0.5 font-ui text-[11px] text-text-dim">{reason(r)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {estimated ? <p className="pt-3 font-ui text-[11.5px] text-text-dim">* {t("lp_fees_estimated_title")}</p> : null}

      <div className="flex items-center gap-3 pt-3">
        {pages > 1 ? (
          <>
            <PageButton disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ‹
            </PageButton>
            <PageButton disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              ›
            </PageButton>
          </>
        ) : null}
        <p className="font-ui text-[11.5px] text-text-dim">
          {total === 1 ? t("positions_open_count_one") : t("positions_open_count_many", { count: total })}
          {pages > 1 ? ` · ${page} / ${pages}` : ""}
        </p>
      </div>
    </div>
  );
}

function PageButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-full border border-border font-ui text-[13px] text-text-primary transition-colors hover:border-grid-strong disabled:opacity-40"
    >
      {children}
    </button>
  );
}
