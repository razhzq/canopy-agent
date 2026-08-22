"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Activity, Bot, Compass, LineChart, Plus } from "lucide-react";

/**
 * The bottom tab bar — the app's navigation below `lg`.
 *
 * The top nav's links are hidden on a phone (they never fitted beside the
 * search field and the account button), which left small screens with a logo
 * and no way to move between sections. This is that way.
 *
 * FOUR TABS, NOT THE FIVE IN THE WIREFRAME. The design draws Home / Search /
 * Cycles / Squads / Profile. Squads has no backend at all, so it would be a tab
 * leading nowhere. Notifications and the account are already reachable from the
 * top bar on every screen, so they are not duplicated here; what is left is the
 * four places you actually go — with the wireframe's "Cycles" landing as
 * Activity, which is what it turned out to be.
 *
 * Deploy sits in the middle as the one filled control. It is the action the
 * product exists for, and on a phone the top-right "Create agent" button is the
 * first thing to get squeezed out.
 */

const TABS = [
  { href: "/workspace", label: "Agents", icon: Bot, match: ["/workspace"] },
  { href: "/agents", label: "Explore", icon: Compass, match: ["/agents"] },
  { href: "/activity", label: "Activity", icon: Activity, match: ["/activity"] },
  { href: "/portfolio", label: "Portfolio", icon: LineChart, match: ["/portfolio"] },
] as const;

function isActive(pathname: string, match: readonly string[]): boolean {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

export function MobileTabs() {
  const pathname = usePathname() ?? "";
  const { ready, authenticated } = usePrivy();

  // Nothing to navigate between until there is a session — and a bar of tabs
  // that all bounce off a sign-in prompt is worse than no bar.
  if (!ready || !authenticated) return null;

  return (
    <nav
      aria-label="Sections"
      // `pb-[env(safe-area-inset-bottom)]` keeps the row clear of the iOS home
      // indicator; without it the last few pixels of every tab sit under it.
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] supports-[backdrop-filter]:bg-surface/90 supports-[backdrop-filter]:backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto flex max-w-[520px] items-stretch">
        {TABS.slice(0, 2).map((t) => (
          <Tab key={t.href} tab={t} active={isActive(pathname, t.match)} />
        ))}

        <li className="flex shrink-0 items-center justify-center px-2">
          <Link
            href="/build/new"
            aria-label="Create an agent"
            className="flex size-11 items-center justify-center rounded-full bg-accent text-bg transition-opacity hover:opacity-90"
          >
            <Plus className="size-5" aria-hidden />
          </Link>
        </li>

        {TABS.slice(2).map((t) => (
          <Tab key={t.href} tab={t} active={isActive(pathname, t.match)} />
        ))}
      </ul>
    </nav>
  );
}

function Tab({
  tab,
  active,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
}) {
  const Icon = tab.icon;
  return (
    <li className="min-w-0 flex-1">
      <Link
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-col items-center gap-1 py-2.5 transition-colors ${
          active ? "text-accent" : "text-text-dim hover:text-text-secondary"
        }`}
      >
        <Icon className="size-5 shrink-0" aria-hidden />
        <span className="font-mono text-[9px] tracking-[0.08em] uppercase">{tab.label}</span>
      </Link>
    </li>
  );
}

