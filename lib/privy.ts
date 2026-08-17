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

// Live trading is NOT switched here.
//
// This file used to carry its own `LIVE_TRADING_ENABLED` constant, mirroring
// the backend's. Two switches for one decision: a deploy that changed one and
// not the other shipped either a promote button the server refuses, or no
// button for a promotion it would have allowed — and nothing in this file said
// which copy was authoritative.
//
// The single switch is canopy-be/src/config/liveTrading.ts. The server reports
// its value as `liveTradingEnabled` on GET /agents/:agentId, and the agent page
// renders from that, treating an absent field as false.


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
    //
    // `users-without-wallets`, NOT `all-users`. Three things create a Solana
    // wallet on this Privy app — this config, canopy-fe's identical one (same
    // app id, by design), and canopy-fe's SolanaWalletBackfill, which calls
    // createWallet() outright. Each guards only against its own prior run, and
    // `all-users` skips the "do they already have one" check entirely. A
    // concurrent login across the two products created three Solana wallets on
    // one account 386ms apart.
    //
    // That is not cosmetic. `Wallet.id` differs per wallet, so a grant that
    // lands on one and a registration that describes another produce "this
    // wallet has not delegated signing to Canopy" while the delegation sits
    // safely on a sibling. grantDelegation.tsx now pins the wallet by address,
    // which makes the product correct with duplicates present; this stops
    // making more.
    //
    // The setting is chain-scoped despite what the SDK's own doc comment says.
    // The prose claims `users-without-wallets` creates only for users with no
    // wallet of ANY kind — which would starve anyone holding the Ethereum
    // wallet above. The implementation filters `linkedAccounts` on
    // `chainType === "solana"` alone, so a user with an Ethereum wallet and no
    // Solana one still gets provisioned. Verified in the installed bundle
    // rather than taken from the docs, because the difference is the whole
    // safety of this line.
    //
    // Residual: two products opened at the same instant by a user with NO
    // Solana wallet still race, because both check before either writes. Privy
    // offers no cross-tab lock. This closes every other path — anyone who
    // already has a wallet now provokes no second one — and the address pin
    // covers what remains. Privy has no wallet delete, so accounts that already
    // accumulated wallets keep them either way.
    solana: { createOnLogin: "users-without-wallets" },
  },
};
