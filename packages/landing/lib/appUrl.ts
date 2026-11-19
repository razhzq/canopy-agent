// Where the app lives. The landing page is its own deployment
// (agent.canopy.finance); every way into the product is a link to this host,
// because a Privy session belongs to the origin it was made on: logging in
// here would not be logged in over there.

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://app.canopy.finance").replace(/\/+$/, "");

/** The app page a "Log in" / "Sign up" button opens. */
export const APP_ENTRY = "/";

/** `path` on the app host, carrying `?ref=` through so the app can attribute the sign-up. */
export function appHref(path: string, ref: string | null): string {
  const url = new URL(path, APP_URL);
  if (ref) url.searchParams.set("ref", ref);
  return url.toString();
}
