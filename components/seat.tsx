"use client";

import {
  SEAT_LABEL_KEY,
  SEAT_PURPOSE_KEY,
  SEAT_SHORT_KEY,
  type NarratedLine,
  type Seat,
} from "@/lib/narrate";
import { AssetLogo, SourceMark } from "@/components/ui";
import { useT } from "@/lib/i18n";

/**
 * The pieces both surfaces that read decision rows are built from.
 *
 * There are two of those surfaces on purpose — the activity log is a narrative
 * replay of a cycle, the transcript is per-seat forensics with the raw record
 * underneath. What they must never disagree on is what a seat is CALLED and what
 * a pass, a drop and a note LOOK like: the two pages describe the same audit
 * trail, and a reader moving between them is entitled to recognise it.
 *
 * They previously held byte-identical copies of the mark icons and the line body,
 * which is exactly the arrangement that drifts.
 */

/**
 * Did this line help, stop something, or just report?
 *
 * Shape carries the meaning, not colour alone: a tick, a cross and a ring stay
 * distinguishable to a reader who cannot separate the accent from the dim grey.
 */
export function OutcomeMark({ outcome }: { outcome: NarratedLine["outcome"] }) {
  const t = useT();
  if (outcome === "pass") {
    return (
      <svg viewBox="0 0 16 16" className="size-3.5 text-accent" aria-label={t("outcome_passed")}>
        <path
          d="M3.5 8.5l3 3 6-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (outcome === "drop") {
    return (
      <svg viewBox="0 0 16 16" className="size-3.5 text-text-dim" aria-label={t("outcome_stopped")}>
        <path
          d="M4 4l8 8M12 4l-8 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (outcome === "work") {
    return (
      <svg viewBox="0 0 16 16" className="size-3.5 text-accent" aria-label={t("outcome_step")}>
        <circle cx="8" cy="8" r="3" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 text-text-dim" aria-label={t("outcome_note")}>
      <circle cx="8" cy="8" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** One narrated line: the asset it concerns, what happened, and who said so. */
export function NarratedLineBody({ line }: { line: NarratedLine }) {
  return (
    <span className="min-w-0">
      <span className="font-ui text-[13px] leading-relaxed text-text-secondary">
        {line.symbol ? (
          <span className="font-mono text-[12px] text-text-primary">
            <AssetLogo symbol={line.symbol} size={14} /> {line.symbol}{" "}
          </span>
        ) : null}
        {line.detail}
      </span>
      {line.source ? <SourceMark source={line.source} /> : null}
    </span>
  );
}

/**
 * Names a seat.
 *
 * `rail` is the activity log's gutter, where the seat is an index beside prose
 * and the short form is the only one that fits. `header` is the transcript's
 * section heading, where there is room to say what the seat is actually for.
 */
export function SeatTag({ role, variant }: { role: Seat | null; variant: "rail" | "header" }) {
  const t = useT();
  if (variant === "rail") {
    // A cycle-level line (a failure) belongs to no seat. Rendering the gutter
    // empty keeps the column aligned without inventing an author for it.
    if (role === null) return null;
    return (
      <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
        {/* The raw role id is the fallback: a seat we have no name for is
            better identified by its id than by a blank. */}
        {SEAT_SHORT_KEY[role] ? t(SEAT_SHORT_KEY[role]) : role}
      </span>
    );
  }

  return (
    <>
      <span className="font-mono text-[12.5px] tracking-[0.08em] text-text-primary uppercase">
        {role && SEAT_LABEL_KEY[role] ? t(SEAT_LABEL_KEY[role]) : role}
      </span>
      <span className="truncate font-ui text-[12px] text-text-dim">
        {role && SEAT_PURPOSE_KEY[role] ? t(SEAT_PURPOSE_KEY[role]) : ""}
      </span>
    </>
  );
}
