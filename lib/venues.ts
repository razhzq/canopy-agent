import type { UniverseAsset } from "@/lib/api";
import { routeOf, type Chain } from "@/components/routeBadge";

/**
 * Where an agent's trades actually fill.
 *
 * NOT A CHOICE ANY MORE, AND THAT IS THE POINT.
 *
 * The builder used to spend a whole step on this — wireframe 1f, "choose a
 * venue" — and it was already the wrong question by the time it shipped. The
 * venue follows from the market: a KalqiX listing fills on that venue's order
 * book on Base and Jupiter cannot touch it, nor KalqiX a Solana pair. Picking
 * the market in step 1 IS picking the venue, and the picker's venue filter
 * makes that visible while you choose. Asking again afterwards offered a
 * decision that was already made.
 *
 * So what is left here is a description, not a control: given a selection, say
 * where it will fill. The review rail and the agent page both want that
 * sentence; nobody wants a second screen to produce it.
 *
 * Fees are published schedules, not quotes — a quote is the price/depth pair,
 * and only Jupiter's reaches this frontend at all. They are kept because the
 * agent page has somewhere to put them; nothing here invents one.
 */
export type Venue = {
  key: string;
  name: string;
  /** Taker fee as a percentage, or null where the venue publishes no schedule. */
  feePct: number | null;
  live: boolean;
  /**
   * The chain this venue fills on. Set only for live venues: it is what scopes
   * them to a selection, and it is not a fact this frontend has for the ones
   * still integrating.
   */
  chain?: Chain;
};

export const VENUES: Venue[] = [
  { key: "jupiter", name: "Jupiter", feePct: 0.04, live: true, chain: "solana" },
  { key: "canopy", name: "Canopy", feePct: 0.02, live: true, chain: "solana" },
  // KalqiX publishes no flat taker schedule to quote here, so its fee stays
  // null rather than becoming a guess with a percent sign on it.
  { key: "kalqix", name: "KalqiX", feePct: null, live: true, chain: "base" },
  { key: "aeonian", name: "Aeonian", feePct: null, live: false },
  { key: "edgex", name: "edgeX", feePct: null, live: false },
];

/** The chains a selection settles on. Empty before a market is picked. */
function chainsOf(markets: UniverseAsset[]): Set<Chain> {
  return new Set(markets.map((m) => routeOf(m).chain));
}

/**
 * The venues that can actually fill this selection.
 *
 * A mixed-chain universe returns the union: the agent trades every market it
 * was given, so every venue that can fill any of them is a real one.
 */
export function liveVenuesFor(markets: UniverseAsset[]): Venue[] {
  const chains = chainsOf(markets);
  return VENUES.filter((v) => v.live && v.chain && chains.has(v.chain));
}

/**
 * One line for a summary rail: where these markets fill.
 *
 * Named for what it does — describe — rather than for a decision, because
 * there is no longer one to describe. Several venues means best-price across
 * them per trade, which is what the executor does when nothing pins it.
 */
export function describeVenues(markets: UniverseAsset[]): string {
  const live = liveVenuesFor(markets);
  if (live.length === 0) return "—";
  if (live.length === 1) return live[0].name;
  return `Best of ${live.map((v) => v.name).join(" + ")}`;
}
