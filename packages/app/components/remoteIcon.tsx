"use client";

import { useState } from "react";

/**
 * A token logo fetched from somewhere else.
 *
 * Its own module, and its own client boundary, for one reason: `ui.tsx` is
 * imported by server components, and an `onError` handler would drag every one
 * of those trees across the boundary with it. The fallback needs state; nothing
 * else in `AssetLogo` does.
 *
 * A plain <img> rather than next/image. The file is a few kilobytes, already
 * sized by the CDN that serves it, so the optimiser has nothing to win — and
 * routing arbitrary third-party hosts through it would mean maintaining an
 * allow-list of every CDN a token logo might ever live on.
 */
export function RemoteIcon({
  src,
  size,
  fallback,
}: {
  src: string;
  size: number;
  /** Drawn when the URL is dead. A torn-image glyph reads as broken software. */
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="inline-block shrink-0 rounded-full object-contain"
      style={{ width: size, height: size }}
    />
  );
}
