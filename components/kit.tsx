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
// 11. A SEQUENCE IS A RAIL, NOT A STACK OF CARDS. Numbered steps are carried
//     by their markers and a hairline threaded through them. A card per step
//     is a bordered container holding the bordered, pressable controls the
//     step is made of — rule 3's outline drawn around the ones that can be
//     pressed — and two boxes read as two unrelated blocks where a rail reads
//     as one job. The marker carries the state (ring / tick / flat outline) so
//     the copy beside it can stay one weight throughout.
//
// 12. DIM, DON'T HIDE. A step, control or figure that is not reachable YET
//     stays drawn — full title, full body, and the value it is going to ask
//     for — in the muted tone. Revealing it only once it unlocks turns the
//     rest of the job into a surprise, and someone who would have finished a
//     two-step task abandons the first step because nothing said how deep it
//     went. Hide a thing only when it does not apply at all. This is the
//     opposite of rule 4: absence is not a quiet state, it is a missing one.
//
// A SYMPTOM WORTH LEARNING. If a control that does the same job on two screens
// looks different on each — a different radius, padding, type scale or hover —
// neither screen is wrong about design; one of them was hand-written instead of
// reaching for the constant below. Four buttons that spend money had four
// different definitions before anyone noticed, because each one looked fine on
// its own page.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE TOKENS. Use the constants; do not retype the class strings.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Group label. 11.5px Inter, sentence case, muted. The only label treatment. */
export const LABEL = "font-ui text-[11.5px] text-text-muted";

/** Body copy inside a surface. Never larger than 12.5px. */
export const BODY = "font-ui text-[12.5px] leading-relaxed text-text-dim";

/** A bordered, interactive-feeling container. */
export const SURFACE = "rounded-xl border border-border bg-surface";

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
export const POPOVER = `overflow-hidden rounded-2xl border border-border bg-surface ${POPOVER_SHADOW}`;

/** The one action that commits. The white pill — the primary on a dark ground. */
export const PRIMARY =
  "inline-flex h-9 items-center justify-center rounded-full bg-white px-4 font-ui text-[13px] font-medium text-bg transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";

/** A real alternative to the primary — present, but not competing. */
export const SECONDARY =
  "inline-flex h-9 items-center justify-center rounded-full border border-border px-4 font-ui text-[13px] font-medium text-text-primary transition-colors hover:border-grid-strong disabled:opacity-40";

/** A utility. Text only. Must never read as the call to action. */
export const QUIET =
  "font-ui text-[12.5px] text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40";

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
export const ICON_BUTTON = `flex size-9 shrink-0 items-center justify-center rounded-full text-text-dim transition-colors hover:bg-surface-2 hover:text-text-primary ${FOCUS}`;

/** An icon control whose thing is currently open. Same accent as a selection. */
export const ICON_BUTTON_ON =
  "bg-surface-2 text-text-primary hover:bg-surface-2 hover:text-text-primary";

/** The smallest control there is — inline inside a field, like Max. */
export const MICRO =
  "font-ui text-[11px] font-medium text-text-dim transition-colors hover:text-text-primary";

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
  "flex items-center gap-1 rounded-full border border-border bg-surface p-1";

export const SEGMENT_ITEM =
  "flex h-8 items-center justify-center gap-2 rounded-full px-3.5 font-ui text-[12.5px] font-medium transition-colors";

export const SEGMENT_ON = "bg-surface-2 text-text-primary";
export const SEGMENT_OFF = "text-text-dim hover:text-text-primary";

/**
 * A read-only fact inside a group. NO BORDER — see rule 3.
 *
 * A bordered container full of bordered chips is eight outlines competing for
 * one group's worth of attention, and none of them can be pressed. The
 * container is the object; a chip is a filled step up from it.
 */
export const CHIP =
  "rounded-lg bg-surface-2 px-2.5 py-1.5 font-ui text-[12.5px] text-text-secondary";

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
    <span className="flex items-center gap-1.5 font-ui text-[12.5px] font-medium text-text-secondary">
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

/**
 * A circled "i" that explains one control, on hover or on focus.
 *
 * WHY THIS EXISTS.
 *
 * A row of settings where every label carries two lines of explanation under it
 * is a wall: the reader scans eight paragraphs to find the one number they came
 * to change, and the sentence that matters most — "this one does NOT follow the
 * strategy timeframe" — is the third line of the fourth block and reads as
 * boilerplate. Held behind a mark, the list becomes a list of names and the
 * explanation is one hover away when it is actually wanted.
 *
 * PORTALLED AND FIXED, and it has to be. These sit inside dialogs whose bodies
 * scroll, and a scroll container is not `overflow: visible` on either axis — an
 * absolutely positioned bubble on the last row would be clipped by the very box
 * it is trying to explain. Rendering to the body against viewport coordinates
 * escapes that. The trade is that the coordinates go stale the moment anything
 * scrolls, which is why any scroll closes it.
 *
 * KEYBOARD REACHABLE, deliberately a <button>. The content here is not
 * decoration — one of these is the difference between a rule measured on your
 * bars and the same rule measured on the day — so it cannot be hover-only.
 */
export function InfoDot({
  label,
  children,
}: {
  /** Names the thing being explained, for a screen reader: "About {label}". */
  label: string;
  children: ReactNode;
}) {
  const dot = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{
    x: number;
    y: number;
    above: boolean;
  } | null>(null);

  const open = () => {
    const r = dot.current?.getBoundingClientRect();
    if (!r) return;
    // Below by default, flipped above when the bottom of the viewport is
    // closer than the bubble is tall. A tooltip that opens off-screen is a
    // tooltip that never gets read.
    const above = window.innerHeight - r.bottom < 150;
    setAt({
      // Clamped to keep a centred bubble's edges inside the viewport — the
      // rules these explain start at the far left of their row.
      x: Math.min(Math.max(r.left + r.width / 2, 150), window.innerWidth - 150),
      y: above ? r.top - 8 : r.bottom + 8,
      above,
    });
  };

  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    // Capture, because the scroller is an ancestor and scroll does not bubble.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [at]);

  return (
    <>
      <button
        ref={dot}
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={!!at}
        onMouseEnter={open}
        onMouseLeave={() => setAt(null)}
        onFocus={open}
        onBlur={() => setAt(null)}
        // Press is a no-op on a pointer, and the only way in on a touch screen,
        // where there is no hover to open it with.
        onClick={() => (at ? setAt(null) : open())}
        className={`inline-flex size-[15px] shrink-0 translate-y-[1px] items-center justify-center rounded-full border font-mono text-[9px] leading-none transition-colors ${
          at
            ? "border-accent text-accent"
            : "border-grid-strong text-text-dim hover:border-text-dim hover:text-text-secondary"
        } ${FOCUS}`}
      >
        i
      </button>
      {at && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              style={{
                left: at.x,
                top: at.y,
                transform: `translateX(-50%)${at.above ? " translateY(-100%)" : ""}`,
              }}
              // Above the dialog's own z-50, or it opens behind the panel that
              // asked for it.
              className={`pointer-events-none fixed z-[60] w-[280px] rounded-lg border border-grid-strong bg-panel px-3 py-2.5 font-ui text-[11.5px] leading-relaxed text-text-secondary ${POPOVER_SHADOW}`}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
