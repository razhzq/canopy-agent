"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Remembers the last real page the user was on.
 *
 * The builder opens as a modal over nothing — /build/new renders the naming
 * dialog before it renders a page. Cancelling it therefore has no page of its
 * own to fall back to, and it used to dump the user on the creator dashboard,
 * which is not where they were and is not a place they asked to go.
 *
 * Session-scoped rather than a React context: a full reload on /build/new (or
 * a tab restore) still knows where the user came from, which a provider's
 * in-memory state would have lost.
 */

const KEY = "canopy:last-route";

/** Where to land when there is no memory at all — a direct link, a fresh tab. */
export const DEFAULT_ROUTE = "/agents";

/**
 * Routes that are not somewhere to return TO.
 *
 * Only the builder's own entry point. /build/new/publish is a page in its own
 * right — someone who opens the builder from there and cancels means to go
 * back to it.
 */
function isTransient(path: string): boolean {
  return path === "/build/new";
}

export function RouteMemory() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || isTransient(pathname)) return;
    try {
      sessionStorage.setItem(KEY, pathname);
    } catch {
      /* storage blocked (private mode, embedded webview) — falls back below */
    }
  }, [pathname]);

  return null;
}

/** The last page worth returning to, or {@link DEFAULT_ROUTE}. */
export function lastRoute(): string {
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored && stored.startsWith("/") && !isTransient(stored)) return stored;
  } catch {
    /* see above */
  }
  return DEFAULT_ROUTE;
}
