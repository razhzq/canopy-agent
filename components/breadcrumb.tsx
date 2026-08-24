"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

/** A crumb: plain text, or somewhere to go back to. */
export type Crumb = string | { label: string; href: string };

/**
 * The trail back up.
 *
 * Crumbs with an `href` are links; the last one never is, because it names the
 * page you are already on. This used to render every part as plain text, which
 * looked like navigation and did nothing — on the cycle transcript, three
 * levels deep, that left the browser's back button as the only way out.
 *
 * LIVES HERE RATHER THAN IN ui.tsx, which it did until the app was translated.
 * Its `aria-label` is the one string in it that this component owns — the
 * crumbs themselves arrive already translated from the caller — and reading it
 * needs a hook, which would have made ui.tsx a client module and dragged every
 * server page that imports a `Columns` or a `SectionHead` across the boundary
 * with it. One small client component instead of forty.
 *
 * Re-exported from ui.tsx so no call site had to change.
 */
export function Breadcrumb({ parts }: { parts: Crumb[] }) {
  const t = useT();

  return (
    <nav
      aria-label={t("common_breadcrumb")}
      className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase"
    >
      {parts.map((part, i) => {
        const label = typeof part === "string" ? part : part.label;
        const href = typeof part === "string" ? undefined : part.href;
        const last = i === parts.length - 1;
        return (
          <span key={`${label}-${i}`} className="flex items-center gap-2">
            {i > 0 ? <span className="text-grid-strong">/</span> : null}
            {href && !last ? (
              <Link
                href={href}
                className="transition-colors hover:text-accent hover:underline underline-offset-4"
              >
                {label}
              </Link>
            ) : (
              <span
                aria-current={last ? "page" : undefined}
                className={last ? "text-text-secondary" : undefined}
              >
                {label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
