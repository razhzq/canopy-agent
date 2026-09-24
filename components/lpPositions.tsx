"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Tick, TxLink } from "@/components/kit";
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
  copy,
  onChanged,
  unit = "USD",
  solUsd = null,
}: {
  agentId: number;
  /** The agent's cash token, for the close dialog's proceeds figure. */
  unit?: "USD" | "SOL";
  solUsd?: number | null;
  positions: AgentDetail["positions"];
  universe: UniverseAsset[];
  /** Which book the open rows came from — history lists the same one. */
  book: "paper" | "live";
  /** On a copy agent: who it follows, and what it is deliberately not in. */
  copy?: AgentDetail["copy"];
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
        <>
          <OpenLp agentId={agentId} rows={rows} universe={universe} onChanged={onChanged} unit={unit} solUsd={solUsd} />
          <NotCopied copy={copy} />
        </>
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

/**
 * "FLEX-SOL LP" → ["FLEX", "SOL"] — base first, quote second.
 *
 * IT SPLIT ON A SLASH, AND NOTHING EVER HAS ONE. The backend writes the symbol
 * as `${base}-${quote} LP` (`lpSymbolFor`), so this returned the whole string
 * as the base and null as the quote on every position ever rendered. Three
 * callers were quietly wrong: the holds line read "1.2 FLEX-SOL LP + 340",
 * the pool cell looked up a logo for a symbol no universe contains and never
 * resolved the second token's at all, and the range chart's label named a pair
 * that did not exist.
 *
 * Split on the LAST separator: the quote is one symbol, the base may itself
 * carry a hyphen. The " LP" suffix goes first — it is a kind, not a name.
 */
function pairOf(symbol: string): [string, string | null] {
  const bare = symbol.replace(/\s+LP$/i, "").trim();
  const cut = Math.max(bare.lastIndexOf("/"), bare.lastIndexOf("-"));
  if (cut <= 0 || cut === bare.length - 1) return [bare, null];
  return [bare.slice(0, cut), bare.slice(cut + 1)];
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


/**
 * What the copy is deliberately not in, and why.
 *
 * THE REASON WAS ALWAYS THERE. Every refusal is recorded with a sentence the
 * moment it is taken — "Verified tokens only, and CYPHERCAT is not verified",
 * "Held by the leader before copying started" — and none of it used to reach a
 * screen. An owner seeing an empty book had no way to tell a leader who is
 * flat from a filter of their own that is holding them out, and the only way to
 * find out was to read the database.
 *
 * Quiet on purpose: this is a list of facts, not a fault. A callout would make
 * a configured refusal look like an incident (kit rule 4), and these rows are
 * most often exactly what the owner asked for.
 */
function NotCopied({ copy }: { copy?: AgentDetail["copy"] }) {
  const { t, locale } = useLocale();
  if (!copy || copy.notCopied.length === 0) return null;

  return (
    <div className="mt-6 border-t border-grid pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-ui text-[12.5px] font-medium text-text-primary">
          {t("lp_not_copied")}
        </p>
        <p className="font-ui text-[11.5px] text-text-muted">{t("lp_not_copied_note")}</p>
      </div>

      <ul className="pt-2">
        {copy.notCopied.map((n) => (
          <li
            key={n.leaderPosition}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-grid py-2 last:border-b-0"
          >
            <span className="font-mono text-[12px] text-text-secondary">
              {n.poolName ?? `${n.pool.slice(0, 4)}…${n.pool.slice(-4)}`}
            </span>
            <span className="min-w-0 flex-1 text-right font-ui text-[11.5px] leading-relaxed text-text-dim">
              {/* An older row can carry no reason; the status still says which
                  kind of refusal it was, which is better than an empty cell. */}
              {n.reason ?? t("lp_not_copied_held_before")}{" "}
              <span className="tnum font-mono text-text-muted">
                · {shortDate(n.at, locale)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ open -- */

const OPEN_COLS = "grid-cols-[minmax(180px,1.6fr)_56px_repeat(4,minmax(84px,1fr))_minmax(150px,1.3fr)_36px]";

function OpenLp({
  agentId,
  rows,
  universe,
  onChanged,
  unit = "USD",
  solUsd = null,
}: {
  agentId: number;
  rows: LpRow[];
  universe: UniverseAsset[];
  onChanged?: () => void;
  /** Passed straight to the close dialog; see LpPositions. */
  unit?: "USD" | "SOL";
  solUsd?: number | null;
}) {
  const { t } = useLocale();
  const [closing, setClosing] = useState<ClosableLp | null>(null);

  if (rows.length === 0) {
    // NOT AN EARLY RETURN ANY MORE. An empty book is exactly when the reasons
    // below matter: the caller renders them after this component, and bailing
    // out here used to leave the page saying "no liquidity open" and nothing
    // else — the state this whole block exists to explain.
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
        <CloseLpModal
          agentId={agentId}
          position={closing}
          unit={unit}
          solUsd={solUsd}
          onClose={() => setClosing(null)}
          onClosed={() => onChanged?.()}
        />
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
      {/* IT WRAPS RATHER THAN TRUNCATES. The value cell's sub-line names what
          the position actually holds — "7,488 JEANPHIL + 0.4 SOL" — and in a
          column sized for a dollar figure that clipped to "7,488 JEANPHIL +…",
          which is the half that says nothing. The row is already tall because
          the range beside it draws a chart and three lines, so a second line
          here costs no height at all. `title` for the pathological pair that
          still overflows two lines. */}
      {sub ? (
        <span
          title={sub}
          className="tnum block pt-0.5 font-mono text-[11px] leading-[15px] opacity-70"
        >
          {sub}
        </span>
      ) : null}
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
          {leg.binStepBps ? (
            <span
              className="font-mono"
              // The width a bin actually covers. `bps / 100` is a percent of
              // price, and it is the figure that says whether a 20-bin range is
              // a tight collar or a fifth of the chart.
              title={t("lp_bin_step_title", {
                bps: leg.binStepBps,
                pct: Math.round((leg.binStepBps / 100) * 100) / 100,
              })}
            >
              {t("lp_bin_step", { bps: leg.binStepBps })}
            </span>
          ) : null}
        </span>
      </span>
    </span>
  );
}

/**
 * The range, drawn: its two edges as prices, the liquidity between them, and
 * where the pool's price sits against it.
 *
 * WHAT THIS REPLACED, AND WHY. The liquidity used to be 48 flex children with a
 * 1px gap. In a 150px cell that is a 2px bar, and at the heights a real curve
 * produces most of them rounded to the same hairline — so the shape came out as
 * a faint dotted diagonal that read as decoration rather than as data. Worse,
 * the price marker was drawn ONLY while in range, so the moment the answer
 * mattered most the picture lost its subject and left an unexplained red edge.
 *
 * Now: one filled area (two stacked, base over quote) that survives at any
 * width, a marker that is always drawn — clamped to the edge, with a caret
 * pointing out through it — and, when outside, how far outside in percent.
 * That last figure is the difference between "not earning" and "not earning,
 * and it is 2% away" — one of those is a shrug and the other is a decision.
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
  const dist = now.distribution;
  const [x, y] = pairOf(symbol);

  /*
   * WHERE THE PRICE SITS, MEASURED IN BINS.
   *
   * The bins are geometric and the served array is dense and gap-filled, so
   * index maps to position exactly linearly — no logarithm needed. The price
   * interpolation below is kept only for the fallback that has no bins to
   * count: it carries a half-bin ambiguity (an edge price against bin
   * centres) and it degenerates on a one-bin position, where `max / min` is a
   * single step and the ratio is meaningless.
   */
  const bins = dist?.bins ?? [];
  const byBin = bins.length > 0;
  const first = byBin ? bins[0].binId : 0;
  const last = byBin ? bins[bins.length - 1].binId : 0;
  const raw = byBin
    ? (now.activeBinId - first + 0.5) / bins.length
    : Math.log(prices.active / prices.min) / Math.log(prices.max / prices.min);
  const at = Math.min(1, Math.max(0, raw));
  const below = byBin ? now.activeBinId < first : raw < 0;
  const above = byBin ? now.activeBinId > last : raw > 1;
  const out = below || above;

  /*
   * THE FIGURES THE PICTURE DOES NOT PRINT.
   *
   * The chart answers "how much of each" by area; the exact amounts ride here
   * rather than taking a line in a 150px cell. Read off `holds`, which the
   * backend computed — the browser never does bin arithmetic.
   */
  const holds = now.holds;
  const heldUsd = holds.xUsd + holds.yUsd;
  const share = (part: number) =>
    heldUsd > 0 ? `${Math.round((part / heldUsd) * 100)}%` : "—";
  const hover = [
    t("lp_range_title", { price: quotePrice(prices.active) }),
    `${t("lp_close_holds")}: ${t("lp_holds_pair", {
      quote: y ?? "—",
      quoteQty: tokenQty(holds.y, holds.y ? holds.yUsd / holds.y : null),
      quotePct: share(holds.yUsd),
      base: x,
      baseQty: tokenQty(holds.x, holds.x ? holds.xUsd / holds.x : null),
      basePct: share(holds.xUsd),
    })}`,
    t("lp_bins", { min: leg.range.minBinId, max: leg.range.maxBinId }),
    // Out of range every bin sits on one side of the price, so the position is
    // entirely one token. "(100%)" and "(0%)" say it; a sentence says it better.
    out ? t("lp_all_in", { token: below ? x : (y ?? "—") }) : null,
  ]
    .filter(Boolean)
    .join("\n");

  /**
   * How far outside, as a percentage of the edge it left through.
   *
   * In PRICE, not in bins: "12% above" is a fact about the market, where "0.3
   * bins past the edge" is a fact about Meteora. Undefined while in range,
   * where the question does not arise.
   */
  const awayPct = above
    ? (prices.active / prices.max - 1) * 100
    : below
      ? (1 - prices.active / prices.min) * 100
      : null;

  return (
    // The hover lives on the picture, not on the whole cell — one tooltip,
    // and it appears where the reader is pointing when they ask.
    <span className="@container block">
      {/* The edges, each said to be an edge. Two bare numbers over a drawing
          left the reader to infer which was which and of what.

          The words go at the table's 150px column, where a label and a price
          cannot both fit and the price is the part worth keeping — a container
          query, because what matters is the width of THIS cell, not the page's:
          the same component is a narrow column on desktop and a full-width card
          on a phone, which is the exact case a media query gets backwards. */}
      <span className="tnum flex items-baseline justify-between gap-2 font-mono text-[11px] text-text-dim">
        {/* THE LEGEND IS POSITIONAL. Each symbol sits at the end where its
            colour actually appears — quote low, base high — and is tinted to
            match, so nothing needs a swatch or a second row.

            It leaves at the same width the "min"/"max" words do, and for the
            same reason: at 150px a symbol at each end pushes both prices into
            an ellipsis, and an axis truncated to "0.0₄1…" has stopped being an
            axis. Under that width the hover is the legend. */}
        <span className="truncate">
          {byBin && y ? (
            <span className="hidden max-w-[6ch] truncate pr-1 align-bottom text-[9.5px] text-accent @[200px]:inline-block">
              {y}
            </span>
          ) : null}
          <span className="hidden pr-1 font-ui text-text-muted @[200px]:inline">{t("lp_range_min")}</span>
          {quotePrice(prices.min)}
        </span>
        <span className="truncate text-right">
          <span className="hidden pr-1 font-ui text-text-muted @[200px]:inline">{t("lp_range_max")}</span>
          {quotePrice(prices.max)}
          {byBin ? (
            <span className="hidden max-w-[6ch] truncate pl-1 align-bottom text-[9.5px] text-warning @[200px]:inline-block">
              {x}
            </span>
          ) : null}
        </span>
      </span>

      {dist && byBin ? (
        <BinLiquidity
          dist={dist}
          at={at}
          out={out}
          below={below}
          above={above}
          title={hover}
          label={t("lp_liquidity_aria", { quote: y ?? "—", base: x })}
        />
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

      {/* The distance, on its own line and NOT in the alarm colour: the fact
          that it is out is the warning, and how far is the detail under it. */}
      {awayPct !== null ? (
        <span className="tnum block font-mono text-[11px] text-text-muted">
          {t(above ? "lp_above_by" : "lp_below_by", { pct: awayPct < 0.1 ? "<0.1%" : `${awayPct.toFixed(awayPct < 10 ? 1 : 0)}%` })}
        </span>
      ) : null}
    </span>
  );
}

/*
 * BAR WIDTHS, AND WHY THERE ARE TWO COLUMN COUNTS.
 *
 * The same component is a 150px table cell and a ~344px card on a phone, and
 * JavaScript cannot know which: there are dozens of these rows and measuring
 * each one would cost a ResizeObserver per position. So both column sets are
 * built and a container query picks — the mechanism already used for the
 * min/max labels above.
 *
 * The counts are derived from a floor of 4px of PAINTED bar, not chosen. With
 * a 1px gap, 48 columns in a 150px cell is 2.15px — which is exactly what
 * failed before. 24 columns is 5.29px. The `@[260px]` switch is where 48
 * columns first clear the floor (48 × 4 + 47 gaps ≈ 239px, rounded up).
 */
const NARROW_COLUMNS = 24;
const WIDE_COLUMNS = 48;

/**
 * The share of the plot a non-empty bin never drops below.
 *
 * The other half of the old failure: "at the heights a real curve produces
 * most of them rounded to the same hairline". A flat clamp would lose the
 * ordering between small bins, so this is a floor WITH headroom — the
 * remaining 88% stays linear in the real value, and a bin holding something
 * can never render as one holding nothing.
 */
const FLOOR = 0.12;

interface BinColumn {
  /** Base token, in quote units. */
  base: number;
  /** Quote token, in quote units — directly comparable to `base`. */
  quote: number;
  /** Height, per bin rather than per column. See below. */
  mean: number;
  empty: boolean;
}

/**
 * The bins, grouped into drawable columns.
 *
 * AN EVEN PARTITION, not `ceil`-sized slices: this always yields exactly
 * `min(target, n)` columns whose bin counts differ by at most one, where
 * slicing drops 30 bins to 15 columns and wastes half the width.
 *
 * HEIGHT IS THE MEAN PER BIN, the colour split is the sum. The even partition
 * leaves some columns one bin wider than their neighbours — at 105 bins in 24
 * columns the groups are 4 and 5 — and plotting the sum would draw that as a
 * 25% sawtooth that is not in the data. Where the groups are equal, which is
 * the ordinary case, mean and sum are proportional and nothing changes.
 *
 * The straddling column is left to fall where it falls. Because `x` and `y`
 * are summed independently, the one column containing the active bin comes out
 * mixed on its own — and the green area over the total is then exactly the
 * position's quote share. Forcing the active bin into a column of its own
 * would give that column a different bin width from its neighbours, which is a
 * lie about the axis.
 */
function binColumns(bins: LpDistribution["bins"], target: number): BinColumn[] {
  const n = bins.length;
  const count = Math.min(target, n);
  const out: BinColumn[] = [];
  for (let c = 0; c < count; c++) {
    const from = Math.floor((c * n) / count);
    const to = Math.floor(((c + 1) * n) / count);
    let base = 0;
    let quote = 0;
    for (let i = from; i < to; i++) {
      base += bins[i].x;
      quote += bins[i].y;
    }
    const held = Math.max(to - from, 1);
    out.push({ base, quote, mean: (base + quote) / held, empty: base + quote <= 0 });
  }
  return out;
}

/**
 * The liquidity across the range, one bar per bin — and which token each holds.
 *
 * WHAT THIS REPLACED, AND WHY IT IS BARS AGAIN. This was 48 flex children with
 * a 1px gap, which in a 150px cell is a 2px bar; at the heights a real curve
 * produces, most rounded to the same hairline and the shape read as a dotted
 * diagonal rather than as data. It was then rewritten as one filled SVG area,
 * which survived any width but threw away the per-bin reading entirely — and,
 * because both bands were filled `accent`, threw away the token split too. The
 * cell showed a solid green wedge and answered neither "what is in each bin"
 * nor "what am I holding right now".
 *
 * Bars are safe again because the two causes are addressed separately rather
 * than avoided: the column count is derived from a 4px bar floor (see
 * NARROW_COLUMNS) and the heights carry a floor with headroom (see FLOOR).
 *
 * THE COLOUR IS THE WHOLE POINT. A DLMM bin below the active bin holds only
 * the quote token and one above it holds only the base; only the active bin
 * holds both. So the position's token ratio is not something to compute and
 * print — it is the area split at the marker, and two hues make it readable at
 * a glance. Green is the quote side, amber the base: amber is the leg exposed
 * to price, which is why a position that falls out of range turns entirely
 * amber and says so without a word.
 */
function BinLiquidity({
  dist,
  at,
  out,
  below,
  above,
  title,
  label,
}: {
  dist: LpDistribution;
  /** 0..1 across the range, measured in BINS — see RangeBar. */
  at: number;
  out: boolean;
  below: boolean;
  above: boolean;
  /** The hover, carrying the figures the picture deliberately does not print. */
  title: string;
  /** The structural description, for a reader who cannot see the hues. */
  label: string;
}) {
  const { narrow, wide } = useMemo(
    () => ({
      narrow: binColumns(dist.bins, NARROW_COLUMNS),
      wide: binColumns(dist.bins, WIDE_COLUMNS),
    }),
    [dist],
  );

  const peak = Math.max(...wide.map((c) => c.mean), 0);
  if (peak <= 0) return null;

  const row = (cols: BinColumn[], show: string) => (
    <span className={`absolute inset-0 items-end gap-px ${show} ${out ? "opacity-45" : ""}`}>
      {cols.map((c, i) => {
        // DIM, DON'T HIDE. The backend gap-fills the range with zero bins
        // precisely so an empty stretch can be drawn rather than closed up.
        if (c.empty) {
          return <span key={i} className="h-px min-w-0 flex-1 bg-grid-strong" />;
        }
        const q = c.quote / (c.base + c.quote);
        return (
          <span
            key={i}
            className="flex min-w-0 flex-1 flex-col-reverse"
            style={{ height: `${(FLOOR + (1 - FLOOR) * (c.mean / peak)) * 100}%` }}
          >
            {/* Proportional grow rather than nested percentage heights, which
                resolve differently once the parent's own height is a
                percentage. Quote sits at the bottom of the column. */}
            {q > 0 ? <span style={{ flex: q, backgroundColor: "var(--color-accent)" }} /> : null}
            {q < 1 ? (
              <span style={{ flex: 1 - q, backgroundColor: "var(--color-warning)" }} />
            ) : null}
          </span>
        );
      })}
    </span>
  );

  return (
    <span
      className="relative mt-1.5 block h-7 @[260px]:h-12"
      role="img"
      aria-label={label}
      title={title}
    >
      {/* Both sets are absolutely positioned in one box, so swapping them
          cannot change the height and the overlays below stay in one
          coordinate space. */}
      {row(narrow, "flex @[260px]:hidden")}
      {row(wide, "hidden @[260px]:flex")}

      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-grid-strong" />

      {/* The edge price left through, and a caret pointing the way it went. The
          bar alone said "something happened here"; the caret says which way. */}
      {below ? <span className="absolute bottom-0 left-0 top-0 w-0.5 bg-negative" /> : null}
      {above ? <span className="absolute bottom-0 right-0 top-0 w-0.5 bg-negative" /> : null}
      {/* INSIDE the plot, against the edge, pointing out through it. Hung
          outside, it was the first thing a scrolling table clipped — and the
          arrow that says which way price went is not an ornament. */}
      {out ? (
        <span
          className={`pointer-events-none absolute top-1/2 size-0 -translate-y-1/2 border-y-[4px] border-y-transparent ${
            below ? "left-1 border-r-[5px] border-r-negative" : "right-1 border-l-[5px] border-l-negative"
          }`}
          aria-hidden
        />
      ) : null}

      {/* ALWAYS DRAWN, clamped when outside. A picture of a range with no price
          on it is the one thing this column exists to show. Kept a 1px line
          rather than a taller column: here height IS the data, so a raised
          active bar would be a false reading. */}
      <span
        className={`pointer-events-none absolute -top-0.5 bottom-0 w-px ${out ? "bg-negative" : "bg-text-primary"}`}
        style={{ left: `${at * 100}%` }}
      />
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
                {/* THE RECEIPTS, live only: what an owner checks on Solscan.
                    A paper position never touched the chain and shows none. */}
                {r.open_tx || r.close_tx ? (
                  <span className="flex flex-wrap gap-x-3 pt-1">
                    {r.open_tx ? <TxLink signature={r.open_tx} label={t("lp_tx_open")} size="caption" /> : null}
                    {r.close_tx ? <TxLink signature={r.close_tx} label={t("lp_tx_close")} size="caption" /> : null}
                  </span>
                ) : null}
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
