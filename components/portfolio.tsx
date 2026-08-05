"use client";

import Link from "next/link";
import { Badge } from "@/components/ui";
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
  paused: "warning",
  stopped: "negative",
  draft: "muted",
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
              <Badge tone={STATUS_TONE[a.status] ?? "muted"}>{a.status}</Badge>
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
            <Badge tone={STATUS_TONE[agent.status] ?? "muted"}>{agent.status}</Badge>
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

      {/* -------------------------------------------------------- custody */}
      <section className="px-8">
        <h2 className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
          Custody
        </h2>
        {wallet ? (
          <div className="grid grid-cols-4 border border-grid">
            {[
              { k: "Address", v: `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` },
              { k: "Model", v: wallet.ownerModel.replace(/_/g, " ") },
              { k: "Remaining", v: money(wallet.remainingUsd) },
              { k: "Status", v: wallet.status },
            ].map((c, i) => (
              <div key={c.k} className={`space-y-3 p-5 ${i > 0 ? "border-l border-grid" : ""}`}>
                <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {c.k}
                </p>
                <p className="font-mono text-[13px] text-text-primary uppercase">{c.v}</p>
              </div>
            ))}
          </div>
        ) : (
          // Honest: no wallet is the correct state for a paper agent, and
          // saying so beats an empty panel that looks like a loading failure.
          <div className="border border-grid px-6 py-5">
            <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
              No wallet. This agent runs in paper mode, so nothing is funded and nothing can
              be signed. A wallet is provisioned only when a published strategy is deployed
              against real capital.
            </p>
          </div>
        )}
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

const SEAT_LABEL: Record<string, string> = {
  desk: "The Desk",
  analyst: "The Analyst",
  risk: "The Risk Officer",
  trader: "The Trader",
  pm: "The Portfolio Manager",
};

const SEAT_ROLE: Record<string, string> = {
  desk: "Opens the cycle",
  analyst: "Finds candidates",
  risk: "Approves or blocks",
  trader: "Executes the fill",
  pm: "Watches the book",
};

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

  if (state.phase === "loading") return <LoadingState label="Loading the trace" />;
  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "error") return <ErrorState message={state.message} onRetry={state.reload} />;

  const { run, decisions } = state.data;

  return (
    <div className="space-y-8 px-8 pb-10">
      <section className="flex items-end justify-between border-b border-grid pb-6">
        <div className="space-y-2">
          <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            Cycle #{run.tick_seq}
          </p>
          <h1 className="font-mono text-[26px] leading-none text-text-primary">
            Council transcript
          </h1>
          <p className="font-ui text-[13px] text-text-secondary">
            Every seat's reasoning, in the order it was recorded — written before the agent
            acted, not reconstructed afterwards.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={OUTCOME_TONE[run.status] ?? "muted"}>{run.status}</Badge>
          {run.skip_reason ? <Badge tone="muted">{run.skip_reason.replace(/_/g, " ")}</Badge> : null}
        </div>
      </section>

      {decisions.map((d, i) => (
        <section key={i} className="border border-grid">
          <div className="flex items-center justify-between border-b border-grid px-6 py-4">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-mono text-[14px] tracking-[0.06em] text-text-primary uppercase">
                {SEAT_LABEL[d.role] ?? d.role}
              </span>
              <span className="font-ui text-[12px] text-text-dim">{SEAT_ROLE[d.role] ?? ""}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
              {d.model ? <span>{d.model}</span> : null}
              {d.latency_ms ? <span>{d.latency_ms}ms</span> : null}
              {d.cost_usd ? <span>${Number(d.cost_usd).toFixed(5)}</span> : null}
            </div>
          </div>

          <pre className="overflow-x-auto px-6 py-5 font-mono text-[12px] leading-relaxed text-text-secondary">
            {JSON.stringify(d.output, null, 2)}
          </pre>

          {d.adapter_ids?.length ? (
            <div className="border-t border-grid px-6 py-3">
              <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                Data from {d.adapter_ids.join(" · ")}
              </span>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
