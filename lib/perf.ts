import { num, type AgentDetail, type EquitySeries, type UniverseAsset } from "@/lib/api";

/**
 * The performance figures, in ONE place.
 *
 * They used to live twice over: myAgents.tsx measured return against the capital
 * the agent was deployed with, agentDetail.tsx against the reading thirty days
 * back. Two honest numbers answering two different questions — one screen each,
 * both labelled "Return", with nothing to explain why an agent older than a
 * month disagreed with itself.
 *
 * SINCE DEPLOYED is the definition everywhere an OWNER's agent is reported.
 * A trailing window is the right way to compare strategies to each other; it is
 * the wrong way to report your own agent, because a strategy that made
 * everything it will ever make in its first fortnight reads as flat the moment
 * that fortnight leaves the window. There is no windowed variant here on
 * purpose: an unused second definition is how the two screens drifted apart in
 * the first place.
 *
 * Percentages are never summed — a +40% agent holding $100 and a −5% agent
 * holding $50,000 average to nothing meaningful — so the portfolio band totals
 * dollars via `pnlSinceDeployUsd`.
 */

/**
 * Return against the capital the agent was deployed with, over its whole life.
 *
 * Equity, not realised PnL: the last reading already carries the open book, and
 * an owner asking "how is it doing" means everything, not just what closed.
 *
 * The baseline falls back to the first reading when the series carries no
 * capital figure. That is not a guess: the desk records equity at the top of
 * each cycle BEFORE it acts, so the first reading is what was deployed. Without
 * the fallback an agent whose equity payload omitted capital showed no return at
 * all, which is a blank where a real number exists.
 */
export function returnSinceDeployPct(equity: EquitySeries | null): number | null {
  const points = equity?.points ?? [];
  if (points.length === 0) return null;
  const base = equity?.capitalUsd || points[0].equityUsd;
  if (!base) return null;
  return ((points[points.length - 1].equityUsd - base) / base) * 100;
}

/** The same movement in dollars, for summing a portfolio. */
export function pnlSinceDeployUsd(equity: EquitySeries | null): number | null {
  const points = equity?.points ?? [];
  if (points.length === 0) return null;
  const base = equity?.capitalUsd || points[0].equityUsd;
  return points[points.length - 1].equityUsd - base;
}

/* ------------------------------------------------------------- open book -- */

export interface OpenBookMark {
  costBasisUsd: number;
  marketValueUsd: number;
  /** Market value against cost. Zero on an empty book, which is correct. */
  unrealizedPnlUsd: number;
  /**
   * Symbols the universe could not price. Non-empty means the totals above are
   * a floor, not a fact — the unpriced lots are carried at cost — so the caller
   * must fall back rather than publish them.
   */
  unpriced: string[];
}

/**
 * The open book, marked at the prices the page is showing RIGHT NOW.
 *
 * Unrealised used to be inferred from the equity curve instead — last reading
 * minus capital minus realised. That identity is sound, but the equity curve
 * records one point per cycle, so the figure it yields is marked at whatever
 * the price was when the agent last ran. The positions table beside it marks
 * the same lots against the live universe. Two clocks, one label: an agent
 * holding two gold positions each up a couple of dollars was reporting
 * "Unrealised −$4.46", and the panel and the table below it contradicted each
 * other on the same screen.
 *
 * So unrealised is measured here, off the same marks and the same cost bases
 * the table uses, and the panel's other figures are derived from it — realised
 * plus unrealised is the total, and the total against capital is the return.
 * The curve stays per-cycle: it is a history, and a history should not move
 * because a price ticked.
 */
export function markOpenBook(
  positions: readonly Pick<AgentDetail["positions"][number], "symbol" | "qty" | "cost_basis_usd">[],
  universe: readonly Pick<UniverseAsset, "symbol" | "priceUsd">[],
): OpenBookMark {
  const priced = new Map(universe.map((a) => [a.symbol, num(a.priceUsd)]));

  let costBasisUsd = 0;
  let marketValueUsd = 0;
  const unpriced = new Set<string>();

  for (const p of positions) {
    const cost = num(p.cost_basis_usd) ?? 0;
    costBasisUsd += cost;

    const mark = priced.get(p.symbol) ?? null;
    const qty = num(p.qty);
    if (mark === null || qty === null) {
      unpriced.add(p.symbol);
      // Carried at cost so the total stays a number rather than a hole. It is
      // `unpriced` — not this value — that tells the caller not to trust it.
      marketValueUsd += cost;
      continue;
    }
    marketValueUsd += mark * qty;
  }

  return {
    costBasisUsd,
    marketValueUsd,
    unrealizedPnlUsd: marketValueUsd - costBasisUsd,
    unpriced: [...unpriced],
  };
}
