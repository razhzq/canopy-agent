"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Bell, GitBranch, House, User } from "lucide-react";
import { useEffect, useState } from "react";
import { getNotificationFeed } from "@/lib/api";
import { useIsMobile } from "@/lib/useIsMobile";
import { useT, type TranslationKey } from "@/lib/i18n";

/**
 * The bottom tab bar, below `lg`.
 *
 * BUILT TO THE .pen, NOT APPROXIMATED. The measurements below are the ones in
 * `M/Tab Bar`, and they are what give it its shape — a floating pill rather
 * than a bar welded to the bottom edge:
 *
 *   bar    390 x 84, fill #080B0AE6, padding 8 / 16 / 0 / 16
 *   pill   fill x 60, radius 30, fill $surface, 1px $border, padding 0 / 8
 *   tab    fill x 44, radius 22, active fill $surface-2
 *   icon   21px, $text-primary active / $text-muted at rest
 *
 * The bar's fill is the page background at 90%, which is the glass: content
 * scrolling under the pill stays faintly legible through it, and that is what
 * tells you the page moved rather than the bar. The opaque fallback keeps
 * browsers without `backdrop-filter` from showing text through solid chrome.
 */

// Labels are dictionary keys: this table is module-level, so the text has to
// be resolved at render or the bar keeps whichever language loaded first. The
// label is never drawn — the tabs are icon-only — but it is the accessible
// name of each one, which is the whole of what a screen reader gets here.
const TABS = [
  // Home is EXPLORE — the feed with the performers strip.
  { href: "/agents", key: "tabs_home" as TranslationKey, icon: House, match: ["/agents", "/deploy"] },
  { href: "/activity", key: "tabs_activity" as TranslationKey, icon: GitBranch, match: ["/activity"] },
  // The wireframe's Squads slot has no backend, so notifications take it —
  // real, and otherwise only reachable behind a bell in a top bar a thumb
  // never comfortably reaches.
  { href: "/notifications", key: "tabs_alerts" as TranslationKey, icon: Bell, match: ["/notifications"] },
  { href: "/portfolio", key: "tabs_profile" as TranslationKey, icon: User, match: ["/portfolio"] },
] as const;

function isActive(pathname: string, match: readonly string[]): boolean {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/** Same cadence as the desktop bell's closed-panel poll. */
const POLL_MS = 60_000;

/**
 * The unread count for the Alerts tab.
 *
 * The desktop bell carries a badge; this bar carried nothing, so the one
 * signal that says "an agent wants you" was invisible on the platform where
 * the reader is least likely to be looking anyway. One row is enough — the
 * feed's `unread` is a server-side count, not the length of the page.
 *
 * Polls only below `lg`. The bar is mounted at every width and hidden by CSS,
 * and a desktop already has the bell polling the same endpoint.
 */
function useUnread(): number {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const mobile = useIsMobile();
  const pathname = usePathname() ?? "";
  const [unread, setUnread] = useState(0);
  // Reading the alerts page is what clears them; re-check on the way out.
  const onAlerts = pathname.startsWith("/notifications");

  useEffect(() => {
    if (!ready || !authenticated || mobile !== true) return;
    let cancelled = false;
    const read = async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const feed = await getNotificationFeed(token, 1);
        if (!cancelled) setUnread(feed.unread);
      } catch {
        /* a missed poll is nothing — the count stays where it was */
      }
    };
    void read();
    const id = setInterval(() => void read(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ready, authenticated, mobile, onAlerts, getAccessToken]);

  // Never lit while the reader is on the page that lists them.
  return onAlerts ? 0 : unread;
}

export function MobileTabs() {
  const pathname = usePathname() ?? "";
  const { ready, authenticated } = usePrivy();
  const t = useT();
  const unread = useUnread();

  // Nothing to navigate between until there is a session, and a row of tabs
  // that all bounce off a sign-in prompt is worse than no row.
  if (!ready || !authenticated) return null;

  return (
    <nav
      aria-label={t("tabs_sections_aria")}
      className="fixed inset-x-0 bottom-0 z-30 bg-bg/90 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] supports-[backdrop-filter]:bg-bg/70 supports-[backdrop-filter]:backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto flex h-[60px] max-w-[520px] items-center justify-between rounded-[30px] border border-border bg-surface px-2 supports-[backdrop-filter]:bg-surface/80 supports-[backdrop-filter]:backdrop-blur-xl">
        {/* `tab`, not `t` — the translator owns that name now, and the tab
            it used to hold is the thing being labelled by it. */}
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(pathname, tab.match);
          const count = tab.href === "/notifications" ? unread : 0;
          return (
            <li key={tab.href} className="min-w-0 flex-1">
              <Link
                href={tab.href}
                aria-label={
                  count > 0
                    ? `${t(tab.key)} · ${t("nc_aria_unread", { count })}`
                    : t(tab.key)
                }
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center justify-center rounded-[22px] transition-colors ${
                  active
                    ? "bg-surface-2 text-text-primary"
                    : count > 0
                      ? "text-text-primary"
                      : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <span className="relative">
                  <Icon className="size-[21px] shrink-0" aria-hidden />
                  {count > 0 ? (
                    // A count, not a dot — the same badge the desktop bell wears.
                    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] leading-none text-bg">
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
