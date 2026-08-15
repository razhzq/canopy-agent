"use client";

// The plan panel.
//
// Two things are being sold here and the panel has to be honest about both:
// how many agents you may run, and whether any of them may touch real money.
// Free is one paper agent — not a crippled one. It screens the same universe,
// runs the same council and writes the same decision trail. What it cannot do
// is put money behind a proposal, and that is the only line the paywall draws.
//
// WHY CHECKOUT LEAVES THE APP AND COMES BACK UNSURE
//
// BoomFi has no create-subscription API. A subscription exists because a human
// finished paying on BoomFi's own page, so this panel can only mint a tagged
// pay link and send the browser there. When they return, the webhook that
// records the payment may not have landed yet — so the panel offers an explicit
// re-check rather than pretending a reload is authoritative. Telling someone
// who has just paid "you are on Free" with no way to argue is the single worst
// moment this component can produce, and the refresh button exists for it.

import { useCallback, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useApi } from "@/lib/useApi";
import {
  cancelSubscription,
  getEntitlement,
  getPlans,
  refreshBilling,
  startCheckout,
  type BillingPlan,
  type Entitlement,
} from "@/lib/api";
import { SectionHead, Callout, InfoIcon } from "./ui";
import { ErrorState, SignedOutState } from "./states";
import { SkeletonPanel } from "./skeleton";

const BTN =
  "flex h-11 items-center justify-center gap-2.5 border px-6 font-mono text-[11px] tracking-[0.1em] uppercase transition-colors disabled:opacity-40";

/** Both reads in one call so the panel never renders a plan against stale slots. */
async function loadBilling(token: string): Promise<{
  entitlement: Entitlement;
  plans: BillingPlan[];
}> {
  const [entitlement, { plans }] = await Promise.all([getEntitlement(token), getPlans(token)]);
  return { entitlement, plans };
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

  const upgrade = useCallback(
    (planCode: string) =>
      withToken(async (token) => {
        const { url } = await startCheckout(token, planCode);
        // Same tab, not a popup. Payment pages get blocked as popups, and a
        // blocked one fails silently — the user clicks Upgrade and nothing
        // whatsoever happens.
        window.location.href = url;
      }),
    [withToken],
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

  const { entitlement: ent, plans } = state.data;
  const current = plans.find((p) => p.code === ent.plan.code);
  const upgrades = plans.filter(
    (p) => p.code !== ent.plan.code && p.purchasable && p.agentSlots >= ent.agentSlots,
  );

  return (
    <section className="space-y-6">
      <SectionHead
        index="01"
        title="PLAN"
        note={ent.subscription ? `${ent.plan.name} · ${ent.subscription.status}` : ent.plan.name}
      />

      {/* Usage first. The number someone came here to check is how many agents
          they have left, not what the tier is called. */}
      <div className="grid grid-cols-2 gap-px border border-grid bg-grid">
        <Figure
          label="Agents"
          value={`${ent.agentsInUse} / ${ent.agentSlots}`}
          note={
            ent.slotsRemaining > 0
              ? `${ent.slotsRemaining} slot${ent.slotsRemaining === 1 ? "" : "s"} left`
              : "no slots left"
          }
        />
        <Figure
          label="Execution"
          value={ent.allowLive ? "Live" : "Paper"}
          note={ent.allowLive ? "real money permitted" : "simulated fills only"}
        />
      </div>

      {/* Over quota is possible and is NOT an error: the limit was introduced
          after these agents existed, and nothing revokes one for being over.
          Saying so plainly beats leaving someone to infer they are in trouble. */}
      {ent.agentsInUse > ent.agentSlots && (
        <Callout tone="info" icon={<InfoIcon />} title="More agents than your plan allows">
          These were deployed before plans existed and they keep running. You
          cannot create another until you are back under {ent.agentSlots}.
        </Callout>
      )}

      {failure && (
        <Callout tone="negative" title="That did not go through">
          {failure}
        </Callout>
      )}

      {checked && !ent.subscription && (
        <Callout tone="warning" icon={<InfoIcon />} title="Still no subscription found">
          If you have just paid, it can take a moment to reach us. Check again in
          a minute — and if it still says this, the payment did not complete.
        </Callout>
      )}

      {/* What the paid tier buys, stated before the button that buys it. */}
      {upgrades.length > 0 && (
        <div className="space-y-px border border-grid bg-grid">
          {upgrades.map((plan) => (
            <div key={plan.code} className="space-y-4 bg-surface p-5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-mono text-[13px] tracking-[0.08em] text-text-primary uppercase">
                  {plan.name}
                </span>
                {plan.priceUsd !== null && (
                  <span className="font-mono text-[13px] text-text-primary">
                    ${plan.priceUsd}
                    <span className="text-text-dim"> / month</span>
                  </span>
                )}
              </div>
              <ul className="space-y-1.5 font-ui text-[13px] text-text-secondary">
                <li>
                  {plan.agentSlots} agent{plan.agentSlots === 1 ? "" : "s"}
                </li>
                <li>{plan.allowLive ? "Live trading with real funds" : "Paper trading only"}</li>
              </ul>
              <button
                type="button"
                disabled={busy}
                onClick={() => void upgrade(plan.code)}
                className={`${BTN} w-full border-accent text-accent hover:bg-accent hover:text-bg`}
              >
                {busy ? "Opening…" : `Upgrade to ${plan.name}`}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void recheck()}
          className={`${BTN} border-grid-strong text-text-secondary hover:text-text-primary`}
        >
          {busy ? "Checking…" : "I've paid — check again"}
        </button>

        {/* Cancel is present but deliberately unemphasised, and it says what
            actually happens: BoomFi may run the subscription to period end, so
            promising immediate revocation here would be a lie either way. */}
        {ent.subscription && !ent.subscription.cancelAtPeriodEnd && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void cancel(ent.subscription!.id)}
            className={`${BTN} border-grid text-text-dim hover:text-negative`}
          >
            Cancel plan
          </button>
        )}
      </div>

      {ent.subscription?.cancelAtPeriodEnd && (
        <Callout tone="warning" title="Ending at the end of this period">
          Your agents keep trading live until then. Nothing changes today.
        </Callout>
      )}

      {current && !current.allowLive && (
        <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">
          A paper agent runs the full loop — same universe, same council, same
          decision record. It just cannot put money behind what it decides.
        </p>
      )}
    </section>
  );
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
