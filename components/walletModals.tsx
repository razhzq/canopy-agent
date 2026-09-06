"use client";

import { describeError } from "@/lib/errors";

import { useEffect, useRef, useState } from "react";

import { Modal } from "@/components/modal";
import {
  TxLink,
  Field,
  AmountInput,
  StatusLine,
  FieldNote as Note,
  NamedValue,
  SectionLabel,
  Figure,
  Spinner,
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
import { useGasSponsorship } from "@/lib/useGasSponsorship";

import {
  readChainFunding,
  USDC_MINT,
  type ChainFunding,
} from "@/lib/chainBalance";
import {
  AmountError,
  formatAmountInput,
  formatUnits,
  isValidAddress,
  planTransfer,
  sendTransfer,
  waitForLanding,
  type Landing,
  toBaseUnits,
  type Asset,
  type TransferPlan,
} from "@/lib/transfer";
import { useT, type Translate } from "@/lib/i18n";

/**
 * A parse failure, said in the reader's language.
 *
 * `lib/transfer` throws a coded `AmountError` rather than a sentence, because
 * it is a transaction builder and has no dictionary. Anything else that lands
 * here is a genuine surprise and gets the generic line — its own message is
 * an internal string, not something to put under a form field.
 */
function amountMessage(err: unknown, t: Translate): string {
  if (err instanceof AmountError) {
    if (err.code === "too_many_decimals") {
      return t("transfer_max_decimals", { decimals: err.decimals ?? 0 });
    }
    if (err.code === "not_above_zero") return t("withdraw_above_zero");
    return t("transfer_not_a_number");
  }
  return t("withdraw_not_valid_amount");
}

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
  const t = useT();

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
    <Modal title={t("deposit_title")} onClose={onClose}>
      <div className="space-y-5 px-5 py-6">
        <div className="flex justify-center">
          {/* White quiet zone, always. A QR rendered dark-on-dark to match the
              theme is one many scanners refuse, and a scanner that fails here
              sends someone back to typing an address by hand. */}
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={address} size={168} level="M" marginSize={0} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-ui text-[11.5px] text-text-muted">
            {t("deposit_your_wallet")}
          </p>
          <button
            type="button"
            onClick={copy}
            aria-label={t("deposit_copy_aria", { address })}
            className="group block w-full rounded-xl border border-border bg-bg px-3.5 py-3 text-left transition-colors hover:border-grid-strong"
          >
            <span className="block font-mono text-[12.5px] leading-relaxed break-all text-text-primary">
              {address}
            </span>
            <span
              className={`block pt-2 font-ui text-[11px] font-medium transition-colors ${
                copied ? "text-accent" : "text-text-muted group-hover:text-text-primary"
              }`}
            >
              {t(copied ? "common_copied" : "deposit_click_to_copy")}
            </span>
          </button>
        </div>

        <p className="font-ui text-[12px] leading-relaxed text-text-dim">
          {t("deposit_network_warning")}
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
  | { at: "sent"; signature: string; landing: Landing }
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
  // Whether Canopy pays the network fee and any rent. Decided at planning so
  // the confirm step can say so, then passed to Privy as `sponsor: true`.
  const gas = useGasSponsorship();
  const t = useT();
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
  // Review reads the chain (does the recipient hold a USDC account?) before
  // the confirm step can say what the send will do. The button carries the
  // wait, so a slow RPC reads as checking rather than as a dead press.
  const [reviewing, setReviewing] = useState(false);
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
      if (units <= 0n) amountError = t("withdraw_above_zero");
      else if (sendable !== null && Number(formatUnits(units, 6)) > sendable)
        amountError = t("withdraw_over_balance");
    } catch (err) {
      amountError = amountMessage(err, t);
    }
  }

  const ready =
    toValid && !sendingToSelf && amount.trim() !== "" && !amountError;

  async function review() {
    if (reviewing) return;
    setReviewing(true);
    try {
      setStep({
        at: "confirm",
        plan: await planTransfer({ asset, from, to, amount }, { sponsored: gas.enabled }),
      });
    } catch (err) {
      console.error("[withdraw] failed", err);
      setStep({
        at: "error",
        message: describeError(err),
      });
    } finally {
      setReviewing(false);
    }
  }

  async function send(plan: TransferPlan) {
    setStep({ at: "sending", plan });
    try {
      if (!wallet) throw new Error(t("withdraw_wallet_not_connected"));
      const signature = await sendTransfer(plan, async (wire) => {
        const { signature: bytes } = await signAndSendTransaction({
          transaction: wire,
          wallet,
          // Explicit, never inferred: this app is mainnet-only, and a devnet
          // send would look identical here and simply never arrive.
          chain: "solana:mainnet",
          options: {
            // Canopy pays the fee: Privy swaps its fee payer in at signing.
            sponsor: plan.sponsored,
            // Return once broadcast. Privy's own confirmation rides a
            // websocket with a ten-second timeout, which reports a failure for
            // a transfer that landed; the dialog confirms over HTTP instead.
            optimisticBroadcast: true,
          },
        });
        return getBase58Decoder().decode(bytes);
      });
      setStep({ at: "sent", signature, landing: "pending" });
      const landing = await waitForLanding(signature);
      setStep((s) => (s.at === "sent" && s.signature === signature ? { ...s, landing } : s));
    } catch (err) {
      console.error("[withdraw] failed", err);
      setStep({
        at: "error",
        message: describeError(err),
      });
    }
  }

  return (
    <Modal title={t("withdraw_title")} onClose={onClose}>
      {step.at === "sent" ? (
        <div className="space-y-4 px-6 py-6">
          {/* Sent is a fact the moment the broadcast returns; landed is a
              second fact that arrives a few seconds later. Two lines, so
              neither is overstated. */}
          <div className="space-y-1.5">
            <StatusLine tone="good">{t("withdraw_sent")}</StatusLine>
            {step.landing === "pending" ? (
              <StatusLine tone="pending" live>
                {t("withdraw_confirming")}
              </StatusLine>
            ) : step.landing === "confirmed" ? (
              <StatusLine tone="good">{t("withdraw_confirmed")}</StatusLine>
            ) : step.landing === "failed" ? (
              <StatusLine tone="bad">{t("withdraw_failed_chain")}</StatusLine>
            ) : (
              <StatusLine tone="pending">{t("withdraw_confirm_slow")}</StatusLine>
            )}
          </div>
          <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">
            {t("withdraw_sent_body")}
          </p>
          <div className="flex items-center gap-4">
            <TxLink signature={step.signature} label={t("withdraw_view_transaction")} />
            <button type="button" onClick={onClose} className={QUIET}>
              {t("withdraw_done")}
            </button>
          </div>
        </div>
      ) : step.at === "error" ? (
        <div className="space-y-4 px-6 py-6">
          <p className="flex items-center gap-1.5 font-ui text-[13px] font-medium text-negative">
            <span className="size-1.5 rounded-full bg-negative" aria-hidden />
            {t("withdraw_not_sent")}
          </p>
          <p className="font-ui text-[12.5px] leading-relaxed text-text-primary">
            {step.message}
          </p>
          <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">
            {t("withdraw_not_sent_body")}
          </p>
          <button
            type="button"
            onClick={() => setStep({ at: "form" })}
            className={SECONDARY}
          >
            {t("withdraw_back")}
          </button>
        </div>
      ) : step.at === "confirm" || step.at === "sending" ? (
        <Confirm
          plan={step.plan}
          // Named rather than spelled out when it is the wallet they signed in
          // with. An address is only worth 44 characters of screen when it is
          // one the reader has to verify.
          toLabel={
            step.plan.to === defaultTo ? t("withdraw_your_wallet") : null
          }
          busy={step.at === "sending"}
          onBack={() => setStep({ at: "form" })}
          onSend={() => void send(step.plan)}
        />
      ) : (
        <div className="space-y-5 px-6 py-6">
          {defaultTo && !custom ? (
            <Field label={t("withdraw_to")}>
              <NamedValue
                name={t("withdraw_your_wallet")}
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
                {t("withdraw_send_elsewhere")}
              </button>
            </Field>
          ) : (
            <Field label={t("withdraw_to_label")}>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                placeholder={t("withdraw_to_placeholder")}
                className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 font-mono text-[12.5px] break-all text-text-primary outline-none transition-[border-color,box-shadow] placeholder:text-text-muted focus:border-accent/40 focus:shadow-[0_0_0_6px_rgba(94,211,179,0.10)]"
              />
              {to.trim() !== "" && !toValid ? (
                <Note tone="bad">{t("withdraw_not_an_address")}</Note>
              ) : sendingToSelf ? (
                <Note tone="bad">{t("withdraw_is_this_wallet")}</Note>
              ) : toValid ? (
                <Note tone="dim">{t("withdraw_shape_only")}</Note>
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
                  {t("withdraw_back_to_your_wallet")}
                </button>
              ) : null}
            </Field>
          )}

          <Field
            label={t("withdraw_amount_label", { asset })}
            aside={
              sendable === null ? null : (
                <span className="font-ui text-[11.5px] text-text-dim">
                  <span className="tnum font-mono">
                    {sendable.toLocaleString("en-US", {
                      maximumFractionDigits: 6,
                    })}
                  </span>{" "}
                  {t("withdraw_available", { asset })}
                </span>
              )
            }
          >
            <AmountInput
              value={amount}
              onChange={setAmount}
              unit={asset}
              label={t("withdraw_amount_aria", { asset })}
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
            disabled={!ready || !wallet || reviewing}
            aria-busy={reviewing}
            onClick={() => void review()}
            className={`w-full gap-2 ${PRIMARY}`}
          >
            {reviewing ? <Spinner /> : null}
            {t(reviewing ? "withdraw_reviewing" : "withdraw_review")}
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
  const t = useT();
  return (
    <div className="space-y-6 px-6 py-6">
      {/* Left-aligned, like the balance on the deposit dialog. Centred type
          reads as a receipt; this is a decision still being made. */}
      <div className="space-y-2">
        <SectionLabel>{t("withdraw_sending")}</SectionLabel>
        <Figure
          value={formatUnits(plan.amount, decimals)}
          unit={plan.asset}
          size={30}
        />
      </div>

      <div className="space-y-2">
        <SectionLabel>{t("withdraw_to")}</SectionLabel>
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
          <p className="rounded-xl border border-border bg-bg px-3.5 py-3 font-mono text-[12.5px] leading-relaxed break-all text-text-primary">
            {plan.to}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        {/* Who pays the fee is a fact, and a dot-and-word is what a fact
            gets. The rent line only stays a warning when the sender pays it. */}
        {plan.sponsored ? (
          <StatusLine tone="good">
            {t(plan.createsRecipientAccount ? "withdraw_rent_covered" : "withdraw_fee_covered")}
          </StatusLine>
        ) : plan.createsRecipientAccount ? (
          <Note tone="warn">{t("withdraw_rent_warning")}</Note>
        ) : null}
        <Note tone="dim">{t("withdraw_final")}</Note>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSend}
          disabled={busy}
          aria-busy={busy}
          className={`flex-1 gap-2 ${PRIMARY}`}
        >
          {busy ? <Spinner /> : null}
          {t(busy ? "withdraw_sending_busy" : "withdraw_send")}
        </button>
        {/* Quiet, and second. Back is the safe direction and does not need to
            compete for the eye with the one action that spends money. */}
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className={`shrink-0 px-3 ${QUIET}`}
        >
          {t("withdraw_back")}
        </button>
      </div>
    </div>
  );
}

export { USDC_MINT };
