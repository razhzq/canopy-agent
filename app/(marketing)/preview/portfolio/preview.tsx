"use client";

import { PortfolioView, type Holding } from "@/components/portfolioOverview";
import { markAgent } from "@/lib/perf";
import type { AgentRow, EquitySeries, UniverseAsset } from "@/lib/api";

// A fixed clock, so the server and client render the same fixture and React
// does not report a hydration mismatch over a timestamp.
const NOW = Date.parse("2026-09-05T00:00:00Z");

/** Fixture only: a settled-per-cycle equity series from a seed. */
function series(seed: number, capital: number, up: boolean, n = 30): EquitySeries {
  let x = seed * 9301 + 49297;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  let v = capital;
  let hwm = capital;
  const points = [];
  for (let i = 0; i < n; i++) {
    v *= 1 + (up ? 0.004 : -0.003) + (rnd() - 0.5) * 0.016;
    hwm = Math.max(hwm, v);
    points.push({
      tickSeq: i + 1,
      at: new Date(NOW - (n - i) * 6 * 3_600_000).toISOString(),
      equityUsd: Math.round(v * 100) / 100,
      cashUsd: Math.round(v * 0.4 * 100) / 100,
      highWaterMarkUsd: Math.round(hwm * 100) / 100,
    });
  }
  const last = points[points.length - 1].equityUsd;
  return {
    capitalUsd: capital,
    isPaper: false,
    realizedPnlUsd: Math.round((last - capital) * 0.6 * 100) / 100,
    closedPositions: 14,
    winningPositions: 9,
    points,
  };
}

const UNIVERSE: UniverseAsset[] = [
  { symbol: "SOL", mint: "So1", kind: "crypto", assetClass: "token", calendar: "24/7", hasFilings: false, priceUsd: 207.4, liquidityUsd: null, changePct: -5.3 },
  { symbol: "AAPLx", mint: "AAPLx", kind: "rwa", assetClass: "equity", calendar: "24/7", hasFilings: true, priceUsd: 227.4, liquidityUsd: null, changePct: 1.2 },
  { symbol: "JitoSOL", mint: "Jito", kind: "crypto", assetClass: "token", calendar: "24/7", hasFilings: false, priceUsd: 214.75, liquidityUsd: null, changePct: 4.3 },
  { symbol: "PAXG", mint: "PAXG", kind: "rwa", assetClass: "commodity", calendar: "24/7", hasFilings: false, priceUsd: 2412, liquidityUsd: null, changePct: 2.9 },
];

function agent(id: number, name: string, cls: string, status: AgentRow["status"], capital: number, paper = false): AgentRow {
  return {
    id,
    strategy_id: id,
    strategy_name: name,
    strategy_class: cls,
    status,
    capital_usd: String(capital),
    autonomy: "execute_with_caps",
    is_paper: paper,
    high_water_mark_usd: null,
    next_tick_at: new Date(NOW + 600_000).toISOString(),
    last_tick_at: new Date(NOW - 300_000).toISOString(),
    created_at: new Date(NOW - 40 * 86_400_000).toISOString(),
    paused_reason: status === "paused" ? "Daily loss cap reached" : null,
  };
}

function holding(a: AgentRow, up: boolean, positions: Holding["positions"]): Holding {
  const s = a.status === "draft" ? null : series(a.id, Number(a.capital_usd), up);
  return { agent: a, positions, series: s, mark: markAgent(s, positions, UNIVERSE) };
}

const pos = (id: number, symbol: string, mint: string, qty: number, cost: number): Holding["positions"][number] => ({
  id,
  mint,
  symbol,
  underlying: null,
  qty: String(qty),
  cost_basis_usd: String(cost),
  opened_by_sme: null,
  opened_by_signal: null,
  opened_at: new Date(NOW - 2 * 86_400_000).toISOString(),
});

const HOLDINGS: Holding[] = [
  holding(agent(1, "SOL dip buyer", "Dip buy", "active", 10_000), true, [pos(1, "SOL", "So1", 12.4, 2480)]),
  holding(agent(2, "AAPLx Dip Catcher", "Dip buy", "active", 8_000), true, [pos(2, "AAPLx", "AAPLx", 9, 2000)]),
  holding(agent(3, "JitoSOL Trend", "Trend", "active", 6_000), true, [pos(3, "JitoSOL", "Jito", 7.1, 1500), pos(4, "SOL", "So1", 3.2, 660)]),
  holding(agent(4, "PAXG Rotator", "Rotation", "paused", 4_000), false, [pos(5, "PAXG", "PAXG", 0.8, 1960)]),
  holding(agent(5, "TRUMP Grid", "Grid", "stopped", 2_000, true), false, []),
];

export function PortfolioPreview() {
  return <PortfolioView holdings={HOLDINGS} universe={UNIVERSE} user={null} username="dolphin" reload={() => {}} />;
}
