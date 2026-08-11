import type { EquitySeries } from "@/lib/api";

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
