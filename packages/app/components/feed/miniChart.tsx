"use client";

import { tokenPrice } from "@/lib/format";
import type { Candle } from "@/lib/market";

export interface MiniLevel {
  priceUsd: number;
  label: string;
  kind: "ref" | "target" | "stop";
}

const W = 640;
const H = 200;
const PT = 14;
const PB = 10;

const LINE: Record<MiniLevel["kind"], string> = {
  ref: "var(--color-text-muted)",
  target: "var(--color-positive)",
  stop: "var(--color-negative)",
};

/**
 * The card's price line with the levels that matter to the idea.
 *
 * Hand-drawn SVG like the rest of components/charts.tsx: a card shows one
 * shape, and a full charting library per card in a carousel is weight with
 * nothing to show for it. Labels are HTML over the SVG so they stay crisp
 * when the chart stretches.
 */
export function MiniChart({ candles, price, levels, symbol }: { candles: Candle[]; price: number | null; levels: MiniLevel[]; symbol: string }) {
  const closes = candles.map((c) => c.c);
  if (price != null && closes.length) closes[closes.length - 1] = price;
  if (closes.length < 2) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl bg-surface font-ui text-[12.5px] text-text-dim">
        No chart yet
      </div>
    );
  }
  let lo = Math.min(...closes, ...levels.map((l) => l.priceUsd));
  let hi = Math.max(...closes, ...levels.map((l) => l.priceUsd));
  const pad = (hi - lo) * 0.12 || hi * 0.01;
  lo -= pad;
  hi += pad;
  const x = (i: number) => (i / (closes.length - 1)) * W;
  const y = (v: number) => PT + ((hi - v) / (hi - lo)) * (H - PT - PB);
  const pct = (v: number) => (y(v) / H) * 100;
  const d = closes.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const up = closes[closes.length - 1] >= closes[0];
  const stroke = up ? "var(--color-positive)" : "var(--color-negative)";
  const last = closes[closes.length - 1];

  return (
    <div className="relative h-[200px]">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label={`${symbol} price chart`}>
        <defs>
          <linearGradient id={`mc-${symbol}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={stroke} stopOpacity="0.2" />
            <stop offset="1" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {levels.map((l, i) => (
          <line
            key={i}
            x1="0"
            x2={W}
            y1={y(l.priceUsd)}
            y2={y(l.priceUsd)}
            stroke={LINE[l.kind]}
            strokeDasharray={l.kind === "ref" ? "2 4" : "5 4"}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={`${d} L${W} ${H} L0 ${H}Z`} fill={`url(#mc-${symbol})`} />
        <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {levels.map((l, i) => (
        <span
          key={i}
          className="absolute left-2 -translate-y-full pb-0.5 font-ui text-[11px] text-text-dim"
          style={{ top: `${pct(l.priceUsd)}%` }}
        >
          {l.label} <span className="tnum font-mono text-text-secondary">{tokenPrice(l.priceUsd).display}</span>
        </span>
      ))}
      <span
        className="tnum absolute right-0 -translate-y-1/2 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text-primary"
        style={{ top: `${pct(last)}%` }}
      >
        {tokenPrice(last).display}
      </span>
    </div>
  );
}
