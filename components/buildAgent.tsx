"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Callout, CheckIcon, Columns, WarnIcon } from "@/components/ui";
import { PRIMARY, QUIET, Spinner } from "@/components/kit";
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
import { useIsMobile } from "@/lib/useIsMobile";
import { lastRoute } from "@/components/routeMemory";
import { PickMarket } from "@/components/pickMarket";
import { DEFAULT_RISK_CAPS,
  CAPITAL_USD,
  RWA_RULES,
  SetLimits,
  defaultPerp,
  perpLiquidationDistancePct,
  perpPayload,
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

const DRAFT_KEY = "canopy_build_draft_v1";

interface Draft {
  /** 2 added `instrument`. A v1 draft reads as spot, which is all it could be. */
  v: 1 | 2;
  savedAt: number;
  name: string;
  named: boolean;
  step: number;
  instrument?: "spot" | "perp";
  markets: UniverseAsset[];
  discovery: DiscoverySpec | undefined;
  limits: Limits;
  model: ModelChoice;
}

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
  // The guardrails, visible from the first render rather than applied
  // silently at deploy. Same figures the lifecycle falls back to.
  riskCaps: DEFAULT_RISK_CAPS,
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
  /**
   * WHY THE NAME IS NOT ASKED FIRST. People name things after they know what
   * they are. The builder used to open on a modal with one empty field, before
   * a market or a rule had been seen — a wall, and Cancel threw you back to
   * wherever you came from. Now it opens on step 1 with the name editable in
   * the header, and when the model step is reached with the field still empty,
   * a name is suggested from the choice ("SOL agent"), where changing it costs
   * one edit rather than a decision. `named` only remains for the mobile
   * "edit name" screen.
   */
  const [named, setNamed] = useState(true);
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
  // Spot or perps. Step 01's first control; kept here because the draft
  // persists it and step 02 reads it.
  const [instrument, setInstrument] = useState<"spot" | "perp">("spot");
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
  /**
   * THE RUN HAS STAGES, AND THE BUTTON SAYS WHICH. "Starting…" used to cover
   * two requests and a possible warnings round-trip. Now: saving the strategy,
   * then starting the run, then a short frame that says the agent is on paper
   * before the workspace (or the funding steps) take over.
   */
  const [stage, setStage] = useState<"saving" | "starting" | null>(null);
  const [launched, setLaunched] = useState<{ name: string; next: () => void; funding: boolean } | null>(null);
  useEffect(() => {
    if (!launched) return;
    const id = setTimeout(launched.next, 1_300);
    return () => clearTimeout(id);
  }, [launched]);
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

  /* ------------------------------------------------------------- drafts --
     Everything above is component state, which is to say it lived exactly as
     long as the tab. A refresh at step 3 threw away ten minutes of work and
     the header said "New draft" over a page that never saved one.

     The draft is a snapshot in localStorage, written a beat after any change
     and read back once on mount. Restoring is silent and complete — the page
     opens where it was left, with one quiet line saying so and a way to start
     over — because asking "resume?" is a question with only one sensible
     answer. Cleared the moment a run actually starts, so a finished agent
     never comes back as an unfinished draft. */
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  /**
   * THE NAMING MOMENT. A fresh builder opens on one large field with the caret
   * already in it, and the market step sits beneath, dimmed. Pressing Enter
   * hands the name up to the header and brings the picker into focus — so the
   * first thing asked is the name, without a modal between the reader and the
   * page. "open" is the field; "leaving" is its 200ms exit; "done" is the
   * ordinary builder. `null` until the draft has been read, so a resumed draft
   * never flashes the field.
   */
  const [naming, setNaming] = useState<"open" | "leaving" | "done" | null>(null);
  const [saved, setSaved] = useState(false);
  const hydrated = useRef(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (d && (d.v === 1 || d.v === 2)) {
          setName(d.name ?? "");
          setNamed(!!d.named);
          setStep(d.step ?? 0);
          setInstrument(d.instrument ?? "spot");
          setMarkets(d.markets ?? []);
          setDiscovery(d.discovery);
          setLimits(d.limits ?? DEFAULT_LIMITS);
          setModel(d.model ?? DEFAULT_MODEL);
          if ((d.name ?? "").trim() !== "" || (d.markets ?? []).length > 0 || d.discovery) {
            setRestoredAt(d.savedAt);
            setNaming("done");
          }
        }
      }
    } catch {
      /* a corrupt draft is dropped, not fatal */
    }
    hydrated.current = true;
    setNaming((n) => n ?? "open");
  }, []);

  /**
   * MOVING BETWEEN STEPS. Pressing Continue used to swap one form for another
   * in the same frame, with the reader left wherever a long limits step had
   * scrolled them. Now the direction is remembered, the new step slides in
   * 12px from the side it came from (see `.step-enter-*`), and the column
   * starts at the top.
   */
  const dir = useRef<"fwd" | "back">("fwd");
  function goTo(next: number): void {
    if (next === step) return;
    dir.current = next > step ? "fwd" : "back";
    setStep(next);
    if (typeof window !== "undefined" && window.scrollY > 0) window.scrollTo({ top: 0 });
  }

  /** The field hands over: it slides up and out, then the picker takes focus. */
  function commitName(): void {
    if (naming !== "open") return;
    setNaming("leaving");
    setTimeout(() => {
      setNaming("done");
      requestAnimationFrame(() =>
        document.querySelector<HTMLInputElement>("[data-market-search]")?.focus(),
      );
    }, 220);
  }

  const dirty = name.trim() !== "" || markets.length > 0 || !!discovery;

  useEffect(() => {
    if (!hydrated.current) return;
    if (!dirty) return;
    const id = setTimeout(() => {
      try {
        const d: Draft = { v: 2, savedAt: Date.now(), name, named, step, instrument, markets, discovery, limits, model };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
        setSaved(true);
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaved(false), 1500);
      } catch {
        /* storage full or blocked — the page still works, it just forgets */
      }
    }, 400);
    return () => clearTimeout(id);
  }, [dirty, name, named, step, instrument, markets, discovery, limits, model]);

  // Leaving with an unfinished draft asks first. The draft is saved
  // either way; this is for the tab closed by accident mid-sentence.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!dirty || funding) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty, funding]);

  // The name, suggested once the agent is a thing: on reaching the model step
  // with the field still empty, from the market picked (or the screen).
  useEffect(() => {
    if (step !== 2 || name.trim() !== "") return;
    if (markets.length === 1) setName(t("build_name_suggest_one", { symbol: markets[0].symbol }));
    else if (markets.length > 1) {
      setName(t("build_name_suggest_many", { symbol: markets[0].symbol, count: markets.length - 1 }));
    } else if (discovery) setName(t("build_name_suggest_screen"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function clearDraft(): void {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* nothing to clear */
    }
  }

  function startFresh(): void {
    clearDraft();
    setRestoredAt(null);
    setName("");
    setNamed(false);
    setStep(0);
    setInstrument("spot");
    setMarkets([]);
    setDiscovery(undefined);
    setLimits(DEFAULT_LIMITS);
    setModel(DEFAULT_MODEL);
    setPending(null);
    setError(null);
    setNaming("open");
  }

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
    setStage("starting");
    const { agentId } = await startPaperRun(token, strategyId);
    // The agent exists. Whatever happens next, this draft is done.
    clearDraft();
    setStage(null);
    const agentName = name.trim() || t("build_untitled");

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
      // The confirmation frame first, then the funding steps slide in.
      setLaunched({ name: agentName, funding: true, next: () => setFunding({ agentId, wallet }) });
      return;
    }

    setLaunched({
      name: agentName,
      funding: false,
      next: () => router.push(`/workspace/${agentId}?tab=overview`),
    });
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
      setStage(null);
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

      setStage("saving");
      const { strategy, warnings } = await createStrategy(token, {
        name: name.trim() || t("build_untitled"),
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
          // The execution bid from the guardrails card. Omitted means auto.
          ...(limits.priorityFee ? { priorityFee: limits.priorityFee } : {}),
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
        // The guardrails card. Sent whole, nulls included, because null is
        // "off" and absence would be read as "never chose".
        riskCaps: limits.riskCaps,
        // Only meaningful across several markets — a top-3 of one asset is that
        // asset. Sent regardless when set, because the engine treats a ranking
        // wider than the universe as a no-op rather than an error.
        ranking: limits.ranking,
        // Only on a perp market. The short side's rules are sent as written;
        // the backend checks them against the same catalogue as the long side.
        ...(instrument === "perp" && limits.perp ? { perp: perpPayload(limits.perp) } : {}),
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
      setStage(null);
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
   * Switching instrument drops the pick and the screen — a SOL spot pick is
   * not a SOL-PERP pick — and gives the limits a perp block or takes it away.
   * The name, the model and every other limit carry over.
   */
  function onInstrumentChange(next: "spot" | "perp"): void {
    if (next === instrument) return;
    setInstrument(next);
    syncRulesTo([], undefined, next);
    setMarkets([]);
    setDiscovery(undefined);
    setLimits((l) => {
      if (next === "perp") {
        return { ...l, perp: l.perp ?? defaultPerp() };
      }
      const { perp: _dropped, ...rest } = l;
      return rest;
    });
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
    instr: "spot" | "perp" = instrument,
  ): void {
    type Cls = "rwa" | "spot" | "perp";
    const withScreen = (cs: Cls[], on: boolean): Cls[] =>
      on ? [...new Set<Cls>([...cs, "spot"])] : cs;
    // A perp market adds the perp-only readings to the catalogue.
    const withPerp = (cs: Cls[], on: boolean): Cls[] => (on ? [...new Set<Cls>([...cs, "perp"])] : cs);
    const beforeAll = withPerp(withScreen(classesIn(markets), Boolean(discovery)), instrument === "perp");
    const afterAll = withPerp(withScreen(classes, Boolean(spec)), instr === "perp");
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
      // The perp rows, only on a perp market. Direction, leverage with the
      // liquidation distance, what leaves the wallet against what the venue
      // opens, and what an opposite signal does — the four facts a person
      // must not discover after deploying.
      ...(instrument === "perp" && limits.perp
        ? (() => {
            const p = limits.perp;
            const shortOn = p.shortEnabled && p.shortRules.some((r) => r.enabled !== false);
            const liq = perpLiquidationDistancePct(p.leverage, markets[0]?.perp);
            return [
              {
                label: t("review_row_direction"),
                value: t(
                  p.longEnabled && shortOn
                    ? "review_direction_both"
                    : shortOn
                      ? "review_direction_short"
                      : "review_direction_long",
                ),
                step: "02",
              },
              {
                label: t("review_row_leverage"),
                value: t("review_leverage_value", { lev: p.leverage, pct: liq.toFixed(1) }),
                tone: p.leverage > 20 ? ("negative" as const) : undefined,
                step: "02",
              },
              {
                label: t("review_row_collateral"),
                value: t("review_collateral_value", {
                  collateral: money(limits.positionUsd),
                  notional: money(limits.positionUsd * p.leverage),
                }),
                step: "02",
              },
              {
                label: t("review_row_opposite"),
                value: t(
                  p.onOppositeSignal === "hold"
                    ? "review_opposite_hold"
                    : p.onOppositeSignal === "flip"
                      ? "review_opposite_flip"
                      : "review_opposite_close",
                ),
                step: "02",
              },
            ];
          })()
        : []),
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
  if (launched) {
    // The moment between "pressed" and "somewhere else": the agent named, a
    // tick, and where it is going next. Long enough to read, not to wait for.
    return (
      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-6">
        <div className="reveal-in flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent text-bg">
            <CheckIcon className="size-5" />
          </span>
          <h1 className="mt-5 font-ui text-[24px] font-medium tracking-[-0.01em] text-text-primary">
            {t("build_launched", { name: launched.name })}
          </h1>
          <p className="mt-2 font-ui text-[13px] text-text-secondary">
            {t(launched.funding ? "build_launched_fund" : "build_launched_next")}
          </p>
        </div>
      </main>
    );
  }

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
          onCancel={() => setNamed(true)}
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
        onBack={() => (step === 0 ? router.replace(lastRoute()) : setStep(step - 1))}
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
              instrument={instrument}
              onInstrumentChange={onInstrumentChange}
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
          <span className="shrink-0 font-ui text-[12.5px] text-text-muted">{t("build_new_draft")}</span>
          {/* Arrives from the naming field below; until then the header has
              no second field competing with it. */}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("build_name_placeholder")}
            spellCheck={false}
            aria-label={t("build_name_aria")}
            tabIndex={naming === "done" ? undefined : -1}
            className={`w-[240px] border-b border-transparent bg-transparent pb-0.5 font-ui text-[14px] pointer-coarse:text-[16px] font-medium text-text-primary outline-none transition-[opacity,border-color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] placeholder:font-normal placeholder:text-text-dim hover:border-grid-strong focus:border-accent ${
              naming === "done" ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />
          {/* Appears for a beat after each snapshot, then goes. A standing
              "Saved" is furniture; one that arrives when it is true is a fact. */}
          <span
            aria-live="polite"
            className={`font-ui text-[11.5px] text-text-muted transition-opacity duration-300 ${
              saved ? "opacity-100" : "opacity-0"
            }`}
          >
            {t("build_saved")}
          </span>
        </div>

        <StepPill
          step={step}
          labels={STEPS.map((s) => ({ index: s.index, label: t(s.labelKey) }))}
          onSelect={goTo}
          ariaLabel={t("build_steps_aria")}
        />
      </section>

      {restoredAt !== null ? (
        <div className="flex items-center gap-4 border-b border-grid px-5 py-2.5 sm:px-8">
          <p className="font-ui text-[12.5px] text-text-secondary">{t("build_resumed")}</p>
          <button
            type="button"
            onClick={startFresh}
            className="font-ui text-[12.5px] text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline"
          >
            {t("build_start_fresh")}
          </button>
        </div>
      ) : null}

      <Columns
        main={
          <div className="flex min-h-[calc(100vh-64px-53px)] flex-col">
          <div className="flex-1 px-5 sm:px-8 py-8">
          <div
            key={step}
            className={dir.current === "back" ? "step-enter-back" : "step-enter-fwd"}
          >
            {step === 0 && naming !== null && naming !== "done" ? (
              <div
                className={`mb-10 transition-[opacity,transform] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${
                  naming === "leaving" ? "-translate-y-2 opacity-0" : ""
                }`}
              >
                <p className="font-ui text-[12.5px] text-text-muted">{t("build_name_eyebrow")}</p>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitName();
                    }
                  }}
                  placeholder={t("build_name_placeholder")}
                  spellCheck={false}
                  aria-label={t("build_name_aria")}
                  className="mt-2 w-full max-w-[26ch] border-b border-grid-strong bg-transparent pb-2 font-ui text-[32px] font-light leading-tight tracking-[-0.02em] text-text-primary outline-none transition-colors placeholder:text-text-dim focus:border-accent"
                />
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
                  <span className="font-ui text-[12.5px] text-text-muted">{t("build_name_help")}</span>
                  <button type="button" onClick={commitName} className={QUIET}>
                    {t("build_name_later")}
                  </button>
                </div>
              </div>
            ) : null}
            {step === 0 || (!asset && !discovery) ? (
              <div
                aria-hidden={naming !== "done"}
                className={`transition-[opacity,transform] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${
                  naming === "done" ? "" : "pointer-events-none translate-y-3 select-none opacity-30"
                }`}
              >
                <PickMarket
                  value={markets}
                  onChange={onMarketsChange}
                  discovery={discovery}
                  onDiscoveryChange={onDiscoveryChange}
                  instrument={instrument}
                  onInstrumentChange={onInstrumentChange}
                />
              </div>
            ) : step === 1 ? (
              <SetLimits
                markets={markets}
                discovery={discovery}
                value={limits}
                onChange={setLimits}
                onBack={() => goTo(0)}
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
              />
            )}
          </div>
          </div>

          {/* Anything in the way of the next press sits right above it. */}
          {error || pending ? (
            <div className="space-y-3 px-5 pb-5 sm:px-8">
              {error ? (
                <Callout tone="negative" icon={<WarnIcon />}>
                  {error}
                </Callout>
              ) : null}
              {pending ? (
                // Advice, not an error: the amber tone. "Go back" is the
                // primary because the warnings exist to be read; starting
                // anyway is the quiet way past them.
                <Callout tone="warning" icon={<WarnIcon />} title={t("build_check_plan")}>
                  <ul className="space-y-1">
                    {pending.warnings.map((w) => (
                      <li key={w} className="font-ui text-[12.5px] leading-relaxed">
                        {w}
                      </li>
                    ))}
                  </ul>
                  <span className="block pt-2 font-ui text-[12px] leading-relaxed opacity-80">
                    {t("build_draft_saved")}
                  </span>
                  <div className="flex flex-wrap items-center gap-4 pt-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        // Back to the limits step with the plan intact. The
                        // draft stays on the server; editing and submitting
                        // again creates a new one, which is the same thing
                        // every other abandoned draft in this flow does.
                        setPending(null);
                        goTo(1);
                      }}
                      className={`${PRIMARY} px-4`}
                    >
                      {t("build_go_back_edit")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={confirmPending}
                      className={QUIET}
                    >
                      {t("build_start_anyway")}
                    </button>
                  </div>
                </Callout>
              ) : null}
            </div>
          ) : null}

          {/* THE PRIMARY ACTION, UNDER THE CONTENT. It used to live in the
              right rail, 800px from the list it acts on, with the gate spelled
              out in amber uppercase beneath it — a hint styled as a warning, so
              the page opened looking like something had already gone wrong.
              Now: a footer that stays in view, Back quiet on the left, one
              white pill on the right, and the gate is the pill's own label. */}
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-grid bg-bg/85 px-5 py-3.5 backdrop-blur-md sm:px-8">
            <div className="flex items-center gap-5">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setPending(null);
                    goTo(step - 1);
                  }}
                  className={QUIET}
                >
                  ← {t("build_back_to", { step: t(STEPS[step - 1].labelKey) })}
                </button>
              ) : (
                <button
                  type="button"
                  // Back where they were, not to a page they never asked for.
                  // `replace` so the builder does not sit in history.
                  onClick={() => router.replace(lastRoute())}
                  className={QUIET}
                >
                  ← {t("common_cancel")}
                </button>
              )}
              <span className="font-ui text-[12.5px] text-text-muted">
                {t("wiz_step_of", { step: step + 1, total: STEPS.length })}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {step === 2 ? (
                <span className="hidden font-ui text-[12.5px] text-text-muted md:inline">
                  {t("build_paper_note_short")}
                </span>
              ) : null}
              {step === 0 && naming !== "done" ? (
                // The one pill commits the name while the field is the page.
                <button
                  type="button"
                  onClick={commitName}
                  disabled={name.trim() === "" || naming !== "open"}
                  className={`${PRIMARY} px-5`}
                >
                  {t(name.trim() === "" ? "build_name_first" : "build_name_continue")}
                </button>
              ) : step === 0 ? (
                <button
                  type="button"
                  onClick={() => goTo(1)}
                  disabled={markets.length === 0 && !discovery}
                  className={`${PRIMARY} px-5`}
                >
                  {t(markets.length === 0 && !discovery ? "build_pick_market_first" : "build_continue_limits")}
                </button>
              ) : step === 1 ? (
                <button
                  type="button"
                  onClick={() => goTo(2)}
                  // A strategy with no active rule buys nothing, ever — so the
                  // gate sits here, one step before the run it would make
                  // pointless.
                  disabled={activeRules.length === 0}
                  className={`${PRIMARY} px-5`}
                >
                  {t(activeRules.length === 0 ? "build_turn_on_rule" : "build_continue_model")}
                </button>
              ) : ready && !authenticated ? (
                <button type="button" onClick={login} className={`${PRIMARY} px-5`}>
                  {t("build_sign_in_to_start")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || !ready || !!pending || activeRules.length === 0}
                  className={`${PRIMARY} px-5`}
                >
                  {busy ? <Spinner className="mr-2" /> : null}
                  {t(
                    stage === "saving"
                      ? "build_stage_saving"
                      : stage === "starting"
                        ? "build_stage_starting"
                        : busy
                          ? "build_starting"
                          : activeRules.length === 0
                            ? "build_turn_on_rule"
                            : "build_run_paper",
                  )}
                </button>
              )}
            </div>
          </div>
          </div>
        }
        rail={
          <>
            {/* "Your agent so far", per the wireframe: what has been decided
                stays visible while the next thing is being decided. */}
            <div className="px-5 sm:px-8 py-7">
              <h3 className="pb-4 font-ui text-[13px] font-medium text-text-primary">{t("build_so_far")}</h3>
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

              {step >= 1 ? (
                <div className="mt-5 space-y-2 border-t border-grid pt-4">
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

          </>
        }
      />
    </main>
  );
}

/* -------------------------------------------------------------------- bits -- */

/**
 * The step pill. One fill, gliding.
 *
 * Three segments and one active fill that MOVES between them rather than
 * appearing on the next one — the same fill the reader just saw, arriving
 * where they are going. Measured from the buttons so a longer label in the
 * other language is simply a wider fill. Selecting a step is not committing to
 * anything, so the fill is a surface, not green.
 */
function StepPill({
  step,
  labels,
  onSelect,
  ariaLabel,
}: {
  step: number;
  labels: { index: string; label: string }[];
  onSelect: (i: number) => void;
  ariaLabel: string;
}) {
  const nav = useRef<HTMLElement | null>(null);
  const [fill, setFill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const root = nav.current;
      const btn = root?.querySelectorAll<HTMLButtonElement>("button")[step];
      if (!root || !btn) return;
      const r = root.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      setFill({ left: b.left - r.left, width: b.width });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [step, labels]);

  return (
    <nav
      ref={nav}
      aria-label={ariaLabel}
      className="relative flex shrink-0 items-center gap-0.5 rounded-full border border-grid p-1"
    >
      {fill ? (
        <span
          aria-hidden
          className="absolute top-1 h-7 rounded-full bg-surface-2 transition-[left,width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
          style={{ left: fill.left, width: fill.width }}
        />
      ) : null}
      {labels.map((s, i) => (
        <button
          key={s.index}
          type="button"
          aria-current={i === step ? "step" : undefined}
          onClick={() => i < step && onSelect(i)}
          disabled={i > step}
          className={`relative z-10 flex h-7 items-center gap-2 rounded-full px-3.5 transition-colors duration-300 ${
            i === step
              ? "text-text-primary"
              : i < step
                ? "text-text-secondary hover:text-text-primary"
                : "cursor-default text-text-muted"
          }`}
        >
          <span className="tnum font-mono text-[10px] opacity-70">{s.index}</span>
          <span className="font-ui text-[12.5px] font-medium">{s.label}</span>
        </button>
      ))}
    </nav>
  );
}

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
  // The line pulses once when its text changes: a wash that rises and fades
  // over 600ms, so a pick made 800px away registers here without a glance.

  return (
    <div className="flex items-baseline gap-3 border-b border-grid py-3 last:border-b-0">
      <span
        className={`w-3 shrink-0 text-center font-mono text-[11px] ${
          done ? "text-accent" : here ? "text-text-primary" : "text-text-muted"
        }`}
      >
        {done ? "✓" : here ? "→" : "○"}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate font-ui text-[13px] ${
            here || done ? "text-text-primary" : "text-text-dim"
          }`}
        >
          {label}
        </span>
        <span key={value} className="trail-pulse -mx-1.5 block truncate rounded-md px-1.5 font-ui text-[12px] text-text-dim">
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
      <span className="font-ui text-[12.5px] text-text-muted">{label}</span>
      <span className={`tnum truncate font-mono text-[12.5px] ${tone === "accent" ? "font-medium" : ""} text-text-primary`}>
        {value}
      </span>
    </div>
  );
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
