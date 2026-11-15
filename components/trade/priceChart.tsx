"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { tokenPrice } from "@/lib/format";
import type { Candle } from "@/lib/market";

export interface ChartLevel {
  priceUsd: number;
  label: string;
  kind: "entry" | "target" | "stop" | "ref";
}

const COLORS = {
  up: "#5ED3B3",
  down: "#E5484D",
  grid: "#1B221E",
  text: "#8A948E",
  border: "#262D29",
  ref: "#7D877F",
  entry: "#F2F5F3",
};

const LEVEL_COLOR: Record<ChartLevel["kind"], string> = {
  entry: COLORS.entry,
  target: COLORS.up,
  stop: COLORS.down,
  ref: COLORS.ref,
};

/**
 * The candle chart.
 *
 * lightweight-charts owns its canvas, so React only hands it data: the chart is
 * created once per mount, candles are replaced when the series changes, the
 * live price nudges the last bar, and setup levels are price lines that are
 * torn down and redrawn whenever the set changes.
 */
export function PriceChart({
  candles,
  livePrice,
  levels,
  className = "",
}: {
  candles: Candle[];
  livePrice: number | null;
  levels: ChartLevel[];
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lines = useRef<IPriceLine[]>([]);
  const last = useRef<Candle | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const c = createChart(host.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: COLORS.text,
        fontFamily: "var(--font-mono, ui-monospace), monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
      rightPriceScale: { borderColor: COLORS.border },
      timeScale: { borderColor: COLORS.border, timeVisible: true, secondsVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: "#1A211D" }, vertLine: { labelBackgroundColor: "#1A211D" } },
    });
    const s = c.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      borderVisible: false,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      priceFormat: {
        type: "custom",
        minMove: 1e-12,
        formatter: (p: number) => tokenPrice(p).display,
      },
    });
    chart.current = c;
    series.current = s;
    return () => {
      c.remove();
      chart.current = null;
      series.current = null;
      lines.current = [];
    };
  }, []);

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    s.setData(
      candles.map((k) => ({ time: k.t as UTCTimestamp, open: k.o, high: k.h, low: k.l, close: k.c })),
    );
    last.current = candles.length ? { ...candles[candles.length - 1] } : null;
    chart.current?.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    const s = series.current;
    const bar = last.current;
    if (!s || !bar || livePrice == null) return;
    bar.c = livePrice;
    bar.h = Math.max(bar.h, livePrice);
    bar.l = Math.min(bar.l, livePrice);
    s.update({ time: bar.t as UTCTimestamp, open: bar.o, high: bar.h, low: bar.l, close: bar.c });
  }, [livePrice]);

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    lines.current.forEach((l) => s.removePriceLine(l));
    lines.current = levels.map((l) =>
      s.createPriceLine({
        price: l.priceUsd,
        color: LEVEL_COLOR[l.kind],
        lineWidth: 1,
        lineStyle: l.kind === "ref" ? LineStyle.Dotted : LineStyle.Dashed,
        axisLabelVisible: true,
        title: l.label,
      }),
    );
  }, [levels]);

  return <div ref={host} className={`h-full w-full ${className}`} />;
}
