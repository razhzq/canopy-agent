/**
 * Which rule keys honour a period, mirrored from @canopy/agent-contracts
 * PERIOD_KEYS / PAIR_KEYS / DEVIATION_KEYS. Keep the three in step: a key
 * here that the backend does not honour would show an input that does
 * nothing, and the reverse would hide one that works.
 */
export const PERIOD_KEYS: Record<string, { default: number; min: number; max: number }> = {
  rsi14: { default: 14, min: 2, max: 100 },
  rsi14Min: { default: 14, min: 2, max: 100 },
  atrPct: { default: 14, min: 2, max: 100 },
  adx: { default: 14, min: 2, max: 100 },
  cci: { default: 20, min: 2, max: 100 },
  mfi: { default: 14, min: 2, max: 100 },
  stochasticK: { default: 14, min: 2, max: 100 },
  stochasticKMin: { default: 14, min: 2, max: 100 },
  bollingerPctB: { default: 20, min: 2, max: 100 },
  bollingerPctBMin: { default: 20, min: 2, max: 100 },
  bollingerBandwidthPct: { default: 20, min: 2, max: 100 },
  bollingerBandwidthPctMin: { default: 20, min: 2, max: 100 },
  priceVsSma5Pct: { default: 5, min: 2, max: 200 },
  priceVsSma10Pct: { default: 10, min: 2, max: 200 },
  priceVsEma20Pct: { default: 20, min: 2, max: 200 },
  priceVsEma50Pct: { default: 50, min: 2, max: 200 },
  vwapDistPct: { default: 20, min: 2, max: 100 },
  volatilityChangePct: { default: 14, min: 2, max: 100 },
  volatilityChangePctMax: { default: 14, min: 2, max: 100 },
  momentum20dPct: { default: 20, min: 1, max: 300 },
  momentum20dPctMax: { default: 20, min: 1, max: 300 },
  breakHighPct: { default: 20, min: 1, max: 300 },
  breakLowPct: { default: 20, min: 1, max: 300 },
  priceCrossEmaUpBars: { default: 20, min: 2, max: 300 },
  priceCrossEmaDownBars: { default: 20, min: 2, max: 300 },
  priceCrossSmaUpBars: { default: 20, min: 2, max: 300 },
  priceCrossSmaDownBars: { default: 20, min: 2, max: 300 },
  relativeStrengthBtcPct: { default: 20, min: 2, max: 300 },
  relativeStrengthBtcPctMax: { default: 20, min: 2, max: 300 },
  relativeStrengthSolPct: { default: 20, min: 2, max: 300 },
  relativeStrengthSolPctMax: { default: 20, min: 2, max: 300 },
  // Perp history: hours, not bars.
  openInterestChangePct: { default: 24, min: 1, max: 168 },
  openInterestChangePctMax: { default: 24, min: 1, max: 168 },
  borrowAprChangePts: { default: 24, min: 1, max: 168 },
  borrowAprChangePtsMax: { default: 24, min: 1, max: 168 },
};

export const PAIR_KEYS: Record<string, { default: [number, number]; min: number; max: number }> = {
  smaSpreadPct: { default: [20, 50], min: 2, max: 300 },
  smaCrossUpBars: { default: [20, 50], min: 2, max: 300 },
  smaCrossDownBars: { default: [20, 50], min: 2, max: 300 },
};

export const DEVIATION_KEYS = new Set([
  "bollingerPctB",
  "bollingerPctBMin",
  "bollingerBandwidthPct",
  "bollingerBandwidthPctMin",
]);

/** The parameters a rule carries, in the shape the API takes; nothing when it reads the defaults. */
export function paramsOf(r: { key: string; period?: number; pair?: [number, number]; deviations?: number }): {
  period?: number;
  periods?: [number, number];
  deviations?: number;
} {
  const out: { period?: number; periods?: [number, number]; deviations?: number } = {};
  const pk = PERIOD_KEYS[r.key];
  if (pk && typeof r.period === "number" && r.period !== pk.default) out.period = r.period;
  const pair = PAIR_KEYS[r.key];
  if (pair && r.pair && (r.pair[0] !== pair.default[0] || r.pair[1] !== pair.default[1])) out.periods = r.pair;
  if (DEVIATION_KEYS.has(r.key) && typeof r.deviations === "number" && r.deviations !== 2) out.deviations = r.deviations;
  return out;
}

/** The window text for a label: the rule's own period when set, else the catalogue's. */
export function periodsText(r: { key: string; periods?: string; period?: number; pair?: [number, number]; deviations?: number }): string | undefined {
  let text = r.periods;
  if (typeof r.period === "number") text = String(r.period);
  if (r.pair) text = `${r.pair[0]} vs ${r.pair[1]}`;
  if (typeof r.deviations === "number" && r.deviations !== 2) text = `${text ?? PERIOD_KEYS[r.key]?.default ?? ""} · ${r.deviations}σ`;
  return text;
}
