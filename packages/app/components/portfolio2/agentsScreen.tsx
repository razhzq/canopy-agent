"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { AddFundsModal } from "@/components/addFunds";
import { MiniCurve } from "@/components/charts";
import { FOCUS, SECONDARY } from "@/components/kit";
import { ErrorState, SignedOutState } from "@/components/states";
import { FilterChip, Price, Segmented } from "@/components/trade/bits";
import { getAgentFills, num, pauseAgent, resumeAgent, type AgentFill } from "@/lib/api";
import { usd } from "@/lib/format";
import { DAY_MS, agentMoved, agentUse, counts } from "@/lib/portfolioMath";
import { useHoldings, type Holding, type HoldingsState } from "@/lib/useHoldings";
import { usePersonalWallet } from "@/lib/usePersonalWallet";
import { Signed, agentStatus } from "./bits";

type Period = "7D" | "30D" | "All";
const PERIOD_MS: Record<Period, number | null> = { "7D": 7 * DAY_MS, "30D": 30 * DAY_MS, All: null };
type Filter = "all" | "running" | "paused" | "attention";

/** `preview` swaps the live load for fixture agents (the dev-only preview route). */
export function AgentsScreen({ preview }: { preview?: Holding[] } = {}) {
  const loaded = useHoldings();
  const state: HoldingsState = preview ? { phase: "ready", holdings: preview, ownOpen: [], ownClosed: [] } : loaded.state;
  const reload = loaded.reload;
  const [period, setPeriod] = useState<Period>("30D");
  const [filter, setFilter] = useState<Filter>("all");
  const [funding, setFunding] = useState<Holding | null>(null);
  const personal = usePersonalWallet();

  if (state.phase === "signed-out") return <Shell><SignedOutState /></Shell>;
  if (state.phase === "error") return <Shell><ErrorState message={state.message} onRetry={reload} /></Shell>;

  const list = state.phase === "ready" ? state.holdings.filter((h) => h.agent.status !== "deleted") : [];
  const attention = (h: Holding) => Number(h.agent.needs_you ?? 0) > 0 || h.agent.status === "liquidating";
  const match: Record<Filter, (h: Holding) => boolean> = {
    all: () => true,
    running: (h) => h.agent.status === "active",
    paused: (h) => h.agent.status === "paused",
    attention,
  };
  const shown = list.filter(match[filter]);
  const live = list.filter((h) => counts(h));
  const working = live.reduce((t, h) => t + (h.mark?.equityUsd ?? 0), 0);
  const pnl = live.reduce((t, h) => t + (agentMoved(h, PERIOD_MS[period]) ?? 0), 0);
  const running = list.filter((h) => h.agent.status === "active").length;

  return (
    <Shell>
      <Link href="/portfolio" className={`font-ui text-[12.5px] text-text-secondary hover:text-text-primary ${FOCUS}`}>
        ‹ Portfolio
      </Link>
      <h1 className="mt-2 mb-3 font-ui text-[28px] font-light tracking-[-0.02em] text-text-primary">Your agents</h1>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-ui text-[12.5px] text-text-dim">
          <b className="tnum font-mono font-normal text-text-primary">{running}</b> of {list.length} running ·{" "}
          <b className="tnum font-mono font-normal text-text-primary">{usd(working)}</b> working · <Signed usd={pnl} />{" "}P&amp;L
        </p>
        <Segmented<Period> label="Period" value={period} onChange={setPeriod} options={(["7D", "30D", "All"] as Period[]).map((k) => ({ key: k, label: k }))} />
      </div>
      <div className="mb-4 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {(
          [
            ["all", "All"],
            ["running", "Running"],
            ["paused", "Paused"],
            ["attention", "Needs attention"],
          ] as [Filter, string][]
        ).map(([k, l]) => (
          <FilterChip key={k} on={filter === k} count={list.filter(match[k]).length} onClick={() => setFilter(k)}>
            {l}
          </FilterChip>
        ))}
      </div>

      {state.phase !== "ready" ? (
        <div className="h-[320px] animate-pulse rounded-2xl bg-surface" aria-busy />
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-border px-6 py-14 text-center font-ui text-[13px] text-text-dim">
          {list.length === 0 ? (
            <>
              No agents yet.{" "}
              <Link href="/agents" className="text-text-primary underline-offset-4 hover:underline">
                Copy one or build your own
              </Link>
            </>
          ) : filter === "attention" ? (
            "All your agents are fine."
          ) : (
            "Nothing here."
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-panel">
          <table className="w-full min-w-[860px] font-ui text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[11.5px] text-text-muted">
                <th className="px-4 py-3 font-normal">Agent</th>
                <th className="px-4 py-3 font-normal">What it’s doing</th>
                <th className="px-4 py-3 font-normal">{period === "All" ? "All time" : `Last ${period === "7D" ? 7 : 30} days`}</th>
                <th className="px-4 py-3 text-right font-normal">Balance</th>
                <th className="px-4 py-3 text-right font-normal">P&amp;L</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((h) => (
                <AgentRowView key={h.agent.id} h={h} period={period} onFund={() => setFunding(h)} onChanged={reload} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {state.phase === "ready" && <LatestTrades holdings={list} />}

      {funding && (
        <AddFundsModal
          agentId={funding.agent.id}
          agentWallet={funding.agent.wallet_ref ?? null}
          personalWallet={personal}
          onChanged={reload}
          onClose={() => setFunding(null)}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-[1180px] px-4 py-8 lg:px-6">{children}</main>;
}

function activity(h: Holding): string {
  const a = h.agent;
  if (a.status === "paused") return a.paused_reason || ((h.mark?.equityUsd ?? 0) > 0 ? "Not trading until you resume it" : "Add money to start it again");
  if (a.status === "liquidating") return "Closing positions after a drawdown limit";
  if (a.status === "stopped") return "Not trading";
  if (h.positions.length) return `Holding ${h.positions.map((p) => p.symbol).slice(0, 3).join(", ")}${h.positions.length > 3 ? ` +${h.positions.length - 3}` : ""}`;
  return h.mark ? "Waiting for its next signal" : "Waiting for its first cycle";
}

function AgentRowView({ h, period, onFund, onChanged }: { h: Holding; period: Period; onFund: () => void; onChanged: () => void }) {
  const { getAccessToken } = usePrivy();
  const [busy, setBusy] = useState(false);
  const m = h.mark;
  const since = PERIOD_MS[period] === null ? -Infinity : Date.now() - PERIOD_MS[period]!;
  const values = (m?.points ?? []).filter((p) => Date.parse(p.at) >= since).map((p) => p.equityUsd);
  const moved = agentMoved(h, PERIOD_MS[period]);
  const use = agentUse(h);
  const total = m?.equityUsd ?? 0;
  const pct = m && m.deployedCapitalUsd > 0 ? (m.pnlUsd / m.deployedCapitalUsd) * 100 : null;
  const canToggle = h.agent.status === "active" || h.agent.status === "paused";

  async function toggle() {
    setBusy(true);
    try {
      const tk = await getAccessToken();
      if (!tk) return;
      if (h.agent.status === "active") await pauseAgent(tk, h.agent.id);
      else await resumeAgent(tk, h.agent.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-border-soft last:border-0 align-middle">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-[14px] text-text-primary">
            {h.agent.strategy_name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <Link href={`/portfolio/${h.agent.id}`} className={`block truncate text-[13.5px] text-text-primary hover:underline ${FOCUS}`}>
              {h.agent.strategy_name}
            </Link>
            <span className="text-[11.5px] text-text-muted">{h.agent.is_paper ? "Paper" : "Live"} · Solana · USDC</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <p className={Number(h.agent.needs_you ?? 0) > 0 ? "text-text-primary" : "text-text-secondary"}>{agentStatus(h.agent)}</p>
        <p className="max-w-[240px] truncate text-[11.5px] text-text-muted">{activity(h)}</p>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <MiniCurve values={values} tone={moved !== null && moved < 0 ? "negative" : "accent"} width={96} height={28} />
          <span className="text-[12px]">
            <Signed usd={moved} />
          </span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-right">
        <p className="tnum font-mono text-[13.5px] text-text-primary">{usd(total)}</p>
        <div className="ml-auto mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-surface-2">
          <i className="block h-full bg-accent" style={{ width: `${total > 0 ? (use.inUseUsd / total) * 100 : 0}%` }} />
        </div>
        <p className="tnum mt-1 font-mono text-[11px] text-text-muted">
          {usd(use.inUseUsd)} in use · {usd(use.freeUsd)} free
        </p>
      </td>
      <td className="px-4 py-3.5 text-right">
        <p className="text-[13.5px]">
          <Signed usd={m?.pnlUsd ?? null} />
        </p>
        <p className="text-[11.5px]">
          <Signed pct={pct} digits={1} />
        </p>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex justify-end gap-2">
          {!h.agent.is_paper && h.agent.status !== "stopped" && (
            <button type="button" className={`${SECONDARY} h-8 px-3 text-[12px]`} onClick={onFund}>
              Add funds
            </button>
          )}
          {canToggle && (
            <button type="button" disabled={busy} className={`${SECONDARY} h-8 px-3 text-[12px]`} onClick={() => void toggle()}>
              {h.agent.status === "active" ? "Pause" : "Resume"}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

interface TradeLine {
  agentId: number;
  agentName: string;
  fill: AgentFill;
}

function LatestTrades({ holdings }: { holdings: Holding[] }) {
  const { getAccessToken } = usePrivy();
  const [rows, setRows] = useState<TradeLine[] | null>(null);
  const ids = useMemo(() => holdings.filter((h) => h.mark).slice(0, 8).map((h) => [h.agent.id, h.agent.strategy_name] as const), [holdings]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tk = await getAccessToken();
      if (!tk) return;
      const pages = await Promise.allSettled(ids.map(([id]) => getAgentFills(tk, id)));
      const all: TradeLine[] = [];
      pages.forEach((p, i) => {
        if (p.status !== "fulfilled") return;
        for (const f of p.value.fills.slice(0, 10)) all.push({ agentId: ids[i][0], agentName: ids[i][1], fill: f });
      });
      all.sort((a, b) => (a.fill.executed_at < b.fill.executed_at ? 1 : -1));
      if (!cancelled) setRows(all.slice(0, 8));
    })();
    return () => {
      cancelled = true;
    };
  }, [ids, getAccessToken]);

  if (!ids.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-ui text-[18px] font-light tracking-[-0.01em] text-text-primary">Latest agent trades</h2>
      {rows === null ? (
        <div className="h-[160px] animate-pulse rounded-2xl bg-surface" />
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border px-6 py-10 text-center font-ui text-[13px] text-text-dim">No trades yet.</p>
      ) : (
        <ul className="divide-y divide-border-soft rounded-2xl border border-border bg-panel">
          {rows.map(({ agentId, agentName, fill: f }) => {
            const buy = f.side === "buy" || f.side === "add_liquidity";
            const pnl = num(f.realized_pnl_usd);
            return (
              <li key={`${agentId}-${f.id}`}>
                <Link href={`/portfolio/${agentId}`} className={`flex items-center gap-3 px-4 py-3 font-ui text-[12.5px] hover:bg-surface ${FOCUS}`}>
                  <span className={`w-10 shrink-0 text-[11.5px] ${buy ? "text-positive" : "text-negative"}`}>{buy ? "Buy" : "Sell"}</span>
                  <span className="min-w-0 flex-1 truncate text-text-secondary">
                    {agentName} {buy ? "bought" : "sold"} {f.symbol} at <Price value={num(f.price_usd)} className="text-text-primary" />
                    {f.is_paper ? <span className="text-text-muted"> · Paper</span> : null}
                  </span>
                  <span className="tnum font-mono text-text-primary">{!buy && pnl !== null ? <Signed usd={pnl} /> : usd(num(f.filled_usd))}</span>
                  <span className="w-20 shrink-0 text-right text-[11.5px] text-text-muted">{ago(f.executed_at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ago(iso: string): string {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
