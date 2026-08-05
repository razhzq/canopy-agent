"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { PRIVY_APP_ID, privyConfig } from "@/lib/privy";

/**
 * Wraps the app in Privy.
 *
 * When no app id is configured the provider is skipped entirely rather than
 * mounted with an empty string — Privy throws on an invalid app id, which would
 * white-screen every page including the ones that need no auth at all. A
 * missing app id should degrade to "you cannot sign in", not to "nothing
 * renders".
 */
export function Providers({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID) return <>{children}</>;

  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
      {children}
    </PrivyProvider>
  );
}
