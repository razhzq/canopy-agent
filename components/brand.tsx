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

/** The mark and the word. `height` is the height of the whole lockup. */
export function Wordmark({
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
