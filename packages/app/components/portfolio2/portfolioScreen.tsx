"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MiniCurve } from "@/components/charts";
import { FOCUS, PRIMARY, SECONDARY } from "@/components/kit";
import { Modal } from "@/components/modal";
import { ErrorState, SignedOutState } from "@/components/states";
import { CopyButton, Segmented, UnderlineTabs } from "@/components/trade/bits";
import { usd } from "@/lib/format";
import { shortAddr, type Position } from "@/lib/market";
import {
  DAY_MS,
  bookTotals,
  byAgent,
  byToken,
  dailyPnl,
  hasLive,
  monthlyPnl,
  type Book,
  type BookTotals,
} from "@/lib/portfolioMath";
import { useHoldings, type Holding, type HoldingsData, type HoldingsState } from "@/lib/useHoldings";
import { useTradeAccount } from "@/lib/useMarket";
import { Donut, PnlBars, PnlCalendar, ValueChart, type Line } from "./charts";
import { agentStatus, Signed } from "./bits";

const BAR = { free: "#C9D1CD", agents: "#5ED3B3", own: "#5F6B64" };

type Range = "7D" | "30D" | "90D" | "1Y" | "All";
const RANGE_MS: Record<Range, number | null> = { "7D": 7 * DAY_MS, "30D": 30 * DAY_MS, "90D": 90 * DAY_MS, "1Y": 365 * DAY_MS, All: null };

type ChartPane = "value" | "pnl" | "dist";

/**
 * `preview` swaps the live loads for fixture data (the dev-only preview route),
 * so the layout can be checked without an account.
 */
export function PortfolioScreen({ preview }: { preview?: HoldingsData & { freeUsd: number } } = {}) {
  const loaded = useHoldings();
  const trade = useTradeAccount();
  const state: HoldingsState = preview ? { phase: "ready", ...preview } : loaded.state;
  const reload = loaded.reload;
  const account = preview ? { usdcBalance: preview.freeUsd, walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" } : trade.account;
  const [book, setBook] = useState<Book | null>(null);
  const [deposit, setDeposit] = useState(false);

  // Opens on the live book when there is one: that is the real money.
  useEffect(() => {
    if (book || state.phase !== "ready") return;
    setBook(hasLive(state.holdings, state.ownOpen, state.ownClosed) || (account?.usdcBalance ?? 0) > 0 ? "live" : "paper");
  }, [book, state, account]);

  const shownBook: Book = book ?? "live";
  const totals = useMemo(
    () => (state.phase === "ready" ? bookTotals(state.holdings, shownBook, state.ownOpen, state.ownClosed) : null),
    [state, shownBook],
  );

  if (state.phase === "signed-out") {
    return (
      <Shell>
        <SignedOutState />
      </Shell>
    );
  }
  if (state.phase === "error") {
    return (
      <Shell>
        <ErrorState message={state.message} onRetry={reload} />
      </Shell>
    );
  }

  const free = shownBook === "live" ? account?.usdcBalance ?? 0 : 0;

  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-ui text-[28px] font-light tracking-[-0.02em] text-text-primary">Portfolio</h1>
        <UnderlineTabs<Book>
          label="Book"
          value={shownBook}
          onChange={setBook}
          className="border-b-0"
          tabs={[
            { key: "live", label: "Live" },
            { key: "paper", label: "Paper" },
          ]}
        />
      </div>

      {!totals || state.phase !== "ready" ? (
        <div className="space-y-4" aria-busy>
          <div className="h-[180px] animate-pulse rounded-2xl bg-surface" />
          <div className="h-[340px] animate-pulse rounded-2xl bg-surface" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr] [&>*]:min-w-0">
            <Funds book={shownBook} free={free} totals={totals} onDeposit={() => setDeposit(true)} />
            <Kpis totals={totals} />
          </div>
          <Charts totals={totals} ownClosed={shownBook === "live" ? state.ownClosed : []} ownOpen={shownBook === "live" ? state.ownOpen : []} />
          <Wallets book={shownBook} totals={totals} ownOpen={state.ownOpen} />
        </>
      )}

      {deposit && (
        <Modal title="Deposit" onClose={() => setDeposit(false)}>
          <DepositBody address={account?.walletAddress ?? null} />
        </Modal>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full min-w-0 max-w-[1180px] px-4 py-8 lg:px-6">{children}</main>;
}

function Funds({ book, free, totals, onDeposit }: { book: Book; free: number; totals: BookTotals; onDeposit: () => void }) {
  const parts =
    book === "live"
      ? [
          { label: "Free in wallet", value: free, color: BAR.free },
          { label: "In agents", value: totals.inAgentsUsd, color: BAR.agents },
          { label: "Your own trades", value: totals.ownTradesUsd, color: BAR.own },
        ]
      : [{ label: "In paper agents", value: totals.inAgentsUsd, color: BAR.agents }];
  const total = parts.reduce((t, p) => t + p.value, 0);
  return (
    <section className="rounded-2xl border border-border bg-panel p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-ui text-[12px] text-text-muted">{book === "live" ? "Total balance" : "Paper balance"}</p>
          <p className="tnum mt-1 font-mono text-[26px] sm:text-[32px] leading-none tracking-[-0.02em] text-text-primary">{usd(total)}</p>
        </div>
        {book === "live" && (
          <button type="button" className={PRIMARY} onClick={onDeposit}>
            Deposit
          </button>
        )}
      </div>
      <div className="mt-5 flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
        {total > 0 && parts.map((p) => <i key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}
      </div>
      <div className={`mt-4 grid gap-3 ${parts.length > 1 ? "sm:grid-cols-3" : ""}`}>
        {parts.map((p) => (
          <div key={p.label} className="flex gap-2.5">
            <span className="mt-1 h-3 w-1 shrink-0 rounded-sm" style={{ background: p.color }} />
            <div>
              <p className="font-ui text-[12px] text-text-muted">{p.label}</p>
              <p className="tnum font-mono text-[14px] text-text-primary">{usd(p.value)}</p>
              <p className="tnum font-mono text-[11px] text-text-muted">{total > 0 ? Math.round((p.value / total) * 100) : 0}%</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Kpis({ totals }: { totals: BookTotals }) {
  const items = [
    { label: "Invested now", value: <span className="text-text-primary">{usd(totals.investedUsd)}</span>, sub: "In agents and your trades" },
    { label: "Today", value: <Signed usd={totals.todayUsd} />, sub: <Signed pct={totals.todayPct} /> },
    { label: "Last 30 days", value: <Signed usd={totals.d30Usd} />, sub: <Signed pct={totals.d30Pct} /> },
    {
      label: "Win rate",
      value: <span className="text-text-primary">{totals.closed ? `${Math.round((totals.wins / totals.closed) * 100)}%` : "—"}</span>,
      sub: totals.closed ? `${totals.wins} of ${totals.closed} trades` : "No closed trades yet",
    },
  ];
  return (
    <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-border gap-px">
      {items.map((k) => (
        <div key={k.label} className="min-w-0 bg-panel p-4 sm:p-5">
          <p className="font-ui text-[12px] text-text-muted">{k.label}</p>
          <p className="tnum mt-2 truncate font-mono text-[17px] leading-none sm:text-[20px]">{k.value}</p>
          <p className="tnum mt-2 font-ui text-[11.5px] text-text-muted">{k.sub}</p>
        </div>
      ))}
    </section>
  );
}

function Panel({ title, controls, children, className = "" }: { title: React.ReactNode; controls?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-border bg-panel p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="font-ui text-[13px] font-medium text-text-primary">{title}</div>
        <div className="flex max-w-full flex-wrap gap-2 [&>*]:max-w-full [&>*]:overflow-x-auto">{controls}</div>
      </div>
      {children}
    </section>
  );
}

function Charts({ totals, ownOpen, ownClosed }: { totals: BookTotals; ownOpen: Position[]; ownClosed: Position[] }) {
  const [pane, setPane] = useState<ChartPane>("value");
  const [view, setView] = useState<"all" | "agents">("all");
  const [range, setRange] = useState<Range>("30D");
  const [pnlRange, setPnlRange] = useState<"7D" | "30D" | "1Y">("30D");
  const [pnlView, setPnlView] = useState<"bars" | "calendar">("bars");
  const [dist, setDist] = useState<"agent" | "token">("agent");

  const lines: Line[] = useMemo(() => {
    const since = RANGE_MS[range] === null ? -Infinity : Date.now() - RANGE_MS[range]!;
    const keep = (at: string) => Date.parse(at) >= since;
    if (view === "all") {
      return [{ key: "all", label: "Portfolio", points: totals.path.filter((p) => keep(p.at)).map((p) => ({ at: p.at, value: p.equityUsd })) }];
    }
    return totals.agents
      .filter((h) => h.mark && h.mark.points.length)
      .map((h) => ({
        key: String(h.agent.id),
        label: h.agent.strategy_name,
        points: h.mark!.points.filter((p) => keep(p.at)).map((p) => ({ at: p.at, value: p.equityUsd })),
      }));
  }, [totals, view, range]);

  const days = useMemo(() => dailyPnl(totals.path, ownClosed, pnlRange === "7D" ? 7 : pnlRange === "30D" ? 30 : 365), [totals.path, ownClosed, pnlRange]);
  const bars = pnlRange === "1Y" ? monthlyPnl(days) : days;
  const pnlTotal = bars.reduce((t, d) => t + d.pnlUsd, 0);
  const up = bars.filter((d) => d.pnlUsd > 0).length;
  const down = bars.filter((d) => d.pnlUsd < 0).length;
  const unit = pnlRange === "1Y" ? "months" : "days";
  const slices = dist === "agent" ? byAgent(totals) : byToken(totals, ownOpen);
  const hasCurve = lines.some((l) => l.points.length > 1);

  const show = (p: ChartPane) => (pane === p ? "" : "hidden lg:block");

  return (
    <div className="mt-6">
      <Segmented<ChartPane>
        label="Charts"
        value={pane}
        onChange={setPane}
        className="mb-3 lg:hidden"
        options={[
          { key: "value", label: "Value" },
          { key: "pnl", label: "PnL" },
          { key: "dist", label: "Distribution" },
        ]}
      />
      <Panel
        className={show("value")}
        title="Portfolio value"
        controls={
          <>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { key: "all", label: "All" },
                { key: "agents", label: "By agent" },
              ]}
            />
            <Segmented<Range> label="Range" value={range} onChange={setRange} options={(["7D", "30D", "90D", "1Y", "All"] as Range[]).map((k) => ({ key: k, label: k }))} />
          </>
        }
      >
        {hasCurve ? (
          <ValueChart lines={lines} className="h-[260px] w-full" />
        ) : (
          <p className="flex h-[260px] items-center justify-center font-ui text-[12.5px] text-text-muted">No history in this range yet.</p>
        )}
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Panel
          className={show("pnl")}
          title={
            <div>
              <p className="font-ui text-[12px] font-normal text-text-muted">PnL · {pnlRange === "7D" ? "last 7 days" : pnlRange === "30D" ? "last 30 days" : "last 12 months"}</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <span className="tnum font-mono text-[22px]">
                  <Signed usd={pnlTotal} />
                </span>
                <span className="font-ui text-[12px] text-text-muted">
                  {up} up · {down} down {unit}
                </span>
              </div>
            </div>
          }
          controls={
            <>
              <Segmented label="Period" value={pnlRange} onChange={setPnlRange} options={(["7D", "30D", "1Y"] as const).map((k) => ({ key: k, label: k }))} />
              {pnlRange !== "1Y" && (
                <Segmented
                  label="Show as"
                  value={pnlView}
                  onChange={setPnlView}
                  options={[
                    { key: "bars", label: "Bars" },
                    { key: "calendar", label: "Calendar" },
                  ]}
                />
              )}
            </>
          }
        >
          {pnlView === "calendar" && pnlRange !== "1Y" ? <PnlCalendar data={days} className="py-6" /> : <PnlBars data={bars} unit={pnlRange === "1Y" ? "month" : "day"} />}
          {bars.length > 0 && (
            <div className="mt-3 flex gap-4 font-ui text-[12px] text-text-muted">
              <span>
                Best <Signed usd={Math.max(...bars.map((d) => d.pnlUsd))} />
              </span>
              <span>
                Worst <Signed usd={Math.min(...bars.map((d) => d.pnlUsd))} />
              </span>
            </div>
          )}
        </Panel>

        <Panel
          className={show("dist")}
          title="Distribution"
          controls={
            <Segmented
              label="Group by"
              value={dist}
              onChange={setDist}
              options={[
                { key: "agent", label: "By agent" },
                { key: "token", label: "By token" },
              ]}
            />
          }
        >
          <Donut slices={slices} className="py-2" />
        </Panel>
      </div>
    </div>
  );
}

function Wallets({ book, totals, ownOpen }: { book: Book; totals: BookTotals; ownOpen: Position[] }) {
  const running = totals.agents.filter((h) => h.agent.status === "active").length;
  const pnl = totals.agentPnlUsd + (book === "live" ? totals.ownPnlUsd : 0);
  const working = totals.investedUsd;
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-ui text-[18px] font-light tracking-[-0.01em] text-text-primary">Agent wallets</h2>
        <Link href="/portfolio/agents" className={`font-ui text-[12.5px] text-text-secondary hover:text-text-primary ${FOCUS}`}>
          Manage agents ›
        </Link>
      </div>
      <p className="mt-1 mb-3 font-ui text-[12.5px] text-text-dim">
        <b className="tnum font-mono font-normal text-text-primary">{running}</b> of {totals.agents.length} running ·{" "}
        <b className="tnum font-mono font-normal text-text-primary">{usd(working)}</b> working · <Signed usd={pnl} />{" "}P&amp;L
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
        {totals.agents.map((h) => (
          <AgentCard key={h.agent.id} h={h} />
        ))}
        {book === "live" && ownOpen.length > 0 && (
          <Link href="/trade" className={`rounded-2xl border border-border bg-panel p-4 transition-colors hover:border-grid-strong ${FOCUS}`}>
            <CardHead initial="Y" name="Your trades" status={`${ownOpen.length} open`} />
            <CardFoot value={totals.ownTradesUsd} pnl={ownOpen.reduce((t, p) => t + p.pnlUsd, 0)} cost={ownOpen.reduce((t, p) => t + p.costUsd, 0)} />
          </Link>
        )}
        <Link
          href="/agents"
          className={`flex min-h-[148px] flex-col items-center justify-center rounded-2xl border border-dashed border-border p-4 text-center transition-colors hover:border-grid-strong ${FOCUS}`}
        >
          <span className="font-ui text-[20px] font-light text-text-dim">+</span>
          <span className="mt-1 font-ui text-[13px] text-text-primary">Add an agent</span>
          <span className="font-ui text-[12px] text-text-muted">Copy one or build your own</span>
        </Link>
      </div>
    </section>
  );
}

function CardHead({ initial, name, status }: { initial: string; name: string; status: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 font-ui text-[14px] text-text-primary">{initial}</span>
      <div className="min-w-0">
        <p className="truncate font-ui text-[13.5px] text-text-primary">{name}</p>
        <p className="font-ui text-[11.5px] text-text-muted">{status}</p>
      </div>
    </div>
  );
}

function CardFoot({ value, pnl, cost }: { value: number; pnl: number; cost: number }) {
  const pct = cost > 0 ? (pnl / cost) * 100 : null;
  return (
    <div className="mt-3 flex items-baseline justify-between gap-2">
      <span className="tnum font-mono text-[16px] text-text-primary">{usd(value)}</span>
      <span className="tnum font-mono text-[12px]">
        <Signed usd={pnl} />
        {pct !== null && (
          <>
            <span className="text-text-muted"> · </span>
            <Signed pct={pct} digits={1} />
          </>
        )}
      </span>
    </div>
  );
}

function AgentCard({ h }: { h: Holding }) {
  const m = h.mark;
  const values = m?.points.map((p) => p.equityUsd) ?? [];
  return (
    <Link href={`/portfolio/${h.agent.id}`} className={`rounded-2xl border border-border bg-panel p-4 transition-colors hover:border-grid-strong ${FOCUS}`}>
      <CardHead initial={h.agent.strategy_name.slice(0, 1).toUpperCase()} name={h.agent.strategy_name} status={agentStatus(h.agent)} />
      <div className="mt-3">
        <MiniCurve values={values.slice(-60)} tone={m && m.pnlUsd < 0 ? "negative" : "accent"} width={300} height={40} />
      </div>
      <CardFoot value={m?.equityUsd ?? 0} pnl={m?.pnlUsd ?? 0} cost={m?.deployedCapitalUsd ?? 0} />
    </Link>
  );
}

function DepositBody({ address }: { address: string | null }) {
  if (!address) {
    return (
      <div className="space-y-4 px-6 pt-4 pb-6">
        <p className="font-ui text-[13px] text-text-dim">Set up your trading account first. It takes one step on the Trade screen.</p>
        <Link href="/trade" className={PRIMARY}>
          Go to Trade
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4 px-6 pt-4 pb-6">
      <p className="font-ui text-[13px] text-text-dim">Send USDC on Solana to your trading wallet. SOL is used for network fees.</p>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <span className="tnum truncate font-mono text-[12.5px] text-text-primary" title={address}>
          {shortAddr(address)}
        </span>
        <CopyButton text={address} label="Copy address" />
      </div>
      <p className="font-ui text-[12px] text-text-muted">Tokens sent on another network can be lost.</p>
      <a href={`https://solscan.io/account/${address}`} target="_blank" rel="noreferrer" className={SECONDARY}>
        View on Solscan
      </a>
    </div>
  );
}
