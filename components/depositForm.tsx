"use client";

import { describeError } from "@/lib/errors";

// Moving USDC from the owner's wallet into the agent's, in the app.
//
// WHY THIS EXISTS ALONGSIDE THE ADDRESS.
//
// The dialog used to offer one route: here is an address, go and send to it
// from somewhere Canopy cannot see. That is the only option for money arriving
// from an exchange, and it stays. But the common case is an owner who already
// holds USDC in the Privy wallet this app signed them in with — for them,
// copying an address into another tab to move their own money between two of
// their own wallets is a detour the product can simply remove.
//
// BOTH WALLETS BELONG TO THE OWNER, which is what makes this a plain transfer
// rather than anything custodial. `grantDelegation` creates the agent's wallet
// with `createWallet({ createAdditional: true })` — an additional wallet on the
// same Privy account — so the owner can sign for both ends.
//
// THE SIGNING PATH IS `sendTransfer`, the same one WithdrawModal uses. A second
// implementation of "build a USDC transfer and hand it to Privy" is a second
// place for the mint, the decimals and the chain to be got wrong.

import { useCallback, useEffect, useState } from "react";
import {
  useSignAndSendTransaction,
  useWallets,
} from "@privy-io/react-auth/solana";
import { getBase58Decoder } from "@solana/kit";
import { useGasSponsorship } from "@/lib/useGasSponsorship";
import { readChainFunding, type ChainFunding } from "@/lib/chainBalance";
import {
  Field,
  AmountInput,
  StatusLine,
  Spinner,
  FieldNote,
  SectionLabel,
  PRIMARY,
  QUIET,
  BODY,
  TxLink,
} from "@/components/kit";
import {
  planTransfer,
  sendTransfer,
  toBaseUnits,
  formatUnits,
  formatAmountInput,
  SOL_RESERVE,
  decimalsOf,
  type Asset,
  type TransferPlan,
} from "@/lib/transfer";

/**
 * What a SOL agent's deposit is called on screen.
 *
 * The owner sends ONE thing — SOL — and never sees the word "wrapped". The
 * split into wrapped cash and native gas is real and happens in the one
 * transaction below, but it is a property of how an agent wallet works, not a
 * choice anyone should be asked to make.
 */
const SOL_LABEL = "SOL";

/**
 * What an asset is CALLED to the person sending it.
 *
 * "wSOL" is an implementation detail of how an agent wallet holds SOL; nobody
 * deposits a wrapped token, they deposit SOL. The distinction stays in the
 * types, where it prevents a 6-decimal bug, and out of the copy, where it would
 * only raise a question with no useful answer.
 */
function labelOf(asset: Asset): string {
  return asset === "wSOL" ? SOL_LABEL : asset;
}

type Step =
  | { at: "form" }
  | { at: "confirm"; plan: TransferPlan }
  | { at: "sending" }
  | { at: "sent"; signature: string }
  | { at: "error"; message: string };

export function DepositForm({
  /** The agent's wallet — the destination. */
  to,
  /** The owner's Privy wallet — the source, and the signer. */
  from,
  /** Re-read the agent's balance once a transfer lands. */
  onDone,
  /**
   * WHAT THIS AGENT IS FUNDED IN (CANOPY_127). Absent means USD, which is
   * every agent but copy LP and the behaviour this form has always had.
   */
  unit = "USD",
  /** Native SOL the agent already holds, and the floor it must keep. */
  agentSol = 0,
  minSol = 0,
}: {
  to: string;
  from: string | null;
  onDone: () => void;
  unit?: "USD" | "SOL";
  agentSol?: number;
  minSol?: number;
}) {
  const solFunded = unit === "SOL";
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { wallets } = useWallets();
  const gas = useGasSponsorship();
  // Matched by ADDRESS, never by index. The account holds several Solana
  // wallets — the agent's is one of them — and picking by position here would
  // sign from whichever happened to be first.
  const wallet = wallets.find((w) => w.address === from);

  const [amount, setAmount] = useState("");
  /**
   * WHICH ASSET. An agent wallet needs both: USDC to trade with, and, while
   * Canopy is not paying fees, a little SOL to pay them. The choice sits in
   * the amount field's unit slot as a select rather than as a second field,
   * because it is one send of one thing.
   */
  const [asset, setAsset] = useState<Asset>(solFunded ? "wSOL" : "USDC");
  const [step, setStep] = useState<Step>({ at: "form" });
  const [reviewing, setReviewing] = useState(false);
  const [held, setHeld] = useState<ChainFunding | null>(null);

  useEffect(() => {
    if (!from) return;
    let cancelled = false;
    void readChainFunding(from)
      .then((b) => !cancelled && setHeld(b))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [from, step.at]);

  /**
   * THE GAS LEG. How much of this deposit arrives as native SOL rather than as
   * liquidity.
   *
   * An agent needs SOL in two forms and CANNOT CONVERT BETWEEN THEM: wrapped,
   * to provide liquidity with, and native, to pay fees and position rent with.
   * Wrapping needs the System program, which its allow-list does not carry, so
   * whatever it is given is what it has. Sending only wrapped SOL produces an
   * agent holding a full book and unable to sign anything.
   *
   * So the top-up rides along: enough to reach the floor the backend reports,
   * and nothing once it is there. Computed from `minSol` rather than from a
   * constant in this bundle — the floor moves with the SOL price, and a second
   * copy of that decision here would drift from the one the tick obeys.
   */
  const gasTopUpSol = solFunded ? Math.max(0, minSol - agentSol) : 0;
  const gasLamports = BigInt(Math.ceil(gasTopUpSol * 1e9));

  // The sender always keeps a reserve back for their OWN fees. On a SOL
  // deposit the gas leg comes out of the same balance, so it is held back too —
  // otherwise "max" produces a transaction the wallet cannot afford to send.
  const available =
    held === null
      ? null
      : asset === "USDC"
        ? held.usdc
        : Math.max(0, held.sol - SOL_RESERVE - gasTopUpSol);
  const decimals = decimalsOf(asset);

  let amountError: string | null = null;
  if (amount.trim() !== "") {
    try {
      const units = toBaseUnits(amount, decimals);
      if (units <= 0n) amountError = "Enter an amount above zero.";
      else if (available !== null && Number(formatUnits(units, decimals)) > available) {
        amountError =
          asset === "SOL"
            ? `More than you can send. ${SOL_RESERVE} SOL is held back for fees.`
            : "More than this wallet holds.";
      }
    } catch (err) {
      amountError = err instanceof Error ? err.message : "Not a valid amount.";
    }
  }

  const ready = Boolean(from) && amount.trim() !== "" && !amountError;

  const review = useCallback(async () => {
    if (!from || reviewing) return;
    setReviewing(true);
    try {
      setStep({
        at: "confirm",
        plan: await planTransfer({ asset, from, to, amount }, { sponsored: gas.enabled, gasLamports }),
      });
    } catch (err) {
      console.error("[deposit] failed", err);
      setStep({
        at: "error",
        message: describeError(err),
      });
    } finally {
      setReviewing(false);
    }
  }, [from, to, amount, asset, gas.enabled, gasLamports, reviewing]);

  const send = useCallback(
    async (plan: TransferPlan) => {
      setStep({ at: "sending" });
      try {
        if (!wallet)
          throw new Error("that wallet is not connected in this session");
        const signature = await sendTransfer(plan, async (wire) => {
          const { signature: bytes } = await signAndSendTransaction({
            transaction: wire,
            wallet,
            // Explicit, never inferred: this app is mainnet-only, and a devnet
            // send would look identical here and simply never arrive.
            chain: "solana:mainnet",
            // See walletModals: Canopy pays via Privy's sponsor flag, and
            // confirmation is ours, over HTTP, not Privy's websocket wait.
            options: { sponsor: plan.sponsored, optimisticBroadcast: true },
          });
          return getBase58Decoder().decode(bytes);
        });
        setStep({ at: "sent", signature });
        setAmount("");
        onDone();
      } catch (err) {
        console.error("[deposit] failed", err);
        setStep({
          at: "error",
          message: describeError(err),
        });
      }
    },
    [wallet, signAndSendTransaction, onDone],
  );

  if (!from) {
    return (
      <p className={BODY}>
        No wallet is connected in this session, so a transfer cannot be signed
        here. Send {solFunded ? "SOL" : "USDC"} to the address above instead.
      </p>
    );
  }

  if (step.at === "sent") {
    return (
      <div className="space-y-2.5">
        <StatusLine tone="good">Sent</StatusLine>
        <p className={BODY}>
          The balance above updates once the network confirms it, which is
          usually seconds.
        </p>
        <div className="flex items-center gap-4">
          <TxLink signature={step.signature} label="View transaction" />
          <button
            type="button"
            onClick={() => setStep({ at: "form" })}
            className={QUIET}
          >
            Send more
          </button>
        </div>
      </div>
    );
  }

  if (step.at === "confirm" || step.at === "sending") {
    const plan = step.at === "confirm" ? step.plan : null;
    return (
      <div className="space-y-3">
        <SectionLabel>Confirm</SectionLabel>
        <p className="font-ui text-[13px] leading-relaxed text-text-primary">
          Send{" "}
          <span className="tnum font-mono">
            {plan ? formatUnits(plan.amount, decimalsOf(plan.asset)) : amount}
          </span>{" "}
          {labelOf(plan?.asset ?? asset)} to{" "}
          <span className="font-mono">{`${to.slice(0, 4)}…${to.slice(-4)}`}</span>
          .
        </p>
        {/* The rent surprise, stated before signing rather than discovered by a
            failure. The agent's wallet is new, so its USDC account usually does
            not exist yet — and the SENDER pays to open it. */}
        {plan?.sponsored ? (
          <StatusLine tone="good">
            {plan.createsRecipientAccount
              ? "This wallet has never held USDC, so this transfer also opens its account. Canopy covers the rent and the network fee."
              : "Network fee covered by Canopy."}
          </StatusLine>
        ) : plan?.createsRecipientAccount ? (
          <FieldNote tone="warn">
            This wallet has never held USDC, so this transfer also opens its
            USDC account. That costs you about 0.002 SOL in rent, paid from the
            sending wallet.
          </FieldNote>
        ) : plan?.asset === "SOL" ? (
          <FieldNote>
            SOL on the agent&apos;s wallet pays its network fees and the rent on
            new token accounts. It is never traded.
          </FieldNote>
        ) : null}
        {/* THE SPLIT, STATED. The owner sends one number; two different things
            arrive, and only one of them can be put to work. Saying so here is
            what keeps "I sent 5 SOL and it only has 4.9 to trade with" from
            being a surprise. */}
        {plan && plan.gasLamports > 0n ? (
          <FieldNote>
            {formatUnits(plan.gasLamports, 9)} SOL of this goes to the
            agent&apos;s wallet as network gas, which it cannot pay fees
            without. The rest is what it provides liquidity with.
          </FieldNote>
        ) : null}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={step.at === "sending" || !plan}
            onClick={() => plan && void send(plan)}
            className={PRIMARY}
          >
            {step.at === "sending" ? "Sending…" : "Confirm"}
          </button>
          <button
            type="button"
            disabled={step.at === "sending"}
            onClick={() => setStep({ at: "form" })}
            className={`px-3 py-2.5 ${QUIET}`}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <Field
        label="Send from your wallet"
        aside={
          <span className="font-ui text-[11.5px] text-text-dim">
            {available === null ? (
              "reading balance…"
            ) : (
              <>
                <span className="tnum font-mono">
                  {available.toLocaleString(undefined, {
                    maximumFractionDigits: asset === "USDC" ? 2 : 4,
                  })}
                </span>{" "}
                {labelOf(asset)} available
              </>
            )}
          </span>
        }
      >
        <div className="flex items-stretch gap-2">
          <div className="min-w-0 flex-1">
            <AmountInput
              value={amount}
              onChange={setAmount}
              unit={labelOf(asset)}
              label={`Amount in ${labelOf(asset)}`}
              unitControl={
                // ONE ASSET, NO CHOICE, for a SOL agent. The select exists
                // because a USD agent genuinely needs two things in its wallet
                // and has to say which it is sending. A SOL agent needs one,
                // and offering a picker with a single option is chrome that
                // implies a decision nobody has to make.
                solFunded ? null : (
                // The asset, chosen where the unit is read. A native select
                // styled as a quiet pill: two options do not warrant a menu of
                // our own, and the platform's picker is the one keyboards and
                // screen readers already know.
                <select
                  value={asset}
                  onChange={(e) => {
                    setAsset(e.target.value as Asset);
                    setAmount("");
                  }}
                  aria-label="Asset to send"
                  className="ml-2 h-7 shrink-0 cursor-pointer appearance-none rounded-full border border-border bg-transparent pr-6 pl-2.5 font-ui text-[12px] font-medium text-text-primary outline-none transition-colors hover:border-grid-strong focus-visible:border-grid-strong"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%238A948E' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 8px center",
                  }}
                >
                  <option value="USDC" className="bg-bg">USDC</option>
                  <option value="SOL" className="bg-bg">SOL</option>
                </select>
                )
              }
              onMax={
                available !== null && available > 0
                  ? () => setAmount(formatAmountInput(available, decimals))
                  : undefined
              }
            />
          </div>
          <button
            type="button"
            disabled={!ready || reviewing}
            aria-busy={reviewing}
            onClick={() => void review()}
            className={`shrink-0 gap-2 ${PRIMARY}`}
          >
            {reviewing ? <Spinner /> : null}
            {reviewing ? "Checking…" : "Deposit"}
          </button>
        </div>
      </Field>

      {amountError ? (
        <FieldNote tone="bad">{amountError}</FieldNote>
      ) : step.at === "error" ? (
        <FieldNote tone="bad">{step.message}</FieldNote>
      ) : null}
    </div>
  );
}
