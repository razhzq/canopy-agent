"use client";

// Chain identity, as a glyph.
//
// Inline rather than an asset: it renders in a header and in the deposit dialog
// on first paint, and a network round-trip for a logo is a round-trip that can
// fail and leave the chain unnamed — which is the whole reason it is drawn at
// all. USDC exists on a dozen chains and sending the wrong one's loses it.
//
// Shared so the two places that name the chain cannot drift apart.

import { useId } from "react";

export function SolanaMark({
  className = "size-[11px]",
}: {
  className?: string;
}) {
  // The gradient is referenced by id, and this renders more than once per page —
  // the wallet bar and the deposit dialog can be open together. A fixed id would
  // make the second instance resolve against the first one's def, which happens
  // to look right today only because both are identical.
  // Sanitised, because useId's output is not guaranteed to be safe inside a
  // `url(#…)` reference — React has shipped ids containing colons and guillemets
  // across versions, and a gradient reference that fails to resolve renders the
  // mark as three invisible shapes rather than as an obvious error.
  const id = `sol-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      viewBox="0 0 397.7 311.7"
      className={`${className} shrink-0`}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient
          id={id}
          x1="360.9"
          y1="-37.5"
          x2="141.2"
          y2="383.3"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#9945FF" />
          <stop offset="1" stopColor="#14F195" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id})`}>
        <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
        <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
        <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" />
      </g>
    </svg>
  );
}
