"use client";

// Giving an agent its own wallet, and giving Canopy permission to sign from it.
//
// Three steps against three different authorities, and they are not
// interchangeable:
//
//   1. THE WALLET. This agent gets a Solana wallet nothing else is using —
//      reused from the account's spare wallets when there is one, created here
//      when there is not.
//   2. THE GRANT. The user's own Privy session adds Canopy's signer to that
//      wallet, constrained by our policy. Canopy's backend is not involved and
//      could not perform this step — which is exactly why the resulting wallet
//      is the user's and not ours.
//   3. THE REGISTRATION. Canopy notices. The backend re-reads the wallet from
//      Privy and refuses anything that does not match, so this step confers no
//      authority; it only records what step 2 already made true.
//
// ONE AGENT, ONE WALLET — AND THAT IS WHAT STEP 1 IS FOR.
//
// This used to delegate from the account's LOGIN wallet, resolved the same way
// for every agent. The first agent claimed it; the second collided on
// `uq_trading_agent_wallets_provider` and the user got a raw duplicate-key
// error. An account was capped at one delegated agent and nothing said so.
//
// It was the wrong wallet on its own terms too. Balances are read per wallet,
// so the funding screen reported the user's whole personal balance as that
// agent's capital — and canopy-agent shares a Privy app with canopy-fe, so it
// was their exchange wallet.
//
// WHY THE WALLET IS NOT CREATED ON THE SERVER.
//
// It was, briefly. `wallets().create({ owner: { user_id } })` makes a wallet
// Privy agrees belongs to the user — it comes back under `list({user_id})` and
// carries the user's own key quorum as owner. But it is NOT a linked account on
// the client's user object, and `addSigners` resolves addresses against linked
// accounts. So the grant failed with "address to add signers to is not
// associated with current user", and no amount of `refreshUser()` helps: there
// is nothing to refresh into.
//
// A wallet created HERE is a linked account from birth, so step 2 works. The
// cost is that the browser has to be careful about not creating wallets it does
// not need — see `chooseWallet`.

import { useState } from "react";
import { usePrivy, useSigners, type User } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/solana";
import { AGENT_KEY_QUORUM_ID, AGENT_POLICY_ID } from "@/lib/privy";
import { getClaimedWallets, registerAgentWallet, type RegisteredWallet } from "@/lib/api";

type EmbeddedWallet = Extract<
  NonNullable<User["linkedAccounts"]>[number],
  { type: "wallet" }
>;

/** Every Privy-embedded Solana wallet on the account. Order not meaningful. */
function embeddedSolanaWallets(user: User | null): EmbeddedWallet[] {
  return (user?.linkedAccounts ?? []).filter(
    (a): a is EmbeddedWallet =>
      a.type === "wallet" &&
      a.chainType === "solana" &&
      (a.walletClientType === "privy" || a.walletClientType === "privy-v2"),
  );
}

/** The wallet at exactly this address. Never used to CHOOSE one. */
function walletAt(user: User | null, address: string): EmbeddedWallet | undefined {
  return embeddedSolanaWallets(user).find((w) => w.address === address);
}

/**
 * A wallet no other agent has claimed, in a stable order.
 *
 * Deterministic so a retry lands on the SAME wallet: nothing is claimed until
 * registration succeeds, so an unstable pick would grant on one wallet, fail,
 * and grant on a different one next time — spending a fresh wallet's worth of
 * user consent per attempt. Ties break on `walletIndex`, then address, which is
 * the ordering the old code used for the same reason.
 */
function firstFreeWallet(user: User | null, claimed: Set<string>): EmbeddedWallet | undefined {
  return embeddedSolanaWallets(user)
    .filter((w) => !claimed.has(w.address))
    .sort((a, b) => {
      const ai = a.walletIndex ?? Number.MAX_SAFE_INTEGER;
      const bi = b.walletIndex ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.address.localeCompare(b.address);
    })[0];
}

type Phase =
  | { step: "idle" }
  | { step: "preparing" }
  | { step: "granting" }
  | { step: "registering" }
  | { step: "done"; result: RegisteredWallet }
  | { step: "error"; message: string };

const LABEL: Record<Phase["step"], string> = {
  idle: "Grant delegation",
  preparing: "Preparing this agent's wallet…",
  granting: "Approve in your wallet…",
  registering: "Recording…",
  done: "Grant delegation",
  error: "Grant delegation",
};

export function GrantDelegation({
  agentId,
  maxSpendUsd,
  expiresAt,
  onGranted,
}: {
  agentId: number;
  maxSpendUsd: number;
  expiresAt: Date;
  onGranted?: (result: RegisteredWallet) => void;
}) {
  const { user, getAccessToken } = usePrivy();
  const { addSigners } = useSigners();
  const { createWallet } = useCreateWallet();
  const [phase, setPhase] = useState<Phase>({ step: "idle" });

  const misconfigured = !AGENT_KEY_QUORUM_ID || !AGENT_POLICY_ID;

  /**
   * The wallet this agent will delegate from.
   *
   * Reuse before creation, in three tiers: the wallet this agent already holds
   * (a retry after a half-finished grant), then any wallet no agent has
   * claimed, and only then a new one.
   */
  async function chooseWallet(token: string): Promise<{ address: string; from: string }> {
    const claimed = await getClaimedWallets(token);

    const mine = claimed.byAgent[String(agentId)];
    if (mine) return { address: mine, from: "existing" };

    const free = firstFreeWallet(user, new Set(claimed.addresses));
    if (free) return { address: free.address, from: "reused" };

    // Nothing spare. `createAdditional` is required: without it Privy refuses
    // for a user who already has an embedded wallet, which by this point is
    // everyone.
    const { wallet } = await createWallet({ createAdditional: true });
    return { address: wallet.address, from: "created" };
  }

  async function grant() {
    try {
      if (misconfigured) {
        // Without both ids the grant would attach a signer with no policy — an
        // agent that may do anything the key allows. Refusing here keeps that
        // from ever being granted, rather than relying on the backend to reject
        // it after the user has already approved something broader than they
        // were shown.
        throw new Error("delegation is not configured — the signer and policy ids are missing");
      }

      setPhase({ step: "preparing" });
      let token = await getAccessToken();
      if (!token) throw new Error("your session expired — sign in and try again");

      // Chosen once. Everything below is pinned to this string, so the wallet
      // that receives the signer and the wallet that gets registered cannot
      // come apart — which they did when the choice was made twice.
      const { address } = await chooseWallet(token);

      setPhase({ step: "granting" });
      // The user object `addSigners` RETURNS, not the one in hook state.
      //
      // `Wallet.id` is null until a wallet is delegated, and the closure's
      // `user` is the pre-grant snapshot — so reading the id from it yields
      // null and the registration below cannot say what it granted. A wallet
      // just created in `chooseWallet` is not in that snapshot at all.
      let granted: User;
      try {
        ({ user: granted } = await addSigners({
          address,
          signers: [{ signerId: AGENT_KEY_QUORUM_ID, policyIds: [AGENT_POLICY_ID] }],
        }));
      } catch (err) {
        // A wallet that already carries the signer can refuse the duplicate.
        // That is not a failure to be delegated — it is the grant already
        // existing, which is the state a retry after a failed registration
        // lands in. Anything else is a real error and is rethrown.
        if (!walletAt(user, address)?.delegated) throw err;
        granted = user as User;
      }

      setPhase({ step: "registering" });
      // Re-read: choosing a wallet and waiting for a wallet approval can take
      // long enough for a token minted before them to be close to expiry.
      token = await getAccessToken();
      if (!token) throw new Error("your session expired — sign in and try again");

      const delegated = walletAt(granted, address);
      if (!delegated?.id) {
        throw new Error(
          "the grant completed but Privy did not return a wallet id — nothing was registered",
        );
      }

      const result = await registerAgentWallet(token, agentId, {
        walletId: delegated.id,
        address,
        maxSpendUsd,
        expiresAt: expiresAt.toISOString(),
      });

      setPhase({ step: "done", result });
      onGranted?.(result);
    } catch (err) {
      setPhase({
        step: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (phase.step === "done") {
    // Reports what the backend VERIFIED, not what was requested. If Privy says
    // Canopy owns this wallet, the user is told plainly rather than shown the
    // reassurance the grant screen carries.
    const custodial = phase.result.ownerModel === "app_owned";
    return (
      <div
        className={`border p-5 ${custodial ? "border-warning" : "border-accent"}`}
        role="status"
      >
        <p
          className={`font-mono text-[12px] tracking-[0.06em] uppercase ${
            custodial ? "text-warning" : "text-accent"
          }`}
        >
          {custodial ? "Delegation active — custodial" : "Delegation active"}
        </p>
        <p className="pt-2 font-ui text-[13px] leading-relaxed text-text-secondary">
          {custodial
            ? "This wallet is owned by Canopy, not by you. Ending the delegation requires Canopy."
            : "You own this wallet. You can end this delegation from your wallet settings at any time, without Canopy."}
        </p>
      </div>
    );
  }

  const busy =
    phase.step === "preparing" ||
    phase.step === "granting" ||
    phase.step === "registering";

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={grant}
        disabled={busy || misconfigured}
        className="border border-accent px-5 py-3 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-black disabled:cursor-not-allowed disabled:border-border disabled:text-text-dim disabled:hover:bg-transparent"
      >
        {LABEL[phase.step]}
      </button>

      {/* No "you have no Solana wallet" case any more: this flow creates one
          when the account has none spare, so an empty account is the ordinary
          path rather than a blocked one. */}

      {misconfigured && (
        <p className="font-ui text-[13px] text-warning">
          Delegation is not configured on this deployment. Run{" "}
          <code className="font-mono">pnpm provision:privy</code> and set the signer and
          policy ids.
        </p>
      )}

      {phase.step === "error" && (
        <p className="font-ui text-[13px] text-negative" role="alert">
          {phase.message}
        </p>
      )}
    </div>
  );
}
