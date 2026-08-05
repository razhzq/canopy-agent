"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Breadcrumb } from "@/components/ui";
import { EmptyState, ErrorState, LoadingState, SignedOutState } from "@/components/states";
import {
  getAgent,
  getCycle,
  listAgents,
  listCycles,
  listProposals,
  type AgentDetail,
  type AgentRow,
  type CycleRow,
  type ProposalRow,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ActivityLog } from "@/components/activity";
import { EquityPanel } from "@/components/equity";
import {
  narrateDecision,
  SEAT_LABEL,
  SEAT_PURPOSE,
  SOURCE_LABEL,
  type NarratedLine,
} from "@/lib/narrate";

/* ------------------------------------------------------------- helpers ---- */

function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function when(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

const STATUS_TONE: Record<string, "accent" | "warning" | "negative" | "muted"> = {
  active: "accent",
  // Winding down after a drawdown breach: still running, but only to close.
  // Negative rather than warning — it is the outcome of a breached limit, not a
  // caution, and it should not read as an ordinary pause.
  liquidating: "negative",
  paused: "warning",
  stopped: "negative",
  draft: "muted",
};

/** The raw status is a state name; these are what it means to an owner. */
const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  liquidating: "Closing out",
  paused: "Paused",
  stopped: "Stopped",
  draft: "Draft",
};

/* ------------------------------------------------------------ agent list -- */

export function AgentList() {
  const state = useApi<{ agents: AgentRow[] }>((t) => listAgents(t));

  if (state.phase === "loading") return <LoadingState label="Loading your agents" />;
  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "error") return <ErrorState message={state.message} onRetry={state.reload} />;

  const agents = state.data.agents;
  if (agents.length === 0) {
    return (
      <EmptyState
        title="No agents deployed"
        body="Deploy a published strategy and it will run here on your mandate, with your limits."
        action={{ label: "Browse agents", href: "/agents" }}
      />
    );
  }

  return (
    <div className="border border-grid">
      {agents.map((a, i) => (
        <Link
          key={a.id}
          href={`/portfolio/${a.id}`}
          className={`grid grid-cols-[minmax(0,1fr)_120px_120px_110px_90px] items-center gap-4 px-6 py-5 transition-colors hover:bg-surface ${
            i > 0 ? "border-t border-grid" : ""
          }`}
        >
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="truncate font-mono text-[15px] text-text-primary">
                {a.strategy_name}
              </span>
              <Badge tone={STATUS_TONE[a.status] ?? "muted"}>
                {STATUS_LABEL[a.status] ?? a.status}
              </Badge>
              {/* Nothing here has traded real funds. Say so on every row. */}
              {a.is_paper ? <Badge tone="muted">Paper</Badge> : null}
            </div>
            <p className="font-mono text-[10px] tracking-[0.06em] text-text-dim uppercase">
              {a.strategy_class} · {a.autonomy.replace(/_/g, " ")}
            </p>
          </div>
          <span className="tnum text-right font-mono text-[13px] text-text-primary">
            {money(Number(a.capital_usd))}
          </span>
          <span className="text-right font-mono text-[11px] tracking-[0.06em] text-text-dim uppercase">
            {when(a.last_tick_at)}
          </span>
          <span className="text-right font-mono text-[11px] tracking-[0.06em] text-text-dim uppercase">
            {a.next_tick_at ? when(a.next_tick_at).replace(" ago", "") : "—"}
          </span>
          <span className="text-right font-mono text-[10px] tracking-[0.1em] text-accent uppercase">
            Open
          </span>
        </Link>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- monitor -- */

export function AgentMonitor({ agentId }: { agentId: number }) {
  const state = useApi<AgentDetail>((t) => getAgent(t, agentId), [agentId]);
  const proposals = useApi<{ proposals: ProposalRow[] }>(
    (t) => listProposals(t, agentId, "pending"),
    [agentId],
  );

  if (state.phase === "loading") return <LoadingState label="Loading agent" />;
  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "error") return <ErrorState message={state.message} onRetry={state.reload} />;

  const { agent, positions, lastRun, wallet } = state.data;
  const deployed = positions.reduce((s, p) => s + Number(p.cost_basis_usd), 0);

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------- headline */}
      <section className="flex items-end justify-between border-b border-grid px-8 pt-6 pb-6">
        <div className="space-y-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            {agent.strategy_class} · {agent.autonomy.replace(/_/g, " ")}
          </p>
          <div className="flex items-center gap-4">
            <h1 className="font-mono text-[30px] leading-none text-text-primary">
              {agent.strategy_name}
            </h1>
            <Badge tone={STATUS_TONE[agent.status] ?? "muted"}>
              {STATUS_LABEL[agent.status] ?? agent.status}
            </Badge>
            {agent.is_paper ? <Badge tone="muted">Paper</Badge> : null}
          </div>
        </div>
        <div className="flex shrink-0">
          {[
            { label: "Mandate", value: money(Number(agent.capital_usd)) },
            { label: "Deployed", value: money(deployed) },
            { label: "Positions", value: String(positions.length) },
          ].map((s, i) => (
            <div key={s.label} className={`px-7 ${i > 0 ? "border-l border-grid" : ""}`}>
              <div className="flex flex-col items-end gap-2.5">
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {s.label}
                </span>
                <span className="tnum font-mono text-[19px] leading-none text-text-primary">
                  {s.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------- performance beside custody */}
      {/* Two thirds / one third rather than stacked full-width blocks.
          Performance is what the page is for; custody is a fact you check
          once. Giving them equal width made them read as equal in weight, and
          pushed the activity log a whole screen further down. */}
      <section className="grid gap-6 px-8 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <h2 className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
            Performance
          </h2>
          <EquityPanel agentId={agentId} />
        </div>

        <div className="min-w-0">
          <h2 className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
            Custody
          </h2>
          {wallet ? (
            // Stacked rows, not four columns: at a third of the width the old
            // 4-up grid gave each value about sixty pixels.
            <div className="border border-grid">
              {[
                { k: "Address", v: `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` },
                { k: "Model", v: wallet.ownerModel.replace(/_/g, " ") },
                { k: "Remaining", v: money(wallet.remainingUsd) },
                { k: "Status", v: wallet.status },
              ].map((c) => (
                <div
                  key={c.k}
                  className="flex items-baseline justify-between gap-4 border-b border-grid px-4 py-3 last:border-b-0"
                >
                  <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                    {c.k}
                  </span>
                  <span className="truncate font-mono text-[12.5px] text-text-primary uppercase">
                    {c.v}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            // Honest: no wallet is the correct state for a paper agent, and
            // saying so beats an empty panel that looks like a loading failure.
            <div className="border border-grid px-5 py-5">
              <p className="font-ui text-[12.5px] leading-relaxed text-text-secondary">
                No wallet. This agent runs in paper mode, so nothing is funded and nothing can
                be signed. A wallet is provisioned only when a published strategy is deployed
                against real capital.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------ proposals */}
      <section className="px-8">
        <h2 className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
          Awaiting your approval
        </h2>
        {proposals.phase === "ready" && proposals.data.proposals.length > 0 ? (
          <div className="border border-grid">
            {proposals.data.proposals.map((p, i) => (
              <div key={p.id} className={`space-y-3 p-6 ${i > 0 ? "border-t border-grid" : ""}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[15px] text-text-primary">{p.symbol}</span>
                    <Badge tone="muted">{p.side}</Badge>
                    {p.underlying ? (
                      <span className="font-mono text-[10px] tracking-[0.06em] text-text-dim uppercase">
                        {p.underlying}
                      </span>
                    ) : null}
                  </div>
                  <span className="tnum font-mono text-[15px] text-accent">
                    {money(Number(p.approved_size_usd))}
                  </span>
                </div>
                {p.rationale ? (
                  <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
                    {p.rationale}
                  </p>
                ) : null}
                <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  Stop {p.stop_loss_pct ?? "—"}% · Target {p.take_profit_pct ?? "—"}% ·
                  Confidence {p.confidence ?? "—"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-grid px-6 py-5">
            <p className="font-ui text-[13px] text-text-secondary">
              Nothing waiting. Proposals appear here when the agent finds something that
              clears every limit you set.
            </p>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- positions */}
      <section className="px-8 pb-8">
        <div className="flex items-center justify-between pb-4">
          <h2 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
            Open positions
          </h2>
          <Link
            href={`/portfolio/${agentId}/cycles`}
            className="font-mono text-[10px] tracking-[0.1em] text-accent uppercase"
          >
            Cycle history {lastRun ? `· last #${lastRun.tick_seq}` : ""}
          </Link>
        </div>
        {positions.length === 0 ? (
          <div className="border border-grid px-6 py-5">
            <p className="font-ui text-[13px] text-text-secondary">
              No open positions.
              {lastRun?.skip_reason
                ? ` The last cycle did not trade: ${lastRun.skip_reason.replace(/_/g, " ")}.`
                : ""}
            </p>
          </div>
        ) : (
          <div className="border border-grid">
            {positions.map((p, i) => (
              <div
                key={p.id}
                className={`grid grid-cols-[minmax(0,1fr)_110px_110px_130px] items-center gap-4 px-6 py-4 ${
                  i > 0 ? "border-t border-grid" : ""
                }`}
              >
                <div className="min-w-0">
                  <span className="font-mono text-[14px] text-text-primary">{p.symbol}</span>
                  {p.underlying ? (
                    <span className="pl-2 font-mono text-[10px] tracking-[0.06em] text-text-dim uppercase">
                      {p.underlying}
                    </span>
                  ) : null}
                </div>
                <span className="tnum text-right font-mono text-[13px] text-text-secondary">
                  {Number(p.qty).toFixed(4)}
                </span>
                <span className="tnum text-right font-mono text-[13px] text-text-primary">
                  {money(Number(p.cost_basis_usd))}
                </span>
                {/* Attribution: which SME and which signal opened this. */}
                <span className="text-right font-mono text-[10px] tracking-[0.06em] text-text-dim uppercase">
                  {p.opened_by_sme ?? "—"}
                  {p.opened_by_signal ? ` · ${p.opened_by_signal}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- activity */}
      <section className="px-8 pb-10">
        <div className="flex items-end justify-between pb-5">
          <div className="space-y-2">
            <h2 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
              Activity
            </h2>
            <p className="font-ui text-[13px] text-text-secondary">
              What the agent did, cycle by cycle — including the cycles where it looked at
              everything and bought nothing.
            </p>
          </div>
          <Link
            href={`/portfolio/${agentId}/cycles`}
            className="shrink-0 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:text-accent"
          >
            All cycles →
          </Link>
        </div>
        <ActivityLog agentId={agentId} />
      </section>
    </div>
  );
}

/* ----------------------------------------------------------- cycle list -- */

const OUTCOME_TONE: Record<string, "accent" | "warning" | "negative" | "muted"> = {
  ok: "accent",
  skipped: "muted",
  error: "negative",
  running: "warning",
};

export function CycleList({ agentId }: { agentId: number }) {
  const state = useApi<{ cycles: CycleRow[] }>((t) => listCycles(t, agentId), [agentId]);

  if (state.phase === "loading") return <LoadingState label="Loading cycles" />;
  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "error") return <ErrorState message={state.message} onRetry={state.reload} />;

  const cycles = state.data.cycles;
  if (cycles.length === 0) {
    return (
      <EmptyState
        title="No cycles yet"
        body="Every time the agent wakes up it records a cycle here — including the ones where it decided to do nothing."
      />
    );
  }

  return (
    <div className="border border-grid">
      {cycles.map((c, i) => (
        <Link
          key={c.id}
          href={`/portfolio/${agentId}/cycles/${c.id}`}
          className={`grid grid-cols-[70px_minmax(0,1fr)_120px_100px_90px] items-center gap-4 px-6 py-4 transition-colors hover:bg-surface ${
            i > 0 ? "border-t border-grid" : ""
          }`}
        >
          <span className="tnum font-mono text-[13px] text-text-dim">#{c.tick_seq}</span>
          <div className="flex items-center gap-3">
            <Badge tone={OUTCOME_TONE[c.status] ?? "muted"}>{c.status}</Badge>
            {/* A skip is a first-class outcome — an RWA agent skips every
                weekend by design — so the reason is shown, not hidden. */}
            {c.skip_reason ? (
              <span className="font-mono text-[11px] text-text-dim">
                {c.skip_reason.replace(/_/g, " ")}
              </span>
            ) : null}
          </div>
          <span className="text-right font-mono text-[11px] tracking-[0.06em] text-text-dim uppercase">
            {when(c.started_at)}
          </span>
          <span className="tnum text-right font-mono text-[12px] text-text-secondary">
            {c.risk_decisions} judged
          </span>
          <span className="tnum text-right font-mono text-[12px] text-negative">
            {Number(c.blocked) > 0 ? `${c.blocked} blocked` : "—"}
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- cycle trace -- */

/**
 * The council transcript — a direct rendering of trading_agent_decisions.
 *
 * If this screen shows something, the audit trail is real: every row here was
 * written by the loop before it acted, and the adapter ids name the data that
 * produced it.
 */
export function CycleTrace({ agentId, runId }: { agentId: number; runId: string }) {
  const state = useApi<Awaited<ReturnType<typeof getCycle>>>(
    (t) => getCycle(t, agentId, runId),
    [agentId, runId],
  );

  // The trail renders in every phase, not just the happy one. Three levels
  // deep, a failed or slow fetch would otherwise leave the browser's back
  // button as the only way out of the page.
  const crumbs = (tickSeq?: string) => (
    <div className="px-8 pt-6">
      <Breadcrumb
        parts={[
          { label: "Portfolio", href: "/portfolio" },
          { label: `Agent ${agentId}`, href: `/portfolio/${agentId}` },
          { label: "Cycles", href: `/portfolio/${agentId}/cycles` },
          tickSeq ? `Cycle #${tickSeq}` : "Cycle",
        ]}
      />
    </div>
  );

  if (state.phase === "loading")
    return (
      <>
        {crumbs()}
        <LoadingState label="Loading the trace" />
      </>
    );
  if (state.phase === "signed-out")
    return (
      <>
        {crumbs()}
        <SignedOutState />
      </>
    );
  if (state.phase === "error")
    return (
      <>
        {crumbs()}
        <ErrorState message={state.message} onRetry={state.reload} />
      </>
    );

  const { run, decisions } = state.data;

  return (
    <div className="space-y-6 px-8 pb-10">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-grid pt-6 pb-6">
        <div className="space-y-2.5">
          <Breadcrumb
            parts={[
              { label: "Portfolio", href: "/portfolio" },
              { label: `Agent ${agentId}`, href: `/portfolio/${agentId}` },
              { label: "Cycles", href: `/portfolio/${agentId}/cycles` },
              `Cycle #${run.tick_seq}`,
            ]}
          />
          <h1 className="font-mono text-[26px] leading-none text-text-primary">
            What the agent did
          </h1>
          <p className="max-w-[64ch] font-ui text-[13px] text-text-secondary">
            Each seat in the order it spoke, written before the agent acted rather than
            reconstructed afterwards. Every line restates something that was recorded — open
            the record on any seat to see it verbatim.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={OUTCOME_TONE[run.status] ?? "muted"}>{run.status}</Badge>
          {run.skip_reason ? (
            <Badge tone="muted">{run.skip_reason.replace(/_/g, " ")}</Badge>
          ) : null}
        </div>
      </section>

      {decisions.map((d, i) => (
        <Seat key={i} index={i} decision={d} />
      ))}
    </div>
  );
}

/** One council seat: what it did, in English, over the record it wrote. */
function Seat({
  index,
  decision: d,
}: {
  index: number;
  decision: Awaited<ReturnType<typeof getCycle>>["decisions"][number];
}) {
  const [raw, setRaw] = useState(false);
  const lines = narrateDecision(d);

  return (
    <section className="border border-grid">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-grid px-5 py-3.5">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="tnum font-mono text-[10px] text-text-dim">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="font-mono text-[12.5px] tracking-[0.08em] text-text-primary uppercase">
            {SEAT_LABEL[d.role] ?? d.role}
          </span>
          <span className="truncate font-ui text-[12px] text-text-dim">
            {SEAT_PURPOSE[d.role] ?? ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
          {d.model ? <span>{d.model}</span> : null}
          {d.latency_ms ? <span>{(d.latency_ms / 1000).toFixed(1)}s</span> : null}
          {d.cost_usd && Number(d.cost_usd) > 0 ? (
            <span>${Number(d.cost_usd).toFixed(5)}</span>
          ) : null}
          <button
            type="button"
            onClick={() => setRaw((r) => !r)}
            aria-expanded={raw}
            className="tracking-[0.1em] transition-colors hover:text-accent"
          >
            {raw ? "Hide record" : "Record"}
          </button>
        </div>
      </div>

      {lines.length > 0 ? (
        <ol>
          {lines.map((line, i) => (
            <li
              key={i}
              className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-3 border-b border-grid px-5 py-2.5 last:border-b-0"
            >
              <span className="mt-0.5">
                <TraceMark outcome={line.outcome} />
              </span>
              <span className="min-w-0">
                <span className="font-ui text-[13px] leading-relaxed text-text-secondary">
                  {line.symbol ? (
                    <span className="font-mono text-[12px] text-text-primary">
                      {line.symbol}{" "}
                    </span>
                  ) : null}
                  {line.detail}
                </span>
                {line.source ? (
                  <span className="ml-2 font-mono text-[10px] tracking-[0.06em] text-text-dim uppercase">
                    {line.source}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        // No narration for this shape. Show the record rather than nothing —
        // an unrecognised output is still evidence.
        <pre className="overflow-x-auto px-5 py-4 font-mono text-[11.5px] leading-relaxed text-text-dim">
          {JSON.stringify(d.output, null, 2)}
        </pre>
      )}

      {raw ? (
        <div className="border-t border-grid bg-panel">
          <p className="px-5 pt-3 font-mono text-[9.5px] tracking-[0.12em] text-text-muted uppercase">
            Recorded verbatim
          </p>
          <pre className="overflow-x-auto px-5 pb-4 font-mono text-[11.5px] leading-relaxed text-text-dim">
            {JSON.stringify(d.output, null, 2)}
          </pre>
        </div>
      ) : null}

      {d.adapter_ids?.length ? (
        <div className="border-t border-grid px-5 py-2.5">
          <span className="font-mono text-[9.5px] tracking-[0.1em] text-text-muted uppercase">
            Data from {d.adapter_ids.map((a) => SOURCE_LABEL[a] ?? a).join(" · ")}
          </span>
        </div>
      ) : null}
    </section>
  );
}

function TraceMark({ outcome }: { outcome: NarratedLine["outcome"] }) {
  if (outcome === "pass") {
    return (
      <svg viewBox="0 0 16 16" className="size-3.5 text-accent" aria-label="passed">
        <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (outcome === "drop") {
    return (
      <svg viewBox="0 0 16 16" className="size-3.5 text-text-dim" aria-label="stopped">
        <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (outcome === "work") {
    return (
      <svg viewBox="0 0 16 16" className="size-3.5 text-accent" aria-label="step">
        <circle cx="8" cy="8" r="3" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 text-text-dim" aria-label="note">
      <circle cx="8" cy="8" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
