"use client";

import Image from "next/image";
import { useT } from "@/lib/i18n";

/** Providers whose attribution is a mark. Anything absent stays a word. */
const SOURCE_LOGO: Record<string, { src: string; alt: string }> = {
  // The dark-background variant of Wintel's horizontal lockup (#EDEDED type,
  // amber mark), not the black-on-white one their site serves to light pages.
  // This app's panels are #0b0f0e.
  Wintel: { src: "/wintel-horizontal.svg", alt: "Wintel" },
};

/**
 * Who a narrated line got its facts from, stamped at the end of the line.
 *
 * The line already names the provider in prose — "TSLAx volatility from Wintel:
 * 1.61% daily" — so the attribution was repeating the word right after it. A
 * logo attributes without saying it twice.
 *
 * Both places that narrate a cycle render this: the activity log on the agent
 * page and the full transcript under /portfolio. They drifted apart once
 * already, which is why there is one of these rather than two.
 *
 * MOVED OUT OF ui.tsx when the app was translated, for the same reason
 * `Breadcrumb` did: its `title` needs the dictionary, and ui.tsx is imported by
 * server components that must not be dragged across the client boundary to
 * translate one tooltip. `source` itself is an adapter's display name, already
 * resolved by lib/narrate.
 */
export function SourceMark({ source }: { source: string }) {
  const t = useT();
  const logo = SOURCE_LOGO[source];

  if (!logo) {
    return (
      <span className="ml-2 font-mono text-[10px] tracking-[0.06em] text-text-dim uppercase">
        {source}
      </span>
    );
  }

  return (
    <Image
      src={logo.src}
      alt={logo.alt}
      title={t("common_source_of", { source })}
      // The lockup's own viewBox, so the ratio is right; `h-3.5 w-auto` is what
      // sizes it on the line. `unoptimized` because the optimiser refuses SVG
      // without dangerouslyAllowSVG — and a 2.7KB vector has nothing to gain
      // from being rasterised anyway.
      width={1100}
      height={300}
      unoptimized
      className="ml-2 inline-block h-3.5 w-auto align-[-2px] opacity-80"
    />
  );
}
