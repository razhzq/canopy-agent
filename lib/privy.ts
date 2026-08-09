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

/**
 * The signer a user grants their agent, and the policy that constrains it.
 * Both are created by `pnpm provision:privy` in canopy-be.
 *
 * Public on purpose — neither is a secret. The quorum id names a signer whose
 * private key never leaves canopy-be, and the policy id names a rule set
 * enforced inside Privy's enclave. Knowing either grants nothing.
 *
 * Drift between these and the backend's own copy is possible and fails CLOSED:
 * a grant naming the wrong quorum registers nothing, because registration asks
 * Privy which signer is actually on the wallet and refuses anything it does not
 * recognise. A confusing error beats a silent custodial fallback.
 */
export const AGENT_KEY_QUORUM_ID =
  process.env.NEXT_PUBLIC_PRIVY_AGENT_KEY_QUORUM_ID || "";
export const AGENT_POLICY_ID = process.env.NEXT_PUBLIC_PRIVY_AGENT_POLICY_ID || "";

/**
 * Whether going live is offered at all.
 *
 * NOT THE CONTROL. The backend refuses the promotion regardless of what this
 * says — a flag the browser can read is a flag the browser can ignore, and
 * anyone can POST the endpoint directly. The real switch is the constant in
 * canopy-be/src/config/liveTrading.ts. This one only decides whether the UI
 * offers the button or explains that live isn't open yet.
 *
 * A constant rather than NEXT_PUBLIC_*, matching the backend: real-money
 * trading turning on should be a reviewed code change on both sides, not a
 * value that could differ between two deploys of the same build.
 *
 * If the two disagree the backend wins, and the worst outcome is a button
 * that explains it cannot proceed — never a promotion the backend did not
 * intend to allow.
 */
export const LIVE_TRADING_ENABLED = false;

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
