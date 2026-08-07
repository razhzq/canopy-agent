"use client";

import { EquityCurve } from "@/components/charts";
import { num, type EquityPoint, type EquitySeries } from "@/lib/api";

/**
 * The performance panel on the agent page: equity curve plus the figures a
 * portfolio page is expected to carry.
 *
 * Every point comes from the desk's decision row, which records equity at the
 * top of each cycle before the agent acts — so the curve reconciles line by
 * line against the transcript below it. Nothing here is modelled or smoothed.
 *
 * It renders for paper agents exactly as it does for funded ones. A paper
 * record is the thing being judged, and giving it a lesser presentation would
 * be a strange way to ask someone to trust it.
 *
 * IT DOES NOT FETCH
 *
 * The only caller — the agent's Overview — already loads this series for its
 * Return · 30d cell, so a self-fetching panel would ask the API for the same
 * rows twice on one screen. There was a fetching wrapper here for the old
 * Performance tab; that tab is gone and so is the wrapper.
 *
 * `null` is a real input, not a defensive check: Overview fetches with
 * allSettled so one failed request cannot blank the whole agent, which means it
 * can legitimately hand this a missing series. That reads as a note here rather
 * than as an empty frame that looks like a curve which failed to draw.
 */
export function EquityView({ series }: { series: EquitySeries | null }) {
  if (series === null) {
    return (
      <div className="border border-grid bg-panel px-8 py-10 text-center">
        <p className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
          Performance unavailable
        </p>
        <p className="mx-auto max-w-[46ch] pt-2 font-ui text-[13px] leading-relaxed text-text-secondary">
          The equity readings did not load. Everything else on this page is current — reload to
          try again.
        </p>
      </div>
    );
  }

  const { points, capitalUsd, realizedPnlUsd, closedPositions, winningPositions, isPaper } =
    series;

  if (points.length === 0) {
    return (
      <div className="border border-grid bg-panel px-8 py-10 text-center">
        <p className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
          No curve yet
        </p>
        <p className="mx-auto max-w-[46ch] pt-2 font-ui text-[13px] leading-relaxed text-text-secondary">
          The curve plots one point per completed cycle. The first appears as soon as the agent
          has run once.
        </p>
      </div>
    );
  }

  const values = points.map((p) => p.equityUsd);
  const equity = values[values.length - 1];
  const pnl = equity - capitalUsd;
  const returnPct = capitalUsd > 0 ? (pnl / capitalUsd) * 100 : 0;
  const drawdown = maxDrawdownPct(values);
  const deployed = deployedUsd(points[points.length - 1]);
  // Unrealised is what the open book is carrying: everything not yet booked.
  const unrealized = pnl - realizedPnlUsd;
  const hitRate = closedPositions > 0 ? (winningPositions / closedPositions) * 100 : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] tracking-[0.12em] text-text-dim uppercase">
            {isPaper ? "Paper equity" : "Equity"}
          </p>
          <p className="tnum font-mono text-[32px] leading-none text-text-primary">
            {money(equity)}
          </p>
          <p
            className={`tnum font-mono text-[12.5px] ${
              pnl >= 0 ? "text-accent" : "text-negative"
            }`}
          >
            {signed(pnl)} · {signedPct(returnPct)} against {money(capitalUsd)}
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
          <Stat label="Realised" value={signed(realizedPnlUsd)} tone={toneOf(realizedPnlUsd)} />
          <Stat label="Unrealised" value={signed(unrealized)} tone={toneOf(unrealized)} />
          <Stat
            label="Max drawdown"
            value={drawdown === 0 ? "—" : `−${drawdown.toFixed(2)}%`}
            tone={drawdown > 0 ? "negative" : "neutral"}
          />
          <Stat
            label="Hit rate"
            value={hitRate === null ? "—" : `${hitRate.toFixed(0)}%`}
            note={closedPositions > 0 ? `${winningPositions}/${closedPositions}` : undefined}
          />
          <Stat label="Deployed" value={deployed === null ? "—" : money(deployed)} />
        </div>
      </div>

      <div className="border border-grid p-4">
        <EquityCurve values={values} baseline={capitalUsd} height={220} />
        <div className="flex items-center justify-between pt-3 font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
          <span>Cycle {points[0].tickSeq}</span>
          <span className="text-text-muted">
            {points.length} {points.length === 1 ? "cycle" : "cycles"} · dashed line is starting
            capital
          </span>
          <span>Cycle {points[points.length - 1].tickSeq}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- helpers -- */

/**
 * Worst peak-to-trough fall across the series, in percent.
 *
 * Measured against the running peak of the curve itself rather than against
 * the stored high-water mark: the stored mark is the breaker's state and can be
 * reset, while this is what the record actually shows.
 */
function maxDrawdownPct(values: number[]): number {
  let peak = values[0];
  let worst = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const fall = ((peak - v) / peak) * 100;
      if (fall > worst) worst = fall;
    }
  }
  return worst;
}

/** Capital minus uninvested cash. Null when the cycle recorded no cash figure. */
function deployedUsd(p: EquityPoint): number | null {
  // `=== null` missed an absent field, and `equity - undefined` is NaN, which
  // rendered as "$NaN" rather than as the unknown it actually is.
  const cash = num(p.cashUsd);
  const equity = num(p.equityUsd);
  if (cash === null || equity === null) return null;
  return Math.max(equity - cash, 0);
}

function toneOf(n: number): "accent" | "negative" | "neutral" {
  return n > 0 ? "accent" : n < 0 ? "negative" : "neutral";
}

/**
 * One figure in the stat rail.
 *
 * Every instance is exactly two lines — label, then value. `note` renders
 * INLINE after the value rather than on a third line: hit rate was the only
 * stat carrying a sub-line, which made its column taller than the rest and tore
 * the row's alignment apart.
 */
function Stat({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  /** Small dim qualifier, e.g. the fraction behind a percentage. */
  note?: string;
  tone?: "accent" | "negative" | "neutral";
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">{label}</p>
      <p
        className={`tnum font-mono text-[16px] leading-none whitespace-nowrap ${
          tone === "accent"
            ? "text-accent"
            : tone === "negative"
              ? "text-negative"
              : "text-text-primary"
        }`}
      >
        {value}
        {note ? (
          <span className="pl-1.5 font-mono text-[10px] tracking-[0.04em] text-text-muted">
            {note}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function signed(n: number): string {
  const s = `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return n < 0 ? `−${s}` : `+${s}`;
}

function signedPct(n: number): string {
  return `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(2)}%`;
}
