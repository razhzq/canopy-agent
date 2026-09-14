"use client";

/**
 * The ladder a grid agent is running, drawn from what the backend holds.
 *
 * Every open lot carries the level it was bought for in its signal key, so
 * the picture is exact: which levels are held (and where each sells), which
 * are empty and waiting for price to come down, and where the mark sits
 * among them. The same maths as the backend (lib/grid.ts) so the prices here
 * are the prices the agent acts on.
 */
import type { AgentDetail, GridPlan } from "@/lib/api";
import { gridLevelOf, gridLevelPrices, levelPrice } from "@/lib/grid";
import { LABEL, SURFACE } from "@/components/kit";
import { useT } from "@/lib/i18n";

export function GridLadder({
  grid,
  positions,
  markUsd,
}: {
  grid: GridPlan;
  positions: AgentDetail["positions"];
  markUsd: number | null;
}) {
  const t = useT();
  const hasRange = grid.lowerUsd > 0 && grid.upperUsd > grid.lowerUsd;
  const prices = hasRange ? gridLevelPrices(grid) : [];
  const lots = positions.filter((p) => p.mint === grid.market.mint && !p.perp);
  const held = new Map<number, { qty: number; costUsd: number }>();
  for (const p of lots) {
    const qty = Number(p.qty);
    const costUsd = Number(p.cost_basis_usd);
    let level = gridLevelOf(p.opened_by_signal);
    if (level === null && prices.length) {
      const entry = qty > 0 ? costUsd / qty : prices[0];
      level = 0;
      for (let i = 0; i + 1 < prices.length; i++) if (prices[i] <= entry) level = i;
    }
    if (level === null) continue;
    const prev = held.get(level);
    held.set(level, { qty: (prev?.qty ?? 0) + qty, costUsd: (prev?.costUsd ?? 0) + costUsd });
  }
  const totalQty = [...held.values()].reduce((s, h) => s + h.qty, 0);
  const totalCost = [...held.values()].reduce((s, h) => s + h.costUsd, 0);
  const wap = totalQty > 0 ? totalCost / totalQty : null;
  const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label={t("ad_grid_range")} value={hasRange ? `$${levelPrice(grid.lowerUsd)} – $${levelPrice(grid.upperUsd)}` : "—"} />
        <Stat label={t("ad_grid_levels")} value={t("ad_grid_levels_held", { held: held.size, levels: Math.max(2, grid.levels) - 1 })} />
        <Stat label={t("ad_grid_per_level")} value={money(grid.perLevelUsd)} />
        <Stat label={wap ? t("ad_grid_wap") : t("ad_grid_mark")} value={wap ? `$${levelPrice(wap)}` : markUsd ? `$${levelPrice(markUsd)}` : "—"} />
      </div>
      <p className="font-ui text-[12.5px] leading-relaxed text-text-secondary">
        {hasRange
          ? t("ad_grid_note", {
              stop: grid.stopBelowLowerPct,
              tp: grid.takeProfitPct !== undefined ? t("ad_grid_note_tp", { tp: grid.takeProfitPct }) : "",
            })
          : t("ad_grid_auto_pending")}
      </p>
      {hasRange ? (
        <ol className="max-h-[420px] overflow-y-auto rounded-xl border border-border">
          {[...prices.keys()].reverse().map((i) => {
            const price = prices[i];
            const top = i === prices.length - 1;
            const h = held.get(i);
            const markBelow = markUsd !== null && markUsd < price && (i === 0 || markUsd >= prices[i - 1]);
            return (
              <li
                key={i}
                className={`flex items-center justify-between gap-3 border-b border-grid px-3.5 py-2 last:border-b-0 ${
                  h ? "bg-accent/[0.06]" : ""
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={`inline-block h-2 w-2 rounded-full ${h ? "bg-accent" : top ? "bg-transparent ring-1 ring-grid-strong" : "bg-grid-strong"}`}
                  />
                  <span className="tnum font-mono text-[12.5px] text-text-primary">${levelPrice(price)}</span>
                </span>
                <span className="font-ui text-[12px] text-text-dim">
                  {top
                    ? t("ad_grid_top")
                    : h
                      ? t("ad_grid_held", { price: levelPrice(prices[i + 1]) })
                      : t("ad_grid_waiting", { price: levelPrice(price) })}
                  {markBelow && markUsd !== null ? (
                    <span className="pl-2 text-text-muted">· {t("ad_grid_mark")} ${levelPrice(markUsd)}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${SURFACE} px-3.5 py-3`}>
      <p className={LABEL}>{label}</p>
      <p className="tnum pt-1 font-mono text-[13px] text-text-primary">{value}</p>
    </div>
  );
}
