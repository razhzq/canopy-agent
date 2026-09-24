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
import { QRCodeSVG } from "qrcode.react";
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
  RpcError,
  type ChainFunding,
} from "@/lib/chainBalance";
import { Callout, InfoIcon, WarnIcon } from "./ui";
import { ErrorState } from "./states";
import { useT, type Translate } from "@/lib/i18n";

/**
 * A chain-read failure, in the reader's language.
 *
 * `lib/chainBalance` throws a coded `RpcError` when the endpoint gave no
 * message of its own. When it DID give one — a rate limit, a bad request — that
 * message is the endpoint's and passes through as it arrived: it names the
 * actual refusal, which is more useful than anything this side could say.
 */
function rpcMessage(err: unknown, t: Translate): string {
  if (err instanceof RpcError) {
    return err.code === "status"
      ? t("error_rpc_status", { status: err.status ?? "" })
      : t("error_rpc_empty");
  }
  return err instanceof Error ? err.message : String(err);
}

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
  /**
   * WHAT THIS AGENT'S CASH IS, and in which unit (CANOPY_127).
   *
   * For a USD agent `cash` is `usdc` and nothing changes. For a SOL agent it
   * is WRAPPED SOL, and `sol` beside it is native gas — two balances that do
   * not convert into each other, because the agent cannot wrap or unwrap.
   * Showing one and calling it the other is the mistake this exists to stop.
   */
  unit: "USD" | "SOL";
  cash: number;
  sol: number;
  minSol: number;
  solUsd: number | null;
  fundedForLive: boolean;
  shortfall: string | null;
}

export function FundingPanel({
  agentId,
  address,
  perps = false,
}: {
  agentId: number;
  /**
   * The one exception to "USDC only" on this screen. A perp agent posts USDC
   * as collateral like any other, but every position request creates a
   * temporary account on chain whose rent deposit sponsorship does not pay,
   * so the wallet needs a little SOL as well. Said here, on the funding
   * screen, rather than discovered as a refused first trade.
   */
  perps?: boolean;
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
  const t = useT();
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
        if (!cancelled)
          setFallback({ phase: "failed", message: rpcMessage(err, t) });
      });
    return () => {
      cancelled = true;
    };
  }, [state.phase, address, attempt, t]);

  const view: View | null =
    state.phase === "ready" && state.data.address
      ? {
          source: "canopy",
          address: state.data.address,
          usdc: state.data.usdc,
          unit: state.data.unit ?? "USD",
          cash: state.data.balance ?? state.data.cash ?? state.data.usdc,
          sol: state.data.sol,
          minSol: state.data.minSol,
          solUsd: state.data.solUsd ?? null,
          fundedForLive: state.data.fundedForLive,
          shortfall: state.data.shortfall,
        }
      : fallback.phase === "ready" && address
        ? {
            source: "chain",
            address,
            usdc: fallback.data.usdc,
            // THE FALLBACK CANNOT KNOW THE UNIT. It reads the chain from this
            // bundle's own constants and has no idea which agent it is looking
            // at, so it answers the only question it can — and says so, via
            // the "read directly" banner this path already shows.
            unit: "USD",
            cash: fallback.data.usdc,
            sol: fallback.data.sol,
            minSol: 0,
            solUsd: null,
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
        className="h-24 animate-pulse rounded-xl border border-border bg-surface"
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
      <Callout
        tone="info"
        icon={<InfoIcon />}
        title={t("funding_no_wallet_title")}
      >
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
            className="h-24 animate-pulse rounded-xl border border-border bg-surface"
            aria-hidden
          />
          <p className="font-ui text-[12.5px] text-text-dim">
            {t("funding_fallback_reading")}
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
          ? // Both messages are the underlying errors' own text, quoted into a
            // translated frame — neither is ours to rewrite.
            t("funding_both_failed", {
              backend: state.message,
              chain: fallback.message,
            })
          : state.message
        : t("funding_read_failed");
    return <ErrorState message={message} onRetry={recheck} />;
  }

  const funded = view.cash > 0;
  const solBook = view.unit === "SOL";
  // Gas is a separate fact from cash for a SOL agent, and only worth saying
  // when it is short — a wallet at its floor needs no commentary.
  const gasShort = solBook && view.minSol > 0 && view.sol < view.minSol;

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
          title={t("funding_direct_title")}
        >
          {t("funding_direct_body")}
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
      {/* WRAPS, because this panel lives in two widths. On the funding page
          the balance and the address sit on one row, which is the layout this
          block was designed for. Inside the Add funds MODAL it is ~360px, and
          two `shrink-0` children on a `justify-between` row simply overflowed
          — the address chip rendered OUTSIDE the dialog, floating in the page
          behind it. Wrapping keeps the wide layout and fixes the narrow one
          without either knowing about the other. */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
        {/* Balance. No border, no tile — a number this size is its own emphasis,
            and a box around a single figure is chrome earning nothing. */}
        <div className="shrink-0 space-y-2">
          <SectionLabel>{t("funding_wallet_balance")}</SectionLabel>
          {/* NATIVE SOL AS THE FIGURE, the number Solscan shows as the SOL
              balance; wrapped SOL, which Solscan lists as a token, is named
              under it rather than silently added in. See walletBar.tsx. */}
          <Figure
            value={(solBook ? view.sol : view.cash).toLocaleString(undefined, {
              maximumFractionDigits: solBook ? 4 : 2,
            })}
            unit={solBook ? "SOL" : "USDC"}
            dim={!funded}
          />
          {solBook && view.cash - view.sol >= 0.00005 ? (
            <p className="tnum font-mono text-[12px] text-text-muted">
              {t("wallet_plus_wrapped", {
                amount: (view.cash - view.sol).toLocaleString(undefined, { maximumFractionDigits: 4 }),
              })}
            </p>
          ) : null}
          {/* THE DOLLAR VALUE UNDER THE SOL, not instead of it. The book is a
              quantity of SOL — that is the number that does not move when the
              price does — and the dollars are what it happens to be worth
              right now. Putting them the other way round would make a still
              book look like it was moving. */}
          {solBook && view.solUsd && view.cash > 0 ? (
            <p className="font-ui text-[12px] text-text-dim">
              <span className="tnum font-mono">
                {(view.cash * view.solUsd).toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                })}
              </span>{" "}
              {t("funding_at_sol_price", {
                price: view.solUsd.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }),
              })}
            </p>
          ) : null}
          {/* Status as one line with a dot, not a coloured callout — rule 4 in
              kit.tsx. It leaves the loud styling for the fallback warning
              above, the only thing here worth interrupting for. */}
          <StatusLine tone={funded ? "good" : "pending"}>
            {t(funded ? "funding_ready" : "funding_waiting")}
          </StatusLine>
          {/* GAS, WHICH IS NOT THE BOOK. A copy-LP agent holds SOL twice over —
              wrapped, which it trades with, and native, which it pays fees
              with — and it cannot turn one into the other. Named only when it
              is short, because otherwise it is a detail nobody needs. */}
          {gasShort ? (
            <p className="max-w-[44ch] font-ui text-[12.5px] leading-relaxed text-text-secondary">
              {t("funding_gas_short", {
                have: view.sol.toLocaleString(undefined, { maximumFractionDigits: 4 }),
                need: view.minSol.toLocaleString(undefined, { maximumFractionDigits: 4 }),
              })}
            </p>
          ) : null}
          {perps ? (
            <p className="max-w-[44ch] font-ui text-[12.5px] leading-relaxed text-text-secondary">
              {t("funding_perp_sol_float", { sol: "0.02" })}
            </p>
          ) : null}
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
        <div className="flex shrink-0 items-center gap-4">
          {/* THE QR, for the deposit that does not come from this browser.
              An owner sending from a phone wallet or an exchange app cannot
              paste a clipboard from here, and reading 44 base58 characters off
              a screen is how funds go to an address nobody holds.

              White quiet zone always — a code rendered dark-on-dark to match
              the theme is one many scanners refuse, and a scanner that fails
              sends someone back to typing it by hand. Same treatment as the
              personal-wallet deposit dialog, deliberately: two different QR
              styles for the same act is two things to recognise. */}
          <div className="rounded-lg bg-white p-2" title={view.address}>
            <QRCodeSVG value={view.address} size={72} level="M" marginSize={0} />
          </div>
        <button
          type="button"
          onClick={() => copy(view.address)}
          title={view.address}
          aria-label={t("funding_copy_aria", { address: view.address })}
          className="group flex h-10 shrink-0 items-center gap-2.5 rounded-full border border-border bg-surface px-3.5 transition-colors hover:border-grid-strong"
        >
          <SolanaMark />
          <span className="font-mono text-[13px] text-text-primary">
            {`${view.address.slice(0, 4)}…${view.address.slice(-4)}`}
          </span>
          <span
            className={`font-ui text-[11px] font-medium transition-colors ${
              copied ? "text-accent" : "text-text-dim group-hover:text-accent"
            }`}
          >
            {t(copied ? "common_copied" : "common_copy")}
          </span>
        </button>
        </div>
      </div>

      {/* THE IN-APP ROUTE, under the address rather than instead of it.

          Two ways in, and they serve different people: an owner who already
          holds USDC in the wallet they signed in with moves it here in two
          clicks, and anyone sending from an exchange still needs the address
          above. Offering only the address made the first group copy their own
          address into another tab to move their own money. */}
      <div className="border-t border-grid pt-5">
        <DepositForm
          to={view.address}
          from={personalWallet}
          onDone={recheck}
          unit={view.unit}
        />
      </div>

      {/* The instruction and the utility share the last row. Separately they
          were two mostly-empty lines; the recheck is also the natural thing to
          reach for right after reading "send USDC", which is the sentence beside
          it. Quiet styling either way — it is a utility, not a call to action. */}
      <div className="flex items-end justify-between gap-6 border-t border-grid pt-4">
        {/* The emphasis span is gone: the phrase it wrapped lands in a
            different position in Chinese, and a <span> cannot travel with it.
            The sentence is short enough to carry itself. */}
        <p className={`max-w-[34ch] ${BODY}`}>
          {t(solBook ? "funding_send_sol_note" : "funding_send_usdc")}
        </p>
        <button type="button" onClick={recheck} className={`shrink-0 ${QUIET}`}>
          {t("funding_check_balance")}
        </button>
      </div>
    </div>
  );
}
