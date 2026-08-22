// Which wallet is the HUMAN's, out of the several this account holds.
//
// One definition, imported by everything that needs it. It used to live in
// nav.tsx alone; grantDelegation.tsx had its own idea of which wallets were
// available, and the two disagreeing is precisely how an agent came to be
// offered the user's personal wallet. A rule about whose money this is should
// not be re-derived per file.
//
// WHAT THE ACCOUNT ACTUALLY HOLDS:
//
//   1 personal wallet   — made at sign-in. The user deposits FROM this one.
//   N agent wallets     — one per live agent, carrying Canopy's signer under a
//                         policy. The user deposits INTO these.
//   any number of spares — duplicates from the old login race, before
//                         `users-without-wallets` and the address pin landed.
//
// Privy does not label any of them. All are embedded Solana wallets on the same
// user, structurally identical, so the distinction has to be reconstructed.

/** The fields any caller can supply, whatever wallet shape it started from. */
export interface WalletFacts {
  address: string;
  /** Privy's `walletClientType`. "privy" / "privy-v2" are the embedded ones. */
  client: string;
  /** Privy's `chainType`. */
  chain: string;
  /** Privy's `walletIndex` — creation order. Sign-in's wallet is normally 0. */
  index: number | null;
  /** Privy's `delegated` — a signer is attached, so an agent is using it. */
  delegated: boolean;
}

/**
 * Embedded Solana wallets, and nothing else.
 *
 * The chain filter is load-bearing, not defensive. `privyConfig` enables an
 * embedded ETHEREUM wallet on login as well, so an account holds at least one
 * non-Solana embedded wallet — and without this filter it sorts by index
 * alongside the Solana ones and can win. The visible result would be an
 * Ethereum address offered as "your wallet" behind a Solana deposit QR.
 *
 * `privy-v2` is included because Privy mints wallets under both client types
 * depending on when the account was created, and a v2 wallet is no less the
 * user's.
 */
export function embeddedSolana<T extends WalletFacts>(wallets: readonly T[]): T[] {
  return wallets.filter(
    (w) => (w.client === "privy" || w.client === "privy-v2") && w.chain === "solana",
  );
}

/** Oldest first, deterministically. Ties break on address, never on input order. */
function byAge<T extends WalletFacts>(wallets: readonly T[]): T[] {
  return [...wallets].sort(
    (a, b) =>
      (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER) ||
      a.address.localeCompare(b.address),
  );
}

/**
 * Is this wallet an agent's?
 *
 * The union of two signals, because each alone has a hole:
 *
 *   registered  — a row in trading_agent_wallets. Authoritative, but arrives
 *                 over the network, and misses a wallet whose grant landed and
 *                 whose registration then failed.
 *   delegated   — a signer is attached, per Privy. Free and synchronous, and
 *                 covers that half-finished case, but a REVOKED delegation
 *                 clears it while the row lives on.
 *
 * Either saying yes is enough.
 */
export function isAgentWallet(w: WalletFacts, claimed: ReadonlySet<string>): boolean {
  return claimed.has(w.address) || w.delegated;
}

/**
 * The user's own wallet: the oldest embedded Solana wallet no agent is using.
 *
 * Erring toward excluding is the safe direction. Showing someone their
 * second-oldest wallet is a cosmetic wrong; showing them an agent's wallet as
 * their own invites a deposit into a wallet the desk will trade.
 *
 * `claimed` empty — not yet loaded, or the request failed — still leaves the
 * `delegated` half working, so this degrades rather than collapsing back to
 * "any wallet at all".
 */
export function personalWallet<T extends WalletFacts>(
  wallets: readonly T[],
  claimed: ReadonlySet<string>,
): T | null {
  return byAge(embeddedSolana(wallets)).find((w) => !isAgentWallet(w, claimed)) ?? null;
}

/**
 * Wallets an agent may be given, oldest first.
 *
 * THE PERSONAL WALLET IS NOT IN HERE, and that is the whole point of this
 * function existing separately from "unclaimed".
 *
 * Delegating the user's own wallet to an agent is not a tidiness problem. The
 * funding screen reads balances per wallet, so it would report the user's
 * entire personal balance as that agent's capital — and because canopy-agent
 * shares a Privy app with canopy-fe, that balance is their exchange wallet.
 * CANOPY_037 then makes it permanent: an agent's wallet is immutable for the
 * life of the agent, so the only way back is to replace the agent.
 *
 * grantDelegation's header records that the old code delegated from the login
 * wallet and that this was fixed. It was fixed for the wallet the code RESOLVED
 * by name — but the reuse tier went on selecting by index, and the login wallet
 * is index 0 and unclaimed, so it was simply first in line again.
 *
 * DELEGATED-BUT-UNREGISTERED WALLETS STAY IN THE POOL, deliberately. That is a
 * grant that landed and whose registration then failed, and the retry has to be
 * able to land on the SAME wallet — otherwise every attempt burns a fresh
 * wallet and a fresh approval, and leaves an orphan behind carrying a signer.
 */
export function assignableWallets<T extends WalletFacts>(
  wallets: readonly T[],
  claimed: ReadonlySet<string>,
): T[] {
  const solana = embeddedSolana(wallets);
  const personal = personalWallet(solana, claimed);
  return byAge(solana).filter((w) => !claimed.has(w.address) && w.address !== personal?.address);
}
