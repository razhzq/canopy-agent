"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ActivityLog } from "@/components/activity";
import { Positions } from "@/components/positions";
import { AddMarketModal } from "@/components/addMarket";
import { GrantDelegation } from "@/components/grantDelegation";
import { LIVE_TRADING_ENABLED } from "@/lib/privy";
import { EquityView } from "@/components/equity";
import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonAgentDetail } from "@/components/skeleton";
import {
  DEFAULT_TIMEFRAME,
  RWA_RULES,
  describeAddPlan,
  fmt,
  ruleLabel,
  type Timeframe,
} from "@/components/buildStrategy";
import {
  getAgent,
  getEquity,
  getStrategy,
  getUniverse,
  num,
  pauseAgent,
  resumeAgent,
  deleteAgent,
  goLive,
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
 * - + ADD MARKET. Universe belongs to the strategy, and a running strategy is
 *   frozen by a database trigger. The only way to change what an agent trades
 *   is to fork it, which produces a new strategy and a new agent — so the panel
 *   says that rather than offering a button that would silently replace the
 *   thing you are looking at.
 * - UPTIME %, LIVE-SINCE GAPS, BILLING. No heartbeat table, no invoice, no
 *   subscription in the agent stack. `created_at` is real, so "live since"
 *   stays; the uptime cell became CADENCE, which is real and is the number that
 *   actually tells you how often it looks.
 * - ROUTE. Chosen in the builder but not yet stored — see pickRoute.tsx. Shown
 *   as unset rather than asserted.
 * - THE PRICE CHART with entry and trigger lines. Nothing in this API serves
 *   per-market price history. The distance-to-trigger meters carry the same
 *   information from the live mark, so the panel keeps the meaning and drops
 *   the candles.
 */

export function AgentDetailView({ agentId }: { agentId: number }) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [adding, setAdding] = useState(false);
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
      }
  >({ phase: "loading" });

  const load = useCallback(async () => {
    if (!ready) return;
    if (!authenticated) {
      setState({ phase: "signed-out" });
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        setState({ phase: "signed-out" });
        return;
      }
      // The agent first: everything else keys off its strategy_id, and it is
      // the one request whose failure means there is no page.
      const detail = await getAgent(token, agentId, book ?? undefined);
      const [strategy, equity, universe] = await Promise.allSettled([
        getStrategy(token, detail.agent.strategy_id),
        getEquity(token, agentId),
        getUniverse(token, detail.agent.strategy_class),
      ]);
      setState({
        phase: "ready",
        detail,
        strategy: strategy.status === "fulfilled" ? strategy.value.strategy : null,
        equity: equity.status === "fulfilled" ? equity.value : null,
        assets: universe.status === "fulfilled" ? universe.value.assets : [],
      });
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [ready, authenticated, getAccessToken, agentId, book]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.phase === "loading") return <SkeletonAgentDetail />;
  if (state.phase === "signed-out") return <SignedOutState note="Sign in to see this agent." />;
  if (state.phase === "error")
    return <ErrorState message={state.message} onRetry={() => void load()} />;

  const { detail, strategy, equity, assets } = state;
  const { agent, positions, wallet, lastRun } = detail;

  // The strategy's universe, resolved against live marks. A selection whose
  // asset is missing from the resolved universe still renders — it is a market
  // the agent holds a mandate for that cannot currently be priced, which is
  // worth seeing, not worth hiding.
  const markets = (strategy?.universe ?? []).map((sel) => ({
    sel,
    asset:
      assets.find((a) => a.underlying === sel.underlying && (!sel.issuer || a.issuer === sel.issuer)) ??
      null,
  }));

  const rules = strategy?.rules ?? [];
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
  const ret30 = return30d(equity);
  const cadenceSec = strategy?.tick_interval_sec ?? agent.mandate?.tickIntervalSec ?? null;

  return (
    <div>
      {/* ------------------------------------------------------------ head -- */}
      <section className="border-b border-grid px-8 pt-5 pb-5">
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
          <StatusChip status={agent.status} />
          <div className="flex-1" />
          <WalletTag address={wallet?.address ?? null} isPaper={agent.is_paper} />
        </div>

        {/* Only once the agent has both books. A paper agent has no live book
            to switch to, and the promotion below is the thing to look at. */}
        {detail.hasPaperHistory ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-4">
            <BookSwitch
              book={detail.book}
              onChange={setBook}
            />
            {detail.book === "paper" ? (
              <p className="font-ui text-[12px] text-text-dim">
                The settled paper run. This agent trades live now.
              </p>
            ) : null}
          </div>
        ) : null}

        {agent.paused_reason ? (
          <p className="pt-3 font-ui text-[12.5px] text-negative">
            Stopped itself: {agent.paused_reason.replace(/_/g, " ")}.
          </p>
        ) : null}
      </section>

      {/* ------------------------------------------------------------ band -- */}
      <div className="grid grid-cols-2 border-b border-grid sm:grid-cols-3 lg:grid-cols-5">
        <Cell
          label="Markets"
          value={
            markets.length === 0
              ? "Whole class"
              : markets
                  .map((m) => m.asset?.symbol ?? m.sel.underlying)
                  .slice(0, 3)
                  .join(" · ")
          }
          big={false}
          note={
            markets.length === 0
              ? "no universe pinned"
              : `${markets.length} ${markets.length === 1 ? "market" : "markets"} · one strategy`
          }
        />
        <Cell
          label={agent.is_paper ? "Paper book" : "Capital"}
          value={money(capital)}
          note={agent.is_paper ? "simulated · nothing funded" : "mandate, set at deploy"}
        />
        <Cell
          label="Return · 30d"
          value={ret30 === null ? "—" : signedPct(ret30)}
          tone={ret30 === null ? undefined : ret30 >= 0 ? "accent" : "negative"}
          note={ret30 === null ? "no readings yet" : "against capital"}
        />
        <Cell
          label="Live since"
          value={age(agent.created_at)}
          note={absolute(agent.created_at)}
        />
        <Cell
          label="Cadence"
          value={cadenceSec ? cadence(cadenceSec) : "—"}
          note={
            agent.last_tick_at
              ? `last ran ${when(agent.last_tick_at)}`
              : "has not run yet"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* ------------------------------------------------------- main -- */}
        <div className="min-w-0 lg:border-r lg:border-grid">
          {/* performance — the series the band's Return · 30d cell already
              summarises, drawn in full. No extra request: `equity` is loaded
              with the rest of the page. */}
          <section className="border-b border-grid px-8 py-6">
            <Rule label="Performance" />
            <div className="pt-4">
              <EquityView series={equity} />
            </div>
          </section>

          {/* markets */}
          <section className="border-b border-grid px-8 py-6">
            <Rule label="Positions" />
            <Positions agentId={agentId} positions={positions} universe={assets} />
          </section>

          {/* watching now */}
          <section className="border-b border-grid px-8 py-6">
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

            {/* The universe, under the condition it is being screened against.
                It used to be its own "Market" section, which asked the same
                question this one answers — and whose proximity bar only ever
                worked for a dip rule, so an RSI or MACD strategy showed a row
                of empty cards. */}
            <div className="pt-5">
              <p className="pb-2 font-mono text-[9.5px] tracking-[0.12em] text-text-dim uppercase">
                {markets.length === 0
                  ? "Universe"
                  : `Screening ${markets.length} ${markets.length === 1 ? "market" : "markets"}`}
              </p>
              {markets.length === 0 ? (
                <p className="font-ui text-[12.5px] text-text-secondary">
                  No universe is pinned, so the agent screens the whole {agent.strategy_class}{" "}
                  class each cycle.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {markets.map((m) => (
                    <MarketCard
                      key={`${m.sel.underlying}/${m.sel.issuer ?? ""}`}
                      label={m.asset ? `${m.asset.symbol}/USDC` : m.sel.underlying}
                      asset={m.asset}
                      entry={entry}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* activity */}
          <section className="px-8 py-6">
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
              <ActivityLog agentId={agentId} />
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
        <aside className="min-w-0 border-t border-grid px-8 py-6 lg:border-t-0">
          <Rule label="Strategy · applies to every market" />

          <div className="mt-4 border border-grid">
            <div className="flex flex-wrap gap-2 p-3.5">
              {rules.length === 0 ? (
                <span className="font-ui text-[12.5px] text-text-muted">No rules returned.</span>
              ) : (
                rules.map((r) => <RuleChip key={r.key} rule={r} timeframe={timeframe} />)
              )}
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

          {/* per-market budgets */}
          <div className="mt-6 border-t border-grid pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
                Per-market budgets
              </span>
              <span className="shrink-0 font-ui text-[11px] text-text-dim">
                {markets.length} {markets.length === 1 ? "market" : "markets"}
              </span>
            </div>

            <div className="grid grid-cols-[minmax(0,1.2fr)_0.9fr_0.7fr_auto] gap-x-3 border-b border-grid-strong pt-3 pb-2 font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase">
              <span>Market</span>
              <span className="text-right">Position</span>
              <span className="text-right">Open / max</span>
              <span />
            </div>

            {markets.length === 0 ? (
              <p className="py-3 font-ui text-[12px] text-text-muted">
                No universe pinned — the cap below applies to whatever it screens into.
              </p>
            ) : (
              markets.map((m) => {
                const symbol = m.asset?.symbol ?? m.sel.underlying;
                const open = positions.filter(
                  (p) => p.underlying === m.sel.underlying || p.symbol === symbol,
                ).length;
                return (
                  <div
                    key={`${m.sel.underlying}/${m.sel.issuer ?? ""}`}
                    className="grid grid-cols-[minmax(0,1.2fr)_0.9fr_0.7fr_auto] items-center gap-x-3 border-b border-grid py-2.5"
                  >
                    <span className="truncate font-ui text-[12.5px] text-text-primary">
                      {m.asset ? `${symbol}/USDC` : symbol}
                    </span>
                    <span className="tnum text-right font-mono text-[12px] text-text-primary">
                      {positionCap === null ? "—" : `≤ ${money(positionCap)}`}
                    </span>
                    <span className="tnum text-right font-mono text-[12px] text-text-secondary">
                      {open} / {constraints.maxTradesPerTick ?? "—"}
                    </span>
                    <Link
                      href={`/workspace/${agentId}?tab=chat`}
                      className="border border-border px-2 py-1 font-mono text-[9.5px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:border-accent hover:text-accent"
                    >
                      Edit
                    </Link>
                  </div>
                );
              })
            )}

            <div className="grid grid-cols-[minmax(0,1.2fr)_0.9fr_0.7fr_auto] items-center gap-x-3 border-b border-grid-strong bg-panel px-2 py-2.5">
              <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                Total capital
              </span>
              <span
                className={`tnum text-right font-mono text-[12.5px] ${
                  agent.is_paper ? "text-text-secondary" : "text-accent"
                }`}
              >
                {money(capital)}
              </span>
              <span />
              <span />
            </div>

            {/* Deployed lived here too until the curve moved onto this page —
                EquityView carries it now, from the same cost bases. */}
            <div className="pt-2">
              <RailRow label="Open positions" value={String(positions.length)} />
            </div>
          </div>

          {/* + Add market */}
          {/* Full width because it is a rail action, but otherwise the same
              shape as every other action on this page — the taller, left-aligned
              box it used to be was sized around a two-line caption that is no
              longer there. */}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-4 block w-full border border-grid-strong px-4 py-2.5 text-center font-mono text-[11px] tracking-[0.08em] text-text-primary uppercase transition-colors hover:border-accent hover:text-accent"
          >
            + Add market
          </button>

          {/* agent-level facts */}
          <div className="mt-6 border-t border-grid pt-5">
            <Rule label="Agent-level" />
            <div className="pt-3">
              <RailRow
                label="Book"
                value={agent.is_paper ? "Paper · simulated fills" : "Live · real capital"}
              />
              <RailRow label="Autonomy" value={agent.autonomy.replace(/_/g, " ")} />
              <RailRow label="Cadence" value={cadenceSec ? cadence(cadenceSec) : "—"} />
              <RailRow
                label="Compliance"
                value={constraints.complianceProfile ?? "—"}
              />
              {/* Route is a builder choice with nowhere to live yet. */}
              <RailRow label="Route" value="Not stored yet" />
            </div>
          </div>

        </aside>
      </div>

      {agent.is_paper ? (
        <GoLive
          agent={agent}
          wallet={wallet}
          openPositions={positions.length}
          onChanged={() => void load()}
        />
      ) : null}

      <Controls agent={agent} positions={positions} onChanged={() => void load()} />

      {adding ? (
        <AddMarketModal
          agentId={agentId}
          agentName={agent.strategy_name}
          assets={assets}
          existing={strategy?.universe ?? []}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- controls -- */

/**
 * Paper → live, on the agent that has been running on paper.
 *
 * Two steps, and they are separate on purpose. Granting the delegation happens
 * in the user's own wallet and gives Canopy permission to sign; promoting the
 * agent is a second, deliberate act afterwards. Collapsing them into one
 * button would mean a single click both hands over signing authority and puts
 * real money behind a strategy — two decisions that deserve to be made
 * separately.
 *
 * WHAT CARRIES OVER IS SAID PLAINLY, because it is the part people get wrong.
 * The agent keeps its rules, its history and everything it learned. Its open
 * paper positions do not come with it: they are holdings it never actually
 * bought, so the backend settles them at real marks first and the live book
 * starts flat.
 */
function GoLive({
  agent,
  wallet,
  openPositions,
  onChanged,
}: {
  agent: AgentDetailPayload["agent"];
  wallet: AgentDetailPayload["wallet"];
  openPositions: number;
  onChanged: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const delegated = wallet?.status === "active";

  async function promote() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("not signed in");
      await goLive(token, agent.id);
      setConfirming(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // Closed for everyone right now. Stated as a product fact rather than shown
  // as a broken button: nothing here is misconfigured, real-money trading is
  // simply not open yet, and the agent is fine as it is.
  if (!LIVE_TRADING_ENABLED) {
    return (
      <section className="border-t border-grid px-8 py-6">
        <p className="font-mono text-[11px] tracking-[0.1em] text-text-dim uppercase">
          Go live
        </p>
        <p className="max-w-[760px] pt-3 font-ui text-[13px] leading-relaxed text-text-secondary">
          Real-money trading isn&apos;t open yet. This agent keeps running on paper, and
          everything it learns counts — when live opens, it carries across with its
          record intact.
        </p>
      </section>
    );
  }

  return (
    <section className="border-t border-grid px-8 py-6">
      <p className="font-mono text-[11px] tracking-[0.1em] text-text-dim uppercase">
        Go live
      </p>

      {!delegated ? (
        <>
          <p className="max-w-[760px] pt-3 pb-5 font-ui text-[13px] leading-relaxed text-text-secondary">
            This agent trades on paper. To trade real capital it needs your permission to
            sign — granted from your own wallet, scoped to swaps, and revocable by you at
            any time without asking Canopy.
          </p>
          <GrantDelegation
            agentId={agent.id}
            maxSpendUsd={Number(agent.capital_usd) || 0}
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
            onGranted={onChanged}
          />
        </>
      ) : !confirming ? (
        <>
          <p className="max-w-[760px] pt-3 pb-5 font-ui text-[13px] leading-relaxed text-text-secondary">
            Delegation granted. Promoting keeps this agent&apos;s rules, history and
            everything it learned on paper
            {openPositions > 0 ? (
              <>
                {" "}
                — but its {openPositions} open paper position
                {openPositions === 1 ? "" : "s"} will be settled first, so the live book
                starts flat.
              </>
            ) : (
              "."
            )}
          </p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="border border-accent px-5 py-3 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-black"
          >
            Go live
          </button>
        </>
      ) : (
        <>
          <p className="max-w-[760px] pt-3 pb-5 font-ui text-[13px] leading-relaxed text-warning">
            From the next tick this agent trades real money, up to{" "}
            {money(Number(agent.capital_usd) || 0)}. You can pause it at any time, and
            the paper book stays readable. This cannot be undone — an agent does not go
            back to paper.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void promote()}
              disabled={busy}
              className="border border-warning px-5 py-3 font-mono text-[11px] tracking-[0.1em] text-warning uppercase transition-colors hover:bg-warning hover:text-black disabled:opacity-40"
            >
              {busy ? "Settling…" : "Yes, trade real money"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="px-2 font-mono text-[11px] tracking-[0.08em] text-text-dim uppercase hover:text-text-primary disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {error ? (
        <p className="pt-4 font-ui text-[13px] text-negative" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

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

  const paused = agent.status === "paused";

  async function run(kind: "toggle" | "delete") {
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
      await (paused ? resumeAgent(token, agent.id) : pauseAgent(token, agent.id));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirmDelete(false);
    } finally {
      setBusy(null);
    }
  }

  const deletable = agent.status !== "deleted";

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-grid px-8 py-4">
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

      <Link
        href={`/workspace/${agent.id}?tab=chat`}
        className="border border-border px-4 py-2.5 font-mono text-[11px] tracking-[0.08em] text-text-primary uppercase transition-colors hover:border-accent hover:text-accent"
      >
        Edit limits
      </Link>
      <div className="flex-1" />

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

function Rule({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
        {label}
      </span>
      <span className="h-px min-w-0 flex-1 bg-grid" />
      {right ? <span className="shrink-0">{right}</span> : null}
    </div>
  );
}

function Cell({
  label,
  value,
  note,
  tone,
  big = true,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "accent" | "negative";
  big?: boolean;
}) {
  return (
    <div className="border-r border-grid px-6 py-4 last:border-r-0">
      <p className="font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase">{label}</p>
      <p
        className={`tnum truncate pt-1.5 font-mono leading-none ${
          big ? "text-[24px]" : "text-[15px]"
        } ${
          tone === "accent"
            ? "text-accent"
            : tone === "negative"
              ? "text-negative"
              : "text-text-primary"
        }`}
      >
        {value}
      </p>
      {note ? <p className="truncate pt-1.5 font-ui text-[11px] text-text-dim">{note}</p> : null}
    </div>
  );
}

/**
 * Run state only — is it ticking.
 *
 * It used to say "Live" for an active agent, which collided head-on with the
 * live/paper BOOK now sitting beside it: "Live · Paper" read as a contradiction
 * when it only meant "a running paper agent". Running is the unambiguous word.
 */
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
 * So this IS a display filter now, and switching refetches the same agent for
 * the other book rather than navigating anywhere.
 *
 * It only appears once there is something to switch to. A paper agent has no
 * live book yet, and offering a half that can only ever be empty invites the
 * reading that live is broken rather than not-yet.
 */
function BookSwitch({
  book,
  onChange,
}: {
  book: "paper" | "live";
  onChange: (book: "paper" | "live") => void;
}) {
  return (
    <div
      role="group"
      aria-label="Paper or live book"
      className="flex shrink-0 items-center gap-0.5 rounded-full border border-grid p-1"
    >
      {(["paper", "live"] as const).map((b) => (
        <Half key={b} book={b} current={book} onChange={onChange} />
      ))}
    </div>
  );
}

function Half({
  book,
  current,
  onChange,
}: {
  book: "paper" | "live";
  current: "paper" | "live";
  onChange: (book: "paper" | "live") => void;
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

  return (
    <button
      type="button"
      onClick={() => onChange(book)}
      className={`${base} text-text-dim hover:text-text-primary`}
    >
      {label}
    </button>
  );
}

function WalletTag({ address, isPaper }: { address: string | null; isPaper: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!address) {
    // Nothing at all on a paper agent: having no wallet is the correct state
    // there, and a header slot that only ever says so is noise. On a LIVE agent
    // it is worth saying — real capital with nowhere to sign from is a fault.
    if (isPaper) return null;
    return <span className="font-ui text-[12px] text-text-dim">No wallet provisioned</span>;
  }
  return (
    <span className="flex items-center gap-2.5">
      <span className="font-mono text-[12.5px] text-text-secondary">
        {address.slice(0, 4)}…{address.slice(-4)}
      </span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard
            ?.writeText(address)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            })
            .catch(() => {
              /* clipboard blocked */
            });
        }}
        className="border border-border px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:border-accent hover:text-accent"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
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
function MarketCard({
  label,
  asset,
  entry,
}: {
  label: string;
  asset: UniverseAsset | null;
  entry: DetectionRule | null;
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
    <div className="border border-grid p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate font-mono text-[13px] text-text-primary">{label}</span>
        <span
          className={`tnum shrink-0 font-mono text-[12.5px] ${
            change === null ? "text-text-muted" : change >= 0 ? "text-accent" : "text-negative"
          }`}
        >
          {change === null ? "—" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}%`}
          {target !== null ? (
            <span className="pl-1 text-text-dim"> / {target}%</span>
          ) : null}
        </span>
      </div>

      <p className="truncate pt-1 font-ui text-[11.5px] text-text-dim">
        {price === null ? "not priced" : `$${price.toFixed(2)}`}
      </p>

      {pct !== null ? (
        <span className="mt-3 block h-1.5 w-full bg-grid">
          <span
            className={`block h-1.5 ${fired ? "bg-negative" : "bg-accent"}`}
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
  return (
    <Chip>
      {spec ? ruleLabel(spec, timeframe) : rule.key}{" "}
      {rule.op === "gte" ? "≥" : rule.op === "lte" ? "≤" : "="}{" "}
      <Num>{spec ? fmt(rule.value, spec.unit) : rule.value}</Num>
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

/** Return across the trailing 30 days, against the reading 30 days back. */
function return30d(equity: EquitySeries | null): number | null {
  const points = equity?.points ?? [];
  if (points.length === 0) return null;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const before = [...points].reverse().find((p) => new Date(p.at).getTime() <= cutoff);
  const base = before ?? points[0];
  if (!base.equityUsd) return null;
  return ((points[points.length - 1].equityUsd - base.equityUsd) / base.equityUsd) * 100;
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

function signedPct(n: number): string {
  return `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(1)}%`;
}

function age(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  return `${days}d`;
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
 * Deleting does three irreversible things, and a user who only reads the button
 * would expect one of them. So each is named, in the order it happens, with the
 * actual position count and cost rather than a general caution — "3 positions,
 * $4,513" is a fact somebody can weigh; "you may have open positions" is not.
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

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 font-mono text-[10px] tracking-[0.12em] text-text-dim">{n}</span>
      <span className="font-ui text-[13px] leading-relaxed text-text-secondary">{children}</span>
    </li>
  );
}
