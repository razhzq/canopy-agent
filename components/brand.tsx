"use client";

// The brand, drawn rather than pasted.
//
// The logo's source SVG is a mark of nine rectangles and the word "canopy" set
// live in Archivo 800. Shipping it as an image would freeze one colourway and
// one size, and the exported PNGs carry their ground with them — the inverse
// has its dark rectangle baked in, which shows as a seam on any panel that is
// not exactly that colour. So the mark is real SVG with `currentColor` for its
// ink, the word is real type in the brand face, and the whole thing takes the
// colour of wherever it sits: white on the app's dark ground, ink on the
// landing's white one, with the mint fixed because the mint is the brand.
//
// Proportions are the source's: at a logo height of 58, the mark is 55.2 wide
// by 33 tall on a 12.88 baseline offset, the word is 46px with −2.5px tracking,
// and a 10px gap separates them. Everything below is those numbers divided by
// 58, so one `height` scales it all.

import { useTenant } from "@/lib/tenant/context";

const MINT = "#63e2b7";

/** The mark alone: the canopy over three trunks. */
export function BrandMark({
  height = 24,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 10 6"
      width={(height * 10) / 6}
      height={height}
      className={`shrink-0 ${className}`}
      aria-hidden
      focusable="false"
    >
      <rect x="3" y="0" width="4" height="1" fill={MINT} />
      <rect x="1" y="1" width="8" height="1" fill={MINT} />
      <rect x="0" y="2" width="10" height="1" fill={MINT} />
      <rect x="1" y="4" width="2" height="2" fill="currentColor" />
      <rect x="4" y="4" width="2" height="2" fill="currentColor" />
      <rect x="7" y="4" width="2" height="2" fill="currentColor" />
    </svg>
  );
}

/**
 * The tenant's lockup at `height`.
 *
 * Canopy draws its own (below). A tenant shows the logo file it uploaded —
 * `logoInkUrl` on a light ground (`onLight`), `logoUrl` on the app's dark
 * one — and, with no file, its name set in the brand face in `currentColor`.
 */
export function Wordmark({
  height = 24,
  className = "",
  onLight = false,
}: {
  height?: number;
  className?: string;
  onLight?: boolean;
}) {
  const tenant = useTenant();
  if (tenant.isPlatform) return <CanopyWordmark height={height} className={className} />;
  const src = onLight ? (tenant.brand.logoInkUrl ?? tenant.brand.logoUrl) : tenant.brand.logoUrl;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a remote logo at a fixed height; next/image would need every tenant's host allow-listed
      <img src={src} alt={tenant.name} style={{ height, width: "auto" }} className={`shrink-0 ${className}`} />
    );
  }
  return (
    <span className={`inline-flex items-center ${className}`} style={{ height }} role="img" aria-label={tenant.name}>
      <span
        aria-hidden
        style={{
          fontFamily: "var(--font-brand)",
          fontWeight: 800,
          fontSize: height * 0.8,
          lineHeight: 1,
          letterSpacing: "-0.04em",
        }}
      >
        {tenant.name}
      </span>
    </span>
  );
}

/** Canopy's mark and word. `height` is the height of the whole lockup. */
function CanopyWordmark({
  height = 24,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  const markH = (height * 33) / 58;
  const fontPx = (height * 46) / 58;
  const gap = (height * 10) / 58;
  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ height, gap }}
      role="img"
      aria-label="Canopy"
    >
      <BrandMark height={markH} />
      <span
        aria-hidden
        style={{
          fontFamily: "var(--font-brand)",
          fontWeight: 800,
          fontSize: fontPx,
          lineHeight: 1,
          letterSpacing: `${(-2.5 / 46).toFixed(4)}em`,
          // The source sets the baseline at 46 of 58: the x-height band sits a
          // touch below the mark's centre line, which is where the eye expects
          // a lowercase word beside a symmetrical mark.
          transform: `translateY(${(height * 1.5) / 58}px)`,
        }}
      >
        canopy
      </span>
    </span>
  );
}
