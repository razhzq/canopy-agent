"use client";

import { usePrivy } from "@privy-io/react-auth";

import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonPanel } from "@/components/skeleton";
import { Badge, Breadcrumb } from "@/components/ui";
import { getClaimedWallets, type ClaimedWallets } from "@/lib/api";
import { assignableWallets, isAgentWallet, personalWallet } from "@/lib/wallets";
import { useApi } from "@/lib/useApi";
import { useT } from "@/lib/i18n";

/**
 * TEMPORARY diagnostic. Read-only, by construction — see the route file.
 *
 * Two lists side by side, because the whole question is the difference between
 * them: what Privy thinks this account has, and what Canopy has actually
 * registered to an agent. A wallet in the first list and not the second is a
 * duplicate nobody is using. A wallet in both is load-bearing and can never be
 * retired — CANOPY_037 makes its address immutable.
 */
export function WalletAudit() {
  const { ready, authenticated, user } = usePrivy();
  const t = useT();
  const state = useApi<ClaimedWallets>((token) => getClaimedWallets(token), []);

  if (!ready || state.phase === "loading")
    return <SkeletonPanel labelKey="loading_wallets" lines={6} />;
  if (!authenticated || state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "error")
    return <ErrorState message={state.message} onRetry={state.reload} />;

  const claimed = state.data;
  const claimedSet = new Set(claimed.addresses);
  const distinct = [...claimedSet];

  const wallets = readWallets(user).sort(
    (a, b) => (a.index ?? 1e9) - (b.index ?? 1e9) || a.address.localeCompare(b.address),
  );
  const solana = wallets.filter((w) => w.chain === "solana");
  // The same ordering `firstFreeWallet` uses in grantDelegation — so this shows
  // the wallet the NEXT agent to go live would be handed.
  // Same call grantDelegation makes, so this shows what would ACTUALLY happen.
  const nextUp = assignableWallets(wallets, claimedSet)[0] ?? null;
  const yours = personalWallet(wallets, claimedSet);

  const spares = solana.filter((w) => !isAgentWallet(w, claimedSet));

  const verdict =
    distinct.length === 0
      ? {
          tone: "warning" as const,
          title: t("audit_none_title"),
          body: t("audit_none_body", { count: solana.length }),
        }
      : {
          tone: "accent" as const,
          title:
            distinct.length === 1
              ? t("audit_verdict_one", { spares: spares.length })
              : t("audit_verdict_many", { count: distinct.length, spares: spares.length }),
          body: t("audit_verdict_body"),
        };

  return (
    <div className="mx-auto max-w-[860px] px-6 py-12 space-y-10">
      <div className="space-y-3">
        <Breadcrumb parts={[t("audit_crumb_settings"), t("audit_crumb_audit")]} />
        <h1 className="font-mono text-[24px] tracking-[0.02em] text-text-primary">
          {t("audit_title")}
        </h1>
        <p className="max-w-[62ch] font-ui text-[13px] leading-relaxed text-text-secondary">
          {t("audit_intro")}
        </p>
      </div>

      <div className="border border-grid bg-panel px-6 py-5">
        <div className="flex items-center gap-3 pb-2">
          <Badge tone={verdict.tone}>{verdict.title}</Badge>
        </div>
        <p className="font-ui text-[13px] leading-relaxed text-text-secondary">{verdict.body}</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] tracking-[0.12em] text-text-dim uppercase">
          {t("audit_privy_heading", { count: wallets.length })}
        </h2>
        <div className="border border-grid">
          {wallets.length === 0 ? (
            <p className="px-5 py-6 font-ui text-[13px] text-text-dim">
              {t("audit_none_linked")}
            </p>
          ) : (
            wallets.map((w) => {
              const isClaimed = claimedSet.has(w.address);
              return (
                <div
                  key={w.address}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-grid px-5 py-3.5 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-text-primary">
                    {w.address}
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
                    {t("audit_row_meta", {
                      index: w.index ?? "—",
                      chain: w.chain || "—",
                      client: w.client === "privy" ? t("audit_client_embedded") : w.client,
                    })}
                  </span>
                  {isClaimed ? (
                    <Badge tone="accent">
                      {t("audit_badge_agent", { id: agentFor(claimed, w.address) ?? "?" })}
                    </Badge>
                  ) : w.address === yours?.address ? (
                    <Badge tone="accent">{t("audit_badge_yours")}</Badge>
                  ) : w.delegated ? (
                    // Signer attached but no row: a grant that landed and then
                    // failed to register. Still an agent's wallet.
                    <Badge tone="warning">{t("audit_badge_delegated")}</Badge>
                  ) : w.address === nextUp?.address ? (
                    <Badge tone="muted">{t("audit_badge_next")}</Badge>
                  ) : (
                    <Badge tone="muted">{t("audit_badge_unclaimed")}</Badge>
                  )}
                </div>
              );
            })
          )}
        </div>
        <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">
          {t("audit_privy_note")}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] tracking-[0.12em] text-text-dim uppercase">
          {t("audit_registered_heading", { count: Object.keys(claimed.byAgent).length })}
        </h2>
        <div className="border border-grid">
          {Object.keys(claimed.byAgent).length === 0 ? (
            <p className="px-5 py-6 font-ui text-[13px] text-text-dim">
              {t("audit_none_registered")}
            </p>
          ) : (
            Object.entries(claimed.byAgent).map(([agentId, address]) => (
              <div
                key={agentId}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-grid px-5 py-3.5 last:border-b-0"
              >
                <span className="w-[90px] shrink-0 font-mono text-[11px] tracking-[0.08em] text-text-dim uppercase">
                  {t("audit_agent_label", { id: agentId })}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-text-primary">
                  {address}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function agentFor(claimed: ClaimedWallets, address: string): string | null {
  const hit = Object.entries(claimed.byAgent).find(([, a]) => a === address);
  return hit ? hit[0] : null;
}

interface Wallet {
  address: string;
  client: string;
  chain: string;
  /** Privy's creation order. The login wallet is normally 0. */
  index: number | null;
  /** A signer is attached — Canopy's quorum, so this is an agent's wallet. */
  delegated: boolean;
}

/** Privy's linked accounts, narrowed to wallets. Same shape nav.tsx reads. */
function readWallets(user: ReturnType<typeof usePrivy>["user"]): Wallet[] {
  const accounts: unknown[] = Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : [];
  const out: Wallet[] = [];
  for (const entry of accounts) {
    if (!entry || typeof entry !== "object") continue;
    const a = entry as Record<string, unknown>;
    if (a.type !== "wallet" || typeof a.address !== "string") continue;
    out.push({
      address: a.address,
      client: typeof a.walletClientType === "string" ? a.walletClientType : "unknown",
      chain: typeof a.chainType === "string" ? a.chainType : "",
      index: typeof a.walletIndex === "number" ? a.walletIndex : null,
      delegated: a.delegated === true,
    });
  }
  return out;
}
