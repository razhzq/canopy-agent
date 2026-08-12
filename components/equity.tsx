"use client";

import { useState, type CSSProperties } from "react";

import { EquityCurve, equityScale } from "@/components/charts";
import { markOpenBook, pnlSinceDeployUsd } from "@/lib/perf";
import {
  num,
  type AgentDetail,
  type EquityPoint,
  type EquitySeries,
  type UniverseAsset,
} from "@/lib/api";

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
 * Return cell, so a self-fetching panel would ask the API for the same rows
 * twice on one screen. There was a fetching wrapper here for the old Performance
 * tab; that tab is gone and so is the wrapper.
 *
 * `null` is a real input, not a defensive check: Overview fetches with
 * allSettled so one failed request cannot blank the whole agent, which means it
 * can legitimately hand this a missing series. That reads as a note here rather
 * than as an empty frame that looks like a curve which failed to draw.
 */
export function EquityView({
  series,
  positions,
  universe,
}: {
  series: EquitySeries | null;
  /** The open lots, so unrealised is marked against the same prices the
   *  positions table uses rather than against the last cycle's snapshot. */
  positions: AgentDetail["positions"];
  universe: UniverseAsset[];
}) {
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
  const last = points[points.length - 1];
  // A series with no capital figure is measured from its first reading, which
  // is what was deployed — the desk records equity before it acts.
  const deployedCapital = capitalUsd || points[0].equityUsd;
  const drawdown = maxDrawdownPct(values);

  // Unrealised is what the open book is carrying: everything not yet booked.
  // Marked HERE, against the same prices the positions table below uses, so
  // the two cannot disagree. See markOpenBook for why it is not read off the
  // curve any more.
  const book = markOpenBook(positions, universe);
  const marked = book.unpriced.length === 0;

  // The snapshot figure, still the answer whenever a holding cannot be priced:
  // half a book marked live is worse than a whole one marked one cycle late.
  const snapshotPnl = pnlSinceDeployUsd(series) ?? 0;

  const unrealized = marked ? book.unrealizedPnlUsd : snapshotPnl - realizedPnlUsd;
  // Realised plus unrealised IS the total — the stat rail has to add up, and on
  // the snapshot path this reduces to exactly what the curve's last point says.
  const pnl = marked ? realizedPnlUsd + unrealized : snapshotPnl;
  const equity = deployedCapital + pnl;
  const returnPct = deployedCapital ? (pnl / deployedCapital) * 100 : 0;
  // Same book, same marks: what the open positions are worth now.
  const deployed = marked ? book.marketValueUsd : deployedUsd(last);
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
            {signed(pnl)} · {signedPct(returnPct)} against {money(deployedCapital)}
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
          <Stat label="Realised" value={signed(realizedPnlUsd)} tone={toneOf(realizedPnlUsd)} />
          <Stat
            label="Unrealised"
            value={signed(unrealized)}
            tone={toneOf(unrealized)}
            // Silent when it is marked live, because then it reconciles with
            // the positions table and needs no explaining. Only the degraded
            // case has something to say.
            note={marked ? undefined : `at cycle ${last.tickSeq}`}
          />
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
        <ReadableCurve points={points} capitalUsd={capitalUsd} height={220} />
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

/* ------------------------------------------------------------- hover read -- */

/**
 * The curve with a per-cycle readout under the pointer.
 *
 * The curve alone answers "how did it go"; a reader looking at a step in it
 * immediately wants "which cycle was that, and what was the account worth" —
 * and the only way to answer used to be counting cycles along the axis labels.
 *
 * The marker and the card are HTML, positioned over the SVG rather than drawn
 * inside it. The chart's viewBox is stretched with `preserveAspectRatio="none"`,
 * so anything drawn in SVG units gets stretched with it — a circle becomes an
 * ellipse and text becomes wider than it is tall. Percentages off the same
 * scale the line was built from land in exactly the same place without
 * inheriting the distortion.
 *
 * Snapping is to the NEAREST READING, never to a position along the line: the
 * card always names a cycle that actually happened and a figure the desk
 * actually recorded.
 */
function ReadableCurve({
  points,
  capitalUsd,
  height,
}: {
  points: EquityPoint[];
  capitalUsd: number;
  height: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const values = points.map((p) => p.equityUsd);
  const { W, H, x, y } = equityScale(values, capitalUsd);

  const track = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const frac = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    setHover(Math.round(frac * (values.length - 1)));
  };

  const i = hover === null ? null : Math.min(hover, values.length - 1);
  const point = i === null ? null : points[i];
  // A single reading is drawn as a flat line across the whole panel, so its
  // marker belongs at the middle of that line rather than at x(0).
  const leftPct = i === null ? 0 : (values.length === 1 ? W / 2 : x(i)) / W;
  const topPct = i === null ? 0 : y(values[i]) / H;

  return (
    <div
      className="relative"
      onMouseMove={(e) => track(e.clientX, e.currentTarget)}
      onMouseLeave={() => setHover(null)}
      onTouchStart={(e) => track(e.touches[0].clientX, e.currentTarget)}
      onTouchMove={(e) => track(e.touches[0].clientX, e.currentTarget)}
      onTouchEnd={() => setHover(null)}
    >
      <EquityCurve values={values} baseline={capitalUsd} height={height} />

      {point ? (
        <>
          {/* Crosshair and marker. pointer-events-none throughout: the pointer
              must keep reaching the container, or moving onto the card the
              pointer just summoned would dismiss it. */}
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-grid-strong"
            style={{ left: `${leftPct * 100}%` }}
          />
          <div
            className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-panel"
            style={{
              left: `${leftPct * 100}%`,
              top: `${topPct * 100}%`,
              // A ring in the line's own colour, which the chart tints by where
              // the series ended.
              boxShadow: `0 0 0 2px ${
                values[values.length - 1] >= capitalUsd
                  ? "var(--color-accent)"
                  : "var(--color-negative)"
              }`,
            }}
          />
          <Readout
            point={point}
            capitalUsd={capitalUsd}
            /* Flipped near the edges so the card never hangs outside the panel. */
            align={leftPct > 0.72 ? "right" : leftPct < 0.28 ? "left" : "center"}
            /* And dropped below the point when there is no room above it. */
            below={topPct < 0.34}
            style={{ left: `${leftPct * 100}%`, top: `${topPct * 100}%` }}
          />
        </>
      ) : null}
    </div>
  );
}

/** The card itself: which cycle, when, what it was worth, and against capital. */
function Readout({
  point,
  capitalUsd,
  align,
  below,
  style,
}: {
  point: EquityPoint;
  capitalUsd: number;
  align: "left" | "center" | "right";
  below: boolean;
  style: CSSProperties;
}) {
  const pnl = point.equityUsd - capitalUsd;
  const pct = capitalUsd > 0 ? (pnl / capitalUsd) * 100 : 0;
  const cash = num(point.cashUsd);

  return (
    <div
      className="pointer-events-none absolute z-10 whitespace-nowrap border border-grid-strong bg-panel px-3 py-2 shadow-lg"
      style={{
        ...style,
        transform: `translate(${
          align === "center" ? "-50%" : align === "right" ? "calc(-100% - 10px)" : "10px"
        }, ${below ? "12px" : "calc(-100% - 12px)"})`,
      }}
    >
      <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
        Cycle {point.tickSeq} · {when(point.at)}
      </p>
      <p className="tnum pt-1 font-mono text-[15px] leading-none text-text-primary">
        {money(point.equityUsd)}
      </p>
      <p
        className={`tnum pt-1 font-mono text-[11px] ${
          pnl >= 0 ? "text-accent" : "text-negative"
        }`}
      >
        {signed(pnl)} · {signedPct(pct)}
      </p>
      {cash === null ? null : (
        <p className="tnum pt-1 font-mono text-[10px] text-text-muted">{money(cash)} cash</p>
      )}
    </div>
  );
}

/**
 * The reading's timestamp, short.
 *
 * Locale-formatted on the client only, which this is — the panel is behind a
 * signed-in fetch, so there is no server render of this string to disagree with.
 */
function when(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
