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

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { getAgentFunding, getAgentModel } from "@/lib/api";
import { WithdrawModal } from "@/components/walletModals";
import { AddFundsModal } from "@/components/addFunds";
import { usePersonalWallet } from "@/lib/usePersonalWallet";
import { SolanaMark } from "@/components/chainMark";
import { LABEL, PRIMARY, SECONDARY } from "@/components/kit";
import { useT } from "@/lib/i18n";

export function WalletBar({
  agentId,
  address,
  isPaper,
  full = false,
  perps = false,
  unit = "USD",
}: {
  agentId: number;
  address: string | null;
  isPaper: boolean;
  /**
   * What this agent's wallet holds as cash (CANOPY_127) — threaded to the
   * withdraw dialog so it offers the asset the wallet actually has, rather
   * than a USDC balance of zero.
   */
  unit?: "USD" | "SOL";
  /** The agent trades perps — threaded to the funding dialog for its SOL note. */
  perps?: boolean;
  /** Fill the container instead of the header's fixed 248px column (phone). */
  full?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const t = useT();
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
      <span className="font-ui text-[12.5px] text-text-dim">
        {t("wallet_none_provisioned")}
      </span>
    );
  }

  return (
    <>
      {/* ONE GROUPED CONTROL, not three loose items on a divider.
          
          The chain is the addition that matters."0 USDC" beside a truncated
          address says nothing about WHERE to send it, and USDC exists on a
          dozen chains — sending Ethereum USDC to a Solana address loses it.
          The deposit dialog said"Solana" and the header did not, so the one
          screen you read before reaching for your wallet was the one that left
          the chain out. */}
      {/* ONE BLOCK, reading top-down on its own — the header no longer pairs
          it line-by-line against the identity beside it.

          NO CONTAINER around the readouts: rule 2. The pill this replaced put a
          border around facts nobody can press. One bordered object survives and
          it is the address — the only thing here you can do something with.
          Rule 3. */}
      {/* TWO LAYOUTS FROM ONE LIST OF FACTS. The phone stacks label-left,
          value-right rows in a full-width column. The desktop header sets them
          as figures side by side — label over value, right-aligned — with the
          address and the two actions on one row beneath, so the block reads as
          one horizontal band beside the agent's name instead of a tall column. */}
      <RowMode.Provider value={full ? "stack" : "figure"}>
      <span className={`flex shrink-0 flex-col ${full ? "w-full gap-2.5" : "items-end gap-3.5"}`}>
        <span className={full ? "contents" : "flex items-end gap-8"}>
        {/* LABEL AND NUMBER FROM ONE READ. The label used to be hardcoded
          "USDC balance" here while the figure was fetched inside `Balance` —
          two sources for one fact, and a copy-LP agent, whose cash is SOL,
          showed "USDC balance $0" over a funded wallet. `Balance` now renders
          its own row so the word and the number cannot disagree. */}
        <Balance agentId={agentId} />

        {/* UNDER THE BALANCE, NOT BESIDE IT. Side by side these read as two of
          the same thing, and no label undid that — one is capital that buys
          assets and can be withdrawn, the other is inference credit that
          cannot. */}
        <ModelCredit agentId={agentId} />
        </span>

        <span className={full ? "contents" : "flex items-center gap-2"}>
        <button
          type="button"
          onClick={() => copy(address)}
          title={address}
          aria-label={t("wallet_copy_aria", { address })}
          className={`group flex h-9 items-center gap-2 rounded-full border border-border bg-surface pr-3 pl-1.5 transition-colors hover:border-grid-strong ${full ? "" : "w-auto"}`}
        >
          <ChainDisc />
          <span className="font-mono text-[12.5px] text-text-secondary transition-colors group-hover:text-text-primary">
            {`${address.slice(0, 4)}…${address.slice(-4)}`}
          </span>
          <span
            className={`ml-auto font-ui text-[11px] font-medium transition-colors ${
              copied ? "text-accent" : "text-text-muted group-hover:text-text-primary"
            }`}
          >
            {t(copied ? "common_copied" : "common_copy")}
          </span>
        </button>

        {/* WHAT YOU CAN DO TO IT. Its own row, because an action is not a
          property — and a PAIR, because money goes in and comes back out and
          the way in cannot be the only one on screen. */}
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMoving("deposit")}
            className={`${full ? "flex-1" : ""} ${PRIMARY}`}
          >
            {t("wallet_deposit")}
          </button>
          <button
            type="button"
            onClick={() => setMoving("withdraw")}
            // Quieter than Deposit on purpose. Both are one click, but taking
            // capital out from under a running agent is the one that changes what
            // it can do next.
            className={`${full ? "flex-1" : ""} ${SECONDARY}`}
          >
            {t("wallet_withdraw")}
          </button>
        </span>
        </span>
      </span>
      </RowMode.Provider>

      {moving === "deposit" ? (
        // The COMBINED dialog. Opens on trading capital, with model credit a
        // segment away — the agent's own wallet is a valid payer for its
        // inference, so the two are one errand.
        <AddFundsModal
          agentId={agentId}
          agentWallet={address}
          personalWallet={personalWallet}
          perps={perps}
          initial="capital"
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
          unit={unit}
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
 * in a header chip invites reading their sum as"what the agent has to trade
 * with", which is exactly wrong.
 */
/** How a fact is set: a label-left row (phone) or a label-over-value figure (desktop header). */
const RowMode = createContext<"stack" | "figure">("stack");

/** One fact: label on the left, value on the right, nothing around it. */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const mode = useContext(RowMode);
  if (mode === "figure") {
    return (
      <span className="flex flex-col items-end gap-1">
        <span className={LABEL}>{label}</span>
        {children}
      </span>
    );
  }
  return (
    <span className="flex items-baseline justify-between gap-3 px-0.5">
      <span className={LABEL}>{label}</span>
      {children}
    </span>
  );
}

/**
 * The chain, as a disc.
 *
 * On the ADDRESS, because the address is the chain-bound thing — a balance is
 * just a number, but sending USDC to this string on the wrong network loses it.
 * It replaces a"◆ SOLANA" text segment that spent a third of the bar's width
 * saying what a 16px mark says.
 */
function ChainDisc() {
  const t = useT();
  return (
    <span
      title={t("wallet_solana_mainnet")}
      className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-bg"
    >
      <SolanaMark className="size-[10px]" />
    </span>
  );
}

/**
 * Prepaid inference, as a line under the wallet.
 *
 * QUIET BY CONSTRUCTION. No border, smaller type, its own row — everything that
 * stops it competing with the balance above, because it is a different kind of
 * money and the wallet is what this bar is about.
 *
 * A missing balance is not a zero: `balance` is null when the agent runs the
 * Canopy-hosted model, which is billed to Canopy and has no prepaid account at
 * all. That renders nothing rather than"$0.00", which would read as a problem
 * to fix.
 */
function ModelCredit({ agentId }: { agentId: number }) {
  const state = useApi((token) => getAgentModel(token, agentId), [agentId]);
  const t = useT();
  if (state.phase !== "ready") return null;
  const balance = state.data.balance;
  if (!balance) return null;

  const low = balance.lowBalance || balance.usdc <= 0;
  return (
    <span title={t("wallet_model_credit_title")}>
      <Row label={t("wallet_model_credit")}>
        <span
          className={`tnum font-mono text-[14px] ${low ? "text-warning" : "text-text-primary"}`}
        >
          $
          {balance.usdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </Row>
    </span>
  );
}

function Balance({ agentId }: { agentId: number }) {
  const state = useApi((token) => getAgentFunding(token, agentId), [agentId]);
  const t = useT();

  if (state.phase === "loading") {
    return (
      <Row label={t("wallet_balance")}>
        <span
          className="h-4 w-16 animate-pulse rounded-md bg-surface-2"
          aria-hidden
        />
      </Row>
    );
  }
  // A failed read is NOT a zero balance and must never render as one — that is
  // the message that tells someone to send money they have already sent.
  if (state.phase !== "ready") {
    return (
      <Row label={t("wallet_balance")}>
        <span className="font-ui text-[12.5px] text-text-dim">
          {t("wallet_balance_unknown")}
        </span>
      </Row>
    );
  }

  /*
   * THE CASH, IN THE AGENT'S OWN UNIT (CANOPY_127).
   *
   * `cash` is dollars of USDC for most agents and WRAPPED SOL for a copy-LP
   * one, which is funded in SOL and holds no USDC at all. Reading `usdc` here
   * showed those agents "$0" over a wallet with SOL in it — a zero that reads
   * as "send money", about money already sent.
   *
   * `cash` falls back to `usdc` when the field is absent, so a client running
   * against an older backend keeps the behaviour it had.
   */
  const sol = state.data.unit === "SOL";
  // `balance`, not `cash`: this row says what the wallet HOLDS. The reserve
  // inside it is the agent's own SOL, and showing the deployable figure here
  // reported money the owner still has as money they do not.
  const cash = state.data.balance ?? state.data.cash ?? state.data.usdc;
  const solUsd = state.data.solUsd;
  /*
   * NATIVE AND WRAPPED, SAID APART — the figure an owner checks on Solscan.
   *
   * `balance` is native SOL plus any wrapped SOL the wallet holds, because
   * both are the agent's to spend. Solscan's "SOL Balance" is native only and
   * lists wrapped SOL as a token, so showing the sum as "SOL balance" put the
   * two a few thousandths apart with nothing to explain it (agent 188: 2.0422
   * here, 2.0385 there — 0.0036 wSOL left by a swap). The headline is now the
   * native figure, and the wrapped part, when there is one, is named beside it.
   */
  const native = sol ? state.data.sol : cash;
  const wrapped = sol ? Math.max(0, cash - state.data.sol) : 0;
  /*
   * GAS, FOR AN AGENT FUNDED IN USDC. It pays its own network fees in SOL, and
   * below the reserve the tick freezes new positions — which nothing on the
   * page said: agent 150 held $110 of USDC and simply stopped buying. The row
   * turns amber with the backend's own sentence when it cannot open. A SOL
   * agent's balance above already is its gas.
   */
  const gasShort = !sol ? (state.data.solShortfall ?? null) : null;
  return (
    <>
    <Row label={t(sol ? "wallet_sol_balance" : "wallet_usdc_balance")}>
      <span
        className={`tnum font-mono text-[14px] ${cash > 0 ? "text-text-primary" : "text-warning"}`}
        // The dollar value as a hover rather than a second line: this bar is a
        // chip, and the agent page's own panel is where both belong side by
        // side.
        title={sol && solUsd ? `≈ $${(cash * solUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : undefined}
      >
        {sol
          ? `${native.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`
          : `$${cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
        {wrapped >= 0.00005 ? (
          <span className="ml-1.5 font-mono text-[11.5px] text-text-muted">
            {t("wallet_plus_wrapped", { amount: wrapped.toLocaleString(undefined, { maximumFractionDigits: 4 }) })}
          </span>
        ) : null}
      </span>
    </Row>
    {!sol ? (
      <Row label={t("wallet_gas")}>
        <span
          className={`tnum font-mono text-[14px] ${gasShort ? "text-warning" : "text-text-primary"}`}
          title={gasShort ?? undefined}
        >
          {`${state.data.sol.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`}
          {gasShort ? (
            <span className="ml-1.5 font-ui text-[11.5px]">{t("wallet_gas_low")}</span>
          ) : null}
        </span>
      </Row>
    ) : null}
    </>
  );
}
