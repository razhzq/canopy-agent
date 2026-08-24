"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { EquityCurve, MiniCurve } from "@/components/charts";
import { ProfileMobile } from "@/components/profileMobile";
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
import { CONCURRENCY, pooled } from "@/lib/pool";
import { useUsername } from "@/lib/useUsername";
import {
  aggregateEquityPath,
  markAgent,
  movedOverUsd,
  recentSettlements,
  type AgentMark,
} from "@/lib/perf";
import { relativeTime } from "@/lib/format";
import { useLocale, useT, type Locale, type Translate, type TranslationKey } from "@/lib/i18n";

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



export interface Holding {
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

const TAB_LABEL_KEY: Record<Tab, TranslationKey> = {
  live: "po_tab_live",
  paused: "po_tab_paused",
  archived: "po_tab_archived",
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
  const { t, locale } = useLocale();

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
        labelKey="loading_portfolio"
        band={4}
        cols="minmax(0,1.6fr) 110px 110px 110px 90px 130px 90px"
      />
    );
  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "error")
    return <ErrorState message={state.message} onRetry={() => void load()} />;

  if (holdings.length === 0) {
    return (
      <div className="px-5 py-10 sm:px-8">
        <EmptyState
          title={t("po_empty_title")}
          body={t("po_empty_body")}
          action={{ label: t("po_empty_action"), href: "/build/new" }}
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
      {/* Below lg this route is wireframe M02 — identity, the curve, then the
          agents — rather than the two-column workspace narrowed. Same holdings,
          same totals, so the two views cannot disagree and the page still costs
          one fan-out. */}
      <ProfileMobile holdings={holdings} totals={totals} />

      <div className="hidden lg:block">
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
            <section className="border-b border-grid px-5 py-6 sm:px-8 sm:py-7">
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                <div className="space-y-2">
                  <p className="font-mono text-[9px] tracking-[0.14em] text-text-dim uppercase">
                    {totals.counted === 1
                      ? t("po_curve_label_one")
                      : t("po_curve_label_many", { count: totals.counted })}
                  </p>
                  <p className="tnum font-mono text-[27px] leading-none text-text-primary sm:text-[32px]">
                    {money(totals.equityUsd)}
                  </p>
                  <p
                    className={`tnum font-mono text-[12.5px] ${
                      totals.pnlUsd >= 0 ? "text-accent" : "text-negative"
                    }`}
                  >
                    {t("po_curve_against", {
                      pnl: signed(totals.pnlUsd),
                      pct: signedPct(totals.returnPct),
                      capital: money(totals.capitalUsd),
                    })}
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
                  height={200}
                />
                <div className="flex items-center justify-between pt-3 font-mono text-[9.5px] tracking-[0.08em] text-text-dim uppercase">
                  <span>{drawn.length > 0 ? day(drawn[0].at, locale) : "—"}</span>
                  <span>
                    {t(drawn.length === 1 ? "po_readings_one" : "po_readings_many", {
                      marked: t(totals.marked ? "po_marked_live" : "po_marked_last"),
                      count: drawn.length,
                    })}
                  </span>
                </div>
              </div>

              {/* The one thing a reader could get wrong about this chart, said
                  plainly rather than left to be inferred from a jump. */}
              <p className="pt-4 font-ui text-[11.5px] leading-relaxed text-text-dim">
                {t("po_curve_note")}
                {windowed ? t("po_curve_windowed") : ""}
              </p>
            </section>

            {/* ------------------------------------------------ agents -- */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-grid px-5 sm:px-8">
                <div className="flex">
                  {/* `key`, not `t` — the translator owns that name here. */}
                  {(Object.keys(TAB_STATUS) as Tab[]).map((key) => {
                    const n = holdings.filter((h) =>
                      TAB_STATUS[key].includes(h.agent.status),
                    ).length;
                    const on = tab === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTab(key)}
                        aria-pressed={on}
                        className={`flex items-center gap-2 border-b-2 px-5 py-4 font-mono text-[10.5px] tracking-[0.1em] uppercase transition-colors ${
                          on
                            ? "border-accent text-text-primary"
                            : "border-transparent text-text-dim hover:text-text-secondary"
                        }`}
                      >
                        {t(TAB_LABEL_KEY[key])}
                        <span className={on ? "text-accent" : "text-text-dim"}>{n}</span>
                      </button>
                    );
                  })}
                </div>
                <Link
                  href="/workspace"
                  className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:text-accent"
                >
                  {t("po_manage")}
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
    </div>
  );
}

/* ------------------------------------------------------------- summary --- */

export interface Totals {
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
  const t = useT();
  const identity = identityOf(user, t);
  // The page is titled with who you are, not with how you signed in.
  const title = username ?? identity.name;

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-b border-grid px-5 pt-6 pb-6 sm:px-8">
      <div className="min-w-0 space-y-3">
        <Breadcrumb parts={[t("po_crumb_portfolio"), t("po_crumb_overview")]} />

        <div className="flex items-center gap-3">
          <h1 className="font-mono text-[28px] leading-none tracking-[-0.02em] text-text-primary">
            {title}
          </h1>
          {/* Says what the money actually is. The badge is not decoration: a
              paper portfolio and a funded one look identical on this page. */}
          <Badge tone={totals.allPaper ? "simulated" : "accent"}>
            {t(totals.allPaper ? "po_badge_paper" : "po_badge_live")}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
          <Meta label={t("po_meta_agents")} value={String(totals.counted)} />
          <Meta
            label={t("po_meta_cycles")}
            value={totals.cycles.toLocaleString("en-US")}
          />
          <Meta label={t("po_meta_open_book")} value={money(totals.openBookUsd)} />
          <Meta label={t("po_meta_idle")} value={money(totals.idleUsd)} />
          {identity.wallet ? (
            <Meta label={t("po_meta_wallet")} value={identity.wallet} />
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          className="border border-grid-strong px-3 py-2 font-mono text-[10.5px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:border-accent hover:text-accent"
        >
          {t("po_export")}
        </button>
        <Link
          href="/build/new"
          className="bg-accent px-3.5 py-2 font-mono text-[10.5px] tracking-[0.08em] text-bg uppercase transition-opacity hover:opacity-90"
        >
          {t("po_new_agent")}
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

/* The table grid, from lg up only. Below that the row is not a grid at all —
   see AgentRowLine. Written as a class rather than an inline style so the
   breakpoint can win; an inline `gridTemplateColumns` beats every variant. */
const COLS = "lg:grid lg:grid-cols-[minmax(0,1.6fr)_110px_110px_110px_90px_130px_90px]";

function AgentTable({ rows, tab }: { rows: Holding[]; tab: Tab }) {
  const t = useT();

  if (rows.length === 0) {
    return (
      <p className="px-5 py-10 text-center font-ui text-[13px] text-text-dim sm:px-8">
        {t(
          tab === "live"
            ? "po_none_live"
            : tab === "paused"
              ? "po_none_paused"
              : "po_none_archived",
        )}
      </p>
    );
  }

  return (
    <div>
      <div
        className={`grid gap-x-4 border-b border-grid px-8 py-3 font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase max-lg:hidden ${COLS}`}
      >
        <span>{t("po_col_agent")}</span>
        <span className="text-right">{t("po_col_deployed")}</span>
        <span className="text-right">{t("po_col_equity")}</span>
        <span className="text-right">{t("po_col_24h")}</span>
        <span className="text-right">{t("po_col_return")}</span>
        <span>{t("po_col_curve")}</span>
        <span className="text-right">{t("po_col_status")}</span>
      </div>

      {rows.map((h) => (
        <AgentRowLine key={h.agent.id} holding={h} />
      ))}
    </div>
  );
}

/**
 * One agent, as a table row from lg up and as a card below it.
 *
 * Two layouts rather than one that flexes. Seven columns cannot fold into a
 * phone gracefully — the honest small-screen shape puts the figure that matters
 * first and lets the rest sit under it, which is a different arrangement of the
 * same facts, not a squeezed version of the table. Trying to express both with
 * one set of classes is what produced the previous two-column grid, where the
 * agent's name sat beside its deployed capital and the sparkline landed under
 * the 24h figure.
 *
 * The values are computed once and rendered by both, so the two can never
 * disagree.
 */
function AgentRowLine({ holding }: { holding: Holding }) {
  const { agent, mark } = holding;
  const t = useT();
  const moved = mark ? movedOverUsd(mark.points, Date.now() - 86_400_000) : null;
  const up = (mark?.pnlUsd ?? 0) >= 0;

  const book = t(agent.is_paper ? "po_book_paper" : "po_book_live");
  const sub = mark
    ? t("po_row_sub_cycle", {
        class: agent.strategy_class,
        book,
        cycle: mark.points[mark.points.length - 1].tickSeq,
      })
    : t("po_row_sub", { class: agent.strategy_class, book });
  const equity = mark ? money(mark.equityUsd) : "—";
  const deployed = money(num(agent.capital_usd) ?? 0);
  const movedText = moved === null ? "—" : signed(moved);
  const movedTone =
    moved === null ? "text-text-dim" : moved >= 0 ? "text-accent" : "text-negative";
  const returnText = mark ? signedPct(mark.returnPct) : "—";
  const returnTone = mark
    ? mark.returnPct >= 0
      ? "text-accent"
      : "text-negative"
    : "text-text-dim";

  const curve =
    mark && mark.points.length > 1 ? (
      <MiniCurve
        values={mark.points.map((p) => p.equityUsd)}
        tone={up ? "accent" : "negative"}
        width={120}
        height={28}
      />
    ) : (
      <span className="font-mono text-[10px] text-text-dim">{t("po_no_readings")}</span>
    );

  return (
    <Link
      href={`/workspace/${agent.id}`}
      className={`block border-b border-grid px-5 py-4 transition-colors hover:bg-surface sm:px-8 lg:items-center lg:gap-x-4 ${COLS}`}
    >
      {/* ---------------------------------------------------------- card -- */}
      <div className="space-y-3 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-[14px] text-text-primary">
              {agent.strategy_name}
            </p>
            <p className="truncate pt-1 font-mono text-[9.5px] tracking-[0.06em] text-text-dim uppercase">
              {sub}
            </p>
          </div>
          <Badge tone={STATUS_TONE[agent.status]}>{t(AGENT_STATUS_KEY[agent.status])}</Badge>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {/* Equity leads, because on a phone you get one number before the
                fold and this is the one people open the page for. */}
            <p className="tnum font-mono text-[19px] leading-none text-text-primary">{equity}</p>
            <p className="pt-1.5 font-mono text-[10px] tracking-[0.06em] text-text-dim uppercase">
              {t("po_deployed_suffix", { amount: deployed })}
            </p>
          </div>
          <div className="shrink-0">{curve}</div>
        </div>

        <div className="flex items-center gap-4 font-mono text-[11.5px]">
          <span className={`tnum ${movedTone}`}>
            <span className="text-text-dim">{t("po_label_24h")}</span>
            {movedText}
          </span>
          <span className={`tnum ${returnTone}`}>
            <span className="text-text-dim">{t("po_label_return")}</span>
            {returnText}
          </span>
        </div>
      </div>

      {/* --------------------------------------------------------- table -- */}
      <div className="hidden min-w-0 lg:block">
        <p className="truncate font-mono text-[13px] text-text-primary">
          {agent.strategy_name}
        </p>
        <p className="truncate pt-1 font-mono text-[9.5px] tracking-[0.06em] text-text-dim uppercase">
          {sub}
        </p>
      </div>
      <span className="tnum hidden text-right font-mono text-[12.5px] text-text-secondary lg:block">
        {deployed}
      </span>
      <span className="tnum hidden text-right font-mono text-[13px] text-text-primary lg:block">
        {equity}
      </span>
      <span className={`tnum hidden text-right font-mono text-[12.5px] lg:block ${movedTone}`}>
        {movedText}
      </span>
      <span className={`tnum hidden text-right font-mono text-[12.5px] lg:block ${returnTone}`}>
        {returnText}
      </span>
      <span className="hidden items-center lg:flex">{curve}</span>
      <span className="hidden justify-end lg:flex">
        <Badge tone={STATUS_TONE[agent.status]}>{t(AGENT_STATUS_KEY[agent.status])}</Badge>
      </span>
    </Link>
  );
}

/**
 * The row's status word.
 *
 * This used to render `agent.status` — the backend enum — directly. Reusing
 * the workspace header's own keys rather than minting a second set: two lists
 * of the same agent must not call it two different things.
 */
const AGENT_STATUS_KEY: Record<AgentRow["status"], TranslationKey> = {
  active: "ws_status_active",
  paused: "ws_status_paused",
  liquidating: "ws_status_liquidating",
  stopped: "ws_status_stopped",
  draft: "ws_status_draft",
  deleted: "ws_status_stopped",
};

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
  const t = useT();
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
    <RailSection
      title={t("po_allocation")}
      note={t("po_allocation_note", { amount: money(totals.capitalUsd) })}
    >
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
            label={t("po_idle_label")}
            tag={t("po_idle_tag")}
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
  const t = useT();
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
      title={t("po_exposure")}
      note={
        positions === 1
          ? t("po_exposure_one")
          : t("po_exposure_many", { count: positions })
      }
    >
      {rows.length === 0 ? (
        <p className="pt-2 font-ui text-[12.5px] text-text-dim">{t("po_exposure_empty")}</p>
      ) : (
        <>
          <div className="flex gap-6 pt-2 pb-4">
            <Figure label={t("po_fig_open_book")} value={money(totals.openBookUsd)} />
            <Figure
              label={t("po_fig_unrealised")}
              value={signed(totals.unrealizedUsd)}
              tone={totals.unrealizedUsd >= 0 ? "accent" : "negative"}
            />
            <Figure label={t("po_fig_realised")} value={signed(totals.realizedUsd)} tone={
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
                  {r.agents === 1
                    ? t("po_agents_one")
                    : t("po_agents_many", { count: r.agents })}
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
  const t = useT();

  return (
    <RailSection title={t("po_settlements")} note={t("po_settlements_note")}>
      {settlements.length === 0 ? (
        <p className="pt-2 font-ui text-[12.5px] text-text-dim">{t("po_settlements_empty")}</p>
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
                  {t("po_settlement_line", {
                    seq: s.tickSeq,
                    when: relativeTime(s.at, t),
                  })}
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
                {s.movedUsd === null ? t("po_settlement_first") : signed(s.movedUsd)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </RailSection>
  );
}

/* ------------------------------------------------------------- helpers --- */

function identityOf(user: ReturnType<typeof usePrivy>["user"], t: Translate) {
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
  return { name: email ?? short ?? t("po_fallback_title"), wallet: short };
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

/** The axis date under the curve, in the reader's language. */
function day(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

// `when` moved to lib/format as `relativeTime`.
