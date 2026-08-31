/**
 * Which build of this app this is: Canopy, or the PhantX whitelabel.
 *
 * PhantX is a whitelabel OF KALQIX, not a second venue. The book, the markets,
 * the fills and the settlement chain are identical — canopy-be sends one
 * different header (`partner-id`) when it mints a user's key, and that is the
 * entire technical difference. See services/kalqix/partners.ts in canopy-be.
 *
 * What that means HERE is only naming: in a PhantX build the Base order book
 * is called PhantX and carries PhantX's mark, because that is the product the
 * reader signed up to. Nothing about where an order actually goes changes, so
 * nothing about routing reads this — `routeOf` still answers `kalqix`, and the
 * executor still settles on Base.
 *
 * Read from the environment rather than the hostname: a preview URL or a
 * rename must not be able to change which brand a user thinks they are on.
 */
export type PartnerKey = "canopy" | "phantx";

export const PARTNER_KEY: PartnerKey =
  process.env.NEXT_PUBLIC_CANOPY_PARTNER === "phantx" ? "phantx" : "canopy";

export const IS_PHANTX = PARTNER_KEY === "phantx";

/** What the Base CLOB is called, and the mark it carries, in this build. */
export const CLOB_BRAND: { label: string; src: string; bg: string } = IS_PHANTX
  ? // The art is transparent with a dark navy outline, so it needs a light bed
    // rather than the black one KalqiX's sits on — on black the outline is the
    // background and the pony loses its edge.
    { label: "PhantX", src: "/venues/phantx.png", bg: "bg-white" }
  : // Cropped from the icon+wordmark lockup: the horse fills its square edge to
    // edge, and its art is on opaque dark like Solana's.
    { label: "KalqiX", src: "/venues/kalqix.png", bg: "bg-black" };
