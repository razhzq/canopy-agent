"use client";

// Funding the agent wallet.
//
// USDC IS WHAT IT TRADES WITH, AND IT HAS TO ARRIVE AS USDC.
//
// `SOL → USDC` is refused by the delegation's program allow-list — wrapping SOL
// needs the System program — so an agent cannot convert its own way in.
//
// SOL IS NOT SHOWN, AND NOT ASKED FOR. Removed 2026-08-25 along with the floor
// behind it in canopy-be. A wallet is funded when it holds USDC; there is no
// second figure and no fee threshold on this screen.
//
// Fees were the trap this screen used to guard: a wallet holding only USDC looks
// funded on every dollar-denominated display and cannot transact at all. That
// guard is gone rather than sponsored — paper agents never touch the chain, but
// a live agent's wallet still needs lamports and nothing here will say so.
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
import { SolanaMark } from "@/components/chainMark";
import {
  SectionLabel,
  Figure,
  StatusLine,
  QUIET,
  BODY,
} from "@/components/kit";
import { DepositForm } from "@/components/depositForm";
import { usePersonalWallet } from "@/lib/usePersonalWallet";
import { useApi } from "@/lib/useApi";
import { getAgentFunding } from "@/lib/api";
import {
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
  // The owner's own wallet — the source for an in-app deposit, and the signer.
  const personalWallet = usePersonalWallet();
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
          fundedForLive: state.data.fundedForLive,
          shortfall: state.data.shortfall,
        }
      : fallback.phase === "ready" && address
        ? {
            source: "chain",
            address,
            usdc: fallback.data.usdc,
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
    return (
      <div
        className="h-24 animate-pulse border border-grid bg-surface"
        aria-hidden
      />
    );
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
          <div
            className="h-24 animate-pulse border border-grid bg-surface"
            aria-hidden
          />
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

  const funded = view.usdc > 0;

  return (
    /* THE SHAPE OF THIS SCREEN IS: how much is in it, where to send more.
    
       It used to be five stacked blocks of equal visual weight — a bordered
       tile holding one number, a callout restating that number in words, a
       labelled address, a paragraph, and a full-width button — so nothing led
       and the address, the only thing anyone opens this to get, had to be
       hunted for. The balance is now type rather than a box, the address is the
       one bordered object on screen, and the utility action is quiet. */
    <div className="space-y-7">
      {view.source === "chain" ? (
        <Callout
          tone="warning"
          icon={<WarnIcon />}
          title="Read from the network directly"
        >
          Canopy could not reach its RPC, so this figure came from your browser
          instead. It is a real balance, read from the chain.
        </Callout>
      ) : null}

      {/* BALANCE AND ADDRESS ON ONE ROW. What is in the wallet, and where to
          send more — the two halves of the same question, so they read across
          rather than down. Stacked, they put a horizontal rule between two
          facts that belong together and pushed the address below the fold on a
          short viewport.

          Centred, now that the right side is one compact control rather than a
          labelled block that wrapped — it sits against the balance figure
          instead of floating up beside its label. */}
      <div className="flex items-center justify-between gap-8">
        {/* Balance. No border, no tile — a number this size is its own emphasis,
            and a box around a single figure is chrome earning nothing. */}
        <div className="shrink-0 space-y-2">
          <SectionLabel>Wallet balance</SectionLabel>
          <Figure
            value={view.usdc.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
            unit="USDC"
            dim={!funded}
          />
          {/* Status as one line with a dot, not a coloured callout — rule 4 in
              kit.tsx. It leaves the loud styling for the fallback warning
              above, the only thing here worth interrupting for. */}
          <StatusLine tone={funded ? "good" : "pending"}>
            {funded ? "Ready to trade" : "Waiting for a deposit"}
          </StatusLine>
        </div>

        {/* Address. The one bordered object on the screen, because it is the
            one thing here that is an action.

            NO LABEL — the mark says which chain, and "Deposit address" was
            naming the obvious inside a dialog titled Deposit.

            TRUNCATED, which makes COPY the only way to get it right. That is a
            deliberate trade: a 44-character address shown in full invites
            reading it off the screen, and the copy button is both faster and
            the only method that cannot introduce a typo. The full string stays
            on `title` and on the accessible name for anyone who needs to verify
            it against a wallet's own display. */}
        <button
          type="button"
          onClick={() => copy(view.address)}
          title={view.address}
          aria-label={`Copy deposit address ${view.address}`}
          className="group flex shrink-0 items-center gap-2.5 rounded-lg border border-grid bg-surface px-3.5 py-2.5 transition-colors hover:border-accent"
        >
          <SolanaMark />
          <span className="font-mono text-[13px] text-text-primary">
            {`${view.address.slice(0, 4)}…${view.address.slice(-4)}`}
          </span>
          <span
            className={`font-mono text-[9px] tracking-[0.1em] uppercase transition-colors ${
              copied ? "text-accent" : "text-text-dim group-hover:text-accent"
            }`}
          >
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      </div>

      {/* THE IN-APP ROUTE, under the address rather than instead of it.

          Two ways in, and they serve different people: an owner who already
          holds USDC in the wallet they signed in with moves it here in two
          clicks, and anyone sending from an exchange still needs the address
          above. Offering only the address made the first group copy their own
          address into another tab to move their own money. */}
      <div className="border-t border-grid pt-5">
        <DepositForm to={view.address} from={personalWallet} onDone={recheck} />
      </div>

      {/* The instruction and the utility share the last row. Separately they
          were two mostly-empty lines; the recheck is also the natural thing to
          reach for right after reading "send USDC", which is the sentence beside
          it. Quiet styling either way — it is a utility, not a call to action. */}
      <div className="flex items-end justify-between gap-6 border-t border-grid pt-4">
        <p className={`max-w-[34ch] ${BODY}`}>
          Send <span className="text-text-secondary">USDC on Solana</span>. The
          agent trades against it and cannot convert other assets into it.
        </p>
        <button type="button" onClick={recheck} className={`shrink-0 ${QUIET}`}>
          Check balance
        </button>
      </div>
    </div>
  );
}
