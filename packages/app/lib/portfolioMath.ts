// The v2 Portfolio's figures, from the holdings `useHoldings` loads.
//
// Two books, never blended: Live (real money: live agents plus your own trades
// from the Trade screen) and Paper (paper agents only). Every total here is for
// one book.
//
// Movement over a window ("Today", "Last 30 days", the daily P&L bars) comes
// from the aggregate P&L path (`aggregateEquityPath`), where an agent
// contributes only what it has made, so adding funds or deploying an agent is
// never counted as a gain. Your own trades join that as the P&L of the trades
// opened (or closed) inside the window: the trade ledger has no price history
// to replay an older open trade with.

import { num } from "@/lib/api";
import { aggregateEquityPath, movedOverUsd, positionValueUsd, type AgentMark } from "@/lib/perf";
import type { Holding } from "@/lib/useHoldings";
import type { Position } from "@/lib/market";

export type Book = "live" | "paper";

export const DAY_MS = 86_400_000;

/** Agents that count toward a total: not archived. */
export function counts(h: Holding): boolean {
  return h.agent.status !== "stopped" && h.agent.status !== "draft" && h.agent.status !== "deleted";
}

export function inBook(h: Holding, book: Book): boolean {
  return h.agent.is_paper === (book === "paper");
}

export function hasLive(holdings: Holding[], ownOpen: Position[], ownClosed: Position[]): boolean {
  return ownOpen.length > 0 || ownClosed.length > 0 || holdings.some((h) => !h.agent.is_paper && counts(h));
}

export interface BookTotals {
  /** Agents in this book that count. */
  agents: Holding[];
  inAgentsUsd: number;
  ownTradesUsd: number;
  investedUsd: number;
  agentPnlUsd: number;
  ownPnlUsd: number;
  todayUsd: number | null;
  todayPct: number | null;
  d30Usd: number | null;
  d30Pct: number | null;
  wins: number;
  closed: number;
  path: { at: string; equityUsd: number; pnlUsd: number }[];
}

function ownMovedSince(open: Position[], closed: Position[], sinceMs: number): number {
  let moved = 0;
  for (const p of open) if (Date.parse(p.openedAt) >= sinceMs) moved += p.pnlUsd;
  for (const p of closed) if (p.closedAt && Date.parse(p.closedAt) >= sinceMs) moved += p.pnlUsd;
  return moved;
}

export function bookTotals(
  holdings: Holding[],
  book: Book,
  ownOpen: Position[],
  ownClosed: Position[],
  now = Date.now(),
): BookTotals {
  const agents = holdings.filter((h) => counts(h) && inBook(h, book));
  const marks = agents.map((h) => h.mark).filter((m): m is AgentMark => !!m);
  const own = book === "live";
  const open = own ? ownOpen : [];
  const closed = own ? ownClosed : [];

  const inAgentsUsd = marks.reduce((t, m) => t + m.equityUsd, 0);
  const ownTradesUsd = open.reduce((t, p) => t + p.valueUsd, 0);
  const investedUsd = inAgentsUsd + ownTradesUsd;
  const agentPnlUsd = marks.reduce((t, m) => t + m.pnlUsd, 0);
  const ownPnlUsd = [...open, ...closed].reduce((t, p) => t + p.pnlUsd, 0);

  const capitalNow = marks.reduce((t, m) => t + m.deployedCapitalUsd, 0);
  // The settled readings, then NOW at the live marks: the cards and totals use
  // live prices, and a curve ending at the last cycle would disagree with them.
  const settled = aggregateEquityPath(marks, capitalNow);
  const nowAt = new Date(now).toISOString();
  const path = marks.length
    ? [...settled.filter((p) => p.at < nowAt), { at: nowAt, equityUsd: capitalNow + agentPnlUsd, pnlUsd: agentPnlUsd }]
    : settled;

  const window = (ms: number) => {
    // No reading before the cutoff means the whole path is inside the window,
    // and the path starts at zero P&L.
    const agentMove = path.length ? (movedOverUsd(path.map(toPoint), now - ms) ?? path.at(-1)!.pnlUsd) : 0;
    const total = agentMove + ownMovedSince(open, closed, now - ms);
    const base = investedUsd - total;
    return { usd: marks.length || open.length || closed.length ? total : null, pct: base > 0 ? (total / base) * 100 : null };
  };
  const today = window(DAY_MS);
  const d30 = window(30 * DAY_MS);

  let wins = 0;
  let closedN = 0;
  for (const h of agents) {
    wins += h.series?.winningPositions ?? 0;
    closedN += h.series?.closedPositions ?? 0;
  }
  for (const p of closed) {
    closedN += 1;
    if (p.pnlUsd > 0) wins += 1;
  }

  return {
    agents,
    inAgentsUsd,
    ownTradesUsd,
    investedUsd,
    agentPnlUsd,
    ownPnlUsd,
    todayUsd: today.usd,
    todayPct: today.pct,
    d30Usd: d30.usd,
    d30Pct: d30.pct,
    wins,
    closed: closedN,
    path,
  };
}

function toPoint(p: { at: string; equityUsd: number }, i: number) {
  return { tickSeq: i, at: p.at, equityUsd: p.equityUsd, cashUsd: null, highWaterMarkUsd: p.equityUsd };
}

/** The UTC calendar day of an instant, as `YYYY-MM-DD`. */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export interface DayPnl {
  day: string;
  pnlUsd: number;
}

/**
 * P&L per UTC day for the last `days` days, oldest first: the aggregate path's
 * change across the day (its last reading against the previous day's last),
 * plus your own trades closed that day.
 */
export function dailyPnl(
  path: { at: string; pnlUsd: number }[],
  ownClosed: Position[],
  days: number,
  now = Date.now(),
): DayPnl[] {
  const endOf = new Map<string, number>();
  for (const p of path) endOf.set(p.at.slice(0, 10), p.pnlUsd);
  const own = new Map<string, number>();
  for (const p of ownClosed) {
    if (!p.closedAt) continue;
    const k = p.closedAt.slice(0, 10);
    own.set(k, (own.get(k) ?? 0) + p.pnlUsd);
  }

  const out: DayPnl[] = [];
  const first = now - (days - 1) * DAY_MS;
  let carried = 0;
  for (const p of path) {
    if (Date.parse(p.at) < Date.parse(dayKey(first))) carried = p.pnlUsd;
    else break;
  }
  for (let i = 0; i < days; i++) {
    const k = dayKey(first + i * DAY_MS);
    const end = endOf.has(k) ? endOf.get(k)! : carried;
    out.push({ day: k, pnlUsd: end - carried + (own.get(k) ?? 0) });
    carried = end;
  }
  return out;
}

/** Daily P&L rolled up into calendar months, oldest first. */
export function monthlyPnl(days: DayPnl[]): DayPnl[] {
  const m = new Map<string, number>();
  for (const d of days) m.set(d.day.slice(0, 7), (m.get(d.day.slice(0, 7)) ?? 0) + d.pnlUsd);
  return [...m.entries()].map(([day, pnlUsd]) => ({ day, pnlUsd }));
}

export interface Slice {
  key: string;
  label: string;
  valueUsd: number;
}

export function byAgent(totals: BookTotals, ownLabel = "Your trades"): Slice[] {
  const out: Slice[] = totals.agents
    .filter((h) => (h.mark?.equityUsd ?? 0) > 0)
    .map((h) => ({ key: `a${h.agent.id}`, label: h.agent.strategy_name, valueUsd: h.mark!.equityUsd }));
  if (totals.ownTradesUsd > 0) out.push({ key: "own", label: ownLabel, valueUsd: totals.ownTradesUsd });
  return out.sort((a, b) => b.valueUsd - a.valueUsd);
}

/**
 * What the book holds by token: each agent's open positions at the prices it
 * was marked at, your own open trades, and the cash left over as USDC.
 */
export function byToken(totals: BookTotals, ownOpen: Position[]): Slice[] {
  const m = new Map<string, number>();
  const add = (sym: string, v: number) => {
    if (v > 0) m.set(sym, (m.get(sym) ?? 0) + v);
  };
  for (const h of totals.agents) {
    let inPositions = 0;
    for (const p of h.positions) {
      const v = valueOf(h, p);
      inPositions += v;
      add(p.symbol, v);
    }
    add("USDC", (h.mark?.equityUsd ?? 0) - inPositions);
  }
  for (const p of ownOpen) add(p.symbol, p.valueUsd);
  return [...m.entries()]
    .map(([sym, valueUsd]) => ({ key: sym, label: sym, valueUsd }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

/**
 * One agent position at the price its book was marked at: by mint, else by
 * symbol; unpriced is carried at cost, as the v1 portfolio carries it.
 */
function valueOf(h: Holding, p: Holding["positions"][number]): number {
  const prices = h.universe ?? [];
  const hit = (p.mint && prices.find((a) => a.mint === p.mint)) || prices.find((a) => a.symbol === p.symbol);
  const price = hit ? num(hit.priceUsd) : null;
  return positionValueUsd(p, price) ?? num(p.cost_basis_usd) ?? 0;
}

/** Value in open positions vs free cash, for one agent. */
export function agentUse(h: Holding): { inUseUsd: number; freeUsd: number } {
  const inUseUsd = h.positions.reduce((t, p) => t + valueOf(h, p), 0);
  const total = h.mark?.equityUsd ?? 0;
  return { inUseUsd: Math.min(inUseUsd, total), freeUsd: Math.max(0, total - inUseUsd) };
}

/** P&L over a window for one agent, from its own curve. Null without readings in the window. */
export function agentMoved(h: Holding, ms: number | null, now = Date.now()): number | null {
  if (!h.mark) return null;
  if (ms === null) return h.mark.pnlUsd;
  return movedOverUsd(h.mark.points, now - ms) ?? h.mark.pnlUsd;
}
