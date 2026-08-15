"use client";

// Plan and billing.
//
// TWO THINGS ARE BEING SHOWN AND THEY ARE NOT THE SAME KIND OF THING.
//
//   Paper agents — 3 free, +1 for every person you invite. EARNED, never sold.
//   Live agents  — $20/month each. Bought, one subscription per agent.
//
// Which is why there is no plan picker here. There are no tiers to compare:
// everyone is on the same footing and the only purchase is per agent. A pricing
// table would imply a choice nobody is being asked to make.
//
// The paper section therefore never shows a payment prompt. When someone runs
// out of slots the way forward is free — invite someone — and offering to sell
// them something that grants no slots would be worse than saying nothing.
//
// WHY CHECKOUT LEAVES THE APP AND COMES BACK UNSURE
//
// BoomFi has no create-subscription API. A subscription exists because a human
// finished paying on BoomFi's own page, so this can only mint a tagged pay link
// and send the browser there. When they return, the webhook may not have landed
// yet — so there is an explicit re-check rather than a pretence that a reload is
// authoritative. Telling someone who has just paid "not subscribed" with no way
// to argue is the worst moment this component can produce.

import { useCallback, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useApi } from "@/lib/useApi";
import {
  cancelSubscription,
  getEntitlement,
  getMyInvite,
  refreshBilling,
  type Entitlement,
  type PersonalInvite,
} from "@/lib/api";
import { SectionHead, Callout, InfoIcon } from "./ui";
import { ErrorState, SignedOutState } from "./states";
import { SkeletonPanel } from "./skeleton";

const BTN =
  "flex h-11 items-center justify-center gap-2.5 border px-6 font-mono text-[11px] tracking-[0.1em] uppercase transition-colors disabled:opacity-40";

/** Entitlement and invite together, so slots and the way to earn more agree. */
async function loadBilling(token: string): Promise<{
  entitlement: Entitlement;
  invite: PersonalInvite | null;
}> {
  const [entitlement, invite] = await Promise.all([
    getEntitlement(token),
    // The invite code is a nice-to-have on this screen; billing is not. A
    // failure here must not blank the section that says what you are paying.
    getMyInvite(token).catch(() => null),
  ]);
  return { entitlement, invite };
}

function money(n: number | null): string {
  return n === null ? "—" : `$${n}`;
}

export function BillingSettings() {
  const { getAccessToken } = usePrivy();
  const state = useApi(loadBilling, []);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const withToken = useCallback(
    async (fn: (token: string) => Promise<unknown>) => {
      setBusy(true);
      setFailure(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Session expired. Sign in again.");
        await fn(token);
      } catch (err) {
        setFailure(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [getAccessToken],
  );

  const recheck = useCallback(
    () =>
      withToken(async (token) => {
        await refreshBilling(token);
        setChecked(true);
        state.reload();
      }),
    [withToken, state],
  );

  const cancel = useCallback(
    (subscriptionId: string) =>
      withToken(async (token) => {
        await cancelSubscription(token, subscriptionId);
        state.reload();
      }),
    [withToken, state],
  );

  if (state.phase === "loading") return <SkeletonPanel label="Plan" />;
  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "error") {
    return <ErrorState message={state.message} onRetry={state.reload} />;
  }

  const { entitlement: ent, invite } = state.data;
  const monthly = ent.liveMonthlyUsd;
  const liveTotal = monthly === null ? null : monthly * ent.liveAgents.length;

  return (
    <section className="space-y-6">
      <SectionHead
        index="01"
        title="PLAN"
        note={`${ent.agentsInUse} of ${ent.agentSlots} agents · ${ent.liveAgents.length} live`}
      />

      <div className="grid grid-cols-2 gap-px border border-grid bg-grid">
        <Figure
          label="Paper agents"
          value={`${ent.agentsInUse} / ${ent.agentSlots}`}
          note={
            ent.referralCount > 0
              ? `${ent.baseSlots} free + ${ent.referralCount} earned`
              : `${ent.baseSlots} free · invite to earn more`
          }
        />
        <Figure
          label="Live agents"
          value={String(ent.liveAgents.length)}
          note={
            ent.liveAgents.length === 0
              ? `${money(monthly)}/mo each`
              : `${money(liveTotal)}/mo total`
          }
        />
      </div>

      {/* The way to more slots is free, so it is stated as a fact rather than
          dressed as an offer. */}
      <Callout tone="info" icon={<InfoIcon />} title="Invite someone, get an agent">
        Every person who joins on your invite code adds one paper agent to your
        allowance, permanently. There is no limit.
        {invite ? (
          <>
            {" "}
            Yours is{" "}
            <span className="font-mono text-text-primary">{invite.code}</span> —
            it&rsquo;s in the account menu, top right.
          </>
        ) : null}
      </Callout>

      {ent.agentsInUse > ent.agentSlots && (
        <Callout tone="info" icon={<InfoIcon />} title="More agents than your allowance">
          These were deployed before the limit existed and they keep running. You
          cannot create another until you are back under {ent.agentSlots}.
        </Callout>
      )}

      {failure && (
        <Callout tone="negative" title="That did not go through">
          {failure}
        </Callout>
      )}

      {checked && ent.liveAgents.length === 0 && (
        <Callout tone="warning" icon={<InfoIcon />} title="Still no subscription found">
          If you have just paid, it can take a moment to reach us. Check again in
          a minute — and if it still says this, the payment did not complete.
        </Callout>
      )}

      {/* Live subscriptions, one row per agent, because that is how they are
          bought and how they are cancelled. */}
      {ent.liveAgents.length > 0 ? (
        <div className="space-y-px border border-grid bg-grid">
          {ent.liveAgents.map((sub) => (
            <div
              key={sub.subscriptionId}
              className="flex items-center justify-between gap-4 bg-surface px-5 py-4"
            >
              <div className="min-w-0">
                <p className="font-mono text-[12.5px] text-text-primary">
                  Agent #{sub.agentId}
                </p>
                <p className="pt-0.5 font-ui text-[12px] text-text-dim">
                  {sub.cancelAtPeriodEnd
                    ? // The honest version of "cancelled": still live, still
                      // paid for, and the date is when that stops.
                      `Live until ${fmtDate(sub.currentPeriodEnd)} — then paused`
                    : `${money(monthly)}/mo · renews ${fmtDate(sub.currentPeriodEnd)}`}
                </p>
              </div>
              {!sub.cancelAtPeriodEnd && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void cancel(sub.subscriptionId)}
                  className={`${BTN} shrink-0 border-grid text-text-dim hover:text-negative`}
                >
                  Cancel
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Deliberately NOT an upgrade button. Live is bought for one agent, from
          that agent's own screen, because "which agent" is the first thing the
          purchase needs and this screen does not know it. */}
      <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">
        {ent.liveAgents.length === 0 ? (
          <>
            Every agent runs on paper by default — same universe, same council,
            same decision record. Going live costs {money(monthly)}/month per
            agent and is started from the agent&rsquo;s own page.
          </>
        ) : (
          <>Live is {money(monthly)}/month per agent. Start it from the agent&rsquo;s page.</>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void recheck()}
          className={`${BTN} border-grid-strong text-text-secondary hover:text-text-primary`}
        >
          {busy ? "Checking…" : "I've paid — check again"}
        </button>
      </div>

      {ent.liveAgents.some((s) => s.cancelAtPeriodEnd) && (
        <Callout tone="warning" title="Ending at the end of the period">
          Those agents keep trading live until then. When the period ends they
          are paused holding their positions — nothing is sold for you.
        </Callout>
      )}
    </section>
  );
}

/** A date, or an honest blank when the provider has not told us one. */
function fmtDate(iso: string | null): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "unknown"
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="space-y-1.5 bg-surface p-5">
      <span className="block font-mono text-[10px] tracking-[0.12em] text-text-dim uppercase">
        {label}
      </span>
      <span className="block font-mono text-[19px] text-text-primary">{value}</span>
      <span className="block font-ui text-[12px] text-text-dim">{note}</span>
    </div>
  );
}
