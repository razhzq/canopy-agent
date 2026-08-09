"use client";

// Granting an agent a scoped delegation, for real.
//
// Two steps against two different authorities, and they are not
// interchangeable:
//
//   1. THE GRANT. The user's own Privy session adds Canopy's signer to their
//      wallet, constrained by our policy. Canopy's backend is not involved and
//      could not perform this step — which is exactly why the resulting wallet
//      is the user's and not ours.
//   2. THE REGISTRATION. Canopy notices. The backend re-reads the wallet from
//      Privy and refuses anything that does not match, so this step confers no
//      authority; it only records what step 1 already made true.
//
// THE WALLET ID DOES NOT EXIST UNTIL AFTER THE GRANT.
//
// Privy types `Wallet.id` as "null if the wallet is not delegated". The
// backend needs that id, so it cannot be read before delegating, and it must
// be read from the user object `addSigners` RETURNS rather than from the
// `user` in hook state — the latter is the pre-grant snapshot and still holds
// a null id. Reading the stale one produces a grant that succeeded followed by
// a registration that cannot say what it granted.

import { useState } from "react";
import { usePrivy, useSigners, type User } from "@privy-io/react-auth";
import { AGENT_KEY_QUORUM_ID, AGENT_POLICY_ID } from "@/lib/privy";
import { registerAgentWallet, type RegisteredWallet } from "@/lib/api";

/** The user's Privy-embedded Solana wallet — the one an agent trades from. */
function embeddedSolanaWallet(user: User | null) {
  return user?.linkedAccounts?.find(
    (a): a is Extract<typeof a, { type: "wallet" }> =>
      a.type === "wallet" &&
      a.chainType === "solana" &&
      (a.walletClientType === "privy" || a.walletClientType === "privy-v2"),
  );
}

type Phase =
  | { step: "idle" }
  | { step: "granting" }
  | { step: "registering" }
  | { step: "done"; result: RegisteredWallet }
  | { step: "error"; message: string };

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
  const [phase, setPhase] = useState<Phase>({ step: "idle" });

  const wallet = embeddedSolanaWallet(user);
  const misconfigured = !AGENT_KEY_QUORUM_ID || !AGENT_POLICY_ID;

  async function grant() {
    try {
      if (!wallet) throw new Error("no Solana wallet on this account");
      if (misconfigured) {
        // Without both ids the grant would attach a signer with no policy —
        // an agent that may do anything the key allows. Refusing here keeps
        // that from ever being granted, rather than relying on the backend to
        // reject it after the user has already approved something broader
        // than they were shown.
        throw new Error("delegation is not configured — the signer and policy ids are missing");
      }

      setPhase({ step: "granting" });
      const { user: granted } = await addSigners({
        address: wallet.address,
        signers: [{ signerId: AGENT_KEY_QUORUM_ID, policyIds: [AGENT_POLICY_ID] }],
      });

      // Re-read from the RETURNED user: `id` was null before this call.
      const delegated = embeddedSolanaWallet(granted);
      if (!delegated?.id) {
        throw new Error(
          "the grant completed but Privy did not return a wallet id — nothing was registered",
        );
      }

      setPhase({ step: "registering" });
      const token = await getAccessToken();
      if (!token) throw new Error("your session expired — sign in and try again");

      const result = await registerAgentWallet(token, agentId, {
        walletId: delegated.id,
        address: delegated.address,
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

  const busy = phase.step === "granting" || phase.step === "registering";

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={grant}
        disabled={busy || !wallet || misconfigured}
        className="border border-accent px-5 py-3 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-black disabled:cursor-not-allowed disabled:border-border disabled:text-text-dim disabled:hover:bg-transparent"
      >
        {phase.step === "granting"
          ? "Approve in your wallet…"
          : phase.step === "registering"
            ? "Recording…"
            : "Grant delegation"}
      </button>

      {!wallet && (
        <p className="font-ui text-[13px] text-text-dim">
          No Solana wallet on this account yet. Sign in to create one.
        </p>
      )}

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
