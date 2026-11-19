import { ChartCandlestick, ChartColumn, ClipboardList, Copy, MessageSquare, Zap, type LucideIcon } from "lucide-react";

/**
 * The v2 sections, in the prototype's order. `match` is every route that
 * belongs to the section, so a detail page lights up its parent.
 *
 * Studio and Copy point at the v1 builder and marketplace until their v2
 * screens land; the routes stay the same.
 */
export const SECTIONS: { key: string; label: string; href: string; icon: LucideIcon; match: string[] }[] = [
  { key: "ask", label: "Ask", href: "/ask", icon: MessageSquare, match: ["/ask"] },
  { key: "feed", label: "Feed", href: "/feed", icon: Zap, match: ["/feed"] },
  { key: "studio", label: "Studio", href: "/build/new", icon: ClipboardList, match: ["/build", "/studio"] },
  { key: "trade", label: "Trade", href: "/trade", icon: ChartCandlestick, match: ["/trade"] },
  { key: "copy", label: "Copy", href: "/agents", icon: Copy, match: ["/agents", "/deploy", "/copy"] },
  { key: "portfolio", label: "Portfolio", href: "/portfolio", icon: ChartColumn, match: ["/portfolio", "/workspace"] },
];

export function sectionFor(pathname: string) {
  return SECTIONS.find((s) => s.match.some((m) => pathname === m || pathname.startsWith(`${m}/`))) ?? null;
}

/** Pages outside the six sections, named for the top bar's breadcrumb. */
export const OTHER_PAGES: [string, string][] = [
  ["/settings", "Settings"],
  ["/notifications", "Notifications"],
  ["/activity", "Activity"],
  ["/earnings", "Earnings"],
  ["/atlas", "Atlas"],
  ["/admin", "Admin"],
  ["/wallet-audit", "Wallet"],
];
