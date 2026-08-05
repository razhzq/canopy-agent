"use client";

import { useEffect, useState } from "react";
import { getActivity, type ActivityCycle, type ActivityDecision, type ScreenStep } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ErrorState, LoadingState, SignedOutState } from "@/components/states";
import { Badge } from "@/components/ui";

/**
 * The agent's activity log: what it did, in order, most recent cycle first.
 *
 * The council decision rows are the audit trail, but they are structured JSON
 * addressed to a machine. This turns them into the thing an owner actually
 * wants — a running account of the agent waking up, pulling data, screening
 * the universe, and deciding. Every line traces to a decision row or a screen
 * step; nothing here is generated for effect.
 *
 * Refreshes on an interval because a live paper run is the main thing anyone
 * watches this page for.
 */
export function ActivityLog({ agentId }: { agentId: number }) {
  const [tick, setTick] = useState(0);
  const state = useApi((t) => getActivity(t, agentId, 5), [agentId, tick]);

  // 30s: the tick interval is an hour, so this is about catching a run that
  // lands while the page is open, not about smoothness.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (state.phase === "loading") return <LoadingState label="Loading activity" />;
  if (state.phase === "signed-out") return <SignedOutState note="Sign in to see this agent." />;
  if (state.phase === "error") return <ErrorState message={state.message} onRetry={state.reload} />;

  const cycles = state.data.cycles;

  if (cycles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 border border-grid bg-panel px-8 py-12 text-center">
        <p className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
          Nothing yet
        </p>
        <p className="max-w-[46ch] font-ui text-[13px] leading-relaxed text-text-secondary">
          The agent has not woken up for the first time. It runs once an hour — the first
          cycle appears here within the hour, whether or not it finds anything to do.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cycles.map((c, i) => (
        <Cycle key={c.id} cycle={c} defaultOpen={i === 0} />
      ))}
    </div>
  );
}

function Cycle({ cycle, defaultOpen }: { cycle: ActivityCycle; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const lines = toLines(cycle);

  return (
    <div className="border border-grid">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-panel"
      >
        <span className="flex min-w-0 items-center gap-4">
          <span className="tnum shrink-0 font-mono text-[11px] text-text-dim">
            #{cycle.tick_seq}
          </span>
          <span className="truncate font-ui text-[13.5px] text-text-primary">
            {headline(cycle)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="tnum font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
            {clock(cycle.started_at)}
          </span>
          <Badge tone={STATUS_TONE[cycle.status]}>{STATUS_LABEL[cycle.status]}</Badge>
        </span>
      </button>

      {open ? (
        <ol className="border-t border-grid">
          {lines.map((line, i) => (
            <li
              key={i}
              className="grid grid-cols-[18px_minmax(0,1fr)] items-start gap-3.5 border-b border-grid px-5 py-3 last:border-b-0"
            >
              <span className="mt-0.5">
                <Mark outcome={line.outcome} />
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
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- lines -- */

interface Line {
  outcome: "pass" | "drop" | "info" | "work";
  detail: string;
  symbol?: string;
  source?: string;
}

/**
 * Flattens one cycle's decision rows into an ordered account.
 *
 * The `output` shapes come from runTick — each council seat writes a different
 * one, so this reads them seat by seat rather than trying to be generic. An
 * unrecognised shape falls through to a plain statement that the seat ran,
 * which is still true and still ordered correctly.
 */
function toLines(cycle: ActivityCycle): Line[] {
  const lines: Line[] = [];

  for (const d of cycle.decisions) {
    const o = d.output ?? {};

    if (d.role === "desk") {
      if (o.skipped === "not_active") {
        lines.push({ outcome: "drop", detail: `Did not run — the agent is ${str(o.status)}.` });
      } else if (o.skipped === "expired") {
        lines.push({ outcome: "drop", detail: "Did not run — the mandate reached its time limit." });
      } else if (o.skipped === "drawdown_breach") {
        lines.push({ outcome: "drop", detail: str(o.reason) || "Paused on a drawdown breach." });
      } else if (o.opened) {
        lines.push({
          outcome: "work",
          detail:
            `Woke up. Book is ${money(o.equityUsd)} equity, ${money(o.cashUsd)} uninvested, ` +
            `${num(o.openPositions)} open ${num(o.openPositions) === 1 ? "position" : "positions"}.`,
        });
        if (num(o.unmarked) > 0) {
          lines.push({
            outcome: "info",
            detail: `${num(o.unmarked)} position(s) had no readable price and were left unmarked.`,
          });
        }
      }
      continue;
    }

    if (d.role === "analyst") {
      if (o.skipped === "market_closed") {
        lines.push({ outcome: "drop", detail: "Every market this mandate can touch is shut." });
        continue;
      }
      if (o.skipped === "budget_exhausted") {
        lines.push({ outcome: "drop", detail: "No model budget left this cycle — nothing reasoned." });
        continue;
      }

      if (o.stage === "screen") {
        for (const s of steps(o.steps)) {
          lines.push({
            outcome: s.outcome,
            detail: s.detail,
            symbol: s.symbol,
            source: SOURCE_LABEL[s.sourceId ?? ""] ?? s.sourceId,
          });
        }
        const found = Array.isArray(o.candidates) ? o.candidates.length : 0;
        lines.push({
          outcome: found > 0 ? "pass" : "info",
          detail:
            found > 0
              ? `${found} candidate${found === 1 ? "" : "s"} survived screening.`
              : "Nothing survived screening this cycle.",
        });
        continue;
      }

      if (o.stage === "reason") {
        const props = Array.isArray(o.proposals) ? o.proposals : [];
        lines.push({
          outcome: "work",
          detail: `Asked the model to choose${d.model ? ` (${d.model})` : ""}.`,
          source: d.latency_ms ? `${(d.latency_ms / 1000).toFixed(1)}s` : undefined,
        });
        if (props.length === 0) {
          lines.push({ outcome: "info", detail: "The model proposed nothing." });
        }
        for (const p of props as Record<string, unknown>[]) {
          lines.push({
            outcome: "pass",
            symbol: str(p.symbol),
            detail: `Proposed — ${str(p.rationale) || "no rationale given"}`,
          });
        }
        continue;
      }
      continue;
    }

    if (d.role === "risk") {
      const flags = Array.isArray(o.hardFlags) ? o.hardFlags : [];
      lines.push({
        outcome: o.decision === "reject" ? "drop" : "pass",
        symbol: str(o.symbol),
        detail:
          o.decision === "reject"
            ? `Risk gate rejected it${flags.length > 0 ? ` — ${flags.join(", ")}` : ""}.`
            : `Risk gate approved ${money(o.approvedSizeUsd)}` +
              (o.stopLossPct ? `, stop at ${num(o.stopLossPct)}%` : "") +
              ".",
      });
      continue;
    }

    if (d.role === "trader") {
      if (o.autonomy === "propose_only") {
        lines.push({
          outcome: "info",
          detail: `${num(o.parked)} plan(s) parked for your approval. Nothing executed.`,
        });
      } else if (o.executed === false) {
        lines.push({
          outcome: "drop",
          symbol: str(o.symbol),
          detail: `Execution failed — ${str(o.error)}`,
        });
      } else if (o.filledUsd !== undefined) {
        lines.push({
          outcome: "pass",
          symbol: str(o.symbol),
          detail:
            `${o.isPaper ? "Paper " : ""}filled ${money(o.filledUsd)} at ` +
            `$${num(o.priceUsd).toFixed(2)}${o.deduped ? " (already filled — deduped)" : ""}.`,
          source: str(o.venue),
        });
      }
      continue;
    }

    if (d.role === "pm") {
      lines.push({
        outcome: "work",
        detail:
          `Marked the book: ${money(o.marketValueUsd)} value against ${money(o.costBasisUsd)} cost, ` +
          `${signed(num(o.unrealizedPnlUsd))} unrealised.`,
      });
      const directives = Array.isArray(o.directives) ? o.directives : [];
      if (directives.length > 0) {
        lines.push({
          outcome: "info",
          detail: `${directives.length} directive(s) queued for the next cycle's risk gate.`,
        });
      }
    }
  }

  if (cycle.status === "error" && cycle.error) {
    lines.push({ outcome: "drop", detail: `Cycle failed — ${cycle.error}` });
  }

  return lines;
}

/** A one-line summary of the cycle, for the collapsed header. */
function headline(c: ActivityCycle): string {
  if (c.status === "running") return "Running now…";
  if (c.status === "error") return "Cycle failed";
  if (c.status === "skipped") return SKIP_LABEL[c.skip_reason ?? ""] ?? "Skipped";

  const fills = c.decisions.filter((d) => d.role === "trader" && d.output?.filledUsd !== undefined);
  if (fills.length > 0) return `${fills.length} fill${fills.length === 1 ? "" : "s"}`;

  const approved = c.decisions.filter(
    (d) => d.role === "risk" && d.output?.decision !== "reject",
  ).length;
  const rejected = c.decisions.filter(
    (d) => d.role === "risk" && d.output?.decision === "reject",
  ).length;

  if (approved > 0) return `${approved} approved by the risk gate`;
  if (rejected > 0) return `${rejected} blocked by the risk gate`;
  return "Screened the universe, proposed nothing";
}

/* ---------------------------------------------------------------- lookups -- */

const STATUS_LABEL: Record<ActivityCycle["status"], string> = {
  running: "Running",
  ok: "Complete",
  error: "Failed",
  skipped: "Skipped",
};

const STATUS_TONE: Record<ActivityCycle["status"], "accent" | "warning" | "negative" | "neutral"> = {
  running: "accent",
  ok: "neutral",
  error: "negative",
  skipped: "warning",
};

const SKIP_LABEL: Record<string, string> = {
  market_closed: "Markets were closed",
  no_candidates: "Nothing passed the screen",
  budget_exhausted: "Out of model budget",
  paused: "Agent is paused",
  expired: "Mandate expired",
  not_active: "Agent is not active",
};

/** Adapter ids are internal; these are what they mean to an owner. */
const SOURCE_LABEL: Record<string, string> = {
  "wintel.rwa": "Wintel",
  "canopy.onchain": "On-chain",
  "canopy.compliance": "Policy",
};

/* --------------------------------------------------------------- fragments -- */

function Mark({ outcome }: { outcome: Line["outcome"] }) {
  if (outcome === "pass") {
    return (
      <svg viewBox="0 0 16 16" className="size-3.5 text-accent" aria-label="passed">
        <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (outcome === "drop") {
    return (
      <svg viewBox="0 0 16 16" className="size-3.5 text-text-dim" aria-label="dropped">
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

/* ---------------------------------------------------------------- helpers -- */

function steps(v: unknown): ScreenStep[] {
  return Array.isArray(v) ? (v as ScreenStep[]) : [];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v) || 0;
}

function money(v: unknown): string {
  return `$${num(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function signed(n: number): string {
  const s = `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return n < 0 ? `−${s}` : `+${s}`;
}

function clock(iso: string): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
