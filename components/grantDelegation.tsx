"use client";

// Giving an agent its own wallet, and giving Canopy permission to sign from it.
//
// Three steps against three different authorities, and they are not
// interchangeable:
//
//   1. PROVISION. canopy-be asks Privy for a NEW Solana wallet whose owner is
//      this user. The wallet is inert: nobody but the user can sign from it
//      yet, and Canopy deliberately does not attach itself here.
//   2. THE GRANT. The user's own Privy session adds Canopy's signer to that
//      wallet, constrained by our policy. Canopy's backend is not involved and
//      could not perform this step — which is exactly why the resulting wallet
//      is the user's and not ours.
//   3. THE REGISTRATION. Canopy notices. The backend re-reads the wallet from
//      Privy and refuses anything that does not match, so this step confers no
//      authority; it only records what step 2 already made true.
//
// STEP 1 IS NEW, AND IT REPLACED A WHOLE CLASS OF BUG.
//
// This used to delegate from the account's LOGIN wallet — the one Privy mints
// at sign-in. There is one of those per account, and it was resolved
// deterministically, so every agent on an account resolved to the SAME wallet.
// The first agent to delegate claimed it; the second collided on a unique index
// and the user got a raw duplicate-key error. The account was capped at one
// live agent and nothing said so.
//
// It was also the wrong wallet on its own terms. Balances are read per wallet,
// so the funding screen reported the user's entire personal balance as that
// agent's tradable capital — and because canopy-agent and canopy-fe share a
// Privy app, it was their exchange wallet too. One pot, presented as an agent's.
//
// So the wallet is created FOR this agent, and everything below is pinned to
// the address step 1 returns. The old code had to guess which of the account's
// wallets to use, ran that guess twice, and could grant on one wallet while
// registering another. There is nothing left to guess.
//
// WHY THE BACKEND DOES NOT JUST ATTACH THE SIGNER ITSELF.
//
// It could — Privy's create call takes `additional_signers` — and the user
// would never see a prompt. That is the custodial-feeling shortcut: the backend
// would be granting itself permission and then verifying its own work.
// Registration exists to check that a HUMAN granted this. So the wallet arrives
// inert and the grant stays where it belongs.

import { useState } from "react";
import { usePrivy, useSigners, useUser, type User } from "@privy-io/react-auth";
import { AGENT_KEY_QUORUM_ID, AGENT_POLICY_ID } from "@/lib/privy";
import {
  provisionAgentWallet,
  registerAgentWallet,
  type RegisteredWallet,
} from "@/lib/api";

type EmbeddedWallet = Extract<
  NonNullable<User["linkedAccounts"]>[number],
  { type: "wallet" }
>;

/**
 * The wallet at exactly this address.
 *
 * The only lookup left. Used to ask one question — is our signer already on
 * it — and never to CHOOSE a wallet, which is what used to go wrong.
 */
function walletAt(user: User | null, address: string): EmbeddedWallet | undefined {
  return (user?.linkedAccounts ?? []).find(
    (a): a is EmbeddedWallet => a.type === "wallet" && a.address === address,
  );
}

type Phase =
  | { step: "idle" }
  | { step: "provisioning" }
  | { step: "granting" }
  | { step: "registering" }
  | { step: "done"; result: RegisteredWallet }
  | { step: "error"; message: string };

const LABEL: Record<Phase["step"], string> = {
  idle: "Grant delegation",
  provisioning: "Creating the agent's wallet…",
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
  const { getAccessToken } = usePrivy();
  // Not on `usePrivy` — `useUser` is the hook Privy documents for picking up a
  // change made by a backend, which is exactly what provisioning is.
  const { refreshUser } = useUser();
  const { addSigners } = useSigners();
  const [phase, setPhase] = useState<Phase>({ step: "idle" });

  const misconfigured = !AGENT_KEY_QUORUM_ID || !AGENT_POLICY_ID;

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

      setPhase({ step: "provisioning" });
      let token = await getAccessToken();
      if (!token) throw new Error("your session expired — sign in and try again");

      // Idempotent at Privy, keyed on the agent: a retry after any failure
      // below returns the SAME wallet rather than minting a second one. That
      // matters more than it looks — Privy cannot delete a wallet, so every
      // duplicate is permanent, and a duplicate is a wallet a user might fund
      // by mistake.
      const { walletId, address } = await provisionAgentWallet(token, agentId);

      // The wallet was created server-side, so this session has never heard of
      // it. `addSigners` resolves by address against the client's user object,
      // which would still be the pre-provision snapshot.
      const refreshed = await refreshUser();

      setPhase({ step: "granting" });
      try {
        await addSigners({
          address,
          signers: [{ signerId: AGENT_KEY_QUORUM_ID, policyIds: [AGENT_POLICY_ID] }],
        });
      } catch (err) {
        // A wallet that already carries the signer can refuse the duplicate.
        // That is not a failure to be delegated — it is the grant already
        // existing, which is the state a retry after a failed registration
        // lands in. Confirmed against Privy rather than assumed: anything else
        // is a real error and is rethrown.
        const already =
          walletAt(refreshed, address)?.delegated ??
          walletAt(await refreshUser(), address)?.delegated ??
          false;
        if (!already) throw err;
      }

      setPhase({ step: "registering" });
      // Re-read: provisioning and a wallet approval can take long enough for a
      // token minted before them to be close to expiry.
      token = await getAccessToken();
      if (!token) throw new Error("your session expired — sign in and try again");

      // `walletId` comes from the backend's own create call, not from the
      // client's view of the user. Privy types `Wallet.id` as null until a
      // wallet is delegated, and reading it from session state is what used to
      // produce a grant that succeeded followed by a registration that could
      // not say what it granted.
      const result = await registerAgentWallet(token, agentId, {
        walletId,
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
    phase.step === "provisioning" ||
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

      {/* No "you have no wallet yet" case any more: this flow CREATES the
          wallet it delegates, so an account with none is the ordinary path
          rather than a blocked one. */}

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
