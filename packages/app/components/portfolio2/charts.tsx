"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { usd } from "@/lib/format";
import type { DayPnl, Slice } from "@/lib/portfolioMath";

const C = {
  accent: "#5ED3B3",
  negative: "#E5484D",
  grid: "#1B221E",
  text: "#8A948E",
  border: "#262D29",
};

/** Series colours: the accent first, then neutrals, so green stays the one accent. */
export const SLICE_COLORS = ["#5ED3B3", "#F2F5F3", "#9AA59F", "#5F6B64", "#C9D1CD", "#3E4742", "#7D877F", "#2C3430"];

export interface Line {
  key: string;
  label: string;
  points: { at: string; value: number }[];
}

/** Unix seconds, strictly increasing: lightweight-charts refuses repeats. */
function toSeries(points: { at: string; value: number }[]) {
  const out: { time: UTCTimestamp; value: number }[] = [];
  for (const p of points) {
    const t = Math.floor(Date.parse(p.at) / 1000) as UTCTimestamp;
    if (!Number.isFinite(t) || !Number.isFinite(p.value)) continue;
    // A repeat (or out-of-order) stamp replaces the last reading's value.
    if (out.length && t <= out[out.length - 1].time) out[out.length - 1].value = p.value;
    else out.push({ time: t, value: p.value });
  }
  return out;
}

/** Portfolio value over time: one filled line for the whole book, or one line per agent. */
export function ValueChart({ lines, className = "" }: { lines: Line[]; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Area" | "Line">[]>([]);

  useEffect(() => {
    if (!host.current) return;
    const c = createChart(host.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: C.text,
        fontFamily: "var(--font-plex-mono, ui-monospace), monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: C.grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: "#1A211D" }, vertLine: { labelBackgroundColor: "#1A211D" } },
      handleScroll: false,
      handleScale: false,
    });
    chart.current = c;
    return () => {
      c.remove();
      chart.current = null;
      series.current = [];
    };
  }, []);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    for (const s of series.current) c.removeSeries(s);
    series.current = [];
    const fmt = { type: "custom" as const, minMove: 0.01, formatter: (v: number) => usd(v) };
    lines.forEach((l, i) => {
      const s =
        lines.length === 1
          ? c.addSeries(AreaSeries, {
              lineColor: C.accent,
              topColor: "rgba(94,211,179,0.18)",
              bottomColor: "rgba(94,211,179,0)",
              lineWidth: 2,
              priceFormat: fmt,
              lastValueVisible: false,
              priceLineVisible: false,
            })
          : c.addSeries(LineSeries, {
              color: SLICE_COLORS[i % SLICE_COLORS.length],
              lineWidth: 2,
              priceFormat: fmt,
              lastValueVisible: false,
              priceLineVisible: false,
              title: l.label,
            });
      s.setData(toSeries(l.points));
      series.current.push(s);
    });
    c.timeScale().fitContent();
  }, [lines]);

  return <div ref={host} className={className} />;
}

/** Daily (or monthly) P&L as bars around a zero line. */
export function PnlBars({
  data,
  unit,
  className = "",
}: {
  data: DayPnl[];
  unit: "day" | "month";
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1e-9, ...data.map((d) => Math.abs(d.pnlUsd)));
  const hasNeg = data.some((d) => d.pnlUsd < 0);
  const hasPos = data.some((d) => d.pnlUsd > 0);
  // Zero sits where the data needs it: mid-height with both signs, at an edge with one.
  const zero = hasNeg && hasPos ? 0.5 : hasNeg ? 0 : 1;
  const H = 100;
  const shown = hover !== null ? data[hover] : null;
  return (
    <div className={className}>
      <div className="relative h-[150px]">
        <svg viewBox={`0 0 ${data.length * 10} ${H}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Profit and loss by period">
          <line x1="0" x2={data.length * 10} y1={H * zero} y2={H * zero} stroke={C.border} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
          {data.map((d, i) => {
            const h = (Math.abs(d.pnlUsd) / max) * H * (hasNeg && hasPos ? 0.5 : 1);
            const y = d.pnlUsd >= 0 ? H * zero - h : H * zero;
            return (
              <rect
                key={d.day}
                x={i * 10 + 1.5}
                y={y}
                width={7}
                height={Math.max(d.pnlUsd === 0 ? 0 : 0.8, h)}
                fill={d.pnlUsd >= 0 ? C.accent : C.negative}
                opacity={hover === null || hover === i ? 1 : 0.45}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex h-5 items-center justify-between font-mono text-[11px] text-text-muted">
        {shown ? (
          <>
            <span>{periodLabel(shown.day, unit)}</span>
            <span className={`tnum ${shown.pnlUsd >= 0 ? "text-positive" : "text-negative"}`}>{usd(shown.pnlUsd, { sign: true })}</span>
          </>
        ) : (
          <>
            <span>{data.length ? periodLabel(data[0].day, unit) : ""}</span>
            <span>{data.length ? periodLabel(data[data.length - 1].day, unit) : ""}</span>
          </>
        )}
      </div>
    </div>
  );
}

function periodLabel(key: string, unit: "day" | "month"): string {
  const d = new Date(unit === "month" ? `${key}-01T00:00:00Z` : `${key}T00:00:00Z`);
  return d.toLocaleDateString("en-US", unit === "month" ? { month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" });
}

/** The same days as a calendar: one square per day, weeks as columns. */
export function PnlCalendar({ data, className = "" }: { data: DayPnl[]; className?: string }) {
  const max = Math.max(1e-9, ...data.map((d) => Math.abs(d.pnlUsd)));
  const lead = data.length ? new Date(`${data[0].day}T00:00:00Z`).getUTCDay() : 0;
  const cells: (DayPnl | null)[] = [...Array(lead).fill(null), ...data];
  const weeks: (DayPnl | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <div className={`flex gap-[3px] overflow-x-auto ${className}`} role="img" aria-label="Profit and loss calendar">
      {weeks.map((w, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {Array.from({ length: 7 }, (_, di) => {
            const d = w[di] ?? null;
            if (!d) return <span key={di} className="size-[14px]" />;
            const a = Math.min(1, 0.25 + (Math.abs(d.pnlUsd) / max) * 0.75);
            const bg = d.pnlUsd === 0 ? "var(--color-surface-2)" : d.pnlUsd > 0 ? `rgba(94,211,179,${a})` : `rgba(229,72,77,${a})`;
            return <span key={di} title={`${periodLabel(d.day, "day")} · ${usd(d.pnlUsd, { sign: true })}`} className="size-[14px] rounded-[3px]" style={{ background: bg }} />;
          })}
        </div>
      ))}
    </div>
  );
}

/** A ring split by share, with its legend beside it. */
export function Donut({ slices, className = "" }: { slices: Slice[]; className?: string }) {
  const total = slices.reduce((t, s) => t + s.valueUsd, 0);
  const R = 46;
  const L = 2 * Math.PI * R;
  const arcs = useMemo(() => {
    let off = 0;
    return slices.map((s, i) => {
      const len = total > 0 ? (s.valueUsd / total) * L : 0;
      const a = { key: s.key, len, off, color: SLICE_COLORS[i % SLICE_COLORS.length] };
      off += len;
      return a;
    });
  }, [slices, total, L]);
  if (total <= 0) return <p className="py-10 text-center font-ui text-[12.5px] text-text-muted">Nothing invested yet.</p>;
  return (
    <div className={`flex items-center gap-6 ${className}`}>
      <svg viewBox="0 0 120 120" className="size-[132px] shrink-0 -rotate-90" role="img" aria-label="Distribution">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-surface-2)" strokeWidth="14" />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth="14"
            strokeDasharray={`${Math.max(0, a.len - 1)} ${L}`}
            strokeDashoffset={-a.off}
          />
        ))}
      </svg>
      <ul className="min-w-0 flex-1 space-y-2">
        {slices.slice(0, 7).map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 font-ui text-[12.5px]">
            <span className="h-2.5 w-1 shrink-0 rounded-sm" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate text-text-secondary">{s.label}</span>
            <span className="tnum font-mono text-text-primary">{usd(s.valueUsd)}</span>
            <span className="tnum w-10 text-right font-mono text-text-muted">{Math.round((s.valueUsd / total) * 100)}%</span>
          </li>
        ))}
        {slices.length > 7 && (
          <li className="font-ui text-[12px] text-text-muted">
            {slices.length - 7} more · {usd(slices.slice(7).reduce((t, s) => t + s.valueUsd, 0))}
          </li>
        )}
      </ul>
    </div>
  );
}
