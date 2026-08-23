import type { UniverseAsset } from "@/lib/api";

/**
 * Where an asset trades: the chain it settles on and the router that fills it,
 * as two overlapping discs.
 *
 * PER ASSET, NOT PER PAGE, and deliberately so. Today every market here is a
 * Solana spot swap through Jupiter, which makes this five copies of one fact —
 * a strip at the top of the list would say it once and be shorter. The pair is
 * on the row because the moment a second chain or a second router lands, two
 * rows in the same list differ, and this is the only thing that will say which
 * is which. Stating it globally now means rebuilding it per-row then.
 *
 * The ring matters: without a background-coloured stroke the two discs merge
 * into one shape on a dark surface, and "stacked" is the whole point.
 */

export type Chain = "solana";
export type Router = "jupiter";

const CHAIN: Record<Chain, { label: string; className: string }> = {
  // Solana's own gradient. Written as a class rather than an inline style so it
  // travels with the theme like everything else.
  solana: {
    label: "Solana",
    className: "bg-[linear-gradient(315deg,#9945FF_0%,#14F195_100%)]",
  },
};

const ROUTER: Record<Router, { label: string; className: string }> = {
  jupiter: { label: "Jupiter", className: "bg-[#C7F284]" },
};

/**
 * Which chain and router an asset trades through.
 *
 * `UniverseAsset` carries neither field yet — everything routes one way — so
 * this returns the constant. It exists as a function so the day the universe
 * starts reporting them, the change is here and nothing else moves.
 */
export function routeOf(_asset: UniverseAsset): { chain: Chain; router: Router } {
  return { chain: "solana", router: "jupiter" };
}

export function RouteBadge({
  chain,
  router,
  size = 17,
  className = "",
}: {
  chain: Chain;
  router: Router;
  size?: number;
  className?: string;
}) {
  const c = CHAIN[chain];
  const r = ROUTER[router];
  // Overlap is ~40% of a disc: enough to read as stacked, not so much that the
  // one behind becomes a sliver.
  const overlap = Math.round(size * 0.4);

  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size * 2 - overlap, height: size }}
      // One label for the pair. Two would make a screen reader announce a
      // decoration twice per row.
      role="img"
      aria-label={`${r.label} on ${c.label}`}
    >
      <span
        className={`absolute top-0 rounded-full ring-[1.5px] ring-bg ${c.className}`}
        style={{ left: size - overlap, width: size, height: size }}
      />
      <span
        className={`absolute top-0 left-0 rounded-full ring-[1.5px] ring-bg ${r.className}`}
        style={{ width: size, height: size }}
      />
    </span>
  );
}
