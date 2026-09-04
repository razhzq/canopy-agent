"use client";

import { useState } from "react";
import { Pill, PillRow, PillTag, StepHead } from "@/components/wizard";
import type {
  AddPlan,
  AddSizing,
  AddTrigger,
  DetectionRule,
  ExitRules,
} from "@/lib/api";
import { useT, type Translate, type TranslationKey } from "@/lib/i18n";

/**
 * Step 2 of the builder: what makes the agent buy.
 *
 * Templates lead, tuning is collapsed. The platforms that serve retail well
 * ship configured strategies and let you adjust; the ones that hand over a
 * blank canvas of primitives buy flexibility with a learning curve nobody
 * asked for. `note.md` sets the bar at five minutes.
 *
 * DELIBERATELY NOT A FUNDAMENTAL-VS-TECHNICAL FORK. Traders use both, so
 * exclusivity is worse than reality — and there is no price history behind the
 * Wintel contract today, so a "technical" branch would be a button with nothing
 * behind it. Analysis styles appear below as signal SOURCES, with the ones we
 * cannot yet honour shown as unavailable rather than hidden.
 */

/**
 * What a rule's number is measured against — which decides whether the
 * strategy's timeframe changes its meaning.
 *
 *   bars    computed from the price series, so its window IS the timeframe.
 *           "RSI 14" is a fortnight on daily bars and about three hours on 15m.
 *   daily   from the research feed (volatility, change on the day, event
 *           scores), which is daily whatever the strategy's timeframe is. A
 *           15-minute strategy still reads "change on the day" as the DAY.
 *   static  neither — pool depth, margin from filings. No time window at all.
 *
 * The distinction is not cosmetic: without it a 5-minute strategy would appear
 * to be filtering on 5-minute volatility while actually filtering on daily.
 */
export type RuleBasis = "bars" | "daily" | "static";

export interface RuleSpec {
  key: string;
  /**
   * Dictionary keys, not text.
   *
   * The catalogue below is module-level, so a finished string here would be
   * frozen in whichever language loaded first — and these two are the most
   * load-bearing strings in the product: someone reads them, sets a threshold,
   * and an agent trades on it. `ruleLabel` resolves the first against the
   * strategy's timeframe; `helpKey` is read straight by the slider.
   *
   * Unit-free. Windows come from `periods`, rendered against the timeframe.
   */
  labelKey: TranslationKey;
  helpKey: TranslationKey;
  op: "gte" | "lte";
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  basis: RuleBasis;
  /** Window in PERIODS, e.g. "14" or "20 vs 50". Only meaningful for `bars`. */
  periods?: string;
  /**
   * Whether this rule applies. Undefined means on, so the older two-step
   * builder keeps working unchanged.
   *
   * The compile step needs the distinction: a rule the sentence never mentioned
   * must not quietly apply a default the author did not ask for.
   */
  enabled?: boolean;
  /**
   * Which specialists gather the fact behind this rule.
   *
   * Not decoration: a rule whose fact the running specialist never produces is
   * skipped at screening time, so an author who sets it gets an agent that
   * quietly ignores one of its rules. Showing it and letting them set it is
   * worse than not offering it.
   */
  classes?: ("rwa" | "spot")[];
  /**
   * Whether this rule's USEFUL RANGE shrinks as the bar gets smaller.
   *
   * A percent-of-price threshold is not portable across bar sizes. "Min trend
   * ≥ 3%" is an ordinary ask on daily bars and unreachable on 15-minute ones,
   * where the 20/50 spread lives inside ±2% almost all the time — so the
   * slider handed someone a range whose bottom 90% was "off" and whose top was
   * "never matches", with a 1% step that stepped clean over everything real.
   *
   * `dispersion` marks the rules measured in percent of price, whose spread
   * scales with the square root of the bar's duration. `scaleRule` applies it.
   * Scale-free rules (RSI, Bollinger %B, a count of bars) carry nothing here.
   */
  scale?: "dispersion";
}

/**
 * Every key is a fact a specialist actually gathers, so a rule you set is a
 * rule that runs. A key the SME never produces would silently never apply and
 * the asset would simply never qualify, with nothing explaining why.
 *
 * `classes` says WHICH specialist. Three of these read research the crypto
 * specialist has no source for — an SPL token has no filer, no fundamentals and
 * no event feed — so they are RWA-only. Everything else is market structure or
 * a technical indicator over a close series, and both specialists produce those.
 */
export const RWA_RULES: RuleSpec[] = [
  {
    key: "liquidityUsd",
    labelKey: "rule_liquidityUsd",
    basis: "static",
    helpKey: "rule_liquidityUsd_help",
    op: "gte",
    value: 50_000,
    min: 0,
    max: 500_000,
    step: 10_000,
    unit: "$",
  },
  {
    key: "dailyVolPct",
    // RWA only — needs research market activity, which an SPL token does not have.
    classes: ["rwa"] as ("rwa" | "spot")[],
    labelKey: "rule_dailyVolPct",
    basis: "daily",
    helpKey: "rule_dailyVolPct_help",
    op: "lte",
    value: 5,
    min: 1,
    max: 15,
    step: 0.5,
    unit: "%",
  },
  {
    key: "maxEventScore",
    // RWA only — needs a detected-events feed, which an SPL token does not have.
    classes: ["rwa"] as ("rwa" | "spot")[],
    labelKey: "rule_maxEventScore",
    basis: "daily",
    helpKey: "rule_maxEventScore_help",
    op: "lte",
    value: 70,
    min: 0,
    max: 100,
    step: 5,
    unit: "",
  },
  {
    key: "netMarginPct",
    // RWA only — needs a balance sheet, which an SPL token does not have.
    classes: ["rwa"] as ("rwa" | "spot")[],
    labelKey: "rule_netMarginPct",
    basis: "static",
    helpKey: "rule_netMarginPct_help",
    op: "gte",
    value: 5,
    min: -20,
    max: 50,
    step: 1,
    unit: "%",
  },
  {
    key: "changePct",
    labelKey: "rule_changePct",
    basis: "daily",
    helpKey: "rule_changePct_help",
    op: "lte",
    value: -4,
    min: -20,
    max: 20,
    step: 0.5,
    unit: "%",
  },
  /**
   * The bar-basis sibling of `changePct`, and the reason it exists.
   *
   * "Max change on the day" is 24-hour change from the universe store — it does
   * NOT follow the strategy's timeframe, so on a 15-minute strategy it is the
   * one rule still asking about yesterday. Someone building an intraday entry
   * wants "has it moved over the last 20 bars", and the specialist has computed
   * exactly that all along (`rateOfChangePct` over 20 bars, published as
   * momentum20dPct) — the builder simply never offered it, so the only way to
   * reach it was to say "momentum" in a sentence and hope the composer heard.
   *
   * Named as the backend names it. The trailing "d" is a fossil from when every
   * bar was a day; the fact is 20 BARS at whatever size the strategy runs.
   */
  {
    key: "momentum20dPct",
    labelKey: "rule_momentum20dPct",
    basis: "bars",
    periods: "20",
    helpKey: "rule_momentum20dPct_help",
    op: "gte",
    value: 0,
    min: -50,
    max: 50,
    step: 1,
    unit: "%",
    scale: "dispersion",
  },
  // Technical, computed from daily closes. Windows fit the 120-day history.
  {
    key: "rsi14",
    labelKey: "rule_rsi14",
    basis: "bars",
    periods: "14",
    helpKey: "rule_rsi14_help",
    op: "lte",
    value: 70,
    min: 10,
    max: 90,
    step: 5,
    unit: "",
  },
  {
    key: "smaSpreadPct",
    labelKey: "rule_smaSpreadPct",
    basis: "bars",
    periods: "20 vs 50",
    helpKey: "rule_smaSpreadPct_help",
    op: "gte",
    value: 0,
    min: -20,
    max: 20,
    step: 1,
    unit: "%",
    scale: "dispersion",
  },
  {
    key: "belowHigh60dPct",
    labelKey: "rule_belowHigh60dPct",
    basis: "bars",
    periods: "60",
    helpKey: "rule_belowHigh60dPct_help",
    op: "gte",
    value: 0,
    min: 0,
    max: 60,
    step: 1,
    unit: "%",
    scale: "dispersion",
  },
  {
    key: "macdHistPct",
    labelKey: "rule_macdHistPct",
    basis: "bars",
    periods: "12/26/9",
    helpKey: "rule_macdHistPct_help",
    op: "gte",
    value: 0,
    min: -2,
    max: 2,
    step: 0.05,
    unit: "%",
    scale: "dispersion",
  },
  {
    key: "atrPct",
    labelKey: "rule_atrPct",
    basis: "bars",
    periods: "14",
    helpKey: "rule_atrPct_help",
    op: "lte",
    value: 10,
    min: 1,
    max: 50,
    step: 1,
    unit: "%",
    // CRYPTO ONLY, and structurally so. True range needs a high and a low per
    // bar; the tokenized-stock feed serves close and volume at every interval,
    // so a tokenized stock cannot satisfy this rule at all — and an unsatisfiable
    // rule now rejects the asset rather than being skipped, which would stop the
    // strategy trading entirely.
    classes: ["spot"] as ("rwa" | "spot")[],
    scale: "dispersion",
  },
  {
    key: "bollingerPctB",
    labelKey: "rule_bollingerPctB",
    basis: "bars",
    periods: "20",
    helpKey: "rule_bollingerPctB_help",
    op: "lte",
    value: 50,
    min: -20,
    max: 120,
    step: 5,
    unit: "",
  },
  {
    key: "bollingerBandwidthPct",
    labelKey: "rule_bollingerBandwidthPct",
    basis: "bars",
    periods: "20",
    helpKey: "rule_bollingerBandwidthPct_help",
    op: "lte",
    value: 20,
    min: 1,
    max: 40,
    step: 1,
    unit: "%",
    scale: "dispersion",
  },
  // SUPERTREND — the state, then the two events.
  //
  // Crypto-only for exactly the reason ATR is: it is built from ATR, so it
  // needs a high and a low per bar and the tokenized-stock feed serves neither.
  // An unsatisfiable rule REJECTS the asset rather than being skipped, so
  // offering these on a tokenized-stock strategy would silently stop it trading.
  {
    key: "supertrendDistancePct",
    labelKey: "rule_supertrendDistancePct",
    basis: "bars",
    periods: "10 · ×3",
    helpKey: "rule_supertrendDistancePct_help",
    op: "gte",
    value: 0,
    min: -20,
    max: 20,
    step: 0.5,
    unit: "%",
    classes: ["spot"] as ("rwa" | "spot")[],
    scale: "dispersion",
  },
  {
    key: "supertrendFlipUpBars",
    labelKey: "rule_supertrendFlipUpBars",
    basis: "bars",
    periods: "10 · ×3",
    helpKey: "rule_supertrendFlipUpBars_help",
    op: "lte",
    value: 3,
    min: 0,
    max: 20,
    step: 1,
    unit: " bars",
    classes: ["spot"] as ("rwa" | "spot")[],
  },
  {
    key: "supertrendFlipDownBars",
    labelKey: "rule_supertrendFlipDownBars",
    basis: "bars",
    periods: "10 · ×3",
    helpKey: "rule_supertrendFlipDownBars_help",
    op: "lte",
    value: 3,
    min: 0,
    max: 20,
    step: 1,
    unit: " bars",
    classes: ["spot"] as ("rwa" | "spot")[],
  },
];

/** Bar sizes a strategy's technical rules can be measured on. */
export type Timeframe = "1d" | "1h" | "30m" | "15m" | "5m" | "1m";
export const DEFAULT_TIMEFRAME: Timeframe = "1d";

export const TIMEFRAMES: {
  tf: Timeframe;
  labelKey: TranslationKey;
  detailKey: TranslationKey;
  /**
   * Which asset classes are actually SERVED at this bar size.
   *
   * Not a preference. A crypto strategy set to 30m is refused by the specialist
   * at screening time — GeckoTerminal builds minute bars up to 15 and hour bars
   * from 60, so there is no combination that yields 30, and CRYPTO_TIMEFRAMES
   * in the agent stack says so. Offering the pill anyway produced an agent that
   * passed every validation, deployed, woke on schedule and bought nothing,
   * with the reason buried in a screening trace nobody opens.
   */
  classes?: ("rwa" | "spot")[];
}[] = [
  { tf: "1d", labelKey: "tf_1d", detailKey: "tf_1d_detail" },
  { tf: "1h", labelKey: "tf_1h", detailKey: "tf_1h_detail" },
  {
    tf: "30m",
    labelKey: "tf_30m",
    detailKey: "tf_30m_detail",
    classes: ["rwa"] as ("rwa" | "spot")[],
  },
  { tf: "15m", labelKey: "tf_15m", detailKey: "tf_15m_detail" },
  { tf: "5m", labelKey: "tf_5m", detailKey: "tf_5m_detail" },
  {
    // The mirror of 30m, and refused for the mirror reason: GeckoTerminal
    // serves minute/1 for a Solana pool, and Wintel's bar contract stops at 5m
    // because equity and commodity bars are collected per symbol upstream. An
    // RWA strategy on 1m would deploy, wake every minute and compute no
    // technical fact at all.
    tf: "1m",
    labelKey: "tf_1m",
    detailKey: "tf_1m_detail",
    classes: ["spot"] as ("rwa" | "spot")[],
  },
];

/** The bar sizes one class can actually be screened at. */
export function timeframesForClass(strategyClass: "rwa" | "spot"): Timeframe[] {
  return TIMEFRAMES.filter((t) => !t.classes || t.classes.includes(strategyClass)).map((t) => t.tf);
}

/**
 * How many bars of this size fall in a day. The basis for every span and scale
 * below, and the reason none of them are hand-written tables.
 */
export const BARS_PER_DAY: Record<Timeframe, number> = {
  "1d": 1,
  "1h": 24,
  "30m": 48,
  "15m": 96,
  "5m": 288,
  "1m": 1440,
};

/**
 * How much narrower a percent-of-price threshold gets at this bar size.
 *
 * Price dispersion grows with the square root of elapsed time — the standard
 * result, and close enough on real crypto series to be the right shape for a
 * slider. A 20/50 spread that lives inside ±20% on daily bars lives inside
 * roughly ±2% on 15-minute ones, so the daily range is not a wide version of
 * the right range: it is the wrong range, with a step that jumps over every
 * value the author might have meant.
 *
 * Rounded to whole numbers so the bounds a person sees are stable and legible
 * rather than 9.7979-ths of something. 1d: 1 · 1h: 5 · 30m: 7 · 15m: 10 · 5m: 17.
 */
export function dispersionScale(timeframe: Timeframe): number {
  return Math.max(1, Math.round(Math.sqrt(BARS_PER_DAY[timeframe])));
}

/**
 * Snap a step onto the 1 / 2 / 5 grid every real slider uses.
 *
 * Dividing a daily step by 17 gives 0.0294, and a slider stepping in 0.0294
 * lands on 0.0294, 0.0588, 0.0882 — numbers no one would ever choose to type.
 * The grid keeps the reachable values round at every bar size.
 */
function tidyStep(n: number): number {
  if (!(n > 0)) return 0.001;
  const exp = Math.floor(Math.log10(n));
  const base = n / 10 ** exp;
  const snapped = base < 1.5 ? 1 : base < 3.5 ? 2 : base < 7.5 ? 5 : 10;
  return Number((snapped * 10 ** exp).toPrecision(2));
}

/** Round to a sane number of decimals for a bound this size. */
function tidy(n: number): number {
  const abs = Math.abs(n);
  const dp = abs >= 10 ? 0 : abs >= 1 ? 1 : abs >= 0.1 ? 2 : 3;
  return Number(n.toFixed(dp));
}

/**
 * A rule's bounds AS THEY APPLY at this timeframe.
 *
 * The specs above are written in daily terms and stay that way — they are the
 * base, and every other bar size is derived from them, so there is one table to
 * keep true rather than five. Only `scale: "dispersion"` rules move; RSI,
 * Bollinger %B and bar counts come back untouched.
 *
 * `value` is NOT scaled here. It is the author's own threshold, already in the
 * units of whatever timeframe they set it at — rescaling it on every render
 * would drag their number around behind them. `rescaleRuleValue` moves it once,
 * at the moment the timeframe actually changes.
 */
export function scaleRule(spec: RuleSpec, timeframe: Timeframe): RuleSpec {
  if (spec.scale !== "dispersion") return spec;
  const f = dispersionScale(timeframe);
  if (f === 1) return spec;
  return {
    ...spec,
    min: tidy(spec.min / f),
    max: tidy(spec.max / f),
    // Never zero: a zero step makes a range input refuse every drag.
    step: Math.max(tidyStep(spec.step / f), 0.001),
  };
}

/**
 * Move a threshold from one bar size to another, preserving what it MEANT.
 *
 * "Min trend ≥ 3%" carried unchanged onto 15-minute bars is not a stricter
 * version of the same ask — it is a filter nothing passes, which reads on the
 * dashboard as a broken agent rather than as a setting. Scaled, it becomes
 * ≥ 0.3%: the same position in the same distribution, which is what the author
 * chose even though the number they typed was 3.
 *
 * Returns the value untouched for scale-free rules, and for 0 — a floor at zero
 * means "must be positive" at every bar size, and scaling it would be arithmetic
 * on an intent that has no units.
 */
export function rescaleRuleValue(rule: RuleSpec, from: Timeframe, to: Timeframe): number {
  if (rule.scale !== "dispersion" || rule.value === 0) return rule.value;
  const scaled = (rule.value * dispersionScale(from)) / dispersionScale(to);
  const bounds = scaleRule(rule, to);
  return Math.min(bounds.max, Math.max(bounds.min, tidy(scaled)));
}

/**
 * What a rule's window is in wall-clock time, e.g. "≈ 3h 30m".
 *
 * The one thing the label cannot say. "Max RSI (14 × 15m)" is honest and still
 * leaves the reader doing arithmetic to find out they are filtering on three
 * and a half hours of selling — which is the whole difference between the rule
 * they think they set and the one they set.
 *
 * Null when the window is not a plain count of bars (MACD's 12/26/9, a 20 vs 50
 * spread) or on daily, where the label already reads in days.
 */
export function ruleSpan(spec: RuleSpec, timeframe: Timeframe, t: Translate): string | null {
  if (spec.basis !== "bars" || !spec.periods || timeframe === "1d") return null;
  const bars = Number(spec.periods);
  if (!Number.isFinite(bars) || bars <= 0) return null;
  const minutes = (bars * 1440) / BARS_PER_DAY[timeframe];
  if (minutes < 60) return t("rule_span_minutes", { n: Math.round(minutes) });
  const hours = minutes / 60;
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round(minutes - h * 60);
    return m === 0 ? t("rule_span_hours", { n: h }) : t("rule_span_hours_minutes", { h, m });
  }
  const days = hours / 24;
  return t("rule_span_days", { n: days < 10 ? days.toFixed(1) : Math.round(days) });
}

/**
 * How a rule reads at a given timeframe.
 *
 * The whole reason this function exists rather than a hardcoded string: "Max
 * RSI (14d)" was correct while daily was the only option and becomes a LIE at
 * any other. A user on 15-minute bars reading "14d" would set a threshold for
 * a fortnight of selling and get one for three hours of it — same label, same
 * number, a different statistic, and nothing on screen to reveal the swap.
 *
 * Daily-basis rules say "daily" out loud for the mirror-image reason: they do
 * NOT follow the timeframe, so on a 5-minute strategy they are the one thing
 * still measured in days.
 */
export function ruleLabel(
  spec: RuleSpec,
  timeframe: Timeframe = DEFAULT_TIMEFRAME,
  t: Translate,
): string {
  const label = t(spec.labelKey);
  if (spec.basis !== "bars" || !spec.periods) return label;
  // "14d" reads better than "14 × 1d" and is what every chart calls it.
  return timeframe === "1d"
    ? t("rule_window_daily", { label, periods: spec.periods })
    : t("rule_window_bars", { label, periods: spec.periods, timeframe });
}

/** One line stating what a rule is measured against. Pairs with the label. */
export function ruleBasisNote(
  spec: RuleSpec,
  timeframe: Timeframe = DEFAULT_TIMEFRAME,
  t: Translate,
): string | null {
  if (spec.basis !== "daily" || timeframe === "1d") return null;
  // Naming the replacement, not just the problem. "Does not follow the
  // timeframe" told an intraday author their rule was wrong and left them with
  // no way to say the thing they meant — while the fact that says it has been
  // computed on their own bars the whole time, one row down this list.
  if (spec.key === "changePct") return t("rule_basis_change");
  return t("rule_basis_daily");
}

/**
 * How often the agent wakes.
 *
 * Cadence is NOT chart timeframe — that is TIMEFRAMES above, and the two are
 * now separate choices because the data finally supports it. This is how often
 * the agent looks; timeframe is the resolution of what it looks at.
 *
 * The pairing that makes sense is cadence == timeframe: one new bar per cycle.
 * Faster re-reads a bar that has not changed and pays for an LLM call to reach
 * the same conclusion; slower steps over bars without ever seeing them.
 *
 * The one-minute floor is the smallest bar any upstream feed builds. It is
 * reachable because the sweep cron runs every fifteen seconds, so an agent that
 * becomes due is ticked inside a quarter of its own period.
 */
export const CADENCES: { sec: number; labelKey: TranslationKey; detailKey: TranslationKey }[] = [
  { sec: 60, labelKey: "cad_1m", detailKey: "cad_1m_detail" },
  { sec: 300, labelKey: "cad_5m", detailKey: "cad_5m_detail" },
  { sec: 900, labelKey: "cad_15m", detailKey: "cad_15m_detail" },
  // Present for the same reason as the 30-minute timeframe: without it,
  // picking 30m bars moved cadence to a value with no pill to show it, so the
  // row rendered with nothing selected and the choice looked lost.
  { sec: 1800, labelKey: "cad_30m", detailKey: "cad_30m_detail" },
  { sec: 3600, labelKey: "cad_1h", detailKey: "cad_1h_detail" },
  { sec: 14_400, labelKey: "cad_4h", detailKey: "cad_4h_detail" },
  { sec: 86_400, labelKey: "cad_1d", detailKey: "cad_1d_detail" },
];

/** The cadence that gives exactly one new bar per cycle. */
export const CADENCE_FOR_TIMEFRAME: Record<Timeframe, number> = {
  "1d": 86_400,
  "1h": 3600,
  "30m": 1800,
  "15m": 900,
  "5m": 300,
  "1m": 60,
};

/**
 * Templates are the entry point, not a shortcut. Each is a complete, runnable
 * position — every value below is one the SME can evaluate today.
 */
export const TEMPLATES = [
  {
    key: "quality",
    titleKey: "tpl_quality",
    bodyKey: "tpl_quality_body",
    metaKey: "tpl_quality_meta",
    values: { liquidityUsd: 50_000, dailyVolPct: 5, maxEventScore: 70, netMarginPct: 5 },
    exits: { takeProfitPct: 25, stopLossPct: 12, maxHoldDays: 0 },
  },
  {
    key: "averse",
    titleKey: "tpl_averse",
    bodyKey: "tpl_averse_body",
    metaKey: "tpl_averse_meta",
    values: { liquidityUsd: 100_000, dailyVolPct: 3, maxEventScore: 30, netMarginPct: 8 },
    exits: { takeProfitPct: 15, stopLossPct: 8, maxHoldDays: 45 },
  },
  {
    key: "opportunistic",
    titleKey: "tpl_opportunistic",
    bodyKey: "tpl_opportunistic_body",
    metaKey: "tpl_opportunistic_meta",
    values: { liquidityUsd: 50_000, dailyVolPct: 10, maxEventScore: 85, netMarginPct: 0 },
    exits: { takeProfitPct: 45, stopLossPct: 20, maxHoldDays: 14 },
  },
] as const;

/**
 * Where an entry signal can come from.
 *
 * The unavailable ones are the data-partner roadmap made visible. Showing them
 * greyed is more honest than hiding them and more useful than a button that
 * does nothing.
 */
// `via` is a company name in every row and stays as it is.
const SOURCES: { nameKey: TranslationKey; detailKey: TranslationKey; via: string; ready: boolean }[] = [
  { nameKey: "src_fundamentals", detailKey: "src_fundamentals_detail", via: "Wintel", ready: true },
  { nameKey: "src_news", detailKey: "src_news_detail", via: "Wintel", ready: true },
  { nameKey: "src_technical", detailKey: "src_technical_detail", via: "Wintel", ready: true },
  { nameKey: "src_sentiment", detailKey: "src_sentiment_detail", via: "Elfa.ai", ready: false },
  { nameKey: "src_smart_money", detailKey: "src_smart_money_detail", via: "Nansen", ready: false },
];

export function fmt(v: number, unit: string): string {
  if (unit === "$") return v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;
  return `${v}${unit}`;
}

export const toPayload = (rules: RuleSpec[]): DetectionRule[] =>
  rules.map((r) => ({ key: r.key, op: r.op, value: r.value }));

export function StrategyStep({
  rules,
  onChange,
  template,
  onTemplate,
  exits,
  onExits,
  cadenceSec,
  onCadence,
  timeframe = DEFAULT_TIMEFRAME,
  onTimeframe,
}: {
  rules: RuleSpec[];
  onChange: (next: RuleSpec[]) => void;
  template: string | null;
  onTemplate: (key: string) => void;
  exits: ExitRules;
  onExits: (next: ExitRules) => void;
  cadenceSec: number;
  onCadence: (sec: number) => void;
  timeframe?: Timeframe;
  onTimeframe?: (tf: Timeframe) => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();

  function pick(key: string): void {
    // `tpl`, not `t` — the translator owns that name in this component.
    const tpl = TEMPLATES.find((x) => x.key === key);
    if (!tpl) return;
    const values = tpl.values as Record<string, number>;
    onChange(rules.map((r) => (r.key in values ? { ...r, value: values[r.key] } : r)));
    onExits({ ...tpl.exits });
    onTemplate(key);
  }

  function setExit(patch: Partial<ExitRules>): void {
    onExits({ ...exits, ...patch });
    onTemplate("");
  }

  function setRule(key: string, value: number): void {
    onChange(rules.map((r) => (r.key === key ? { ...r, value } : r)));
    // Adjusting a value means this is no longer that template. Say so rather
    // than leaving a card highlighted that no longer describes the rules.
    onTemplate("");
  }

  const active = TEMPLATES.find((x) => x.key === template);

  return (
    <div className="space-y-7">
      <section>
        <StepHead
          index="01"
          title={t("bs_starting_point")}
          note={t("bs_starting_note")}
        />
        <PillRow>
          {TEMPLATES.map((tpl) => (
            <Pill key={tpl.key} active={template === tpl.key} onClick={() => pick(tpl.key)}>
              {t(tpl.titleKey)}
            </Pill>
          ))}
          {!template ? <Pill active>{t("bs_custom")}</Pill> : null}
        </PillRow>
        <p className="max-w-[64ch] pt-4 font-ui text-[13px] leading-relaxed text-text-secondary">
          {active ? (
            <>
              {t(active.bodyKey)}{" "}
              <span className="font-mono text-[11.5px] text-text-dim">
                {t("bs_template_meta", { meta: t(active.metaKey) })}
              </span>
            </>
          ) : (
            t("bs_adjusted")
          )}
        </p>
      </section>

      <section>
        <StepHead index="02" title={t("bs_entry_rules")} note={t("bs_entry_note")} />

        <div className="flex flex-wrap items-center gap-2">
          {rules.map((r) => (
            <PillTag key={r.key} tone="accent">
              {ruleLabel(r, timeframe, t)} {r.op === "gte" ? "≥" : "≤"} {fmt(r.value, r.unit)}
            </PillTag>
          ))}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="h-9 px-2 font-mono text-[10.5px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:text-accent"
          >
            {t(open ? "bs_done" : "bs_tune")}
          </button>
        </div>

        {open ? (
          <div className="mt-4 border-t border-grid">
            {rules.map((r) => (
              <Slider
                key={r.key}
                label={ruleLabel(r, timeframe, t)}
                qualifier={t(r.op === "gte" ? "rule_at_least" : "rule_at_most")}
                help={t(r.helpKey)}
                value={r.value}
                min={r.min}
                max={r.max}
                step={r.step}
                display={fmt(r.value, r.unit)}
                onChange={(v) => setRule(r.key, v)}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <StepHead index="03" title={t("bs_exit_rules")} note={t("bs_exit_note")} />
        <div className="border-t border-grid">
          <Slider
            label={t("bs_take_profit")}
            help={t("bs_take_profit_help")}
            value={exits.takeProfitPct}
            min={2}
            max={200}
            step={1}
            display={`+${exits.takeProfitPct}%`}
            onChange={(v) => setExit({ takeProfitPct: v })}
          />
          <Slider
            label={t("bs_stop_loss")}
            help={t("bs_stop_loss_help")}
            value={exits.stopLossPct}
            min={1}
            max={90}
            step={1}
            display={`−${exits.stopLossPct}%`}
            onChange={(v) => setExit({ stopLossPct: v })}
          />
          <Slider
            label={t("bs_time_limit")}
            help={t("bs_time_limit_help")}
            value={exits.maxHoldDays ?? 0}
            min={0}
            max={180}
            step={1}
            display={
              exits.maxHoldDays
                ? t("bs_days", { n: exits.maxHoldDays })
                : t("bs_time_never")
            }
            onChange={(v) => setExit({ maxHoldDays: v })}
          />
          {/*
            The same limit at a resolution a fast strategy can express, and
            shown only where it means something.

            A day is not a unit a minute-bar thesis has: the shortest limit the
            slider above can express is 1, which is 1,440 bars, so a scalper
            setting a "time stop" was setting no time stop at all. Hidden on
            slower timeframes rather than merely defaulted to zero, because a
            second time control on a daily strategy is a question nobody asked
            and one more thing to read.

            Both may be set — the engine takes the EARLIER deadline — so this
            can only tighten what the slider above already says.
          */}
          {(timeframe === "1m" || timeframe === "5m" || timeframe === "15m") && (
            <Slider
              label={t("bs_time_limit_mins")}
              help={t("bs_time_limit_mins_help")}
              value={exits.maxHoldMinutes ?? 0}
              min={0}
              max={1440}
              step={5}
              display={
                exits.maxHoldMinutes
                  ? t("bs_minutes", { n: exits.maxHoldMinutes })
                  : t("bs_time_never")
              }
              onChange={(v) => setExit({ maxHoldMinutes: v })}
            />
          )}
        </div>
        <p className="pt-3 font-ui text-[12.5px] leading-relaxed text-text-secondary">
          {t("bs_exits_note")}
        </p>

        <div className="mt-5 flex items-center justify-between gap-4 border-t border-grid pt-4">
          <div>
            <p className="font-ui text-[12.5px] text-text-primary">{t("bs_basket_title")}</p>
            <p className="pt-0.5 max-w-[56ch] font-ui text-[11.5px] leading-relaxed text-text-dim">
              {t("bs_basket_body")}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setExit({
                basket: exits.basket ? undefined : { takeProfitPct: 10 },
              })
            }
            aria-pressed={!!exits.basket}
            className={`h-8 shrink-0 rounded-full border px-3 font-mono text-[10px] tracking-[0.08em] uppercase transition-colors ${
              exits.basket
                ? "border-accent text-accent"
                : "border-grid text-text-muted hover:text-text-secondary"
            }`}
          >
            {t(exits.basket ? "bs_basket_on" : "bs_basket_off")}
          </button>
        </div>

        {exits.basket ? (
          <div className="border-t border-grid">
            <Slider
              label={t("bs_basket_take")}
              help={t("bs_basket_take_help")}
              value={exits.basket.takeProfitPct ?? 0}
              min={0}
              max={200}
              step={1}
              display={
                exits.basket.takeProfitPct
                  ? `+${exits.basket.takeProfitPct}%`
                  : t("bs_time_never")
              }
              onChange={(v) =>
                setExit({ basket: { ...exits.basket, takeProfitPct: v || undefined } })
              }
            />
            <Slider
              label={t("bs_basket_stop")}
              help={t("bs_basket_stop_help")}
              value={exits.basket.stopLossPct ?? 0}
              min={0}
              max={90}
              step={1}
              display={
                exits.basket.stopLossPct
                  ? `−${exits.basket.stopLossPct}%`
                  : t("bs_time_never")
              }
              onChange={(v) =>
                setExit({ basket: { ...exits.basket, stopLossPct: v || undefined } })
              }
            />
          </div>
        ) : null}
      </section>

      {onTimeframe ? (
        <section>
          <StepHead
            index="04"
            title={t("bs_timeframe")}
            note={t("bs_timeframe_note")}
          />
          <PillRow>
            {TIMEFRAMES.map((tf) => (
              <Pill
                key={tf.tf}
                active={timeframe === tf.tf}
                onClick={() => {
                  onTimeframe(tf.tf);
                  // Move cadence with it. Leaving a 1-day cadence on a
                  // 5-minute chart reads every 288th bar and ignores the rest,
                  // which is not a thing anyone picks on purpose — and the
                  // pairing is still editable in the next step.
                  onCadence(CADENCE_FOR_TIMEFRAME[tf.tf]);
                }}
              >
                {t(tf.labelKey)}
              </Pill>
            ))}
          </PillRow>
          <p className="max-w-[64ch] pt-4 font-ui text-[12.5px] leading-relaxed text-text-secondary">
            {(() => {
              const hit = TIMEFRAMES.find((tf) => tf.tf === timeframe);
              return hit ? t(hit.detailKey) : null;
            })()}{" "}
            <span className="text-text-dim">{t("bs_timeframe_help")}</span>
          </p>
        </section>
      ) : null}

      <section>
        <StepHead
          index={onTimeframe ? "05" : "04"}
          title={t("bs_cycle")}
          note={t("bs_cycle_note")}
        />
        <PillRow>
          {CADENCES.map((c) => (
            <Pill key={c.sec} active={cadenceSec === c.sec} onClick={() => onCadence(c.sec)}>
              {t(c.labelKey)}
            </Pill>
          ))}
        </PillRow>
        <p className="max-w-[64ch] pt-4 font-ui text-[12.5px] leading-relaxed text-text-secondary">
          {(() => {
            const hit = CADENCES.find((c) => c.sec === cadenceSec);
            return hit ? t(hit.detailKey) : null;
          })()}{" "}
          <span className="text-text-dim">
            {t(
              cadenceSec === CADENCE_FOR_TIMEFRAME[timeframe]
                ? "bs_cadence_matched"
                : cadenceSec < CADENCE_FOR_TIMEFRAME[timeframe]
                  ? "bs_cadence_faster"
                  : "bs_cadence_slower",
            )}
          </span>
        </p>
      </section>

      <section>
        <StepHead
          index={onTimeframe ? "06" : "05"}
          title={t("bs_sources")}
          note={t("bs_sources_note")}
        />
        <PillRow>
          {SOURCES.map((src) => (
            <PillTag key={src.nameKey} tone={src.ready ? "accent" : "dim"} suffix={src.via}>
              {t(src.nameKey)}
            </PillTag>
          ))}
        </PillRow>
        <p className="max-w-[64ch] pt-4 font-ui text-[12.5px] leading-relaxed text-text-secondary">
          {t("bs_sources_help")}
        </p>
      </section>
    </div>
  );
}

/**
 * One labelled slider row.
 *
 * Was two near-identical components — the entry rules had their own, the exits
 * had another. Same grid, same three columns, drifting apart.
 *
 * Borderless: the rows sit under a single hairline rather than each inside its
 * own box, so a column of them reads as a list instead of a stack of crates.
 */
function Slider({
  label,
  qualifier,
  help,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  qualifier?: string;
  help: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid gap-3 border-b border-grid py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_220px_76px] lg:items-center lg:gap-5">
      <div className="min-w-0">
        <p className="font-mono text-[12px] text-text-primary">
          {label}
          {qualifier ? <span className="text-text-dim"> {qualifier}</span> : null}
        </p>
        <p className="pt-0.5 font-ui text-[11.5px] leading-relaxed text-text-dim">{help}</p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="accent-accent"
      />
      <span className="tnum text-right font-mono text-[13px] text-accent">{display}</span>
    </div>
  );
}

/** Platform default when no template has been picked. */
export const DEFAULT_EXITS: ExitRules = { takeProfitPct: 25, stopLossPct: 12, maxHoldDays: 0 };

/* ------------------------------------------------------------ accumulation -- */

/**
 * Buying more of something the agent already holds.
 *
 * OFF BY DEFAULT, AND THE DEFAULT IS THE PRODUCT DECISION.
 *
 * Every strategy that exists buys once per asset. Accumulation is a different
 * shape of strategy, not a setting to nudge, so the card starts collapsed with
 * one switch — and turning it on says plainly what it changes about the exits
 * above, because that is the part nobody expects.
 */
const SPACINGS: { sec: number; labelKey: TranslationKey }[] = [
  { sec: 3600, labelKey: "sp_1h" },
  { sec: 86_400, labelKey: "sp_1d" },
  { sec: 604_800, labelKey: "sp_1w" },
  { sec: 2_592_000, labelKey: "sp_1mo" },
];

/** A starting plan that is coherent on its own — weekly, fixed, bounded. */
const DEFAULT_ADD_PLAN: AddPlan = {
  // "all" is what makes the rules guard a GUARD: with "any" it would be an
  // alternative reason to buy rather than a condition on buying.
  mode: "all",
  triggers: [{ kind: "schedule", everySec: 604_800 }],
  sizing: { kind: "fixedUsd", usd: 100 },
  maxAdds: 10,
  minSpacingSec: 86_400,
};

/**
 * The same coherence checks the backend runs, so the author sees them while
 * editing rather than after submitting.
 *
 * Deliberately duplicated rather than fetched: a warning that needs a round
 * trip does not appear while someone is dragging a slider, which is exactly
 * when it is useful. The backend remains the authority and warns again on
 * create — this copy existing does not make that one optional.
 */
export function localAddPlanWarnings(
  plan: AddPlan | undefined,
  exits: ExitRules,
  t: Translate,
): string[] {
  if (!plan) return [];
  const out: string[] = [];
  const stop = Math.abs(exits.stopLossPct);
  const target = Math.abs(exits.takeProfitPct);

  // `trig`, not `t` — the translator owns that name now.
  for (const trig of plan.triggers) {
    if (trig.kind === "drawdown" && trig.pct >= stop) {
      out.push(t("warn_drawdown_never", { pct: trig.pct, stop }));
    } else if (trig.kind === "drawdown" && stop - trig.pct <= 3) {
      out.push(
        t("warn_drawdown_tight", {
          pct: trig.pct,
          gap: (stop - trig.pct).toFixed(0),
          stop,
        }),
      );
    }
    // The stop collision, stated the only way it honestly can be for a rung
    // with no fixed depth. Whether it fires depends on a reading taken every
    // cycle, so this names the volatility at which the rung crosses the stop —
    // a number the author can check against the assets they picked.
    if (trig.kind === "drawdownVolatility" && stop > 0) {
      const crossesAt = stop / Math.abs(trig.multiple);
      out.push(
        t("warn_vol_crosses", {
          multiple: trig.multiple,
          measure: t(trig.measure === "atr" ? "acc_measure_atr" : "acc_measure_bandwidth"),
          crossesAt: crossesAt.toFixed(1),
          stop,
        }),
      );
    }
    if (trig.kind === "gain" && trig.pct >= target) {
      out.push(t("warn_gain_never", { pct: trig.pct, target }));
    }
  }

  const first =
    plan.sizing.kind === "fixedUsd"
      ? plan.sizing.usd
      : plan.sizing.kind === "ladder"
        ? plan.sizing.baseUsd
        : null;
  if (plan.maxTotalUsd !== undefined && first !== null && plan.maxTotalUsd < first) {
    out.push(t("warn_ceiling_below_first", { ceiling: plan.maxTotalUsd, first }));
  }
  if (plan.sizing.kind === "ladder" && plan.sizing.factor > 1 && plan.maxAdds === undefined) {
    out.push(t("warn_ladder_unbounded"));
  }
  return out;
}

export function AddPlanCard({
  plan,
  exits,
  onChange,
  strategyClass,
}: {
  plan?: AddPlan;
  exits: ExitRules;
  onChange: (next: AddPlan | undefined) => void;
  /**
   * Which specialist screens this strategy — it decides whether ATR is offered.
   *
   * ATR needs a high and a low per bar and only the crypto feed carries them,
   * so an ATR-spaced plan on a tokenized stock would never add, ever. Offering
   * a control that silently does nothing is worse than not offering it, which
   * is the same rule the entry catalogue applies with `classes`.
   */
  strategyClass: "rwa" | "spot";
}) {
  const t = useT();
  const on = !!plan;
  const warnings = localAddPlanWarnings(plan, exits, t);

  // The plan has one TIMING trigger — schedule, falls, or rises — and may also
  // carry `rules` alongside it. They are edited separately because they answer
  // different questions: when to consider adding, and whether to allow it.
  const timing = plan?.triggers.find((t) => t.kind !== "rules");
  const guarded = !!plan?.triggers.some((t) => t.kind === "rules");

  const writeTriggers = (next: AddTrigger[]) =>
    onChange(plan ? { ...plan, triggers: next } : { ...DEFAULT_ADD_PLAN, triggers: next });

  const setTrigger = (t: AddTrigger) =>
    writeTriggers(guarded ? [t, { kind: "rules" }] : [t]);

  const setGuard = (want: boolean) => {
    const base = timing ?? { kind: "schedule" as const, everySec: 604_800 };
    writeTriggers(want ? [base, { kind: "rules" }] : [base]);
  };

  const setSizing = (sizing: AddSizing) => plan && onChange({ ...plan, sizing });

  const trigger = timing;

  return (
    <section>
      <StepHead
        index="04"
        title={t("acc_title")}
        note={t("acc_note")}
      />

      <button
        type="button"
        onClick={() => onChange(on ? undefined : DEFAULT_ADD_PLAN)}
        aria-pressed={on}
        className={`h-8 rounded-full border px-3 font-mono text-[10px] tracking-[0.08em] uppercase transition-colors ${
          on ? "border-accent text-accent" : "border-grid text-text-muted hover:text-text-secondary"
        }`}
      >
        {t(on ? "acc_on" : "acc_off")}
      </button>

      {!on ? (
        <p className="max-w-[64ch] pt-3 font-ui text-[12.5px] leading-relaxed text-text-secondary">
          {t("acc_off_body")}
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {plan?.perLotExits ? (
            <p className="max-w-[64ch] font-ui text-[12.5px] leading-relaxed text-text-secondary">
              {t("acc_perlot_note")}
            </p>
          ) : (
            <p className="max-w-[64ch] font-ui text-[12.5px] leading-relaxed text-warning">
              {t("acc_blend_warning")}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 border border-grid px-3 py-2.5">
            <div>
              <p className="font-ui text-[12.5px] text-text-primary">{t("acc_perlot_title")}</p>
              <p className="pt-0.5 font-ui text-[11.5px] leading-relaxed text-text-dim">
                {t("acc_perlot_body")}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                plan && onChange({ ...plan, perLotExits: !plan.perLotExits })
              }
              aria-pressed={!!plan?.perLotExits}
              className={`h-8 shrink-0 rounded-full border px-3 font-mono text-[10px] tracking-[0.08em] uppercase transition-colors ${
                plan?.perLotExits
                  ? "border-accent text-accent"
                  : "border-grid text-text-muted hover:text-text-secondary"
              }`}
            >
              {t(plan?.perLotExits ? "acc_perlot_on" : "acc_perlot_off")}
            </button>
          </div>

          <div>
            <p className="pb-2 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
              {t("acc_when")}
            </p>
            <PillRow>
              <Pill
                active={trigger?.kind === "schedule"}
                onClick={() => setTrigger({ kind: "schedule", everySec: 604_800 })}
              >
                {t("acc_schedule")}
              </Pill>
              <Pill
                active={trigger?.kind === "drawdown"}
                onClick={() => setTrigger({ kind: "drawdown", pct: 5 })}
              >
                {t("acc_falls")}
              </Pill>
              <Pill
                active={trigger?.kind === "gain"}
                onClick={() => setTrigger({ kind: "gain", pct: 5 })}
              >
                {t("acc_rises")}
              </Pill>
              <Pill
                active={trigger?.kind === "drawdownVolatility"}
                onClick={() =>
                  setTrigger({
                    kind: "drawdownVolatility",
                    // Bandwidth regardless of class: it works everywhere, and
                    // the measure is switchable below once the pill is on.
                    measure: "bollingerBandwidth",
                    multiple: 2,
                  })
                }
              >
                {t("acc_falls_vol")}
              </Pill>
            </PillRow>

            {trigger?.kind === "schedule" ? (
              <PillRow>
                {SPACINGS.map((sp) => (
                  <Pill
                    key={sp.sec}
                    active={trigger.everySec === sp.sec}
                    onClick={() => setTrigger({ kind: "schedule", everySec: sp.sec })}
                  >
                    {t("acc_every", { spacing: t(sp.labelKey) })}
                  </Pill>
                ))}
              </PillRow>
            ) : trigger?.kind === "drawdownVolatility" ? (
              <>
                {/* The measure is only a choice on a crypto strategy. On an RWA
                    one there is nothing to choose: ATR cannot be computed from
                    a feed with no high and no low, so the row would offer an
                    option that silently never fires. */}
                {strategyClass === "spot" ? (
                  <PillRow>
                    <Pill
                      active={trigger.measure === "bollingerBandwidth"}
                      onClick={() => setTrigger({ ...trigger, measure: "bollingerBandwidth" })}
                    >
                      {t("acc_measure_bandwidth")}
                    </Pill>
                    <Pill
                      active={trigger.measure === "atr"}
                      onClick={() => setTrigger({ ...trigger, measure: "atr" })}
                    >
                      {t("acc_measure_atr")}
                    </Pill>
                  </PillRow>
                ) : null}
                <Slider
                  label={t("acc_falls_by")}
                  help={
                    t("acc_vol_help") +
                    t(
                      strategyClass === "spot" && trigger.measure === "atr"
                        ? "acc_vol_help_atr"
                        : "acc_vol_help_bandwidth",
                    )
                  }
                  value={trigger.multiple}
                  min={0.5}
                  max={10}
                  step={0.5}
                  // No percent, because there is not one until the cycle runs.
                  // Showing "−2%" here would be a number the agent never uses.
                  display={t("acc_vol_display", {
                    multiple: trigger.multiple,
                    measure: t(
                      trigger.measure === "atr" ? "acc_measure_atr" : "acc_measure_bandwidth",
                    ),
                  })}
                  onChange={(v) => setTrigger({ ...trigger, multiple: v })}
                />
              </>
            ) : trigger ? (
              <Slider
                label={t(trigger.kind === "drawdown" ? "acc_falls_by" : "acc_rises_by")}
                help={t(
                  trigger.kind === "drawdown" ? "acc_drawdown_help" : "acc_gain_help",
                )}
                value={trigger.pct}
                min={1}
                max={90}
                step={1}
                display={`${trigger.kind === "drawdown" ? "−" : "+"}${trigger.pct}%`}
                onChange={(v) => setTrigger({ ...trigger, pct: v })}
              />
            ) : null}
          </div>

          <div>
            <p className="pb-2 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
              {t("acc_guard_heading")}
            </p>
            <button
              type="button"
              onClick={() => setGuard(!guarded)}
              aria-pressed={guarded}
              className={`h-8 rounded-full border px-3 font-mono text-[10px] tracking-[0.08em] uppercase transition-colors ${
                guarded
                  ? "border-accent text-accent"
                  : "border-grid text-text-muted hover:text-text-secondary"
              }`}
            >
              {t(guarded ? "acc_guard_on" : "acc_guard_off")}
            </button>
            <p className="max-w-[64ch] pt-2.5 font-ui text-[12.5px] leading-relaxed text-text-secondary">
              {t(guarded ? "acc_guard_on_body" : "acc_guard_off_body")}
            </p>
          </div>

          <div>
            <p className="pb-2 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
              {t("acc_how_much")}
            </p>
            <PillRow>
              <Pill
                active={plan!.sizing.kind === "fixedUsd"}
                onClick={() => setSizing({ kind: "fixedUsd", usd: 100 })}
              >
                {t("acc_fixed")}
              </Pill>
              <Pill
                active={plan!.sizing.kind === "pctOfCapital"}
                onClick={() => setSizing({ kind: "pctOfCapital", pct: 5 })}
              >
                {t("acc_share")}
              </Pill>
              <Pill
                active={plan!.sizing.kind === "ladder"}
                onClick={() => setSizing({ kind: "ladder", baseUsd: 100, factor: 1.5 })}
              >
                {t("acc_ladder")}
              </Pill>
            </PillRow>

            {plan!.sizing.kind === "fixedUsd" ? (
              <Slider
                label={t("acc_each_add")}
                help={t("acc_fixed_help")}
                value={plan!.sizing.usd}
                min={10}
                max={5_000}
                step={10}
                display={`$${plan!.sizing.usd.toLocaleString("en-US")}`}
                onChange={(v) => setSizing({ kind: "fixedUsd", usd: v })}
              />
            ) : plan!.sizing.kind === "pctOfCapital" ? (
              <Slider
                label={t("acc_each_add")}
                help={t("acc_share_help")}
                value={plan!.sizing.pct}
                min={1}
                max={50}
                step={1}
                display={`${plan!.sizing.pct}%`}
                onChange={(v) => setSizing({ kind: "pctOfCapital", pct: v })}
              />
            ) : (
              <>
                <Slider
                  label={t("acc_first_add")}
                  help={t("acc_first_add_help")}
                  value={plan!.sizing.baseUsd}
                  min={10}
                  max={2_000}
                  step={10}
                  display={`$${plan!.sizing.baseUsd.toLocaleString("en-US")}`}
                  onChange={(v) =>
                    setSizing({ ...(plan!.sizing as { kind: "ladder"; factor: number }), kind: "ladder", baseUsd: v })
                  }
                />
                <Slider
                  label={t("acc_grows_by")}
                  help={t("acc_grows_help")}
                  value={(plan!.sizing as { factor: number }).factor}
                  min={1}
                  max={3}
                  step={0.1}
                  display={`${(plan!.sizing as { factor: number }).factor.toFixed(1)}x`}
                  onChange={(v) =>
                    setSizing({ ...(plan!.sizing as { kind: "ladder"; baseUsd: number }), kind: "ladder", factor: v })
                  }
                />
              </>
            )}
          </div>

          <div>
            <p className="pb-2 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
              {t("acc_where_stops")}
            </p>
            <Slider
              label={t("acc_most_adds")}
              help={t("acc_most_adds_help")}
              value={plan!.maxAdds ?? 10}
              min={1}
              max={100}
              step={1}
              display={`${plan!.maxAdds ?? 10}`}
              onChange={(v) => onChange({ ...plan!, maxAdds: v })}
            />
            <Slider
              label={t("acc_wait_at_least")}
              help={t("acc_wait_help")}
              value={plan!.minSpacingSec ?? 86_400}
              min={60}
              max={2_592_000}
              step={300}
              display={(() => {
                const hit = SPACINGS.find((sp) => sp.sec === (plan!.minSpacingSec ?? 86_400));
                return hit
                  ? t(hit.labelKey)
                  : t("acc_hours", {
                      n: Math.round((plan!.minSpacingSec ?? 86_400) / 3600),
                    });
              })()}
              onChange={(v) => onChange({ ...plan!, minSpacingSec: v })}
            />
          </div>

          {warnings.length > 0 ? (
            <ul className="space-y-1 border-t border-grid pt-3">
              {warnings.map((w) => (
                <li key={w} className="font-ui text-[12px] leading-relaxed text-warning">
                  {w}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="max-w-[64ch] font-ui text-[12px] leading-relaxed text-text-dim">
            {t("acc_all_checks")}
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * One line of plain English for a plan, for the pages that show a strategy back
 * to its own author.
 *
 * Written out rather than rendered as fields because the fields do not read as
 * a sentence: "schedule 604800 / fixedUsd 100 / rules" is four facts a reader
 * has to assemble, and the thing they actually want to check is whether it
 * matches what they meant.
 */
export function describeAddPlan(plan: AddPlan | null | undefined, t: Translate): string | null {
  if (!plan) return null;

  const money = (n: number) => `$${n.toLocaleString("en-US")}`;
  const every = (sec: number) => {
    const opt = SPACINGS.find((sp) => sp.sec === sec);
    if (opt) return t(opt.labelKey);
    if (sec % 86_400 === 0) return t("plan_every_days", { n: sec / 86_400 });
    if (sec % 3600 === 0) return t("plan_every_hours", { n: sec / 3600 });
    return t("plan_every_minutes", { n: Math.round(sec / 60) });
  };

  const size =
    plan.sizing.kind === "fixedUsd"
      ? money(plan.sizing.usd)
      : plan.sizing.kind === "pctOfCapital"
        ? t("plan_size_pct", { pct: plan.sizing.pct })
        : t("plan_size_ladder", {
            base: money(plan.sizing.baseUsd),
            factor: plan.sizing.factor,
          });

  const timing = plan.triggers
    .filter((trig) => trig.kind !== "rules")
    .map((trig) =>
      trig.kind === "schedule"
        ? t("plan_every", { spacing: every(trig.everySec) })
        : trig.kind === "drawdown"
          ? t("plan_when_down", { pct: trig.pct })
          : trig.kind === "drawdownVolatility"
            ? // No percent, because the rung moves with the asset. Naming the
              // measure is what keeps this honest — "down 2x" alone reads as 2%.
              t("plan_when_down_vol", {
                multiple: trig.multiple,
                measure: t(
                  trig.measure === "atr" ? "plan_measure_atr" : "plan_measure_bandwidth",
                ),
              })
            : t("plan_when_up", { pct: trig.pct }),
    );

  const guarded = plan.triggers.some((trig) => trig.kind === "rules");

  const parts = [t("plan_adds", { size })];
  if (timing.length) parts.push(timing.join(t(plan.mode === "any" ? "plan_or" : "plan_and")));
  // Named because it changes what the plan DOES, not merely how often: without
  // it the agent keeps buying something that would no longer qualify.
  if (guarded) parts.push(t("plan_guarded"));
  if (plan.maxAdds !== undefined) parts.push(t("plan_max_adds", { n: plan.maxAdds }));
  if (plan.maxTotalUsd !== undefined) {
    parts.push(t("plan_up_to", { amount: money(plan.maxTotalUsd) }));
  }

  return parts.join(" · ");
}

/** The rules a strategy of this class can actually run. */
export function rulesForClass(strategyClass: "rwa" | "spot"): RuleSpec[] {
  return RWA_RULES.filter((r) => !r.classes || r.classes.includes(strategyClass));
}

/**
 * Every rule available across the classes actually being traded.
 *
 * A mixed universe gets the UNION, not the intersection. A rule that only one
 * class carries — a profit margin, a pool depth — is still worth offering: it
 * simply excludes the assets that cannot answer it, which is what a rule is
 * for. Offering only the overlap would silently drop the reason most people
 * pick a class in the first place.
 *
 * The consequence is real and belongs in the UI, not hidden here: a margin rule
 * on a mixed agent screens out every token, because a token has no margin.
 */
export function rulesForClasses(classes: ("rwa" | "spot")[]): RuleSpec[] {
  if (classes.length === 0) return rulesForClass("rwa");
  return RWA_RULES.filter(
    (r) => !r.classes || classes.some((c) => r.classes!.includes(c)),
  );
}
