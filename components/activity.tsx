"use client";

import { ChevronRight } from "lucide-react";
import { LABEL, BODY, QUIET, SURFACE } from "@/components/kit";
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
export function ActivityLog({
  agentId,
  book,
}: {
  agentId: number;
  /**
   * Which book's cycles to show. Follows the page's book switch, so the log and
   * the positions above it are always describing the same run.
   */
  book?: "paper" | "live";
}) {
  const [tick, setTick] = useState(0);
  const state = useApi(
    (t) => getActivity(t, agentId, 5, book),
    [agentId, tick, book],
  );

  // THE LAST GOOD LOG, KEPT ACROSS REFETCHES.
  //
  // This is what stopped the log "restarting itself" mid-cycle. The poll below
  // bumps `tick` every few seconds while a cycle is running; `useApi` answers a
  // dep change by resetting to `loading`; and the loading branch returned a
  // skeleton — tearing down every Cycle below it. On remount each Cycle's
  // sequential reveal starts again from line zero, so a running cycle's trace
  // flickered back to the top every 4 seconds, which is the "thinking list keeps
  // restarting" the owner sees.
  //
  // Holding the previous cycles means a refetch is invisible: the log stays on
  // screen and is simply replaced by the newer copy when it lands. Written
  // during render on purpose — it caches a value already in hand, so an effect
  // would only make it arrive one frame late.
  const lastGood = useRef<ActivityCycle[] | null>(null);
  if (state.phase === "ready") lastGood.current = state.data.cycles;
  const cycles =
    state.phase === "ready" ? state.data.cycles : (lastGood.current ?? []);

  // Which cycle ids we have already shown. A cycle animates in only the first
  // time it appears — without this the whole list would re-animate on every
  // poll, which turns "something arrived" into visual noise.
  const seen = useRef<Set<string> | null>(null);

  // Border-flash markers: an id sits here for ~1.4s after it first appears,
  // long enough for the log-flash animation to play. State, because it paints.
  const [flashing, setFlashing] = useState<Set<string>>(new Set());

  // Ids appearing for the FIRST time this render — computed SYNCHRONOUSLY, so a
  // cycle is known to be new at its first mount rather than one effect-tick
  // later.
  //
  // This is what turns "blink" into "fill". The line-by-line reveal below only
  // runs when the cycle knows AT MOUNT that it is new (or still running).
  // Locally a tick finishes between polls, so the cycle lands already-complete
  // and — when freshness was set in an effect — the flag arrived a frame too
  // late, after the reveal had already given up and shown every line at once.
  // Production hid this only because its polls usually catch a cycle mid-run.
  // Read against the same `seen` baseline the effect commits to, so the first
  // page load stays silent and history does not replay.
  const freshIds =
    seen.current === null
      ? new Set<string>()
      : new Set(
          cycles.filter((c) => !seen.current!.has(c.id)).map((c) => c.id),
        );

  // Joined into a string so the dependency is stable by value. Depending on the
  // array itself would re-run this on every render — and because React clears
  // the previous effect's timeout before re-running, a render that found no new
  // cycles would cancel the pending reset and strand `flashing` permanently.
  const cycleKey = cycles.map((c) => c.id).join(",");

  // Only a real result may touch the baseline. A transient `loading` frame
  // renders an empty `cycles`, and seeding the baseline from that would mark the
  // history that lands next as brand-new and flash the whole list on arrival.
  const ready = state.phase === "ready";

  useEffect(() => {
    if (!ready) return;
    const ids = cycleKey ? cycleKey.split(",") : [];

    // First real load populates the baseline silently — EVEN WHEN IT IS EMPTY.
    // Seeding an empty baseline here is what lets the very first cycle of a
    // brand-new agent fill rather than blink: it then arrives as an addition to
    // a known-empty baseline instead of being mistaken for pre-existing history
    // (which is silent on purpose, so returning to a page does not replay it).
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }

    const added = ids.filter((id) => !seen.current!.has(id));
    if (added.length === 0) return;
    added.forEach((id) => seen.current!.add(id));
    setFlashing(new Set(added));

    // Drop the marker once the flash has played, so a later re-render does not
    // leave the row bordered as new forever.
    const t = setTimeout(() => setFlashing(new Set()), 1400);
    return () => clearTimeout(t);
  }, [cycleKey, ready]);

  // Poll rate tracks what is actually in flight.
  //
  // A running cycle writes its decision rows as it goes, so its steps only
  // reach the page when we refetch — at the idle 45s that meant watching two
  // lines for most of a minute while the cycle had long since finished.
  const empty = cycles.length === 0;
  const anyRunning = cycles.some((c) => c.status === "running");
  const pollMs = anyRunning ? 4_000 : empty ? 15_000 : 45_000;

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  // The skeleton is for the FIRST load only. Every later fetch is a background
  // refresh of a log already on screen, held in `seen` above.
  if (state.phase === "loading" && lastGood.current === null)
    return <SkeletonLog label="Loading activity" />;
  if (state.phase === "signed-out")
    return <SignedOutState note="Sign in to see this agent." />;
  // A failed poll must not destroy the log either. With nothing to fall back on
  // the error screen is right; with cycles in hand, the honest thing is to keep
  // showing them — they did not stop existing because one request timed out.
  if (state.phase === "error" && lastGood.current === null)
    return <ErrorState message={state.message} onRetry={state.reload} />;

  if (cycles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-grid bg-panel px-5 py-12 text-center sm:px-8">
        <p className="font-mono text-[14px] text-text-primary">Nothing yet</p>
        <p className={`max-w-[48ch] ${BODY}`}>
          The first cycle is starting now and appears here within a minute or
          two — it runs whether or not the agent finds anything to buy. After
          that it wakes once an hour.
        </p>
        <p className={LABEL}>Checking every 15s</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cycles.map((c, i) => (
        <Cycle
          key={c.id}
          cycle={c}
          defaultOpen={i === 0}
          flash={flashing.has(c.id)}
          fresh={freshIds.has(c.id)}
        />
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
  flash,
  fresh,
}: {
  cycle: ActivityCycle;
  defaultOpen: boolean;
  /** Show the one-shot "new cycle arrived" border flash (~1.4s). */
  flash: boolean;
  /** First appearance this session — drives the line-by-line reveal. */
  fresh: boolean;
}) {
  const { open, setOpen, mounted, expanded } = useDisclosure(defaultOpen);
  const panelId = useId();
  const lines = narrateCycle(cycle);
  const running = cycle.status === "running";

  // The reveal counts DECISIONS, not the working notes beneath them. A screen
  // that touched forty tickers records most of that as `secondary` steps the log
  // folds by default — animating through them would make the replay crawl and
  // spend its whole run on lines the reader has to expand to see anyway.
  const primary = lines.filter((l) => !l.secondary);

  // Captured at mount and never updated — either flipping mid-replay would cut
  // it short and snap the rest in at once. `fresh` is correct AT MOUNT now (the
  // parent computes it synchronously), so a cycle that lands already-complete
  // still animates instead of blinking in.
  //
  // `running` is also here because the first page load after creating an agent
  // usually ALREADY contains cycle #1, still in flight. The parent treats a
  // first load as a silent baseline (correct when you return to the page later,
  // wrong when you are watching the thing you just made), so without this the
  // one cycle you actually want to watch is the one that never replays.
  const [replay] = useState(fresh || running);
  const shown = useSequentialReveal(primary.length, replay && defaultOpen);
  const revealing = shown < primary.length;

  // The decision lines revealed so far, by identity. Every `run.lines` entry is
  // the same object this slices from (both come from `lines` this render), so an
  // identity Set is enough to ask "has this line been reached yet?".
  const revealed = new Set(primary.slice(0, shown));

  return (
    <div
      className={`overflow-hidden rounded-lg border border-l-2 border-grid transition-colors ${
        flash
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
          <Badge tone={STATUS_TONE[cycle.status]}>
            {STATUS_LABEL[cycle.status]}
          </Badge>
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
              {/* Grouped over the FULL trace, so each seat can carry its own
                  folded notes; the reveal is applied per-line inside the run via
                  `revealed`, and a run with nothing revealed yet renders nothing. */}
              {groupBySeat(lines).map((run, r) => (
                <SeatRun
                  key={r}
                  run={run}
                  revealed={revealed}
                  // Only while the replay is actually moving. A finished cycle
                  // has no active step — every one of them is complete.
                  active={
                    revealing || running ? (primary[shown - 1] ?? null) : null
                  }
                />
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
                    <span className={LABEL}>
                      {revealing
                        ? `${shown} of ${primary.length}`
                        : "still running"}
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

/**
 * One seat's run of lines, with its supporting notes folded away.
 *
 * DECISIONS ARE ALWAYS SHOWN; the working is one caret down. A screen step's
 * verdict (a candidate, a failed rule) is a `pass`/`drop` line and renders
 * inline; the rug-check note and indicator readout beside it are `secondary`
 * and stay hidden until asked for. Almost every cycle has exactly one run with
 * anything folded — the analyst's screen — so this is a single quiet expander,
 * not a page of them.
 *
 * Order is preserved when expanded: the notes drop back into their original
 * positions among the decisions rather than piling up in a block, because
 * "rug-check, indicators, verdict" per ticker is the sequence that reads as
 * reasoning. A run whose decisions have not been reached by the reveal yet
 * renders nothing at all, which is what makes the seats appear one after another.
 */
/**
 * One step in the chain, in the shape shadcn's Chain of Thought uses.
 *
 * Ported rather than installed. That component is built on Radix and styles
 * against `--background` / `--muted-foreground`; this app has neither, and
 * pulling in a second design system to draw a vertical line would cost more
 * than the line is worth. What is taken is the part that makes it read well:
 * an icon column with a rule running between the icons, so a cycle looks like a
 * sequence rather than a list, and the content indented off that column.
 *
 * WHAT IS DELIBERATELY NOT TAKEN: the icon itself. Theirs defaults to a dot;
 * ours is `OutcomeMark`, which says whether the step passed, dropped or is
 * still working. That column is where this log carries its meaning, and a
 * decorative dot would be a downgrade dressed as a port.
 *
 * STATUS follows their three states, mapped onto tokens this app already has:
 *
 *   complete  as written — the step happened and the body says what it decided
 *   active    the step the replay is on, marked in the gutter rather than by
 *             recolouring the body, whose colours already mean something else
 *   pending   dimmed, NOT hidden. This is the change worth having: the reader
 *             sees the whole shape of the cycle immediately and watches it
 *             light up, instead of lines popping in from nowhere and the panel
 *             growing under the cursor.
 */
function Step({
  status,
  mark,
  connect,
  children,
}: {
  status: "complete" | "active" | "pending";
  mark: React.ReactNode;
  /** Draw the rule down to the next step. False on the last one. */
  connect: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      aria-current={status === "active" ? "step" : undefined}
      className={`grid animate-[line-enter_240ms_ease-out] grid-cols-[18px_minmax(0,1fr)] items-start gap-3.5 transition-opacity duration-300 ${
        status === "pending" ? "opacity-35" : "opacity-100"
      }`}
    >
      <span className="relative mt-0.5 flex justify-center">
        {mark}
        {/* Their connector: from just under the icon to just past the row, so
            it bridges the 8px gap and reads as one continuous rule. */}
        {connect ? (
          <span
            aria-hidden
            className="absolute top-[18px] -bottom-2.5 left-1/2 w-px -translate-x-1/2 bg-grid-strong"
          />
        ) : null}
        {/* The active ring sits in the gutter, so the body keeps the colours
            that already distinguish a buy from a stop-out. */}
        {status === "active" ? (
          <span
            aria-hidden
            className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 animate-[live-pulse_1.4s_ease-in-out_infinite] rounded-full ring-1 ring-accent/40"
          />
        ) : null}
      </span>
      <div className="min-w-0 space-y-2 overflow-hidden">{children}</div>
    </li>
  );
}

function SeatRun({
  run,
  revealed,
  active,
}: {
  run: { role: SeatedLine["role"]; lines: SeatedLine[] };
  revealed: Set<SeatedLine>;
  /** The line the replay is currently on, if it is in this seat. */
  active: SeatedLine | null;
}) {
  const [open, setOpen] = useState(false);
  const decisions = run.lines.filter((l) => !l.secondary);
  const shownDecisions = decisions.filter((l) => revealed.has(l));
  // Nothing revealed here yet — the reveal has not reached this seat.
  if (shownDecisions.length === 0) return null;

  const notes = run.lines.filter((l) => l.secondary);
  // EVERY decision in this seat, revealed or not. The unrevealed ones render
  // dimmed rather than absent — see `Step`. Screening notes stay behind the
  // disclosure, because those are the ones there can be forty of.
  const body = open ? run.lines : decisions;

  return (
    <li className="grid grid-cols-1 gap-x-3.5 border-b border-grid px-5 py-3 last:border-b-0 sm:grid-cols-[68px_minmax(0,1fr)]">
      {/* On a phone the seat sits above its run: 68px of gutter is a fifth of
          the width there, and the lines are what matter. */}
      <span className="pb-1.5 sm:pt-0.5 sm:pb-0">
        <SeatTag role={run.role} variant="rail" />
      </span>
      <ol className="min-w-0 space-y-2">
        {body.map((line, i) => (
          // Keyed by content, not index, so expanding the notes slots them in
          // WITHOUT re-mounting (and re-animating) the decisions already on screen.
          <Step
            key={`${line.symbol ?? ""}:${line.detail}`}
            status={
              line === active
                ? "active"
                : revealed.has(line) || line.secondary
                  ? "complete"
                  : "pending"
            }
            // Runs to the next step, and on to the notes button when there is
            // one, so the rule does not stop short of the run's last row.
            connect={i < body.length - 1 || notes.length > 0}
            mark={<OutcomeMark outcome={line.outcome} />}
          >
            <NarratedLineBody line={line} />
          </Step>
        ))}

        {/* The way into the working. Only when there is working to show, and only
            once the decisions it supports have been revealed. */}
        {notes.length > 0 ? (
          <li>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className={`grid grid-cols-[18px_minmax(0,1fr)] items-center gap-3.5 ${QUIET}`}
            >
              <ChevronRight
                aria-hidden
                className={`size-3 justify-self-center transition-transform duration-200 ${
                  open ? "rotate-90" : ""
                }`}
              />
              <span>
                {open
                  ? "Hide screening notes"
                  : `${notes.length} screening note${notes.length === 1 ? "" : "s"}`}
              </span>
            </button>
          </li>
        ) : null}
      </ol>
    </li>
  );
}

/** A one-line summary of the cycle, for the collapsed header. */
/**
 * One line describing what a cycle did.
 *
 * Exported because the account-wide activity feed shows the same cycles as the
 * agent's own log, and two summarisers would eventually disagree about the same
 * tick — the drift `lib/perf` exists to prevent, in a different costume.
 */
export function headline(c: ActivityCycle): string {
  if (c.status === "running") return "Running now…";
  if (c.status === "error") return "Cycle failed";
  if (c.status === "skipped")
    return SKIP_LABEL[c.skip_reason ?? ""] ?? "Skipped";

  const closes = c.decisions.filter(
    (d) =>
      d.role === "trader" &&
      d.output?.exit === true &&
      d.output?.filledUsd !== undefined,
  );
  const fills = c.decisions.filter(
    (d) =>
      d.role === "trader" &&
      d.output?.exit !== true &&
      d.output?.filledUsd !== undefined,
  );
  if (closes.length > 0 && fills.length > 0)
    return `${closes.length} closed, ${fills.length} opened`;
  if (closes.length > 0)
    return `${closes.length} position${closes.length === 1 ? "" : "s"} closed`;
  if (fills.length > 0)
    return `${fills.length} fill${fills.length === 1 ? "" : "s"}`;

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

export const STATUS_LABEL: Record<ActivityCycle["status"], string> = {
  running: "Running",
  ok: "Complete",
  error: "Failed",
  skipped: "Skipped",
};

export const STATUS_TONE: Record<
  ActivityCycle["status"],
  "accent" | "warning" | "negative" | "neutral"
> = {
  running: "accent",
  ok: "neutral",
  error: "negative",
  skipped: "warning",
};

const SKIP_LABEL: Record<string, string> = {
  market_closed: "Markets were closed",
  no_candidates: "Nothing passed the screen",
  budget_exhausted: "Out of model budget",
  // Distinct from the line above, which is the per-cycle cap. This one is the
  // agent's prepaid balance at the marketplace running dry — the fix is money,
  // not a setting.
  model_balance_exhausted: "Out of model balance",
  // Not a fault: the agent is built, correct, and waiting for its first
  // deposit. It starts on its own once one lands.
  model_unfunded: "Waiting to be funded",
  model_unavailable: "Model unavailable",
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
function groupBySeat(
  lines: SeatedLine[],
): { role: SeatedLine["role"]; lines: SeatedLine[] }[] {
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
