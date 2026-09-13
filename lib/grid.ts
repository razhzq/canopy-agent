/**
 * Grid level maths, mirrored from @canopy/agent-contracts so the builder can
 * state what a ladder costs and earns before anything is saved, and the agent
 * page can draw the ladder the backend is running. Keep in step with
 * gridLevelPrices / gridLevelUsd / gridMinSpacingPct / gridTotalUsd there.
 */
import type { GridPlan } from "@/lib/api";

export type GridShape = Pick<GridPlan, "lowerUsd" | "upperUsd" | "levels" | "spacing">;

export function gridLevelPrices(plan: GridShape): number[] {
  const n = Math.max(2, Math.round(plan.levels));
  const out: number[] = [];
  if (plan.spacing === "geometric" && plan.lowerUsd > 0) {
    const ratio = Math.pow(plan.upperUsd / plan.lowerUsd, 1 / (n - 1));
    for (let i = 0; i < n; i++) out.push(plan.lowerUsd * Math.pow(ratio, i));
  } else {
    const step = (plan.upperUsd - plan.lowerUsd) / (n - 1);
    for (let i = 0; i < n; i++) out.push(plan.lowerUsd + step * i);
  }
  out[n - 1] = plan.upperUsd;
  return out;
}

export function gridLevelUsd(
  plan: Pick<GridPlan, "perLevelUsd" | "allocation">,
  prices: number[],
  i: number,
): number {
  if (i >= prices.length - 1) return 0;
  if (plan.allocation !== "scalesWithSpacing") return plan.perLevelUsd;
  const width = prices[i + 1] - prices[i];
  const total = prices[prices.length - 1] - prices[0];
  if (!(total > 0) || !(width > 0)) return plan.perLevelUsd;
  return plan.perLevelUsd * (prices.length - 1) * (width / total);
}

/** Percent earned per completed cycle at the narrowest level, before fees. */
export function gridMinSpacingPct(plan: GridShape): number {
  if (!(plan.lowerUsd > 0 && plan.upperUsd > plan.lowerUsd)) return 0;
  const prices = gridLevelPrices(plan);
  let min = Infinity;
  for (let i = 0; i + 1 < prices.length; i++) {
    const pct = ((prices[i + 1] - prices[i]) / prices[i]) * 100;
    if (pct < min) min = pct;
  }
  return Number.isFinite(min) ? min : 0;
}

/** USD the whole ladder commits when every buy level is filled. */
export function gridTotalUsd(plan: GridShape & Pick<GridPlan, "perLevelUsd" | "allocation">): number {
  if (!(plan.lowerUsd > 0 && plan.upperUsd > plan.lowerUsd)) return plan.perLevelUsd * (Math.max(2, plan.levels) - 1);
  const prices = gridLevelPrices(plan);
  let total = 0;
  for (let i = 0; i + 1 < prices.length; i++) total += gridLevelUsd(plan, prices, i);
  return total;
}

/** `grid:L<n>` → n, the level a lot was bought for. */
export function gridLevelOf(signal: string | null | undefined): number | null {
  const m = signal ? /^grid:L(\d+)$/.exec(signal) : null;
  return m ? Number(m[1]) : null;
}

/** A price for a ladder row: enough decimals to tell neighbouring levels apart. */
export function levelPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toFixed(3);
  return n.toPrecision(4);
}
