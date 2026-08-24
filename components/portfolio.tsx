"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Breadcrumb } from "@/components/ui";
import { EmptyState, ErrorState, SignedOutState } from "@/components/states";
import { NarratedLineBody, OutcomeMark, SeatTag } from "@/components/seat";
import { SkeletonLog, SkeletonRows } from "@/components/skeleton";
import { getCycle, listCycles, type CycleRow } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { narrateDecision, sourceLabel } from "@/lib/narrate";
import { relativeTime } from "@/lib/format";
import { useT, type TranslationKey } from "@/lib/i18n";

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

/* ----------------------------------------------------------- cycle list -- */

const OUTCOME_TONE: Record<string, "accent" | "warning" | "negative" | "muted"> = {
  ok: "accent",
  skipped: "muted",
  error: "negative",
  running: "warning",
};

/**
 * The cycle's outcome, said rather than echoed.
 *
 * The badge used to print `c.status` — the backend's enum — straight onto the
 * screen. An unmapped status still falls through to the raw value: an outcome
 * we have no word for is better shown as its id than hidden.
 */
const OUTCOME_KEY: Record<string, TranslationKey> = {
  ok: "cycle_status_ok",
  skipped: "cycle_status_skipped",
  error: "cycle_status_error",
  running: "cycle_status_running",
};

export function CycleList({ agentId }: { agentId: number }) {
  const t = useT();
  // `token`, not `t`: the translator owns that name in this file now.
  const state = useApi<{ cycles: CycleRow[] }>((token) => listCycles(token, agentId), [agentId]);

  if (state.phase === "loading") return <SkeletonRows labelKey="loading_cycles" cols="70px minmax(0,1fr) 120px 100px 90px" />;
  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "error") return <ErrorState message={state.message} onRetry={state.reload} />;

  const cycles = state.data.cycles;
  if (cycles.length === 0) {
    return (
      <EmptyState title={t("cycles_empty_title")} body={t("cycles_empty_body")} />
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
            <Badge tone={OUTCOME_TONE[c.status] ?? "muted"}>
              {OUTCOME_KEY[c.status] ? t(OUTCOME_KEY[c.status]) : c.status}
            </Badge>
            {/* A skip is a first-class outcome — an RWA agent skips every
                weekend by design — so the reason is shown, not hidden. */}
            {c.skip_reason ? (
              <span className="font-mono text-[11px] text-text-dim">
                {c.skip_reason.replace(/_/g, " ")}
              </span>
            ) : null}
          </div>
          <span className="text-right font-mono text-[11px] tracking-[0.06em] text-text-dim uppercase">
            {relativeTime(c.started_at, t)}
          </span>
          <span className="tnum text-right font-mono text-[12px] text-text-secondary">
            {t("cycles_judged", { count: c.risk_decisions })}
          </span>
          <span className="tnum text-right font-mono text-[12px] text-negative">
            {Number(c.blocked) > 0 ? t("cycles_blocked", { count: c.blocked }) : "—"}
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
  const t = useT();
  const state = useApi<Awaited<ReturnType<typeof getCycle>>>(
    (token) => getCycle(token, agentId, runId),
    [agentId, runId],
  );

  // The trail renders in every phase, not just the happy one. Three levels
  // deep, a failed or slow fetch would otherwise leave the browser's back
  // button as the only way out of the page.
  const crumbs = (tickSeq?: string) => (
    <div className="px-8 pt-6">
      <Breadcrumb
        parts={[
          { label: t("cycles_crumb_portfolio"), href: "/portfolio" },
          { label: t("cycles_crumb_agent", { id: agentId }), href: `/portfolio/${agentId}` },
          { label: t("cycles_crumb_cycles"), href: `/portfolio/${agentId}/cycles` },
          tickSeq ? t("cycles_crumb_cycle_n", { seq: tickSeq }) : t("cycles_crumb_cycle"),
        ]}
      />
    </div>
  );

  if (state.phase === "loading")
    return (
      <>
        {crumbs()}
        <SkeletonLog labelKey="loading_trace" rows={6} />
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
              { label: t("cycles_crumb_portfolio"), href: "/portfolio" },
              { label: t("cycles_crumb_agent", { id: agentId }), href: `/portfolio/${agentId}` },
              { label: t("cycles_crumb_cycles"), href: `/portfolio/${agentId}/cycles` },
              t("cycles_crumb_cycle_n", { seq: run.tick_seq }),
            ]}
          />
          <h1 className="font-mono text-[26px] leading-none text-text-primary">
            {t("cycles_trace_title")}
          </h1>
          <p className="max-w-[64ch] font-ui text-[13px] text-text-secondary">
            {t("cycles_trace_body")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={OUTCOME_TONE[run.status] ?? "muted"}>
            {OUTCOME_KEY[run.status] ? t(OUTCOME_KEY[run.status]) : run.status}
          </Badge>
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

/** One council seat: what it did, in prose, over the record it wrote. */
function Seat({
  index,
  decision: d,
}: {
  index: number;
  decision: Awaited<ReturnType<typeof getCycle>>["decisions"][number];
}) {
  const [raw, setRaw] = useState(false);
  const t = useT();
  const lines = narrateDecision(d, t);

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
            {t(raw ? "cycles_hide_record" : "cycles_record")}
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
            {t("cycles_recorded_verbatim")}
          </p>
          <pre className="overflow-x-auto px-5 pb-4 font-mono text-[11.5px] leading-relaxed text-text-dim">
            {JSON.stringify(d.output, null, 2)}
          </pre>
        </div>
      ) : null}

      {d.adapter_ids?.length ? (
        <div className="border-t border-grid px-5 py-2.5">
          <span className="font-mono text-[9.5px] tracking-[0.1em] text-text-muted uppercase">
            {t("cycles_data_from", {
              sources: d.adapter_ids.map((a) => sourceLabel(a, t)).join(" · "),
            })}
          </span>
        </div>
      ) : null}
    </section>
  );
}

