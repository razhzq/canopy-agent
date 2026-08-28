"use client";

// THE QUIET SURFACE KIT.
//
// Extracted from the deposit and withdraw dialogs, which are the reference
// implementations. If something here and something there ever disagree, those
// two screens are right and this file is stale.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE RULES, so they can be applied by hand where a primitive does not fit.
//
// 1. ONE THING LEADS. Every surface has a single most important fact — a
//    balance, an amount, a verdict — and it is the only thing set large. If two
//    elements are competing, one of them is wrong.
//
// 2. TYPE, NOT BOXES. A number does not need a border to be a figure. Reach for
//    a container only when the thing inside is interactive, or when it is a
//    value that must be visually separated to be checked (an address, a
//    destination). A box around a single read-only number is chrome earning
//    nothing.
//
// 3. AT MOST ONE BORDERED OBJECT PER GROUP, and it should be the actionable
//    one. This is what makes the eye land on the address, the input, the thing
//    to press.
//
// 4. STATUS IS A DOT AND A WORD. Not a coloured callout. Callouts are reserved
//    for the rare thing a reader genuinely needs interrupting for — a degraded
//    data source, a warning that costs money. Spending that styling on "you are
//    funded" leaves nothing louder for when it matters.
//
// 5. ACTIONS ARE NOT PROPERTIES. They live outside the block describing the
//    thing, and they are weighted by consequence, never by frequency: the
//    action that spends or destroys is the filled one; its escape hatch is
//    quiet text beside it, never an equal half of a split row.
//
// 6. UTILITIES ARE QUIET AND LAST. A refresh, a re-check, a "send somewhere
//    else" — small mono, dim, no border. They must not read as the call to
//    action.
//
// 7. LABEL EVERY GROUP THE SAME WAY. `SectionLabel`, always. A screen with
//    three different label treatments has no system.
//
// 8. NAME WHAT YOU CAN, SHOW WHAT MUST BE CHECKED. An identifier the reader
//    chose gets shown in full so they can catch an error. One they did not
//    choose gets its name and a short form — nobody proof-reads a value they
//    did not type, and a wall of characters trains people to click past it.
//
// 9. NUMBERS ARE `tnum font-mono`. Anywhere digits are compared, aligned, or
//    updated in place.
//
// 10. SPACING CARRIES THE STRUCTURE. `space-y-6` between groups inside a
//     surface, `Divider` only where there is a genuine change of kind. A rule
//     between two facts that belong together says they do not.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE TOKENS. Use the constants; do not retype the class strings.

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Group label. 9.5px mono, wide tracking, muted. The only label treatment. */
export const LABEL =
  "font-mono text-[9.5px] tracking-[0.12em] text-text-muted uppercase";

/** Body copy inside a surface. Never larger than 12.5px. */
export const BODY = "font-ui text-[12px] leading-relaxed text-text-dim";

/** A bordered, interactive-feeling container. */
export const SURFACE = "rounded-lg border border-grid bg-surface";

/* ------------------------------------------------------------- elevation -- */

/**
 * How far a thing floats above the page.
 *
 * TWO STEPS, AND THE APP HAD SEVEN. Every overlay in the product had grown its
 * own arbitrary shadow — `0 20px 44px -16px`, `0 36px 90px -28px`,
 * `0 30px 80px -24px`, `0 24px 64px -20px` and three more — each written where
 * it was needed and none of them agreeing. Nothing looked wrong on its own,
 * which is exactly how it happened; the cost is that a dropdown and a dialog
 * sat at unrelated heights for no reason a reader could name.
 *
 * The two steps are the two questions the product actually asks. Anchored to a
 * control, or covering the page. There is no third.
 *
 * Long, soft and very dark, because the ground is near-black: a shadow here
 * reads as depth only if it is darker than the surface it falls on, and a
 * conventional light-UI shadow is invisible against #080b0a.
 */

/** Anchored to the control that opened it — menus, dropdowns, popovers. */
export const POPOVER_SHADOW = "shadow-[0_20px_44px_-16px_rgba(0,0,0,0.9)]";

/** Covering the page — dialogs, sheets, anything with a scrim behind it. */
export const OVERLAY_SHADOW = "shadow-[0_36px_90px_-28px_rgba(0,0,0,0.9)]";

/**
 * The surface a menu is drawn on.
 *
 * Composed rather than left to each caller, because a popover is four
 * decisions that have to agree — panel fill, a stronger border than a resting
 * card, the anchored elevation, and clipping so a hover fill on the first or
 * last row cannot square off the corner it sits in.
 */
export const POPOVER = `overflow-hidden rounded-md border border-grid-strong bg-panel ${POPOVER_SHADOW}`;

/** The one action that commits. Filled on hover, never filled at rest. */
export const PRIMARY =
  "rounded-lg border border-accent bg-accent-wash px-4 py-2.5 font-mono text-[10px] tracking-[0.08em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:opacity-40";

/** A real alternative to the primary — present, but not competing. */
export const SECONDARY =
  "rounded-lg border border-grid px-4 py-2.5 font-mono text-[10px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:border-text-dim hover:text-text-primary disabled:opacity-40";

/** A utility. Text only. Must never read as the call to action. */
export const QUIET =
  "font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-accent disabled:opacity-40";

/**
 * The focus ring. One definition, because a keyboard user learns it once.
 *
 * Was copied into nav.tsx and notificationCentre.tsx independently; anything
 * that ships a third copy will drift from the other two.
 */
export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * A quiet icon control — a close, a toggle, a thing you press often and think
 * about rarely.
 *
 * NO BORDER AT REST. Rule 6: a control used constantly and costing nothing
 * should not draw a box around itself all day. The hit target appears on hover
 * as a filled square, which is a stronger affordance than an outline anyway —
 * an outline says "here is an edge", a fill says "this is the area that
 * responds".
 *
 * Bigger than the glyph inside it on purpose: 36px of target around a 16px mark.
 * A control that is exactly its icon is a control people miss.
 */
export const ICON_BUTTON = `flex size-9 shrink-0 items-center justify-center rounded-lg text-text-dim transition-colors hover:bg-surface hover:text-text-primary ${FOCUS}`;

/** An icon control whose thing is currently open. Same accent as a selection. */
export const ICON_BUTTON_ON =
  "bg-accent-wash text-accent hover:bg-accent-wash hover:text-accent";

/** The smallest control there is — inline inside a field, like Max. */
export const MICRO =
  "font-mono text-[9px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:text-accent";

/**
 * A segmented control: a filled pill inside a quiet inset track.
 *
 * NOT two buttons sharing a hard border, which reads as two controls that
 * happen to touch. The track is the object; the selection is a state of it.
 *
 * The active half is `accent-wash`, the same weight a primary action has at
 * rest — deliberately, because selecting is not committing. Nothing inside a
 * segmented control should be filled solid, or it outranks the page's real
 * action.
 */
export const SEGMENT_TRACK =
  "flex items-center gap-1 rounded-lg border border-grid bg-surface p-1";

export const SEGMENT_ITEM =
  "flex items-center justify-center gap-2 rounded-md px-4 py-1.5 font-mono text-[10px] tracking-[0.08em] uppercase transition-colors";

export const SEGMENT_ON = "bg-accent-wash text-accent";
export const SEGMENT_OFF = "text-text-dim hover:text-text-primary";

/**
 * A read-only fact inside a group. NO BORDER — see rule 3.
 *
 * A bordered container full of bordered chips is eight outlines competing for
 * one group's worth of attention, and none of them can be pressed. The
 * container is the object; a chip is a filled step up from it.
 */
export const CHIP =
  "rounded-md bg-surface-2 px-2.5 py-1.5 font-ui text-[12px] text-text-secondary";

/** A figure inside running text or a chip. Rule 9. */
export const NUM = "tnum font-mono text-[12px] text-text-primary";

export function SectionLabel({ children }: { children: ReactNode }) {
  return <span className={`block ${LABEL}`}>{children}</span>;
}

/** A change of kind, not a gap. Do not use it to separate related facts. */
export function Divider() {
  return <div className="h-px bg-grid" aria-hidden />;
}

/**
 * The one large number on a surface, with its unit.
 *
 * `dim` when the value is zero or absent — a big bright 0 reads as a result,
 * where it usually means "nothing has happened yet".
 */
export function Figure({
  value,
  unit,
  size = 34,
  dim = false,
}: {
  value: string;
  unit: string;
  size?: 30 | 34;
  dim?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className={`tnum font-mono leading-none ${
          size === 34 ? "text-[34px]" : "text-[30px]"
        } ${dim ? "text-text-dim" : "text-text-primary"}`}
      >
        {value}
      </span>
      <span className="font-mono text-[12px] tracking-[0.08em] text-text-dim uppercase">
        {unit}
      </span>
    </div>
  );
}

/**
 * A value and its unit at CHIP scale — a header readout, not a hero.
 *
 * The small sibling of `Figure`. Same pairing and the same tabular digits, at a
 * size that belongs in a bar rather than at the top of a surface. Rule 1 is why
 * both exist: a surface has one leading number, and everything else reporting a
 * quantity has to be visibly not it.
 *
 * `tone` is for the value only. The unit stays dim in every state — it is a
 * label, and colouring it doubles the signal.
 */
export function Metric({
  value,
  unit,
  tone = "normal",
}: {
  value: string;
  unit: string;
  tone?: "normal" | "warn" | "dim";
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span
        className={`tnum font-mono text-[13px] ${
          tone === "warn"
            ? "text-warning"
            : tone === "dim"
              ? "text-text-dim"
              : "text-text-primary"
        }`}
      >
        {value}
      </span>
      <span className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
        {unit}
      </span>
    </span>
  );
}

/** Status: a dot and a word. See rule 4 — this replaces a callout. */
export function StatusLine({
  tone,
  live = false,
  children,
}: {
  tone: "good" | "pending" | "bad";
  /**
   * The dot pulses.
   *
   * Reserved for a state that is HAPPENING, not merely true — an agent between
   * ticks, a cycle mid-flight. "Funded" is true and static; "checking" is not.
   * Motion is the loudest thing on a quiet surface, so it is worth exactly one
   * meaning.
   */
  live?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5 font-ui text-[12px] text-text-dim">
      <span
        className={`size-[5px] shrink-0 rounded-full ${live ? "animate-pulse" : ""} ${
          tone === "good"
            ? "bg-accent"
            : tone === "bad"
              ? "bg-negative"
              : "bg-warning"
        }`}
        aria-hidden
      />
      {children}
    </span>
  );
}

/**
 * A labelled group, with an optional right-aligned aside on the label row —
 * where an available balance or a secondary reading belongs.
 */
export function Field({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className={LABEL}>{label}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

/**
 * A named value that does not need checking — rule 8's short form.
 *
 * Name on the left, short identifier on the right.
 */
export function NamedValue({
  name,
  detail,
}: {
  name: string;
  detail?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${SURFACE} px-3.5 py-2.5`}
    >
      <span className="font-ui text-[12.5px] text-text-primary">{name}</span>
      {detail ? (
        <span className="font-mono text-[11.5px] text-text-dim">{detail}</span>
      ) : null}
    </div>
  );
}

/**
 * An amount entry: the unit and any Max sit INSIDE the border, so it reads as
 * one control rather than a box with instructions floating around it.
 */
export function AmountInput({
  value,
  onChange,
  unit,
  onMax,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  unit: string;
  onMax?: () => void;
  label: string;
}) {
  return (
    <div
      className={`flex items-center ${SURFACE} px-3.5 focus-within:border-accent`}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        spellCheck={false}
        autoComplete="off"
        placeholder="0.00"
        aria-label={label}
        className="tnum w-full bg-transparent py-2.5 font-mono text-[15px] text-text-primary outline-none placeholder:text-text-dim"
      />
      <span className="shrink-0 pl-2 font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
        {unit}
      </span>
      {onMax ? (
        <button
          type="button"
          onClick={onMax}
          className={`ml-2.5 shrink-0 ${MICRO}`}
        >
          Max
        </button>
      ) : null}
    </div>
  );
}

/** An inline error or hint under a field. Tones match StatusLine's meaning. */
export function FieldNote({
  tone = "dim",
  children,
}: {
  tone?: "dim" | "bad" | "warn";
  children: ReactNode;
}) {
  return (
    <p
      className={`font-ui text-[11.5px] leading-relaxed ${
        tone === "bad"
          ? "text-negative"
          : tone === "warn"
            ? "text-warning"
            : "text-text-dim"
      }`}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ ticks -- */

/**
 * Which way a number just moved, for one beat after it moves.
 *
 * NOTHING FLASHES ON FIRST PAINT. There is no previous value to have moved
 * from, and a table that lights up entirely on load teaches the reader to
 * ignore the very signal it exists to give. Same for an unchanged value: the
 * poll returning the identical price is not an event.
 *
 * Returns to null on its own, so the caller renders a plain figure the rest of
 * the time and does not have to manage the timer.
 */
export function useTickDirection(value: number | null | undefined): "up" | "down" | null {
  const previous = useRef<number | null | undefined>(undefined);
  const [direction, setDirection] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = value;

    // `undefined` is "first time we have seen this cell". `null` is "not
    // priced", and moving in or out of unpriced is not a tick — it is the
    // figure appearing or going away, which the row already shows by changing
    // from a dash to a number.
    if (before === undefined || before === null || value === null || value === undefined) return;
    if (value === before) return;

    setDirection(value > before ? "up" : "down");
    // Matches the animation in globals.css. Clearing early would cut the wash
    // off mid-fade; clearing late would leave a class on an element that is no
    // longer animating and swallow the next tick's restart.
    const id = setTimeout(() => setDirection(null), 700);
    return () => clearTimeout(id);
  }, [value]);

  return direction;
}

/**
 * A figure that washes green or red for a moment when it changes.
 *
 * The wash says WHICH WAY IT MOVED. Whatever colour the caller gives the text
 * says what the number IS, and the two are independent — see the note on
 * `@keyframes tick-up`. So this deliberately does not colour its children: it
 * wraps them, and a losing position that ticks up flashes green while its
 * digits stay red.
 *
 * `value` is what to watch, which is not always what is displayed: a P&L cell
 * shows dollars over percent, both from one mark, and watching the dollars
 * means the pair flashes together instead of twice.
 */
export function Tick({
  value,
  className = "",
  children,
}: {
  value: number | null | undefined;
  className?: string;
  children: ReactNode;
}) {
  const direction = useTickDirection(value);
  // `block`, ALWAYS, and it is not cosmetic. These figures are stacked block
  // spans — a dollar line over a percent line — and an inline box wrapping
  // block children has no paintable area of its own, so the wash rendered into
  // nothing and no flash was ever visible. It also has to be on the base class
  // rather than the animation class, or the box would change shape for 700ms
  // every time a price moved.
  return (
    <span className={`block ${direction ? `tick-${direction}` : ""} ${className}`.trim()}>
      {children}
    </span>
  );
}
