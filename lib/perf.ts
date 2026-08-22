import {
  num,
  type AgentDetail,
  type EquityPoint,
  type EquitySeries,
  type UniverseAsset,
} from "@/lib/api";

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

/* ----------------------------------------------------------- agent mark -- */

/** One agent's position, priced. */
export interface AgentMark {
  /** What the agent was deployed with — the baseline every figure is against. */
  deployedCapitalUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  /** Realised plus unrealised. These three always reconcile. */
  pnlUsd: number;
  equityUsd: number;
  returnPct: number;
  /** Market value of the open book. Null when no cycle recorded a cash figure. */
  openBookUsd: number | null;
  /** Deepest fall from a peak on the settled curve, as a positive percentage. */
  maxDrawdownPct: number;
  /** Closed positions that made money, as a percentage. Null before any closed. */
  hitRatePct: number | null;
  /**
   * True when every open holding could be priced against the live universe.
   *
   * False is not an error — it means the figures fall back to the last cycle's
   * snapshot, which is a whole book marked one cycle late rather than half a
   * book marked now. Callers that want to say so can; the numbers are usable
   * either way.
   */
  marked: boolean;
  /** The settled equity readings, one per cycle, oldest first. */
  points: EquityPoint[];
}

/** Capital minus uninvested cash. Null when the cycle recorded no cash figure. */
function deployedFrom(p: EquityPoint): number | null {
  // `=== null` missed an absent field, and `equity - undefined` is NaN, which
  // renders as "$NaN" rather than as the unknown it actually is.
  const cash = num(p.cashUsd);
  const equity = num(p.equityUsd);
  if (cash === null || equity === null) return null;
  return Math.max(equity - cash, 0);
}

function drawdownPct(values: number[]): number {
  if (values.length === 0) return 0;
  let peak = values[0];
  let worst = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const fall = ((peak - v) / peak) * 100;
      if (fall > worst) worst = fall;
    }
  }
  return worst;
}

/**
 * Everything one agent is worth, in ONE place.
 *
 * This calculation lived inside the agent page's equity panel, which was fine
 * while the agent page was the only screen that showed it. The portfolio
 * overview sums the same figures across every agent, and a second
 * implementation of "what is this agent worth" is precisely how the two
 * definitions of Return that `returnSinceDeployPct` exists to prevent came
 * about in the first place — one screen measuring against deployed capital,
 * another against a trailing window, both labelled the same.
 *
 * So it is a function, and both callers use it. If the portfolio total ever
 * disagrees with the agent page, it will be because of what is being summed,
 * not because the two screens compute an agent differently.
 *
 * Returns null when there is no curve to measure — a freshly deployed agent
 * that has not completed a cycle. That is a real state, not a failure, and it
 * is the caller's job to say which.
 */
export function markAgent(
  series: EquitySeries | null,
  positions: readonly Pick<
    AgentDetail["positions"][number],
    "symbol" | "qty" | "cost_basis_usd"
  >[],
  universe: readonly Pick<UniverseAsset, "symbol" | "priceUsd">[],
): AgentMark | null {
  const points = series?.points ?? [];
  if (!series || points.length === 0) return null;

  const last = points[points.length - 1];
  // A series with no capital figure is measured from its first reading, which
  // is what was deployed — the desk records equity before it acts.
  const deployedCapitalUsd = series.capitalUsd || points[0].equityUsd;

  // Unrealised is what the open book is carrying: everything not yet booked.
  // Marked against the same prices the positions table uses, so the two cannot
  // disagree. See markOpenBook for why it is not read off the curve.
  const book = markOpenBook(positions, universe);
  const marked = book.unpriced.length === 0;

  // The snapshot figure, still the answer whenever a holding cannot be priced.
  const snapshotPnl = pnlSinceDeployUsd(series) ?? 0;

  const unrealizedPnlUsd = marked
    ? book.unrealizedPnlUsd
    : snapshotPnl - series.realizedPnlUsd;
  // Realised plus unrealised IS the total — the figures have to add up, and on
  // the snapshot path this reduces to exactly what the curve's last point says.
  const pnlUsd = marked ? series.realizedPnlUsd + unrealizedPnlUsd : snapshotPnl;

  return {
    deployedCapitalUsd,
    realizedPnlUsd: series.realizedPnlUsd,
    unrealizedPnlUsd,
    pnlUsd,
    equityUsd: deployedCapitalUsd + pnlUsd,
    returnPct: deployedCapitalUsd ? (pnlUsd / deployedCapitalUsd) * 100 : 0,
    openBookUsd: marked ? book.marketValueUsd : deployedFrom(last),
    maxDrawdownPct: drawdownPct(points.map((p) => p.equityUsd)),
    hitRatePct:
      series.closedPositions > 0
        ? (series.winningPositions / series.closedPositions) * 100
        : null,
    marked,
    points,
  };
}

/* ------------------------------------------------------------- portfolio -- */

/** One reading on the aggregate curve. */
export interface PortfolioPoint {
  at: string;
  equityUsd: number;
  /** Aggregate P&L at that moment — the distance above the capital baseline. */
  pnlUsd: number;
}

/**
 * The aggregate equity curve, from every agent's settled readings.
 *
 * WHY THIS IS A P&L PATH WITH CAPITAL ADDED BACK, NOT A SUM OF EQUITIES
 *
 * Summing the agents' equity curves draws a line that jumps every time an agent
 * is deployed — because a new agent arrives carrying its whole mandate. Funding
 * a second agent with $10,000 would step the portfolio line up by $10,000 and
 * read, on a chart whose entire job is showing performance, as the best day the
 * account ever had. A deposit is not a gain.
 *
 * So each agent contributes only what it has MADE — equity minus the capital it
 * was deployed with — which is zero on the day it starts and stays zero
 * backwards through time. Deploying an agent moves the line by nothing, which
 * is the truth. Today's total capital is then added to the whole path, so the
 * last point equals the portfolio's real equity and the baseline is a flat rule
 * the curve can be read against.
 *
 * The trade is that history is drawn as if today's capital had always been at
 * work. The shape and every dollar of movement is exact; what the early part of
 * the line is NOT is a claim about how much money was in the account back then.
 * Callers say so on screen.
 *
 * Readings are stepped forward, not interpolated: an agent is worth its last
 * settled reading until its next cycle says otherwise, and drawing a slope
 * between two cycles invents readings the desk never took.
 */
export function aggregateEquityPath(
  marks: readonly Pick<AgentMark, "points" | "deployedCapitalUsd">[],
  capitalNowUsd: number,
): PortfolioPoint[] {
  const stamps = new Set<string>();
  for (const m of marks) for (const p of m.points) stamps.add(p.at);
  const times = [...stamps].sort();
  if (times.length === 0) return [];

  // One cursor per agent, walked forward with the timeline — so this is one
  // pass over every reading rather than a scan per agent per timestamp.
  const cursor = new Array(marks.length).fill(0);
  const carried = new Array(marks.length).fill(0);

  return times.map((at) => {
    let pnlUsd = 0;
    for (let i = 0; i < marks.length; i++) {
      const { points, deployedCapitalUsd } = marks[i];
      while (cursor[i] < points.length && points[cursor[i]].at <= at) {
        carried[i] = points[cursor[i]].equityUsd - deployedCapitalUsd;
        cursor[i]++;
      }
      pnlUsd += carried[i];
    }
    return { at, equityUsd: capitalNowUsd + pnlUsd, pnlUsd };
  });
}

/**
 * The most recent settled cycles across every agent, newest first.
 *
 * Read off the equity readings rather than fetched: a reading IS a settled
 * cycle — the desk writes one per tick — so the move between consecutive
 * readings is what that cycle did. Deriving it here costs nothing, where
 * asking for each agent's cycle list would be one more request per agent for
 * figures already on the page.
 */
export interface Settlement {
  agentId: number;
  agentName: string;
  tickSeq: number;
  at: string;
  /** Equity change across the cycle. Null for an agent's first reading. */
  movedUsd: number | null;
}

export function recentSettlements(
  agents: readonly { id: number; name: string; points: readonly EquityPoint[] }[],
  limit = 6,
): Settlement[] {
  const out: Settlement[] = [];
  for (const a of agents) {
    for (let i = a.points.length - 1; i >= 0 && i >= a.points.length - limit; i--) {
      out.push({
        agentId: a.id,
        agentName: a.name,
        tickSeq: a.points[i].tickSeq,
        at: a.points[i].at,
        movedUsd: i > 0 ? a.points[i].equityUsd - a.points[i - 1].equityUsd : null,
      });
    }
  }
  return out.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0)).slice(0, limit);
}

/**
 * Equity change over a trailing window, from the settled readings.
 *
 * Measured against the LAST reading at or before the cutoff — not the first
 * reading inside the window. An agent that ticks hourly and one that ticks
 * daily otherwise measure different spans from the same request.
 *
 * Null when nothing was recorded before the cutoff: an agent younger than the
 * window has no 24h figure, and inventing one from its deploy value would
 * report its entire life as a day's move.
 */
export function movedOverUsd(points: readonly EquityPoint[], sinceMs: number): number | null {
  if (points.length === 0) return null;
  const cutoff = new Date(sinceMs).toISOString();
  let base: EquityPoint | null = null;
  for (const p of points) {
    if (p.at <= cutoff) base = p;
    else break;
  }
  if (!base) return null;
  return points[points.length - 1].equityUsd - base.equityUsd;
}
