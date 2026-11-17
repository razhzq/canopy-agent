"use client";

import { MarketplaceView } from "@/components/marketplace";
import type { StrategyRow } from "@/lib/api";

/** A gently rising or falling equity series from a seed. Fixture only. */
function series(seed: number, up: boolean, n = 24): string[] {
  let x = seed * 9301 + 49297;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  let v = 10_000;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    v *= 1 + (up ? 0.006 : -0.004) + (rnd() - 0.5) * 0.02;
    out.push(v.toFixed(2));
  }
  return out;
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

function row(
  id: number,
  name: string,
  cls: string,
  status: StrategyRow["status"],
  days: number,
  o: Partial<StrategyRow> & { up?: boolean },
): StrategyRow {
  const { up = true, ...rest } = o;
  const spark = series(id, up);
  const capital = rest.mandate_capital_usd ?? "10000";
  return {
    id,
    name,
    strategy_class: cls,
    status,
    fee_pct: "0",
    author: "canopy",
    published_at: status === "published" ? daysAgo(days) : null,
    verification_started_at: status === "verifying" ? daysAgo(days) : null,
    created_at: daysAgo(days + 2),
    is_mine: false,
    spark,
    mandate_capital_usd: capital,
    realized_pnl_usd: (Number(spark[spark.length - 1]) - Number(capital)).toFixed(2),
    realized_30d_usd: (Number(spark[spark.length - 1]) - Number(spark[Math.max(spark.length - 9, 0)])).toFixed(2),
    all_paper: status !== "published",
    ...rest,
  } as StrategyRow;
}

const ROWS: StrategyRow[] = [
  row(1, "AAPLx Dip Catcher", "Dip buy", "published", 94, { deployments: "41", aum_usd: "182000", trades_30d: "928", open_positions: "3", volume_30d_usd: "1240000" }),
  row(2, "COINx Volatility", "Breakout", "published", 8, { deployments: "12", aum_usd: "44000", trades_30d: "1884", open_positions: "5", volume_30d_usd: "880000" }),
  row(3, "SOL Momentum", "Momentum", "published", 12, { deployments: "9", aum_usd: "97000", trades_30d: "1612", open_positions: "2", volume_30d_usd: "2100000", model: { id: "deepseek-v3", label: "DeepSeek-V3", provider: "pod" } }),
  row(4, "JitoSOL Trend", "Trend", "published", 73, { deployments: "17", aum_usd: "130000", trades_30d: "870", open_positions: "1", volume_30d_usd: "640000", is_mine: true }),
  row(5, "TSLAx Momentum", "Momentum", "verifying", 21, { deployments: "0", aum_usd: "64000", trades_30d: "1440", open_positions: "4", volume_30d_usd: "990000" }),
  row(6, "GOOGLx Mean Revert", "Mean reversion", "published", 51, { deployments: "6", aum_usd: "58000", trades_30d: "658", open_positions: "0", volume_30d_usd: "310000" }),
  row(7, "SPYx DCA", "DCA", "published", 140, { deployments: "22", aum_usd: "210000", trades_30d: "214", open_positions: "1", volume_30d_usd: "150000" }),
  row(8, "PAXG Rotator", "Rotation", "draft", 3, { deployments: "0", aum_usd: "39000", trades_30d: "96", open_positions: "1", volume_30d_usd: "70000" }),
  row(9, "TRUMP Grid", "Grid", "verifying", 38, { deployments: "0", aum_usd: "21000", trades_30d: "361", open_positions: "2", volume_30d_usd: "420000", up: false }),
];

export function AgentsPreview() {
  return <MarketplaceView state={{ phase: "ready", data: { strategies: ROWS } }} />;
}
