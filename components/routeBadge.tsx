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

export type Chain = "solana" | "base";
export type Router = "jupiter" | "kalqix";

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
  // Base's brand kit ships no pictorial symbol — "TheSquare" is a rounded
  // square in Base Blue, and that IS the mark. Clipped to a disc it reads as a
  // blue dot, which is also how wallets show the chain, so nothing is lost at
  // 17px that a glyph would have carried.
  base: { label: "Base", src: "/venues/base.png", scale: 1, bg: "bg-[#0000FF]" },
};

/**
 * What each router is called in prose.
 *
 * Split out of the mark table because a label is not artwork: the aria-label
 * on the badge is built from it, and it is the one thing here that is read
 * rather than seen. Not exported — the market picker's venue filter names the
 * market STRUCTURE ("CLOB DEX"), not the venue, and reusing this table there
 * would quietly make the two follow each other.
 */
const ROUTER_LABEL: Record<Router, string> = {
  jupiter: "Jupiter",
  kalqix: "KalqiX",
};

const ROUTER: Record<Router, Mark> = {
  jupiter: { label: ROUTER_LABEL.jupiter, src: "/venues/jupiter.png", scale: 1, bg: "bg-[#101728]" },
  // Cropped from the icon+wordmark lockup: the horse fills its square edge to
  // edge, so it needs no scaling, and its art is on opaque dark like Solana's.
  kalqix: { label: ROUTER_LABEL.kalqix, src: "/venues/kalqix.png", scale: 1, bg: "bg-black" },
};

/**
 * Which chain and router an asset trades through.
 *
 * That day has arrived: the universe now reports a second chain. A KalqiX
 * listing settles on Base and fills on the venue's own order book; everything
 * else is a Solana spot swap through Jupiter.
 *
 * Read from `chain` rather than from the symbol, for the same reason the
 * executor routes on it: the picker carries both a Solana ETH (Wormhole
 * Wrapped Ether) and a KalqiX ETH, and only the chain tells them apart.
 *
 * An unrecognised chain falls back to the Solana pair rather than throwing —
 * a badge is decoration, and a row that renders the wrong two discs is a much
 * smaller problem than a market picker that crashes. The executor makes the
 * same distinction and refuses there, which is where refusing belongs.
 */
export function routeOf(asset: UniverseAsset): { chain: Chain; router: Router } {
  return asset.chain ? routeOfChain(asset.chain) : routeOfMint(asset.mint);
}

function routeOfChain(chain: string): { chain: Chain; router: Router } {
  return chain === "base"
    ? { chain: "base", router: "kalqix" }
    : { chain: "solana", router: "jupiter" };
}

/**
 * The same answer, from a bare mint.
 *
 * A saved selection stores only `{kind:"crypto", mint}` — it has no chain
 * field and predates the second one. It does not need one: a KalqiX identity
 * is namespaced ("kalqix:cbBTC"), so the mint says where it settles. That is
 * the whole reason the identity carries the venue rather than pretending to
 * be an address.
 */
export function routeOfMint(mint?: string): { chain: Chain; router: Router } {
  return mint?.startsWith("kalqix:")
    ? { chain: "base", router: "kalqix" }
    : { chain: "solana", router: "jupiter" };
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
