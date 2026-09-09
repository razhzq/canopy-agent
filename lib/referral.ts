"use client";

// Referral capture: remembering who sent you, across a login you leave for.
//
// The link is `agent.canopy.finance/?ref=<code>`, where the code is either a
// user's own `CNPY-XXXX-XXXX` invite or an admin-minted campaign code such as
// `STMYBORNEO`. Between landing on it
// and having an account there is a Privy login — which may be a redirect to an
// email provider, a wallet extension handoff, or a popup — and any of those can
// lose the query string. So the code is lifted out of the URL the moment the
// page loads and parked in localStorage until there is a session to attach it
// to.
//
// WHY localStorage AND NOT A COOKIE
//
// Nothing server-side reads this. It travels to the backend once, as an
// explicit field on the session call, and a cookie would additionally ride on
// every unrelated request to the API for no benefit. localStorage also survives
// the tab being closed mid-login, which the sessionStorage version does not.
//
// WHY IT IS CLEARED ON USE AND NOT ON READ
//
// The session call can fail — dead network, backend down. Clearing on read
// would burn the referral on an attempt that never reached the server, and the
// user would never be attributed to the person who actually brought them. It is
// cleared only once the backend has confirmed it saw it.

const KEY = "canopy.ref";

/**
 * How long a captured referral stays valid.
 *
 * Bounded because an unbounded one is a trap: someone clicks a link, does not
 * sign up, comes back three months later on their own, and is silently
 * attributed to a person who has long forgotten them. Thirty days is longer
 * than any real "I'll look at this later" and shorter than a memory.
 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface Stored {
  code: string;
  at: number;
}

/**
 * The shape a referral code can take.
 *
 * TWO KINDS OF CODE REACH THIS, AND ONLY ONE IS GENERATED.
 *
 * A personal invite is minted by the backend as `CNPY-XXXX-XXXX` over an
 * unambiguous alphabet (no O/0, I/1/L). A campaign code is typed by an admin —
 * `STMYBORNEO` on a conference QR, say — and is whatever string they chose.
 * Both are rows in the same `access_codes` table and redeem down the same path,
 * so a regex that admits only the generated shape silently drops every campaign
 * link: `captureReferral` strips `?ref=` from the URL BEFORE validating, so the
 * code is gone from the address bar and never stored, and the visitor lands on
 * the invite gate the link was supposed to spare them.
 *
 * So this mirrors the rule the backend actually enforces when a code is minted
 * (`POST /admin/access-codes`: `/^[A-Za-z0-9-]{4,64}$/`) rather than describing
 * one generator's output. Deliberately the same bounds, because a third opinion
 * about what a code looks like is how the two halves drift apart again.
 *
 * Validated before storing so a malformed or hostile `?ref=` never reaches
 * localStorage or the API. The backend validates again — this is about not
 * carrying obvious junk around, not about trust.
 */
const CODE_RE = /^[A-Z0-9-]{4,64}$/;

export function isValidCodeShape(code: string): boolean {
  return CODE_RE.test(code.trim().toUpperCase());
}

/**
 * Pulls `?ref=` out of the current URL and stores it, then strips it from the
 * address bar.
 *
 * The strip is deliberate: it uses `replaceState`, so the cleaned URL is what
 * gets bookmarked, shared onward, and shown in the address bar — a user who
 * copies the page they are looking at should not be re-sharing someone else's
 * referral link as if it were their own.
 *
 * Returns the code it captured, if any. Safe to call repeatedly.
 */
export function captureReferral(): string | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const raw = url.searchParams.get("ref");
  if (!raw) return null;

  const code = raw.trim().toUpperCase();

  // Stripped whether or not it is valid. A malformed ref is still noise in the
  // address bar, and leaving it there invites a retry that will fail again.
  url.searchParams.delete("ref");
  window.history.replaceState(
    null,
    "",
    url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash,
  );

  if (!isValidCodeShape(code)) return null;

  // First link wins. Someone who clicks two referral links before signing up is
  // attributed to whoever they came in through first, and overwriting would let
  // the last link seen quietly steal a referral the first one earned.
  const held = readReferral();
  if (held) return held;

  try {
    window.localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() } satisfies Stored));
  } catch {
    // Private browsing, storage disabled, quota. Losing the referral is a
    // missed attribution, not a broken signup — the user still gets in.
  }
  return code;
}

/** The held referral, if there is one and it has not expired. */
export function readReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (typeof parsed.code !== "string" || typeof parsed.at !== "number") {
      clearReferral();
      return null;
    }
    if (Date.now() - parsed.at > TTL_MS) {
      clearReferral();
      return null;
    }
    return isValidCodeShape(parsed.code) ? parsed.code : null;
  } catch {
    // Anything unparseable is junk from an older format or another tab. Drop
    // it rather than carrying it forever.
    clearReferral();
    return null;
  }
}

/** Forgets the held referral. Call only once the backend has acknowledged it. */
export function clearReferral(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do — see captureReferral */
  }
}
