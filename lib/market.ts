// Types and plan math for the Feed and Trade screens.
//
// The wire shapes are the ones in docs/feed-trade-api.md. The backend is the
// source of truth for exit presets; they are mirrored here only so a card can
// draw its ladder and its "if every exit hits" figure without a round trip.

export const SOL_MINT = "So11111111111111111111111111111111111111112";

export type TokenList = "crypto" | "trending" | "held" | "new" | "stocks";

export const TOKEN_LISTS: { key: TokenList; label: string }[] = [
  { key: "crypto", label: "Crypto" },
  { key: "trending", label: "Trending" },
  { key: "held", label: "Most held" },
  { key: "new", label: "New" },
  { key: "stocks", label: "Stocks" },
];

export interface TokenRow {
  mint: string;
  symbol: string;
  name: string;
  icon: string | null;
  priceUsd: number | null;
  change1hPct: number | null;
  change24hPct: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  holderCount: number | null;
  category: string | null;
  createdAt: string | null;
}

export interface SafetyCheck {
  key: "mint" | "freeze" | "lp" | "top10" | "dev";
  label: string;
  value: string;
  status: "ok" | "warn" | "bad" | "unknown";
}

export interface Safety {
  score: number;
  checks: SafetyCheck[];
  checkedAt: string | null;
}

export interface TokenDetail {
  token: TokenRow;
  safety: Safety;
  top10Pct: number | null;
  devPct: number | null;
}

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type Timeframe = "1m" | "5m" | "15m" | "1h";
export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h"];

export interface LiveTrade {
  ts: number;
  side: "buy" | "sell";
  valueUsd: number;
  priceUsd: number;
  wallet: string;
}

export interface Holder {
  rank: number;
  wallet: string;
  sharePct: number;
  note: string | null;
}

export type ExitPlanKey = "steady" | "swing" | "runner" | "flip" | "moon" | "manual";

export interface ExitPlan {
  key: ExitPlanKey;
  takeProfitPct?: number;
  scaleOut?: { atPct: number; fraction: number }[];
  stopLossPct: number;
  breakevenAfterPct?: number;
  trailingStopPct?: number;
  maxHoldMinutes?: number;
}

export interface Position {
  id: string;
  mint: string;
  symbol: string;
  icon: string | null;
  entryPriceUsd: number;
  qty: number;
  costUsd: number;
  valueUsd: number;
  pnlUsd: number;
  pnlPct: number;
  takeProfitPriceUsd: number | null;
  stopPriceUsd: number | null;
  exitPlan: ExitPlan | null;
  source: string;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
}

export interface TradeAccount {
  ready: boolean;
  agentId: string | null;
  walletAddress: string | null;
  usdcBalance: number;
  solBalance: number;
  credits: number;
}

export interface TradeQuote {
  inAmount: number;
  outAmount: number;
  priceImpactPct: number;
  feeUsd: number;
  slippageBps: number;
  route: string;
  expiresAt: string;
}

export type IdeaCat = "trending" | "opportunities" | "moves" | "new";
export type FeedCat = "all" | IdeaCat;

export const FEED_CATS: { key: FeedCat; label: string }[] = [
  { key: "all", label: "All" },
  { key: "trending", label: "Trending" },
  { key: "opportunities", label: "Opportunities" },
  { key: "moves", label: "Moves" },
  { key: "new", label: "New tokens" },
];

export interface Idea {
  id: string;
  cat: IdeaCat;
  token: TokenRow;
  safety: Safety;
  headline: string;
  insight: string;
  ageLabel: string;
  levels: { priceUsd: number; label: string }[];
  flow: { label: string; buys: number; sells: number; buyPct: number };
  plan: ExitPlanKey;
  planOptions: ExitPlanKey[];
  highRisk: boolean;
  createdAt: string;
}

export interface FeedResponse {
  ideas: Idea[];
  counts: Partial<Record<FeedCat, number>>;
  updatedAt: string;
}

export interface CopilotSetup {
  verdict: "now" | "wait" | "skip";
  title: string;
  reason: string;
  entryPriceUsd: number;
  targetPriceUsd: number;
  stopPriceUsd: number;
  exitPlan: ExitPlan;
  validForSec: number;
  creditsLeft: number;
  why: { analyst: string; risk: string; route: string };
}

/* ------------------------------------------------------------ exit plans -- */

export const PLAN_PRESETS: Record<Exclude<ExitPlanKey, "manual">, { name: string; plan: ExitPlan }> = {
  steady: { name: "Steady", plan: { key: "steady", takeProfitPct: 6, stopLossPct: 3 } },
  swing: {
    name: "Swing",
    plan: {
      key: "swing",
      scaleOut: [
        { atPct: 5, fraction: 0.5 },
        { atPct: 10, fraction: 1 },
      ],
      stopLossPct: 4,
      breakevenAfterPct: 5,
    },
  },
  runner: {
    name: "Meme runner",
    plan: {
      key: "runner",
      scaleOut: [
        { atPct: 30, fraction: 0.5 },
        { atPct: 80, fraction: 1 },
      ],
      stopLossPct: 20,
      breakevenAfterPct: 30,
      maxHoldMinutes: 360,
    },
  },
  flip: { name: "Quick flip", plan: { key: "flip", takeProfitPct: 15, stopLossPct: 8, maxHoldMinutes: 60 } },
  moon: {
    name: "Moon bag",
    plan: { key: "moon", scaleOut: [{ atPct: 100, fraction: 0.5 }], trailingStopPct: 25, stopLossPct: 30 },
  },
};

export const ALL_PLANS = Object.keys(PLAN_PRESETS) as Exclude<ExitPlanKey, "manual">[];

export function planName(key: ExitPlanKey): string {
  return key === "manual" ? "Your plan" : PLAN_PRESETS[key].name;
}

export function presetPlan(key: ExitPlanKey): ExitPlan {
  return key === "manual" ? { key: "manual", takeProfitPct: 8, stopLossPct: 30 } : PLAN_PRESETS[key].plan;
}

export function manualPlan(takeProfitPct: number, stopLossPct: number): ExitPlan {
  return { key: "manual", takeProfitPct, stopLossPct };
}

/** "+6%", or "2x" once a target doubles the money. */
export function upLabel(pct: number): string {
  return pct >= 100 ? `${trimNum(pct / 100 + 1)}x` : `+${trimNum(pct)}%`;
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export interface LadderStep {
  atPct: number;
  /** Fraction of what remains at that point. */
  fraction: number;
  priceUsd: number;
}

export interface PlanMath {
  steps: LadderStep[];
  /** Share of the position left riding after the ladder (a trailing stop holds it). */
  rest: number;
  /** Gain on the position, as a fraction of cost, if every step fills. */
  gainK: number;
  stopPriceUsd: number;
  firstTargetUsd: number | null;
}

export function planMath(plan: ExitPlan, entry: number): PlanMath {
  const raw = plan.scaleOut?.length
    ? plan.scaleOut
    : plan.takeProfitPct != null
      ? [{ atPct: plan.takeProfitPct, fraction: 1 }]
      : [];
  let rem = 1;
  let gain = 0;
  const steps = raw.map((s) => {
    const q = rem * s.fraction;
    gain += q * (s.atPct / 100);
    rem -= q;
    return { atPct: s.atPct, fraction: s.fraction, priceUsd: entry * (1 + s.atPct / 100) };
  });
  return {
    steps,
    rest: rem,
    gainK: gain,
    stopPriceUsd: entry * (1 - plan.stopLossPct / 100),
    firstTargetUsd: steps[0]?.priceUsd ?? null,
  };
}

/** The ladder in words, one line per exit, the way the card reads it out. */
export function ladderLines(plan: ExitPlan, entry: number): { text: string; priceUsd: number | null; tone: "up" | "down" | "muted" }[] {
  const m = planMath(plan, entry);
  const lines: { text: string; priceUsd: number | null; tone: "up" | "down" | "muted" }[] = m.steps.map((s, i) => ({
    text: `${s.fraction >= 1 ? (i > 0 ? "Sell the rest" : "Sell all") : `Sell ${Math.round(s.fraction * 100)}%`} at ${upLabel(s.atPct)}`,
    priceUsd: s.priceUsd,
    tone: "up",
  }));
  if (m.rest > 0 && plan.trailingStopPct) {
    lines.push({
      text: `Keep ${Math.round(m.rest * 100)}% with a ${plan.trailingStopPct}% trailing stop`,
      priceUsd: null,
      tone: "muted",
    });
  }
  lines.push({
    text: `Stop loss at −${trimNum(plan.stopLossPct)}%${plan.breakevenAfterPct ? ", then break-even after the first sale" : ""}`,
    priceUsd: m.stopPriceUsd,
    tone: "down",
  });
  if (plan.maxHoldMinutes) {
    const h = plan.maxHoldMinutes / 60;
    lines.push({
      text: `Time exit after ${h >= 1 ? `${trimNum(h)}h` : `${plan.maxHoldMinutes}m`} if nothing hits`,
      priceUsd: null,
      tone: "muted",
    });
  }
  return lines;
}

/** Majors and stocks get the steady plan; everything else the meme runner. */
export function defaultPlanFor(token: Pick<TokenRow, "category" | "liquidityUsd">): ExitPlanKey {
  const cat = token.category ?? "";
  if (cat === "stock" || cat === "rwa" || cat === "lst" || cat === "stablecoin") return "steady";
  if (cat === "meme") return "runner";
  return (token.liquidityUsd ?? 0) >= 10_000_000 ? "steady" : "runner";
}

export function pctText(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}%`;
}

export function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export function ageText(tsSec: number, now = Date.now()): string {
  const s = Math.max(0, Math.round(now / 1000 - tsSec));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
