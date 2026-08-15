"use client";

// Funding the agent wallet.
//
// TWO ASSETS, AND THE SECOND ONE IS THE TRAP.
//
//   USDC — what the agent trades with. It cannot swap its own way in: SOL →
//          USDC needs the System program, which the delegation's allow-list
//          refuses, so USDC has to ARRIVE as USDC.
//   SOL  — what it pays fees with. A wallet holding only USDC looks funded on
//          every dollar-denominated display and cannot transact at all.
//
// So both are shown as separate figures with separate states, never summed into
// one "balance". A single number is exactly what hides the missing half.
//
// The balances are read from the chain, not from our records. "Has my deposit
// landed" is the one question our own ledger cannot answer — the transfer is
// made from somewhere we never see — which is also why there is a manual
// re-check rather than a promise that this updates itself.

import { useCallback, useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { getAgentFunding, type AgentFunding } from "@/lib/api";
import { Callout, InfoIcon } from "./ui";
import { ErrorState } from "./states";

const BTN =
  "flex h-11 items-center justify-center gap-2.5 border px-6 font-mono text-[11px] tracking-[0.1em] uppercase transition-colors disabled:opacity-40";

export function FundingPanel({
  agentId,
  onFunded,
}: {
  agentId: number;
  /**
   * Called when the chain says this wallet can trade.
   *
   * Reported upward rather than decided by the parent, because the parent has
   * no way to know without repeating this request — and two components asking
   * the same question of an RPC is two answers that can disagree.
   */
  onFunded?: () => void;
}) {
  const state = useApi((token) => getAgentFunding(token, agentId), [agentId]);
  const [copied, setCopied] = useState(false);

  const ready = state.phase === "ready" && state.data.fundedForLive;
  useEffect(() => {
    if (ready) onFunded?.();
    // `onFunded` is deliberately not a dependency: an inline arrow from the
    // parent is a new identity every render, and depending on it would fire
    // this on every one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const copy = useCallback((address: string) => {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, []);

  if (state.phase === "loading") {
    return <div className="h-24 animate-pulse border border-grid bg-surface" aria-hidden />;
  }
  if (state.phase === "signed-out") return null;
  if (state.phase === "error") {
    // A failed READ is not an unfunded wallet, and must not read as one.
    return <ErrorState message={state.message} onRetry={state.reload} />;
  }

  const f: AgentFunding = state.data;

  if (!f.address) {
    return (
      <Callout tone="info" icon={<InfoIcon />} title="No wallet yet">
        {f.shortfall}
      </Callout>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-px border border-grid bg-grid">
        <Figure
          label="USDC"
          value={f.usdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          note={f.usdc > 0 ? "available to trade" : "none — send USDC"}
          ok={f.usdc > 0}
        />
        <Figure
          label="SOL"
          value={f.sol.toFixed(4)}
          // The threshold is stated, because "some SOL" is not actionable and
          // this is the balance people forget entirely.
          note={f.sol >= f.minSol ? "covers fees" : `needs ${f.minSol} for fees`}
          ok={f.sol >= f.minSol}
        />
      </div>

      {f.shortfall ? (
        <Callout tone="warning" icon={<InfoIcon />} title="Not ready to trade live">
          {f.shortfall}
        </Callout>
      ) : (
        <Callout tone="accent" icon={<InfoIcon />} title="Funded">
          This wallet has USDC to trade with and SOL for fees.
        </Callout>
      )}

      <div className="space-y-2">
        <p className="font-mono text-[9.5px] tracking-[0.12em] text-text-muted uppercase">
          Deposit address · Solana
        </p>
        <button
          type="button"
          onClick={() => copy(f.address!)}
          aria-label={`Copy deposit address ${f.address}`}
          className={`group flex w-full items-center justify-between gap-3 border border-grid-strong bg-surface px-4 py-3 text-left transition-colors hover:border-accent`}
        >
          {/* Full address, never truncated. A shortened address is unusable for
              the one thing this screen exists to let someone do, and checking a
              pasted address against a truncated one is how funds go missing. */}
          <span className="font-mono text-[12.5px] break-all text-text-primary">
            {f.address}
          </span>
          <span
            className={`shrink-0 font-mono text-[9px] tracking-[0.1em] uppercase ${
              copied ? "text-accent" : "text-text-dim"
            }`}
          >
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      </div>

      <div className="space-y-1.5 font-ui text-[12.5px] leading-relaxed text-text-dim">
        <p>
          Send <span className="text-text-secondary">USDC on Solana</span> — the agent
          trades against it and cannot convert other assets into it.
        </p>
        <p>
          Send at least <span className="text-text-secondary">{f.minSol} SOL</span> as
          well. Without it the wallet cannot pay transaction fees, even holding USDC.
        </p>
      </div>

      <button
        type="button"
        onClick={state.reload}
        className={`${BTN} border-grid-strong text-text-secondary hover:text-text-primary`}
      >
        Check balance
      </button>
    </div>
  );
}

function Figure({
  label,
  value,
  note,
  ok,
}: {
  label: string;
  value: string;
  note: string;
  ok: boolean;
}) {
  return (
    <div className="space-y-1.5 bg-surface p-5">
      <span className="block font-mono text-[10px] tracking-[0.12em] text-text-dim uppercase">
        {label}
      </span>
      <span
        className={`block font-mono text-[19px] ${ok ? "text-text-primary" : "text-warning"}`}
      >
        {value}
      </span>
      <span className="block font-ui text-[12px] text-text-dim">{note}</span>
    </div>
  );
}
