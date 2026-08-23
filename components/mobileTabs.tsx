"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Bell, GitBranch, House, User } from "lucide-react";

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

const TABS = [
  // Home is EXPLORE — the feed with the performers strip.
  { href: "/agents", label: "Home", icon: House, match: ["/agents", "/deploy"] },
  { href: "/activity", label: "Activity", icon: GitBranch, match: ["/activity"] },
  // The wireframe's Squads slot has no backend, so notifications take it —
  // real, and otherwise only reachable behind a bell in a top bar a thumb
  // never comfortably reaches.
  { href: "/notifications", label: "Alerts", icon: Bell, match: ["/notifications"] },
  { href: "/portfolio", label: "Profile", icon: User, match: ["/portfolio"] },
] as const;

function isActive(pathname: string, match: readonly string[]): boolean {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

export function MobileTabs() {
  const pathname = usePathname() ?? "";
  const { ready, authenticated } = usePrivy();

  // Nothing to navigate between until there is a session, and a row of tabs
  // that all bounce off a sign-in prompt is worse than no row.
  if (!ready || !authenticated) return null;

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 bg-bg/90 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] supports-[backdrop-filter]:bg-bg/70 supports-[backdrop-filter]:backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto flex h-[60px] max-w-[520px] items-center justify-between rounded-[30px] border border-border bg-surface px-2 supports-[backdrop-filter]:bg-surface/80 supports-[backdrop-filter]:backdrop-blur-xl">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = isActive(pathname, t.match);
          return (
            <li key={t.href} className="min-w-0 flex-1">
              <Link
                href={t.href}
                aria-label={t.label}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center justify-center rounded-[22px] transition-colors ${
                  active ? "bg-surface-2 text-text-primary" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <Icon className="size-[21px] shrink-0" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
