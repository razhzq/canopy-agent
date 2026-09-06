"use client";

import { useMemo } from "react";
import { PrivyProvider, type PrivyClientConfig } from "@privy-io/react-auth";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { PRIVY_APP_ID, privyConfig } from "@/lib/privy";
import { rpcUrl, wsUrl } from "@/lib/chainBalance";
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
  /**
   * THE RPC PRIVY SENDS THROUGH. Privy 3.x's `useSignAndSendTransaction`
   * broadcasts over an RPC the app must hand it under `solana.rpcs`, keyed by
   * chain; without one it throws "No RPC configuration found for chain
   * solana:mainnet" the moment a withdrawal is signed. Built here, in the
   * browser, rather than in lib/privy.ts: the default endpoint is the app's
   * own proxy at a relative path, which only resolves against an origin.
   */
  const config = useMemo<PrivyClientConfig>(() => {
    if (typeof window === "undefined") return privyConfig;
    return {
      ...privyConfig,
      solana: {
        ...privyConfig.solana,
        rpcs: {
          "solana:mainnet": {
            rpc: createSolanaRpc(rpcUrl()),
            rpcSubscriptions: createSolanaRpcSubscriptions(wsUrl()),
            blockExplorerUrl: "https://solscan.io",
          },
        },
      },
    };
  }, []);

  const inner = PRIVY_APP_ID ? (
    <PrivyProvider appId={PRIVY_APP_ID} config={config}>
      {children}
    </PrivyProvider>
  ) : (
    children
  );

  return <LocaleProvider>{inner}</LocaleProvider>;
}
