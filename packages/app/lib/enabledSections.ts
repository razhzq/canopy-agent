// Which v2 sections are switched on.
//
// The whole v2 app is built, but staging (and the first release) opens only
// Feed and Trade. NEXT_PUBLIC_ENABLED_SECTIONS lists the ones that are on,
// comma-separated; turning one on is adding it there and redeploying.
//
// A switched-off section is gone from the rail, the bottom bar and the
// account menu, and its routes redirect to the first section that is on
// (proxy.ts). The account pages (wallet, credits, profile, notifications,
// referral) are not sections: trading needs them, so they stay.

export type SectionKey = "ask" | "feed" | "studio" | "trade" | "copy" | "portfolio";

const ALL: SectionKey[] = ["ask", "feed", "studio", "trade", "copy", "portfolio"];

export const ENABLED_SECTIONS: SectionKey[] = (() => {
  const raw = (process.env.NEXT_PUBLIC_ENABLED_SECTIONS ?? "feed,trade")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is SectionKey => (ALL as string[]).includes(s));
  return raw.length ? raw : ["feed", "trade"];
})();

export function sectionOn(key: SectionKey): boolean {
  return ENABLED_SECTIONS.includes(key);
}

/** Every route that belongs to a section, v1 pages included. */
export const SECTION_ROUTES: Record<SectionKey, string[]> = {
  ask: ["/ask"],
  feed: ["/feed"],
  studio: ["/studio", "/build"],
  trade: ["/trade"],
  copy: ["/agents", "/deploy", "/atlas"],
  portfolio: ["/portfolio", "/workspace", "/activity", "/earnings", "/wallet-audit"],
};

const HOME_OF: Record<SectionKey, string> = {
  ask: "/ask",
  feed: "/feed",
  studio: "/studio",
  trade: "/trade",
  copy: "/agents",
  portfolio: "/portfolio",
};

/** Where the app opens: Ask when it is on, otherwise the first section that is. */
export const HOME_ROUTE: string = sectionOn("ask") ? "/ask" : HOME_OF[ENABLED_SECTIONS[0]];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** False when the path belongs to a switched-off section. */
export function pathOn(path: string): boolean {
  for (const key of ALL) {
    if (SECTION_ROUTES[key].some((p) => under(path, p))) return sectionOn(key);
  }
  return true;
}
