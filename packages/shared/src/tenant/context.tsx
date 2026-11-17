"use client";

// The tenant on the client. Set once by the root layout from the server's
// lookup; read anywhere with `useTenant()`.

import { createContext, useContext, type ReactNode } from "react";
import { PLATFORM_FALLBACK, type Feature, type Instrument, type TenantConfig } from "./config";

const Ctx = createContext<TenantConfig>(PLATFORM_FALLBACK);

export function TenantProvider({ tenant, children }: { tenant: TenantConfig; children: ReactNode }) {
  return <Ctx.Provider value={tenant}>{children}</Ctx.Provider>;
}

export function useTenant(): TenantConfig {
  return useContext(Ctx);
}

/** Whether this tenant offers a feature. */
export function useFeature(feature: Feature): boolean {
  return useContext(Ctx).features[feature];
}

/** Whether this tenant's agents may trade an instrument live. */
export function useInstrument(instrument: Instrument): boolean {
  return useContext(Ctx).instruments.includes(instrument);
}
