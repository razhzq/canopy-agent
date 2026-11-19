"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MiniCurve } from "@/components/charts";
import { FOCUS, PRIMARY, SECONDARY } from "@/components/kit";
import { ErrorState, SignedOutState } from "@/components/states";
import { Segmented, UnderlineTabs } from "@/components/trade/bits";
import { listStrategies, num, realizedReturnPct, return30dPct, type StrategyRow } from "@/lib/api";
import { useCachedApi } from "@/lib/useApi";
import { Signed } from "@/components/portfolio2/bits";
import { CopySheet } from "./copySheet";

type Market = "board" | "spot" | "pools" | "perps";
type Sort = "steady" | "bold" | "copiers" | "new";
type Risk = "all" | "low" | "mid" | "high";
type Status = "all" | "live" | "paper";

const MARKET_OF = (s: StrategyRow): Exclude<Market, "board"> =>
  s.agent_kind === "lp" || s.agent_kind === "copy_lp" ? "pools" : s.agent_kind === "perp" ? "perps" : "spot";

/** Return over the record: the stats figure, else realised P&L on the mandate. */
export function recordReturn(s: StrategyRow): number | null {
  return s.stats?.returnPct ?? realizedReturnPct(s);
}

function riskOf(s: StrategyRow): Exclude<Risk, "all"> | null {
  const dd = s.stats?.maxDrawdownPct;
  if (dd == null) return null;
  const a = Math.abs(dd);
  return a < 10 ? "low" : a <= 25 ? "mid" : "high";
}

/** Copy: published agents, ranked, each one copyable onto paper in one sheet. */
/** `preview` swaps the live list for fixtures (the dev-only preview route). */
export function CopyScreen({ preview }: { preview?: StrategyRow[] } = {}) {
  const loaded = useCachedApi<{ strategies: StrategyRow[] }>("explore:strategies", (token) => listStrategies(token));
  const state = preview ? { phase: "ready" as const, data: { strategies: preview }, reload: () => {} } : loaded;
  const [market, setMarket] = useState<Market>("spot");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("steady");
  const [risk, setRisk] = useState<Risk>("all");
  const [status, setStatus] = useState<Status>("all");
  const [copying, setCopying] = useState<StrategyRow | null>(null);

  const all = useMemo(
    () => (state.phase === "ready" ? state.data.strategies.filter((s) => s.status === "published" || s.status === "verifying") : []),
    [state],
  );
  const count = (m: Exclude<Market, "board">) => all.filter((s) => MARKET_OF(s) === m).length;

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = all.filter(
      (s) =>
        (market === "board" || MARKET_OF(s) === market) &&
        (status === "all" || (status === "live" ? !s.all_paper : !!s.all_paper)) &&
        (risk === "all" || riskOf(s) === risk) &&
        (!term || `${s.name} ${s.author_username ?? ""} ${s.author}`.toLowerCase().includes(term)),
    );
    const key: Record<Sort, (s: StrategyRow) => number> = {
      steady: (s) => s.stats?.sharpe ?? -99,
      bold: (s) => recordReturn(s) ?? -999,
      copiers: (s) => num(s.deployments) ?? 0,
      new: (s) => (s.published_at ? Date.parse(s.published_at) : 0),
    };
    return rows.sort((a, b) => key[sort](b) - key[sort](a));
  }, [all, market, q, sort, risk, status]);

  if (state.phase === "signed-out") return <Shell><SignedOutState /></Shell>;
  if (state.phase === "error") return <Shell><ErrorState message={state.message} onRetry={state.reload} /></Shell>;

  return (
    <Shell>
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-ui text-[28px] font-light tracking-[-0.02em] text-text-primary">Top agents, tested and tracked</h1>
              <p className="mt-1 max-w-[560px] font-ui text-[13px] text-text-dim">
                Every agent publishes its results from day one, paper and live, so you can see if it holds up.
              </p>
            </div>
            <Link href="/studio" className={SECONDARY}>
              Publish your agent
            </Link>
          </div>

          <UnderlineTabs<Market>
            label="Market"
            value={market}
            onChange={setMarket}
            className="mb-4"
            tabs={[
              { key: "board", label: "Leaderboard" },
              { key: "spot", label: <>Spot <Count n={count("spot")} /></> },
              { key: "pools", label: <>Pools <Count n={count("pools")} /></> },
              ...(count("perps") ? [{ key: "perps" as const, label: <>Perps <Count n={count("perps")} /></> }] : []),
            ]}
          />

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or creator"
              aria-label="Search agents"
              className="h-9 min-w-[200px] flex-1 rounded-full border border-border bg-surface px-4 font-ui text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-grid-strong sm:max-w-[280px]"
            />
            <Select label="Sort by" value={sort} onChange={setSort} options={[["steady", "Most consistent"], ["bold", "Highest return"], ["copiers", "Most copiers"], ["new", "Newest"]]} />
            <Select label="Risk" value={risk} onChange={setRisk} options={[["all", "All"], ["low", "Low"], ["mid", "Medium"], ["high", "High"]]} />
            <Select label="Status" value={status} onChange={setStatus} options={[["all", "All"], ["live", "Live"], ["paper", "Paper only"]]} />
          </div>

          {state.phase !== "ready" ? (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3" aria-busy>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[300px] animate-pulse rounded-2xl bg-surface" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-border px-6 py-14 text-center font-ui text-[13px] text-text-dim">
              No agents match your filters. Clear one to see more.
            </div>
          ) : market === "board" ? (
            <Board rows={list} onCopy={setCopying} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {list.map((s) => (
                <AgentCard key={s.id} s={s} onCopy={() => setCopying(s)} />
              ))}
            </div>
          )}
        </div>

        <Side all={all} onCopy={setCopying} />
      </div>
      {copying && <CopySheet strategy={copying} onClose={() => setCopying(null)} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-[1320px] px-4 py-8 lg:px-6">{children}</main>;
}

function Count({ n }: { n: number }) {
  return n ? <span className="tnum ml-1 font-mono text-[11px] text-text-muted">{n}</span> : null;
}

function Select<K extends string>({ label, value, onChange, options }: { label: string; value: K; onChange: (k: K) => void; options: [K, string][] }) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-full border border-border bg-surface pr-2 pl-3.5 font-ui text-[12.5px]">
      <span className="text-text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as K)} className="bg-transparent text-text-primary outline-none">
        {options.map(([k, l]) => (
          <option key={k} value={k} className="bg-surface">
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function author(s: StrategyRow): string {
  return s.author_username ? `@${s.author_username}` : s.author;
}

function kindLabel(s: StrategyRow): string {
  if (s.strategy_class === "rwa" && (!s.agent_kind || s.agent_kind === "spot")) return "Stocks";
  switch (s.agent_kind) {
    case "lp":
      return "Pool";
    case "copy_lp":
      return "Copy LP";
    case "perp":
      return "Perps";
    case "grid":
      return "Grid";
    default:
      return "Spot";
  }
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-ui text-[11px] text-text-muted">{label}</p>
      <p className="tnum truncate font-mono text-[13px] text-text-primary">{children}</p>
    </div>
  );
}

function AgentCard({ s, onCopy }: { s: StrategyRow; onCopy: () => void }) {
  const ret = recordReturn(s);
  const r30 = return30dPct(s);
  const points = (s.spark ?? []).map(Number).filter(Number.isFinite);
  const st = s.stats;
  return (
    <article className="flex flex-col gap-3.5 rounded-2xl border border-border bg-panel p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-ui text-[13px] text-text-primary">{s.name.slice(0, 1).toUpperCase()}</span>
        <Link href={`/agents/${s.id}`} className={`min-w-0 flex-1 truncate font-ui text-[14px] font-medium text-text-primary hover:underline ${FOCUS}`}>
          {s.name}
        </Link>
        <span className={`rounded-full border px-2 py-0.5 font-ui text-[11px] ${s.all_paper ? "border-border text-text-muted" : "border-accent/40 text-positive"}`}>
          {s.all_paper ? "Paper only" : "Live"}
        </span>
      </div>
      <p className="-mt-1.5 font-ui text-[12px] text-text-muted">
        {kindLabel(s)} · {author(s)}
      </p>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-ui text-[11px] text-text-muted">{st?.days ? `Return · ${st.days}d tracked` : "Return"}</p>
          <p className="tnum font-mono text-[22px] leading-tight">
            <Signed pct={ret} />
          </p>
        </div>
        <MiniCurve values={points} tone={(ret ?? 0) < 0 ? "negative" : "accent"} width={150} height={40} />
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-border-soft pt-3">
        <Stat label="Last 30 days">
          <Signed pct={r30} digits={1} />
        </Stat>
        <Stat label="Worst dip">{st?.maxDrawdownPct != null ? `${Math.abs(st.maxDrawdownPct).toFixed(1)}%` : "—"}</Stat>
        <Stat label="Steadiness">{st?.sharpe != null ? st.sharpe.toFixed(2) : "—"}</Stat>
        <Stat label="Win rate">{st?.winRatePct != null ? `${Math.round(st.winRatePct)}%` : "—"}</Stat>
        <Stat label="Profit share">{`${num(s.fee_pct) ?? 0}%`}</Stat>
        <Stat label="Copiers">{num(s.deployments) ?? 0}</Stat>
      </div>
      <div className="mt-auto flex gap-2">
        <button type="button" className={`${PRIMARY} flex-1`} onClick={onCopy}>
          Copy
        </button>
        <Link href={`/agents/${s.id}`} className={SECONDARY}>
          Record
        </Link>
      </div>
    </article>
  );
}

type Col = "ret" | "r30" | "sharpe" | "dd" | "copiers";

function Board({ rows, onCopy }: { rows: StrategyRow[]; onCopy: (s: StrategyRow) => void }) {
  const [col, setCol] = useState<Col>("ret");
  const val: Record<Col, (s: StrategyRow) => number> = {
    ret: (s) => recordReturn(s) ?? -999,
    r30: (s) => return30dPct(s) ?? -999,
    sharpe: (s) => s.stats?.sharpe ?? -99,
    dd: (s) => -(Math.abs(s.stats?.maxDrawdownPct ?? 999)),
    copiers: (s) => num(s.deployments) ?? 0,
  };
  const sorted = [...rows].sort((a, b) => val[col](b) - val[col](a));
  const th = (c: Col, label: string, title?: string) => (
    <th className="px-3 py-3 text-right font-normal">
      <button type="button" title={title} onClick={() => setCol(c)} className={`${col === c ? "text-text-primary" : "text-text-muted hover:text-text-primary"} ${FOCUS}`}>
        {label}
        {col === c ? " ↓" : ""}
      </button>
    </th>
  );
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-panel">
      <table className="w-full min-w-[760px] font-ui text-[12.5px]">
        <thead>
          <tr className="border-b border-border text-left text-[11.5px] text-text-muted">
            <th className="w-12 px-3 py-3 font-normal">#</th>
            <th className="px-3 py-3 font-normal">Agent</th>
            {th("ret", "Return")}
            {th("r30", "Last 30 days")}
            {th("sharpe", "Steadiness", "Sharpe ratio: return for the risk taken. Higher is steadier.")}
            {th("dd", "Worst dip", "Max drawdown: the biggest drop from a peak.")}
            {th("copiers", "Copiers")}
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr key={s.id} className="border-b border-border-soft last:border-0">
              <td className="tnum px-3 py-3 font-mono text-text-muted">{i + 1}</td>
              <td className="px-3 py-3">
                <Link href={`/agents/${s.id}`} className={`text-text-primary hover:underline ${FOCUS}`}>
                  {s.name}
                </Link>
                <p className="text-[11.5px] text-text-muted">
                  {kindLabel(s)} · {author(s)} · {s.all_paper ? "Paper only" : "Live"}
                </p>
              </td>
              <td className="px-3 py-3 text-right"><Signed pct={recordReturn(s)} digits={1} /></td>
              <td className="px-3 py-3 text-right"><Signed pct={return30dPct(s)} digits={1} /></td>
              <td className="tnum px-3 py-3 text-right font-mono text-text-primary">{s.stats?.sharpe != null ? s.stats.sharpe.toFixed(2) : "—"}</td>
              <td className="tnum px-3 py-3 text-right font-mono text-text-primary">{s.stats?.maxDrawdownPct != null ? `${Math.abs(s.stats.maxDrawdownPct).toFixed(1)}%` : "—"}</td>
              <td className="tnum px-3 py-3 text-right font-mono text-text-primary">{num(s.deployments) ?? 0}</td>
              <td className="px-3 py-3 text-right">
                <button type="button" className={`${SECONDARY} h-8 px-3 text-[12px]`} onClick={() => onCopy(s)}>
                  Copy
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Creators ranked by what their agents made, the newest submissions, and the way to earn. */
function Side({ all, onCopy }: { all: StrategyRow[]; onCopy: (s: StrategyRow) => void }) {
  const [by, setBy] = useState<"profit" | "ret">("profit");
  const creators = useMemo(() => {
    const m = new Map<string, { name: string; profit: number; capital: number; agents: number }>();
    for (const s of all) {
      const k = author(s);
      const c = m.get(k) ?? { name: k, profit: 0, capital: 0, agents: 0 };
      c.profit += num(s.realized_pnl_usd) ?? 0;
      c.capital += num(s.mandate_capital_usd) ?? 0;
      c.agents += 1;
      m.set(k, c);
    }
    return [...m.values()]
      .map((c) => ({ ...c, ret: c.capital > 0 ? (c.profit / c.capital) * 100 : 0 }))
      .sort((a, b) => (by === "profit" ? b.profit - a.profit : b.ret - a.ret))
      .slice(0, 8);
  }, [all, by]);
  const fresh = [...all].filter((s) => s.published_at).sort((a, b) => Date.parse(b.published_at!) - Date.parse(a.published_at!)).slice(0, 3);

  return (
    <aside className="h-fit space-y-6 rounded-2xl border border-border bg-panel p-4 xl:sticky xl:top-[80px]">
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-ui text-[14px] font-medium text-text-primary">Creators</h3>
          <Segmented
            label="Rank by"
            value={by}
            onChange={setBy}
            options={[
              { key: "profit", label: "Profit" },
              { key: "ret", label: "Return" },
            ]}
          />
        </div>
        <ol className="space-y-1.5">
          {creators.map((c, i) => (
            <li key={c.name} className="flex items-center gap-2.5 font-ui text-[12.5px]">
              <span className="tnum w-4 font-mono text-[11px] text-text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-text-secondary">{c.name}</span>
              <span className="text-[11px] text-text-muted">{c.agents}</span>
              <span className="w-20 text-right">{by === "profit" ? <Signed usd={c.profit} /> : <Signed pct={c.ret} digits={1} />}</span>
            </li>
          ))}
        </ol>
      </section>
      {fresh.length > 0 && (
        <section>
          <h3 className="mb-2 font-ui text-[14px] font-medium text-text-primary">New submissions</h3>
          <ul className="space-y-1">
            {fresh.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onCopy(s)} className={`w-full rounded-lg px-2 py-1.5 text-left hover:bg-surface ${FOCUS}`}>
                  <p className="truncate font-ui text-[13px] text-text-primary">{s.name}</p>
                  <p className="font-ui text-[11.5px] text-text-muted">
                    {author(s)} · <Signed pct={recordReturn(s)} digits={1} />
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="rounded-xl border border-border bg-surface p-3.5">
        <p className="font-ui text-[13px] font-medium text-text-primary">Earn as a creator</p>
        <p className="mt-1 mb-3 font-ui text-[12px] text-text-dim">Publish an agent. When people copy it, you earn a share of their profit.</p>
        <Link href="/studio" className={`${SECONDARY} w-full`}>
          Publish your agent
        </Link>
      </section>
      <p className="font-ui text-[11px] text-text-muted">Profit shown is realised profit across each creator’s published agents.</p>
    </aside>
  );
}
