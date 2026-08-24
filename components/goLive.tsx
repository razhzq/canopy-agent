"use client";

// Paper → live, as one dialog opened from the Live half of the book switch.
//
// WHY THE PILL IS THE ENTRY POINT.
//
// "Switch this agent to live" is the thing the user is trying to express, and
// the pill is where they already express "show me the live book". Those read as
// the same gesture, so the pill answering "you can't, it hasn't gone live" and
// leaving the actual promotion in a panel further down the page made the reader
// hunt for a second control to do what they had just asked for. Pressing Live on
// a paper agent now opens this.
//
// THE STEPS ARE DERIVED, NOT STORED.
//
// There is no `step` state. Which step is current is read off what is actually
// true — is this agent's wallet delegated — because that fact is owned by Privy
// and by our own record of it, not by this component. A stored cursor could
// advance past a grant that silently failed.
//
// PAYMENT COMES FIRST, AND IT IS ASKED FOR BEFORE ANYTHING IS SIGNED.
//
// Live execution is sold per agent, so a paper agent whose owner has not
// subscribed cannot be promoted no matter what else they do. That used to be
// discovered at the END — the user granted signing authority over their wallet,
// pressed the button that spends real money, and only then was told there was a
// bill. Handing over a delegation for a capability you turn out not to have
// bought is the wrong order to learn things in, and it makes the price feel
// like a toll rather than a price.
//
// So the subscription is checked when the dialog opens and, when it is missing,
// it is step one: what it costs, then Subscribe, then BoomFi. The 402 on
// promotion is kept as a backstop — the server is still the gate, and a
// subscription can lapse between opening this dialog and pressing the last
// button — but in the ordinary case nobody should ever reach it.
//
// FUNDING IS NOT A STEP, AND DELIBERATELY SO.
//
// It used to sit between the grant and the promotion, on the reasoning that an
// agent promoted with an empty wallet pauses on its first tick. It does — and
// that turns out to be the right behaviour rather than a problem to prevent.
// `runner.ts` checks the balance before the council runs and pauses with the
// shortfall, so an unfunded live agent costs nothing and explains itself.
//
// Making the deposit a gate meant holding someone inside a modal, watching a
// balance, waiting on a transfer from somewhere we cannot see — and it made the
// whole go-live path hostage to a chain read that fails routinely. Going live
// is now a decision the user completes in one sitting; funding is a deposit
// they make whenever, from the wallet bar on the agent's own page.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { GrantDelegation } from "@/components/grantDelegation";
import { useLocale, useT, type Locale, type TranslationKey } from "@/lib/i18n";
import { CheckIcon, LockIcon, WarnIcon } from "@/components/ui";
import {
  DELEGATION_CEILING_USD,
  getEntitlement,
  goLive,
  isPaywallError,
  refreshBilling,
  startCheckout,
  type AgentDetail,
} from "@/lib/api";

type Step = 1 | 2 | 3;

const STEPS: { n: Step; labelKey: TranslationKey; purposeKey: TranslationKey }[] = [
  { n: 1, labelKey: "gl_step_subscribe", purposeKey: "gl_step_subscribe_purpose" },
  { n: 2, labelKey: "gl_step_delegate", purposeKey: "gl_step_delegate_purpose" },
  { n: 3, labelKey: "gl_step_golive", purposeKey: "gl_step_golive_purpose" },
];

export function GoLiveModal({
  agent,
  wallet,
  openPositions,
  resumedFromCheckout = false,
  onChanged,
  onClose,
}: {
  agent: AgentDetail["agent"];
  wallet: AgentDetail["wallet"];
  /** Open PAPER positions. They are settled by the backend before promotion. */
  openPositions: number;
  /**
   * True when this dialog was reopened by the return from BoomFi.
   *
   * Changes one thing: the entitlement is re-read THROUGH the provider rather
   * than from our own tables. The webhook usually beats the customer back, but
   * "usually" is not good enough on the one screen where being told "not
   * subscribed" thirty seconds after paying is the whole experience.
   */
  resumedFromCheckout?: boolean;
  /** Reloads the page behind, so the dialog and the page agree as steps land. */
  onChanged: () => void;
  onClose: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const panel = useRef<HTMLDivElement>(null);
  const { t, locale } = useLocale();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [promoted, setPromoted] = useState(false);
  /**
   * Whether THIS agent has a live subscription. Null while that is unknown.
   *
   * Null is a real third state and is rendered as one. Guessing false would
   * flash a price at someone who has already paid; guessing true would flash a
   * promotion button at someone who has not, and then take it away.
   */
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  /** The per-agent monthly price, as the backend states it. Drives the copy. */
  const [monthlyUsd, setMonthlyUsd] = useState<number | null>(null);
  /**
   * The backend's own sentence about why live is refused, when it has given one.
   *
   * Preferred over anything composed here: a 402 already names the price and the
   * reason, and a second copy of that figure in this file is a second copy to
   * drift from it.
   */
  const [paywallMessage, setPaywallMessage] = useState<string | null>(null);
  /**
   * We came back from BoomFi and the subscription still is not visible.
   *
   * Distinct from "not subscribed": this person believes they have paid, and
   * quoting the price at them again would read as the payment having gone
   * nowhere. They get a re-check instead.
   */
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const [checking, setChecking] = useState(true);
  /**
   * The grant landed in THIS dialog.
   *
   * `wallet` is a prop and only refreshes when the page behind reloads, so
   * without this the dialog would sit on step 1 after a successful grant until a
   * round trip completed — a stall at exactly the moment the user is waiting to
   * be told they can move on.
   */
  const [justGranted, setJustGranted] = useState(false);
  /**
   * The address the grant just registered, held for the same reason.
   *
   * The promote step names the wallet it is about to put real money behind, and
   * in the window between granting and the page reload landing, `wallet` is
   * still null — which is exactly the window the user spends on that step.
   */
  const [grantedAddress, setGrantedAddress] = useState<string | null>(null);

  const delegated = wallet?.status === "active" || justGranted;
  const walletAddress = wallet?.address ?? grantedAddress;
  // Still derived from what is true rather than stored. `subscribed === null`
  // holds at step 1 so the rail never advances past a fact we do not have yet.
  const step: Step = subscribed !== true ? 1 : !delegated ? 2 : 3;

  /**
   * Reads what this agent is entitled to.
   *
   * `throughProvider` re-reads from BoomFi instead of our own tables. Reserved
   * for the return from checkout and the explicit re-check, because it is a call
   * to a third party on a path the user is waiting on — worth it exactly when
   * our own copy is the thing suspected of being stale.
   *
   * A FAILURE HERE DOES NOT BLOCK THE FLOW. If billing cannot be read we let the
   * user carry on and let the promotion's own 402 decide, which is the answer
   * the server would have given anyway. Refusing to proceed would turn a billing
   * outage into "you cannot go live" for people who have paid.
   */
  const readEntitlement = useCallback(
    async (throughProvider: boolean) => {
      setChecking(true);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error(t("error_not_signed_in"));
        const ent = throughProvider
          ? await refreshBilling(token)
          : await getEntitlement(token);
        setMonthlyUsd(ent.liveMonthlyUsd);
        const paid = ent.liveAgents.some((l) => l.agentId === agent.id);
        setSubscribed(paid);
        // Only after a provider re-read is "no subscription" worth calling a
        // wait. Before checkout it is simply the ordinary unpaid state.
        setAwaitingPayment(throughProvider && !paid);
      } catch {
        setSubscribed(true);
      } finally {
        setChecking(false);
      }
    },
    [getAccessToken, agent.id],
  );

  useEffect(() => {
    void readEntitlement(resumedFromCheckout);
  }, [readEntitlement, resumedFromCheckout]);

  // The dialog owns Escape and keeps Tab inside the panel, so focus cannot
  // wander onto the page behind a modal that is about to spend real money.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    // The page behind a modal must not scroll under it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, busy]);

  async function promote() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("error_not_signed_in"));
      await goLive(token, agent.id);
      setConfirming(false);
      setPromoted(true);
      onChanged();
    } catch (err) {
      if (isPaywallError(err) && err.detail.code === "live_not_allowed") {
        // Not an error state, and not normally reachable — the dialog asks for
        // payment first. Kept because the server is the real gate: a
        // subscription can lapse or be cancelled while this dialog sits open.
        // The confirm step is dismissed and the dialog falls back to step 1
        // carrying the backend's own sentence.
        setConfirming(false);
        setSubscribed(false);
        setAwaitingPayment(false);
        setPaywallMessage(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  /**
   * Sends the browser to BoomFi to start the subscription.
   *
   * Same tab, not a popup: payment pages get blocked as popups and a blocked one
   * fails silently, so the user clicks Subscribe and nothing happens.
   *
   * Nothing is promoted here. The subscription begins on BoomFi's page and the
   * webhook records it; the return path brings the customer back to this agent
   * with this dialog reopened, where the entitlement is re-read through the
   * provider before anything is claimed about it.
   */
  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("error_not_signed_in"));
      // Names where to come back to. BoomFi returns the customer to this exact
      // agent and `?checkout=return` reopens this dialog on the step after the
      // one they just cleared, so paying does not cost them the thread.
      const { url } = await startCheckout(
        token,
        agent.id,
        "live_agent",
        `/workspace/${agent.id}?checkout=return`,
      );
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/80 px-4 py-10 backdrop-blur-sm"
      // A click that starts inside the panel and ends on the backdrop must not
      // close it — checking the target keeps a drag from dismissing the dialog.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="go-live-title"
        className="w-full max-w-[620px] animate-[log-enter_180ms_ease-out] border border-grid-strong bg-panel shadow-[0_36px_90px_-28px_rgba(0,0,0,0.9)]"
      >
        {/* ------------------------------------------------------------- head */}
        <div className="flex items-start justify-between gap-6 border-b border-grid px-7 pt-6 pb-5">
          <div className="min-w-0 space-y-1.5">
            <p className="truncate font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
              {t("gl_eyebrow", { name: agent.strategy_name })}
            </p>
            <h2 id="go-live-title" className="font-mono text-[21px] leading-none text-text-primary">
              {t(promoted ? "gl_title_done" : "gl_title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("common_close")}
            className="shrink-0 border border-border px-2.5 py-1 font-mono text-[11px] text-text-dim transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {t("wallet_esc")}
          </button>
        </div>

        {promoted ? (
          <Promoted name={agent.strategy_name} onClose={onClose} />
        ) : (
          <>
            <StepRail current={step} />

            {/* --------------------------------------------------------- body */}
            <div className="px-7 py-6">
              {subscribed === null ? (
                <Checking />
              ) : step === 1 ? (
                <Section
                  title={t(awaitingPayment ? "gl_waiting_title" : "gl_sub_title")}
                  body={
                    awaitingPayment
                      ? t("gl_waiting_body")
                      : // The backend's own sentence wins when there is one: a
                        // 402 already names the price and the reason, and it
                        // arrives as finished English.
                        (paywallMessage ??
                        t("gl_sub_body", {
                          price:
                            monthlyUsd === null
                              ? t("gl_sub_price_unknown")
                              : t("gl_sub_price", { amount: money(monthlyUsd) }),
                        }))
                  }
                >
                  <div className="flex flex-wrap items-center gap-3">
                    {/* WHY THERE IS NO SECOND SUBSCRIBE BUTTON WHILE WAITING.
                        In this window we do not know whether a payment was made,
                        and BoomFi's duplicate guard is a check against an ACTIVE
                        subscription — which is precisely the thing not visible
                        yet. Offering checkout here is offering to charge someone
                        twice. Closing and reopening this dialog brings the
                        Subscribe button back for anyone who abandoned the page. */}
                    {awaitingPayment ? (
                      <button
                        type="button"
                        onClick={() => void readEntitlement(true)}
                        disabled={busy || checking}
                        className="h-11 border border-accent bg-accent-wash px-6 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:opacity-40"
                      >
                        {t(checking ? "gl_checking" : "gl_check_again")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void subscribe()}
                        disabled={busy || checking}
                        className="h-11 border border-accent bg-accent-wash px-6 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:opacity-40"
                      >
                        {t(busy ? "gl_opening" : "gl_subscribe")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={busy}
                      className="px-2 font-mono text-[11px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-text-primary disabled:opacity-40"
                    >
                      {t("gl_not_now")}
                    </button>
                  </div>
                  {/* Said plainly, because the journey leaves the app: they pay on
                      BoomFi's page and are brought back to this agent. */}
                  <Assurance>
                    {t(awaitingPayment ? "gl_assurance_abandoned" : "gl_assurance_checkout")}
                  </Assurance>
                </Section>
              ) : step === 2 ? (
                <Section
                  title={t("gl_grant_title")}
                  body={t("gl_grant_body")}
                >
                  <GrantDelegation
                    agentId={agent.id}
                    // Not the agent's declared capital — see
                    // DELEGATION_CEILING_USD. What it may spend is what the
                    // wallet holds; how much of that per trade is the desk's
                    // call, not a number frozen at grant time.
                    maxSpendUsd={DELEGATION_CEILING_USD}
                    // Matches the mandate's own clock: an agent that has stopped
                    // running should not still hold signing authority. Falls back to
                    // 30 days only if the field is missing from an older build —
                    // never to something open-ended, because an unbounded delegation
                    // is the one shape this system does not allow.
                    expiresAt={
                      agent.expires_at
                        ? new Date(agent.expires_at)
                        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    }
                    onGranted={(result) => {
                      setJustGranted(true);
                      setGrantedAddress(result.address);
                      onChanged();
                    }}
                  />
                  <Assurance>{t("gl_grant_assurance")}</Assurance>
                </Section>
              ) : (
                <Section
                  title={t("gl_promote_title")}
                  body={
                    openPositions === 0
                      ? t("gl_promote_body")
                      : openPositions === 1
                        ? t("gl_promote_body_open_one")
                        : t("gl_promote_body_open_many", { count: openPositions })
                  }
                >
                  <Ledger
                    rows={[
                      [t("gl_row_wallet"), walletAddress ? short(walletAddress) : "—"],
                      // Was "Spend cap" against the agent's declared capital, a
                      // figure the delegation does not enforce and the deposit
                      // does not follow. What the grant actually restricts is
                      // the kind of instruction it will sign.
                      [t("gl_row_scope"), t("gl_scope_swaps")],
                      [
                        t("gl_row_expires"),
                        wallet?.expiresAt
                          ? new Date(wallet.expiresAt).toLocaleDateString(
                              locale === "zh" ? "zh-CN" : "en-GB",
                              { day: "numeric", month: "short", year: "numeric" },
                            )
                          : "—",
                      ],
                    ]}
                  />

                  {/* Said here rather than enforced as a step. An unfunded live
                      agent is a safe, self-explaining state — `runner.ts` reads
                      the balance before the council runs and pauses with the
                      shortfall — so the honest thing is to name it and let the
                      user go live now and deposit when it suits them. */}
                  <Assurance>{t("gl_deposit_assurance")}</Assurance>

                  {confirming ? (
                    <>
                      <div className="flex gap-3 border border-warning bg-warning/[0.04] px-5 py-4">
                        <WarnIcon className="mt-0.5 shrink-0 text-warning" />
                        <p className="font-ui text-[13px] leading-relaxed text-warning">
                          {t("gl_confirm_warning")}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void promote()}
                          disabled={busy}
                          className="h-11 border border-warning px-6 font-mono text-[11px] tracking-[0.1em] text-warning uppercase transition-colors hover:bg-warning hover:text-bg disabled:opacity-40"
                        >
                          {t(busy ? "gl_settling" : "gl_confirm")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(false)}
                          disabled={busy}
                          className="px-2 font-mono text-[11px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-text-primary disabled:opacity-40"
                        >
                          {t("gl_back")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      className="h-11 w-full border border-accent bg-accent-wash px-6 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
                    >
                      {t("gl_go_live")}
                    </button>
                  )}
                </Section>
              )}

              {error ? (
                <p className="pt-5 font-ui text-[13px] text-negative" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- rail -- */

/**
 * Where you are in a three-step path, and what the remaining steps are.
 *
 * Shown from step 1 onward — the point is that someone deciding whether to start
 * can see the whole path before granting anything, rather than discovering a
 * funding requirement after handing over signing authority.
 */
function StepRail({ current }: { current: Step }) {
  const t = useT();

  return (
    <ol className="flex items-stretch border-b border-grid" aria-label={t("gl_steps_aria")}>
      {STEPS.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        return (
          <li
            key={s.n}
            aria-current={active ? "step" : undefined}
            className={`flex-1 space-y-1.5 border-r border-grid px-5 py-4 transition-colors last:border-r-0 ${
              active ? "bg-surface" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-full font-mono text-[9.5px] ${
                  done
                    ? "bg-accent text-bg"
                    : active
                      ? "border border-accent text-accent"
                      : "border border-grid-strong text-text-muted"
                }`}
              >
                {done ? <CheckIcon className="size-2.5" /> : i + 1}
              </span>
              <span
                className={`font-mono text-[11.5px] tracking-[0.04em] ${
                  done ? "text-accent" : active ? "text-text-primary" : "text-text-muted"
                }`}
              >
                {t(s.labelKey)}
              </span>
            </div>
            <p
              className={`font-ui text-[11.5px] leading-snug ${
                active ? "text-text-secondary" : "text-text-dim/70"
              }`}
            >
              {t(s.purposeKey)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------- bits -- */

function Section({
  title,
  body,
  children,
}: {
  title: string;
  body: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="font-mono text-[14px] text-text-primary">{title}</h3>
        <p className="font-ui text-[13px] leading-relaxed text-text-secondary">{body}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * The one read this dialog does before it says anything.
 *
 * Shown rather than skipped past, because the alternative is guessing which step
 * someone is on and correcting it a beat later — and the correction would either
 * quote a price to somebody who has paid or withdraw a button from somebody who
 * has not.
 */
function Checking() {
  const t = useT();

  return (
    <div className="space-y-2">
      <h3 className="font-mono text-[14px] text-text-primary">{t("gl_checking_title")}</h3>
      <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
        {t("gl_checking_body")}
      </p>
    </div>
  );
}

/** A figure or term inside prose, lifted just enough to be findable. */
function Figure({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[12.5px] text-text-primary">{children}</span>;
}

/** The quiet reassurance under an action that looks larger than it is. */
function Assurance({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-l border-accent/40 pl-4">
      <LockIcon className="mt-0.5 size-3.5 shrink-0 text-accent/70" />
      <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">{children}</p>
    </div>
  );
}

/** What is about to be committed, as facts rather than prose. */
function Ledger({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="border border-grid bg-surface">
      {rows.map(([k, v]) => (
        <div
          key={k}
          className="flex items-center justify-between gap-4 border-b border-grid px-5 py-3 last:border-b-0"
        >
          <dt className="font-mono text-[10px] tracking-[0.12em] text-text-dim uppercase">{k}</dt>
          <dd className="tnum font-mono text-[12.5px] text-text-primary">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Promoted({ name, onClose }: { name: string; onClose: () => void }) {
  const t = useT();

  return (
    <div className="space-y-5 px-7 py-8">
      <div className="flex size-10 items-center justify-center rounded-full bg-accent-wash">
        <CheckIcon className="size-4 text-accent" />
      </div>
      <div className="space-y-2">
        <h3 className="font-mono text-[15px] text-text-primary">
          {t("gl_promoted_title", { name })}
        </h3>
        <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
          {t("gl_promoted_body")}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="h-11 w-full border border-accent bg-accent-wash px-6 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
      >
        {t("gl_done")}
      </button>
    </div>
  );
}

function short(address: string): string {
  return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
