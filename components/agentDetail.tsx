"use client";

import Link from "next/link";
import { tokenPrice } from "@/lib/format";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ActivityLog } from "@/components/activity";
import { Positions } from "@/components/positions";
import { LpPositions } from "@/components/lpPositions";
import { GridLadder } from "@/components/gridLadder";
import { AddMarketModal } from "@/components/addMarket";
import { EditStrategyModal } from "@/components/editStrategy";
import { EditCopyLpModal } from "@/components/editCopyLp";
import { describeScreen } from "@/components/discoveryFilters";
import { GoLiveModal } from "@/components/goLive";
import { WalletBar } from "@/components/walletBar";
import { CopySuggestionBanner } from "@/components/copySuggestion";
import { ChatButton } from "@/components/agentChatSheet";
import {
  StatusLine,
  FieldNote,
  QUIET,
  BODY,
  LABEL,
  SURFACE,
  SECONDARY,
  CHIP,
  NUM,
  SEGMENT_TRACK,
  SEGMENT_ITEM,
  SEGMENT_ON,
  SEGMENT_OFF,
} from "@/components/kit";
import type { UniverseSelection } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { periodsText } from "@/lib/rulePeriods";
import { useLocale, useT, type Locale, type Translate, dateLocale } from "@/lib/i18n";
import { useIsMobile } from "@/lib/useIsMobile";
import { AgentDetailMobile } from "@/components/agentDetailMobile";
import { EquityView } from "@/components/equity";
import { LpEquityView } from "@/components/lpEquity";
import { isLpBook } from "@/lib/perf";
import { sellSignalText, type SellCondition } from "@/components/setLimits";
import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonAgentDetail } from "@/components/skeleton";
import { AssetLogo, Rule } from "@/components/ui";
import { AgentRail } from "@/components/agentRail";
import { ModelBadge } from "@/components/modelBadge";
import { ModelPanel } from "@/components/modelPanel";
import { usePersonalWallet } from "@/lib/usePersonalWallet";
import { useMarks } from "@/lib/useMarks";
import {
  DEFAULT_TIMEFRAME,
  RWA_RULES,
  describeAddPlan,
  fmt,
  ruleBasisNote,
  ruleLabel,
  withRuleParams,
  type Timeframe,
} from "@/components/buildStrategy";
import {
  selectionKey,
  selectionLabel,
  selectionIssuer,
  getAgent,
  getAgentMarks,
  getEquity,
  getStrategy,
  getAllMarkets,
  assetMatchesSelection,
  num,
  pauseAgent,
  resumeAgent,
  deleteAgent,
  flattenAgent,
  removeAgentMarket,
  type AgentDetail as AgentDetailPayload,
  type DetectionRule,
  type EquitySeries,
  type StrategyRow,
  type UniverseAsset,
  isPerpMint,
} from "@/lib/api";

/**
 * My agent detail — wireframe 1k, the owner's view.
 *
 * Four requests compose it: the agent (status, mandate, wallet, open
 * positions), its strategy (rules, universe, exits — s.* comes back whole on
 * the detail route, which is the only place the recipe is readable), its equity
 * curve, and the resolved universe for live marks.
 *
 * WHAT IS PORTED AS DRAWN
 *
 * The header and wallet, the market strip with a live mark and today's move per
 * market, "watching now" with the real entry rule and the real distance to it,
 * the exit cards, the activity log, the strategy chips, and pause / resume.
 *
 * WHAT IS NOT, AND WHY
 *
 * - PER-MARKET BUDGETS. There is no such thing. Budget is agent-global and
 *   per-tick (mandate.constraints + trading_agent_policies), and no route reads
 *   or writes a per-market figure. Drawing a table of per-market caps would
 *   describe a control that does not exist and cannot be enforced. The rail
 *   shows the mandate's ACTUAL caps instead.
 * - + ADD MARKET. Universe belongs to the strategy, which the owner may now
 *   edit in place — so this is a live control rather than the explanation it
 *   used to be. It was written when a running strategy was frozen and the only
 *   way to change what an agent traded was to fork it into a new agent.
 * - UPTIME %, LIVE-SINCE GAPS, BILLING. No heartbeat table, no invoice, no
 *   subscription in the agent stack. `created_at` is real, so "live since"
 *   stays; the uptime cell became CADENCE, which is real and is the number that
 *   actually tells you how often it looks.
 * - ROUTE. Not stored on the agent, and no longer chosen either: the builder's
 *   venue step is gone, because the market settles which venues can fill it.
 *   Derivable from the universe via `describeVenues` in lib/venues.ts — shown
 *   as unset here rather than asserted, until the agent payload carries it.
 * - THE PRICE CHART with entry and trigger lines. Nothing in this API serves
 *   per-market price history. The distance-to-trigger meters carry the same
 *   information from the live mark, so the panel keeps the meaning and drops
 *   the candles.
 */

export function AgentDetailView({
  agentId,
  onOpenChat,
  chatOpen = false,
}: {
  agentId: number;
  /** Toggles the thread, which the workspace owns — see workspace.tsx. */
  onOpenChat?: () => void;
  /** Whether that thread is open, so the control can say so. */
  chatOpen?: boolean;
}) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { t, locale } = useLocale();
  /**
   * The token getter, held still. Same hazard as MyAgents, same fix.
   *
   * `load` is the effect's only dependency and ends by calling setState, so a
   * dependency that changes every render makes the page refetch itself for as
   * long as it is open. Privy returns a fresh closure rather than a stable one,
   * and exhaustive-deps asks for it by name, which is what makes this easy to
   * write and invisible afterwards.
   */
  const tokenRef = useRef(getAccessToken);
  tokenRef.current = getAccessToken;

  /**
   * Which load is the current one.
   *
   * A sequence rather than a cancelled flag, because a flag cannot survive a
   * re-run: teardown would set it true and the new run would immediately set it
   * false again, so a response still in flight from the PREVIOUS run would read
   * "not cancelled" and write its labels over the new agent's. A number each
   * run compares against is the same guard `useApi` uses, and it is proof
   * against both re-runs and unmount.
   */
  const runSeq = useRef(0);

  const [adding, setAdding] = useState(false);
  /**
   * Whether the strategy editor is open.
   *
   * This button used to be a link into the agent thread. Editing a threshold
   * is a question with a known answer, and routing it through a model call and
   * a round of approval charged three steps for a number the owner already
   * had — see editStrategy.tsx. The conversation still applies proposals
   * through the same backend function; this is the short path to it.
   */
  const [editing, setEditing] = useState(false);
  /**
   * Below lg this screen is wireframe M03, MOUNTED rather than hidden: its
   * phase bar needs a cycle the desktop layout never asks for, and a hidden
   * component still fetches.
   *
   * Called here, with the other hooks, and NOT beside the branch that uses it.
   * Every early return below this point is conditional, so a hook after one is
   * a hook that runs on some renders and not others — React throws on the
   * render where the count changes, which is the one where loading resolves.
   */
  const mobile = useIsMobile();
  /**
   * Whether the go-live dialog is open.
   *
   * Held here rather than inside the book switch because it must survive the
   * reload each completed step triggers — the switch re-renders with fresh props
   * on every one of them, and state owned by it would close the dialog at
   * exactly the moment the user finished a step.
   */
  const [goingLive, setGoingLive] = useState(false);
  /**
   * This page was loaded by the return from BoomFi's checkout.
   *
   * The go-live dialog sends the customer to BoomFi with a return path pointing
   * back here, because subscribing is step one of going live rather than an
   * errand of its own — being dropped on a generic page after paying leaves the
   * user to find their own way back to a flow they were halfway through.
   *
   * Read once and stripped from the URL immediately, for two reasons: a reload
   * should not re-enter the flow, and a link someone pastes to a colleague
   * should not open a payment-shaped dialog on their screen.
   */
  const [resumedCheckout, setResumedCheckout] = useState(false);
  /**
   * Which book to show. Null means "whichever the agent is in now", which is
   * what a fresh page load should open on — a live agent's page opening on its
   * paper history would be showing simulated numbers where real ones belong.
   * Set only when the reader deliberately switches.
   */
  const [book, setBook] = useState<"paper" | "live" | null>(null);
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "signed-out" }
    | { phase: "error"; message: string }
    | {
        phase: "ready";
        detail: AgentDetailPayload;
        strategy: StrategyRow | null;
        equity: EquitySeries | null;
        assets: UniverseAsset[];
        /**
         * The universe fetch below is deliberately off the critical path, so
         * `assets` is empty for two entirely different reasons: still in
         * flight, or genuinely nothing tradable. The add-market dialog draws
         * opposite conclusions from those, so the difference is carried rather
         * than inferred from `assets.length`.
         */
        assetsPending: boolean;
      }
  >({ phase: "loading" });

  /**
   * Live prices for the open book, keyed by mint.
   *
   * Held apart from `state` rather than folded into `assets`, because the two
   * refresh on completely different clocks: the universe is fetched once and is
   * expensive, these arrive as the market moves. Merging them would mean either
   * paying for the universe on every tick or writing prices into a payload the
   * rest of the page treats as immutable.
   *
   * Empty is the correct starting value and a correct steady state: on the
   * first frame nothing is priced yet, and if the stream never connects the
   * page marks against the universe exactly as it did before.
   */
  // The REST route is the backstop: identical prices, read once every thirty
  // seconds, so a stream that connects and then silently buffers cannot leave
  // the figures frozen. Stable identity, or the hook would tear down and
  // rebuild its stream on every render.
  const marksFallback = useCallback(
    async (token: string) => {
      const { marks: rows } = await getAgentMarks(token, agentId, book ?? undefined);
      return rows.map((m) => ({ key: m.mint, priceUsd: m.priceUsd }));
    },
    [agentId, book],
  );
  const marks = useMarks(
    `/agents/${agentId}/marks/stream${book ? `?book=${book}` : ""}`,
    marksFallback,
  );

  const [modelOpen, setModelOpen] = useState(false);
  const personalWallet = usePersonalWallet();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("checkout") !== "return") return;
    setResumedCheckout(true);
    url.searchParams.delete("checkout");
    window.history.replaceState(
      null,
      "",
      url.pathname +
        (url.searchParams.toString() ? `?${url.searchParams}` : "") +
        url.hash,
    );
  }, []);

  /**
   * The builder's hand-off: an agent that was just created on a bought model
   * arrives here with the model panel open.
   *
   * It cannot reason until its balance exists, so funding is not a thing to go
   * looking for — it is the next step. The flag is stripped from the URL for
   * the same reason the checkout one is: a shared or reloaded link should not
   * keep reopening a dialog nobody asked for this time.
   */
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("fund") !== "model") return;
    setModelOpen(true);
    url.searchParams.delete("fund");
    window.history.replaceState(
      null,
      "",
      url.pathname +
        (url.searchParams.toString() ? `?${url.searchParams}` : "") +
        url.hash,
    );
  }, []);

  /**
   * Reopens the dialog once the agent is actually loaded.
   *
   * Waits for the data rather than opening on mount, and re-checks the same
   * three conditions the Live pill uses — the product-level switch, still on
   * paper, never been live. A stale return link must not open a promotion dialog
   * on an agent that has since been promoted, or while live trading is closed.
   */
  useEffect(() => {
    if (!resumedCheckout || state.phase !== "ready") return;
    const { detail } = state;
    if (
      detail.liveTradingEnabled === true &&
      detail.agent.is_paper &&
      !detail.hasLiveHistory
    ) {
      setGoingLive(true);
    }
  }, [resumedCheckout, state]);

  const load = useCallback(async () => {
    if (!ready) return;
    if (!authenticated) {
      setState({ phase: "signed-out" });
      return;
    }
    const seq = ++runSeq.current;
    try {
      const token = await tokenRef.current();
      if (!token) {
        setState({ phase: "signed-out" });
        return;
      }
      // BOTH START HERE, because only one of them needs anything from the other.
      //
      // `getStrategy` genuinely has to wait — it is keyed on the agent's
      // strategy_id. `getEquity` is keyed on the agent ID we already have, so
      // the old code's `await getAgent(...)` before requesting it bought a whole
      // round trip for nothing.
      //
      // The `.catch` is attached at creation, not at the await. Without it, an
      // agent request that throws leaves this promise rejecting with nobody
      // listening — an unhandled rejection caused by the error path of a
      // DIFFERENT request, which is a miserable thing to debug.
      const agentPromise = getAgent(token, agentId, book ?? undefined);
      // Same book as the agent request. The curve sits directly above the
      // positions it is supposed to explain, and now that an agent's cycles can
      // interleave paper and live, letting these two disagree would put a paper
      // curve over a live book without either label being wrong.
      const equityPromise = getEquity(token, agentId, book ?? undefined).catch(
        () => null,
      );

      // The agent is the one request whose failure means there is no page, so
      // it alone is allowed to throw into the catch below.
      const detail = await agentPromise;

      const [strategy, equity] = await Promise.all([
        getStrategy(token, detail.agent.strategy_id).catch(() => null),
        equityPromise,
      ]);

      setState({
        phase: "ready",
        detail,
        strategy: strategy?.strategy ?? null,
        equity,
        // Empty for now, filled below. See the universe fetch.
        assets: [],
        assetsPending: true,
      });

      // THE UNIVERSE IS NOT ON THE CRITICAL PATH.
      //
      // It is the most expensive request the product makes — the endpoint
      // resolves the tradable universe, prices every mint through Jupiter and
      // asks Wintel for each asset's activity, behind a sixty-second cache — and
      // this page wants it for ONE thing: turning a stored selection into a
      // symbol and a name. Blocking a page of real figures on a batch of labels
      // is the wrong trade, and on a cold cache it is the whole wait.
      //
      // So the page renders without it and the labels arrive when they arrive.
      // A market that has not resolved yet already renders from its selection
      // (see `markets` below), which is the same fallback used for a market
      // that cannot be priced at all — so nothing here is a new state.
      //
      // Failure stays silent for the same reason it was `allSettled` before: a
      // universe lookup that 500s costs the page its labels, not its content.
      // EVERY market, not this agent's class.
      //
      // This asked for `getMarketsForClass(strategy_class)` — one class's
      // universe — and the backend is explicit that the class "no longer
      // decides what an agent may hold": an agent may hold tokenized equities
      // and SPL tokens at once, and POST /agents/:id/markets resolves whichever
      // identity it is sent. So a one-class fetch could not resolve half of a
      // mixed universe, and for any class the route has not wired yet it
      // answered `{assets: []}` outright — leaving every market on the page
      // labelled from its bare selection and priced "not priced".
      //
      // getAllMarkets requests both halves and merges them, and both halves
      // share the same sixty-second cache the picker already fills.
      void getAllMarkets(token)
        .then((assets) => {
          if (seq !== runSeq.current) return;
          setState((prev) =>
            prev.phase === "ready"
              ? { ...prev, assets, assetsPending: false }
              : prev,
          );
        })
        .catch(() => {
          /* labels stay as selections; the page is already usable */
          if (seq !== runSeq.current) return;
          setState((prev) =>
            prev.phase === "ready" ? { ...prev, assetsPending: false } : prev,
          );
        });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
    // `getAccessToken` is read through tokenRef, deliberately — see above.
  }, [ready, authenticated, agentId, book]);

  useEffect(() => {
    void load();
    // Bumped on teardown so anything still in flight — the universe fetch lands
    // after the page has already rendered — finds itself outranked and drops
    // its result. Switching book or navigating away mid-flight would otherwise
    // write the previous agent's labels beside the new one's figures, which is
    // worse than a warning: it is a wrong label that looks authoritative.
    return () => {
      runSeq.current++;
    };
  }, [load]);


  // Which market is mid-removal, by its selection key. A single id rather than
  // a boolean so only the card being removed shows a pending state.
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  /**
   * Stops the agent screening one market.
   *
   * Reloads rather than mutating local state: the backend decides what the
   * universe is now, and a client that patched its own copy would disagree with
   * it the first time a rule was refused server-side.
   */
  const removeMarket = useCallback(
    async (sel: UniverseSelection) => {
      const key = selectionKey(sel);
      setRemovingKey(key);
      setRemoveError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error(t("ad_sign_in_to_change"));
        await removeAgentMarket(
          token,
          agentId,
          sel.kind === "crypto"
            ? { mint: sel.mint }
            : { underlying: sel.underlying, issuer: sel.issuer },
        );
        await load();
      } catch (err) {
        // Shown rather than swallowed: the most likely refusal is the
        // last-market guard, and that message is the whole explanation.
        setRemoveError(err instanceof Error ? err.message : String(err));
      } finally {
        setRemovingKey(null);
      }
    },
    [agentId, getAccessToken, load, t],
  );

  /**
   * The universe, with the open book's prices replaced by live ones.
   *
   * Everything downstream marks positions against a universe row, so this is
   * the one place the live price has to land for the P&L, the open-book total
   * and the position rows to agree. Overriding here rather than teaching each
   * of them about marks is also what keeps `markOpenBook` untouched — it is the
   * function that decides what the money is worth, and it earns its
   * conservatism.
   *
   * A mint with no mark keeps the swept price. That is the honest fallback: the
   * marks endpoint omits anything Jupiter could not price, and an RWA row is
   * never in there at all.
   *
   * ABOVE THE EARLY RETURNS, and it has to be. `state.assets` only exists once
   * the page is ready, so the obvious home for this is next to the destructure
   * below — which is after three guards that return, making the hook
   * conditional and changing the hook order between a loading render and a
   * ready one. It reads `state` directly instead, and answers with an empty
   * list until there is something to answer with.
   */
  const marked = useMemo(() => {
    if (state.phase !== "ready") return [] as UniverseAsset[];
    const list = state.assets;
    if (marks.size === 0) return list;

    // TWO IDENTITY SHAPES, AND MATCHING ONLY ONE OF THEM WAS A BUG.
    //
    // Marks are keyed by mint, because a position is. But a universe row for a
    // tokenized stock carries NO mint — it is intent, "Apple, via Backed",
    // resolved to an address at boot — so an `a.mint && marks.has(a.mint)`
    // test never matched one, and the live price for AAPLx was fetched and then
    // dropped. `markOpenBook` joins those rows by symbol for exactly this
    // reason; this has to do the same or it feeds it a price it cannot use.
    //
    // The positions are the bridge: each one carries both the mint that was
    // priced and the symbol the universe row is filed under.
    const bySymbol = new Map<string, number>();
    for (const p of state.detail.positions) {
      const price = p.mint ? marks.get(p.mint) : undefined;
      if (price !== undefined) bySymbol.set(p.symbol, price);
    }

    return list.map((a) => {
      const byMint = a.mint ? marks.get(a.mint) : undefined;
      const price = byMint ?? bySymbol.get(a.symbol);
      return price === undefined ? a : { ...a, priceUsd: price };
    });
  }, [state, marks]);

  if (state.phase === "loading") return <SkeletonAgentDetail />;
  if (state.phase === "signed-out")
    return <SignedOutState note={t("ad_signed_out_note")} />;
  if (state.phase === "error")
    return <ErrorState message={state.message} onRetry={() => void load()} />;

  const { detail, strategy, equity, assets, assetsPending } = state;
  const { agent, positions, wallet, lastRun } = detail;
  // A perp agent: its universe holds a namespaced identity, or its book does.
  const tradesPerps =
    (strategy?.universe ?? []).some((sel) => sel.kind === "crypto" && isPerpMint(sel.mint)) ||
    positions.some((p) => !!p.perp);


  // The strategy's universe, resolved against live marks. A selection whose
  // asset is missing from the resolved universe still renders — it is a market
  // the agent holds a mandate for that cannot currently be priced, which is
  // worth seeing, not worth hiding.
  const markets = (strategy?.universe ?? []).map((sel) => ({
    sel,
    // One shared matcher rather than an inline predicate that only understood
    // RWA selections: a crypto pick is identified by its mint, and comparing it
    // on `underlying` — a field a token does not have — never matched.
    asset: marked.find((a) => assetMatchesSelection(a, sel)) ?? null,
  }));

  /** The screen, when this agent finds its own markets. */
  const screen = strategy?.discovery ?? undefined;
  const rules = strategy?.rules ?? [];
  const anyOf = strategy?.anyOf ?? [];
  const setup = strategy?.setup;
  // A stored rule means nothing without the bar size it was measured on:
  // "RSI ≤ 30" is a fortnight of selling on daily bars and about an hour on
  // 5-minute ones. Absent means daily, as it does everywhere else.
  const timeframe: Timeframe =
    (strategy?.timeframe as Timeframe) ?? DEFAULT_TIMEFRAME;
  // Absent means one entry per asset — the behaviour of every strategy that
  // does not ask for otherwise.
  const addPlan = strategy?.add_plan ?? null;
  const planSummary = describeAddPlan(addPlan, t);
  const grid = strategy?.grid ?? null;
  const gridMark = grid ? (marked.find((a) => a.mint === grid.market.mint)?.priceUsd ?? null) : null;
  // The rule to headline under "Watching now".
  //
  // changePct first because "drops 4%+ on the day" is the most legible thing a
  // strategy can be waiting for — but ANY rule can be headlined, and
  // entryHeadline has always known how. Only the selection was narrow, so a
  // strategy built on RSI or MACD fell through to a message apologising for
  // having "no move-on-the-day trigger". Since the indicator set widened that
  // is most strategies, and it was describing the normal case as a deficiency.
  const entry =
    rules.find((r) => r.key === "changePct") ??
    // Then whichever rule the builder can name, so the headline reads as a
    // condition rather than a raw key.
    rules.find((r) => RWA_RULES.some((spec) => spec.key === r.key)) ??
    rules[0] ??
    null;
  /*
   * A COPY AGENT HAS NO EXITS TO SHOW, whatever is stored against it.
   *
   * The engine closes a copy's positions only when its leader does —
   * `deriveDirectives` returns before it ever reads this column. Strategy 228
   * nonetheless carries `{takeProfitPct: 25, stopLossPct: 12}` from the first
   * builder that wrote a copy strategy, and the rail was drawing both as
   * chips: a take-profit and a stop this agent will never act on, stated to
   * its owner as though they were live.
   *
   * Hidden rather than deleted. The stored row is inert and harmless, and a
   * migration that rewrote an owner's saved settings to correct a display
   * would be a worse trade than not displaying them.
   */
  const exits = strategy?.copy_lp ? null : (strategy?.exits ?? null);
  // Read back once, in the phrasing the builder and the edit dialog use — a
  // second wording of the same conditions would eventually disagree with them.
  const sells = sellSignalText((exits?.exitWhen ?? []) as SellCondition[], t);
  const constraints = agent.mandate?.constraints ?? {};
  /** Whether this agent's book is liquidity rather than lots at a price. */
  const isLp = isLpBook(agent, positions);

  const capital = Number(agent.capital_usd) || 0;
  // The nearest real thing to a per-market budget: the mandate's position cap,
  // in dollars. It is agent-wide, so every market row shows the same figure —
  // which is the truth, and is why the note under the table says so.
  const positionCap =
    constraints.maxPositionPct && capital
      ? (capital * constraints.maxPositionPct) / 100
      : null;

  // Why a half of the book switch cannot be picked, or null when it can. The
  // flag comes first: while real-money trading is closed, "not open yet" is the
  // true reason for every agent, and saying "hasn't gone live" would imply a
  // promotion the product will not currently perform.
  // From the server, not from a constant in this bundle. Absent means false,
  // so a failed fetch or an older client hides the promotion rather than
  // offering one the backend will refuse.
  const liveTradingEnabled = detail.liveTradingEnabled === true;
  // Only the product-level closure disables the Live half now. A paper agent used
  // to be refused here too — "this agent hasn't gone live yet" — which stated the
  // problem and offered nothing, leaving the reader to hunt for the promotion
  // panel further down the page. Pressing Live IS the request to go live, so it
  // opens the dialog that performs it. See `goLiveIntent`.
  const liveDisabledReason = !liveTradingEnabled ? t("ad_live_closed") : null;
  // Pressing Live means "go live" only on an agent that has never traded live —
  // which, since the transition is one-way, is exactly every paper agent. One
  // rule: the pill shows you a book when there is one, and stands in for the
  // missing one when there is not.
  const goLiveIntent =
    liveTradingEnabled && agent.is_paper && !detail.hasLiveHistory
      ? () => setGoingLive(true)
      : null;
  // A live agent that was deployed straight to live has no paper run behind it.
  const paperDisabledReason =
    detail.hasPaperHistory || agent.is_paper ? null : t("ad_no_paper_run");
  const cadenceSec =
    strategy?.tick_interval_sec ?? agent.mandate?.tickIntervalSec ?? null;

  // The strategy editor and the go-live dialog, at BOTH widths. They used to
  // sit at the foot of the desktop tree only, which the phone branch returned
  // before reaching — so a phone had no way to edit a strategy or promote an
  // agent, and the switch that promotes could not even be shown.
  const dialogs = (
    <>
  {/* TWO EDITORS, CHOSEN BY WHAT THE STRATEGY IS. A copy agent has no entry
      rules, no exits and no timeframe, so the recipe dialog had nothing true to
      show it and nothing to offer but chips it does not evaluate — while the
      copy's own six settings were unreachable after deploy. */}
  {editing && strategy?.copy_lp ? (
    <EditCopyLpModal
      agentId={agentId}
      agentName={agent.strategy_name}
      strategy={strategy}
      bookUsd={equity?.points.at(-1)?.equityUsd ?? Number(agent.mandate?.capitalUsd ?? 0)}
      hasOpenPositions={detail.positions.length > 0}
      isPaper={agent.is_paper}
      onSaved={() => void load()}
      onClose={() => setEditing(false)}
    />
  ) : editing && strategy ? (
    <EditStrategyModal
      agentId={agentId}
      agentName={agent.strategy_name}
      strategy={strategy}
      mandate={agent.mandate}
      isPaper={agent.is_paper}
      equityUsd={equity?.points.at(-1)?.equityUsd ?? null}
      // Reloads behind the dialog on the way out, so the rule chips, the
      // exit cards and the accumulation note in the rail all restate the
      // strategy that was just saved rather than the one that was loaded.
      onSaved={() => void load()}
      onClose={() => setEditing(false)}
    />
  ) : null}

  {/* Opened from the Live half of the book switch. Reloads the page behind as
      each step lands, so the header, the wallet tag and the dialog agree the
      moment a delegation or a promotion takes effect. */}
  {goingLive ? (
    <GoLiveModal
      agent={agent}
      wallet={wallet}
      openPositions={positions.length}
      // Only true for the dialog the return from checkout opened. Cleared on
      // close so reopening by hand is an ordinary read rather than another
      // round trip to the payment provider.
      resumedFromCheckout={resumedCheckout}
      copyLp={strategy?.copy_lp ?? null}
      onChanged={() => void load()}
      onClose={() => {
        setGoingLive(false);
        setResumedCheckout(false);
      }}
    />
  ) : null}
    </>
  );

  if (mobile === null) return null;

  if (mobile) {
    return (
      <>
        <AgentDetailMobile
          grid={strategy?.grid ?? null}
          onOpenChat={onOpenChat}
          // The `?fund=model` hand-off, forwarded. This branch returns before
          // the desktop tree that owns the panel, so without passing it down
          // the flag is read, cleared, and dropped.
          fundOnMount={modelOpen}
          agent={agent}
          detail={detail}
          equity={equity}
          positions={positions}
          assets={marked}
          assetsPending={assetsPending}
          universe={strategy?.universe ?? []}
          copyLp={strategy?.copy_lp ?? null}
          onChanged={() => void load()}
          walletAddress={wallet?.address ?? null}
          onBook={setBook}
          onGoLive={goLiveIntent}
          paperDisabledReason={paperDisabledReason}
          liveDisabledReason={liveDisabledReason}
          onEdit={strategy ? () => setEditing(true) : null}
          // The facts the rail carries on a desktop and the phone carried
          // nowhere: the same owner could read how their agent runs at a desk
          // and not on a train. Computed here already, so this is prop passing.
          screen={screen}
          cadenceSec={cadenceSec}
          positionCap={positionCap}
        />
        {dialogs}
      </>
    );
  }

  return (
    <div>
      {/* ------------------------------------------------------------ head -- */}
      <section className="border-b border-grid px-5 sm:px-8 pt-5 pb-5">
        <Link
          href="/portfolio"
          className="font-ui text-[13px] text-text-secondary transition-colors hover:text-text-primary"
        >
          {t("ad_back")}
        </Link>
        {/* ONE GRID FOR THE WHOLE HEAD, so the right side has something to line
            up against. Left column: the name, then the paper/live switch under
            it. Right column: the wallet's identity on the name's row and its
            actions on the switch's. WalletBar places its own two cells by
            explicit row, which is why it can stay a single component with one
            set of modal state while its halves are not adjacent here. */}
        {/* TWO BLOCKS, TOP-ALIGNED. The name leads.
        
            Three earlier attempts paired these columns row by row — name against
            the address, the switch against the buttons — and each felt wrong for
            the same reason: the agent's name is the page's title, and pinning it
            to the wallet's third line pushed the largest type on the screen
            below two rows of 9.5px labels. Nothing on the left corresponds to
            "USDC balance"; those rows were empty, and the name was floating in
            the middle of a header it is supposed to open.

            Columns with different line counts and different jobs do not pair.
            The identity block and the wallet block each read top-down on their
            own, and the alignment the eye actually uses is the one edge they
            genuinely share. Nothing here moves when the wallet gains or loses a
            line. */}
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5 pt-4">
          {/* THREE ROWS: the name, what it is, what you are looking at.
          
              The name had the badge and the status chip beside it, which put a
              28px headline, a 10px pill and a status on one line and made the
              title share its row with two things that describe it. Now the name
              leads alone with the one control attached to the agent itself, and
              the two descriptors sit under it as a metadata line. */}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="min-w-0 truncate font-ui text-[28px] font-light leading-none tracking-[-0.02em] text-text-primary">
                {agent.strategy_name}
              </h1>
              {/* Chat lives with the agent, not with the page furniture — and
                  on this tab the workspace bar deliberately carries neither the
                  name nor a chat button, so this is the only one. */}
              <ChatButton
                agent={agent}
                onOpen={() => onOpenChat?.()}
                active={chatOpen}
                compact
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {/* The badge is the affordance. It is already the thing on this
                  page that names the model, so making it the way IN to the
                  model is one control rather than two. */}
              <button
                type="button"
                onClick={() => setModelOpen(true)}
                aria-label={`Model: ${agent.model?.label ?? "cQWEN3"} — open model settings`}
                className="transition-opacity hover:opacity-80"
              >
                <ModelBadge model={agent.model} />
              </button>
              <StatusChip status={agent.status} />
              {/* THE LIVE READOUT, BESIDE THE STATE IT QUALIFIES.
                  It used to head a "Watching now" section whose body restated
                  the rail's entry rules and exits; the section went, and this is
                  the one thing in it that existed nowhere else. It belongs here
                  anyway: "active" and "checked 1m ago · next in 4 min" are the
                  same sentence, and they were being said two screens apart.
                  `live`, because this is a thing happening rather than a state
                  that is true — the agent is between ticks right now. */}
              {agent.status === "active" ? (
                <StatusLine tone="good" live>
                  {agent.last_tick_at
                    ? t("ad_checked", { when: relativeTime(agent.last_tick_at, t) })
                    : t("ad_starting")}
                  {agent.next_tick_at ? t("ad_next", { when: ahead(agent.next_tick_at, t) }) : ""}
                </StatusLine>
              ) : null}
            </div>

            {/* Always both halves, so the reader can see that an agent has two
                books and which one they are looking at. A half with nothing
                behind it is disabled and says why. */}
            <div className="min-w-0">
              <BookSwitch
                book={detail.book}
                onChange={setBook}
                onGoLive={goLiveIntent}
                paperDisabledReason={paperDisabledReason}
                liveDisabledReason={liveDisabledReason}
                note={
                  detail.book === "paper" && detail.hasPaperHistory
                    ? t("ad_settled_paper_note")
                    : null
                }
              />
            </div>
          </div>

          <WalletBar
            agentId={agentId}
            address={wallet?.address ?? null}
            isPaper={agent.is_paper}
            perps={tradesPerps}
            unit={detail.unit ?? "USD"}
          />
        </div>

        {/* An agent waiting for its first deposit is mid-SETUP, not broken —
            so it gets an action, not the breaker's red sentence. It is not
            paused either: it stays scheduled and starts by itself the moment
            the balance lands, which is what the copy has to promise. */}
        {lastRun?.skip_reason === "model_unfunded" ? (
          // NO BUTTON. The model badge beside the agent's name now carries the
          // credit and opens the panel, which makes it the one way in — the
          // same argument that comment already makes about the badge being the
          // affordance. A second control saying "Top up" put two doors on one
          // room, and the one further from the number was the louder of them.
          <p className="pt-3 font-ui text-[12.5px] text-warning">
            {t("ad_model_unfunded", {
              model: agent.model?.label ?? t("ad_model_generic"),
            })}
          </p>
        ) : agent.paused_reason ? (
          <p className="pt-3 font-ui text-[12.5px] text-negative">
            {/* The reason is a backend state name, de-underscored — it names a
                specific breaker and is not ours to reword. */}
            {t("ad_stopped_itself", {
              reason: agent.paused_reason.replace(/_/g, " "),
            })}
          </p>
        ) : null}
        {/* A LIVE COPY AGENT'S COPY % AGAINST ITS DEPOSIT. Shown only once a
            deposit makes a suggestion possible, and only when it is far from
            the current setting — see components/copySuggestion.tsx. */}
        {!agent.is_paper && strategy?.copy_lp ? (
          <CopySuggestionBanner agentId={agentId} copyLp={strategy.copy_lp} onApplied={() => void load()} className="mt-4" />
        ) : null}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* ------------------------------------------------------- main -- */}
        <div className="min-w-0 lg:border-r lg:border-grid">
          {/* performance — the series IS the page for an owner, so the curve
              gets a section of its own. No extra request: `equity` is loaded
              with the rest of the page.

              The rule carried a +0.0% "since deployed" headline, which is the
              same number EquityView prints a few pixels below it, next to the
              capital it is measured against and beside the realised, unrealised
              and drawdown figures that qualify it. One return figure, in the
              block that can show its working. */}
          <section className="border-b border-grid px-5 sm:px-8 py-6">
            <Rule label={t("ad_sec_performance")} line={false} />
            <div className="pt-4">
              {/* A liquidity book is fees and a range, not a distribution of
                  bets — see components/lpEquity.tsx for what changes and why. */}
              {isLp ? (
                <LpEquityView
                  series={equity}
                  positions={positions}
                  universe={marked}
                  unit={detail.unit ?? "USD"}
                  solUsd={detail.solUsd ?? null}
                />
              ) : (
                <EquityView series={equity} positions={positions} universe={marked} />
              )}
            </div>
          </section>

          {/* markets */}
          <section className="border-b border-grid px-5 sm:px-8 py-6">
            <Rule label={t("ad_sec_positions")} />
            {isLp ? (
              <LpPositions
                agentId={agentId}
                positions={positions}
                universe={marked}
                book={detail.book}
                copy={detail.copy}
                unit={detail.unit ?? "USD"}
                solUsd={detail.solUsd ?? null}
                onChanged={() => void load()}
              />
            ) : (
            <Positions
              agentId={agentId}
              positions={positions}
              universe={marked}
              // What a swap costs, straight from the execution adapter — so
              // the book states what closing would leave rather than what the
              // position is worth on paper.
              swapCost={detail.swapCost}
              onChanged={() => void load()}
            />
            )}
          </section>

          {/* the grid, when the strategy is one */}
          {grid ? (
            <section className="border-b border-grid px-5 sm:px-8 py-6">
              <Rule label={t("ad_sec_grid")} />
              <div className="pt-4">
                <GridLadder grid={grid} positions={positions} markUsd={gridMark} />
              </div>
            </section>
          ) : null}


          {/* activity */}
          <section className="px-5 sm:px-8 py-6">
            <Rule
              label={t("ad_sec_activity")}
              right={
                <Link
                  href={`/workspace/${agentId}?tab=cycles`}
                  className={QUIET}
                >
                  {t("ad_all_cycles")}
                </Link>
              }
            />
            <div className="pt-4">
              <ActivityLog agentId={agentId} book={detail.book} />
            </div>
            <p className={`pt-4 ${BODY}`}>
              {lastRun?.skip_reason
                ? t("ad_append_only_skipped", {
                    reason: lastRun.skip_reason.replace(/_/g, " "),
                  })
                : t("ad_append_only")}
            </p>
          </section>
        </div>

        {/* ------------------------------------------------------- rail --
            Extracted to components/agentRail.tsx: it is a self-contained
            surface, both layouts want pieces of it, and this file was 2,200
            lines. */}
        <AgentRail
          agent={agent}
          strategy={strategy}
          rules={rules}
          anyOf={anyOf}
          setup={setup}
          exits={exits}
          sells={sells}
          timeframe={timeframe}
          planSummary={planSummary}
          markets={markets}
          screen={screen}
          entry={entry}
          cadenceSec={cadenceSec}
          positionCap={positionCap}
          onEdit={() => setEditing(true)}
          onAddMarket={() => setAdding(true)}
          onRemoveMarket={(sel: UniverseSelection) => void removeMarket(sel)}
          removingKey={removingKey}
          removeError={removeError}
        />
      </div>

      <Controls
        agent={agent}
        positions={positions}
        onChanged={() => void load()}
      />

      {/* What it reasons with, what that costs, and how to pay for it. Opened
          from the badge beside the name, or by the builder's hand-off for an
          agent that was just created on a bought model. */}
      {modelOpen ? (
        <ModelPanel
          agentId={agentId}
          agentWallet={wallet?.address ?? null}
          personalWallet={personalWallet}
          expiresAt={agent.expires_at ?? null}
          // Reloads behind the open panel, so granting a wallet updates the
          // header and the payer list without closing what the owner is doing.
          onChanged={() => void load()}
          onClose={() => setModelOpen(false)}
        />
      ) : null}

      {adding ? (
        <AddMarketModal
          agentId={agentId}
          agentName={agent.strategy_name}
          assets={marked}
          loading={assetsPending}
          existing={strategy?.universe ?? []}
          // Reloads behind the open dialog, so the markets grid and the modal
          // agree the moment a removal lands rather than only after closing.
          onChanged={() => void load()}
          onClose={() => setAdding(false)}
        />
      ) : null}

      {dialogs}
    </div>
  );
}

/* -------------------------------------------------------------- controls -- */

function Controls({
  agent,
  positions,
  onChanged,
}: {
  agent: AgentDetailPayload["agent"];
  /** Open lots, so the warning can name what is about to be sold. */
  positions: AgentDetailPayload["positions"];
  onChanged: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmFlatten, setConfirmFlatten] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const paused = agent.status === "paused";

  async function run(kind: "toggle" | "delete" | "flatten") {
    setBusy(kind);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("error_not_signed_in"));
      if (kind === "delete") {
        await deleteAgent(token, agent.id);
        // Gone from the list, so there is nothing left to return to here.
        router.push("/agents");
        return;
      }
      if (kind === "flatten") {
        const { closed } = await flattenAgent(token, agent.id);
        setConfirmFlatten(false);
        // Reported rather than left to be inferred from a table that may take a
        // moment to catch up — "nothing happened" and "it worked" look the same
        // otherwise.
        setNotice(
          closed === 0
            ? t("ad_flatten_nothing")
            : closed === 1
              ? t("ad_flatten_one")
              : t("ad_flatten_many", { count: closed }),
        );
        onChanged();
        return;
      }
      await (paused
        ? resumeAgent(token, agent.id)
        : pauseAgent(token, agent.id));
      onChanged();
    } catch (err) {
      // A partial close comes back as an error carrying real progress, so the
      // message is shown and the modal closed rather than treated as a no-op.
      setError(err instanceof Error ? err.message : String(err));
      setConfirmDelete(false);
      setConfirmFlatten(false);
    } finally {
      setBusy(null);
    }
  }

  const deletable = agent.status !== "deleted";

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-grid px-5 sm:px-8 py-4">
      {agent.status === "active" || paused ? (
        <button
          type="button"
          onClick={() => void run("toggle")}
          disabled={busy !== null}
          className={SECONDARY}
        >
          {busy === "toggle"
            ? t("ad_busy")
            : t(paused ? "ad_resume_agent" : "ad_pause_agent")}
        </button>
      ) : null}

      {/* Only when there is something to close. A button that can do nothing is
          a button that teaches people it does nothing. */}
      {positions.length > 0 && agent.status !== "deleted" ? (
        <button
          type="button"
          onClick={() => setConfirmFlatten(true)}
          disabled={busy !== null}
          className={`${SECONDARY} hover:border-warning hover:text-warning`}
        >
          {busy === "flatten" ? t("ad_busy") : t("ad_close_all")}
        </button>
      ) : null}

      <div className="flex-1" />

      {notice ? (
        <span className="font-ui text-[12.5px] text-text-dim">
          {notice}
        </span>
      ) : null}

      {error ? (
        <span className="font-ui text-[12.5px] text-negative">
          {error}
        </span>
      ) : null}

      {deletable ? (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className={`${QUIET} hover:text-negative`}
        >
          {t("ad_delete_agent")}
        </button>
      ) : null}

      {confirmFlatten ? (
        <FlattenAgentModal
          agent={agent}
          positions={positions}
          busy={busy === "flatten"}
          onConfirm={() => void run("flatten")}
          onClose={() => setConfirmFlatten(false)}
        />
      ) : null}

      {confirmDelete ? (
        <DeleteAgentModal
          agent={agent}
          positions={positions}
          busy={busy === "delete"}
          onConfirm={() => void run("delete")}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- pieces -- */


function StatusChip({ status }: { status: string }) {
  const t = useT();
  const running = status === "active";
  const stopped = status === "paused" || status === "liquidating";
  // RULE 4: status is a dot and a word, not a chip.
  //
  // Running used to be `bg-accent text-bg` — a solid fill, which is the heaviest
  // treatment on the page, spent on a state that is true almost all the time.
  // It outranked the agent's own name beside it and left nothing louder for the
  // states that actually want attention. The dot carries the same three
  // meanings without competing with the headline it sits next to.
  return (
    <StatusLine tone={running ? "good" : stopped ? "bad" : "pending"}>
      {running
        ? t("ad_status_running")
        : status === "liquidating"
          ? t("ad_status_closing")
          : status}
    </StatusLine>
  );
}

/**
 * Paper / Live — two books belonging to ONE agent.
 *
 * This used to switch between two separate agent records. It no longer does,
 * because an agent no longer works that way: going live flips the same record,
 * carrying its strategy and everything it learned across, and leaving the paper
 * lots behind as a settled book. There is one id, one activity log, one set of
 * rules — and two books, told apart by `is_paper` on each position and fill.
 *
 * So this IS a display filter — switching refetches the same agent for the
 * other book rather than navigating anywhere, and it never changes what the
 * agent is doing. Both books survive: a live agent's paper run stays readable
 * forever, which is why going live is not the one-way door it used to be
 * described as.
 *
 * Nothing here changes what the agent is DOING. Going live is a real
 * transition — it settles the paper book and stops paper trading — but it
 * happens once, from the Live half of an agent that has no live book yet.
 * Afterwards this is purely a reader: the paper run stays browsable forever,
 * which is why going live costs you nothing you had already earned.
 *
 * Both halves always render. A half with no book behind it — live, while
 * real-money trading is closed — is disabled and carries its reason, which
 * reads as a stage the product is in. Hiding it instead left the page silent
 * about the fact that an agent has two books at all.
 *
 * The reason surfaces on hover of the half it belongs to, not as a standing
 * line beside the pill: sitting there permanently it read as a page-level
 * announcement about the product, when it is an answer to "why can't I press
 * this". `note` holds anything that IS worth saying unprompted, and the hovered
 * reason takes its place while pointed at.
 */
export function BookSwitch({
  book,
  onChange,
  onGoLive,
  paperDisabledReason,
  liveDisabledReason,
  note,
}: {
  book: "paper" | "live";
  onChange: (book: "paper" | "live") => void;
  /**
   * What pressing Live means on an agent that has no live book yet: open the
   * dialog that gives it one. Null when the agent already trades live — Live is
   * then an ordinary filter — and when real-money trading is closed, where the
   * half is disabled and carries its reason instead.
   */
  onGoLive: (() => void) | null;
  paperDisabledReason: string | null;
  liveDisabledReason: string | null;
  note: string | null;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const t = useT();

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div
        role="group"
        aria-label={t("ad_book_aria")}
        className={`shrink-0 ${SEGMENT_TRACK}`}
      >
        {(["paper", "live"] as const).map((b) => {
          const promotes = b === "live" && onGoLive !== null;
          return (
            <Half
              key={b}
              book={b}
              current={book}
              onSelect={() => (promotes ? onGoLive!() : onChange(b))}
              disabledReason={
                b === "paper" ? paperDisabledReason : liveDisabledReason
              }
              promotes={promotes}
              onHover={setHovered}
            />
          );
        })}
      </div>
      {hovered ? (
        <p className={BODY}>{t("ad_hover_reason", { reason: hovered })}</p>
      ) : note ? (
        <p className={BODY}>{note}</p>
      ) : null}
    </div>
  );
}

function Half({
  book,
  current,
  onSelect,
  disabledReason,
  promotes,
  onHover,
}: {
  book: "paper" | "live";
  current: "paper" | "live";
  onSelect: () => void;
  disabledReason: string | null;
  /** This half opens the go-live dialog rather than switching the book. */
  promotes: boolean;
  onHover: (reason: string | null) => void;
}) {
  const t = useT();
  const active = book === current;
  const label = t(book === "paper" ? "ad_book_paper" : "ad_book_live");
  const base = SEGMENT_ITEM;

  if (active) {
    // No dot. The fill IS the selected state — a dot as well is the control
    // saying the same thing twice, and in this kit a dot means STATUS, which is
    // what the chip beside the agent's name is for.
    return (
      <span aria-current="true" className={`${base} ${SEGMENT_ON}`}>
        {label}
      </span>
    );
  }

  // What the hover line says. A disabled half explains why it cannot be pressed;
  // a promoting one says what pressing it will DO, since "Live" on an agent that
  // has never traded live is otherwise ambiguous between "show me the live book"
  // and "make this live".
  const hint = disabledReason ?? (promotes ? t("ad_promote_hint") : null);

  // aria-disabled rather than `disabled`: a disabled button fires no pointer
  // events in most browsers and cannot be focused, so the reason would never
  // reach anyone — which is the one thing this half exists to say.
  return (
    <button
      type="button"
      aria-disabled={disabledReason !== null}
      onClick={() => {
        if (!disabledReason) onSelect();
      }}
      onMouseEnter={() => onHover(hint)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(hint)}
      onBlur={() => onHover(null)}
      className={
        disabledReason
          ? `${base} cursor-not-allowed text-text-dim/45`
          : promotes
            ? // An offer rather than the inert half of a filter. Not filled in:
              // it sits inside a switch, and a solid button there would outrank
              // the half that is actually selected.
              `${base} text-text-secondary hover:bg-surface-2 hover:text-text-primary`
            : `${base} ${SEGMENT_OFF}`
      }
    >
      {label}
      {promotes ? (
        <span aria-hidden className="font-ui text-[11px] text-text-muted">
          →
        </span>
      ) : null}
    </button>
  );
}







/* --------------------------------------------------------------- figures -- */



function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}


// `when` moved to lib/format as `relativeTime`.

/**
 * How long UNTIL something, which `relativeTime` cannot express.
 *
 * Kept local rather than folded into lib/format: this is the only forward-
 * looking clock in the app, and a shared helper with a direction flag would
 * make every call site say which way it meant.
 */
function ahead(iso: string, t: Translate): string {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (mins <= 0) return t("ad_due_now");
  if (mins < 60) return t("ad_in_minutes", { count: mins });
  return t("ad_in_hours", { count: Math.floor(mins / 60) });
}

/**
 * The warning before a delete.
 *
 * Deleting does three irreversible things — four when the agent is the last one
 * its author runs on a listed strategy — and a user who only reads the button
 * would expect one of them. So each is named, in the order it happens, with the
 * actual position count and cost rather than a general caution — "3 positions,
 * $4,513" is a fact somebody can weigh; "you may have open positions" is not.
 * The fourth follows the same rule: it appears only when the server has said it
 * will happen, never as a standing "this might also delist your strategy".
 *
 * What is NOT lost is stated too. The word "delete" implies the record goes,
 * and it does not: the point of saying so is that somebody deciding whether to
 * keep an agent around for its history does not need to.
 */
function DeleteAgentModal({
  agent,
  positions,
  busy,
  onConfirm,
  onClose,
}: {
  agent: AgentDetailPayload["agent"];
  positions: AgentDetailPayload["positions"];
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const open = positions.length;
  const investedUsd = positions.reduce(
    (sum, p) => sum + Number(p.cost_basis_usd),
    0,
  );
  const t = useT();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/80 px-4 py-10 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-agent-title"
        className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-border bg-surface"
      >
        <div className="border-b border-grid px-7 py-5">
          <p className="font-ui text-[11.5px] text-text-muted">
            {agent.strategy_name}
          </p>
          <h2
            id="delete-agent-title"
            className="pt-1.5 font-ui text-[20px] font-medium leading-none tracking-[-0.01em] text-text-primary"
          >
            {t("ad_delete_title")}
          </h2>
        </div>

        <div className="space-y-4 px-7 py-5">
          <ol className="space-y-2.5">
            {/* Whole sentences per case. The count and the invested figure sit
                in different places in the two languages, so the <Num> wrappers
                that used to mark them cannot survive the reordering — the
                numbers are inside the sentence now, where they read as facts
                being stated rather than as figures to compare. */}
            <Step n="1">
              {open === 0
                ? t("ad_delete_1_empty")
                : open === 1
                  ? t("ad_delete_1_one", { amount: money(investedUsd) })
                  : t("ad_delete_1_many", {
                      count: open,
                      amount: money(investedUsd),
                    })}
            </Step>
            <Step n="2">{t("ad_delete_2")}</Step>
            <Step n="3">{t("ad_delete_3")}</Step>
            {/* Named only when it will actually happen. The server decides that
                — this is the author's last agent on the strategy — because the
                page cannot see the other agents to work it out, and a delete
                that quietly pulls a listing is the surprise worth spending a
                line on. */}
            {agent.delists_strategy ? (
              <Step n="4">
                {/* The STRATEGY's name here, not the agent's: this sentence is about
                    what comes off Explore, and since CANOPY_122 the two can differ. */}
                {t("ad_delete_4", { name: agent.strategy_source_name ?? agent.strategy_name })}
              </Step>
            ) : null}
          </ol>

          <p className="border-t border-grid pt-3.5 font-ui text-[12px] leading-relaxed text-text-dim">
            {t("ad_delete_kept")}
          </p>

          {open > 0 ? (
            <p className="font-ui text-[12px] leading-relaxed text-warning">
              {t("ad_delete_unpriced")}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-grid px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={QUIET}
          >
            {t("common_cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-full border border-negative px-4 font-ui text-[13px] font-medium text-negative transition-colors hover:bg-negative hover:text-bg disabled:opacity-40"
          >
            {busy
              ? t("ad_closing")
              : open > 0
                ? t("ad_delete_confirm_with_positions")
                : t("ad_delete_agent")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Confirm closing the whole book.
 *
 * Separate from the delete modal even though both sell everything, because the
 * two are answering different questions and share only a mechanism. Delete asks
 * "are you finished with this agent"; this asks "do you want to be in cash".
 * Folding them together is how someone ends up deleting an agent they only
 * wanted to flatten.
 */
function FlattenAgentModal({
  agent,
  positions,
  busy,
  onConfirm,
  onClose,
}: {
  agent: AgentDetailPayload["agent"];
  positions: AgentDetailPayload["positions"];
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const open = positions.length;
  const investedUsd = positions.reduce(
    (sum, p) => sum + Number(p.cost_basis_usd),
    0,
  );
  const t = useT();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/80 px-4 py-10 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="flatten-agent-title"
        className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-border bg-surface"
      >
        <div className="border-b border-grid px-7 py-5">
          <p className="font-ui text-[11.5px] text-text-muted">
            {agent.strategy_name}
          </p>
          <h2
            id="flatten-agent-title"
            className="pt-1.5 font-ui text-[20px] font-medium leading-none tracking-[-0.01em] text-text-primary"
          >
            {t("ad_flatten_title")}
          </h2>
        </div>

        <div className="space-y-4 px-7 py-5">
          <ol className="space-y-2.5">
            <Step n="1">
              {open === 1
                ? t("ad_flatten_1_one", { amount: money(investedUsd) })
                : t("ad_flatten_1_many", {
                    count: open,
                    amount: money(investedUsd),
                  })}
            </Step>
            {/* Said plainly because it is the part people do not expect, and the
                part that would otherwise look like a bug an hour later. */}
            <Step n="2">{t("ad_flatten_2")}</Step>
            <Step n="3">{t("ad_flatten_3")}</Step>
          </ol>

          <p className="border-t border-grid pt-3.5 font-ui text-[12px] leading-relaxed text-text-dim">
            {t("ad_flatten_resume")}
          </p>

          <p className="font-ui text-[12px] leading-relaxed text-warning">
            {t("ad_flatten_unpriced")}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-grid px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={QUIET}
          >
            {t("common_cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-full border border-warning px-4 font-ui text-[13px] font-medium text-warning transition-colors hover:bg-warning hover:text-bg disabled:opacity-40"
          >
            {busy ? t("ad_closing") : t("ad_close_all")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="tnum shrink-0 font-mono text-[12px] text-text-muted">
        {n}
      </span>
      <span className="font-ui text-[13px] leading-relaxed text-text-secondary">
        {children}
      </span>
    </li>
  );
}
