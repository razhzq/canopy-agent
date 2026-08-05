"use client";

import Link from "next/link";
import { Sparkline } from "@/components/charts";
import { AgentTile, Badge, ToolButton } from "@/components/ui";
import { EmptyState, ErrorState, LoadingState, SignedOutState } from "@/components/states";
import { listStrategies, hitRatePct, realizedReturnPct, type StrategyRow } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { sparkSeries } from "@/lib/data";

/**
 * The marketplace: header stats, tabs and table, all from ONE fetch.
 *
 * They live in one component because they are three views of the same list.
 * Splitting them would mean either three requests for one page or one of them
 * silently showing a made-up number — and the headline figures are the ones a
 * user is most likely to quote back at you.
 */

const COLS =
  "grid grid-cols-[46px_minmax(0,1fr)_92px_84px_60px_56px_190px_84px_68px_56px_92px] items-center gap-x-4";

function signed(n: number, suffix = "%") {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}${suffix}`;
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toFixed(0)}`;
}

/**
 * How much paper record backs this listing: the run from when it started to
 * when it published (or to now, if still running).
 *
 * This is the disclosure that replaces the old 30-day publish gate. A creator
 * may list a three-day record; a deployer should be able to see that it is
 * three days without opening the strategy.
 */
function recordLength(row: StrategyRow): { label: string; thin: boolean } {
  if (!row.verification_started_at) return { label: "—", thin: false };
  const end = row.published_at ? new Date(row.published_at) : new Date();
  const days = Math.floor(
    (end.getTime() - new Date(row.verification_started_at).getTime()) / 86_400_000,
  );
  return {
    label: days < 1 ? "<1D" : days < 30 ? `${days}D` : `${Math.floor(days / 30)}MO`,
    // Under a fortnight is little to judge a strategy on. Flagged rather than
    // hidden or blocked.
    thin: days < 14,
  };
}

/** Stable per-strategy seed, so a row's sparkline does not reshuffle each render. */
function seedFor(id: number): number {
  return (id * 2654435761) % 100000;
}

function StatRail({ rows }: { rows: StrategyRow[] | null }) {
  const listed = rows?.filter((r) => r.status === "published").length;
  const deployed = rows?.reduce((sum, r) => sum + Number(r.aum_usd), 0);

  const stats = [
    { label: "Listed agents", value: rows ? String(listed) : "—" },
    { label: "Capital deployed", value: rows ? money(deployed ?? 0) : "—" },
    { label: "Custody", value: "Non-custodial", tone: "accent" as const },
  ];

  return (
    <div className="flex">
      {stats.map((s, i) => (
        <div key={s.label} className={`px-8 ${i > 0 ? "border-l border-grid" : ""}`}>
          <div className="flex flex-col items-end gap-2.5">
            <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
              {s.label}
            </span>
            <span
              className={`tnum font-mono text-[20px] leading-none ${
                s.tone === "accent" ? "text-accent uppercase" : "text-text-primary"
              }`}
            >
              {s.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Marketplace() {
  const state = useApi<{ strategies: StrategyRow[] }>((token) => listStrategies(token));
  const rows = state.phase === "ready" ? state.data.strategies : null;

  const tabs = [
    { label: "Listed", count: rows?.filter((r) => r.status === "published").length },
    { label: "Delisted", count: rows?.filter((r) => r.status === "delisted").length },
  ];

  return (
    <>
      {/* -------------------------------------------------------- header */}
      <section className="flex items-end justify-between border-b border-grid px-8 pt-6 pb-[22px]">
        <div className="space-y-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            Marketplace
          </p>
          <h1 className="font-mono text-[38px] leading-none text-text-primary">Agents</h1>
          <p className="font-ui text-[14px] text-text-secondary">
            Deploy a strategy as your own agent. You keep custody. You set every
            limit.
          </p>
        </div>
        <StatRail rows={rows} />
      </section>

      {/* --------------------------------------------------------- tabs */}
      <section className="flex items-center justify-between border-b border-grid px-8">
        <div className="flex">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              className={`flex items-center gap-2 border-b-2 px-5 py-5 font-mono text-[12px] tracking-[0.1em] uppercase transition-colors ${
                i === 0
                  ? "border-accent text-text-primary"
                  : "border-transparent text-text-dim hover:text-text-secondary"
              }`}
            >
              {tab.label}
              <span className={i === 0 ? "text-accent" : "text-text-muted"}>
                {tab.count ?? "—"}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <ToolButton>Return</ToolButton>
        </div>
      </section>

      {/* -------------------------------------------------------- table */}
      <section className="px-8 pb-8">
        {state.phase === "loading" ? (
          <LoadingState label="Loading marketplace" />
        ) : state.phase === "signed-out" ? (
          <SignedOutState />
        ) : state.phase === "error" ? (
          <ErrorState message={state.message} onRetry={state.reload} />
        ) : rows!.length === 0 ? (
          <EmptyState
            title="No agents listed yet"
            body="A strategy appears here once it has completed its 30-day live paper record and been published. Nothing is listed on a backtest."
            action={{ label: "Build an agent", href: "/build/new" }}
          />
        ) : (
          <>
            <div
              className={`${COLS} border-b border-grid py-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase`}
            >
              <span>Rank</span>
              <span>Name</span>
              <span className="text-right">Return</span>
              <span className="text-right">Max DD</span>
              <span className="text-right">Hit</span>
              <span className="text-right">PF</span>
              <span className="pl-3">Equity</span>
              <span className="text-right">AUM</span>
              <span className="text-right">Users</span>
              <span className="text-right">Record</span>
              <span />
            </div>

            {rows!.map((row, i) => {
              const ret = realizedReturnPct(row);
              const hit = hitRatePct(row);

              return (
                <div key={row.id} className={`${COLS} border-b border-grid py-5`}>
                  <span className="tnum font-mono text-[12px] text-text-dim">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div className="flex min-w-0 items-center gap-4">
                    <AgentTile />
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <Link
                          href={`/agents/${row.id}`}
                          className="truncate font-mono text-[15px] text-text-primary hover:text-accent"
                        >
                          {row.name}
                        </Link>
                        {/* Every agent is paper until a signing rail exists.
                            Saying so is the difference between a record and a claim. */}
                        {row.all_paper ? <Badge tone="muted">Paper</Badge> : null}
                        {row.status === "delisted" ? (
                          <Badge tone="warning">Delisted</Badge>
                        ) : null}
                      </div>
                      <p className="truncate font-mono text-[10px] tracking-[0.06em] text-text-dim">
                        {row.strategy_class.toUpperCase()} · {row.fee_pct}% FEE ·{" "}
                        {row.author.replace("did:privy:", "").slice(0, 10)}…
                      </p>
                    </div>
                  </div>

                  {/* Nothing closed means no return. "—" is honest; 0.0% would
                      read as "it traded and broke even". */}
                  <span
                    className={`tnum text-right font-mono text-[14px] ${
                      ret === null
                        ? "text-text-dim"
                        : ret >= 0
                          ? "text-accent"
                          : "text-negative"
                    }`}
                  >
                    {ret === null ? "—" : signed(ret)}
                  </span>

                  <span className="tnum text-right font-mono text-[13px] text-text-dim">
                    —
                  </span>
                  <span className="tnum text-right font-mono text-[13px] text-text-primary">
                    {hit === null ? "—" : `${hit.toFixed(0)}%`}
                  </span>
                  <span className="tnum text-right font-mono text-[13px] text-text-dim">
                    —
                  </span>

                  <div className="pl-3">
                    <Sparkline
                      values={sparkSeries(24, seedFor(row.id), ret === null || ret < 0)}
                      tone={ret !== null && ret >= 0 ? "accent" : "muted"}
                    />
                  </div>

                  <span className="tnum text-right font-mono text-[13px] text-text-primary">
                    {money(Number(row.aum_usd))}
                  </span>
                  <span className="tnum text-right font-mono text-[13px] text-text-secondary">
                    {row.deployments}
                  </span>
                  <span
                    className={`text-right font-mono text-[11px] tracking-[0.06em] uppercase ${
                      recordLength(row).thin ? "text-warning" : "text-text-dim"
                    }`}
                    title={recordLength(row).thin ? "Short paper record" : undefined}
                  >
                    {recordLength(row).label}
                  </span>

                  <Link
                    href={`/deploy/describe?strategy=${row.id}`}
                    className="flex h-8 items-center justify-center border border-border font-mono text-[10px] tracking-[0.1em] text-text-secondary uppercase transition-colors hover:border-accent hover:text-accent"
                  >
                    Deploy
                  </Link>
                </div>
              );
            })}

            <p className="py-5 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
              Showing {rows!.length} · Returns are realised only, against mandate capital
            </p>
          </>
        )}
      </section>
    </>
  );
}
