"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Callout, Columns, WarnIcon } from "@/components/ui";
import {
  classFor,
  createStrategy,
  selectionFor,
  startPaperRun,
  getAgent,
  type DiscoverySpec,
  type UniverseAsset,
  type UniverseSelection,
} from "@/lib/api";
import {
  BuildName,
  BuildReview,
  BuildFrame,
  BuildCta,
} from "@/components/buildAgentMobile";
import { NameAgentModal } from "@/components/nameAgent";
import { useIsMobile } from "@/lib/useIsMobile";
import { lastRoute } from "@/components/routeMemory";
import { PickMarket } from "@/components/pickMarket";
import {
  CAPITAL_USD,
  RWA_RULES,
  SetLimits,
  type Limits,
} from "@/components/setLimits";
import {
  CADENCES,
  rulesForClass,
  rulesForClasses,
  toPayload,
} from "@/components/buildStrategy";
import { describeVenues } from "@/lib/venues";
import { routeOf } from "@/components/routeBadge";
import {
  DEFAULT_MODEL,
  PickModel,
  type ModelChoice,
} from "@/components/pickModel";
import { FundNewAgent } from "@/components/fundNewAgent";
import { usePersonalWallet } from "@/lib/usePersonalWallet";
import { useT, type Translate, type TranslationKey } from "@/lib/i18n";

/**
 * The asset classes present in a selection, in a stable order.
 *
 * Stable so it can be compared as a string: the rule list only needs rebuilding
 * when the SET changes, not every time an asset is added within a class.
 */
/**
 * The order book a selection trades, named as its owner picked it.
 *
 * KalqiX and PhantX are the same book through different accounts, and the
 * picker offers them as separate rows precisely so the choice is explicit — so
 * this reports whichever one the markets carry. Mixed selections cannot reach
 * here: the backend refuses a universe spanning both, since one agent holds one
 * signing slot on one account.
 */
function clobVenueOf(assets: UniverseAsset[]): string | null {
  for (const a of assets) {
    const { router } = routeOf(a);
    if (router === "kalqix") return "KalqiX";
    if (router === "phantx") return "PhantX";
  }
  return null;
}

function classesIn(assets: UniverseAsset[]): ("rwa" | "spot")[] {
  const set = new Set(assets.map(classFor));
  return (["rwa", "spot"] as const).filter((c) => set.has(c));
}

/**
 * The agent builder — wireframes 1d and 1e, after the naming modal.
 *
 *   name → 01 Market → 02 Limits → 03 Model → paper run
 *
 * ROUTE IS NOT A STEP
 *
 * 1f asked "choose a venue" between the limits and the paper run. It is gone,
 * and what killed it is that step 1 now answers it: a market settles on one
 * chain, the venues that can fill it follow from that chain, and the picker's
 * own venue filter lets you choose on exactly that basis while choosing the
 * market. A second screen could only restate the answer or offer a pin the
 * strategy payload has never carried.
 *
 * The route did not stop mattering — it stopped being a question. Where the
 * selection fills is stated in the rail and in the review, from
 * {@link describeVenues}, next to everything else that was decided rather than
 * asked. Give it its step back the day pinning reaches the backend and a
 * creator can pick something the market does not already imply.
 *
 * The separate "describe" screen is gone too. Compiling a sentence into
 * editable rules happens inside step 2, beside the chips it produced — which
 * is the thing the old flow missed: it read a description, filled two pages
 * elsewhere, and never showed its working.
 *
 * STEP 3 IS THE MODEL, AND IT IS A REAL QUESTION
 *
 * Unlike the venue step, which restated an answer the market had already given,
 * nothing else on this wizard decides what the council reasons with. The choice
 * also costs money — a marketplace model is paid for in USDC by the agent
 * itself — so it cannot be defaulted quietly on someone's behalf.
 *
 * What step 3 does NOT touch is step 2. The compiler that turns a sentence into
 * chips runs on Canopy's model and always will: it runs before an agent, a
 * wallet or a balance exists.
 */

const STEPS: { index: string; labelKey: TranslationKey }[] = [
  { index: "01", labelKey: "build_step_market" },
  { index: "02", labelKey: "build_step_limits" },
  { index: "03", labelKey: "build_step_model" },
];

const DEFAULT_LIMITS: Limits = {
  // Everything off until the compiler or the author turns something on. A
  // builder that arrives pre-armed teaches nobody what it is doing, and a
  // default threshold is still a threshold that excludes things.
  rules: RWA_RULES.map((r) => ({ ...r, enabled: false })),
  exits: { takeProfitPct: 25, stopLossPct: 12, maxHoldDays: 0 },
  positionUsd: 2_500,
  tradesPerCycle: 2,
};

/**
 * How a cadence reads in the review rail.
 *
 * Absent is not blank: the strategy still runs on a cycle, the author just did
 * not choose it. Saying so is the difference between a review that reports the
 * config and one that hides the half of it that came from a default.
 */
function cadenceLabel(sec: number | undefined, t: Translate): string {
  if (sec === undefined) return t("review_cadence_default");
  const hit = CADENCES.find((c) => c.sec === sec);
  return hit ? t(hit.labelKey) : t("review_cadence_seconds", { n: sec });
}

export function BuildAgent() {
  const router = useRouter();
  const { ready, authenticated, getAccessToken, login } = usePrivy();
  const t = useT();

  const [name, setName] = useState("");
  const [named, setNamed] = useState(false);
  const [step, setStep] = useState(0);
  /**
   * Every market the agent may trade, in the order they were picked.
   *
   * A list rather than one, because the engine always screened a list — both
   * specialists loop over their universe and an auto strategy screens up to
   * sixty. The single-market limit was this component and one line below.
   *
   * The FIRST entry is the representative: it names the step in the rail, and
   * it is what the strategy composer is told it is trading. Every entry shares a
   * class, so any of them would describe the specialist equally well.
   */
  const [markets, setMarkets] = useState<UniverseAsset[]>([]);
  const asset = markets[0] ?? null;
  /**
   * The screen, when the author asked the agent to find its own markets.
   *
   * COMPOSES WITH `markets` rather than replacing them, which is why it is
   * separate state and not a variant of the list. A strategy may pin two
   * markets and screen for a hundred more; the pinned ones are traded either
   * way, and the screen re-runs every cycle.
   */
  const [discovery, setDiscovery] = useState<DiscoverySpec | undefined>(undefined);
  const [limits, setLimits] = useState<Limits>(DEFAULT_LIMITS);
  // What the council will reason with. Canopy's model until someone chooses
  // otherwise — the state every agent built before step 3 existed is in.
  const [model, setModel] = useState<ModelChoice>(DEFAULT_MODEL);
  const personalWallet = usePersonalWallet();
  /**
   * The agent that exists but cannot yet think.
   *
   * Non-null between starting a Pod agent's paper run and the owner finishing
   * (or dismissing) its funding. The agent is already created and deployed by
   * this point — delegation is granted against an agent id, so there is nothing
   * to fund until one exists — it simply has no balance to reason with.
   */
  const [funding, setFunding] = useState<{
    agentId: number;
    wallet: string | null;
  } | null>(null);
  // Where the selection fills. Derived, never state: it follows from the
  // markets, so there is nothing to keep in sync and nothing to strand.
  const venues = describeVenues(markets, t);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A created-but-not-yet-started strategy, held back because its plan drew
  // warnings. The id is kept so confirming starts THAT strategy rather than
  // creating a second one.
  const [pending, setPending] = useState<{
    id: number;
    warnings: string[];
  } | null>(null);
  /**
   * Below lg the builder is wireframes B1–B6: full screens with one action,
   * rather than the two-column rail.
   *
   * Called here with the other hooks and never beside the branch that uses it —
   * every return below is conditional, and a hook after one runs on some
   * renders and not others.
   */
  const mobile = useIsMobile();
  /** Mobile only: the review screen sits between step 3 and creating. */
  const [reviewing, setReviewing] = useState(false);

  const activeRules = limits.rules.filter((r) => r.enabled !== false);

  /**
   * Starts the paper run and leaves the builder.
   *
   * Split out because it is reachable two ways: straight through when a plan
   * drew no warnings, and from the confirm button when it did. The strategy
   * already exists by this point either way — confirming must never create a
   * second one.
   */
  async function start(token: string, strategyId: number): Promise<void> {
    // Creating leaves it a draft. Starting the paper run freezes the rules and
    // deploys the agent, so the button does what it says rather than leaving a
    // half-made thing behind.
    const { agentId } = await startPaperRun(token, strategyId);

    // A Pod agent funds itself HERE, before leaving the builder.
    //
    // It used to be handed off with `?tab=cycles&fund=model` and a receiving
    // effect on the agent page. That never once worked: the effect lives in
    // AgentDetailView, which `workspace.tsx` renders only on `tab=overview`, so
    // on the cycles tab nothing read the flag — and the tab bar rebuilds the
    // query from scratch, so switching to Overview deleted it on the way past.
    // Every Pod agent ever created landed on an empty cycles tab with no way to
    // fund it in sight, which is exactly the failure that hand-off was written
    // to prevent.
    //
    // Doing it inline removes the whole class of problem: there is no flag to
    // carry, no tab that has to be the right one, and no navigation between the
    // decision and the step it requires. The owner is already here.
    if (model.provider === "pod") {
      // The agent's own wallet, which a fresh one does not have yet — null is
      // the honest answer and the one that makes ModelPanel open on delegation
      // rather than on a balance. A failed read lands on the same null, so the
      // panel degrades to asking for the grant it would have asked for anyway.
      let wallet: string | null = null;
      try {
        wallet = (await getAgent(token, agentId)).wallet?.address ?? null;
      } catch {
        // Not worth failing the run over: the agent is created and deployed,
        // and the panel's own state is fetched from the agent id regardless.
      }
      setFunding({ agentId, wallet });
      return;
    }

    router.push(`/workspace/${agentId}?tab=overview`);
  }

  /**
   * Leaves for the agent's page once funding is done with — or dismissed.
   *
   * OVERVIEW, not cycles. A brand-new agent has no cycles to show, and overview
   * is the only tab carrying the unfunded note and its Top up button, so an
   * owner who closed the panel without paying still lands somewhere that offers
   * the thing they just skipped.
   */
  function leaveFunding(agentId: number): void {
    setFunding(null);
    router.push(`/workspace/${agentId}?tab=overview`);
  }

  /** Re-reads the wallet after a grant, so the panel moves on to the top-up. */
  async function refreshFunding(agentId: number): Promise<void> {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const wallet = (await getAgent(token, agentId)).wallet?.address ?? null;
      setFunding((f) => (f && f.agentId === agentId ? { ...f, wallet } : f));
    } catch {
      // The panel keeps working from what it has; the next open re-reads.
    }
  }

  async function confirmPending(): Promise<void> {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("error_not_signed_in"));
      await start(token, pending.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("error_not_signed_in"));
      // A screen is a complete answer to step 1 on its own — it says what the
      // agent may trade without naming any of it. Only the case where NEITHER
      // was given is an error.
      if (markets.length === 0 && !discovery) {
        throw new Error(t("build_pick_market_error"));
      }

      const { strategy, warnings } = await createStrategy(token, {
        name: name.trim(),
        // Still ONE value, because the column is one value — but it is no
        // longer what decides the specialist. The tick reads the UNIVERSE and
        // runs a specialist per class present (MultiSme), so this is the
        // strategy's primary class: what it screens when nothing is named.
        // A screen only ever finds SPL tokens, so a strategy with one and no
        // named market is "spot" — the "rwa" fallback below is for a strategy
        // that named nothing at all, and would put a token screen under the
        // specialist that reads filings.
        strategyClass: classesIn(markets)[0] ?? (discovery ? "spot" : "rwa"),
        // Only rules left on. An off rule is absent, not zeroed — a zeroed
        // threshold still applies and still excludes things.
        rules: toPayload(activeRules),
        // The third and fourth things collected and then dropped here, after
        // timeframe and addPlan. These two are worse than those were: a
        // sentence is the ONLY way to build either, so an either/or group or a
        // two-stage entry that does not survive this call cannot be created at
        // all — the composer builds it, the route stores it, and nothing in
        // between carried it.
        anyOf: limits.anyOf,
        setup: limits.setup,
        safetyFloor: {
          minLiquidityUsd: 25_000,
          maxSlippagePct: 1.5,
          requireSafetyScreen: false,
        },
        feePct: 10,
        // Every market chosen. The picker guarantees they share a class, which
        // is what makes one `strategyClass` above correct for all of them.
        universe: markets.map(selectionFor),
        // Undefined rather than null when there is no screen: the field is
        // optional on the route, and absent is what every strategy written
        // before this sends.
        discovery,
        exits: limits.exits,
        // Both of these were collected by the builder and then dropped on the
        // floor here — a timeframe the author picked and a plan the composer
        // read out of their sentence never reached the strategy they created.
        timeframe: limits.timeframe,
        // How often it wakes. Omitted when the author never chose, which lets
        // the engine default (hourly) stand — sending a number here on their
        // behalf would assert a cadence they never picked. The route refuses
        // anything outside 300–86400 rather than clamping, and every value the
        // picker offers is inside it.
        tickIntervalSec: limits.cadenceSec,
        addPlan: limits.addPlan ?? null,
        // The compliance screen the author chose in step 2. Omitted when they
        // never chose, which defers to the server default rather than asserting
        // "none" on their behalf.
        complianceProfile: limits.complianceProfile,
        // The budget from step 2. These were collected by the builder and then
        // dropped here, exactly as timeframe and addPlan once were — the slider
        // went to 10 and every agent ran with 3.
        positionUsd: limits.positionUsd,
        tradesPerCycle: limits.tradesPerCycle,
        // Only meaningful across several markets — a top-3 of one asset is that
        // asset. Sent regardless when set, because the engine treats a ranking
        // wider than the universe as a no-op rather than an error.
        ranking: limits.ranking,
        // Step 3. The RUNTIME council model — what the five seats reason with
        // every cycle. It is deliberately NOT what compiled the rules above:
        // that ran on Canopy's model, before this agent existed.
        model: {
          id: model.modelId,
          maxPriceInputUsd: model.maxPriceInputUsd,
          maxPriceOutputUsd: model.maxPriceOutputUsd,
        },
      });

      // Legal-but-probably-not-meant combinations — an add deeper than the
      // stop, an unbounded ladder. STOP here rather than reporting them on the
      // way past: starting the paper run freezes the config, so this is the
      // last moment the author can act on them. Setting state and navigating
      // in the same breath would show the warning to nobody.
      if (warnings?.length) {
        setPending({ id: strategy.id, warnings });
        return;
      }

      await start(token, strategy.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Picking markets, shared by both layouts.
   *
   * The rule LIST follows the classes being traded — the union, since a mixed
   * universe can carry rules from both.
   *
   * Enabled states are preserved across the change rather than reset. This used
   * to wipe them, because switching class replaced the selection and a stale
   * rule would be sent for an asset that now REJECTS on it. Adding a class no
   * longer removes anything, so wiping would throw away work the author had
   * already done.
   */
  function onMarketsChange(next: UniverseAsset[]): void {
    syncRulesTo(classesIn(next), discovery);
    setMarkets(next);
  }

  /**
   * Adding or removing a screen changes which rules step 2 can offer.
   *
   * A screen only ever finds SPL tokens, so it puts the token class in play
   * exactly as picking one does. Without this a discovery-only strategy reaches
   * step 2 with the RWA rule set — margins and filings, none of which a token
   * carries — and every rule it could actually use is missing, on a step that
   * refuses to continue until one is enabled.
   */
  function onDiscoveryChange(next: DiscoverySpec | undefined): void {
    syncRulesTo(classesIn(markets), next);
    setDiscovery(next);
  }

  /**
   * Rebuilds the rule list for a set of classes, keeping what was switched on.
   *
   * Shared by the two callers above because they are the same operation from
   * two directions, and a second copy would be the one that forgets to preserve
   * `enabled` — which silently switches off every rule the author had chosen.
   */
  function syncRulesTo(
    classes: ("rwa" | "spot")[],
    spec: DiscoverySpec | undefined,
  ): void {
    const withScreen = (cs: ("rwa" | "spot")[], on: boolean): ("rwa" | "spot")[] =>
      on ? [...new Set<"rwa" | "spot">([...cs, "spot"])] : cs;
    const beforeAll = withScreen(classesIn(markets), Boolean(discovery));
    const afterAll = withScreen(classes, Boolean(spec));
    if (afterAll.join() === beforeAll.join()) return;
    setLimits((l) => {
      const enabled = new Map(l.rules.map((r) => [r.key, r.enabled]));
      return {
        ...l,
        rules: rulesForClasses(afterAll).map((r) => ({
          ...r,
          enabled: enabled.get(r.key) ?? false,
        })),
      };
    });
  }

  /**
   * The mandate, as the review screen lists it.
   *
   * Read off the same state the payload is built from, so the screen cannot
   * describe something other than what gets created. Each row carries the step
   * it came from, so "that is wrong" has somewhere to go.
   */
  function reviewRows() {
    return [
      {
        label: t("review_row_markets"),
        // A screen is part of the answer to this row, so it is named here. A
        // review that showed "—" for a strategy about to screen the whole token
        // universe would be describing something other than what gets created,
        // which is the one thing this screen exists not to do.
        value:
          [
            markets.length ? markets.map((m) => m.symbol).join(" · ") : null,
            discovery ? t("dsc_title") : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—",
        step: "01",
      },
      {
        label: t("review_row_rules"),
        value: t("review_row_rules_value", { count: activeRules.length }),
        step: "02",
      },
      {
        label: t("review_row_measured_on"),
        // A bar size, written the way every chart writes it.
        value: limits.timeframe ?? "1d",
        step: "02",
      },
      {
        label: t("review_row_cycle"),
        // The engine default when the author never chose, stated as the engine
        // states it rather than left blank — a review line that omits the
        // cadence reads as "no cadence", not "the default one".
        value: cadenceLabel(limits.cadenceSec, t),
        step: "02",
      },
      {
        label: t("review_row_max_position"),
        value: `$${limits.positionUsd.toLocaleString("en-US")}`,
        step: "02",
      },
      {
        label: t("review_row_trades_per_cycle"),
        value: String(limits.tradesPerCycle),
        step: "02",
      },
      {
        label: t("review_row_take_profit"),
        value: `+${limits.exits.takeProfitPct}%`,
        tone: "accent" as const,
        step: "02",
      },
      {
        label: t("review_row_stop_loss"),
        value: `−${limits.exits.stopLossPct}%`,
        tone: "negative" as const,
        step: "02",
      },
      {
        label: t("review_row_compliance"),
        value: t(
          limits.complianceProfile === "shariah"
            ? "review_compliance_shariah"
            : "review_compliance_none",
        ),
        step: "02",
      },
      // Step 01, not a step of its own: the venue came with the market.
      { label: t("review_row_routing"), value: venues, step: "01" },
      { label: t("review_row_model"), value: model.label, step: "03" },
      // Only when there is a bill to state. A Canopy agent has no budget row
      // because it has no budget — it has an inclusion.
      ...(model.provider === "pod"
        ? [
            {
              label: t("review_row_model_budget"),
              value: t("review_row_model_budget_value", {
                amount: money(model.intendedTopUpUsd ?? 0),
              }),
              step: "03",
            },
          ]
        : []),
    ];
  }

  // Neither layout renders against a guess at the viewport.
  if (mobile === null) return null;

  /* The funding step, once the agent exists and before the builder is left.
     Mounted here rather than inside either layout: both reach it, and it is one
     column at any width. The builder behind it is finished — every field is
     frozen into the deployed agent by this point — which is why replacing it
     rather than layering over it costs nothing.

     NOT ModelPanel any more. That is the owner's standing panel for a running
     agent, and pointed at one four seconds old it opened on a $0.00 balance, a
     $0.00 spend and an "Out of model balance" WARNING — telling someone who had
     just finished building an agent that it was broken. FundNewAgent says the
     two things that are actually true here instead, and shows both of them at
     once rather than revealing the second after the first is signed. */
  if (funding) {
    return (
      <FundNewAgent
        agentId={funding.agentId}
        agentName={name.trim() || t("build_untitled")}
        model={model}
        agentWallet={funding.wallet}
        personalWallet={personalWallet}
        // The order book this agent will trade, or nothing.
        //
        // Read from the markets actually picked rather than from a venue
        // choice, because there is no venue choice: picking a PhantX row IS
        // picking PhantX. An agent with no CLOB market needs no CLOB
        // delegation and is not asked for one.
        clobVenue={clobVenueOf(markets)}
        // Re-read after the grant lands, so step two unlocks in place without
        // the owner reopening anything.
        onWalletGranted={() => void refreshFunding(funding.agentId)}
        // Leaving is allowed and is not an abandonment. The agent is real and
        // scheduled either way — it waits, and the page it lands on says so and
        // offers the same steps again.
        onLeave={() => leaveFunding(funding.agentId)}
      />
    );
  }

  if (mobile) {
    if (!named) {
      return (
        <BuildName
          value={name}
          onChange={setName}
          onConfirm={() => name.trim() && setNamed(true)}
          onCancel={() => router.replace(lastRoute())}
        />
      );
    }

    if (reviewing || pending) {
      return (
        <BuildReview
          name={name}
          rows={reviewRows()}
          onEditName={() => setNamed(false)}
          onBack={() => {
            setReviewing(false);
            // A held-back strategy already exists. Going back to edit must not
            // leave it pending, or confirming later would start a stale plan.
            setPending(null);
          }}
          busy={busy}
          error={error}
          warnings={pending?.warnings ?? []}
          onStart={() => void (pending ? confirmPending() : submit())}
        />
      );
    }

    const stepCta =
      step === 0
        ? {
            label: t("build_cta_limits"),
            hint: t("build_cta_limits_hint"),
            disabled: markets.length === 0,
            onClick: () => setStep(1),
          }
        : step === 1
          ? {
              label: t("build_cta_model"),
              hint: t("build_cta_model_hint"),
              disabled: activeRules.length === 0,
              onClick: () => setStep(2),
            }
          : {
              label: t("build_cta_review"),
              hint: t("build_cta_review_hint"),
              disabled: activeRules.length === 0,
              onClick: () => setReviewing(true),
            };

    return (
      <BuildFrame
        step={step + 1}
        steps={STEPS.length}
        title={t("build_title")}
        onBack={() => (step === 0 ? setNamed(false) : setStep(step - 1))}
        cta={<BuildCta {...stepCta} />}
      >
        <div className="px-[18px] pb-6">
          {/* `!asset` is a fallback for a step past 1 with nothing picked —
              which USED to be impossible and now is not: a strategy can be
              built entirely from a screen. Without `|| discovery` in the test,
              such a build lands back on step 1 the moment it leaves it. */}
          {step === 0 || (!asset && !discovery) ? (
            <PickMarket
              value={markets}
              onChange={onMarketsChange}
              discovery={discovery}
              onDiscoveryChange={onDiscoveryChange}
              onNext={() => setStep(1)}
            />
          ) : step === 1 ? (
            <SetLimits
              markets={markets}
              discovery={discovery}
              value={limits}
              onChange={setLimits}
              onBack={() => setStep(0)}
            />
          ) : (
            <PickModel
              value={model}
              onChange={setModel}
              cadenceSec={limits.cadenceSec}
              isPaper
              onBack={() => setStep(1)}
            />
          )}
        </div>
      </BuildFrame>
    );
  }

  if (!named) {
    return (
      <NameAgentModal
        onConfirm={(n) => {
          setName(n);
          setNamed(true);
        }}
        // Back where they were, not to a page they never asked for. `replace`
        // rather than `push` so the builder does not sit in history — pressing
        // Back after cancelling must not reopen the naming modal.
        onCancel={() => router.replace(lastRoute())}
      />
    );
  }

  return (
    <main>
      {/* WHAT USED TO BE HERE: the lifecycle bar — 01 Draft · configure,
          02 Paper run, 03 Published.
          
          It described where this agent sits in a lifecycle that has not started:
          two of its three stages are things that happen after the builder is
          finished, and the one it was on is the whole page. So it spent the top
          of the screen telling somebody the step they are already looking at,
          above a wizard with its own step numbers — two counters disagreeing
          about what "01" means.
          
          The publish page still shows it, where the stages are a real position
          in a real sequence. */}
      <section className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-grid px-5 sm:px-8 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            {t("build_new_draft")}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (!name.trim()) setName(t("build_untitled"));
            }}
            spellCheck={false}
            aria-label={t("build_name_aria")}
            className="w-[220px] border-b border-transparent bg-transparent pb-0.5 font-mono text-[14px] text-text-primary outline-none transition-colors hover:border-grid-strong focus:border-accent"
          />
        </div>

        <nav
          aria-label={t("build_steps_aria")}
          className="flex shrink-0 items-center gap-0.5 rounded-full border border-grid p-1"
        >
          {STEPS.map((s, i) => (
            <button
              key={s.index}
              type="button"
              aria-current={i === step ? "step" : undefined}
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex h-7 items-center gap-2 rounded-full px-3.5 transition-colors ${
                i === step
                  ? "bg-accent-wash text-accent"
                  : i < step
                    ? "text-text-secondary hover:text-text-primary"
                    : "cursor-default text-text-muted"
              }`}
            >
              <span className="tnum font-mono text-[9.5px] opacity-70">
                {s.index}
              </span>
              <span className="font-mono text-[11.5px] tracking-[0.04em]">
                {t(s.labelKey)}
              </span>
            </button>
          ))}
        </nav>
      </section>

      <Columns
        main={
          <div className="px-5 sm:px-8 py-8">
            {step === 0 || (!asset && !discovery) ? (
              <PickMarket
                value={markets}
                onChange={onMarketsChange}
                discovery={discovery}
                onDiscoveryChange={onDiscoveryChange}
                onNext={() => setStep(1)}
              />
            ) : step === 1 ? (
              <SetLimits
                markets={markets}
                discovery={discovery}
                value={limits}
                onChange={setLimits}
                onBack={() => setStep(0)}
              />
            ) : (
              // `isPaper` is unconditionally true: this wizard only ever ends in
              // a paper run. Going live is a later, separate decision, and by
              // then the agent has a wallet of its own to pay from.
              <PickModel
                value={model}
                onChange={setModel}
                cadenceSec={limits.cadenceSec}
                isPaper
                onBack={() => setStep(1)}
              />
            )}
          </div>
        }
        rail={
          <>
            {/* "Your agent so far", per the wireframe: what has been decided
                stays visible while the next thing is being decided. */}
            <div className="border-b border-grid px-5 sm:px-8 py-7">
              <h3 className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                {t("build_so_far")}
              </h3>
              <Trail
                // A screen answers this step as completely as a pick does, so
                // the rail must count it as answered — otherwise a
                // discovery-only build shows step 1 as unfinished for the rest
                // of the flow.
                done={step > 0 && (!!asset || !!discovery)}
                here={step === 0}
                label={t("build_trail_market")}
                value={
                  markets.length === 0
                    ? discovery
                      ? t("dsc_title")
                      : t("build_trail_this_step")
                    : markets.length === 1
                      ? `${markets[0].symbol}/USDC`
                      : t("build_trail_markets", { count: markets.length })
                }
              />
              <Trail
                done={step > 1}
                here={step === 1}
                label={t("build_trail_strategy")}
                value={
                  step === 0
                    ? t("build_trail_next")
                    : t(
                        activeRules.length === 1
                          ? step === 1
                            ? "build_trail_rule_one_here"
                            : "build_trail_rule_one"
                          : step === 1
                            ? "build_trail_rule_many_here"
                            : "build_trail_rule_many",
                        { count: activeRules.length },
                      )
                }
              />
              <Trail
                done={false}
                here={step === 2}
                label={t("build_step_model")}
                value={
                  step < 2
                    ? t("build_trail_next")
                    : step === 2
                      ? `${model.label} · ${t("build_trail_this_step")}`
                      : model.label
                }
              />
              <Trail
                done={false}
                label={t("build_trail_paper")}
                value={t("build_trail_paper_value")}
              />
              <Trail
                done={false}
                label={t("build_trail_publish")}
                value={t("build_trail_publish_value")}
              />

              {step >= 1 ? (
                <div className="mt-5 space-y-1.5 border-t border-grid pt-4">
                  <Row
                    label={t("build_row_position_cap")}
                    value={money(limits.positionUsd)}
                    tone="accent"
                  />
                  <Row
                    label={t("build_row_per_cycle")}
                    value={t("build_row_trades", {
                      count: limits.tradesPerCycle,
                    })}
                  />
                  <Row
                    label={t("build_row_exits")}
                    value={t("build_row_exits_value", {
                      tp: limits.exits.takeProfitPct,
                      sl: limits.exits.stopLossPct,
                    })}
                  />
                  <Row
                    label={t("build_row_paper_book")}
                    value={money(CAPITAL_USD)}
                  />
                  {/* Where it fills. Stated, not chosen — the market settled
                      it back in step 1, and a row is what that deserves. */}
                  <Row label={t("build_row_routes_via")} value={venues} />
                  {step >= 2 ? (
                    <Row
                      label={t("build_row_reasons_with")}
                      value={model.label}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="px-5 sm:px-8 py-7">
              <div className="flex items-center justify-between pb-4">
                <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                  {t("wiz_proceed")}
                </h3>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {t("wiz_step_of", { step: step + 1, total: STEPS.length })}
                </span>
              </div>

              {error ? (
                <div className="mb-4">
                  <Callout tone="negative" icon={<WarnIcon />}>
                    {error}
                  </Callout>
                </div>
              ) : null}

              {pending ? (
                <div className="mb-4 space-y-3">
                  <Callout tone="negative" icon={<WarnIcon />}>
                    <span className="block pb-1.5 font-mono text-[10px] tracking-[0.14em] uppercase">
                      {t("build_check_plan")}
                    </span>
                    <ul className="space-y-1">
                      {pending.warnings.map((w) => (
                        <li
                          key={w}
                          className="font-ui text-[12.5px] leading-relaxed"
                        >
                          {w}
                        </li>
                      ))}
                    </ul>
                    <span className="block pt-2 font-ui text-[12px] leading-relaxed opacity-80">
                      {t("build_draft_saved")}
                    </span>
                  </Callout>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={confirmPending}
                      className="h-9 rounded-full border border-grid px-4 font-mono text-[10px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:text-text-primary disabled:opacity-40"
                    >
                      {t("build_start_anyway")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        // Back to the limits step with the plan intact. The
                        // draft stays on the server; editing and submitting
                        // again creates a new one, which is the same thing
                        // every other abandoned draft in this flow does.
                        setPending(null);
                        setStep(1);
                      }}
                      className="h-9 rounded-full border border-accent px-4 font-mono text-[10px] tracking-[0.08em] text-accent uppercase transition-colors disabled:opacity-40"
                    >
                      {t("build_go_back_edit")}
                    </button>
                  </div>
                </div>
              ) : null}

              {step === 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={markets.length === 0}
                    className="flex h-14 w-full items-center justify-center border border-accent bg-accent-wash font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
                  >
                    {t("build_continue_limits")}
                  </button>
                  {markets.length === 0 ? (
                    <p className="pt-3 text-center font-mono text-[10.5px] tracking-[0.08em] text-warning uppercase">
                      {t("build_pick_market_first")}
                    </p>
                  ) : null}
                </>
              ) : step === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={activeRules.length === 0}
                    className="flex h-14 w-full items-center justify-center border border-accent bg-accent-wash font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
                  >
                    Continue to model
                  </button>
                  {activeRules.length === 0 ? (
                    // A strategy with no active rule buys nothing, ever — so the
                    // gate sits here, one step before the run it would have made
                    // pointless.
                    <p className="pt-3 text-center font-mono text-[10.5px] tracking-[0.08em] text-warning uppercase">
                      Turn on at least one rule
                    </p>
                  ) : null}
                </>
              ) : ready && !authenticated ? (
                <button
                  type="button"
                  onClick={login}
                  className="flex h-14 w-full items-center justify-center border border-accent bg-accent-wash font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
                >
                  {t("build_sign_in_to_start")}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy || !ready || activeRules.length === 0}
                    className="flex h-14 w-full items-center justify-center border border-accent bg-accent-wash font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
                  >
                    {t(busy ? "build_starting" : "build_run_paper")}
                  </button>
                  {activeRules.length === 0 ? (
                    // A strategy with no active rule buys nothing, ever — and
                    // this is the last place to say so before the run that
                    // would have proved it.
                    <p className="pt-3 text-center font-mono text-[10.5px] tracking-[0.08em] text-warning uppercase">
                      {t("build_turn_on_rule")}
                    </p>
                  ) : null}
                </>
              )}

              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="mt-3 flex h-11 w-full items-center justify-center border border-border font-mono text-[11px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:text-text-primary"
                >
                  {t("build_back_to", { step: t(STEPS[step - 1].labelKey) })}
                </button>
              ) : null}

              <p className="pt-5 font-ui text-[12.5px] leading-relaxed text-text-secondary">
                {t("build_paper_note")}
              </p>
            </div>
          </>
        }
      />
    </main>
  );
}

/* -------------------------------------------------------------------- bits -- */

function Trail({
  done,
  here,
  label,
  value,
}: {
  done: boolean;
  here?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline gap-3 border-b border-grid py-2.5 last:border-b-0">
      <span
        className={`w-3 shrink-0 text-center font-mono text-[11px] ${
          done || here ? "text-accent" : "text-text-muted"
        }`}
      >
        {done ? "✓" : here ? "→" : "○"}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate font-mono text-[11.5px] ${
            here || done ? "text-text-primary" : "text-text-dim"
          }`}
        >
          {label}
        </span>
        <span className="block truncate font-ui text-[11px] text-text-dim">
          {value}
        </span>
      </span>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
        {label}
      </span>
      <span
        className={`truncate font-mono text-[12px] ${
          tone === "accent" ? "text-accent" : "text-text-primary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
