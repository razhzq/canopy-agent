/**
 * The prompt pack: starting sentences for the strategy chat, grouped by the
 * kind of strategy they describe.
 *
 * The data is ids and knobs only; the words are in lib/i18n/{en,zh}/promptPack.ts
 * (`ppc_<category>`, `pp_<prompt>`, `pp_<prompt>_prompt`). `knobs` is the
 * shorthand line under a prompt (thresholds, exits, bar size). It is left
 * untranslated because it is notation, the same in every language.
 *
 * Perps prompts are long-side only. The compose schema has no perp block, so a
 * sentence cannot set leverage or a short side; those are the controls under
 * the chat.
 */
import type { TranslationKey } from "./i18n";

export type PackKind = "spot" | "perp";

export interface PackPrompt {
  id: string;
  /** Shorthand for what the sentence sets, e.g. "15m · RSI < 30 · TP 4% · SL 2%". */
  knobs: string;
}

export interface PackCategory {
  id: string;
  kind: PackKind;
  /** Clauses that add to the sentence already in the box instead of replacing it. */
  append?: boolean;
  /** A grid runs on exactly one spot token. */
  grid?: boolean;
  prompts: PackPrompt[];
}

export const PROMPT_PACK: PackCategory[] = [
  {
    id: "dip",
    kind: "spot",
    prompts: [
      { id: "dip_day", knobs: "1d · −4% · TP 3% · SL 2%" },
      { id: "dip_high", knobs: "−20% from high · RSI < 40 · TP 8% · SL 5%" },
      { id: "dip_candle", knobs: "1h · bar −3% · vol 2× · TP 3% · SL 2%" },
      { id: "dip_sigma", knobs: "15m · 3σ · vol 3× · TP 2% · SL 1.5%" },
    ],
  },
  {
    id: "trend",
    kind: "spot",
    prompts: [
      { id: "trend_ema", knobs: "1h · EMA 9 × 21 · TP 6% · trail 3%" },
      { id: "trend_supertrend", knobs: "1h · supertrend ↑ · SL 4% · trail 5%" },
      { id: "trend_pullback", knobs: "uptrend · EMA 20 · TP 5% · SL 3%" },
      { id: "trend_macd", knobs: "1h · MACD × · ADX > 25 · TP 5% · SL 2.5%" },
      { id: "trend_golden", knobs: "SMA 50 × 200 · SL 8% · trail 10%" },
    ],
  },
  {
    id: "meanrev",
    kind: "spot",
    prompts: [
      { id: "mr_rsi", knobs: "15m · RSI < 30 · TP 4% · SL 2%" },
      { id: "mr_band", knobs: "1h · %B < 0 · TP 3% · SL 2.5%" },
      { id: "mr_vwap", knobs: "5m · −3% VWAP · TP 2% · SL 1.5% · 6h" },
      { id: "mr_stoch", knobs: "1h · %K < 20 · ADX < 20 · TP 3% · SL 2%" },
      { id: "mr_cci", knobs: "1h · CCI < −150 · TP 5% · SL 3% · 3d" },
    ],
  },
  {
    id: "breakout",
    kind: "spot",
    prompts: [
      { id: "bo_high", knobs: "1h · 20-bar high · vol 2× · TP 6% · SL 3%" },
      { id: "bo_squeeze", knobs: "squeeze · MACD hist > 0 · TP 8% · SL 4%" },
      { id: "bo_daily", knobs: "1h · > yesterday's high · TP 5% · trail 3%" },
      { id: "bo_week", knobs: "7d high · BTC up · TP 10% · SL 5%" },
    ],
  },
  {
    id: "momentum",
    kind: "spot",
    prompts: [
      { id: "mo_spike", knobs: "15m · vol 3× · buys > 60% · TP 4% · SL 2%" },
      { id: "mo_sol", knobs: "vs SOL · +5% 3d · TP 8% · SL 4%" },
      { id: "mo_top3", knobs: "top 3 · 24h · liq ≥ $250k · TP 10% · SL 5%" },
      { id: "mo_vwap", knobs: "1h · > VWAP · vol 2× · TP 4% · SL 2%" },
    ],
  },
  {
    id: "candles",
    kind: "spot",
    prompts: [
      { id: "cd_engulf", knobs: "15m · engulfing · RSI < 40 · TP 3% · SL 2%" },
      { id: "cd_hammer", knobs: "1h · hammer · RSI < 35 · TP 4% · SL 2%" },
      { id: "cd_doji", knobs: "doji · RSI < 30 · TP 4% · SL 2.5%" },
    ],
  },
  {
    id: "regime",
    kind: "spot",
    prompts: [
      { id: "rg_btc200", knobs: "BTC > SMA 200 · RSI < 35 · TP 6% · SL 3%" },
      { id: "rg_btcday", knobs: "RSI < 30 · BTC up · TP 4% · SL 2%" },
      { id: "rg_vsbtc", knobs: "vs BTC · supertrend ↑ · TP 8% · SL 4%" },
    ],
  },
  {
    id: "launch",
    kind: "spot",
    prompts: [
      { id: "ml_fresh", knobs: "< 30 min · 500 holders · top10 < 30% · TP 30% · SL 15%" },
      { id: "ml_dip", knobs: "−30% from launch high · liq ↑ · TP 20% · SL 12%" },
      { id: "ml_safe", knobs: "≥ 10 min · dev < 5% · impact < 2% · TP 25% · SL 10%" },
      { id: "ml_flow", knobs: "$100k / 5m · buys > 60% · TP 15% · trail 8%" },
    ],
  },
  {
    id: "grid",
    kind: "spot", grid: true,
    prompts: [
      { id: "grid_auto", knobs: "auto range · 15 levels · $30" },
      { id: "grid_dense", knobs: "auto range · 30 levels · $15" },
    ],
  },
  {
    id: "dca",
    kind: "spot",
    prompts: [
      { id: "dca_daily", knobs: "$50 / day · TP 20%" },
      { id: "dca_drops", knobs: "$100 + $100 / −5% · TP 10% · SL 25%" },
      { id: "dca_ladder", knobs: "$400 · 4 buys · 6h · TP 12%" },
    ],
  },
  {
    id: "risk",
    kind: "spot", append: true,
    prompts: [
      { id: "rk_trail", knobs: "trail 3%" },
      { id: "rk_breakeven", knobs: "breakeven at +2%" },
      { id: "rk_time", knobs: "24h" },
      { id: "rk_calm", knobs: "low vol · no events" },
      { id: "rk_deep", knobs: "liq ≥ $500k" },
      { id: "rk_session", knobs: "9:00–16:00 NY" },
    ],
  },
  {
    id: "p_trend",
    kind: "perp",
    prompts: [
      { id: "pt_ema", knobs: "1h · EMA 9 × 21 · TP 4% · SL 2%" },
      { id: "pt_supertrend", knobs: "supertrend ↑ · SL 2% · trail 3%" },
      { id: "pt_macd", knobs: "1h · MACD × · ADX > 25 · TP 5% · SL 2.5%" },
      { id: "pt_golden", knobs: "SMA 50 × 200 · funding ≤ 0.01%/h · SL 3% · trail 4%" },
    ],
  },
  {
    id: "p_funding",
    kind: "perp",
    prompts: [
      { id: "pf_negative", knobs: "funding < 0 · > VWAP · TP 4% · SL 2%" },
      { id: "pf_util", knobs: "RSI < 30 · util < 70% · TP 4% · SL 2%" },
      { id: "pf_borrow", knobs: "20-bar high · borrow < 20% APR · TP 5% · SL 2.5%" },
    ],
  },
  {
    id: "p_oi",
    kind: "perp",
    prompts: [
      { id: "po_surge", knobs: "OI +10% 24h · +2% day · TP 5% · SL 2.5%" },
      { id: "po_flush", knobs: "OI −10% 24h · RSI < 30 · TP 4% · SL 2%" },
      { id: "po_balanced", knobs: "RSI < 35 · OI imbalance < 65% · TP 4% · SL 2%" },
    ],
  },
  {
    id: "p_meanrev",
    kind: "perp",
    prompts: [
      { id: "pm_rsi", knobs: "15m · RSI < 25 · TP 3% · SL 1.5%" },
      { id: "pm_band", knobs: "1h · %B < 0 · TP 3% · SL 2%" },
      { id: "pm_vwap", knobs: "5m · −2% VWAP · TP 1.5% · SL 1%" },
    ],
  },
  {
    id: "p_breakout",
    kind: "perp",
    prompts: [
      { id: "pb_high", knobs: "1h · 20-bar high · vol 2× · TP 5% · SL 2.5%" },
      { id: "pb_squeeze", knobs: "squeeze · MACD hist > 0 · TP 6% · SL 3%" },
      { id: "pb_daily", knobs: "1h · > yesterday's high · TP 4% · trail 2%" },
    ],
  },
  {
    id: "p_risk",
    kind: "perp", append: true,
    prompts: [
      { id: "pr_util", knobs: "util < 80%" },
      { id: "pr_borrow", knobs: "borrow ≤ 20% APR" },
      { id: "pr_trail", knobs: "trail 3%" },
      { id: "pr_time", knobs: "12h" },
    ],
  },
];

export const categoryTitleKey = (c: PackCategory) => `ppc_${c.id}` as TranslationKey;
export const categoryBodyKey = (c: PackCategory) => `ppc_${c.id}_body` as TranslationKey;
export const promptTitleKey = (p: PackPrompt) => `pp_${p.id}` as TranslationKey;
export const promptSentenceKey = (p: PackPrompt) => `pp_${p.id}_prompt` as TranslationKey;

export function packFor(kind: PackKind): PackCategory[] {
  return PROMPT_PACK.filter((c) => c.kind === kind);
}
