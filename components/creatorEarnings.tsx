"use client";

// What a wallet you own has earned by being copied.
//
// WHO THIS PAGE IS FOR. Canopy sets aside a share of the profit a copy LP
// agent makes for the LEADER WALLET it mirrors. Nobody had to sign up for
// that, so most people who have earnings here have never heard of it — the
// money is attached to an address, and the only way to collect it is to prove
// you hold that address's key.
//
// THE WALLET IS ALMOST NEVER A CANOPY WALLET. A leader worth copying is
// somebody's real Solana LP, held in Phantom or Backpack. So the first thing
// this page does is let you connect one, and the second is ask you to sign a
// message that says which address, which account, and which one-time nonce.
//
// AVAILABLE AND PENDING ARE NEVER ADDED UP. Available is swept — Canopy holds
// it and it can be paid. Pending is charged but still in the copier's wallet,
// and it can evaporate if that wallet is drained before the sweep. Showing one
// number would promise money that might not arrive.

import { useCallback, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSignMessage, useWallets } from "@privy-io/react-auth/solana";
import {
  finishCreatorVerification,
  requestCreatorClaim,
  startCreatorVerification,
  getCreatorEarnings,
  type CreatorBalance,
  type CreatorClaim,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useT } from "@/lib/i18n";
import { describeError } from "@/lib/errors";
import { Badge } from "@/components/ui";
import { PRIMARY, SECONDARY, SectionLabel } from "@/components/kit";
import { EmptyState, ErrorState, SignedOutState } from "@/components/states";
import { SkeletonPanel } from "@/components/skeleton";

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CreatorEarnings() {
  const t = useT();
  const { ready, authenticated, getAccessToken, linkWallet } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const state = useApi(getCreatorEarnings, []);

  /**
   * Prove one wallet.
   *
   * THE WALLET IS FOUND BY ADDRESS, never by index. An account can hold
   * several, and proving the wrong one would attach somebody's earnings to a
   * wallet they did not mean to name — the same rule the transfer flow follows
   * for the same reason.
   */
  const verify = useCallback(
    async (address: string) => {
      setError("");
      setBusy(address);
      try {
        const wallet = wallets.find((w) => w.address === address);
        if (!wallet) throw new Error(t("ce_err_no_wallet"));
        const token = await getAccessToken();
        if (!token) throw new Error(t("ce_err_signed_out"));
        const challenge = await startCreatorVerification(token, address);
        const { signature } = await signMessage({
          message: new TextEncoder().encode(challenge.message),
          wallet,
        });
        // base58: what the backend's ed25519 check expects, and what every
        // Solana tool prints.
        const { default: bs58 } = await import("bs58");
        await finishCreatorVerification(token, {
          address,
          nonce: challenge.nonce,
          signature: bs58.encode(signature),
        });
        state.reload();
      } catch (err) {
        setError(describeError(err));
      }
      setBusy(null);
    },
    [wallets, signMessage, getAccessToken, state, t],
  );

  const claim = useCallback(
    async (address: string) => {
      setError("");
      setBusy(address);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error(t("ce_err_signed_out"));
        await requestCreatorClaim(token, address);
        state.reload();
      } catch (err) {
        setError(describeError(err));
      }
      setBusy(null);
    },
    [getAccessToken, state, t],
  );

  if (!ready || state.phase === "loading") return <SkeletonPanel labelKey="ce_loading" lines={5} />;
  if (!authenticated || state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "error") return <ErrorState message={state.message} onRetry={state.reload} />;

  const { wallets: earned, claims, minClaimUsd } = state.data;
  // Addresses connected in this browser that have not been proven yet — the
  // only ones there is anything to do about.
  const unproven = wallets.filter((w) => !earned.some((e) => e.address === w.address));
  const openClaim = (address: string): CreatorClaim | undefined =>
    claims.find((c) => c.address === address && ["requested", "approved", "paying"].includes(c.status));

  return (
    <div className="mx-auto max-w-[860px] px-6 py-12 space-y-10">
      <header className="space-y-2">
        <h1 className="font-ui text-[28px] font-light leading-tight tracking-[-0.02em] text-text-primary">
          {t("ce_title")}
        </h1>
        <p className="font-ui text-[13px] leading-relaxed text-text-muted max-w-[62ch]">{t("ce_intro")}</p>
      </header>

      {error ? (
        <p className="rounded-lg border border-negative/20 bg-negative/10 px-3 py-2 font-ui text-[12.5px] text-negative">
          {error}
        </p>
      ) : null}

      {earned.length === 0 && unproven.length === 0 ? (
        <EmptyState title={t("ce_empty_title")} body={t("ce_empty_body")} />
      ) : null}

      {earned.map((w) => (
        <WalletCard
          key={w.address}
          balance={w}
          claim={openClaim(w.address)}
          minClaimUsd={minClaimUsd}
          busy={busy === w.address}
          onClaim={() => claim(w.address)}
          t={t}
        />
      ))}

      {unproven.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>{t("ce_unverified")}</SectionLabel>
          <p className="font-ui text-[12.5px] text-text-muted max-w-[62ch]">{t("ce_unverified_body")}</p>
          {unproven.map((w) => (
            <div
              key={w.address}
              className="flex items-center justify-between gap-4 rounded-lg border border-grid px-4 py-3"
            >
              <span className="font-mono text-[12px] text-text-muted truncate">{w.address}</span>
              <button className={PRIMARY} onClick={() => verify(w.address)} disabled={busy === w.address}>
                {busy === w.address ? t("ce_verifying") : t("ce_verify")}
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionLabel>{t("ce_connect")}</SectionLabel>
        <p className="font-ui text-[12.5px] text-text-muted max-w-[62ch]">{t("ce_connect_body")}</p>
        <button className={SECONDARY} onClick={() => linkWallet()}>
          {t("ce_connect_action")}
        </button>
      </section>
    </div>
  );
}

function WalletCard({
  balance,
  claim,
  minClaimUsd,
  busy,
  onClaim,
  t,
}: {
  balance: CreatorBalance;
  claim: CreatorClaim | undefined;
  minClaimUsd: number;
  busy: boolean;
  onClaim: () => void;
  t: ReturnType<typeof useT>;
}) {
  const canClaim = !claim && balance.availableUsd >= minClaimUsd;
  return (
    <section className="space-y-4 rounded-xl border border-grid p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[12px] text-text-muted truncate">{balance.address}</span>
        <Badge tone="accent">{t("ce_verified")}</Badge>
      </div>

      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <Figure label={t("ce_available")} value={usd(balance.availableUsd)} accent />
        <Figure label={t("ce_pending")} value={usd(balance.pendingUsd)} />
        <Figure label={t("ce_lifetime")} value={usd(balance.lifetimeUsd)} />
        <Figure label={t("ce_copiers")} value={String(balance.copiers)} />
      </div>

      {/* WHY TWO NUMBERS. Said plainly, because "available" being lower than
          "lifetime" is the first question anyone will have. */}
      <p className="font-ui text-[11.5px] leading-relaxed text-text-dim max-w-[62ch]">{t("ce_pending_note")}</p>

      {claim ? (
        <p className="font-ui text-[12.5px] text-text-muted">
          {t("ce_claim_open", { amount: usd(claim.amountUsd), status: t(`ce_status_${claim.status}` as never) })}
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <button className={PRIMARY} onClick={onClaim} disabled={!canClaim || busy}>
            {busy ? t("ce_claiming") : t("ce_claim")}
          </button>
          {!canClaim ? (
            <span className="font-ui text-[11.5px] text-text-dim">
              {t("ce_claim_min", { min: usd(minClaimUsd) })}
            </span>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Figure({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-dim">{label}</div>
      <div className={`font-mono text-[20px] ${accent ? "text-accent" : "text-text-primary"}`}>{value}</div>
    </div>
  );
}
