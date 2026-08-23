import Image from "next/image";

import type { UniverseAsset } from "@/lib/api";

/**
 * Where an asset trades: the chain it settles on and the router that fills it,
 * as two overlapping discs carrying the real marks.
 *
 * PER ASSET, NOT PER PAGE, and deliberately so. Today every market here is a
 * Solana spot swap through Jupiter, which makes this one fact repeated down the
 * list — a strip at the top would say it once and be shorter. The pair is on the
 * row because the moment a second chain or a second router lands, two rows in
 * the same list differ, and this is the only thing that will say which is which.
 *
 * The ring matters: without a background-coloured stroke the two discs merge
 * into one shape on a dark surface, and "stacked" is the whole point.
 */

export type Chain = "solana";
export type Router = "jupiter";

interface Mark {
  label: string;
  src: string;
  /**
   * Scale applied inside the disc.
   *
   * The two logos are packaged differently and neither is wrong. Jupiter ships
   * a transparent circular mark that already fills its box, so it needs none.
   * Solana ships a square with roughly a quarter of padding on every side,
   * which on a 15px disc leaves a mark under 8px — legible as a smudge and
   * nothing more. Scaling past the crop is what makes the two read as the same
   * size, rather than one looking recessed.
   */
  scale: number;
  /** Solana's art is on opaque black; Jupiter's is transparent and needs a bed. */
  bg: string;
}

const CHAIN: Record<Chain, Mark> = {
  solana: { label: "Solana", src: "/venues/solana.png", scale: 1.5, bg: "bg-black" },
};

const ROUTER: Record<Router, Mark> = {
  jupiter: { label: "Jupiter", src: "/venues/jupiter.png", scale: 1, bg: "bg-[#101728]" },
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

function Disc({ mark, size }: { mark: Mark; size: number }) {
  return (
    <span
      className={`absolute top-0 overflow-hidden rounded-full ring-[1.5px] ring-bg ${mark.bg}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={mark.src}
        alt=""
        width={size}
        height={size}
        // Decorative: the pair carries one label on the wrapper, so neither
        // image should announce itself.
        aria-hidden
        className="size-full object-cover"
        style={mark.scale === 1 ? undefined : { transform: `scale(${mark.scale})` }}
      />
    </span>
  );
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
      <span className="absolute top-0" style={{ left: size - overlap }}>
        <Disc mark={c} size={size} />
      </span>
      <Disc mark={r} size={size} />
    </span>
  );
}
