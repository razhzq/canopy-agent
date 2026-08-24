// Prepaid inference, sold as bundles of tokens rather than as an amount of USDC.
//
// WHY BUNDLES AND NOT A FREE-TEXT AMOUNT.
//
// "How much USDC should I put on my model balance" is not a question anyone can
// answer. It is denominated in the wrong unit: what the owner actually wants to
// know is how long the agent will keep thinking. A bundle answers that — it is
// priced in tokens and shown in USDC, which is the direction the arithmetic
// should run.
//
// THE FLOOR IS 10M TOKENS PER SIDE.
//
// Ten million in and ten million out, twenty million together. Below that a
// top-up buys a handful of cycles and the owner is back here within a day,
// which is worse than asking for a slightly larger first commitment. The floor
// is per SIDE rather than on the total because the two are not interchangeable:
// a reasoning prompt is mostly input and a pick list is mostly output, and a
// balance that runs out of one is out of both.
//
// PRICED AT THE CEILING, DELIBERATELY.
//
// `maxPriceInputUsd` / `maxPriceOutputUsd` are the ACCEPTED RATE — the most the
// agent will pay per million tokens before it holds rather than paying more
// than the owner agreed. Sizing a bundle at that ceiling means the token counts
// are a floor: at any real price the bundle buys at least what it says, and
// usually more. Sizing at an average would produce the opposite — a bundle that
// quietly delivers less than advertised whenever the market moves.

/** Millions of tokens on each side, in the smallest bundle. */
export const MIN_PER_SIDE_M = 10;

export interface Bundle {
  id: "starter" | "standard" | "scale";
  label: string;
  /** Millions of tokens on EACH side — input and output alike. */
  perSideM: number;
  /** Both sides together, in millions. What the tier is named after. */
  totalM: number;
  /** USDC to send, at the accepted price ceiling. */
  usdc: number;
}

const TIERS: { id: Bundle["id"]; label: string; perSideM: number }[] = [
  { id: "starter", label: "Starter", perSideM: MIN_PER_SIDE_M },
  { id: "standard", label: "Standard", perSideM: MIN_PER_SIDE_M * 2.5 },
  { id: "scale", label: "Scale", perSideM: MIN_PER_SIDE_M * 5 },
];

/**
 * Rounds a price UP to the cent.
 *
 * Up, not to-nearest: a bundle rounded down is a bundle that buys fractionally
 * fewer tokens than the tier claims, and the claim is the whole product.
 */
function ceilCents(usd: number): number {
  return Math.ceil(usd * 100) / 100;
}

/**
 * The three tiers for a model, or null when it has no per-token price.
 *
 * Null is the Canopy-hosted model, which is billed to Canopy rather than to the
 * agent — there is no balance to top up and so nothing to sell. Returning null
 * rather than a zero-priced bundle keeps that distinction visible to the caller
 * instead of rendering three free tiers.
 */
export function bundlesFor(
  maxPriceInputUsd: number | null | undefined,
  maxPriceOutputUsd: number | null | undefined,
): Bundle[] | null {
  const inPer = typeof maxPriceInputUsd === "number" ? maxPriceInputUsd : null;
  const outPer = typeof maxPriceOutputUsd === "number" ? maxPriceOutputUsd : null;
  if (inPer === null || outPer === null) return null;
  if (!Number.isFinite(inPer) || !Number.isFinite(outPer)) return null;
  // A model priced at zero on both sides has nothing to prepay for.
  if (inPer <= 0 && outPer <= 0) return null;

  return TIERS.map(({ id, label, perSideM }) => ({
    id,
    label,
    perSideM,
    totalM: perSideM * 2,
    usdc: ceilCents(perSideM * inPer + perSideM * outPer),
  }));
}

/** "20M" / "100M" — the tokens a bundle buys, both sides together. */
export function tokensLabel(totalM: number): string {
  return `${totalM % 1 === 0 ? totalM : totalM.toFixed(1)}M`;
}

/**
 * Roughly how many cycles a bundle covers, or null when unknown.
 *
 * `perCycleTokens` comes from the agent's own measured spend, so this is only
 * offered once it has run. A guess dressed as a number here would be read as a
 * promise about how long the money lasts.
 */
export function cyclesFor(bundle: Bundle, perCycleTokens: number | null): number | null {
  if (!perCycleTokens || perCycleTokens <= 0) return null;
  return Math.floor((bundle.totalM * 1_000_000) / perCycleTokens);
}
