"use client";

import { useT, type TranslationKey } from "@/lib/i18n";

/**
 * The banner at the top of a top-level route: a small uppercase eyebrow naming
 * the section, the page's own title, and one line saying what is below.
 *
 * Extracted when the pages were translated. Four routes had hand-built copies
 * of the same three elements, which was survivable while the copy was inline —
 * and stopped being once each string had to be looked up, because every page
 * would have had to become a client component to do it. This is the one client
 * boundary instead, and the pages keep their `generateMetadata`.
 */
export function PageHeader({
  eyebrowKey,
  titleKey,
  bodyKey,
}: {
  eyebrowKey: TranslationKey;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
}) {
  const t = useT();
  return (
    <section className="space-y-2 border-b border-grid px-5 pt-6 pb-5 sm:px-8">
      <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
        {t(eyebrowKey)}
      </p>
      <h1 className="font-mono text-[24px] leading-none text-text-primary sm:text-[30px]">
        {t(titleKey)}
      </h1>
      <p className="font-ui text-[13.5px] text-text-secondary">{t(bodyKey)}</p>
    </section>
  );
}
