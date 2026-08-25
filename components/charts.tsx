import type { ReactNode } from "react";
import { NoReadings } from "@/components/noReadings";

/* ------------------------------------------------------------ equity ------ */

/**
 * The equity column chart. Bars share a baseline and are tinted from a darker
 * green at the left to full accent at the right, the way the design fades an
 * ageing series forward in time.
 */
export function EquityBars({
  values,
  height = 260,
  tone = "accent",
  /** Indices painted in the stress colour (the mandatory drawdown window). */
  stressRange,
}: {
  values: number[];
  height?: number;
  tone?: "accent" | "warning";
  stressRange?: [number, number];
}) {
  const max = Math.max(...values, 1);

  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {values.map((v, i) => {
        const stressed =
          stressRange && i >= stressRange[0] && i <= stressRange[1];
        const shade = 0.45 + 0.55 * (i / Math.max(values.length - 1, 1));
        return (
          <div
            key={i}
            className="min-w-0 flex-1"
            style={{
              height: `${Math.max((v / max) * 100, 1.5)}%`,
              backgroundColor: stressed
                ? "var(--color-negative)"
                : tone === "warning"
                  ? "var(--color-warning)"
                  : "var(--color-accent)",
              opacity: stressed ? 0.85 : shade,
            }}
          />
        );
      })}
    </div>
  );
}

/** Faint horizontal rules the equity chart sits on top of. */
export function ChartGrid({
  children,
  lines = 4,
  height,
}: {
  children: ReactNode;
  lines?: number;
  height: number;
}) {
  return (
    <div className="relative" style={{ height }}>
      <div className="absolute inset-0 flex flex-col justify-between">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-px w-full bg-grid" />
        ))}
      </div>
      <div className="relative h-full">{children}</div>
    </div>
  );
}

/* --------------------------------------------------------- drawdown ------- */

/** Red bars hanging beneath a dashed zero line. Values are negative percents. */
export function DrawdownBars({
  values,
  height = 90,
}: {
  values: number[];
  height?: number;
}) {
  const worst = Math.min(...values, -0.01);

  return (
    <div className="relative" style={{ height }}>
      <div className="absolute top-0 w-full border-t border-dashed border-negative/40" />
      <div className="flex items-start gap-[3px]" style={{ height }}>
        {values.map((v, i) => (
          <div
            key={i}
            className="min-w-0 flex-1 bg-negative/80"
            style={{ height: `${(v / worst) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- monthly --------- */

/** Bars growing up or down from a shared centre line. */
export function MonthlyReturns({
  values,
  labels,
  height = 120,
}: {
  values: number[];
  labels: string[];
  height?: number;
}) {
  const scale = Math.max(...values.map(Math.abs), 0.01);

  return (
    <div>
      <div className="flex items-center gap-[6px]" style={{ height }}>
        {values.map((v, i) => (
          <div
            key={i}
            className="flex min-w-0 flex-1 flex-col justify-center"
            style={{ height }}
          >
            <div className="flex h-1/2 items-end">
              {v > 0 ? (
                <div
                  className="w-full bg-accent"
                  style={{ height: `${(v / scale) * 100}%` }}
                />
              ) : null}
            </div>
            <div className="flex h-1/2 items-start">
              {v < 0 ? (
                <div
                  className="w-full bg-negative"
                  style={{ height: `${(Math.abs(v) / scale) * 100}%` }}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-[6px]">
        {labels.map((l, i) => (
          <span
            key={i}
            className="min-w-0 flex-1 text-center font-mono text-[10px] text-text-dim"
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ ticks ------- */

/**
 * The tick ruler used for every limit. Ticks left of the marker are lit, the
 * marker itself is a full-height accent bar and everything right of it is dim.
 * It is a readout, not an input — the design never shows a drag handle.
 */
export function TickScale({
  fraction,
  count = 60,
  tone = "accent",
}: {
  /** Marker position, 0…1. */
  fraction: number;
  count?: number;
  tone?: "accent" | "warning";
}) {
  const markerIndex = Math.round(fraction * (count - 1));
  const color =
    tone === "warning" ? "var(--color-warning)" : "var(--color-accent)";

  return (
    <div className="flex h-4 items-center justify-between">
      {Array.from({ length: count }).map((_, i) => {
        const isMarker = i === markerIndex;
        const major = i % 5 === 0;
        const lit = i < markerIndex;
        return (
          <div
            key={i}
            style={{
              width: 2,
              height: isMarker ? 16 : major ? 9 : 5,
              backgroundColor: isMarker || lit ? color : "var(--color-grid-strong)",
            }}
          />
        );
      })}
    </div>
  );
}

/** A labelled limit control: name, value, ruler, and its min/max endpoints. */
export function LimitRow({
  label,
  value,
  fraction,
  min,
  max,
}: {
  label: string;
  value: string;
  fraction: number;
  min: string;
  max: string;
}) {
  return (
    <div className="py-6">
      <div className="flex items-baseline justify-between pb-4">
        <span className="font-mono text-[11px] tracking-[0.08em] text-text-secondary uppercase">
          {label}
        </span>
        <span className="tnum font-mono text-[15px] text-text-primary">
          {value}
        </span>
      </div>
      <TickScale fraction={fraction} />
      <div className="flex justify-between pt-2.5 font-mono text-[10px] text-text-dim">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- sparkline ------- */

/** The 24-bar sparkline in each marketplace row. */
export function Sparkline({
  values,
  tone = "accent",
  width = 190,
  height = 30,
}: {
  values: number[];
  tone?: "accent" | "warning" | "muted";
  width?: number;
  height?: number;
}) {
  const max = Math.max(...values, 1);
  const color =
    tone === "warning"
      ? "var(--color-warning)"
      : tone === "muted"
        ? "var(--color-grid-strong)"
        : "var(--color-accent)";

  return (
    <div className="flex items-end gap-[2px]" style={{ width, height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="min-w-0 flex-1"
          style={{
            height: `${Math.max((v / max) * 100, 8)}%`,
            backgroundColor: color,
            opacity: tone === "muted" ? 1 : 0.55 + 0.45 * (i / values.length),
          }}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------- cycle histogram ---- */

export type CycleBar = { proposals: number; outcome: "executed" | "blocked" | "none" };

/** Bar per cycle, coloured by what the cycle settled on. */
export function CycleHistogram({
  bars,
  height = 70,
}: {
  bars: CycleBar[];
  height?: number;
}) {
  const max = Math.max(...bars.map((b) => b.proposals), 1);

  return (
    <div className="flex items-end gap-[6px]" style={{ height }}>
      {bars.map((b, i) => (
        <div
          key={i}
          className="min-w-0 flex-1"
          style={{
            height: b.outcome === "none" ? 6 : `${(b.proposals / max) * 100}%`,
            backgroundColor:
              b.outcome === "executed"
                ? "var(--color-accent)"
                : b.outcome === "blocked"
                  ? "var(--color-negative)"
                  : "var(--color-grid-strong)",
          }}
        />
      ))}
    </div>
  );
}

/* --------------------------------------------------------- utilisation ---- */

/** Compact 24-segment meter used in the LIMIT UTILISATION rail. */
export function SegmentMeter({
  fraction,
  segments = 24,
  tone = "accent",
}: {
  fraction: number;
  segments?: number;
  tone?: "accent" | "warning";
}) {
  const lit = Math.round(fraction * segments);
  const color =
    tone === "warning" ? "var(--color-warning)" : "var(--color-accent)";

  return (
    <div className="flex h-3 items-center justify-between">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === lit - 1 ? 3 : 4,
            height: i === lit - 1 ? 12 : 4,
            backgroundColor: i < lit ? color : "var(--color-grid-strong)",
          }}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------- hour histogram ----- */

/** "When it would have asked you", bucketed by UTC hour. */
export function HourHistogram({
  hours,
  height = 80,
}: {
  /** 24 entries; 0 means the agent never raised a proposal in that hour. */
  hours: { count: number; withinWindow: boolean }[];
  height?: number;
}) {
  const max = Math.max(...hours.map((h) => h.count), 1);

  return (
    <div>
      <div className="flex items-end gap-[10px]" style={{ height }}>
        {hours.map((h, i) => (
          <div
            key={i}
            className="min-w-0 flex-1"
            style={{
              height: h.count === 0 ? 5 : `${(h.count / max) * 100}%`,
              backgroundColor:
                h.count === 0
                  ? "var(--color-grid-strong)"
                  : h.withinWindow
                    ? "var(--color-accent)"
                    : "var(--color-warning)",
            }}
          />
        ))}
      </div>
      <div className="mt-3 flex gap-[10px]">
        {hours.map((_, i) => (
          <span
            key={i}
            className="min-w-0 flex-1 font-mono text-[10px] text-text-dim"
          >
            {i % 3 === 0 ? String(i).padStart(2, "0") : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ progress ---- */

/** Chunked day counter — 30 blocks, filled up to the current day. */
export function DayBlocks({
  total,
  done,
}: {
  total: number;
  done: number;
}) {
  return (
    <div className="flex gap-[6px]">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-2.5 min-w-0 flex-1"
          style={{
            backgroundColor:
              i < done ? "var(--color-accent)" : "var(--color-grid-strong)",
          }}
        />
      ))}
    </div>
  );
}

/** Earnings columns with month labels beneath. */
export function EarningsBars({
  values,
  labels,
  height = 170,
}: {
  values: number[];
  labels: string[];
  height?: number;
}) {
  const max = Math.max(...values, 1);

  return (
    <div>
      <div className="flex items-end gap-[10px]" style={{ height }}>
        {values.map((v, i) => (
          <div
            key={i}
            className="min-w-0 flex-1 bg-accent"
            style={{
              height: `${(v / max) * 100}%`,
              opacity: 0.35 + 0.65 * (i / Math.max(values.length - 1, 1)),
            }}
          />
        ))}
      </div>
      <div className="mt-4 flex gap-[10px]">
        {labels.map((l, i) => (
          <span
            key={i}
            className="min-w-0 flex-1 text-center font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase"
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- equity curve -- */

/** The viewBox the equity curve is drawn in. Stretched to the container width. */
const CURVE_W = 1000;
const CURVE_H = 300;

/**
 * Where a curve's values land inside the viewBox.
 *
 * Exported because the hover readout on the agent page has to place a crosshair
 * and a tooltip over the same geometry the line was drawn with. Recomputing the
 * scale there by hand is how a marker ends up a few pixels off the line it is
 * supposed to be sitting on.
 */
export function equityScale(values: number[], baseline?: number) {
  const all = baseline === undefined ? values : [...values, baseline];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  // A perfectly flat series has no range to scale into; give it one so the
  // line lands mid-panel instead of on an edge or dividing by zero.
  if (hi - lo < 1e-9) {
    lo -= Math.max(Math.abs(lo) * 0.01, 1);
    hi += Math.max(Math.abs(hi) * 0.01, 1);
  } else {
    const pad = (hi - lo) * 0.12;
    lo -= pad;
    hi += pad;
  }

  return {
    W: CURVE_W,
    H: CURVE_H,
    lo,
    hi,
    x: (i: number) =>
      values.length === 1 ? CURVE_W / 2 : (i / (values.length - 1)) * CURVE_W,
    y: (v: number) => CURVE_H - ((v - lo) / (hi - lo)) * CURVE_H,
  };
}

/**
 * A monotone cubic path through the points — smoothed, but not invented.
 *
 * The naive way to soften a polyline is a Catmull-Rom spline, and it lies: a
 * spline through equity readings overshoots at every turn, drawing peaks the
 * account never reached and troughs it never fell to. On a curve someone is
 * using to judge a track record that is not a cosmetic difference.
 *
 * Monotone cubic (Fritsch–Carlson tangents) keeps the eased look while staying
 * bounded by consecutive readings: between two points the curve never leaves
 * their range, and a local high or low in the data stays the local high or low
 * on screen. The readings themselves are untouched — every one is still exactly
 * on the line, which is what makes the hover readout honest.
 */
export function curvePath(pts: number[][]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n < 3) {
    return pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px} ${py}`).join(" ");
  }

  // Secant slopes between neighbours.
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = pts[i + 1][0] - pts[i][0];
    dx.push(h);
    slope.push(h === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / h);
  }

  // Tangents: the average of the two adjacent secants, forced flat wherever the
  // series turns. The flattening at turning points is what stops overshoot.
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  // Fritsch–Carlson clamp: a tangent steeper than 3× its secant can still leave
  // the interval, so pull both ends of each segment back inside.
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }

  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    const c1x = pts[i][0] + h;
    const c1y = pts[i][1] + m[i] * h;
    const c2x = pts[i + 1][0] - h;
    const c2y = pts[i + 1][1] - m[i + 1] * h;
    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${pts[i + 1][0]} ${pts[i + 1][1]}`;
  }
  return d;
}

/**
 * An equity curve.
 *
 * Deliberately NOT EquityBars, which scales bars from zero to the maximum. An
 * account moving between $9,990 and $10,004 would render as a row of identical
 * full-height bars — every real move invisible, and the flatness reading as a
 * design choice rather than as missing resolution.
 *
 * This scales to the data's own range plus the baseline, so a 0.1% move is
 * visible as a 0.1% move against the capital line rather than lost in the axis.
 *
 * `preserveAspectRatio="none"` stretches the viewBox to whatever width the
 * container has; `vector-effect="non-scaling-stroke"` stops that stretch from
 * making the line thicker horizontally than vertically.
 */
export function EquityCurve({
  values,
  baseline,
  height = 200,
  hoverAnimate = false,
}: {
  values: number[];
  /** Starting capital. Drawn as a dashed rule so gains and losses read against it. */
  baseline?: number;
  height?: number;
  /**
   * Redraw the curve when an ancestor carrying `group` is hovered.
   *
   * Opt-in rather than always-on. The detail pages render this chart as the
   * subject of the page, where a curve that redraws whenever the pointer
   * crosses some enclosing element would be motion with nothing to say; on a
   * marketplace card the redraw is the card answering the pointer.
   */
  hoverAnimate?: boolean;
}) {
  if (values.length === 0) return <div style={{ height }} />;

  const { W, H, x, y } = equityScale(values, baseline);

  // One point is a flat line across the panel, not a dot in the middle: the
  // account existed for that whole cycle at that value.
  const pts =
    values.length === 1
      ? [
          [0, y(values[0])],
          [W, y(values[0])],
        ]
      : values.map((v, i) => [x(i), y(v)]);

  const line = curvePath(pts);
  const area = `${line} L${pts[pts.length - 1][0]} ${H} L${pts[0][0]} ${H} Z`;

  const last = values[values.length - 1];
  const up = baseline === undefined || last >= baseline;
  const stroke = up ? "var(--color-accent)" : "var(--color-negative)";

  return (
    // The wipe rides on a plain div rather than on the <svg>. An inset()
    // percentage resolves against the element's reference box, and for SVG
    // elements that box is not the same one HTML uses — a wrapper makes the
    // reveal unambiguously "this many percent of the chart's width".
    <div
      style={{ height }}
      className={hoverAnimate ? "group-hover:animate-[curve-wipe_1200ms_linear]" : undefined}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ height, width: "100%" }}
        aria-hidden
      >
        {/* Keyed by tone, not a single fixed id: two curves on one page (the
            marketplace cards) both emit these defs, and duplicate ids resolve to
            whichever came first — a losing card was picking up the winning card's
            green wash. One id per tone means a collision is always with an
            identical gradient. */}
        <defs>
          <linearGradient id={`equityFill-${up ? "up" : "down"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={area} fill={`url(#equityFill-${up ? "up" : "down"})`} />

        {baseline !== undefined ? (
          <line
            x1="0"
            x2={W}
            y1={y(baseline)}
            y2={y(baseline)}
            stroke="var(--color-grid-strong)"
            strokeWidth="1"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* The ring, behind the dot and only on the cards. `transform-box:
            fill-box` so the scale is about the dot's own centre — the default
            origin is the SVG's, which would fling it off the corner. */}
        {hoverAnimate ? (
          <circle
            cx={pts[pts.length - 1][0]}
            cy={pts[pts.length - 1][1]}
            r="3.5"
            fill={stroke}
            opacity="0"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            className="group-hover:animate-[curve-mark_620ms_1050ms_ease-out]"
          />
        ) : null}

        {/* The latest point, marked — it is the number in the headline. */}
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={stroke} />
      </svg>
    </div>
  );
}

/**
 * A row-sized equity curve.
 *
 * A LINE, not `Sparkline`'s bars. Bars from a zero baseline answer "how big",
 * and an equity series is not asking that — every reading is roughly the size
 * of the one before it, so a bar chart of an account that fell 12% and one that
 * rose 12% are the same picture with a different last bar. The line is scaled
 * to the series' own range, so the shape of the movement IS the reading.
 *
 * Same `equityScale`/`curvePath` as the full-size curve, so a row and the panel
 * it links to draw the same account the same way — including the monotone
 * smoothing that stops a spline inventing peaks the account never reached.
 */
export function MiniCurve({
  values,
  tone = "accent",
  width = 120,
  height = 30,
}: {
  values: number[];
  tone?: "accent" | "negative" | "muted";
  width?: number;
  height?: number;
}) {
  if (values.length === 0) return <NoReadings width={width} height={height} />;

  const color =
    tone === "negative"
      ? "var(--color-negative)"
      : tone === "muted"
        ? "var(--color-text-dim)"
        : "var(--color-accent)";

  const { W, H, x, y } = equityScale(values);
  const pts: number[][] =
    values.length === 1
      ? [
          [0, y(values[0])],
          [W, y(values[0])],
        ]
      : values.map((v, i) => [x(i), y(v)]);

  const d = curvePath(pts);
  // The fill is the same path closed to the floor. A flat, faint tint rather
  // than a gradient: a gradient needs an id, an id in a file with no "use
  // client" has to come from useId, and that would make every chart in here a
  // client component to soften one 30px-tall shape.
  const area = `${d} L${W} ${H} L0 ${H} Z`;
  const lastX = pts[pts.length - 1][0];
  const lastY = pts[pts.length - 1][1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width, height }}
      aria-hidden
      className="overflow-visible"
    >
      <path d={area} fill={color} fillOpacity="0.13" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Where the series ends — the reading everything else is relative to. */}
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

