"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { EquityCurve, MiniCurve } from "@/components/charts";
import { EmptyState, ErrorState, SignedOutState } from "@/components/states";
import { SkeletonRows } from "@/components/skeleton";
import { Badge, Breadcrumb, Columns, RailSection } from "@/components/ui";
import {
  getAgent,
  getAllMarkets,
  getEquity,
  listAgents,
  num,
  type AgentDetail,
  type AgentRow,
  type EquitySeries,
  type UniverseAsset,
} from "@/lib/api";
import { useUsername } from "@/lib/useUsername";
import {
  aggregateEquityPath,
  markAgent,
  movedOverUsd,
  recentSettlements,
  type AgentMark,
} from "@/lib/perf";

/**
 * The portfolio overview — everything you own, as one position.
 *
 * NOT A SECOND "MY AGENTS". That page (/workspace) answers "what is each agent
 * doing, and does any of them need me" — status, cadence, wallet, unanswered
 * proposals. This one answers "how is my capital doing", which no screen
 * answered before: an aggregate curve, where the money is allocated, what the
 * open book is carrying, and what settled recently. Both list your agents
 * because both are about your agents; the columns are different because the
 * questions are.
 *
 * The figures come from `lib/perf`, which is also what the agent page's equity
 * panel uses. That is deliberate — see `markAgent`. A portfolio that computed
 * an agent differently from the agent's own page would be a bug that took a
 * spreadsheet to find.
 */

/** How many per-agent requests are in flight at once. */
const CONCURRENCY = 6;

async function pooled<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await work(items[i]);
    }
  });
  await Promise.all(runners);
  return out;
}

interface Holding {
  agent: AgentRow;
  positions: AgentDetail["positions"];
  series: EquitySeries | null;
  /** Null until the agent has completed a cycle — a real state, not a failure. */
  mark: AgentMark | null;
}

type Tab = "live" | "paused" | "archived";

const TAB_STATUS: Record<Tab, AgentRow["status"][]> = {
  live: ["active"],
  paused: ["paused", "liquidating"],
  archived: ["stopped", "draft"],
};

const RANGES = [
  { key: "24H", ms: 86_400_000 },
  { key: "7D", ms: 7 * 86_400_000 },
  { key: "30D", ms: 30 * 86_400_000 },
  { key: "ALL", ms: Infinity },
] as const;

export function PortfolioOverview() {
  const { ready, authenticated, getAccessToken, user } = usePrivy();
  const { username } = useUsername();

  // Held in a ref for the same reason MyAgents does it: `load` is a dependency
  // of the effect that runs it, and Privy hands back a new closure every
  // render — listing it would turn "fetch once" into a loop, and this fetch is
  // listAgents plus two requests per agent.
  const tokenRef = useRef(getAccessToken);
  tokenRef.current = getAccessToken;

  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "signed-out" }
    | { phase: "error"; message: string }
    | { phase: "ready"; holdings: Holding[]; universe: UniverseAsset[] }
  >({ phase: "loading" });

  const [tab, setTab] = useState<Tab>("live");
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30D");

  const load = useCallback(async () => {
    if (!ready) return;
    if (!authenticated) {
      setState({ phase: "signed-out" });
      return;
    }
    try {
      const token = await tokenRef.current();
      if (!token) {
        setState({ phase: "signed-out" });
        return;
      }

      const [{ agents }, universe] = await Promise.all([
        listAgents(token),
        // Settled separately: without prices the page still renders, it just
        // falls back to each agent's last settled snapshot. Losing the whole
        // portfolio because one price feed is down would be the wrong trade.
        getAllMarkets(token).catch(() => [] as UniverseAsset[]),
      ]);

      const holdings = await pooled(agents, CONCURRENCY, async (agent): Promise<Holding> => {
        const [detail, equity] = await Promise.allSettled([
          getAgent(token, agent.id),
          getEquity(token, agent.id),
        ]);
        const positions = detail.status === "fulfilled" ? detail.value.positions : [];
        const series = equity.status === "fulfilled" ? equity.value : null;
        return { agent, positions, series, mark: markAgent(series, positions, universe) };
      });

      setState({ phase: "ready", holdings, universe });
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [ready, authenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  // Kept current, and refreshed on the way back into the tab — the same
  // treatment /workspace gets, and for the same reason: this is a page people
  // leave open, and a stale portfolio total is worse than a stale list.
  useEffect(() => {
    const id = setInterval(() => void load(), 60_000);
    let lastAt = 0;
    const onReturn = () => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastAt < 1000) return;
      lastAt = now;
      void load();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [load]);

  const holdings = state.phase === "ready" ? state.holdings : [];

  const totals = useMemo(() => summarise(holdings), [holdings]);

  if (state.phase === "loading")
    return (
      <SkeletonRows
        label="Loading your portfolio"
        band={4}
        cols="minmax(0,1.6fr) 110px 110px 110px 90px 130px 90px"
      />
    );
  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "error")
    return <ErrorState message={state.message} onRetry={() => void load()} />;

  if (holdings.length === 0) {
    return (
      <div className="px-8 py-10">
        <EmptyState
          title="Nothing deployed yet"
          body="Your portfolio is the sum of your agents. Build one and it starts on live data in paper mode — free, and nothing funded."
          action={{ label: "Create agent", href: "/build/new" }}
        />
      </div>
    );
  }

  const cutoff = RANGES.find((r) => r.key === range)!.ms;
  const path = totals.path.filter(
    (p) => cutoff === Infinity || Date.now() - new Date(p.at).getTime() <= cutoff,
  );
  // A window that captured one reading or none cannot be drawn; fall back to
  // the whole path rather than to an empty frame that looks like a failure.
  const drawn = path.length > 1 ? path : totals.path;
  const windowed = drawn !== totals.path;

  const settlements = recentSettlements(
    holdings
      .filter((h) => h.mark)
      .map((h) => ({
        id: h.agent.id,
        name: h.agent.strategy_name,
        points: h.mark!.points,
      })),
  );

  const rows = holdings.filter((h) => TAB_STATUS[tab].includes(h.agent.status));

  return (
    <div>
      <PortfolioHeader
        user={user}
        username={username}
        totals={totals}
        onExport={() => exportCsv(holdings)}
      />

      <Columns
        main={
          <>
            {/* ------------------------------------------------- curve -- */}
            <section className="border-b border-grid px-8 py-7">
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                <div className="space-y-2">
                  <p className="font-mono text-[9px] tracking-[0.14em] text-text-dim uppercase">
                    Aggregate equity · settled per cycle ·{" "}
                    {totals.counted} {totals.counted === 1 ? "agent" : "agents"}
                  </p>
                  <p className="tnum font-mono text-[32px] leading-none text-text-primary">
                    {money(totals.equityUsd)}
                  </p>
                  <p
                    className={`tnum font-mono text-[12.5px] ${
                      totals.pnlUsd >= 0 ? "text-accent" : "text-negative"
                    }`}
                  >
                    {signed(totals.pnlUsd)} · {signedPct(totals.returnPct)} against{" "}
                    {money(totals.capitalUsd)} deployed
                  </p>
                </div>

                <div className="flex border border-grid-strong">
                  {RANGES.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setRange(r.key)}
                      aria-pressed={range === r.key}
                      className={`px-3 py-2 font-mono text-[9.5px] tracking-[0.1em] uppercase transition-colors ${
                        range === r.key
                          ? "bg-surface-2 text-text-primary"
                          : "text-text-dim hover:text-text-secondary"
                      }`}
                    >
                      {r.key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <EquityCurve
                  values={drawn.map((p) => p.equityUsd)}
                  baseline={totals.capitalUsd}
                  height={240}
                />
                <div className="flex items-center justify-between pt-3 font-mono text-[9.5px] tracking-[0.08em] text-text-dim uppercase">
                  <span>{drawn.length > 0 ? day(drawn[0].at) : "—"}</span>
                  <span>
                    {totals.marked ? "Marked live" : `Marked at last cycle`} ·{" "}
                    {drawn.length} {drawn.length === 1 ? "reading" : "readings"}
                  </span>
                </div>
              </div>

              {/* The one thing a reader could get wrong about this chart, said
                  plainly rather than left to be inferred from a jump. */}
              <p className="pt-4 font-ui text-[11.5px] leading-relaxed text-text-dim">
                The dashed rule is capital deployed. Each agent contributes only what it has
                made, so funding a new one does not read as a gain — which also means the
                early curve shows today&rsquo;s capital carrying an older P&amp;L, not the
                balance at the time.
                {windowed ? " Showing the full history: this window held too few readings." : ""}
              </p>
            </section>

            {/* ------------------------------------------------ agents -- */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-grid px-8">
                <div className="flex">
                  {(Object.keys(TAB_STATUS) as Tab[]).map((t) => {
                    const n = holdings.filter((h) =>
                      TAB_STATUS[t].includes(h.agent.status),
                    ).length;
                    const on = tab === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        aria-pressed={on}
                        className={`flex items-center gap-2 border-b-2 px-5 py-4 font-mono text-[10.5px] tracking-[0.1em] uppercase transition-colors ${
                          on
                            ? "border-accent text-text-primary"
                            : "border-transparent text-text-dim hover:text-text-secondary"
                        }`}
                      >
                        {t}
                        <span className={on ? "text-accent" : "text-text-dim"}>{n}</span>
                      </button>
                    );
                  })}
                </div>
                <Link
                  href="/workspace"
                  className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:text-accent"
                >
                  Manage agents →
                </Link>
              </div>

              <AgentTable rows={rows} tab={tab} />
            </section>
          </>
        }
        rail={
          <>
            <Allocation holdings={holdings} totals={totals} />
            <Exposure holdings={holdings} universe={state.universe} totals={totals} />
            <Settlements settlements={settlements} />
          </>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------- summary --- */

interface Totals {
  capitalUsd: number;
  equityUsd: number;
  pnlUsd: number;
  realizedUsd: number;
  unrealizedUsd: number;
  returnPct: number;
  openBookUsd: number;
  idleUsd: number;
  counted: number;
  cycles: number;
  marked: boolean;
  allPaper: boolean;
  path: ReturnType<typeof aggregateEquityPath>;
}

/**
 * The portfolio's figures.
 *
 * Percentages are never averaged — see the note at the top of lib/perf — so the
 * return is one division of summed dollars by summed capital.
 *
 * Agents with no readings still count toward capital. A freshly deployed agent
 * holds real money and has simply not settled a cycle yet; leaving it out would
 * make the total capital disagree with the allocation list beside it.
 */
function summarise(holdings: Holding[]): Totals {
  const counted = holdings.filter(
    (h) => h.agent.status !== "stopped" && h.agent.status !== "draft",
  );

  let capitalUsd = 0;
  let pnlUsd = 0;
  let realizedUsd = 0;
  let unrealizedUsd = 0;
  let openBookUsd = 0;
  let cycles = 0;
  let marked = true;

  for (const h of counted) {
    capitalUsd += num(h.agent.capital_usd) ?? 0;
    if (!h.mark) continue;
    pnlUsd += h.mark.pnlUsd;
    realizedUsd += h.mark.realizedPnlUsd;
    unrealizedUsd += h.mark.unrealizedPnlUsd;
    openBookUsd += h.mark.openBookUsd ?? 0;
    cycles += h.mark.points.length;
    if (!h.mark.marked) marked = false;
  }

  const equityUsd = capitalUsd + pnlUsd;

  return {
    capitalUsd,
    equityUsd,
    pnlUsd,
    realizedUsd,
    unrealizedUsd,
    returnPct: capitalUsd ? (pnlUsd / capitalUsd) * 100 : 0,
    openBookUsd,
    // What is not in a position right now. Equity minus the marked book, never
    // below zero: a partially priced book can otherwise produce a negative
    // "idle", which is arithmetic showing through as a fact.
    idleUsd: Math.max(equityUsd - openBookUsd, 0),
    counted: counted.length,
    cycles,
    marked,
    allPaper: counted.length > 0 && counted.every((h) => h.agent.is_paper),
    path: aggregateEquityPath(
      counted.filter((h) => h.mark).map((h) => h.mark!),
      capitalUsd,
    ),
  };
}

/* -------------------------------------------------------------- header --- */

function PortfolioHeader({
  user,
  username,
  totals,
  onExport,
}: {
  user: ReturnType<typeof usePrivy>["user"];
  username: string | null;
  totals: Totals;
  onExport: () => void;
}) {
  const identity = identityOf(user);
  // The page is titled with who you are, not with how you signed in.
  const title = username ?? identity.name;

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-b border-grid px-8 pt-6 pb-6">
      <div className="min-w-0 space-y-3">
        <Breadcrumb parts={["Portfolio", "Overview"]} />

        <div className="flex items-center gap-3">
          <h1 className="font-mono text-[28px] leading-none tracking-[-0.02em] text-text-primary">
            {title}
          </h1>
          {/* Says what the money actually is. The badge is not decoration: a
              paper portfolio and a funded one look identical on this page. */}
          <Badge tone={totals.allPaper ? "simulated" : "accent"}>
            {totals.allPaper ? "Paper" : "Live"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
          <Meta label="Agents" value={String(totals.counted)} />
          <Meta label="Cycles settled" value={totals.cycles.toLocaleString("en-US")} />
          <Meta label="Open book" value={money(totals.openBookUsd)} />
          <Meta label="Idle" value={money(totals.idleUsd)} />
          {identity.wallet ? <Meta label="Wallet" value={identity.wallet} /> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          className="border border-grid-strong px-3 py-2 font-mono text-[10.5px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:border-accent hover:text-accent"
        >
          Export CSV
        </button>
        <Link
          href="/build/new"
          className="bg-accent px-3.5 py-2 font-mono text-[10.5px] tracking-[0.08em] text-bg uppercase transition-opacity hover:opacity-90"
        >
          New agent
        </Link>
      </div>
    </header>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-2">
      <span>{label}</span>
      <span className="tnum text-text-secondary">{value}</span>
    </span>
  );
}

/* --------------------------------------------------------------- table --- */

/* Stacked in two columns on a narrow screen, the real table from lg up.
   Written as a class rather than an inline style so the responsive variant can
   actually win — an inline `gridTemplateColumns` beats every breakpoint. */
const COLS =
  "grid-cols-2 gap-y-2 lg:grid-cols-[minmax(0,1.6fr)_110px_110px_110px_90px_130px_90px] lg:gap-y-0";

function AgentTable({ rows, tab }: { rows: Holding[]; tab: Tab }) {
  if (rows.length === 0) {
    return (
      <p className="px-8 py-10 text-center font-ui text-[13px] text-text-dim">
        {tab === "live"
          ? "No agents running right now."
          : tab === "paused"
            ? "Nothing paused."
            : "Nothing archived."}
      </p>
    );
  }

  return (
    <div>
      <div
        className={`grid gap-x-4 border-b border-grid px-8 py-3 font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase max-lg:hidden ${COLS}`}
      >
        <span>Agent</span>
        <span className="text-right">Deployed</span>
        <span className="text-right">Equity</span>
        <span className="text-right">24h</span>
        <span className="text-right">Return</span>
        <span>Equity curve</span>
        <span className="text-right">Status</span>
      </div>

      {rows.map((h) => (
        <AgentRowLine key={h.agent.id} holding={h} />
      ))}
    </div>
  );
}

function AgentRowLine({ holding }: { holding: Holding }) {
  const { agent, mark } = holding;
  const moved = mark ? movedOverUsd(mark.points, Date.now() - 86_400_000) : null;
  const up = (mark?.pnlUsd ?? 0) >= 0;

  return (
    <Link
      href={`/workspace/${agent.id}`}
      className={`grid items-center gap-x-4 border-b border-grid px-8 py-4 transition-colors hover:bg-surface ${COLS}`}
    >
      <>
        <div className="min-w-0">
          <p className="truncate font-mono text-[13px] text-text-primary">
            {agent.strategy_name}
          </p>
          <p className="truncate pt-1 font-mono text-[9.5px] tracking-[0.06em] text-text-dim uppercase">
            {agent.strategy_class} · {agent.is_paper ? "paper" : "live"}
            {mark ? ` · cycle ${mark.points[mark.points.length - 1].tickSeq}` : ""}
          </p>
        </div>

        <span className="tnum text-right font-mono text-[12.5px] text-text-secondary">
          {money(num(agent.capital_usd) ?? 0)}
        </span>
        <span className="tnum text-right font-mono text-[13px] text-text-primary">
          {mark ? money(mark.equityUsd) : "—"}
        </span>
        <span
          className={`tnum text-right font-mono text-[12.5px] ${
            moved === null ? "text-text-dim" : moved >= 0 ? "text-accent" : "text-negative"
          }`}
        >
          {moved === null ? "—" : signed(moved)}
        </span>
        <span
          className={`tnum text-right font-mono text-[12.5px] ${
            mark ? (mark.returnPct >= 0 ? "text-accent" : "text-negative") : "text-text-dim"
          }`}
        >
          {mark ? signedPct(mark.returnPct) : "—"}
        </span>

        <span className="flex items-center">
          {mark && mark.points.length > 1 ? (
            <MiniCurve
              values={mark.points.map((p) => p.equityUsd)}
              tone={up ? "accent" : "negative"}
              width={120}
              height={28}
            />
          ) : (
            <span className="font-mono text-[10px] text-text-dim">no readings</span>
          )}
        </span>

        <span className="flex justify-end">
          <Badge tone={STATUS_TONE[agent.status]}>{agent.status}</Badge>
        </span>
      </>
    </Link>
  );
}

const STATUS_TONE: Record<AgentRow["status"], "accent" | "warning" | "negative" | "muted"> = {
  active: "accent",
  paused: "warning",
  liquidating: "negative",
  stopped: "muted",
  draft: "muted",
  deleted: "muted",
};

/* ---------------------------------------------------------------- rail --- */

function Allocation({ holdings, totals }: { holdings: Holding[]; totals: Totals }) {
  const base = totals.capitalUsd + totals.idleUsd;
  const rows = holdings
    .filter((h) => h.agent.status !== "stopped" && h.agent.status !== "draft")
    .map((h) => ({
      id: h.agent.id,
      name: h.agent.strategy_name,
      klass: h.agent.strategy_class,
      usd: num(h.agent.capital_usd) ?? 0,
    }))
    .sort((a, b) => b.usd - a.usd);

  return (
    <RailSection title="Capital allocation" note={`${money(totals.capitalUsd)} deployed`}>
      <div className="space-y-3.5 pt-2">
        {rows.map((r) => (
          <Bar
            key={r.id}
            label={r.name}
            tag={r.klass}
            value={money(r.usd)}
            pct={base ? (r.usd / base) * 100 : 0}
          />
        ))}
        {/* Idle closes the sum: deployed plus idle is the whole portfolio, so
            the bars add up to one bar's width rather than to some fraction of
            it that the reader has to account for. */}
        <div className="border-t border-grid pt-3.5">
          <Bar
            label="idle · unallocated"
            tag="cash"
            value={money(totals.idleUsd)}
            pct={base ? (totals.idleUsd / base) * 100 : 0}
            muted
          />
        </div>
      </div>
    </RailSection>
  );
}

function Bar({
  label,
  tag,
  value,
  pct,
  muted = false,
}: {
  label: string;
  tag: string;
  value: string;
  pct: number;
  muted?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-mono text-[11.5px] text-text-primary">{label}</span>
          <span className="shrink-0 font-mono text-[8.5px] tracking-[0.1em] text-text-dim uppercase">
            {tag}
          </span>
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          <span className="tnum font-mono text-[11.5px] text-text-secondary">{value}</span>
          <span className="tnum font-mono text-[10px] text-text-dim">{pct.toFixed(0)}%</span>
        </span>
      </div>
      <div className="h-1 w-full bg-grid">
        <div
          className={`h-1 ${muted ? "bg-text-dim/70" : "bg-accent/75"}`}
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

function Exposure({
  holdings,
  universe,
  totals,
}: {
  holdings: Holding[];
  universe: UniverseAsset[];
  totals: Totals;
}) {
  // One line per symbol, not per lot: the same asset held by three agents is
  // one exposure, and that is the number that matters for concentration.
  const priced = new Map(universe.map((a) => [a.symbol, num(a.priceUsd)]));
  const bySymbol = new Map<string, { usd: number; pnl: number; agents: number }>();

  for (const h of holdings) {
    for (const p of h.positions) {
      const qty = num(p.qty);
      const cost = num(p.cost_basis_usd) ?? 0;
      const mark = priced.get(p.symbol) ?? null;
      const usd = mark !== null && qty !== null ? mark * qty : cost;
      const row = bySymbol.get(p.symbol) ?? { usd: 0, pnl: 0, agents: 0 };
      row.usd += usd;
      row.pnl += usd - cost;
      row.agents += 1;
      bySymbol.set(p.symbol, row);
    }
  }

  const rows = [...bySymbol.entries()].sort((a, b) => b[1].usd - a[1].usd).slice(0, 6);
  const positions = [...bySymbol.values()].reduce((s, r) => s + r.agents, 0);

  return (
    <RailSection
      title="Open exposure"
      note={`${positions} ${positions === 1 ? "position" : "positions"}`}
    >
      {rows.length === 0 ? (
        <p className="pt-2 font-ui text-[12.5px] text-text-dim">
          Nothing open. Every agent is in cash.
        </p>
      ) : (
        <>
          <div className="flex gap-6 pt-2 pb-4">
            <Figure label="Open book" value={money(totals.openBookUsd)} />
            <Figure
              label="Unrealised"
              value={signed(totals.unrealizedUsd)}
              tone={totals.unrealizedUsd >= 0 ? "accent" : "negative"}
            />
            <Figure label="Realised" value={signed(totals.realizedUsd)} tone={
              totals.realizedUsd >= 0 ? "accent" : "negative"
            } />
          </div>
          <div className="border-t border-grid">
            {rows.map(([symbol, r]) => (
              <div
                key={symbol}
                className="flex items-center gap-3 border-b border-grid py-2.5 last:border-b-0"
              >
                <span className="w-[84px] shrink-0 truncate font-mono text-[11.5px] text-text-primary">
                  {symbol}
                </span>
                <span className="min-w-0 flex-1 font-mono text-[9px] tracking-[0.1em] text-text-dim uppercase">
                  {r.agents} {r.agents === 1 ? "agent" : "agents"}
                </span>
                <span className="tnum w-[64px] shrink-0 text-right font-mono text-[11.5px] text-text-secondary">
                  {money(r.usd)}
                </span>
                <span
                  className={`tnum w-[70px] shrink-0 text-right font-mono text-[11.5px] ${
                    r.pnl >= 0 ? "text-accent" : "text-negative"
                  }`}
                >
                  {signed(r.pnl)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </RailSection>
  );
}

function Figure({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "accent" | "negative";
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[8.5px] tracking-[0.12em] text-text-dim uppercase">{label}</p>
      <p
        className={`tnum font-mono text-[14px] ${
          tone === "accent"
            ? "text-accent"
            : tone === "negative"
              ? "text-negative"
              : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Settlements({
  settlements,
}: {
  settlements: ReturnType<typeof recentSettlements>;
}) {
  return (
    <RailSection title="Recent settlements" note="last cycles">
      {settlements.length === 0 ? (
        <p className="pt-2 font-ui text-[12.5px] text-text-dim">
          No cycles have settled yet.
        </p>
      ) : (
        <div className="pt-1">
          {settlements.map((s) => (
            <Link
              key={`${s.agentId}-${s.tickSeq}`}
              href={`/portfolio/${s.agentId}/cycles`}
              className="flex items-center gap-3 border-b border-grid py-2.5 transition-colors last:border-b-0 hover:bg-surface"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[11.5px] text-text-primary">
                  {s.agentName}
                </p>
                <p className="truncate pt-0.5 font-mono text-[9px] tracking-[0.08em] text-text-dim uppercase">
                  Cycle {s.tickSeq} · {when(s.at)}
                </p>
              </div>
              <span
                className={`tnum shrink-0 font-mono text-[12px] ${
                  s.movedUsd === null
                    ? "text-text-dim"
                    : s.movedUsd >= 0
                      ? "text-accent"
                      : "text-negative"
                }`}
              >
                {s.movedUsd === null ? "first" : signed(s.movedUsd)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </RailSection>
  );
}

/* ------------------------------------------------------------- helpers --- */

function identityOf(user: ReturnType<typeof usePrivy>["user"]) {
  const accounts: unknown[] = Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : [];
  let email: string | null = null;
  let wallet: string | null = null;
  for (const entry of accounts) {
    if (!entry || typeof entry !== "object") continue;
    const a = entry as Record<string, unknown>;
    if (a.type === "email" && typeof a.address === "string") email ??= a.address;
    if (a.type === "wallet" && typeof a.address === "string") wallet ??= a.address;
  }
  const short = wallet && wallet.length > 12
    ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}`
    : wallet;
  return { name: email ?? short ?? "Your portfolio", wallet: short };
}

/**
 * The agent table, as a file.
 *
 * Built from what is already on screen rather than from a fresh request, so
 * the export and the page can never disagree. Values are the raw numbers, not
 * the formatted strings — a spreadsheet should get `1842.1`, not `$1,842`.
 */
function exportCsv(holdings: Holding[]) {
  const header = [
    "agent",
    "class",
    "book",
    "status",
    "deployed_usd",
    "equity_usd",
    "realized_usd",
    "unrealized_usd",
    "return_pct",
    "max_drawdown_pct",
    "cycles",
    "marked_live",
  ];
  const lines = holdings.map((h) =>
    [
      h.agent.strategy_name,
      h.agent.strategy_class,
      h.agent.is_paper ? "paper" : "live",
      h.agent.status,
      num(h.agent.capital_usd) ?? 0,
      h.mark?.equityUsd ?? "",
      h.mark?.realizedPnlUsd ?? "",
      h.mark?.unrealizedPnlUsd ?? "",
      h.mark ? h.mark.returnPct.toFixed(2) : "",
      h.mark ? h.mark.maxDrawdownPct.toFixed(2) : "",
      h.mark?.points.length ?? 0,
      h.mark ? String(h.mark.marked) : "",
    ]
      // Quote everything that could carry a comma; a strategy name is free text.
      .map((v) => (typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
      .join(","),
  );

  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `canopy-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function signed(n: number): string {
  const s = `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return n < 0 ? `−${s}` : `+${s}`;
}

function signedPct(n: number): string {
  return `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(1)}%`;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function when(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}
