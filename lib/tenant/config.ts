// The tenant this page is serving, as the backend describes it
// (GET /api/agent-tenant/config — canopy-be services/tenantService.ts
// `toPublicConfig`). Everything here is public; no secret ever reaches the
// browser.
//
// One deployment serves every hosted tenant. Which one a request is for is
// decided by its host on the server (lib/tenant/server.ts) and handed to the
// client through TenantProvider (lib/tenant/context.tsx).

export type Instrument = "spot" | "perp" | "lp";
export type Feature = "atlas" | "earnings" | "telegram" | "billing" | "clob" | "copyLp";
export type LoginMethod = "email" | "wallet" | "google" | "twitter" | "discord";

export interface TenantConfig {
  slug: string;
  name: string;
  isPlatform: boolean;
  appUrl: string;
  privy: {
    appId: string;
    agentKeyQuorumId: string | null;
    agentPolicyId: string | null;
    clobPolicyId: string | null;
    loginMethods: LoginMethod[];
  };
  brand: {
    accentColor: string | null;
    logoUrl: string | null;
    logoInkUrl: string | null;
    markUrl: string | null;
    faviconUrl: string | null;
  };
  instruments: Instrument[];
  features: Record<Feature, boolean>;
  gaMeasurementId: string | null;
}

/** Canopy's own accent, used when a tenant sets none. */
export const DEFAULT_ACCENT = "#5ED3B3";

/**
 * Canopy, from this build's env — what the app was before tenants.
 *
 * Served only for the platform's own hosts when the backend cannot be reached
 * (or predates the config endpoint), so a backend outage or an out-of-order
 * deploy never takes agent.canopy.finance down. A tenant host never falls back
 * to it: showing Canopy's login on a partner's domain would be worse than an
 * error.
 */
export const PLATFORM_FALLBACK: TenantConfig = {
  slug: "canopy",
  name: "Canopy",
  isPlatform: true,
  appUrl: "https://agent.canopy.finance",
  privy: {
    appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || "",
    agentKeyQuorumId: process.env.NEXT_PUBLIC_PRIVY_AGENT_KEY_QUORUM_ID || null,
    agentPolicyId: process.env.NEXT_PUBLIC_PRIVY_AGENT_POLICY_ID || null,
    clobPolicyId: process.env.NEXT_PUBLIC_PRIVY_CLOB_POLICY_ID || null,
    loginMethods: ["email", "wallet"],
  },
  brand: { accentColor: null, logoUrl: null, logoInkUrl: null, markUrl: null, faviconUrl: null },
  instruments: ["spot", "perp", "lp"],
  features: { atlas: true, earnings: true, telegram: true, billing: true, clob: true, copyLp: true },
  gaMeasurementId: process.env.NEXT_PUBLIC_GA_ID || null,
};
