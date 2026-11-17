"use client";

import { StrategyDetail, type StrategyPreview } from "@/components/strategyDetail";
import type { EquityPoint, RecordDay, RecordPosition, StrategyRow, UniverseAsset } from "@/lib/api";

// A fixed clock, so server and client render the same fixture.
const NOW = Date.parse("2026-09-05T00:00:00Z");
const HOUR = 3_600_000;

function points(seed: number, capital: number, n: number): EquityPoint[] {
  let x = seed * 9301 + 49297;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  let v = capital;
  let hwm = capital;
  const out: EquityPoint[] = [];
  for (let i = 0; i < n; i++) {
    v *= 1 + 0.00006 + (rnd() - 0.5) * 0.004;
    hwm = Math.max(hwm, v);
    out.push({
      tickSeq: i + 1,
      at: new Date(NOW - (n - i) * HOUR).toISOString(),
      equityUsd: Math.round(v * 100) / 100,
      cashUsd: Math.round(v * 0.5 * 100) / 100,
      highWaterMarkUsd: Math.round(hwm * 100) / 100,
    });
  }
  return out;
}

const PTS = points(7, 10_000, 94 * 24);

const daily: RecordDay[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(NOW - (29 - i) * 24 * HOUR);
  const r = Math.sin(i * 1.7) * 1.4;
  return {
    day: d.toISOString().slice(0, 10),
    realizedUsd: Math.round(r * 100 * 100) / 100,
    returnPct: Math.round(r * 100) / 100,
    trades: 2 + ((i * 7) % 5),
    maxDrawdownPct: Math.round(Math.abs(Math.cos(i)) * 90) / 100,
    cycles: 24,
  };
});

const positions: RecordPosition[] = [
  { symbol: "AAPLx", underlying: "AAPL", chain: "solana", venue: "jupiter", qty: "9", costUsd: "2004.30", openedAt: new Date(NOW - 26 * HOUR).toISOString() },
  { symbol: "NVDAx", underlying: "NVDA", chain: "solana", venue: "jupiter", qty: "14", costUsd: "1660.40", openedAt: new Date(NOW - 50 * HOUR).toISOString() },
  { symbol: "PAXG", underlying: null, chain: "solana", venue: "jupiter", qty: "0.62", costUsd: "1470.00", openedAt: new Date(NOW - 5 * HOUR).toISOString() },
];

const universe: UniverseAsset[] = [
  { symbol: "AAPLx", kind: "rwa", assetClass: "equity", calendar: "24/7", hasFilings: true, priceUsd: 227.4, liquidityUsd: null, changePct: 1.2 },
  { symbol: "NVDAx", kind: "rwa", assetClass: "equity", calendar: "24/7", hasFilings: true, priceUsd: 121.3, liquidityUsd: null, changePct: 3.4 },
  { symbol: "PAXG", kind: "rwa", assetClass: "commodity", calendar: "24/7", hasFilings: false, priceUsd: 2412, liquidityUsd: null, changePct: 2.9 },
];

const strategy = {
  id: 1,
  name: "AAPLx Dip Catcher",
  strategy_class: "rwa",
  status: "published",
  fee_pct: "1",
  author: "canopy",
  published_at: new Date(NOW - 94 * 24 * HOUR).toISOString(),
  verification_started_at: new Date(NOW - 101 * 24 * HOUR).toISOString(),
  created_at: new Date(NOW - 102 * 24 * HOUR).toISOString(),
  is_mine: false,
  spark: null,
} as StrategyRow;

const FIXTURE: StrategyPreview = {
  meta: {
    strategy,
    verification: {
      strategyId: 1,
      status: "published",
      startedAt: strategy.verification_started_at,
      day: 94,
      totalDays: 7,
      checks: [],
      stats: { paperReturnPct: 6.1, maxDrawdownPct: 2.3, proposed: 40, blocked: 2, wouldFill: 38 },
      publishable: true,
      remaining: [],
    },
    isMine: false,
  },
  record: {
    agentId: 1,
    capitalUsd: 10_000,
    isPaper: false,
    points: PTS,
    openPositions: positions.length,
    closedPositions: 41,
    trades30: 128,
    winRatePct: 61,
    daily,
    positions,
  },
  universe,
};

export function AgentPreview() {
  return <StrategyDetail strategyId={1} preview={FIXTURE} />;
}
