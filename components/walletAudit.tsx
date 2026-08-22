"use client";

import { usePrivy } from "@privy-io/react-auth";

import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonPanel } from "@/components/skeleton";
import { Badge, Breadcrumb } from "@/components/ui";
import { getClaimedWallets, type ClaimedWallets } from "@/lib/api";
import { assignableWallets, isAgentWallet, personalWallet } from "@/lib/wallets";
import { useApi } from "@/lib/useApi";

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
  const state = useApi<ClaimedWallets>((t) => getClaimedWallets(t), []);

  if (!ready || state.phase === "loading")
    return <SkeletonPanel label="Reading your wallets" lines={6} />;
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
          title: "No agent wallets yet",
          body: `No agent holds a delegation. All ${solana.length} of these are unclaimed — one is your personal login wallet, the rest are spares from the login race.`,
        }
      : {
          tone: "accent" as const,
          title: `${distinct.length} agent ${distinct.length === 1 ? "wallet" : "wallets"} · ${spares.length} unclaimed`,
          body: `An agent wallet per agent is BY DESIGN — one agent, one wallet, funded from your personal wallet. Only the unclaimed ones are candidates for noise, and one of those is your personal wallet.`,
        };

  return (
    <div className="mx-auto max-w-[860px] px-6 py-12 space-y-10">
      <div className="space-y-3">
        <Breadcrumb parts={["Settings", "Wallet audit"]} />
        <h1 className="font-mono text-[24px] tracking-[0.02em] text-text-primary">
          Wallet audit
        </h1>
        <p className="max-w-[62ch] font-ui text-[13px] leading-relaxed text-text-secondary">
          Read-only. Privy cannot delete an embedded wallet, so this exists to work out which
          one matters rather than to remove any.
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
          Privy wallets on this account · {wallets.length}
        </h2>
        <div className="border border-grid">
          {wallets.length === 0 ? (
            <p className="px-5 py-6 font-ui text-[13px] text-text-dim">None linked.</p>
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
                    idx {w.index ?? "—"} · {w.chain || "—"} ·{" "}
                    {w.client === "privy" ? "embedded" : w.client}
                  </span>
                  {isClaimed ? (
                    <Badge tone="accent">agent {agentFor(claimed, w.address) ?? "?"}</Badge>
                  ) : w.address === yours?.address ? (
                    <Badge tone="accent">yours · never assignable</Badge>
                  ) : w.delegated ? (
                    // Signer attached but no row: a grant that landed and then
                    // failed to register. Still an agent's wallet.
                    <Badge tone="warning">delegated · not registered</Badge>
                  ) : w.address === nextUp?.address ? (
                    <Badge tone="muted">spare · next agent takes this</Badge>
                  ) : (
                    <Badge tone="muted">unclaimed</Badge>
                  )}
                </div>
              );
            })
          )}
        </div>
        <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">
          A wallet with an agent badge is that agent&rsquo;s dedicated trading wallet — one
          agent, one wallet, and it can never be changed. Unclaimed wallets include your
          personal login wallet (normally index 0) and any spares the login race created.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] tracking-[0.12em] text-text-dim uppercase">
          Registered to agents · {Object.keys(claimed.byAgent).length}
        </h2>
        <div className="border border-grid">
          {Object.keys(claimed.byAgent).length === 0 ? (
            <p className="px-5 py-6 font-ui text-[13px] text-text-dim">
              No agent has registered a wallet.
            </p>
          ) : (
            Object.entries(claimed.byAgent).map(([agentId, address]) => (
              <div
                key={agentId}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-grid px-5 py-3.5 last:border-b-0"
              >
                <span className="w-[90px] shrink-0 font-mono text-[11px] tracking-[0.08em] text-text-dim uppercase">
                  agent {agentId}
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
