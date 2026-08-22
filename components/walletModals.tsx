"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { useSignAndSendTransaction, useWallets } from "@privy-io/react-auth/solana";
import { getBase58Decoder } from "@solana/kit";

import { readChainFunding, USDC_MINT, type ChainFunding } from "@/lib/chainBalance";
import {
  formatAmountInput,
  formatUnits,
  isValidAddress,
  planTransfer,
  sendTransfer,
  SOL_RESERVE,
  toBaseUnits,
  type Asset,
  type TransferPlan,
} from "@/lib/transfer";

/* --------------------------------------------------------------- shell -- */

/**
 * The dialog frame both modals sit in.
 *
 * Escape and a backdrop click close it, focus moves in on open and back to
 * whatever opened it on close, and the panel is `role="dialog" aria-modal` so a
 * screen reader treats the page behind it as inert. None of that is optional on
 * a surface that moves money — a dialog you cannot leave by keyboard is one
 * people click through to escape.
 *
 * PORTALLED TO THE BODY, AND IT HAS TO BE.
 *
 * The trigger lives in the navbar, and that <header> carries `backdrop-blur-md`.
 * A `backdrop-filter` makes an element a containing block for fixed-position
 * descendants — so `fixed inset-0` resolved against a 64px-tall header instead
 * of the viewport, and the dialog rendered centred on that strip with its title
 * and close button clipped off the top of the screen. Rendering into the body
 * escapes it. The same is true of `transform` and `filter` on any ancestor,
 * which is why this must not be "fixed" by nudging offsets.
 */
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll under an open dialog.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      returnTo.current?.focus();
    };
  }, [onClose]);

  // Nothing to portal into during the server render.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-bg/80 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        // `my-auto` with a scrollable backdrop keeps it centred on a tall
        // screen and scrollable on a short one, rather than centring it off the
        // top edge where the header is unreachable.
        className="my-auto w-full max-w-[420px] border border-grid-strong bg-panel shadow-[0_24px_64px_-20px_rgba(0,0,0,0.9)] outline-none"
      >
        <div className="flex items-center justify-between border-b border-grid px-5 py-4">
          <h2 className="font-mono text-[12px] tracking-[0.1em] text-text-primary uppercase">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="font-mono text-[16px] leading-none text-text-dim transition-colors hover:text-text-primary"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------- deposit -- */

/**
 * Where to send funds. Nothing here signs anything.
 *
 * The address is shown in full and never truncated. Checking a pasted address
 * against a shortened one is how people convince themselves a wrong address is
 * right, and this is the screen where that mistake is permanent.
 */
export function DepositModal({ address, onClose }: { address: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

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
          Solana network only. Sending any other chain&rsquo;s assets to this address loses them.
          This is your personal wallet — funding an agent is done on that agent&rsquo;s page.
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
}: {
  address: string;
  onClose: () => void;
}) {
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { wallets } = useWallets();
  // Matched by ADDRESS, never by index — the account holds several wallets and
  // picking the wrong one here would spend an agent's money. Everything in the
  // dialog is pinned to `from`, which the menu resolved as the user's own.
  const wallet = wallets.find((w) => w.address === from);
  const [asset, setAsset] = useState<Asset>("USDC");
  const [to, setTo] = useState("");
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

  const held = balance ? (asset === "SOL" ? balance.sol : balance.usdc) : null;
  // SOL keeps a reserve back so the wallet can still pay a fee afterwards; see
  // SOL_RESERVE. USDC has no such constraint — its fees are paid in SOL.
  const sendable = held === null ? null : asset === "SOL" ? Math.max(held - SOL_RESERVE, 0) : held;

  const toValid = to.trim() !== "" && isValidAddress(to);
  const sendingToSelf = toValid && to.trim() === from;

  let amountError: string | null = null;
  if (amount.trim() !== "") {
    try {
      const units = toBaseUnits(amount, asset === "SOL" ? 9 : 6);
      if (units <= 0n) amountError = "Enter an amount above zero.";
      else if (sendable !== null && Number(formatUnits(units, asset === "SOL" ? 9 : 6)) > sendable)
        amountError =
          asset === "SOL"
            ? `More than you can send. ${SOL_RESERVE} SOL is held back for fees.`
            : "More than this wallet holds.";
    } catch (err) {
      amountError = err instanceof Error ? err.message : "Not a valid amount.";
    }
  }

  const ready = toValid && !sendingToSelf && amount.trim() !== "" && !amountError;

  async function review() {
    try {
      setStep({ at: "confirm", plan: await planTransfer({ asset, from, to, amount }) });
    } catch (err) {
      setStep({ at: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  async function send(plan: TransferPlan) {
    setStep({ at: "sending", plan });
    try {
      if (!wallet) throw new Error("that wallet is not connected in this session");
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
      setStep({ at: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <Modal title="Withdraw" onClose={onClose}>
      {step.at === "sent" ? (
        <div className="space-y-4 px-5 py-8 text-center">
          <p className="font-mono text-[12px] tracking-[0.08em] text-accent uppercase">Sent</p>
          <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
            The transfer was submitted. It settles in a few seconds.
          </p>
          <a
            href={`https://solscan.io/tx/${step.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate font-mono text-[11px] text-accent underline underline-offset-4"
          >
            {step.signature}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-full border border-grid-strong px-3 py-2.5 font-mono text-[11px] tracking-[0.1em] text-text-primary uppercase transition-colors hover:bg-surface"
          >
            Done
          </button>
        </div>
      ) : step.at === "error" ? (
        <div className="space-y-4 px-5 py-8">
          <p className="font-mono text-[12px] tracking-[0.08em] text-negative uppercase">
            Not sent
          </p>
          <p className="font-ui text-[13px] leading-relaxed text-text-secondary">{step.message}</p>
          <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">
            Nothing left your wallet. Check the balance before trying again in case it did land.
          </p>
          <button
            type="button"
            onClick={() => setStep({ at: "form" })}
            className="w-full border border-grid-strong px-3 py-2.5 font-mono text-[11px] tracking-[0.1em] text-text-primary uppercase transition-colors hover:bg-surface"
          >
            Back
          </button>
        </div>
      ) : step.at === "confirm" || step.at === "sending" ? (
        <Confirm
          plan={step.plan}
          busy={step.at === "sending"}
          onBack={() => setStep({ at: "form" })}
          onSend={() => void send(step.plan)}
        />
      ) : (
        <div className="space-y-5 px-5 py-6">
          <div className="flex border border-grid-strong">
            {(["USDC", "SOL"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setAsset(a);
                  setAmount("");
                }}
                aria-pressed={asset === a}
                className={`flex-1 py-2.5 font-mono text-[11px] tracking-[0.1em] uppercase transition-colors ${
                  asset === a ? "bg-surface-2 text-text-primary" : "text-text-dim hover:text-text-secondary"
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          <Field label="To · Solana address">
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder="Paste the destination address"
              className="w-full border border-grid bg-bg px-3 py-2.5 font-mono text-[12px] break-all text-text-primary outline-none placeholder:text-text-dim focus:border-accent"
            />
            {to.trim() !== "" && !toValid ? (
              <Note tone="negative">Not a Solana address.</Note>
            ) : sendingToSelf ? (
              <Note tone="negative">That is this wallet.</Note>
            ) : toValid ? (
              <Note tone="dim">
                Checked for shape only — nobody can tell you whether this address is the one you
                meant. A transfer cannot be reversed.
              </Note>
            ) : null}
          </Field>

          <Field
            label={`Amount · ${asset}`}
            aside={
              sendable === null ? null : (
                <button
                  type="button"
                  onClick={() => setAmount(formatAmountInput(sendable, asset === "SOL" ? 9 : 6))}
                  className="font-mono text-[9.5px] tracking-[0.1em] text-accent uppercase"
                >
                  Max {sendable.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                </button>
              )
            }
          >
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              className="tnum w-full border border-grid bg-bg px-3 py-2.5 font-mono text-[15px] text-text-primary outline-none placeholder:text-text-dim focus:border-accent"
            />
            {amountError ? <Note tone="negative">{amountError}</Note> : null}
          </Field>

          <button
            type="button"
            disabled={!ready || !wallet}
            onClick={() => void review()}
            className="w-full bg-accent py-3 font-mono text-[11.5px] tracking-[0.1em] text-bg uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
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
  busy,
  onBack,
  onSend,
}: {
  plan: TransferPlan;
  busy: boolean;
  onBack: () => void;
  onSend: () => void;
}) {
  const decimals = plan.asset === "SOL" ? 9 : 6;
  return (
    <div className="space-y-5 px-5 py-6">
      <div className="space-y-1.5 text-center">
        <p className="font-mono text-[9px] tracking-[0.14em] text-text-dim uppercase">Sending</p>
        <p className="tnum font-mono text-[26px] leading-none text-text-primary">
          {formatUnits(plan.amount, decimals)} {plan.asset}
        </p>
      </div>

      <div className="space-y-2 border border-grid bg-bg px-3 py-3">
        <p className="font-mono text-[9px] tracking-[0.14em] text-text-dim uppercase">To</p>
        {/* In full, again. The confirm step exists to be read. */}
        <p className="font-mono text-[12px] leading-relaxed break-all text-text-primary">
          {plan.to}
        </p>
      </div>

      {plan.createsRecipientAccount ? (
        <Note tone="warning">
          This address holds no USDC account yet, so one is opened for it. That costs you about
          0.002 SOL in rent, on top of the network fee.
        </Note>
      ) : null}

      <Note tone="dim">
        Transfers are final. Once submitted there is no way to reverse this or recover the funds
        if the address is wrong.
      </Note>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="flex-1 border border-grid-strong py-3 font-mono text-[11.5px] tracking-[0.1em] text-text-secondary uppercase transition-colors hover:bg-surface disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={busy}
          className="flex-1 bg-accent py-3 font-mono text-[11.5px] tracking-[0.1em] text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[9px] tracking-[0.14em] text-text-dim uppercase">
          {label}
        </span>
        {aside}
      </div>
      {children}
    </div>
  );
}

function Note({
  tone,
  children,
}: {
  tone: "dim" | "negative" | "warning";
  children: React.ReactNode;
}) {
  return (
    <p
      className={`font-ui text-[11.5px] leading-relaxed ${
        tone === "negative"
          ? "text-negative"
          : tone === "warning"
            ? "text-warning"
            : "text-text-dim"
      }`}
    >
      {children}
    </p>
  );
}

export { USDC_MINT };
