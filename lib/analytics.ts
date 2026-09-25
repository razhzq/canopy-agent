"use client";

// Google Analytics 4 — where visitors come from, and how far they get.
//
// NOT THE SIGNUP COUNT. A campaign's signups are the redemptions of its code in
// canopy-be (`GET /admin/access-codes`, the `uses` column): that number is
// written by the server at registration and cannot be blocked by an ad
// blocker. GA answers the questions the backend cannot — which source, which
// page, where in the funnel people stop.
//
// OFF UNLESS CONFIGURED. Every export is a no-op when NEXT_PUBLIC_GA_ID is
// unset, so local dev and preview deploys send nothing and need no guard at the
// call site.
//
// QUEUE-SAFE. Calls push onto `window.dataLayer`, which is exactly what the
// real gtag does; gtag.js drains the queue when it loads. So an event fired on
// first paint — before the script tag has even been fetched — is not lost.
//
// PAGE VIEWS ARE SENT BY HAND. The config sets `send_page_view: false`, and the
// stream's "page changes based on browser history events" must be off in GA.
// `captureReferral` rewrites the URL with replaceState to strip `?ref=`, which
// the automatic tracker would count as a second page view — and it would count
// the first one AFTER the ref was gone, which is the one hit that needed it.

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";

type Params = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

let configured = false;

function gtag(..._args: unknown[]): void {
  if (!GA_ID || typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  // `js` and `config` must be the first entries in the queue. An event queued
  // ahead of the config has no destination when gtag.js drains it, and the
  // landing hit — sent from a mount effect — can easily win that race against
  // an afterInteractive script. So configuration happens here, on whichever
  // call comes first, rather than in an inline snippet that may run second.
  if (!configured) {
    configured = true;
    gtag("js", new Date());
    gtag("config", GA_ID, { send_page_view: false });
  }
  // gtag.js reads the `arguments` object, not an array — pushing `args` would
  // be silently ignored. This is the shape Google's own snippet pushes.
  window.dataLayer.push(arguments);
}

/** Queues the configuration. Idempotent; any other call does it too. */
export function initAnalytics(): void {
  gtag("set", {});
}

/** One named event. IDs and categories only — never an email or an address. */
export function track(event: string, params: Params = {}): void {
  gtag("event", event, params);
}

/**
 * A page view for `location` (a full URL).
 *
 * Takes the URL explicitly rather than reading `window.location`, because the
 * landing hit is sent with the URL the visitor ARRIVED on — campaign and all —
 * after the address bar has already been cleaned.
 */
export function pageView(location: string): void {
  gtag("event", "page_view", {
    page_location: location,
    page_title: typeof document === "undefined" ? undefined : document.title,
  });
}

/**
 * Ties later hits to one person across devices.
 *
 * The Privy DID, which is pseudonymous. GA's terms forbid personal data in
 * user_id, and an email would be exactly that.
 */
export function setUser(userId: string | null, props: Params = {}): void {
  gtag("set", { user_id: userId ?? undefined });
  if (Object.keys(props).length > 0) gtag("set", "user_properties", props);
}

/** Attaches properties to the visitor without identifying them. */
export function setUserProperties(props: Params): void {
  gtag("set", "user_properties", props);
}

/**
 * The landing URL with the referral translated into campaign parameters.
 *
 * GA reads `utm_*` off `page_location`, but not our `?ref=`. So the first hit
 * carries the ref AS a campaign — `?ref=colosseum` reports as source
 * `colosseum` without anyone having to hand out a long UTM link.
 *
 * Personal invites (`CNPY-XXXX-XXXX`) collapse to one source, `invite`: each
 * user's code becoming its own traffic source would bury the campaigns. Which
 * person referred whom is the backend's record, not GA's.
 *
 * Explicit `utm_*` on the link wins, untouched — whoever built it meant it.
 */
export function landingLocation(href: string, ref: string | null): string {
  const url = new URL(href);
  url.searchParams.delete("ref");
  if (!ref) return url.toString();

  const hasUtm = [...url.searchParams.keys()].some((k) => k.startsWith("utm_"));
  if (hasUtm) return url.toString();

  if (/^CNPY-/i.test(ref)) {
    url.searchParams.set("utm_source", "invite");
    url.searchParams.set("utm_medium", "referral");
  } else {
    const code = ref.toLowerCase();
    url.searchParams.set("utm_source", code);
    url.searchParams.set("utm_medium", "campaign");
    url.searchParams.set("utm_campaign", code);
  }
  return url.toString();
}
