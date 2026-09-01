"use client";

// The one prompt an order-book agent costs its owner.
//
// KalqiX and PhantX both need two EIP-191 signatures from the owner's Base
// address before an agent can trade: the SIWE login that mints their API key,
// and the REGISTER_AGENT_WALLET payload that authorises the agent's signing
// key. Neither is a signature canopy-be can produce from its own credentials,
// and that is the point — otherwise the server could register signing keys on
// anyone's venue account.
//
// So they were two wallet prompts, in the middle of an otherwise automatic
// flow, over payloads nobody can read. This replaces both with one grant: the
// user delegates their EVM wallet to Canopy's signer, under a policy that
// permits `personal_sign` and nothing else, and from then on the server signs
// onboarding for every agent they build. Same shape as the Solana grant in
// grantDelegation.tsx, and revocable the same way.
//
// WHAT THIS DOES NOT GRANT.
//
// Not a transfer, not a trade, not a transaction of any kind. The policy is
// signatures only, and the two payloads it will ever be asked for are a login
// and a key registration. Trading authority lives elsewhere entirely: orders
// are signed with a Schnorr key held server-side per agent, and what it may
// spend is bounded by the venue account's own balance.

import { useEffect, useState } from "react";
import { usePrivy, useSigners, useUser, type User } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth";

import { AGENT_KEY_QUORUM_ID, CLOB_POLICY_ID } from "@/lib/privy";
import { getClobSigner, registerClobSigner } from "@/lib/api";
import { PRIMARY, StatusLine } from "@/components/kit";

type EmbeddedWallet = Extract<
  NonNullable<User["linkedAccounts"]>[number],
  { type: "wallet" }
>;

/** The account's Privy-embedded EVM wallets. Order is not meaningful. */
function evmWallets(user: User | null): EmbeddedWallet[] {
  return (user?.linkedAccounts ?? []).filter(
    (a): a is EmbeddedWallet =>
      a.type === "wallet" &&
      a.chainType === "ethereum" &&
      (a.walletClientType === "privy" || a.walletClientType === "privy-v2"),
  );
}

function walletAt(user: User | null, address: string): EmbeddedWallet | undefined {
  return evmWallets(user).find((w) => w.address.toLowerCase() === address.toLowerCase());
}

type Phase =
  | { step: "idle" }
  | { step: "preparing" }
  | { step: "granting" }
  | { step: "registering" }
  | { step: "done"; address: string }
  | { step: "error"; message: string };

const LABEL: Record<Phase["step"], string> = {
  idle: "Let it trade the order book",
  preparing: "Preparing…",
  granting: "Approve in your wallet",
  registering: "Finishing…",
  done: "Let it trade the order book",
  error: "Let it trade the order book",
};

export function GrantClobDelegation({
  privyId,
  onGranted,
}: {
  privyId: string;
  /** Fires with the delegated address once the server has recorded it. */
  onGranted?: (address: string) => void;
}) {
  const { user } = usePrivy();
  const { refreshUser } = useUser();
  const { addSigners } = useSigners();
  const { createWallet } = useCreateWallet();
  const [phase, setPhase] = useState<Phase>({ step: "idle" });

  const misconfigured = !AGENT_KEY_QUORUM_ID || !CLOB_POLICY_ID;

  // Already granted? Then this is a done step, not an ask.
  //
  // The delegation is per ACCOUNT, not per agent — the second order-book agent
  // someone builds must not be asked again. Read from the server rather than
  // from the wallet's `delegated` flag: what matters is whether canopy-be holds
  // a signer row it can actually sign with, and a wallet delegated for
  // something else would answer the wrong question.
  useEffect(() => {
    let live = true;
    getClobSigner(privyId)
      .then((state) => {
        if (live && state.delegated && state.address) {
          setPhase({ step: "done", address: state.address });
        }
      })
      // Silent: a status read that fails leaves the button showing, which asks
      // for a grant that is idempotent anyway. An error banner here would be
      // about our fetch, not about anything the reader can act on.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [privyId]);

  /**
   * The EVM wallet this delegation is granted on.
   *
   * ONE PER ACCOUNT, and reused rather than created where one exists. The
   * address IS the venue identity — KalqiX binds the API key to whatever
   * signed the SIWE message — so a second wallet would quietly become a second
   * account with its own balance, and the agents pointed at the first would
   * look unfunded.
   */
  async function chooseWallet(): Promise<string> {
    const existing = evmWallets(user)[0];
    if (existing) return existing.address;

    // Ask Privy rather than React before creating: hook state is a render
    // behind, and creating a wallet is the one step here that cannot be undone.
    const latest = await refreshUser().catch(() => user);
    const fresh = evmWallets(latest ?? null)[0];
    if (fresh) return fresh.address;

    // The EVM hook returns the wallet itself, where the Solana one returns
    // `{ wallet }`. Same package, two shapes — worth naming rather than
    // discovering through a runtime undefined.
    const created = await createWallet({ createAdditional: true });
    return created.address;
  }

  /**
   * The user object with `address` on it, waited for rather than assumed.
   *
   * `addSigners` resolves the address against the account's linked accounts,
   * and a wallet created a moment ago is not on the user object the instant
   * `createWallet` resolves — see the same note in grantDelegation.tsx, where
   * this was the reason the button appeared to need pressing twice.
   */
  async function linkedUser(address: string): Promise<User> {
    if (user && walletAt(user, address)) return user;
    let latest: User | null = user;
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise((r) => setTimeout(r, attempt === 0 ? 200 : 650));
      latest = await refreshUser().catch(() => latest);
      if (latest && walletAt(latest, address)) return latest;
    }
    throw new Error("the new wallet has not appeared on your account yet — try again in a moment");
  }

  async function grant() {
    try {
      if (misconfigured) {
        // Without both ids the grant would attach a signer with no policy — a
        // signer that may sign anything the key allows, rather than the two
        // onboarding payloads. Refused here so it can never be granted.
        throw new Error(
          "order-book delegation is not configured — the signer and CLOB policy ids are missing",
        );
      }

      setPhase({ step: "preparing" });
      const address = await chooseWallet();
      const owner = walletAt(user, address) ? user : await linkedUser(address);

      setPhase({ step: "granting" });
      try {
        await addSigners({
          address,
          signers: [{ signerId: AGENT_KEY_QUORUM_ID, policyIds: [CLOB_POLICY_ID] }],
        });
      } catch (err) {
        // Already carrying the signer is not a failure to be delegated — it is
        // the grant already existing, which is where a retry after a failed
        // registration lands. Asked of Privy, not of stale hook state.
        const latest = (await refreshUser().catch(() => owner)) ?? owner;
        if (!walletAt(latest, address)?.delegated) throw err;
      }

      setPhase({ step: "registering" });
      // The server verifies the pair with Privy before storing it, so a wallet
      // id that does not match this address is refused there rather than
      // becoming a signer that signs as somebody else.
      const walletId = walletAt((await refreshUser().catch(() => user)) ?? user, address)?.id;
      if (!walletId) {
        throw new Error("the grant completed but Privy did not return a wallet id");
      }
      await registerClobSigner({ privyId, walletId, address });

      setPhase({ step: "done", address });
      onGranted?.(address);
    } catch (err) {
      setPhase({ step: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  if (phase.step === "done") {
    // Rule 4: a dot and a word. Nothing here needs a panel — it is a true,
    // unremarkable fact, and the loud treatment is reserved for the cases that
    // actually interrupt someone.
    return (
      <div className="space-y-1.5" role="status">
        <StatusLine tone="good">Order-book trading is authorised.</StatusLine>
        <p className="max-w-[46ch] font-ui text-[12px] leading-relaxed text-text-dim">
          You own this wallet. The signer can sign your venue logins and nothing
          else, and you can end it from your wallet settings at any time.
        </p>
      </div>
    );
  }

  const busy =
    phase.step === "preparing" || phase.step === "granting" || phase.step === "registering";

  return (
    <div className="space-y-4">
      <p className="max-w-[46ch] font-ui text-[12px] leading-relaxed text-text-dim">
        One approval, once. It lets Canopy sign your order-book logins so your
        agents can start trading without asking you again. It cannot move funds.
      </p>

      <button type="button" onClick={grant} disabled={busy || misconfigured} className={PRIMARY}>
        {LABEL[phase.step]}
      </button>

      {misconfigured && (
        <p className="font-ui text-[13px] text-warning">
          Order-book delegation is not configured on this deployment. Set the
          signer and CLOB policy ids.
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

/** Whether this account has already granted it — for callers that gate on it. */
export async function hasClobDelegation(privyId: string): Promise<boolean> {
  return (await getClobSigner(privyId)).delegated;
}
