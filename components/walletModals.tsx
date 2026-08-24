"use client";

import { useEffect, useRef, useState } from "react";

import { Modal } from "@/components/modal";
import {
  Field,
  AmountInput,
  StatusLine,
  FieldNote as Note,
  NamedValue,
  SectionLabel,
  Figure,
  PRIMARY,
  SECONDARY,
  QUIET,
  MICRO,
  SURFACE,
  BODY,
} from "@/components/kit";
import { QRCodeSVG } from "qrcode.react";
import {
  useSignAndSendTransaction,
  useWallets,
} from "@privy-io/react-auth/solana";
import { getBase58Decoder } from "@solana/kit";

import {
  readChainFunding,
  USDC_MINT,
  type ChainFunding,
} from "@/lib/chainBalance";
import {
  formatAmountInput,
  formatUnits,
  isValidAddress,
  planTransfer,
  sendTransfer,
  toBaseUnits,
  type Asset,
  type TransferPlan,
} from "@/lib/transfer";

/* ------------------------------------------------------------- deposit -- */

/**
 * Where to send funds. Nothing here signs anything.
 *
 * The address is shown in full and never truncated. Checking a pasted address
 * against a shortened one is how people convince themselves a wrong address is
 * right, and this is the screen where that mistake is permanent.
 */
export function DepositModal({
  address,
  onClose,
}: {
  address: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => void (timer.current && clearTimeout(timer.current)),
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — the address is still selectable by hand */
    }
  };

  return (
    <Modal title="Deposit" onClose={onClose}>
      <div className="space-y-5 px-5 py-6">
        <div className="flex justify-center">
          {/* White quiet zone, always. A QR rendered dark-on-dark to match the
              theme is one many scanners refuse, and a scanner that fails here
              sends someone back to typing an address by hand. */}
          <div className="bg-white p-3">
            <QRCodeSVG value={address} size={168} level="M" marginSize={0} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[9px] tracking-[0.14em] text-text-dim uppercase">
            Your wallet · Solana
          </p>
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy your address ${address}`}
            className="group block w-full border border-grid bg-bg px-3 py-3 text-left transition-colors hover:border-grid-strong"
          >
            <span className="block font-mono text-[12px] leading-relaxed break-all text-text-primary">
              {address}
            </span>
            <span
              className={`block pt-2 font-mono text-[9px] tracking-[0.12em] uppercase ${
                copied ? "text-accent" : "text-text-dim"
              }`}
            >
              {copied ? "Copied" : "Click to copy"}
            </span>
          </button>
        </div>

        <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">
          Solana network only. Sending any other chain&rsquo;s assets to this
          address loses them. This is your personal wallet — funding an agent is
          done on that agent&rsquo;s page.
        </p>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ withdraw -- */

type Step =
  | { at: "form" }
  | { at: "confirm"; plan: TransferPlan }
  | { at: "sending"; plan: TransferPlan }
  | { at: "sent"; signature: string }
  | { at: "error"; message: string };

/**
 * Sending funds out. The only screen in the app that spends a user's own money.
 *
 * Two steps on purpose. The form is where a mistake is cheap to fix; the
 * confirm step restates the destination in full, names the asset, and says what
 * the transfer will cost — including the rent for a first-time USDC recipient,
 * which is charged to the sender and surprises people. A single-step form with
 * a Send button is how someone pays an address they meant to check.
 */
export function WithdrawModal({
  address: from,
  onClose,
  defaultTo,
}: {
  address: string;
  onClose: () => void;
  /**
   * Prefilled destination.
   *
   * Set when the source is an AGENT wallet, where the answer is almost always
   * "back to me" — the agent's wallet is an additional wallet on the owner's own
   * Privy account, so the owner can sign for it, and the money coming out has
   * exactly one obvious home. Prefilled rather than forced: the field stays
   * editable, and the confirm step still restates the destination in full,
   * because a prefilled address nobody read is the same hazard as a typed one.
   */
  defaultTo?: string;
}) {
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { wallets } = useWallets();
  // Matched by ADDRESS, never by index — the account holds several wallets and
  // picking the wrong one here would spend an agent's money. Everything in the
  // dialog is pinned to `from`, which the menu resolved as the user's own.
  const wallet = wallets.find((w) => w.address === from);
  // USDC ONLY. The SOL half of this dialog went when the SOL floor did — an
  // agent wallet is not asked to hold SOL, so a control for withdrawing it was
  // offering to move an asset the product no longer says anything about. Kept
  // as a typed constant rather than inlined, so the transfer plumbing — which
  // is written against `Asset` — still states what it is being handed.
  const asset: Asset = "USDC";
  const [to, setTo] = useState(defaultTo ?? "");
  /**
   * Whether the owner has asked to send somewhere other than their own wallet.
   *
   * When this dialog is opened from an agent (`defaultTo` set) the destination
   * is not really a question — the money comes back to the wallet they signed
   * in with — so showing a 44-character field they must read and approve is
   * ceremony around a foregone conclusion. It collapses to "Your wallet", and
   * this opens it back up for the rarer case.
   */
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>({ at: "form" });
  const [balance, setBalance] = useState<ChainFunding | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readChainFunding(from)
      .then((b) => !cancelled && setBalance(b))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [from]);

  // No reserve to hold back. That existed so a SOL withdrawal could not leave
  // the wallet unable to pay its own fee; USDC fees are paid in SOL, so the
  // whole balance is sendable.
  const sendable = balance ? balance.usdc : null;

  const toValid = to.trim() !== "" && isValidAddress(to);
  const sendingToSelf = toValid && to.trim() === from;

  let amountError: string | null = null;
  if (amount.trim() !== "") {
    try {
      const units = toBaseUnits(amount, 6);
      if (units <= 0n) amountError = "Enter an amount above zero.";
      else if (sendable !== null && Number(formatUnits(units, 6)) > sendable)
        amountError = "More than this wallet holds.";
    } catch (err) {
      amountError = err instanceof Error ? err.message : "Not a valid amount.";
    }
  }

  const ready =
    toValid && !sendingToSelf && amount.trim() !== "" && !amountError;

  async function review() {
    try {
      setStep({
        at: "confirm",
        plan: await planTransfer({ asset, from, to, amount }),
      });
    } catch (err) {
      setStep({
        at: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function send(plan: TransferPlan) {
    setStep({ at: "sending", plan });
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
    } catch (err) {
      setStep({
        at: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <Modal title="Withdraw" onClose={onClose}>
      {step.at === "sent" ? (
        <div className="space-y-4 px-6 py-6">
          <p className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-accent uppercase">
            <span className="size-[5px] rounded-full bg-accent" aria-hidden />
            Sent
          </p>
          <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">
            The transfer was submitted. It settles in a few seconds.
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
            <button type="button" onClick={onClose} className={QUIET}>
              Done
            </button>
          </div>
        </div>
      ) : step.at === "error" ? (
        <div className="space-y-4 px-6 py-6">
          <p className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-negative uppercase">
            <span className="size-[5px] rounded-full bg-negative" aria-hidden />
            Not sent
          </p>
          <p className="font-ui text-[12.5px] leading-relaxed text-text-primary">
            {step.message}
          </p>
          <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">
            Nothing left your wallet. Check the balance before trying again in
            case it did land.
          </p>
          <button
            type="button"
            onClick={() => setStep({ at: "form" })}
            className={SECONDARY}
          >
            Back
          </button>
        </div>
      ) : step.at === "confirm" || step.at === "sending" ? (
        <Confirm
          plan={step.plan}
          // Named rather than spelled out when it is the wallet they signed in
          // with. An address is only worth 44 characters of screen when it is
          // one the reader has to verify.
          toLabel={step.plan.to === defaultTo ? "Your wallet" : null}
          busy={step.at === "sending"}
          onBack={() => setStep({ at: "form" })}
          onSend={() => void send(step.plan)}
        />
      ) : (
        <div className="space-y-5 px-6 py-6">
          {defaultTo && !custom ? (
            <Field label="To">
              <NamedValue
                name="Your wallet"
                detail={`${defaultTo.slice(0, 4)}…${defaultTo.slice(-4)}`}
              />
              <button
                type="button"
                onClick={() => {
                  setCustom(true);
                  setTo("");
                }}
                className={MICRO}
              >
                Send somewhere else
              </button>
            </Field>
          ) : (
            <Field label="To · Solana address">
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                placeholder="Paste the destination address"
                className="w-full rounded-lg border border-grid bg-surface px-3.5 py-2.5 font-mono text-[12px] break-all text-text-primary outline-none placeholder:text-text-dim focus:border-accent"
              />
              {to.trim() !== "" && !toValid ? (
                <Note tone="bad">Not a Solana address.</Note>
              ) : sendingToSelf ? (
                <Note tone="bad">That is this wallet.</Note>
              ) : toValid ? (
                <Note tone="dim">
                  Checked for shape only — nobody can tell you whether this
                  address is the one you meant. A transfer cannot be reversed.
                </Note>
              ) : null}
              {defaultTo ? (
                <button
                  type="button"
                  onClick={() => {
                    setCustom(false);
                    setTo(defaultTo);
                  }}
                  className={MICRO}
                >
                  Back to your wallet
                </button>
              ) : null}
            </Field>
          )}

          <Field
            label="Amount"
            aside={
              sendable === null ? null : (
                <span className="font-ui text-[11.5px] text-text-dim">
                  <span className="tnum font-mono">
                    {sendable.toLocaleString("en-US", {
                      maximumFractionDigits: 6,
                    })}
                  </span>{" "}
                  {asset} available
                </span>
              )
            }
          >
            <AmountInput
              value={amount}
              onChange={setAmount}
              unit={asset}
              label={`Amount in ${asset}`}
              onMax={
                sendable !== null && sendable > 0
                  ? () => setAmount(formatAmountInput(sendable, 6))
                  : undefined
              }
            />
            {amountError ? <Note tone="bad">{amountError}</Note> : null}
          </Field>

          <button
            type="button"
            disabled={!ready || !wallet}
            onClick={() => void review()}
            className={`w-full ${PRIMARY}`}
          >
            Review
          </button>
        </div>
      )}
    </Modal>
  );
}

function Confirm({
  plan,
  toLabel,
  busy,
  onBack,
  onSend,
}: {
  plan: TransferPlan;
  /** Set when the destination is the owner's own wallet; null when it is not. */
  toLabel: string | null;
  busy: boolean;
  onBack: () => void;
  onSend: () => void;
}) {
  const decimals = plan.asset === "SOL" ? 9 : 6;
  return (
    <div className="space-y-6 px-6 py-6">
      {/* Left-aligned, like the balance on the deposit dialog. Centred type
          reads as a receipt; this is a decision still being made. */}
      <div className="space-y-2">
        <SectionLabel>Sending</SectionLabel>
        <Figure
          value={formatUnits(plan.amount, decimals)}
          unit={plan.asset}
          size={30}
        />
      </div>

      <div className="space-y-2">
        <SectionLabel>To</SectionLabel>
        {/* IN FULL ONLY WHEN IT NEEDS CHECKING. An address the owner typed or
            pasted gets all 44 characters — this is their one chance to catch a
            wrong one. Their own wallet gets its name and a short form: nobody
            proof-reads an address they did not choose, and a wall of base58 in
            the confirm step trains people to click past it. */}
        {toLabel ? (
          <NamedValue
            name={toLabel}
            detail={`${plan.to.slice(0, 4)}…${plan.to.slice(-4)}`}
          />
        ) : (
          <p className="rounded-lg border border-grid bg-surface px-3.5 py-3 font-mono text-[12px] leading-relaxed break-all text-text-primary">
            {plan.to}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        {plan.createsRecipientAccount ? (
          <Note tone="warn">
            This address holds no USDC account yet, so one is opened for it.
            That costs you about 0.002 SOL in rent, on top of the network fee.
          </Note>
        ) : null}
        <Note tone="dim">
          Transfers are final. Once submitted there is no way to reverse this or
          recover the funds if the address is wrong.
        </Note>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSend}
          disabled={busy}
          className={`flex-1 ${PRIMARY}`}
        >
          {busy ? "Sending…" : "Send"}
        </button>
        {/* Quiet, and second. Back is the safe direction and does not need to
            compete for the eye with the one action that spends money. */}
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className={`shrink-0 px-3 py-2.5 ${QUIET}`}
        >
          Back
        </button>
      </div>
    </div>
  );
}

export { USDC_MINT };
