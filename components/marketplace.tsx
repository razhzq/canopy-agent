"use client";

import Link from "next/link";
import { useState } from "react";
import { AgentTile, Badge, ToolButton } from "@/components/ui";
import { EmptyState, ErrorState, LoadingState, SignedOutState } from "@/components/states";
import { listStrategies, hitRatePct, realizedReturnPct, type StrategyRow } from "@/lib/api";
import { useApi } from "@/lib/useApi";

/**
 * The marketplace: header stats, tabs and table, all from ONE fetch.
 *
 * They live in one component because they are three views of the same list.
 * Splitting them would mean either three requests for one page or one of them
 * silently showing a made-up number — and the headline figures are the ones a
 * user is most likely to quote back at you.
 */

const COLS =
  "grid grid-cols-[46px_minmax(0,1fr)_96px_64px_88px_72px_64px_96px] items-center gap-x-4";

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

type Tab = "all" | "published" | "verifying" | "delisted";

const TAB_NOUN: Record<Tab, string> = {
  all: "here",
  published: "listed",
  verifying: "on paper",
  delisted: "delisted",
};

function count(rows: StrategyRow[] | null, status: string): number | undefined {
  return rows?.filter((r) => r.status === status).length;
}

export function Marketplace() {
  const state = useApi<{ strategies: StrategyRow[] }>((token) => listStrategies(token));
  const rows = state.phase === "ready" ? state.data.strategies : null;

  // These were counters with a hardcoded active state and no click handler —
  // they looked like filters and did nothing.
  const [tab, setTab] = useState<Tab>("all");

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "all", label: "All", count: rows?.length },
    { key: "published", label: "Listed", count: count(rows, "published") },
    { key: "verifying", label: "Paper run", count: count(rows, "verifying") },
    { key: "delisted", label: "Delisted", count: count(rows, "delisted") },
  ];

  const visible = rows?.filter((r) => tab === "all" || r.status === tab) ?? [];

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
            Every strategy with a live record — published, and still on paper. Deploy a
            listed one as your own agent: you keep custody, you set every limit.
          </p>
        </div>
        <StatRail rows={rows} />
      </section>

      {/* --------------------------------------------------------- tabs */}
      <section className="flex items-center justify-between border-b border-grid px-8">
        <div className="flex">
          {tabs.map((t) => {
            const active = t.key === tab;
            // An empty bucket stays clickable: seeing "Delisted 0" and being
            // told so beats a dead control that looks broken.
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-pressed={active}
                className={`flex items-center gap-2 border-b-2 px-5 py-4 font-mono text-[12px] tracking-[0.1em] uppercase transition-colors ${
                  active
                    ? "border-accent text-text-primary"
                    : "border-transparent text-text-dim hover:text-text-secondary"
                }`}
              >
                {t.label}
                <span className={active ? "text-accent" : "text-text-muted"}>
                  {t.count ?? "—"}
                </span>
              </button>
            );
          })}
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
            title="Nothing here yet"
            body="Every strategy with a live record appears here — published, and still on paper. Nothing has started one yet."
            action={{ label: "Build an agent", href: "/build/new" }}
          />
        ) : visible.length === 0 ? (
          // A filter that matched nothing is a different situation from an
          // empty marketplace, and offering "build an agent" would be an odd
          // answer to "show me the delisted ones".
          <div className="flex flex-col items-center gap-3 border border-grid bg-panel px-8 py-12 text-center">
            <p className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
              Nothing {TAB_NOUN[tab]}
            </p>
            <p className="max-w-[46ch] font-ui text-[13px] leading-relaxed text-text-secondary">
              {rows!.length} other {rows!.length === 1 ? "strategy" : "strategies"} in the
              other tabs.
            </p>
            <button
              type="button"
              onClick={() => setTab("all")}
              className="font-mono text-[10.5px] tracking-[0.1em] text-accent uppercase transition-colors hover:text-text-primary"
            >
              Show all
            </button>
          </div>
        ) : (
          <>
            <div
              className={`${COLS} border-b border-grid py-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase`}
            >
              <span>Rank</span>
              <span>Name</span>
              <span className="text-right">Return</span>
              <span className="text-right">Hit</span>
              <span className="text-right">AUM</span>
              <span className="text-right">Users</span>
              <span className="text-right">Record</span>
              <span />
            </div>

            {visible.map((row, i) => {
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
                        {row.status === "verifying" ? (
                          <Badge tone="accent">Paper run</Badge>
                        ) : null}
                        {row.is_mine ? <Badge tone="muted">Yours</Badge> : null}
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

                  <span className="tnum text-right font-mono text-[13px] text-text-primary">
                    {hit === null ? "—" : `${hit.toFixed(0)}%`}
                  </span>

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

                  {/* Visibility and deployability are different things. Anyone
                      can read a paper run and judge it; nobody can put money
                      behind one. The author gets a link to publish it, everyone
                      else gets a link to study it. */}
                  {row.status === "verifying" ? (
                    <Link
                      href={
                        row.is_mine
                          ? `/build/new/publish?strategy=${row.id}`
                          : `/agents/${row.id}`
                      }
                      className="flex h-8 items-center justify-center border border-grid font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:border-accent hover:text-accent"
                    >
                      {row.is_mine ? "Publish" : "Record"}
                    </Link>
                  ) : (
                    <Link
                      href={`/deploy/describe?strategy=${row.id}`}
                      className="flex h-8 items-center justify-center border border-border font-mono text-[10px] tracking-[0.1em] text-text-secondary uppercase transition-colors hover:border-accent hover:text-accent"
                    >
                      Deploy
                    </Link>
                  )}
                </div>
              );
            })}

            <p className="py-5 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
              Showing {visible.length} of {rows!.length} · Returns are realised only, against
              mandate capital
            </p>
          </>
        )}
      </section>
    </>
  );
}
