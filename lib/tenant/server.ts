// Which tenant a request is for, decided on the server from its host.
//
// Server-only: it reads request headers. Pages and layouts call `getTenant()`;
// the root layout passes the result to the client via TenantProvider.

import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PLATFORM_FALLBACK, type Feature, type TenantConfig } from "./config";

const API = process.env.NEXT_PUBLIC_CANOPY_API_URL ?? "http://localhost:3001";

/** `<slug>.<base>` is a hosted tenant's default address. */
const BASE_DOMAIN = (process.env.AGENT_TENANT_BASE_DOMAIN || "agent.canopy.finance").toLowerCase();

/**
 * Hosts that are the platform's app however they are reached: development
 * and Vercel previews. Sent to the backend as the base domain.
 */
function isPlatformAlias(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".vercel.app") ||
    (process.env.AGENT_PLATFORM_HOSTS || "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .includes(host)
  );
}

/** The host the backend should resolve for this request. */
async function lookupHost(): Promise<string> {
  // Development override: serve one tenant whatever the address.
  const forced = process.env.AGENT_TENANT_FORCE_SLUG;
  if (forced) return forced === "canopy" ? BASE_DOMAIN : `${forced}.${BASE_DOMAIN}`;

  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  return isPlatformAlias(host) ? BASE_DOMAIN : host;
}

/**
 * The tenant for this request, or null when no hosted tenant lives at this
 * address. Deduplicated per request by `cache`, and across requests by the
 * fetch cache for a minute (a suspension or rebrand lands within that).
 */
export const getTenant = cache(async (): Promise<TenantConfig | null> => {
  const host = await lookupHost();
  const isPlatformHost = host === BASE_DOMAIN;
  try {
    const res = await fetch(`${API}/api/agent-tenant/config?host=${encodeURIComponent(host)}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) return (await res.json()) as TenantConfig;
    if (res.status === 404 && !isPlatformHost) return null;
    throw new Error(`tenant config answered ${res.status}`);
  } catch (err) {
    if (isPlatformHost) return PLATFORM_FALLBACK;
    console.error("[tenant] config lookup failed", host, err);
    throw err;
  }
});

/**
 * 404s a page this tenant does not offer. The nav already hides it; this is
 * what stops a deep link reaching it anyway.
 */
export async function requireFeature(feature: Feature): Promise<void> {
  const tenant = await getTenant();
  if (!tenant?.features[feature]) notFound();
}
