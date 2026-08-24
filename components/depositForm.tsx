"use client";

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
import { readChainFunding, type ChainFunding } from "@/lib/chainBalance";
import {
  Field,
  AmountInput,
  StatusLine,
  FieldNote,
  SectionLabel,
  PRIMARY,
  QUIET,
  BODY,
} from "@/components/kit";
import {
  planTransfer,
  sendTransfer,
  toBaseUnits,
  formatUnits,
  USDC_DECIMALS,
  type TransferPlan,
} from "@/lib/transfer";

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
}: {
  to: string;
  from: string | null;
  onDone: () => void;
}) {
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { wallets } = useWallets();
  // Matched by ADDRESS, never by index. The account holds several Solana
  // wallets — the agent's is one of them — and picking by position here would
  // sign from whichever happened to be first.
  const wallet = wallets.find((w) => w.address === from);

  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>({ at: "form" });
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

  const available = held?.usdc ?? null;

  let amountError: string | null = null;
  if (amount.trim() !== "") {
    try {
      const units = toBaseUnits(amount, USDC_DECIMALS);
      if (units <= 0n) amountError = "Enter an amount above zero.";
      else if (
        available !== null &&
        Number(formatUnits(units, USDC_DECIMALS)) > available
      ) {
        amountError = "More than this wallet holds.";
      }
    } catch (err) {
      amountError = err instanceof Error ? err.message : "Not a valid amount.";
    }
  }

  const ready = Boolean(from) && amount.trim() !== "" && !amountError;

  const review = useCallback(async () => {
    if (!from) return;
    try {
      setStep({
        at: "confirm",
        plan: await planTransfer({ asset: "USDC", from, to, amount }),
      });
    } catch (err) {
      setStep({
        at: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [from, to, amount]);

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
          });
          return getBase58Decoder().decode(bytes);
        });
        setStep({ at: "sent", signature });
        setAmount("");
        onDone();
      } catch (err) {
        setStep({
          at: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [wallet, signAndSendTransaction, onDone],
  );

  if (!from) {
    return (
      <p className={BODY}>
        No wallet is connected in this session, so a transfer cannot be signed
        here. Send USDC to the address above instead.
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
          <a
            href={`https://solscan.io/tx/${step.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className={QUIET}
          >
            View transaction
          </a>
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
            {plan ? formatUnits(plan.amount, USDC_DECIMALS) : amount}
          </span>{" "}
          USDC to{" "}
          <span className="font-mono">{`${to.slice(0, 4)}…${to.slice(-4)}`}</span>
          .
        </p>
        {/* The rent surprise, stated before signing rather than discovered by a
            failure. The agent's wallet is new, so its USDC account usually does
            not exist yet — and the SENDER pays to open it. */}
        {plan?.createsRecipientAccount ? (
          <FieldNote tone="warn">
            This wallet has never held USDC, so this transfer also opens its
            USDC account. That costs you about 0.002 SOL in rent, paid from the
            sending wallet.
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
                    maximumFractionDigits: 2,
                  })}
                </span>{" "}
                USDC available
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
              unit="USDC"
              label="Amount in USDC"
              onMax={
                available !== null && available > 0
                  ? () => setAmount(String(available))
                  : undefined
              }
            />
          </div>
          <button
            type="button"
            disabled={!ready}
            onClick={() => void review()}
            className={`shrink-0 ${PRIMARY}`}
          >
            Deposit
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
