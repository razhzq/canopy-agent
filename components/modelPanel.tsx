"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSignAndSendTransaction, useWallets } from "@privy-io/react-auth/solana";
import { getBase58Decoder } from "@solana/kit";

import {
  buildModelTopUp,
  confirmModelTopUp,
  getAgentModel,
  setAgentModel,
  type AgentModel,
} from "@/lib/api";
import { PickModel, type ModelChoice } from "@/components/pickModel";
import { useApi } from "@/lib/useApi";
import { readChainFunding } from "@/lib/chainBalance";
import { submitTopUp } from "@/lib/modelTopup";
import { formatUnits, toBaseUnits } from "@/lib/transfer";
import { Callout, InfoIcon, WarnIcon } from "@/components/ui";
import { GrantDelegation } from "@/components/grantDelegation";
import { DELEGATION_CEILING_USD } from "@/lib/api";
import { ErrorState } from "@/components/states";
import { Modal } from "@/components/modal";
import { ModelBadge } from "@/components/modelBadge";

/**
 * What an agent reasons with, what that is costing, and how to pay for it.
 *
 * The owner's panel, and the only place a Pod balance appears. A visitor
 * reading a strategy page sees the model NAME on the badge and nothing else:
 * the balance, the deposit code and the spend are facts about somebody's
 * wallet, and they arrive on an owner-scoped route.
 *
 * A CANOPY AGENT HAS NO BALANCE, AND THAT IS NOT ZERO.
 *
 * Zero is a Pod agent that has run out — a state that pauses it and needs
 * money. A Canopy agent has nothing to be out of, so this panel renders no
 * figure at all rather than a $0.00 that reads as a problem.
 *
 * A FAILED READ IS NOT AN EMPTY BALANCE.
 *
 * `funding.tsx` makes this argument for the trading wallet and falls back to
 * reading the chain from the browser. There is no such fallback here: a Pod
 * balance can only be read with Pod's token, which lives on the backend and
 * must stay there. So an outage says so in words and offers a retry, and never
 * renders as a number.
 */
export function ModelPanel({
  agentId,
  /** The agent's own wallet. Null until delegation has been granted. */
  agentWallet,
  /** The owner's wallet. What pays before the agent has one of its own. */
  personalWallet,
  /** When the agent's mandate ends. The delegation is scoped to the same clock. */
  expiresAt,
  /** Reload the page behind the panel once a wallet exists. */
  onChanged,
  onClose,
}: {
  agentId: number;
  agentWallet: string | null;
  personalWallet: string | null;
  expiresAt?: string | null;
  onChanged?: () => void;
  onClose: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const state = useApi((t) => getAgentModel(t, agentId), [agentId]);
  const [topUp, setTopUp] = useState(false);
  const [fresh, setFresh] = useState<AgentModel | null>(null);
  /** Non-null while the picker is open: the choice being considered, not the one in force. */
  const [changing, setChanging] = useState<ModelChoice | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const model = fresh ?? (state.phase === "ready" ? state.data : null);

  return (
    <Modal title="Model" onClose={onClose}>
      <div className="space-y-5 px-5 py-5">
        {state.phase === "loading" ? (
          <div className="h-24 animate-pulse border border-grid bg-surface" aria-hidden />
        ) : state.phase === "error" ? (
          <ErrorState message={state.message} onRetry={state.reload} />
        ) : !model ? null : (
          <>
            <div className="flex items-center gap-3">
              <ModelBadge model={{ id: model.modelId, label: model.label, provider: model.provider }} />
              <span className="font-ui text-[12.5px] text-text-dim">
                {model.provider === "canopy"
                  ? "Hosted by Canopy · included in your plan"
                  : "Bought through Pod · prepaid in USDC"}
              </span>
            </div>

            {model.balance ? (
              <div className="grid grid-cols-2 gap-px border border-grid bg-grid">
                <Figure
                  label="Balance"
                  value={`$${model.balance.usdc.toFixed(2)}`}
                  note={
                    model.balance.cyclesRemaining === null
                      ? // Before any cycle has run there is no rate to divide
                        // by, and a made-up estimate is worse than none.
                        "no cycles measured yet"
                      : `≈ ${model.balance.cyclesRemaining} cycles left`
                  }
                  ok={!model.balance.lowBalance && model.balance.usdc > 0}
                />
                <Figure
                  label="Spent"
                  value={`$${model.spentUsd.toFixed(2)}`}
                  note="on reasoning, all time"
                  ok
                />
              </div>
            ) : null}

            {/* The council stopped and the model is why. The backend's own
                sentence, rendered verbatim — the same contract `shortfall`
                already has, and for the same reason: the condition is known
                there and paraphrasing it here would drift. */}
            {model.balance && model.balance.usdc <= 0 ? (
              <Callout tone="warning" icon={<WarnIcon />} title="Out of model balance">
                This agent cannot reason until its balance is topped up. It will not top itself
                up — nothing here spends money you did not put in.
              </Callout>
            ) : model.balance?.lowBalance ? (
              <Callout tone="warning" icon={<InfoIcon />} title="Running low">
                Top it up before it empties, or the agent pauses mid-cycle.
              </Callout>
            ) : model.provider === "canopy" ? (
              <Callout tone="info" icon={<InfoIcon />} title="Nothing to fund">
                Canopy hosts this model and absorbs the cost. There is no balance to run out of.
              </Callout>
            ) : null}

            {/* Changing what an agent thinks with is a real change to the
                agent, not a display preference — so it happens here, in the
                owner's panel, and the balance moves with it. Pod credit is
                held against the AGENT, not the model, so switching does not
                strand it; that is worth saying, because everyone assumes the
                opposite. */}
            {changing ? (
              <div className="space-y-4 border-t border-grid pt-4">
                <PickModel
                  value={changing}
                  onChange={setChanging}
                  isPaper={agentWallet === null}
                  onBack={() => setChanging(null)}
                  context="panel"
                />
                {model.balance && model.balance.usdc > 0 ? (
                  <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">
                    Your ${model.balance.usdc.toFixed(2)} stays with this agent — it is held
                    against the agent, not against the model, and it is there if you switch back.
                  </p>
                ) : null}
                {saving ? (
                  <Callout tone="negative" icon={<WarnIcon />} title="Not changed">
                    {saving}
                  </Callout>
                ) : null}
                <button
                  type="button"
                  disabled={changing.modelId === model.modelId}
                  onClick={() => {
                    void (async () => {
                      setSaving(null);
                      try {
                        const token = await getAccessToken();
                        if (!token) throw new Error("not signed in");
                        setFresh(
                          await setAgentModel(token, agentId, {
                            modelId: changing.modelId,
                            maxPriceInputUsd: changing.maxPriceInputUsd ?? null,
                            maxPriceOutputUsd: changing.maxPriceOutputUsd ?? null,
                          }),
                        );
                        setChanging(null);
                      } catch (err) {
                        setSaving(err instanceof Error ? err.message : String(err));
                      }
                    })();
                  }}
                  className="flex h-11 w-full items-center justify-center border border-accent bg-accent-wash font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
                >
                  {changing.modelId === model.modelId
                    ? "Already using this"
                    : `Switch to ${changing.label}`}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setChanging({
                    modelId: model.modelId,
                    label: model.label,
                    provider: model.provider,
                  })
                }
                className="flex h-11 w-full items-center justify-center border border-grid-strong font-mono text-[11px] tracking-[0.1em] text-text-primary uppercase transition-colors hover:border-accent hover:text-accent"
              >
                Change model
              </button>
            )}

            {/* A BOUGHT MODEL NEEDS THE AGENT TO HAVE A WALLET.
                The agent pays for its own reasoning, so it needs somewhere to
                pay from — and the same grant that gives it one is the grant it
                will trade under later. Doing it here, once, means the creator
                is asked for a signature at the moment they can see what it is
                for, rather than being asked again at go-live.

                Nothing is transferred by granting. The signer is scoped by
                policy to swaps and cannot touch the Pod balance; the top-up
                below is signed by the owner, every time. */}
            {model.provider === "pod" && !agentWallet ? (
              <div className="space-y-3 border-t border-grid pt-4">
                <p className="font-ui text-[12.5px] leading-relaxed text-text-secondary">
                  This agent needs a wallet of its own before it can pay for its reasoning. The
                  same grant lets it trade when you take it live — you are not asked twice.
                </p>
                <GrantDelegation
                  agentId={agentId}
                  // See DELEGATION_CEILING_USD: a ceiling, not a budget. What
                  // it may spend is what the wallet holds.
                  maxSpendUsd={DELEGATION_CEILING_USD}
                  expiresAt={
                    expiresAt
                      ? new Date(expiresAt)
                      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  }
                  onGranted={() => onChanged?.()}
                />
              </div>
            ) : model.provider === "pod" ? (
              <>
                <button
                  type="button"
                  onClick={() => setTopUp(true)}
                  className="flex h-11 w-full items-center justify-center border border-accent bg-accent-wash font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
                >
                  Top up
                </button>
                {model.maxPriceInputUsd !== null ? (
                  <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">
                    Price ceiling: ${model.maxPriceInputUsd} per million tokens in, $
                    {model.maxPriceOutputUsd} out. Above that the agent holds rather than paying
                    more than you agreed.
                  </p>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>

      {topUp && model?.balance ? (
        <TopUpModal
          agentId={agentId}
          depositCode={model.balance.depositCode}
          agentWallet={agentWallet}
          personalWallet={personalWallet}
          onDone={(next) => {
            setFresh(next);
            setTopUp(false);
          }}
          onClose={() => setTopUp(false)}
        />
      ) : null}
    </Modal>
  );
}

/* ------------------------------------------------------------------ top-up -- */

/** USDC is a 6-decimal mint. A fixed property of the token, safe to hardcode. */
const USDC_DECIMALS = 6;

type Step =
  | { at: "form" }
  | { at: "signing" }
  | { at: "confirming"; signature: string }
  | { at: "done"; signature: string }
  | { at: "error"; message: string };

/**
 * Putting USDC on the balance.
 *
 * Two decisions and one signature. The decisions are how much, and — the part
 * that is genuinely new here — WHICH WALLET PAYS. Pod's deposit code binds the
 * credit to the agent, not to the payer, so anyone can fund it; that is what
 * makes a paper agent (which has no wallet of its own until delegation is
 * granted) fundable at all.
 *
 * The transaction itself is built by canopy-be and checked here before it is
 * signed — see lib/modelTopup.ts for what is checked and why the check is not
 * a formality.
 */
function TopUpModal({
  agentId,
  depositCode,
  agentWallet,
  personalWallet,
  onDone,
  onClose,
}: {
  agentId: number;
  depositCode: string;
  agentWallet: string | null;
  personalWallet: string | null;
  onDone: (next: AgentModel) => void;
  onClose: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { wallets } = useWallets();

  const payers = [
    agentWallet ? { address: agentWallet, label: "This agent's wallet" } : null,
    personalWallet ? { address: personalWallet, label: "Your wallet" } : null,
  ].filter((p): p is { address: string; label: string } => p !== null);

  const [payer, setPayer] = useState(payers[0]?.address ?? "");
  const [amount, setAmount] = useState("");
  const [held, setHeld] = useState<number | null>(null);
  const [step, setStep] = useState<Step>({ at: "form" });

  useEffect(() => {
    if (!payer) return;
    let cancelled = false;
    setHeld(null);
    void readChainFunding(payer)
      .then((b) => !cancelled && setHeld(b.usdc))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [payer]);

  // Parsed the way every other amount in this app is parsed. `toBaseUnits`
  // rejects "1.2.3" and refuses more than six decimals rather than truncating
  // — an amount that silently differs from what was typed is the one failure
  // this dialog must not have.
  let amountError: string | null = null;
  let units = 0n;
  if (amount.trim() !== "") {
    try {
      units = toBaseUnits(amount, USDC_DECIMALS);
      if (units <= 0n) amountError = "Enter an amount above zero.";
      else if (held !== null && Number(formatUnits(units, USDC_DECIMALS)) > held)
        amountError = "More than this wallet holds.";
    } catch (err) {
      amountError = err instanceof Error ? err.message : "Not a valid amount.";
    }
  }

  const send = useCallback(async () => {
    setStep({ at: "signing" });
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("not signed in");
      const wallet = wallets.find((w) => w.address === payer);
      // Matched by ADDRESS, never by index — an account holds several wallets
      // and the wrong one here spends the wrong money. Same rule as
      // walletModals.tsx, and it is the same hazard.
      if (!wallet) throw new Error("that wallet is not connected in this session");

      const prepared = await buildModelTopUp(token, agentId, {
        amountUsdc: Number(formatUnits(toBaseUnits(amount, USDC_DECIMALS), USDC_DECIMALS)),
        payer,
      });

      const signature = await submitTopUp(prepared, payer, async (wire) => {
        const { signature: bytes } = await signAndSendTransaction({
          transaction: wire,
          wallet,
          // Explicit, never inferred: this app is mainnet-only, and a devnet
          // deposit would look identical here and simply never arrive.
          chain: "solana:mainnet",
        });
        return getBase58Decoder().decode(bytes);
      });

      setStep({ at: "confirming", signature });
      const next = await confirmModelTopUp(token, agentId, signature);
      onDone(next);
      setStep({ at: "done", signature });
    } catch (err) {
      setStep({ at: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [agentId, amount, getAccessToken, onDone, payer, signAndSendTransaction, wallets]);

  return (
    <Modal title="Top up model balance" onClose={onClose}>
      <div className="space-y-5 px-5 py-5">
        {step.at === "error" ? (
          <Callout tone="negative" icon={<WarnIcon />} title="Not topped up">
            {step.message}
          </Callout>
        ) : null}

        {step.at === "done" ? (
          <div className="space-y-3 text-center">
            <p className="font-mono text-[12px] tracking-[0.08em] text-accent uppercase">
              Topped up
            </p>
            <a
              href={`https://solscan.io/tx/${step.signature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate font-mono text-[11px] text-accent underline underline-offset-4"
            >
              {step.signature}
            </a>
          </div>
        ) : (
          <>
            {payers.length === 0 ? (
              <Callout tone="warning" icon={<WarnIcon />} title="No wallet to pay from">
                Connecting your wallet…
              </Callout>
            ) : (
              <div className="space-y-2">
                <p className="font-mono text-[9.5px] tracking-[0.12em] text-text-muted uppercase">
                  Paid from
                </p>
                {payers.map((p) => (
                  <button
                    key={p.address}
                    type="button"
                    aria-pressed={payer === p.address}
                    onClick={() => setPayer(p.address)}
                    className={`flex w-full items-center justify-between gap-3 border px-4 py-3 text-left transition-colors ${
                      payer === p.address
                        ? "border-accent bg-accent-wash"
                        : "border-grid hover:border-grid-strong"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[12px] text-text-primary">
                        {p.label}
                      </span>
                      <span className="block truncate font-mono text-[10.5px] text-text-dim">
                        {p.address}
                      </span>
                    </span>
                    {payer === p.address && held !== null ? (
                      <span className="tnum shrink-0 font-mono text-[11.5px] text-text-secondary">
                        ${held.toFixed(2)}
                      </span>
                    ) : null}
                  </button>
                ))}
                {/* Which money this is comes as a surprise exactly once, and
                    the surprise is expensive. An agent's wallet is its trading
                    capital. */}
                {payer === agentWallet && held === 0 ? (
                  // A freshly granted wallet is empty, and it is the default
                  // payer because the balance belongs to the agent. Say what to
                  // do about it rather than leaving the amount field to refuse
                  // every number typed into it.
                  <p className="font-ui text-[11.5px] text-warning">
                    This wallet is empty. Send USDC to it, or pay from your own wallet above.
                  </p>
                ) : payer === agentWallet ? (
                  <p className="font-ui text-[11.5px] text-text-dim">
                    This spends the agent&apos;s trading capital.
                  </p>
                ) : null}
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="topup-amount"
                className="block font-mono text-[9.5px] tracking-[0.12em] text-text-muted uppercase"
              >
                Amount · USDC
              </label>
              <input
                id="topup-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="w-full border border-grid-strong bg-transparent px-4 py-3 font-mono text-[14px] text-text-primary outline-none focus:border-accent"
              />
              {amountError ? (
                <p className="font-ui text-[11.5px] text-negative">{amountError}</p>
              ) : null}
            </div>

            <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">
              Credited to this agent&apos;s balance via deposit code{" "}
              <span className="font-mono text-text-secondary">{depositCode}</span>. Prepaid and
              spend-only: it pays for this agent&apos;s reasoning and cannot be withdrawn.
            </p>

            <button
              type="button"
              onClick={() => void send()}
              disabled={
                step.at !== "form" || !payer || amount.trim() === "" || amountError !== null
              }
              className="flex h-11 w-full items-center justify-center border border-accent bg-accent-wash font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
            >
              {step.at === "signing"
                ? "Waiting for signature…"
                : step.at === "confirming"
                  ? "Crediting…"
                  : "Top up"}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------- bits -- */

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
      <span className={`block font-mono text-[19px] ${ok ? "text-text-primary" : "text-warning"}`}>
        {value}
      </span>
      <span className="block font-ui text-[12px] text-text-dim">{note}</span>
    </div>
  );
}
