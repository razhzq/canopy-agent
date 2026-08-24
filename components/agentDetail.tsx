"use client";

import Link from "next/link";
import { tokenPrice } from "@/lib/format";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ActivityLog } from "@/components/activity";
import { Positions } from "@/components/positions";
import { AddMarketModal } from "@/components/addMarket";
import { GoLiveModal } from "@/components/goLive";
import { WalletBar } from "@/components/walletBar";
import type { UniverseSelection } from "@/lib/api";
import { useIsMobile } from "@/lib/useIsMobile";
import { AgentDetailMobile } from "@/components/agentDetailMobile";
import { EquityView } from "@/components/equity";
import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonAgentDetail } from "@/components/skeleton";
import { AssetLogo } from "@/components/ui";
import { ModelBadge } from "@/components/modelBadge";
import { ModelPanel } from "@/components/modelPanel";
import { usePersonalWallet } from "@/lib/usePersonalWallet";
import {
  DEFAULT_TIMEFRAME,
  RWA_RULES,
  describeAddPlan,
  fmt,
  ruleBasisNote,
  ruleLabel,
  type Timeframe,
} from "@/components/buildStrategy";
import {
  selectionKey,
  selectionLabel,
  selectionIssuer,
  getAgent,
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

export function AgentDetailView({ agentId }: { agentId: number }) {
  const { ready, authenticated, getAccessToken } = usePrivy();
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
      url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash,
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
      url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash,
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
    if (detail.liveTradingEnabled === true && detail.agent.is_paper && !detail.hasLiveHistory) {
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
      const equityPromise = getEquity(token, agentId, book ?? undefined).catch(() => null);

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
            prev.phase === "ready" ? { ...prev, assets, assetsPending: false } : prev,
          );
        })
        .catch(() => {
          /* labels stay as selections; the page is already usable */
          if (seq !== runSeq.current) return;
          setState((prev) => (prev.phase === "ready" ? { ...prev, assetsPending: false } : prev));
        });
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
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
        if (!token) throw new Error("Sign in to change this agent.");
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
    [agentId, getAccessToken, load],
  );

  if (state.phase === "loading") return <SkeletonAgentDetail />;
  if (state.phase === "signed-out") return <SignedOutState note="Sign in to see this agent." />;
  if (state.phase === "error")
    return <ErrorState message={state.message} onRetry={() => void load()} />;

  const { detail, strategy, equity, assets, assetsPending } = state;
  const { agent, positions, wallet, lastRun } = detail;

  // The strategy's universe, resolved against live marks. A selection whose
  // asset is missing from the resolved universe still renders — it is a market
  // the agent holds a mandate for that cannot currently be priced, which is
  // worth seeing, not worth hiding.
  const markets = (strategy?.universe ?? []).map((sel) => ({
    sel,
    // One shared matcher rather than an inline predicate that only understood
    // RWA selections: a crypto pick is identified by its mint, and comparing it
    // on `underlying` — a field a token does not have — never matched.
    asset: assets.find((a) => assetMatchesSelection(a, sel)) ?? null,
  }));

  const rules = strategy?.rules ?? [];
  const anyOf = strategy?.anyOf ?? [];
  const setup = strategy?.setup;
  // A stored rule means nothing without the bar size it was measured on:
  // "RSI ≤ 30" is a fortnight of selling on daily bars and about an hour on
  // 5-minute ones. Absent means daily, as it does everywhere else.
  const timeframe: Timeframe = (strategy?.timeframe as Timeframe) ?? DEFAULT_TIMEFRAME;
  // Absent means one entry per asset — the behaviour of every strategy that
  // does not ask for otherwise.
  const addPlan = strategy?.add_plan ?? null;
  const planSummary = describeAddPlan(addPlan);
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
  const exits = strategy?.exits ?? null;
  const constraints = agent.mandate?.constraints ?? {};

  const capital = Number(agent.capital_usd) || 0;
  // The nearest real thing to a per-market budget: the mandate's position cap,
  // in dollars. It is agent-wide, so every market row shows the same figure —
  // which is the truth, and is why the note under the table says so.
  const positionCap =
    constraints.maxPositionPct && capital ? (capital * constraints.maxPositionPct) / 100 : null;

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
  const liveDisabledReason = !liveTradingEnabled
    ? "Real-money trading isn't open yet"
    : null;
  // Pressing Live means "go live" only on an agent that has never traded live —
  // which, since the transition is one-way, is exactly every paper agent. One
  // rule: the pill shows you a book when there is one, and stands in for the
  // missing one when there is not.
  const goLiveIntent =
    liveTradingEnabled && agent.is_paper && !detail.hasLiveHistory
      ? () => setGoingLive(true)
      : null;
  // A live agent that was deployed straight to live has no paper run behind it.
  const paperDisabledReason = detail.hasPaperHistory || agent.is_paper
    ? null
    : "This agent has no paper run";
  const cadenceSec = strategy?.tick_interval_sec ?? agent.mandate?.tickIntervalSec ?? null;

  if (mobile === null) return null;

  if (mobile) {
    return (
      <AgentDetailMobile
        agent={agent}
        detail={detail}
        equity={equity}
        positions={positions}
        assets={assets}
        assetsPending={assetsPending}
        universe={strategy?.universe ?? []}
        onChanged={() => void load()}
      />
    );
  }

  return (
    <div>
      {/* ------------------------------------------------------------ head -- */}
      <section className="border-b border-grid px-5 sm:px-8 pt-5 pb-5">
        <Link
          href="/workspace"
          className="font-ui text-[12px] text-text-dim transition-colors hover:text-accent"
        >
          ← My agents
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-3">
          <h1 className="font-mono text-[28px] leading-none text-text-primary">
            {agent.strategy_name}
          </h1>
          {/* The badge is the affordance. It is already the thing on this page
              that names the model, so making it the way IN to the model is one
              control rather than two — and a rail row that says "Model: X" next
              to a badge that says X is the page restating itself. */}
          <button
            type="button"
            onClick={() => setModelOpen(true)}
            aria-label={`Model: ${agent.model?.label ?? "cQWEN3"} — open model settings`}
            className="transition-opacity hover:opacity-80"
          >
            <ModelBadge model={agent.model} />
          </button>
          <StatusChip status={agent.status} />
          <div className="flex-1" />
          <WalletBar
            agentId={agentId}
            address={wallet?.address ?? null}
            isPaper={agent.is_paper}
          />
        </div>

        {/* Always both halves, so the reader can see that an agent has two books
            and which one they are looking at. A half with nothing behind it is
            disabled and says why — "not open yet" reads as a stage, where a
            missing half read as a feature that had been taken away. */}
        <div className="pt-4">
          <BookSwitch
            book={detail.book}
            onChange={setBook}
            onGoLive={goLiveIntent}
            paperDisabledReason={paperDisabledReason}
            liveDisabledReason={liveDisabledReason}
            note={
              detail.book === "paper" && detail.hasPaperHistory
                ? "The settled paper run. This agent trades live now."
                : null
            }
          />
        </div>

        {/* An agent waiting for its first deposit is mid-SETUP, not broken —
            so it gets an action, not the breaker's red sentence. It is not
            paused either: it stays scheduled and starts by itself the moment
            the balance lands, which is what the copy has to promise. */}
        {lastRun?.skip_reason === "model_unfunded" ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3">
            <p className="font-ui text-[12.5px] text-warning">
              Waiting for its model balance. {agent.model?.label ?? "The model"} is prepaid — fund
              it and this agent starts on its own, no restart needed.
            </p>
            <button
              type="button"
              onClick={() => setModelOpen(true)}
              className="shrink-0 border border-accent px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
            >
              Top up
            </button>
          </div>
        ) : agent.paused_reason ? (
          <p className="pt-3 font-ui text-[12.5px] text-negative">
            Stopped itself: {agent.paused_reason.replace(/_/g, " ")}.
          </p>
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
            <Rule label="Performance" line={false} />
            <div className="pt-4">
              <EquityView series={equity} positions={positions} universe={assets} />
            </div>
          </section>

          {/* markets */}
          <section className="border-b border-grid px-5 sm:px-8 py-6">
            <Rule label="Positions" />
            <Positions
              agentId={agentId}
              positions={positions}
              universe={assets}
              onChanged={() => void load()}
            />
          </section>

          {/* watching now */}
          <section className="border-b border-grid px-5 sm:px-8 py-6">
            <Rule
              label="Watching now"
              right={
                agent.status === "active" ? (
                  <span className="flex items-center gap-2">
                    <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                    <span className="font-mono text-[11px] text-text-secondary">
                      {agent.last_tick_at ? `checked ${when(agent.last_tick_at)}` : "starting"}
                      {agent.next_tick_at ? ` · next ${ahead(agent.next_tick_at)}` : ""}
                    </span>
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-text-muted">not ticking</span>
                )
              }
            />

            {entry ? (
              <>
                <h2 className="pt-4 font-mono text-[20px] leading-tight text-text-primary">
                  {entryHeadline(entry, markets[0]?.asset?.symbol)}
                </h2>
                <p className="pt-1.5 font-ui text-[13px] text-text-secondary">
                  Entry condition. Nothing is bought until this is met.
                </p>
              </>
            ) : (
              <p className="pt-4 font-ui text-[13px] text-text-secondary">
                This strategy&apos;s rules are not readable — the detail route returned no rule
                set.
              </p>
            )}

            {/* exits are the other half of the contract and are always real */}
            <div className="grid grid-cols-1 gap-2.5 pt-5 sm:grid-cols-2">
              <ExitCard
                label="Exit — take profit"
                body={
                  exits ? (
                    <>
                      Sell at <Num>+{exits.takeProfitPct}%</Num> from entry
                    </>
                  ) : (
                    "Not set — platform default for the posture."
                  )
                }
              />
              <ExitCard
                label="Exit — stop-loss"
                body={
                  exits ? (
                    <>
                      Sell at <Num>−{exits.stopLossPct}%</Num> from entry
                      {exits.maxHoldDays ? `, or after ${exits.maxHoldDays}d` : ""}
                    </>
                  ) : (
                    "Not set — platform default for the posture."
                  )
                }
              />
            </div>

            {constraints.maxDrawdownPct ? (
              <p className="pt-3.5 font-mono text-[11px] text-text-dim">
                Agent-wide breaker at −{constraints.maxDrawdownPct}% from the high-water mark:
                past that it liquidates and stops on its own.
              </p>
            ) : null}
          </section>

          {/* activity */}
          <section className="px-5 sm:px-8 py-6">
            <Rule
              label="Activity"
              right={
                <Link
                  href={`/workspace/${agentId}?tab=cycles`}
                  className="font-mono text-[10.5px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-accent"
                >
                  All cycles →
                </Link>
              }
            />
            <div className="pt-4">
              <ActivityLog agentId={agentId} book={detail.book} />
            </div>
            <p className="pt-4 font-ui text-[12px] text-text-dim">
              Append-only. Every check is recorded, whether it traded or not
              {lastRun?.skip_reason
                ? ` — the last cycle did not trade: ${lastRun.skip_reason.replace(/_/g, " ")}.`
                : "."}
            </p>
          </section>
        </div>

        {/* ------------------------------------------------------- rail -- */}
        <aside className="min-w-0 border-t border-grid px-5 sm:px-8 py-6 lg:border-t-0">
          <Rule label="Strategy · applies to every market" />

          {/* THE WATCH LEG, ABOVE THE ENTRY RULES AND VISUALLY BEFORE THEM.
              A two-stage strategy does not evaluate the rules below until this
              has happened on an earlier bar. Rendering them as one flat list
              would read as "all of these at once", which is the single-stage
              strategy this exists to be different from. */}
          {setup ? (
            <div className="mt-4 border border-accent/40">
              <p className="border-b border-accent/25 px-3.5 py-2 font-mono text-[10.5px] tracking-[0.12em] text-accent uppercase">
                First, wait for
              </p>
              <div className="flex flex-wrap gap-2 p-3.5">
                {setup.arm.map((r) => (
                  <RuleChip key={r.key} rule={r} timeframe={timeframe} />
                ))}
              </div>
              <p className="border-t border-grid px-3.5 py-2 font-ui text-[12px] text-text-muted">
                Then the rules below apply, on a later bar, for up to{" "}
                <Num>{setup.expiresAfterBars}</Num> bars. Nothing is bought on the bar the
                setup appears.
                {setup.invalidateIf?.length
                  ? " The wait is cancelled if the setup breaks down first."
                  : ""}
              </p>
            </div>
          ) : null}

          <div className="mt-4 border border-grid">
            {setup ? (
              <p className="border-b border-grid px-3.5 py-2 font-mono text-[10.5px] tracking-[0.12em] text-text-muted uppercase">
                Then buy when
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 p-3.5">
              {rules.length === 0 && anyOf.length === 0 ? (
                <span className="font-ui text-[12.5px] text-text-muted">No rules returned.</span>
              ) : (
                rules.map((r) => <RuleChip key={r.key} rule={r} timeframe={timeframe} />)
              )}
              {/* Rendered as one chip per GROUP, not per member. Splitting a
                  group into loose chips would show an either/or as a row of
                  conditions indistinguishable from the ANDed ones above — the
                  owner would read their strategy as stricter than it is. */}
              {anyOf.map((group) => (
                <AnyOfChip
                  key={group.map((g) => g.key).join("|")}
                  group={group}
                  timeframe={timeframe}
                />
              ))}
              {exits ? (
                <>
                  <Chip>
                    Take profit: <Num>+{exits.takeProfitPct}%</Num>
                  </Chip>
                  <Chip>
                    Stop-loss: <Num>−{exits.stopLossPct}%</Num>
                  </Chip>
                </>
              ) : null}
              {/* The chart the rules above are measured on. Each rule label
                  already carries it, but a strategy whose rules are all
                  liquidity and margin would otherwise never state it. */}
              <Chip>
                Chart: <Num>{timeframe}</Num>
              </Chip>
            </div>
            {planSummary ? (
              <div className="border-t border-grid px-3.5 py-2.5">
                <p className="font-mono text-[9.5px] tracking-[0.14em] text-text-dim uppercase">
                  Accumulation
                </p>
                <p className="pt-1 font-ui text-[12.5px] leading-relaxed text-text-primary">
                  {planSummary}
                </p>
                {/* The part nobody expects, and the reason the exits above are
                    not what they look like: a position averaged into three
                    times exits as ONE, on the blended cost. */}
                <p className="pt-1 font-ui text-[11.5px] leading-relaxed text-warning">
                  Take profit and stop-loss measure the blend of every entry, not each one
                  separately.
                </p>
              </div>
            ) : null}
            {/* justify-end because the caption that used to sit here was the
                flex spacer holding the button to the right. */}
            <div className="flex items-center justify-end gap-3 border-t border-grid bg-panel px-3.5 py-2.5">
              <Link
                href={`/workspace/${agentId}?tab=chat`}
                className="shrink-0 border border-border px-2.5 py-1.5 font-mono text-[10.5px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:border-accent hover:text-accent"
              >
                Edit strategy
              </Link>
            </div>
          </div>

          {/* THE UNIVERSE, UNDER THE STRATEGY IT IS SCREENED BY.
              It sat in the main column as a two-up grid of cards, which put the
              markets a long way from the only control that changes them. Here it
              reads as what it is — the list this one strategy is pointed at —
              and + Add market is the next thing under it rather than a button
              floating with nothing above it to explain what it adds to.

              A list, not cards: the rail is one column wide, and a card's second
              dimension was being spent on air. */}
          <div className="mt-6 border-t border-grid pt-5">
            <Rule
              label={
                markets.length === 0
                  ? "Universe"
                  : `Screening ${markets.length} ${markets.length === 1 ? "market" : "markets"}`
              }
            />
            {markets.length === 0 ? (
              <p className="pt-3 font-ui text-[12.5px] text-text-secondary">
                No universe is pinned, so the agent screens the whole {agent.strategy_class}{" "}
                class each cycle.
              </p>
            ) : (
              <div className="mt-3 border border-grid">
                {markets.map((m) => (
                  <MarketRow
                    key={selectionKey(m.sel)}
                    label={m.asset ? `${m.asset.symbol}/USDC` : selectionLabel(m.sel)}
                    asset={m.asset}
                    selection={m.sel}
                    entry={entry}
                    // Not offered on the last one. An empty list means "every
                    // market in the class", so removing it would widen the
                    // agent rather than narrow it — the backend refuses, and
                    // offering a button that always fails is worse than not
                    // offering one.
                    onRemove={markets.length > 1 ? () => void removeMarket(m.sel) : undefined}
                    removing={removingKey === selectionKey(m.sel)}
                  />
                ))}
              </div>
            )}
            {removeError ? (
              <p className="pt-3 font-ui text-[12.5px] text-negative" role="alert">
                {removeError}
              </p>
            ) : null}

            {/* Attached to the list rather than spaced off it: adding a market
                is the same act as the rows above, not a separate section. */}
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-2.5 block w-full border border-grid-strong px-4 py-2.5 text-center font-mono text-[11px] tracking-[0.08em] text-text-primary uppercase transition-colors hover:border-accent hover:text-accent"
            >
              + Add market
            </button>
          </div>

          {/* AGENT-LEVEL FACTS, and now the only place they are stated.
              A four-cell band used to sit under the status pill carrying
              Markets, the book's capital, "Live since" and Cadence. Every one
              of them was already on the page: the markets are the list above,
              the capital is the equity header's "against $10,000", and the
              cadence cell's own note ("last ran … · next …") is the live
              readout in the Watching now rule. It was a row of panels restating
              the page back to itself.

              What only the band carried was three plain facts — the tick
              interval, the deployed size and the deploy date — so they are
              rows here rather than a panel each. */}
          <div className="mt-6 border-t border-grid pt-5">
            <Rule label="Agent-level" />
            <div className="pt-3">
              <RailRow
                label="Book"
                value={agent.is_paper ? "Paper · simulated fills" : "Live · real capital"}
              />
              <RailRow label="Capital" value={money(capital)} />
              <RailRow label="Cadence" value={cadenceSec ? cadence(cadenceSec) : "—"} />
              <RailRow label="Deployed" value={absolute(agent.created_at)} />
              <RailRow label="Autonomy" value={agent.autonomy.replace(/_/g, " ")} />
              <RailRow
                label="Position cap"
                value={positionCap === null ? "—" : `≤ ${money(positionCap)} per market`}
              />
              <RailRow
                label="Open positions"
                value={
                  constraints.maxTradesPerTick
                    ? `${positions.length} / ${constraints.maxTradesPerTick}`
                    : String(positions.length)
                }
              />
              {/* What the reasoning costs, where the other per-agent facts are.
                  Only for a bought model: a Canopy agent has no balance, and a
                  row reading "—" would imply one it is missing. */}
              {agent.model && agent.model.provider === "pod" ? (
                <RailRow label="Reasons with" value={agent.model.label} />
              ) : null}
              <RailRow
                label="Compliance"
                value={constraints.complianceProfile ?? "—"}
              />
            </div>
          </div>

        </aside>
      </div>

      <Controls agent={agent} positions={positions} onChanged={() => void load()} />

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
          assets={assets}
          loading={assetsPending}
          existing={strategy?.universe ?? []}
          // Reloads behind the open dialog, so the markets grid and the modal
          // agree the moment a removal lands rather than only after closing.
          onChanged={() => void load()}
          onClose={() => setAdding(false)}
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
          onChanged={() => void load()}
          onClose={() => {
            setGoingLive(false);
            setResumedCheckout(false);
          }}
        />
      ) : null}
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
      if (!token) throw new Error("not signed in");
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
            ? "Nothing was open to close."
            : `Closed ${closed} position${closed === 1 ? "" : "s"}. The agent is paused.`,
        );
        onChanged();
        return;
      }
      await (paused ? resumeAgent(token, agent.id) : pauseAgent(token, agent.id));
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
          className="border border-border px-4 py-2.5 font-mono text-[11px] tracking-[0.08em] text-text-primary uppercase transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
        >
          {busy === "toggle" ? "…" : paused ? "Resume agent" : "Pause agent"}
        </button>
      ) : null}

      {/* Only when there is something to close. A button that can do nothing is
          a button that teaches people it does nothing. */}
      {positions.length > 0 && agent.status !== "deleted" ? (
        <button
          type="button"
          onClick={() => setConfirmFlatten(true)}
          disabled={busy !== null}
          className="border border-border px-4 py-2.5 font-mono text-[11px] tracking-[0.08em] text-text-primary uppercase transition-colors hover:border-warning hover:text-warning disabled:opacity-40"
        >
          {busy === "flatten" ? "…" : "Close all positions"}
        </button>
      ) : null}

      <div className="flex-1" />

      {notice ? (
        <span className="font-mono text-[10.5px] tracking-[0.06em] text-text-dim uppercase">
          {notice}
        </span>
      ) : null}

      {error ? (
        <span className="font-mono text-[10.5px] tracking-[0.06em] text-negative uppercase">
          {error}
        </span>
      ) : null}

      {deletable ? (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="font-mono text-[11px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-negative"
        >
          Delete agent
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

/**
 * A section heading.
 *
 * The rule is what carries the eye from the label to whatever sits on the
 * right — a link, a live readout. With `right` absent it has nothing to carry
 * the eye TO, so it draws a line to the edge of the section for its own sake:
 * `line` turns it off for a heading that is only a label.
 */
function Rule({
  label,
  right,
  line = true,
}: {
  label: string;
  right?: React.ReactNode;
  line?: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
        {label}
      </span>
      {line ? <span className="h-px min-w-0 flex-1 bg-grid" /> : null}
      {right ? <span className="shrink-0">{right}</span> : null}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const running = status === "active";
  return (
    <span
      className={`flex items-center gap-2 px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] uppercase ${
        running
          ? "bg-accent text-bg"
          : status === "paused" || status === "liquidating"
            ? "border border-negative text-negative"
            : "border border-grid-strong text-text-muted"
      }`}
    >
      {running ? <span className="size-1.5 animate-pulse rounded-full bg-bg" /> : null}
      {running ? "Running" : status === "liquidating" ? "Closing out" : status}
    </span>
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
function BookSwitch({
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

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div
        role="group"
        aria-label="Paper or live book"
        className="flex shrink-0 items-center gap-0.5 rounded-full border border-grid p-1"
      >
        {(["paper", "live"] as const).map((b) => {
          const promotes = b === "live" && onGoLive !== null;
          return (
            <Half
              key={b}
              book={b}
              current={book}
              onSelect={() => (promotes ? onGoLive!() : onChange(b))}
              disabledReason={b === "paper" ? paperDisabledReason : liveDisabledReason}
              promotes={promotes}
              onHover={setHovered}
            />
          );
        })}
      </div>
      {hovered ? (
        <p className="font-ui text-[12px] text-text-dim">{hovered}.</p>
      ) : note ? (
        <p className="font-ui text-[12px] text-text-dim">{note}</p>
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
  const active = book === current;
  const label = book === "paper" ? "Paper" : "Live";
  const base =
    "flex h-8 items-center gap-2 rounded-full px-4 font-mono text-[11.5px] tracking-[0.04em] transition-colors";

  if (active) {
    return (
      <span aria-current="true" className={`${base} bg-accent-wash text-accent`}>
        <span className="size-1.5 rounded-full bg-accent" />
        {label}
      </span>
    );
  }

  // What the hover line says. A disabled half explains why it cannot be pressed;
  // a promoting one says what pressing it will DO, since "Live" on an agent that
  // has never traded live is otherwise ambiguous between "show me the live book"
  // and "make this live".
  const hint = disabledReason ?? (promotes ? "Set this agent up to trade real capital" : null);

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
              `${base} text-text-secondary hover:bg-accent-wash hover:text-accent`
            : `${base} text-text-dim hover:text-text-primary`
      }
    >
      {label}
      {promotes ? (
        <span aria-hidden className="font-mono text-[10px] text-text-muted">
          →
        </span>
      ) : null}
    </button>
  );
}

/**
 * One market: the live mark, today's move, and how far that move is from the
 * entry trigger.
 *
 * The meter fills as the move approaches the threshold and turns negative when
 * it is there — the wireframe's "MSTRx is close to firing", carried by the
 * only price data this API actually serves.
 */
/**
 * One screened market, as a row in the rail.
 *
 * Was a card in a two-up grid in the main column. The rail is a single narrow
 * column, so the card's horizontal half was air and its border was drawing a
 * box around one line of text — the rows share one border instead and divide
 * themselves.
 *
 * WHAT SURVIVED THE MOVE, AND WHAT DID NOT
 *
 * The price, the change and the proximity meter are the reason this list is
 * called "screening" rather than "universe", so all three stayed. The card's
 * "waiting on: <rule>" fallback did not: it restated the entry rule for every
 * row, and in the rail those rules are literally the chips directly above this
 * list. The meter still only renders for a dip rule, because "distance to the
 * trigger" is only one-dimensional for one.
 */
function MarketRow({
  label,
  asset,
  selection,
  entry,
  onRemove,
  removing,
}: {
  label: string;
  asset: UniverseAsset | null;
  /** The universe selection, so the logo resolves exactly the way the
      universe did — issuer and identity come from the same source the rest
      of the page uses. */
  selection: UniverseSelection;
  entry: DetectionRule | null;
  /** Absent when removal is not offered — the last market, or a shared strategy. */
  onRemove?: () => void;
  removing?: boolean;
}) {
  const change = asset ? num(asset.changePct) : null;
  const price = asset ? num(asset.priceUsd) : null;

  // `changePct <= -4` — progress is how much of the fall has happened.
  const target = entry && entry.op === "lte" ? entry.value : null;
  const pct =
    target !== null && target < 0 && change !== null
      ? Math.max(0, Math.min(1, change / target))
      : null;
  const fired = pct !== null && pct >= 1;

  return (
    <div className="group border-b border-grid px-3 py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <AssetLogo
            symbol={selectionLabel(selection)}
            issuer={selectionIssuer(selection) ?? asset?.issuer}
            src={asset?.iconUrl}
            size={16}
          />
          <span className="truncate font-mono text-[12px] text-text-primary">{label}</span>
        </span>
        <span
          className={`tnum shrink-0 font-mono text-[12px] ${
            change === null ? "text-text-muted" : change >= 0 ? "text-accent" : "text-negative"
          }`}
        >
          {change === null ? "—" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}%`}
          {target !== null ? <span className="pl-1 text-text-dim">/ {target}%</span> : null}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2 pt-0.5">
        <span className="truncate font-ui text-[11px] text-text-dim">
          {price === null ? "not priced" : tokenPrice(price).display}
        </span>
        {/* Quiet until pointed at. A destructive control on every row competes
            with the prices, which are what the list is for. It holds the second
            line's right edge so revealing it never reflows the row. */}
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            aria-label={`Stop trading ${label}`}
            title="Stop trading this market. Anything held stays open."
            className="shrink-0 font-mono text-[9.5px] tracking-[0.1em] text-text-muted uppercase opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-negative disabled:opacity-40"
          >
            {removing ? "…" : "Remove"}
          </button>
        ) : null}
      </div>

      {pct !== null ? (
        <span className="mt-2 block h-1 w-full bg-grid">
          <span
            className={`block h-1 ${fired ? "bg-negative" : "bg-accent"}`}
            style={{ width: `${pct * 100}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}

function ExitCard({ label, body }: { label: string; body: React.ReactNode }) {
  return (
    <div className="border border-grid p-4">
      <p className="font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase">{label}</p>
      <p className="pt-1.5 font-ui text-[13px] text-text-primary">{body}</p>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-grid-strong px-2.5 py-1.5 font-ui text-[12px] text-text-secondary">
      {children}
    </span>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="tnum font-mono text-[12px] text-text-primary">{children}</span>;
}

/** A stored rule, labelled with the spec the builder set it from. */
function RuleChip({
  rule,
  timeframe = DEFAULT_TIMEFRAME,
}: {
  rule: DetectionRule;
  timeframe?: Timeframe;
}) {
  const spec = RWA_RULES.find((r) => r.key === rule.key);
  // A rule that does not follow the strategy's bar size says so HERE too, not
  // only in the builder. Someone reading a running 15-minute agent sees "Max
  // change on the day ≤ −4%" beside rules measured in minutes, and nothing on
  // the page tells them that one is still asking about the last 24 hours.
  const basisNote = spec ? ruleBasisNote(spec, timeframe) : null;
  return (
    <Chip>
      {spec ? ruleLabel(spec, timeframe) : rule.key}{" "}
      {rule.op === "gte" ? "≥" : rule.op === "lte" ? "≤" : "="}{" "}
      <Num>{spec ? fmt(rule.value, spec.unit) : rule.value}</Num>
      {basisNote ? (
        <span className="pl-1.5 text-text-muted" title={basisNote}>
          · {rule.key === "changePct" ? "24h" : "daily"}
        </span>
      ) : null}
    </Chip>
  );
}

/**
 * An "either of these" group.
 *
 * One chip for the whole group, with the alternatives joined by "or" and the
 * word itself given the accent — the entire difference between this and the
 * chips beside it is that ANY one of these satisfies the strategy, and that
 * distinction has to survive a glance. A group rendered as separate chips reads
 * as additional requirements, which is the opposite of what it means.
 */
function AnyOfChip({
  group,
  timeframe = DEFAULT_TIMEFRAME,
}: {
  group: DetectionRule[];
  timeframe?: Timeframe;
}) {
  return (
    <Chip>
      {group.map((rule, i) => {
        const spec = RWA_RULES.find((r) => r.key === rule.key);
        return (
          <span key={rule.key}>
            {i > 0 ? <span className="px-1 text-accent uppercase">or</span> : null}
            {spec ? ruleLabel(spec, timeframe) : rule.key}{" "}
            {rule.op === "gte" ? "≥" : rule.op === "lte" ? "≤" : "="}{" "}
            <Num>{spec ? fmt(rule.value, spec.unit) : rule.value}</Num>
          </span>
        );
      })}
    </Chip>
  );
}

function RailRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-grid py-2.5 last:border-b-0">
      <span className="shrink-0 font-ui text-[12.5px] text-text-dim">{label}</span>
      <span
        className={`tnum truncate font-mono text-[12.5px] ${
          strong ? "text-accent" : "text-text-primary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/* --------------------------------------------------------------- figures -- */

function entryHeadline(entry: DetectionRule, symbol?: string): string {
  const who = symbol ?? "The market";
  if (entry.key === "changePct" && entry.op === "lte") {
    return `${who} drops ${Math.abs(entry.value)}%+ on the day`;
  }
  const spec = RWA_RULES.find((r) => r.key === entry.key);
  return `${spec?.label ?? entry.key} ${entry.op === "gte" ? "≥" : "≤"} ${entry.value}`;
}

function cadence(sec: number): string {
  if (sec % 86_400 === 0) return `${sec / 86_400}d`;
  if (sec % 3600 === 0) return `${sec / 3600}h`;
  return `${Math.round(sec / 60)} min`;
}

function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function absolute(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function when(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function ahead(iso: string): string {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (mins <= 0) return "due now";
  if (mins < 60) return `in ${mins} min`;
  return `in ${Math.floor(mins / 60)}h`;
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
  const investedUsd = positions.reduce((sum, p) => sum + Number(p.cost_basis_usd), 0);

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
        className="w-full max-w-[560px] border border-grid-strong bg-panel"
      >
        <div className="border-b border-grid px-7 py-5">
          <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            {agent.strategy_name}
          </p>
          <h2
            id="delete-agent-title"
            className="pt-1.5 font-mono text-[20px] leading-none text-text-primary"
          >
            Delete this agent?
          </h2>
        </div>

        <div className="space-y-4 px-7 py-5">
          <ol className="space-y-2.5">
            <Step n="1">
              {open === 0 ? (
                <>It holds nothing, so there is nothing to sell.</>
              ) : (
                <>
                  It closes{" "}
                  <Num>
                    {open} {open === 1 ? "position" : "positions"}
                  </Num>{" "}
                  at the current pool price — <Num>{money(investedUsd)}</Num> invested. This is a
                  real sale and the result lands in your record.
                </>
              )}
            </Step>
            <Step n="2">It revokes its own wallet authority. That cannot be undone here.</Step>
            <Step n="3">It disappears from your agents. Pausing is the reversible option.</Step>
            {/* Named only when it will actually happen. The server decides that
                — this is the author's last agent on the strategy — because the
                page cannot see the other agents to work it out, and a delete
                that quietly pulls a listing is the surprise worth spending a
                line on. */}
            {agent.delists_strategy ? (
              <Step n="4">
                <Num>{agent.strategy_name}</Num> comes off Explore with it — this is your last
                agent on it. Anyone already deployed keeps running; nobody new can deploy.
              </Step>
            ) : null}
          </ol>

          <p className="border-t border-grid pt-3.5 font-ui text-[12px] leading-relaxed text-text-dim">
            Nothing is erased. Every cycle, decision and trade stays on the record, and the
            strategy keeps whatever track record this agent earned.
          </p>

          {open > 0 ? (
            <p className="font-ui text-[12px] leading-relaxed text-warning">
              If a position cannot be priced when you confirm, the agent winds down and stays
              visible instead of being hidden while it still holds something.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-grid px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="font-mono text-[10.5px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-text-primary disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="border border-negative px-4 py-2 font-mono text-[10.5px] tracking-[0.08em] text-negative uppercase transition-colors hover:bg-negative hover:text-bg disabled:opacity-40"
          >
            {busy ? "Closing…" : open > 0 ? "Close positions and delete" : "Delete agent"}
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
  const investedUsd = positions.reduce((sum, p) => sum + Number(p.cost_basis_usd), 0);

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
        className="w-full max-w-[560px] border border-grid-strong bg-panel"
      >
        <div className="border-b border-grid px-7 py-5">
          <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            {agent.strategy_name}
          </p>
          <h2
            id="flatten-agent-title"
            className="pt-1.5 font-mono text-[20px] leading-none text-text-primary"
          >
            Close every position?
          </h2>
        </div>

        <div className="space-y-4 px-7 py-5">
          <ol className="space-y-2.5">
            <Step n="1">
              It sells{" "}
              <Num>
                {open} {open === 1 ? "position" : "positions"}
              </Num>{" "}
              at the current pool price — <Num>{money(investedUsd)}</Num> invested. Real sales,
              and the result lands in your record.
            </Step>
            {/* Said plainly because it is the part people do not expect, and the
                part that would otherwise look like a bug an hour later. */}
            <Step n="2">
              It then <Num>pauses</Num>. Otherwise it would start buying again on its next cycle.
            </Step>
            <Step n="3">The agent, its strategy and its whole record stay exactly as they are.</Step>
          </ol>

          <p className="border-t border-grid pt-3.5 font-ui text-[12px] leading-relaxed text-text-dim">
            Resume it whenever you want. Nothing here is one-way.
          </p>

          <p className="font-ui text-[12px] leading-relaxed text-warning">
            A position that cannot be priced right now is left open rather than sold at a guess.
            The agent keeps trying and stays visible while it settles.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-grid px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="font-mono text-[10.5px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-text-primary disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="border border-warning px-4 py-2 font-mono text-[10.5px] tracking-[0.08em] text-warning uppercase transition-colors hover:bg-warning hover:text-bg disabled:opacity-40"
          >
            {busy ? "Closing…" : "Close all positions"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 font-mono text-[10px] tracking-[0.12em] text-text-dim">{n}</span>
      <span className="font-ui text-[13px] leading-relaxed text-text-secondary">{children}</span>
    </li>
  );
}
