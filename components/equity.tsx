"use client";

import { useMemo, useState } from "react";

import { EquityCurve, equityScale } from "@/components/charts";
import { markAgent } from "@/lib/perf";
import { SEGMENT_ITEM, SEGMENT_OFF, SEGMENT_ON, SEGMENT_TRACK, Tick } from "@/components/kit";
import {
  type Benchmark,
  type AgentDetail,
  type EquityPoint,
  type EquitySeries,
  type UniverseAsset,
} from "@/lib/api";
import { useLocale, type Locale, type Translate, dateLocale } from "@/lib/i18n";

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
  const [range, setRange] = useState<Range>("all");
  const [scrub, setScrub] = useState<number | null>(null);
  const [focus, setFocus] = useState<Focus>(null);

  // The window's points, chosen before any early return so the hook order
  // holds; an empty series simply yields an empty window.
  const all = series?.points ?? [];
  const windowed = useMemo(() => pointsIn(all, range), [all, range]);
  const drawdown = useMemo(() => drawdownSpan(windowed.map((p) => p.equityUsd)), [windowed]);

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
    maxDrawdownPct: maxDd,
    hitRatePct: hitRate,
  } = mark;
  const stats = series.stats;
  const bench = series.benchmark && series.benchmark.returnPct !== null ? series.benchmark : null;

  /* THE HEADLINE FOLLOWS THE POINTER. Resting, it is the live mark against
     the capital. Over a window it is the change since the window opened. Under
     a scrub it is that cycle's reading, with the cycle and its time where the
     "against" line was — so the reader never has to look away from the number
     to know what they are looking at. */
  const first = windowed[0];
  const scrubbed = scrub === null ? null : windowed[Math.min(scrub, windowed.length - 1)];
  const headEquity = scrubbed ? scrubbed.equityUsd : range === "all" ? equity : windowed[windowed.length - 1].equityUsd;
  const base = range === "all" ? deployedCapital : first.equityUsd;
  const headPnl = headEquity - base;
  const headPct = base > 0 ? (headPnl / base) * 100 : 0;
  const headCaption = scrubbed
    ? t("equity_readout_head", { seq: scrubbed.tickSeq, when: when(scrubbed.at, locale) })
    : range === "all"
      ? t("equity_against", { capital: money(deployedCapital) })
      : t("equity_since", { when: when(first.at, locale) });

  const ranges: { key: Range; label: string; ok: boolean }[] = [
    { key: "24h", label: t("equity_range_24h"), ok: pointsIn(all, "24h").length >= 2 },
    { key: "7d", label: t("equity_range_7d"), ok: pointsIn(all, "7d").length >= 2 },
    { key: "all", label: t("equity_range_all"), ok: true },
  ];

  return (
    <div className="space-y-4">
      {/* THE HERO. One large number and the control that changes what it
          measures. Nothing else up here competes with it (rule 1). */}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="space-y-1.5">
          <p className="font-ui text-[12.5px] text-text-dim">
            {t(isPaper ? "equity_paper_equity" : "equity_equity")}
          </p>
          <Tick
            value={headEquity}
            className="tnum block font-mono text-[34px] leading-none tracking-[-0.02em] text-text-primary"
          >
            {money(headEquity)}
          </Tick>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <Tick
              value={headPnl}
              className={`tnum font-mono text-[13px] ${headPnl >= 0 ? "text-accent" : "text-negative"}`}
            >
              {signed(headPnl)} · {signedPct(headPct)}
            </Tick>
            <span className="font-ui text-[12px] text-text-dim">{headCaption}</span>
          </p>
        </div>

        {/* 24h · 7d · All. A window the record cannot fill stays drawn, dim and
            unpressable (rule 12), so the control is the same shape on day one. */}
        <div role="group" aria-label={t("equity_range_aria")} className={SEGMENT_TRACK}>
          {ranges.map((r) => (
            <button
              key={r.key}
              type="button"
              disabled={!r.ok}
              aria-pressed={range === r.key}
              onClick={() => {
                setRange(r.key);
                setScrub(null);
              }}
              className={`${SEGMENT_ITEM} h-7 px-3 text-[12px] disabled:cursor-default disabled:opacity-40 ${
                range === r.key ? SEGMENT_ON : SEGMENT_OFF
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* THE INSTRUMENT. One bordered object (rule 3): the figures across the
          top, the curve under them, one hairline between. The figures are not
          decoration on the chart — each one is a handle on it. Resting on
          drawdown shades the fall it measures; resting on the benchmark brings
          the dotted line forward; resting on unrealised marks the reading
          that moves. A qualifier ("3 of 10", the fee share of gross wins)
          rises under its figure on hover rather than crowding the strip at
          rest. Five across on a desktop — the book on the first row, what
          the return cost on the second — and two across on a phone, where
          the ten cells flow as one grid so no row is left with an orphan. */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div
          className="grid grid-cols-2 border-b border-grid md:grid-cols-5"
          onMouseLeave={() => setFocus(null)}
        >
            <Fig cell={0}
              label={t("equity_realised")}
              value={signed(realizedPnlUsd)}
              tone={toneOf(realizedPnlUsd)}
            />
            <Fig cell={1}
              label={t("equity_unrealised")}
              value={signed(unrealized)}
              tone={toneOf(unrealized)}
              // THE FIGURE THAT ACTUALLY MOVES. Marks refresh every ten
              // seconds; the wash is what makes that legible.
              watch={unrealized}
              focus="last"
              onFocus={setFocus}
            />
            <Fig cell={2} label={t("equity_deployed")} value={deployed === null ? null : money(deployed)} />
            <Fig cell={3}
              label={t("equity_max_drawdown")}
              value={maxDd === 0 ? null : `−${maxDd.toFixed(2)}%`}
              pending={maxDd === 0 ? t("equity_no_trades_yet") : undefined}
              note={
                drawdown && drawdown.pct > 0
                  ? t("equity_dd_span", {
                      from: when(windowed[drawdown.peak].at, locale),
                      to: when(windowed[drawdown.trough].at, locale),
                    })
                  : undefined
              }
              focus="drawdown"
              onFocus={setFocus}
            />
            <Fig cell={4}
              label={t("equity_hit_rate")}
              value={hitRate === null ? null : `${hitRate.toFixed(0)}%`}
              pending={hitRate === null ? t("equity_no_trades_yet") : undefined}
              note={
                closedPositions > 0
                  ? t("equity_hit_fraction", { won: winningPositions, closed: closedPositions })
                  : undefined
              }
            />
            <Fig cell={5}
              label={t("equity_sharpe")}
              value={stats?.sharpe == null ? null : ratio(stats.sharpe)}
              pending={stats?.sharpe == null ? t("equity_needs_days") : undefined}
            />
            <Fig cell={6}
              label={t("equity_sortino")}
              value={stats?.sortino == null ? null : ratio(stats.sortino)}
              pending={stats?.sortino == null ? t("equity_needs_days") : undefined}
            />
            <Fig cell={7}
              label={t("equity_profit_factor")}
              value={stats?.profitFactor == null ? null : stats.profitFactor.toFixed(2)}
              pending={
                stats?.profitFactor == null
                  ? !stats || stats.closed === 0
                    ? t("equity_no_trades_yet")
                    : t("equity_no_losses_yet")
                  : undefined
              }
            />
            <Fig cell={8}
              label={t("equity_fee_drag")}
              value={stats?.feeDragPct == null ? null : `${stats.feeDragPct.toFixed(2)}%`}
              pending={stats?.feeDragPct == null ? t("equity_no_trades_yet") : undefined}
              note={
                stats?.feesVsGrossPct == null
                  ? undefined
                  : t("equity_fees_of_gross", { pct: stats.feesVsGrossPct.toFixed(0) })
              }
            />
            <Fig cell={9}
              label={t("equity_vs_benchmark", { symbol: bench?.symbol ?? series.benchmark?.symbol ?? "SOL" })}
              value={bench ? signedPct(returnPct - bench.returnPct!) : null}
              tone={bench ? toneOf(returnPct - bench.returnPct!) : "neutral"}
              pending={bench ? undefined : t("equity_needs_days")}
              note={bench ? t("equity_benchmark_return", { pct: signedPct(bench.returnPct!) }) : undefined}
              focus={bench ? "benchmark" : undefined}
              onFocus={setFocus}
            />
        </div>

        <div className="px-5 pt-5 pb-3">
          <ReadableCurve
            points={windowed}
            baseline={base}
            overlay={benchmarkOverlay(windowed, series.benchmark ?? null)}
            height={220}
            focus={focus}
            drawdown={drawdown}
            onScrub={setScrub}
          />
        </div>
        <div className="flex items-center justify-between px-5 pb-4 font-ui text-[11.5px] text-text-muted">
          <span>{t("equity_cycle_n", { seq: windowed[0].tickSeq })}</span>
          {series.benchmark ? (
            <span className={`transition-colors ${focus === "benchmark" ? "text-text-primary" : ""}`}>
              {t("equity_dotted_line", { symbol: series.benchmark.symbol })}
            </span>
          ) : null}
          <span>{t("equity_cycle_n", { seq: windowed[windowed.length - 1].tickSeq })}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- window -- */

type Range = "24h" | "7d" | "all";

/** The readings inside the window; all of them for "all". */
function pointsIn(points: readonly EquityPoint[], range: Range): EquityPoint[] {
  if (range === "all") return [...points];
  const since = Date.now() - (range === "24h" ? 24 : 24 * 7) * 3_600_000;
  const inside = points.filter((p) => Date.parse(p.at) >= since);
  // Carry the reading just before the window in, so the line has a start
  // and "since" measures from a cycle that actually preceded the window.
  const before = points.findIndex((p) => Date.parse(p.at) >= since);
  return before > 0 ? [points[before - 1], ...inside] : inside;
}

/** Peak and trough of the deepest fall, as indices into the values. */
function drawdownSpan(values: readonly number[]): { peak: number; trough: number; pct: number } | null {
  if (values.length < 2) return null;
  let peak = 0;
  let best = { peak: 0, trough: 0, pct: 0 };
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[peak]) peak = i;
    const pct = values[peak] > 0 ? ((values[peak] - values[i]) / values[peak]) * 100 : 0;
    if (pct > best.pct) best = { peak, trough: i, pct };
  }
  return best.pct > 0 ? best : null;
}

/* ----------------------------------------------------------------- strip -- */

/** What a figure under the pointer asks the chart to show. */
type Focus = "drawdown" | "benchmark" | "last" | null;

/**
 * One figure in the strip: label, value, and a qualifier that rises on hover.
 *
 * A `button` when it has something to show on the chart, so it is reachable
 * by keyboard and announces its pressed state; a plain cell otherwise. Every
 * cell reserves the qualifier's line, so revealing one never moves the row.
 * A value the record cannot support yet is `null`, and `pending` takes its
 * place in the dim tone: the cell keeps its place and says why (rule 12).
 */
function Fig({
  cell,
  label,
  value,
  note,
  pending,
  tone = "neutral",
  watch,
  focus,
  onFocus,
}: {
  /** Position in the strip, 0–9: five across on wide screens, two on narrow. */
  cell: number;
  label: string;
  value: string | null;
  note?: string;
  pending?: string;
  tone?: "accent" | "negative" | "neutral";
  watch?: number | null;
  focus?: Exclude<Focus, null>;
  onFocus?: (f: Focus) => void;
}) {
  const interactive = focus !== undefined && value !== null;
  const inner = (
    <>
      <span className="block truncate font-ui text-[11.5px] text-text-dim transition-colors group-hover/fig:text-text-secondary">
        {label}
      </span>
      {value === null ? (
        <span className="block font-ui text-[12px] leading-[18px] text-text-dim">{pending ?? "—"}</span>
      ) : (
        <Tick
          value={watch}
          className={`tnum block font-mono text-[15px] leading-[18px] whitespace-nowrap ${
            tone === "accent"
              ? "text-accent"
              : tone === "negative"
                ? "text-negative"
                : "text-text-primary"
          }`}
        >
          {value}
        </Tick>
      )}
      <span
        aria-hidden={!note}
        className="tnum block truncate font-mono text-[11px] leading-[14px] text-text-muted opacity-0 transition-[opacity,transform] duration-150 translate-y-0.5 group-hover/fig:opacity-100 group-hover/fig:translate-y-0 group-focus-visible/fig:opacity-100 group-focus-visible/fig:translate-y-0 motion-reduce:transition-none"
      >
        {value !== null && note ? note : "\u00a0"}
      </span>
    </>
  );
  // Hairlines between cells, never around them: a left edge on every cell
  // that is not first in its row, a top edge on every row but the first.
  // Two columns on a phone, five on a desktop, so the rule is computed for
  // both and the wide one overrides.
  const edges = [
    cell % 2 === 1 ? "border-l" : "",
    cell >= 2 ? "border-t" : "",
    cell % 5 === 0 ? "md:border-l-0" : "md:border-l",
    cell >= 5 ? "md:border-t" : "md:border-t-0",
  ].join(" ");
  const cls = `group/fig min-w-0 space-y-1.5 border-grid px-4 pt-3.5 pb-2.5 text-left transition-colors duration-150 hover:bg-surface-2 motion-reduce:transition-none ${edges}`;
  if (!interactive) return <div className={cls}>{inner}</div>;
  return (
    <button
      type="button"
      className={`${cls} outline-none focus-visible:bg-surface-2`}
      onMouseEnter={() => onFocus?.(focus!)}
      onFocus={() => onFocus?.(focus!)}
      onBlur={() => onFocus?.(null)}
    >
      {inner}
    </button>
  );
}

/* ------------------------------------------------------------- the curve -- */

/**
 * The curve, scrubbed and annotated.
 *
 * SCRUBBING REPORTS UPWARD. The pointer's cycle is handed to the panel, which
 * puts that reading in the headline — the number the eye is already on —
 * rather than in a card floating over the line. What stays on the chart is
 * the crosshair and the marker, which say WHERE without repeating WHAT.
 *
 * Snapping is to the NEAREST READING, never to a position along the line: the
 * headline always names a cycle that happened and a figure the desk recorded.
 *
 * The annotations are HTML over the SVG rather than drawn inside it. The
 * viewBox is stretched with `preserveAspectRatio="none"`, so anything in SVG
 * units stretches with it; percentages off the same scale the line was built
 * from land in the same place without the distortion.
 */
function ReadableCurve({
  points,
  baseline,
  overlay,
  height,
  focus,
  drawdown,
  onScrub,
}: {
  points: EquityPoint[];
  baseline: number;
  overlay?: number[];
  height: number;
  focus: Focus;
  drawdown: { peak: number; trough: number; pct: number } | null;
  onScrub: (i: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const values = points.map((p) => p.equityUsd);
  // The same scale the curve draws with, overlay included, or the marker
  // would sit off the line whenever the benchmark widened the range.
  const { W, H, x, y } = equityScale(values, baseline, overlay ?? []);
  const px = (i: number) => ((values.length === 1 ? W / 2 : x(i)) / W) * 100;
  const py = (v: number) => (y(v) / H) * 100;

  const set = (i: number | null) => {
    setHover(i);
    onScrub(i);
  };
  const track = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const frac = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    set(Math.round(frac * (values.length - 1)));
  };

  const i = hover === null ? null : Math.min(hover, values.length - 1);
  const up = values[values.length - 1] >= baseline;
  const ring = up ? "var(--color-accent)" : "var(--color-negative)";
  const last = values.length - 1;

  return (
    <div
      className="relative"
      onMouseMove={(e) => track(e.clientX, e.currentTarget)}
      onMouseLeave={() => set(null)}
      onTouchStart={(e) => track(e.touches[0].clientX, e.currentTarget)}
      onTouchMove={(e) => track(e.touches[0].clientX, e.currentTarget)}
      onTouchEnd={() => set(null)}
    >
      <EquityCurve
        values={values}
        baseline={baseline}
        overlay={overlay}
        height={height}
        overlayStrong={focus === "benchmark"}
      />

      {/* The deepest fall, shaded from its peak to its trough while the
          reader is on the drawdown figure. */}
      {focus === "drawdown" && drawdown ? (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 bg-negative/10 transition-opacity"
            style={{ left: `${px(drawdown.peak)}%`, width: `${px(drawdown.trough) - px(drawdown.peak)}%` }}
          />
          {[drawdown.peak, drawdown.trough].map((k) => (
            <Marker key={k} left={px(k)} top={py(values[k])} ring="var(--color-negative)" />
          ))}
        </>
      ) : null}

      {/* The live reading, marked while the reader is on unrealised. */}
      {focus === "last" ? <Marker left={px(last)} top={py(values[last])} ring={ring} pulse /> : null}

      {i !== null ? (
        <>
          {/* Crosshair and marker. pointer-events-none throughout: the pointer
              must keep reaching the container. */}
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-grid-strong"
            style={{ left: `${px(i)}%` }}
          />
          <Marker left={px(i)} top={py(values[i])} ring={ring} />
        </>
      ) : null}
    </div>
  );
}

function Marker({ left, top, ring, pulse = false }: { left: number; top: number; ring: string; pulse?: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-panel ${
        pulse ? "trail-pulse" : ""
      }`}
      style={{ left: `${left}%`, top: `${top}%`, boxShadow: `0 0 0 2px ${ring}` }}
    />
  );
}

/**
 * The benchmark, one value per equity point.
 *
 * The server sends it per DAY; the curve is per CYCLE. Each point takes its
 * day's benchmark value, carried forward across days the benchmark has none,
 * so the two lines share an x-axis. Undefined when there is no benchmark or
 * no overlap, which draws nothing rather than a misaligned line.
 */
export function benchmarkOverlay(
  points: readonly EquityPoint[],
  benchmark: Benchmark | null,
): number[] | undefined {
  if (!benchmark || benchmark.points.length === 0) return undefined;
  const byDay = new Map(benchmark.points.map((p) => [p.day, p.equityUsd]));
  const days = [...byDay.keys()].sort();
  const out: number[] = [];
  let last: number | null = null;
  for (const p of points) {
    const day = new Date(p.at).toISOString().slice(0, 10);
    const exact = byDay.get(day);
    if (exact !== undefined) last = exact;
    else if (last === null) {
      // Before the first benchmark day: the nearest earlier day, if any.
      const prior = days.filter((d) => d < day).pop();
      if (prior !== undefined) last = byDay.get(prior)!;
    }
    if (last === null) return undefined;
    out.push(last);
  }
  return out;
}

function when(at: string, locale: Locale): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "—";
  // The reader's chosen language rather than the browser's regional setting:
  // this sits inside a card of translated labels, and an English month in the
  // middle of it reads as a rendering failure rather than as a preference.
  return d.toLocaleString(dateLocale(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A ratio with a real minus, so it reads like every other signed figure. */
function ratio(n: number): string {
  return n < 0 ? `−${Math.abs(n).toFixed(2)}` : n.toFixed(2);
}

/* ---------------------------------------------------------------- helpers -- */



function toneOf(n: number): "accent" | "negative" | "neutral" {
  return n > 0 ? "accent" : n < 0 ? "negative" : "neutral";
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
