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
import { WithdrawModal } from "@/components/walletModals";
import { usePersonalWallet } from "@/lib/usePersonalWallet";
import { SolanaMark } from "@/components/chainMark";

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
  const [moving, setMoving] = useState<"deposit" | "withdraw" | null>(null);
  // Where a withdrawal goes by default. The agent's wallet is an ADDITIONAL
  // wallet on the owner's own Privy account (grantDelegation calls
  // `createWallet({ createAdditional: true })`), so the owner can sign for it
  // and the obvious destination is the wallet they actually use.
  const personalWallet = usePersonalWallet();

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
      <span className="col-start-2 row-start-1 justify-self-end font-ui text-[12px] text-text-dim">
        No wallet provisioned
      </span>
    );
  }

  return (
    <>
      {/* ONE GROUPED CONTROL, not three loose items on a divider.
          
          The chain is the addition that matters. "0 USDC" beside a truncated
          address says nothing about WHERE to send it, and USDC exists on a
          dozen chains — sending Ethereum USDC to a Solana address loses it.
          The deposit dialog said "Solana" and the header did not, so the one
          screen you read before reaching for your wallet was the one that left
          the chain out. */}
      {/* TWO GRID CELLS, NOT A STACK.
      
          The header's left side already has two rows — the agent's name, and
          the paper/live switch under it — and the wallet has two rows of its
          own. Nesting its stack inside the name row let it hang below with
          nothing to line up against. As sibling cells in the SAME grid, the
          identity sits on the name's baseline and the actions sit on the
          switch's, which is the alignment the eye was looking for.
          
          Positioned explicitly rather than by source order, so this can stay
          one component owning one set of modal state while its two halves land
          in rows that are not adjacent in the DOM. */}
      <span className="col-start-2 row-start-1 flex items-center justify-self-end overflow-hidden rounded-lg border border-grid bg-surface">
        <span
          className="flex items-center gap-1.5 border-r border-grid px-2.5 py-[7px]"
          title="Solana mainnet"
        >
          <SolanaMark />
          <span className="font-mono text-[9px] font-semibold tracking-[0.7px] text-text-dim uppercase">
            Solana
          </span>
        </span>

        <span className="px-3 py-[7px]">
          <Balance agentId={agentId} />
        </span>

        <button
          type="button"
          onClick={() => copy(address)}
          title={address}
          aria-label={`Copy wallet address ${address}`}
          className="group flex items-center gap-1.5 border-l border-grid px-2.5 py-[7px] font-mono text-[12px] text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
        >
          {copied ? (
            <span className="text-accent">Copied</span>
          ) : (
            <>
              <span>{`${address.slice(0, 4)}…${address.slice(-4)}`}</span>
              <CopyMark />
            </>
          )}
        </button>
      </span>

      {/* WHAT YOU CAN DO TO IT. Its own row, because an action is not a
          property: welding Deposit onto the end of the address made moving
          money look like the last field of a readout. They are also a PAIR —
          money goes in and comes back out — and the way in cannot be the only
          one on screen. Stretched across the column so the pair spans exactly
          the width of the pill above it. */}
      <span className="col-start-2 row-start-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMoving("deposit")}
          className="flex-1 rounded-lg border border-accent bg-accent-wash px-3 py-[6px] font-mono text-[10px] tracking-[0.08em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
        >
          Deposit
        </button>
        <button
          type="button"
          onClick={() => setMoving("withdraw")}
          // Quieter than Deposit on purpose. Both are one click, but taking
          // capital out from under a running agent is the one that changes
          // what it can do next.
          className="flex-1 rounded-lg border border-grid px-3 py-[6px] font-mono text-[10px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:border-text-dim hover:text-text-primary"
        >
          Withdraw
        </button>
      </span>

      {moving === "deposit" ? (
        <DepositModal
          agentId={agentId}
          address={address}
          onClose={() => setMoving(null)}
        />
      ) : null}

      {moving === "withdraw" ? (
        // `from` is the AGENT's wallet, not the owner's — the same dialog the
        // account menu uses, pointed at a different source. It pins the signer
        // by address rather than by index, which is what makes that safe here:
        // the account holds several Solana wallets and the agent's is only one
        // of them.
        <WithdrawModal
          address={address}
          defaultTo={personalWallet ?? undefined}
          onClose={() => setMoving(null)}
        />
      ) : null}
    </>
  );
}

/** Shown beside the address so it reads as a control rather than a label. */
function CopyMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[11px] shrink-0 text-text-dim transition-colors group-hover:text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
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

  if (state.phase === "loading") {
    return (
      <span
        className="h-4 w-16 animate-pulse rounded bg-surface-2"
        aria-hidden
      />
    );
  }
  // A failed read is NOT a zero balance and must never render as one — that is
  // the message that tells someone to send money they have already sent.
  if (state.phase !== "ready") {
    return (
      <span className="font-mono text-[12.5px] text-text-dim">balance —</span>
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
        className="w-full max-w-[560px] animate-[log-enter_180ms_ease-out] rounded-xl border border-grid bg-panel shadow-[0_36px_90px_-28px_rgba(0,0,0,0.9)]"
      >
        {/* No rule under the header. The panel below opens on a label and a
            number, which separates itself — a divider as well was one line of
            chrome doing a job the whitespace already did. */}
        <div className="flex items-start justify-between gap-6 px-7 pt-6 pb-1">
          <div className="min-w-0 space-y-1.5">
            <p className="font-mono text-[9.5px] tracking-[0.14em] text-text-muted uppercase">
              Agent wallet
            </p>
            <h2
              id="deposit-title"
              className="font-mono text-[20px] leading-none text-text-primary"
            >
              Deposit
            </h2>
          </div>
          {/* A mark, not a bordered "Esc" chip. The chip was the heaviest
              element in the header and it was the one nobody came for. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 -mt-1.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-text-dim transition-colors hover:bg-surface hover:text-text-primary"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-[15px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
              focusable="false"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-7 pt-5 pb-7">
          {/* The address is handed down so the panel can read the chain itself
              when canopy-be cannot — see the fallback note in funding.tsx. */}
          <FundingPanel agentId={agentId} address={address} />
        </div>
      </div>
    </div>
  );
}
