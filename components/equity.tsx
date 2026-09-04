"use client";

import { useState, type CSSProperties } from "react";

import { EquityCurve, equityScale } from "@/components/charts";
import { markAgent } from "@/lib/perf";
import { Tick } from "@/components/kit";
import {
  num,
  type AgentDetail,
  type EquityPoint,
  type EquitySeries,
  type UniverseAsset,
} from "@/lib/api";
import { useLocale, type Locale, type Translate } from "@/lib/i18n";

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
  const { t, locale } = useLocale();

  if (series === null) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-5 sm:px-8 py-10 text-center">
        <p className="font-ui text-[15px] font-medium text-text-primary">
          {t("equity_unavailable_title")}
        </p>
        <p className="mx-auto max-w-[46ch] pt-2 font-ui text-[13px] leading-relaxed text-text-secondary">
          {t("equity_unavailable_body")}
        </p>
      </div>
    );
  }

  const { points, capitalUsd, realizedPnlUsd, closedPositions, winningPositions, isPaper } =
    series;

  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-5 sm:px-8 py-10 text-center">
        <p className="font-ui text-[15px] font-medium text-text-primary">
          {t("equity_no_curve_title")}
        </p>
        <p className="mx-auto max-w-[46ch] pt-2 font-ui text-[13px] leading-relaxed text-text-secondary">
          {t("equity_no_curve_body")}
        </p>
      </div>
    );
  }

  // The figures come from lib/perf so the portfolio overview, which sums them
  // across every agent, cannot end up computing one agent differently from the
  // way this panel does. `markAgent` only returns null for an empty series,
  // which the guard above has already handled.
  const mark = markAgent(series, positions, universe)!;
  const {
    deployedCapitalUsd: deployedCapital,
    unrealizedPnlUsd: unrealized,
    pnlUsd: pnl,
    equityUsd: equity,
    returnPct,
    openBookUsd: deployed,
    maxDrawdownPct: drawdown,
    hitRatePct: hitRate,
  } = mark;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="space-y-1.5">
          <p className="font-ui text-[12.5px] text-text-dim">
            {t(isPaper ? "equity_paper_equity" : "equity_equity")}
          </p>
          {/* Equity is capital plus realised plus unrealised, so it moves on
              every mark exactly as the unrealised stat does. Flashing one and
              not the other would read as the two disagreeing. */}
          <Tick
            value={equity}
            className="tnum block font-mono text-[34px] leading-none tracking-[-0.02em] text-text-primary"
          >
            {money(equity)}
          </Tick>
          <Tick
            value={pnl}
            className={`tnum block font-mono text-[13px] ${
              pnl >= 0 ? "text-accent" : "text-negative"
            }`}
          >
            {t("equity_against_capital", {
              pnl: signed(pnl),
              pct: signedPct(returnPct),
              capital: money(deployedCapital),
            })}
          </Tick>
        </div>

        <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
          <Stat
            label={t("equity_realised")}
            value={signed(realizedPnlUsd)}
            tone={toneOf(realizedPnlUsd)}
          />
          <Stat
            label={t("equity_unrealised")}
            value={signed(unrealized)}
            tone={toneOf(unrealized)}
            // THE FIGURE THAT ACTUALLY MOVES. Marks refresh every ten seconds,
            // so this is the one stat on the panel that changes while someone
            // is looking at it — and the wash is what makes a change legible
            // instead of a number quietly becoming a different number.
            watch={unrealized}
          />
          <Stat
            label={t("equity_max_drawdown")}
            value={drawdown === 0 ? "—" : `−${drawdown.toFixed(2)}%`}
            tone={drawdown > 0 ? "negative" : "neutral"}
          />
          <Stat
            label={t("equity_hit_rate")}
            value={hitRate === null ? "—" : `${hitRate.toFixed(0)}%`}
            note={closedPositions > 0 ? `${winningPositions}/${closedPositions}` : undefined}
          />
          <Stat label={t("equity_deployed")} value={deployed === null ? "—" : money(deployed)} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <ReadableCurve
          points={points}
          capitalUsd={capitalUsd}
          height={220}
          t={t}
          locale={locale}
        />
        <div className="flex items-center justify-between pt-3 font-ui text-[11.5px] text-text-muted">
          <span>{t("equity_cycle_n", { seq: points[0].tickSeq })}</span>
          <span>{t("equity_cycle_n", { seq: points[points.length - 1].tickSeq })}</span>
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
  t,
  locale,
}: {
  points: EquityPoint[];
  capitalUsd: number;
  height: number;
  // Passed down rather than re-read from context: the readout is a leaf of the
  // panel that already holds both, and threading them keeps this hook-free.
  t: Translate;
  locale: Locale;
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
            t={t}
            locale={locale}
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
  t,
  locale,
}: {
  point: EquityPoint;
  capitalUsd: number;
  align: "left" | "center" | "right";
  below: boolean;
  style: CSSProperties;
  t: Translate;
  locale: Locale;
}) {
  const pnl = point.equityUsd - capitalUsd;
  const pct = capitalUsd > 0 ? (pnl / capitalUsd) * 100 : 0;
  const cash = num(point.cashUsd);

  return (
    <div
      className="pointer-events-none absolute z-10 whitespace-nowrap rounded-xl border border-border bg-surface px-3 py-2.5 shadow-[0_20px_44px_-16px_rgba(0,0,0,0.9)]"
      style={{
        ...style,
        transform: `translate(${
          align === "center" ? "-50%" : align === "right" ? "calc(-100% - 10px)" : "10px"
        }, ${below ? "12px" : "calc(-100% - 12px)"})`,
      }}
    >
      <p className="font-ui text-[11.5px] text-text-muted">
        {t("equity_readout_head", { seq: point.tickSeq, when: when(point.at, locale) })}
      </p>
      <p className="tnum pt-1 font-mono text-[16px] leading-none text-text-primary">
        {money(point.equityUsd)}
      </p>
      <p
        className={`tnum pt-1 font-mono text-[11px] ${
          pnl >= 0 ? "text-accent" : "text-negative"
        }`}
      >
        {t("equity_readout_pnl", { pnl: signed(pnl), pct: signedPct(pct) })}
      </p>
      {cash === null ? null : (
        <p className="tnum pt-1 font-mono text-[11px] text-text-muted">
          {t("equity_readout_cash", { amount: money(cash) })}
        </p>
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
function when(at: string, locale: Locale): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "—";
  // The reader's chosen language rather than the browser's regional setting:
  // this sits inside a card of translated labels, and an English month in the
  // middle of it reads as a rendering failure rather than as a preference.
  return d.toLocaleString(locale === "zh" ? "zh-CN" : "en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------------------------------------------------------------- helpers -- */



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
  watch,
}: {
  label: string;
  value: string;
  /** Small dim qualifier, e.g. the fraction behind a percentage. */
  note?: string;
  tone?: "accent" | "negative" | "neutral";
  /**
   * The NUMBER behind `value`, when this figure moves on its own.
   *
   * Given, the stat washes green or red for a moment each time it changes. Not
   * given, it never flashes — which is right for the ones that only move when
   * the agent trades, where a wash would be claiming an event that a hit rate
   * or a drawdown does not have.
   *
   * The number rather than the string, because a formatted figure rounds: two
   * different marks both rendering "−$32.91" are not a tick, and comparing text
   * would miss a real move that happened to round the same way.
   */
  watch?: number | null;
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-ui text-[11.5px] text-text-dim">{label}</p>
      <Tick
        value={watch}
        className={`tnum block font-mono text-[17px] leading-none whitespace-nowrap ${
          tone === "accent"
            ? "text-accent"
            : tone === "negative"
              ? "text-negative"
              : "text-text-primary"
        }`}
      >
        {value}
        {note ? (
          <span className="pl-1.5 font-ui text-[11px] text-text-muted">
            {note}
          </span>
        ) : null}
      </Tick>
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
