"use client";

// The agent's wallet, in the page header: what it is, what it holds, and how to
// put money in it.
//
// WHY THE BALANCE LIVES HERE AND NOT BEHIND A STEP.
//
// Funding used to be a gate inside the go-live dialog — you could not promote an
// agent until its wallet read as funded. That held someone inside a modal
// watching a number, waiting on a transfer made from somewhere Canopy cannot
// see, and it made the entire go-live path hostage to a chain read that fails
// routinely.
//
// It is a standing fact about the agent instead. An unfunded live agent is not
// a broken one: `runner.ts` checks the balance before the council runs and
// pauses with the shortfall, so it costs nothing and explains itself. What the
// user actually needs is to see the balance whenever they look at the agent,
// and to be one click from topping it up — which is this.
//
// THE BALANCE IS READ SEPARATELY FROM THE AGENT.
//
// It is not on the agent payload and should not be: the agent detail is our
// records, and a balance is the chain's. Folding it in would make the whole page
// fail when an RPC does. Here, a failed read costs the balance chip and nothing
// else, and `FundingPanel` carries its own browser-side fallback for when
// canopy-be cannot reach an RPC at all.

import { useCallback, useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { getAgentFunding } from "@/lib/api";
import { FundingPanel } from "@/components/funding";
import { useT } from "@/lib/i18n";

export function WalletBar({
  agentId,
  address,
  isPaper,
}: {
  agentId: number;
  address: string | null;
  isPaper: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const t = useT();

  const copy = useCallback((addr: string) => {
    void navigator.clipboard
      ?.writeText(addr)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {
        /* clipboard blocked */
      });
  }, []);

  if (!address) {
    // Nothing at all on a paper agent: having no wallet is the correct state
    // there, and a header slot that only ever says so is noise. On a LIVE agent
    // it is worth saying — real capital with nowhere to sign from is a fault.
    if (isPaper) return null;
    return (
      <span className="font-ui text-[12px] text-text-dim">
        {t("wallet_none_provisioned")}
      </span>
    );
  }

  return (
    <>
      <span className="flex items-center gap-3">
        <Balance agentId={agentId} />

        <span className="h-4 w-px bg-grid-strong" aria-hidden />

        <button
          type="button"
          onClick={() => copy(address)}
          title={address}
          aria-label={t("wallet_copy_aria", { address })}
          className="font-mono text-[12.5px] text-text-secondary transition-colors hover:text-text-primary"
        >
          {copied ? t("common_copied") : `${address.slice(0, 4)}…${address.slice(-4)}`}
        </button>

        <button
          type="button"
          onClick={() => setDepositing(true)}
          className="border border-accent px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
        >
          {t("wallet_deposit")}
        </button>
      </span>

      {depositing ? (
        <DepositModal agentId={agentId} address={address} onClose={() => setDepositing(false)} />
      ) : null}
    </>
  );
}

/**
 * The tradable balance, as a chip.
 *
 * USDC only. SOL is a fee balance rather than capital, and the deposit dialog is
 * where it belongs if the backend still asks for it at all — putting two numbers
 * in a header chip invites reading their sum as "what the agent has to trade
 * with", which is exactly wrong.
 */
function Balance({ agentId }: { agentId: number }) {
  const state = useApi((token) => getAgentFunding(token, agentId), [agentId]);
  const t = useT();

  if (state.phase === "loading") {
    return <span className="h-4 w-16 animate-pulse rounded bg-surface-2" aria-hidden />;
  }
  // A failed read is NOT a zero balance and must never render as one — that is
  // the message that tells someone to send money they have already sent.
  if (state.phase !== "ready") {
    return (
      <span className="font-mono text-[12.5px] text-text-dim">
        {t("wallet_balance_unknown")}
      </span>
    );
  }

  const { usdc } = state.data;
  return (
    <span className="flex items-baseline gap-1.5">
      <span
        className={`tnum font-mono text-[13px] ${usdc > 0 ? "text-text-primary" : "text-warning"}`}
      >
        {usdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </span>
      <span className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
        USDC
      </span>
    </span>
  );
}

function DepositModal({
  agentId,
  address,
  onClose,
}: {
  agentId: number;
  address: string;
  onClose: () => void;
}) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/80 px-4 py-10 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deposit-title"
        className="w-full max-w-[560px] animate-[log-enter_180ms_ease-out] border border-grid-strong bg-panel shadow-[0_36px_90px_-28px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-start justify-between gap-6 border-b border-grid px-7 pt-6 pb-5">
          <div className="min-w-0 space-y-1.5">
            <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
              {t("wallet_agent_wallet")}
            </p>
            <h2 id="deposit-title" className="font-mono text-[21px] leading-none text-text-primary">
              {t("wallet_deposit")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common_close")}
            className="shrink-0 border border-border px-2.5 py-1 font-mono text-[11px] text-text-dim transition-colors hover:border-accent hover:text-accent"
          >
            {t("wallet_esc")}
          </button>
        </div>
        <div className="px-7 py-6">
          {/* The address is handed down so the panel can read the chain itself
              when canopy-be cannot — see the fallback note in funding.tsx. */}
          <FundingPanel agentId={agentId} address={address} />
        </div>
      </div>
    </div>
  );
}
