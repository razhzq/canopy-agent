"use client";

import { useT, type TranslationKey } from "@/lib/i18n";

/**
 * The spoken half of a skeleton.
 *
 * Skeletons are rendered from `loading.tsx` files, which are server
 * components — they cannot call `useT()`, and the locale is a client fact
 * anyway (it lives in localStorage). So the bars stay server-rendered and only
 * this one span, which is the entire text a screen reader gets from a loading
 * screen, crosses into the client to be translated.
 *
 * Visually hidden by design: forty grey bars announced aloud is noise, one
 * sentence is the information.
 */
export function LoadingLabel({ labelKey }: { labelKey: TranslationKey }) {
  return <span className="sr-only">{useT()(labelKey)}</span>;
}
