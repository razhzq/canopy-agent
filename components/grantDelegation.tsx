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
import { assignableWallets, type WalletFacts } from "@/lib/wallets";
import { PRIMARY, StatusLine } from "@/components/kit";
import { useT, type TranslationKey } from "@/lib/i18n";

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

/** Privy's wallet, described in the terms lib/wallets reasons about. */
function facts(w: EmbeddedWallet): WalletFacts & { wallet: EmbeddedWallet } {
  return {
    address: w.address,
    // Both are always set — embeddedSolanaWallets filtered on them — but the
    // SDK types them optional, and a cast here would be a lie for no gain.
    client: w.walletClientType ?? "",
    chain: w.chainType ?? "",
    index: w.walletIndex ?? null,
    delegated: w.delegated === true,
    wallet: w,
  };
}

/**
 * A wallet this agent may be given.
 *
 * THE USER'S PERSONAL WALLET IS NOT A CANDIDATE. That rule lives in
 * lib/wallets, shared with the account menu, so the wallet the menu calls
 * "yours" and the wallet this refuses to hand out cannot come apart — which is
 * exactly how the personal wallet became assignable in the first place. This
 * used to be "lowest unclaimed wallet", and the login wallet is index 0 and
 * unclaimed, so it was always first in line.
 *
 * Still deterministic, so a retry lands on the SAME wallet: nothing is claimed
 * until registration succeeds, so an unstable pick would grant on one wallet,
 * fail, and grant on a different one next time — spending a fresh wallet's
 * worth of user consent per attempt.
 */
function firstFreeWallet(user: User | null, claimed: Set<string>): EmbeddedWallet | undefined {
  return assignableWallets(embeddedSolanaWallets(user).map(facts), claimed)[0]?.wallet;
}

type Phase =
  | { step: "idle" }
  | { step: "preparing" }
  | { step: "granting" }
  | { step: "registering" }
  | { step: "done"; result: RegisteredWallet }
  | { step: "error"; message: string };

const LABEL: Record<Phase["step"], TranslationKey> = {
  idle: "gd_grant",
  preparing: "gd_preparing",
  granting: "gd_granting",
  registering: "gd_registering",
  done: "gd_grant",
  error: "gd_grant",
};

export function GrantDelegation({
  agentId,
  maxSpendUsd,
  expiresAt,
  onGranted,
  /**
   * What the button says at rest.
   *
   * Overridable because the same act has two audiences. At go-live the reader
   * has already met the word "delegation" and it is the precise term; funding a
   * brand-new agent is most people's FIRST sight of this button, and there the
   * precise term names a mechanism they have no model of yet. The in-flight
   * labels are not overridable — "Approve in your wallet" is the same sentence
   * to everyone.
   */
  idleLabelKey = "gd_grant",
}: {
  agentId: number;
  maxSpendUsd: number;
  expiresAt: Date;
  onGranted?: (result: RegisteredWallet) => void;
  idleLabelKey?: TranslationKey;
}) {
  const { user, getAccessToken } = usePrivy();
  const t = useT();
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

    // Nothing spare — which is the NORMAL path for an account that only ever
    // had its login wallet, now that the login wallet is off limits. A fresh
    // wallet per agent is the architecture (CANOPY_036), not a fallback.
    //
    // `createAdditional` is required: without it Privy refuses for a user who
    // already has an embedded wallet, which by this point is everyone.
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
        throw new Error(t("gd_err_not_configured"));
      }

      setPhase({ step: "preparing" });
      let token = await getAccessToken();
      if (!token) throw new Error(t("gd_err_session"));

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
      if (!token) throw new Error(t("gd_err_session"));

      const delegated = walletAt(granted, address);
      if (!delegated?.id) {
        throw new Error(t("gd_err_no_wallet_id"));
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
    if (custodial) {
      // Rule 4's exception. "This wallet is Canopy's, not yours" is the rare
      // thing a reader genuinely needs interrupting for, so it keeps a surface.
      return (
        <div className="space-y-2 rounded-lg border border-warning p-4" role="status">
          <p className="font-mono text-[11px] tracking-[0.08em] text-warning uppercase">
            {t("gd_active_custodial")}
          </p>
          <p className="font-ui text-[12.5px] leading-relaxed text-text-secondary">
            {t("gd_custodial_body")}
          </p>
        </div>
      );
    }
    // The ordinary outcome, and rule 4 says it is a dot and a word. It was a
    // bordered accent panel — the loudest object on whatever screen it landed
    // on, spent on "this worked", which leaves nothing louder for the case
    // directly above that actually needs it.
    return (
      <div className="space-y-1.5" role="status">
        <StatusLine tone="good">{t("gd_active")}</StatusLine>
        <p className="max-w-[46ch] font-ui text-[12px] leading-relaxed text-text-dim">
          {t("gd_self_custody_body")}
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
        className={PRIMARY}
      >
        {t(phase.step === "idle" ? idleLabelKey : LABEL[phase.step])}
      </button>

      {/* No "you have no Solana wallet" case any more: this flow creates one
          when the account has none spare, so an empty account is the ordinary
          path rather than a blocked one. */}

      {misconfigured && (
        <p className="font-ui text-[13px] text-warning">{t("gd_misconfigured")}</p>
      )}

      {phase.step === "error" && (
        <p className="font-ui text-[13px] text-negative" role="alert">
          {phase.message}
        </p>
      )}
    </div>
  );
}
