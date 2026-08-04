import type { ReactNode } from "react";

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
