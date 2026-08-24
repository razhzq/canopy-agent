"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { PRIVY_APP_ID, privyConfig } from "@/lib/privy";
import { LocaleProvider } from "@/lib/i18n";

/**
 * Wraps the app in Privy and in the locale dictionary.
 *
 * When no app id is configured the Privy provider is skipped entirely rather
 * than mounted with an empty string — Privy throws on an invalid app id, which
 * would white-screen every page including the ones that need no auth at all. A
 * missing app id should degrade to "you cannot sign in", not to "nothing
 * renders".
 *
 * LocaleProvider sits OUTSIDE that branch, and outside Privy. The marketing
 * page renders without a session and still has to be readable in Chinese, and
 * a signed-out visitor who switches language must not lose the choice the
 * moment they sign in and the tree below Privy remounts.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const inner = PRIVY_APP_ID ? (
    <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
      {children}
    </PrivyProvider>
  ) : (
    children
  );

  return <LocaleProvider>{inner}</LocaleProvider>;
}
