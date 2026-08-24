"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Breadcrumb } from "@/components/ui";
import { EmptyState, ErrorState, SignedOutState } from "@/components/states";
import { NarratedLineBody, OutcomeMark, SeatTag } from "@/components/seat";
import { SkeletonLog, SkeletonRows } from "@/components/skeleton";
import { getCycle, listCycles, type CycleRow } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { narrateDecision, SOURCE_LABEL } from "@/lib/narrate";

/**
 * The cycle screens: a list of an agent's ticks, and the council transcript for
 * one of them.
 *
 * This file used to also hold `AgentList` and `AgentMonitor` — the old portfolio
 * index and agent page. Wireframes 1j and 1k replaced both (`myAgents.tsx` and
 * `agentDetail.tsx`), and their routes became redirects, so the two components
 * sat here unreachable. They are gone; only the cycle screens remain, and they
 * are still routed from /portfolio/[slug]/cycles.
 */

/* ------------------------------------------------------------- helpers ---- */

function when(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
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

  if (state.phase === "loading") return <SkeletonRows label="Loading cycles" cols="70px minmax(0,1fr) 120px 100px 90px" />;
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
        <SkeletonLog label="Loading the trace" rows={6} />
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
          {/* What this cycle's thinking cost, next to what it did. The seats
              below each carry their own share; this is the sum, and it comes
              from the server rather than being added up here so the total and
              the parts cannot disagree. Absent on an agent whose model is
              included — there is no price to state. */}
          {run.costUsd && Number(run.costUsd) > 0 ? (
            <span className="tnum font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
              ${Number(run.costUsd).toFixed(4)} to think
            </span>
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
          <SeatTag role={d.role} variant="header" />
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
                <OutcomeMark outcome={line.outcome} />
              </span>
              <NarratedLineBody line={line} />
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

