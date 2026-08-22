"use client";

// The user's own wallet address, for anything that needs to offer a deposit.
//
// The rule for WHICH wallet lives in lib/wallets and is shared with the account
// menu and grantDelegation. This is only the plumbing: read Privy's linked
// accounts, ask the backend which addresses agents have claimed, and hand back
// the one that is the person's.
//
// Cached per identity for the same reason useUsername is: two surfaces want it,
// and asking twice would mean two answers on screen for a moment.

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { getClaimedWallets } from "@/lib/api";
import { personalWallet, type WalletFacts } from "@/lib/wallets";

let claimedCache: ReadonlySet<string> = new Set();
let cachedFor: string | null = null;
let inFlight: Promise<void> | null = null;
const subscribers = new Set<() => void>();

export function usePersonalWallet(): string | null {
  const { authenticated, user, getAccessToken } = usePrivy();
  const privyId = user?.id ?? null;
  const [, bump] = useState(0);

  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);

  useEffect(() => {
    if (!authenticated || !privyId) return;
    if (cachedFor !== privyId) {
      cachedFor = privyId;
      claimedCache = new Set();
      inFlight = null;
    }
    if (inFlight) return;
    inFlight = (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const { addresses } = await getClaimedWallets(token);
        claimedCache = new Set(addresses);
        for (const fn of subscribers) fn();
      } catch {
        // The `delegated` half of the rule still works without this — see
        // personalWallet. Degrades rather than guessing.
      } finally {
        inFlight = null;
      }
    })();
  }, [authenticated, privyId, getAccessToken]);

  const wallets: WalletFacts[] = [];
  const accounts: unknown[] = Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : [];
  for (const entry of accounts) {
    if (!entry || typeof entry !== "object") continue;
    const a = entry as Record<string, unknown>;
    if (a.type !== "wallet" || typeof a.address !== "string") continue;
    wallets.push({
      address: a.address,
      client: typeof a.walletClientType === "string" ? a.walletClientType : "",
      chain: typeof a.chainType === "string" ? a.chainType : "",
      index: typeof a.walletIndex === "number" ? a.walletIndex : null,
      delegated: a.delegated === true,
    });
  }

  return personalWallet(wallets, claimedCache)?.address ?? null;
}
