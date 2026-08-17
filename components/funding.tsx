"use client";

// Funding the agent wallet.
//
// USDC IS WHAT IT TRADES WITH, AND IT HAS TO ARRIVE AS USDC.
//
// `SOL → USDC` is refused by the delegation's program allow-list — wrapping SOL
// needs the System program — so an agent cannot convert its own way in.
//
// SOL IS SHOWN ONLY WHILE THE BACKEND STILL ASKS FOR IT.
//
// Fees used to be the trap on this screen: a wallet holding only USDC looks
// funded on every dollar-denominated display and cannot transact at all. When
// Canopy sponsors fees that stops being true, and the second figure becomes
// noise about an asset nobody needs to send.
//
// The switch is `minSol` on the funding response, not a constant here. That
// ordering matters: the runner pauses a live agent using the SAME floor, so a
// client carrying its own copy could stop asking for SOL while the agent was
// still being paused for the lack of it — telling someone their wallet is ready
// and then silently refusing to trade. One number, one source.
//
// The two figures are never summed into one "balance". A single number is
// exactly what hides a missing half.
//
// The balances are read from the chain, not from our records. "Has my deposit
// landed" is the one question our own ledger cannot answer — the transfer is
// made from somewhere we never see — which is also why there is a manual
// re-check rather than a promise that this updates itself.
//
// TWO WAYS TO REACH THE CHAIN, AND THEY ARE NOT EQUAL.
//
// canopy-be is asked first and is authoritative: it reads the same mint and the
// same lamport floor the executor enforces, so its verdict cannot disagree with
// what the agent will actually do. When it cannot answer — it returns a 503
// rather than reporting an RPC outage as "unfunded" — the browser reads the
// chain itself. That fallback is marked on screen, because it is answering from
// constants this bundle carries rather than from the ones the tick obeys.
//
// The fallback is not a nicety. This panel gates going live, so a backend that
// cannot reach an RPC used to block the entire path — and the failure it blocked
// on is the routine one: a datacenter IP against a public endpoint gets
// rate-limited far harder than a residential browser does.

import { useCallback, useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { getAgentFunding } from "@/lib/api";
import {
  FALLBACK_MIN_SOL,
  fallbackShortfall,
  readChainFunding,
  type ChainFunding,
} from "@/lib/chainBalance";
import { Callout, InfoIcon, WarnIcon } from "./ui";
import { ErrorState } from "./states";

const BTN =
  "flex h-11 items-center justify-center gap-2.5 border px-6 font-mono text-[11px] tracking-[0.1em] uppercase transition-colors disabled:opacity-40";

type Fallback =
  | { phase: "idle" }
  | { phase: "reading" }
  | { phase: "ready"; data: ChainFunding }
  | { phase: "failed"; message: string };

/** Everything the panel renders, from whichever source could answer. */
interface View {
  source: "canopy" | "chain";
  address: string;
  usdc: number;
  sol: number;
  minSol: number;
  fundedForLive: boolean;
  shortfall: string | null;
}

export function FundingPanel({
  agentId,
  address,
}: {
  agentId: number;
  /**
   * The wallet address, if the caller already knows it.
   *
   * Only used for the fallback: the 503 that triggers it carries an error
   * string and nothing else, so without an address passed in there is nothing
   * to read the chain FOR. Callers that do not have one simply get the error
   * state they got before.
   */
  address?: string | null;
}) {
  const state = useApi((token) => getAgentFunding(token, agentId), [agentId]);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<Fallback>({ phase: "idle" });
  /** Bumped by "Check balance" so a retry re-runs the fallback too. */
  const [attempt, setAttempt] = useState(0);

  // Only ever on the backend's error path. Depending on `state.phase` rather
  // than on `state` keeps this from re-firing every render — useApi returns a
  // fresh object each time, but the phase is a primitive.
  useEffect(() => {
    if (state.phase !== "error" || !address) return;
    let cancelled = false;
    setFallback({ phase: "reading" });
    void readChainFunding(address)
      .then((data) => {
        if (!cancelled) setFallback({ phase: "ready", data });
      })
      .catch((err) => {
        if (!cancelled) {
          setFallback({
            phase: "failed",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [state.phase, address, attempt]);

  const view: View | null =
    state.phase === "ready" && state.data.address
      ? {
          source: "canopy",
          address: state.data.address,
          usdc: state.data.usdc,
          sol: state.data.sol,
          minSol: state.data.minSol,
          fundedForLive: state.data.fundedForLive,
          shortfall: state.data.shortfall,
        }
      : fallback.phase === "ready" && address
        ? {
            source: "chain",
            address,
            usdc: fallback.data.usdc,
            sol: fallback.data.sol,
            minSol: FALLBACK_MIN_SOL,
            shortfall: fallbackShortfall(fallback.data),
            fundedForLive: fallbackShortfall(fallback.data) === null,
          }
        : null;

  const recheck = useCallback(() => {
    setAttempt((n) => n + 1);
    state.reload();
  }, [state]);

  const copy = useCallback((addr: string) => {
    void navigator.clipboard.writeText(addr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, []);

  if (state.phase === "loading") {
    return <div className="h-24 animate-pulse border border-grid bg-surface" aria-hidden />;
  }
  if (state.phase === "signed-out") return null;

  // A wallet that genuinely does not exist yet. Only the backend can say this —
  // it is a fact about our records, not about the chain — so it is read off the
  // ready response rather than inferred from a missing address anywhere else.
  if (state.phase === "ready" && !state.data.address) {
    return (
      <Callout tone="info" icon={<InfoIcon />} title="No wallet yet">
        {state.data.shortfall}
      </Callout>
    );
  }

  if (!view) {
    // The backend failed. Either the fallback is still going, or there was
    // nothing to fall back to.
    if (fallback.phase === "reading") {
      return (
        <div className="space-y-3">
          <div className="h-24 animate-pulse border border-grid bg-surface" aria-hidden />
          <p className="font-ui text-[12.5px] text-text-dim">
            Canopy could not read this balance. Checking the network directly…
          </p>
        </div>
      );
    }
    // A failed READ is not an unfunded wallet, and must not read as one. Both
    // failures are named: "Canopy is down" and "Canopy is down AND the network
    // would not answer either" are different situations, and the second one is
    // the one where retrying is pointless without changing something.
    const message =
      state.phase === "error"
        ? fallback.phase === "failed"
          ? `${state.message}. Reading the network directly also failed: ${fallback.message}`
          : state.message
        : "Could not read this wallet's balance.";
    return <ErrorState message={message} onRetry={recheck} />;
  }

  return (
    <div className="space-y-5">
      {view.source === "chain" ? (
        <Callout tone="warning" icon={<WarnIcon />} title="Read from the network directly">
          Canopy could not reach its RPC, so these figures came from your browser
          instead. They are real balances — but the fee threshold shown is this
          app&apos;s own copy, so treat a borderline reading as approximate.
        </Callout>
      ) : null}

      {/* SOL is shown only while the backend still requires it.
          `minSol` comes from the funding response, so when Canopy turns on fee
          sponsorship the floor arrives as 0 and this collapses to the single
          figure that matters — no client release needed, and no window where
          the screen stops asking for an asset the runner still pauses for. */}
      <div
        className={`grid gap-px border border-grid bg-grid ${
          view.minSol > 0 ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        <Figure
          label="USDC"
          value={view.usdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          note={view.usdc > 0 ? "available to trade" : "none — send USDC"}
          ok={view.usdc > 0}
        />
        {view.minSol > 0 ? (
          <Figure
            label="SOL"
            value={view.sol.toFixed(4)}
            // The threshold is stated, because "some SOL" is not actionable and
            // this is the balance people forget entirely.
            note={view.sol >= view.minSol ? "covers fees" : `needs ${view.minSol} for fees`}
            ok={view.sol >= view.minSol}
          />
        ) : null}
      </div>

      {view.shortfall ? (
        <Callout tone="warning" icon={<InfoIcon />} title="Not ready to trade live">
          {view.shortfall}
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
          onClick={() => copy(view.address)}
          aria-label={`Copy deposit address ${view.address}`}
          className={`group flex w-full items-center justify-between gap-3 border border-grid-strong bg-surface px-4 py-3 text-left transition-colors hover:border-accent`}
        >
          {/* Full address, never truncated. A shortened address is unusable for
              the one thing this screen exists to let someone do, and checking a
              pasted address against a truncated one is how funds go missing. */}
          <span className="font-mono text-[12.5px] break-all text-text-primary">
            {view.address}
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
        {view.minSol > 0 ? (
          <p>
            Send at least <span className="text-text-secondary">{view.minSol} SOL</span> as
            well. Without it the wallet cannot pay transaction fees, even holding USDC.
          </p>
        ) : (
          <p>
            Transaction fees are covered by Canopy — this wallet does not need SOL.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={recheck}
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
