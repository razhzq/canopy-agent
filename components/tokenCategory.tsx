"use client";

import type { UniverseAsset } from "@/lib/api";
import { useT, type TranslationKey } from "@/lib/i18n";

/**
 * What kind of thing a token is, in one word.
 *
 * WHY A ROW NEEDS THIS. A book of tokens an agent picked for itself is a list
 * of tickers nobody has met: WIF, JUP, jitoSOL, PENGU. The symbol says what to
 * type into an explorer and nothing about what was bought. "meme" beside one of
 * them is the difference between reading a position and recognising it, and it
 * is the fact an owner most often wants when the screen chose the market rather
 * than they did.
 *
 * ONE WORD, AND THE REST ON HOVER. A token carries several tags — JUP is a DEX
 * and a launchpad and DeFi; WIF is a meme and dog-themed — and the server ranks
 * them most-specific-first so every surface shows the same one. The `title`
 * carries the full set for anyone who wants it, which costs no width in a rail
 * that is already 420px and a positions row that is already full.
 *
 * NOT A BADGE, NOT A PILL. `Badge` is the uppercase outlined chip used for
 * state (paper, live, simulated) and a `Pill` is a live status; a category is
 * neither — it is an intrinsic property of the thing, so it reads as a quiet
 * lower-case tag and never competes with the figures on the row.
 */
export function TokenCategory({
  categories,
  className = "",
}: {
  categories?: string[];
  className?: string;
}) {
  const t = useT();
  const first = categories?.[0];
  // Nothing rather than a guess. Two thirds of the long tail has no category,
  // and an "unclassified" chip on every second row would be noise claiming to
  // be information.
  if (!first) return null;

  const key = `tcat_${first}` as TranslationKey;
  const label = t(key);
  // A vendor word we have not mapped yet: show it as it came rather than the
  // raw key, which is what `t` falls back to when a key is missing.
  const text = label === key ? first : label;

  return (
    <span
      title={categories && categories.length > 1 ? categories.join(" · ") : undefined}
      className={`shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-ui text-[10.5px] leading-none text-text-dim ${className}`}
    >
      {text}
    </span>
  );
}

/**
 * The same tag straight off a universe row.
 *
 * A convenience, because every caller has the asset rather than the array and
 * `asset?.categories` at nine call sites is nine chances to reach for the wrong
 * field on a row that also carries `assetClass`, `kind` and `tier`.
 */
export function AssetCategory({
  asset,
  className,
}: {
  asset: UniverseAsset | null | undefined;
  className?: string;
}) {
  return <TokenCategory categories={asset?.categories} className={className} />;
}
