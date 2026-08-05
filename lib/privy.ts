// Privy — the USER layer.
//
// This authenticates the human. It is not the agent's execution authority:
// an agent trades from its own dedicated wallet, which is provisioned and
// capped server-side. Signing in here never authorises a trade.
//
// SAME APP ID AS canopy-fe, on purpose. One Privy app means one identity: a
// user already signed in on the DEX is the same `did:privy:…` here, resolves to
// the same `users` row, and owns the same agents. A second app would have made
// agent.canopy.finance a separate account system with a separate user table
// relationship, which is not what "log in with Canopy" should mean.
//
// The backend verifies tokens minted here against this same app id's JWKS
// (PRIVY_APP_ID in canopy-be), so the two must not drift apart.

import type { PrivyClientConfig } from "@privy-io/react-auth";

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

export const privyConfig: PrivyClientConfig = {
  // Matches canopy-fe so the login experience is the one users already know.
  loginMethods: ["email"],
  appearance: {
    theme: "dark",
    // canopy-fe uses #5ED3B3; the agent stack's own accent is #3ddc91, lifted
    // from the .pen. The modal should look like the product it opens over.
    accentColor: "#3ddc91",
    showWalletLoginFirst: false,
  },
  embeddedWallets: {
    ethereum: { createOnLogin: "users-without-wallets" },
    // Solana for every user: the agent stack is Solana-first, and the agent
    // wallet is provisioned against the same identity.
    solana: { createOnLogin: "all-users" },
  },
};
