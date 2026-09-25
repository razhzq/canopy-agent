import {
  num,
  type AgentDetail,
  type AgentFunding,
  type EquityPoint,
  type EquitySeries,
  type UniverseAsset,
} from "@/lib/api";

type Position = AgentDetail["positions"][number];

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
  positions: readonly (Pick<Position, "mint" | "symbol" | "qty" | "cost_basis_usd"> &
    Partial<Pick<Position, "perp" | "lp">>)[],
  universe: readonly Pick<UniverseAsset, "mint" | "symbol" | "priceUsd">[],
): OpenBookMark {
  // A TOKEN IS ITS MINT, NOT ITS TICKER, and joining on the ticker was wrong.
  //
  // The universe holds three tokens called CAT, and two each of DOG, GOLD and
  // WOJAK — see `UniverseAsset.name`, which exists to tell them apart on
  // screen. Keying prices by symbol meant whichever CAT the universe listed
  // last priced every CAT, so an agent holding two of them reported both at
  // one mark. `marketKey` in lib/api.ts already says identity is the mint;
  // this is the same rule, applied where the money is counted.
  //
  // An RWA pick has no mint — it is intent, named by issuer and underlying —
  // so those still join on the symbol. Hence two maps rather than one.
  //
  // `price` rather than `num`: num(null) is ZERO, because Number(null) is 0.
  // `priceUsd` is documented as null when the pool could not be priced, so
  // num() turned "we do not know what this is worth" into "this is worth
  // nothing" — the lot was marked at $0 instead of being carried at cost, and
  // `unpriced` stayed empty so the caller trusted the total.
  const price = (v: number | null | undefined): number | null => (v == null ? null : num(v));

  const byMint = new Map<string, number | null>();
  const bySymbol = new Map<string, number | null>();
  for (const a of universe) {
    if (a.mint) byMint.set(a.mint, price(a.priceUsd));
    bySymbol.set(a.symbol, price(a.priceUsd));
  }

  let costBasisUsd = 0;
  let marketValueUsd = 0;
  const unpriced = new Set<string>();

  for (const p of positions) {
    const cost = num(p.cost_basis_usd) ?? 0;
    costBasisUsd += cost;

    // `has` rather than a null coalesce: a mint the universe KNOWS but cannot
    // price is unpriced, and must not fall through to the symbol — falling
    // through is exactly how one CAT would take another CAT's mark. The
    // symbol is reached only when the mint is absent from the universe
    // entirely, which is the RWA case and the stale-position case.
    const mark = p.mint && byMint.has(p.mint) ? byMint.get(p.mint)! : (bySymbol.get(p.symbol) ?? null);
    const value = positionValueUsd(p, mark);
    if (value === null) {
      unpriced.add(p.symbol);
      // Carried at cost so the total stays a number rather than a hole. It is
      // `unpriced` — not this value — that tells the caller not to trust it.
      marketValueUsd += cost;
      continue;
    }
    marketValueUsd += value;
  }

  return {
    costBasisUsd,
    marketValueUsd,
    unrealizedPnlUsd: marketValueUsd - costBasisUsd,
    unpriced: [...unpriced],
  };
}

/**
 * What one open position is worth now, or null when it cannot be priced.
 *
 * THREE SHAPES, valued the way the positions table values them — a book total
 * that priced a row differently from the row itself is the disagreement this
 * file exists to prevent.
 *
 * - A lot is qty at the mark.
 * - A PERP is not a lot: `cost_basis_usd` is the collateral and `qty` the
 *   exposure, so qty × mark is the notional, not what the agent holds. Its
 *   value is collateral plus what the notional made, floored at zero — past
 *   liquidation the venue has it. The venue's own mark first, then ours.
 * - An LP leg has `qty` 1, so qty × a token price is meaningless. Its value is
 *   the pool read server-side this request, plus unclaimed fees; then the last
 *   mark the tick stored.
 */
export function positionValueUsd(
  p: Pick<Position, "qty" | "cost_basis_usd"> & Partial<Pick<Position, "perp" | "lp">>,
  mark: number | null,
): number | null {
  const cost = num(p.cost_basis_usd) ?? 0;
  if (p.lp) {
    if (p.lp.now) return p.lp.now.valueUsd + (p.lp.now.unclaimedFeesUsd ?? 0);
    return p.lp.last_mark_usd ?? null;
  }
  if (p.perp) {
    const leg = p.perp;
    const entry = Number(leg.entry_price_usd);
    const notional = Number(leg.size_usd);
    const venueMark = leg.mark_price_usd === null ? null : Number(leg.mark_price_usd);
    const perpMark = venueMark ?? mark;
    if (perpMark === null || !(entry > 0) || !Number.isFinite(notional)) return null;
    const move = ((perpMark - entry) / entry) * (leg.side === "long" ? 1 : -1);
    return Math.max(0, cost + notional * move);
  }
  const qty = num(p.qty);
  if (mark === null || qty === null) return null;
  return mark * qty;
}

/**
 * The universe with the open book's prices replaced by live marks.
 *
 * Marks are keyed by mint, because a position is. A tokenized-stock universe
 * row carries no mint, so those are matched through the positions, which hold
 * both the mint that was priced and the symbol the row is filed under. A mint
 * with no mark keeps the swept price.
 *
 * Shared by the agent page and the portfolio, so the two value an agent off the
 * same prices.
 */
export function withLiveMarks<T extends Pick<UniverseAsset, "mint" | "symbol" | "priceUsd">>(
  universe: readonly T[],
  positions: readonly Pick<Position, "mint" | "symbol">[],
  marks: ReadonlyMap<string, number>,
): T[] {
  if (marks.size === 0) return [...universe];
  const bySymbol = new Map<string, number>();
  for (const p of positions) {
    const price = p.mint ? marks.get(p.mint) : undefined;
    if (price !== undefined) bySymbol.set(p.symbol, price);
  }
  return universe.map((a) => {
    const byMint = a.mint ? marks.get(a.mint) : undefined;
    const price = byMint ?? bySymbol.get(a.symbol);
    return price === undefined ? a : { ...a, priceUsd: price };
  });
}

/* ------------------------------------------------------------ live books -- */

/**
 * What a live SOL book is worth now: the wallet as the chain holds it, plus
 * every open LP position valued this request, in both units at one rate.
 */
export interface LiveWorth {
  sol: number;
  usd: number;
}

/**
 * {@link LiveWorth} from a funding read, or null when it cannot be stated
 * honestly: a USD book, an unreadable rate or balance, or an open position the
 * server could not value this request.
 */
export function liveWorthOf(
  f: AgentFunding | null | undefined,
  positions: readonly Pick<Position, "lp">[],
): LiveWorth | null {
  if (!f) return null;
  const rate = f.solUsd;
  if (f.unit !== "SOL" || !(typeof rate === "number" && rate > 0) || typeof f.balance !== "number") return null;
  const legs = positions.filter((p) => !!p.lp);
  if (legs.some((p) => !p.lp?.now)) return null;
  const openUsd = legs.reduce((sum, p) => sum + p.lp!.now!.valueUsd + p.lp!.now!.unclaimedFeesUsd, 0);
  return { sol: f.balance + openUsd / rate, usd: f.balance * rate + openUsd };
}

/** A live USD book's cash — its wallet USDC — or null for a SOL book. */
export function liveCashUsdOf(f: AgentFunding | null | undefined): number | null {
  if (!f) return null;
  if ((f.unit ?? "USD") !== "USD" || typeof f.usdc !== "number") return null;
  return f.usdc;
}

/* ----------------------------------------------------------- agent mark -- */

/** One agent's position, priced. */
export interface AgentMark {
  /** What the agent was deployed with — the baseline every figure is against. */
  deployedCapitalUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  /**
   * Realised plus unrealised — except on a live book with a wallet read, where
   * it is equity (wallet + open book) against capital, and the gap is what the
   * ledger never saw: gas, deposits, withdrawals.
   */
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
  positions: readonly (Pick<Position, "mint" | "symbol" | "qty" | "cost_basis_usd"> &
    Partial<Pick<Position, "perp" | "lp">>)[],
  universe: readonly Pick<UniverseAsset, "mint" | "symbol" | "priceUsd">[],
  /**
   * A LIVE BOOK'S CASH IS ITS WALLET — the USDC the chain holds now, from the
   * same funding read as the wallet bar. Absent for paper, and for a live book
   * whose wallet could not be read.
   *
   * The identity below (capital + realised + unrealised) holds for a paper book
   * and for nothing else: a live wallet is deposited into, withdrawn from and
   * pays gas, none of which the ledger sees. The tick already values a live
   * book as wallet + marked positions (agent-stack tick.ts), which is what every
   * point on the curve says — so the headline measured the identity instead and
   * read $104 beside a $110 wallet and a $110 last reading (agent 150).
   */
  liveCashUsd?: number | null,
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
  const accountedPnl = marked ? series.realizedPnlUsd + unrealizedPnlUsd : snapshotPnl;
  // Only when the whole book is priced: wallet plus a half-marked book would be
  // a number missing a holding, and the identity is the better answer then.
  const liveEquity =
    typeof liveCashUsd === "number" && marked ? liveCashUsd + book.marketValueUsd : null;
  // On a live book the wallet decides the total, so P&L is equity against
  // capital and may differ from realised + unrealised by what the ledger never
  // saw (gas, deposits). Realised and unrealised are still reported as booked.
  const pnlUsd = liveEquity === null ? accountedPnl : liveEquity - deployedCapitalUsd;

  return {
    deployedCapitalUsd,
    realizedPnlUsd: series.realizedPnlUsd,
    unrealizedPnlUsd,
    pnlUsd,
    equityUsd: liveEquity ?? deployedCapitalUsd + pnlUsd,
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

/**
 * One agent, valued the way ITS OWN PAGE values it — for the portfolio.
 *
 * `markAgent` is the arithmetic; this is the choice of inputs, which is where
 * the portfolio and the agent page drifted apart. The agent page marks the open
 * book at live prices, takes a live USD book's cash from its wallet, and heads
 * an LP book with its net worth (live wallet plus positions on a live SOL
 * book, the last reading otherwise). The portfolio did none of that — it ran
 * the paper identity (capital + realised + unrealised) against a swept price
 * list — so a live agent read one figure on its page and another here.
 *
 * `funding` is the wallet read, and only means anything on a live book.
 */
export function markHolding(args: {
  series: EquitySeries | null;
  positions: readonly Position[];
  universe: readonly Pick<UniverseAsset, "mint" | "symbol" | "priceUsd">[];
  isLp: boolean;
  /** True when the series and positions are the agent's live book. */
  liveBook: boolean;
  unit: "USD" | "SOL";
  funding: AgentFunding | null;
  /** The rate the detail response was priced at, when the wallet read has none. */
  solUsd?: number | null;
}): AgentMark | null {
  const { series, positions, universe, isLp, liveBook, unit, funding } = args;
  const wallet = liveBook ? funding : null;

  if (!isLp) {
    return markAgent(series, positions, universe, unit === "USD" ? liveCashUsdOf(wallet) : null);
  }

  const base = markAgent(series, positions, universe);
  if (!base || !series) return base;
  const points = series.points;
  const last = points[points.length - 1];

  let equityUsd = last.equityUsd;
  let deployedCapitalUsd = base.deployedCapitalUsd;

  if (unit === "SOL") {
    // Measured in SOL and converted once, at today's rate, on both sides — a
    // baseline frozen at its own rate against a reading at today's reports the
    // SOL price move as the book's P&L. See `EquitySeries.capitalSol`.
    const worth = liveWorthOf(wallet, positions);
    const rate = wallet?.solUsd ?? args.solUsd ?? null;
    const lastSol = [...points].reverse().find((p) => typeof p.equitySol === "number")?.equitySol;
    const baseSol = (series.capitalSol ?? 0) > 0 ? series.capitalSol! : points[0]?.equitySol;
    const equitySol = worth?.sol ?? lastSol;
    if (typeof rate === "number" && rate > 0 && typeof equitySol === "number" && typeof baseSol === "number") {
      equityUsd = worth?.usd ?? equitySol * rate;
      deployedCapitalUsd = baseSol * rate;
    }
  }

  const pnlUsd = equityUsd - deployedCapitalUsd;
  const realizedPnlUsd = series.lp?.realizedUsd ?? series.realizedPnlUsd;
  return {
    ...base,
    deployedCapitalUsd,
    realizedPnlUsd,
    unrealizedPnlUsd: pnlUsd - realizedPnlUsd,
    pnlUsd,
    equityUsd,
    returnPct: deployedCapitalUsd ? (pnlUsd / deployedCapitalUsd) * 100 : 0,
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
 * Each agent's most recent settled cycle, newest first.
 *
 * Read off the equity readings rather than fetched: a reading IS a settled
 * cycle — the desk writes one per tick — so the move between consecutive
 * readings is what that cycle did.
 *
 * ONE ROW PER AGENT. This used to take the last six readings of every agent
 * and keep the newest six overall, so a 5-minute agent filled the whole list
 * with its own flat cycles and an hourly agent's last settlement never showed.
 * The question on the portfolio is "when did each of my agents last settle, and
 * what did it do", which is one line per agent.
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
    const i = a.points.length - 1;
    if (i < 0) continue;
    out.push({
      agentId: a.id,
      agentName: a.name,
      tickSeq: a.points[i].tickSeq,
      at: a.points[i].at,
      movedUsd: i > 0 ? a.points[i].equityUsd - a.points[i - 1].equityUsd : null,
    });
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

/**
 * Is this a liquidity book?
 *
 * The class is the answer for an agent built as one; the positions are the
 * answer for anything that has ended up holding an LP leg. Both, because a
 * copy-LP agent carries the class before it holds anything, and an older
 * agent can hold a leg the class does not mention.
 *
 * EXPORTED so the three surfaces that ask cannot drift. It was written inline
 * twice before this — in the desktop page and the phone's — and a third copy
 * was about to go into the performance slot beside the first.
 */
export function isLpBook(
  agent: { strategy_class?: string } | null | undefined,
  positions: readonly { lp?: unknown }[],
): boolean {
  return agent?.strategy_class === "lp" || positions.some((p) => !!p.lp);
}
