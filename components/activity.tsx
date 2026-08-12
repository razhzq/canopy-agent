"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getActivity, type ActivityCycle } from "@/lib/api";
import { narrateCycle, type SeatedLine } from "@/lib/narrate";
import { useApi } from "@/lib/useApi";
import { ErrorState, SignedOutState } from "@/components/states";
import { NarratedLineBody, OutcomeMark, SeatTag } from "@/components/seat";
import { SkeletonLog } from "@/components/skeleton";
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

  // Which cycle ids we have already shown. A cycle animates in only the first
  // time it appears — without this the whole list would re-animate on every
  // poll, which turns "something arrived" into visual noise.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  // Joined into a string so the dependency is stable by value. Depending on the
  // array itself would re-run this on every render — and because React clears
  // the previous effect's timeout before re-running, a render that found no new
  // cycles would cancel the pending reset and strand `fresh` permanently.
  const cycleKey =
    state.phase === "ready" ? state.data.cycles.map((c) => c.id).join(",") : "";

  useEffect(() => {
    if (!cycleKey) return;
    const ids = cycleKey.split(",");

    // First successful load populates the baseline silently: everything is new
    // to the component, but none of it is new to the user.
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }

    const added = ids.filter((id) => !seen.current!.has(id));
    if (added.length === 0) return;
    added.forEach((id) => seen.current!.add(id));
    setFresh(new Set(added));

    // Drop the marker once the animation has played, so a later re-render does
    // not leave the row flagged as new forever.
    const t = setTimeout(() => setFresh(new Set()), 1400);
    return () => clearTimeout(t);
  }, [cycleKey]);

  // Poll rate tracks what is actually in flight.
  //
  // A running cycle writes its decision rows as it goes, so its steps only
  // reach the page when we refetch — at the idle 45s that meant watching two
  // lines for most of a minute while the cycle had long since finished.
  const empty = state.phase === "ready" && state.data.cycles.length === 0;
  const anyRunning =
    state.phase === "ready" && state.data.cycles.some((c) => c.status === "running");
  const pollMs = anyRunning ? 4_000 : empty ? 15_000 : 45_000;

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  if (state.phase === "loading") return <SkeletonLog label="Loading activity" />;
  if (state.phase === "signed-out") return <SignedOutState note="Sign in to see this agent." />;
  if (state.phase === "error") return <ErrorState message={state.message} onRetry={state.reload} />;

  const cycles = state.data.cycles;

  if (cycles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 border border-grid bg-panel px-8 py-12 text-center">
        <p className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
          Nothing yet
        </p>
        <p className="max-w-[48ch] font-ui text-[13px] leading-relaxed text-text-secondary">
          The first cycle is starting now and appears here within a minute or two — it runs
          whether or not the agent finds anything to buy. After that it wakes once an hour.
        </p>
        <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
          Checking every 15s
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cycles.map((c, i) => (
        <Cycle key={c.id} cycle={c} defaultOpen={i === 0} isNew={fresh.has(c.id)} />
      ))}
    </div>
  );
}

/**
 * Reveals a completed cycle's steps one at a time.
 *
 * The steps were all recorded before the agent acted — this replays them in the
 * order they happened, the way a terminal prints output it already has. It is
 * presentation, not a live feed, so nothing here claims present-tense activity:
 * the affordance is a caret, never "the agent is thinking".
 *
 * Only a cycle that arrived while you were watching replays. Scrolling back
 * through history should not make you wait for it.
 */
function useSequentialReveal(total: number, active: boolean): number {
  const [shown, setShown] = useState(active ? 0 : total);

  // Read inside the effect without making it a dependency: the effect must
  // re-run when the total GROWS, but must not restart from wherever it had
  // reached when it does.
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    if (!active) {
      setShown(total);
      return;
    }
    // Someone who asked for less motion gets the whole thing at once.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(total);
      return;
    }
    // Already caught up. A running cycle re-enters here on every poll, and
    // resetting to zero would replay the whole thing each time.
    if (shownRef.current >= total) return;

    // Paced to feel deliberate, but the whole sequence stays under ~5s however
    // long the trace is — a 40-step screen must not take half a minute.
    const step = Math.max(55, Math.min(240, 4500 / Math.max(total, 1)));
    const id = setInterval(() => {
      setShown((prev) => {
        const next = prev + 1;
        if (next >= total) clearInterval(id);
        return Math.min(next, total);
      });
    }, step);
    return () => clearInterval(id);
  }, [total, active]);

  // Guard against a total that shrank (a cycle re-fetched mid-write).
  return Math.min(shown, total);
}

/**
 * Open/closed for one cycle, in three parts rather than one.
 *
 * `open` is the intent, `mounted` is whether the lines exist in the DOM, and
 * `expanded` is the committed height. They are separate because a panel that
 * mounts already at its open height has nothing to transition FROM — the
 * browser only interpolates between two styles it has actually committed — so
 * the content mounts collapsed and the expansion lands on a later frame.
 *
 * Two frames later, specifically: one rAF still lands inside the same paint as
 * the mount, and the transition is skipped.
 *
 * Content stays mounted once opened. Unmounting on collapse would give the
 * closing animation nothing to animate, and re-opening would pay for the whole
 * screen trace — including a next/image call per asset — a second time. Cycles
 * that were never opened never mount at all, which is what keeps five cycles'
 * worth of traces off the first paint.
 */
function useDisclosure(defaultOpen: boolean) {
  const [open, setOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(defaultOpen);

  useEffect(() => {
    if (open) setMounted(true);
    else setExpanded(false);
  }, [open]);

  useEffect(() => {
    if (!open || !mounted) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setExpanded(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [open, mounted]);

  return { open, setOpen, mounted, expanded };
}

function Cycle({
  cycle,
  defaultOpen,
  isNew,
}: {
  cycle: ActivityCycle;
  defaultOpen: boolean;
  isNew: boolean;
}) {
  const { open, setOpen, mounted, expanded } = useDisclosure(defaultOpen);
  const panelId = useId();
  const lines = narrateCycle(cycle);
  const running = cycle.status === "running";

  // Captured at mount and never updated. `isNew` is cleared by the parent after
  // its border flash, and `running` becomes false when the cycle finishes —
  // either flipping mid-replay would cut it short and snap the rest in at once.
  //
  // `running` is here because the first page load after creating an agent
  // usually ALREADY contains cycle #1, still in flight. The parent treats a
  // first load as a silent baseline (correct when you return to the page later,
  // wrong when you are watching the thing you just made), so without this the
  // one cycle you actually want to watch is the one that never replays.
  const [replay] = useState(isNew || running);
  const shown = useSequentialReveal(lines.length, replay && defaultOpen);
  const revealing = shown < lines.length;

  return (
    <div
      className={`border border-l-2 border-grid transition-colors ${
        isNew
          ? "animate-[log-enter_320ms_ease-out,log-flash_1400ms_ease-out_forwards] border-l-accent"
          : "border-l-transparent"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        // Tinted while open so the header and the lines below read as one card
        // rather than a bar sitting on an unrelated list.
        className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-panel focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
          open ? "bg-panel" : ""
        }`}
      >
        <span className="flex min-w-0 items-center gap-4">
          <span className="tnum shrink-0 font-mono text-[11px] text-text-dim">
            #{cycle.tick_seq}
          </span>
          {running ? (
            <span
              aria-hidden
              className="size-1.5 shrink-0 animate-[live-pulse_1.4s_ease-in-out_infinite] rounded-full bg-accent"
            />
          ) : null}
          <span className="truncate font-ui text-[13.5px] text-text-primary">
            {headline(cycle)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="tnum font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
            {clock(cycle.started_at)}
          </span>
          <Badge tone={STATUS_TONE[cycle.status]}>{STATUS_LABEL[cycle.status]}</Badge>
          {/* The row was expandable with nothing to say so. The caret both
              advertises that and reports which way it currently is. */}
          <svg
            viewBox="0 0 16 16"
            aria-hidden
            className={`size-3 shrink-0 text-text-dim transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              open ? "rotate-180" : ""
            }`}
          >
            <path
              d="m4 6 4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {/* Height animates on the 0fr→1fr grid row rather than a measured
          max-height: a trace is two lines or forty, and it GROWS while a new
          cycle replays. A pixel figure would need re-measuring on every revealed
          line, and a max-height guess makes the easing wrong for every cycle
          that is not exactly that tall. */}
      <div
        id={panelId}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        {/* The clip. Fades a little faster than the row collapses, so the text
            is gone before the last pixels close rather than being sliced. */}
        <div
          className={`overflow-hidden transition-opacity duration-200 ${
            expanded ? "opacity-100" : "opacity-0"
          }`}
        >
          {mounted ? (
            <ol className="border-t border-grid">
              {/* Grouped AFTER the reveal slice, so the rail fills in with the replay
                  rather than appearing whole at the first line. */}
              {groupBySeat(lines.slice(0, shown)).map((run, r) => (
                <li
                  key={r}
                  className="grid grid-cols-1 gap-x-3.5 border-b border-grid px-5 py-3 last:border-b-0 sm:grid-cols-[68px_minmax(0,1fr)]"
                >
                  {/* On a phone the seat sits above its run: 68px of gutter is a
                      fifth of the width there, and the lines are what matter. */}
                  <span className="pb-1.5 sm:pt-0.5 sm:pb-0">
                    <SeatTag role={run.role} variant="rail" />
                  </span>
                  <ol className="min-w-0 space-y-2">
                    {run.lines.map((line, i) => (
                      <li
                        key={i}
                        className="grid animate-[line-enter_240ms_ease-out] grid-cols-[18px_minmax(0,1fr)] items-start gap-3.5"
                      >
                        <span className="mt-0.5">
                          <OutcomeMark outcome={line.outcome} />
                        </span>
                        <NarratedLineBody line={line} />
                      </li>
                    ))}
                  </ol>
                </li>
              ))}

              {/* Where the replay has reached. A caret, not a claim — the cycle has
                  already finished; this is the reading of it catching up. */}
              {revealing || running ? (
                // Empty seat cell so the caret lands in the same text column as the
                // lines above it rather than under the rail.
                <li className="grid grid-cols-1 gap-x-3.5 px-5 py-3 sm:grid-cols-[68px_minmax(0,1fr)]">
                  <span aria-hidden />
                  <span className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-3.5">
                    <span
                      aria-hidden
                      className="ml-0.5 block h-3.5 w-[2px] animate-[live-pulse_0.9s_ease-in-out_infinite] bg-accent"
                    />
                    <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted uppercase">
                      {revealing ? `${shown} of ${lines.length}` : "still running"}
                    </span>
                  </span>
                </li>
              ) : null}
            </ol>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A one-line summary of the cycle, for the collapsed header. */
function headline(c: ActivityCycle): string {
  if (c.status === "running") return "Running now…";
  if (c.status === "error") return "Cycle failed";
  if (c.status === "skipped") return SKIP_LABEL[c.skip_reason ?? ""] ?? "Skipped";

  const closes = c.decisions.filter(
    (d) => d.role === "trader" && d.output?.exit === true && d.output?.filledUsd !== undefined,
  );
  const fills = c.decisions.filter(
    (d) => d.role === "trader" && d.output?.exit !== true && d.output?.filledUsd !== undefined,
  );
  if (closes.length > 0 && fills.length > 0)
    return `${closes.length} closed, ${fills.length} opened`;
  if (closes.length > 0) return `${closes.length} position${closes.length === 1 ? "" : "s"} closed`;
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

/* ---------------------------------------------------------------- helpers -- */

/**
 * Consecutive lines from one seat, so the rail names it once per run.
 *
 * Consecutive rather than collected-by-role: the analyst speaks twice in a
 * normal cycle — once to screen the universe, once to reason over what survived
 * — with the portfolio manager's adds in between. Gathering those into a single
 * "Analyst" block would put the two in one breath and reorder the cycle, which
 * is the one thing a log of an audit trail must not do.
 */
function groupBySeat(lines: SeatedLine[]): { role: SeatedLine["role"]; lines: SeatedLine[] }[] {
  const runs: { role: SeatedLine["role"]; lines: SeatedLine[] }[] = [];
  for (const line of lines) {
    const current = runs[runs.length - 1];
    if (current && current.role === line.role) current.lines.push(line);
    else runs.push({ role: line.role, lines: [line] });
  }
  return runs;
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
