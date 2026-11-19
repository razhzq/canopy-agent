import { redirect } from "next/navigation";
// Mirrors DEFAULT_ROUTE in components/routeMemory.tsx, which is a client module
// and cannot be read from a server component.
const DEFAULT_ROUTE = "/ask";

/**
 * The app has no page at `/`: the landing page is its own deployment
 * (packages/landing, agent.canopy.finance). Straight into the app, keeping the
 * query string so a `?ref=` link still reaches ReferralCapture.
 */
export default async function Root({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    for (const value of Array.isArray(v) ? v : v === undefined ? [] : [v]) params.append(k, value);
  }
  const qs = params.toString();
  redirect(qs ? `${DEFAULT_ROUTE}?${qs}` : DEFAULT_ROUTE);
}
