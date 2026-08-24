"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CheckIcon, LockIcon, RailRow, RailSection } from "@/components/ui";
import { useT, type TranslationKey } from "@/lib/i18n";

/**
 * One step in a wizard's progress bar.
 *
 * `labelKey` rather than a label: every step table in the app is a module-level
 * constant, so a finished string would be frozen in whichever language loaded
 * first.
 */
export type Step = { index: string; labelKey: TranslationKey; href?: string };

/**
 * The progress bar across the top of a flow. Completed steps trade their
 * number for a check; the current step is washed in accent.
 *
 * A step with no `href` renders as plain text rather than a link. The build
 * flow uses that: its stages are lifecycle states a strategy moves THROUGH
 * (draft, paper run, published), not pages you can click between. The deploy
 * flow is a genuine five-page wizard and keeps its links.
 */
export function StepBar({
  steps,
  current,
}: {
  steps: Step[];
  /** Zero-based index of the active step. */
  current: number;
}) {
  const t = useT();

  return (
    <div className="flex border-b border-grid">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        // Slimmer than it was: this is the lifecycle rail, not the page's
        // subject, and at 18px of vertical padding it was competing with the
        // content under it.
        const className = `flex flex-1 items-center gap-2.5 border-r border-grid px-5 sm:px-8 py-3 last:border-r-0 ${
          active ? "bg-accent-wash" : ""
        }`;
        const content = (
          <>
            <span
              className={`tnum font-mono text-[10px] ${
                active ? "text-accent" : done ? "text-accent" : "text-text-muted"
              }`}
            >
              {done ? <CheckIcon /> : step.index}
            </span>
            <span
              className={`font-mono text-[11px] tracking-[0.12em] uppercase ${
                active
                  ? "text-accent"
                  : done
                    ? "text-text-secondary"
                    : "text-text-dim"
              }`}
            >
              {t(step.labelKey)}
            </span>
          </>
        );
        return step.href ? (
          <Link key={step.index} href={step.href} className={className}>
            {content}
          </Link>
        ) : (
          <div key={step.index} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

/** Page title block shared by every wizard step. */
export function WizardHeader({
  eyebrow,
  title,
  subtitle,
  meta,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  meta: { label: string; value: string; tone?: "accent" | "warning" }[];
}) {
  return (
    <section className="flex items-end justify-between gap-8 border-b border-grid px-5 sm:px-8 pt-6 pb-[22px]">
      <div className="space-y-3">
        <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
          {eyebrow}
        </p>
        <h1 className="font-mono text-[32px] leading-none text-text-primary">
          {title}
        </h1>
        {subtitle ? (
          <p className="font-ui text-[14px] text-text-secondary">{subtitle}</p>
        ) : null}
      </div>

      <div className="flex shrink-0">
        {meta.map((m, i) => (
          <div
            key={m.label}
            className={`px-7 ${i > 0 ? "border-l border-grid" : ""}`}
          >
            <div className="flex flex-col items-end gap-2.5">
              <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                {m.label}
              </span>
              <span
                className={`tnum font-mono text-[13px] ${
                  m.tone === "accent"
                    ? "text-accent"
                    : m.tone === "warning"
                      ? "text-warning"
                      : "text-text-primary"
                }`}
              >
                {m.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The right-hand mandate summary shared by deploy steps 01–03. */
export function MandateRail({
  rows,
  readsAs,
}: {
  rows: [string, string, "neutral" | "accent"][];
  readsAs?: string;
}) {
  const t = useT();

  return (
    <>
      <RailSection title={t("wiz_mandate")} note={t("wiz_draft")}>
        {rows.map(([k, v, tone]) => (
          <RailRow key={k} label={k} value={v} tone={tone} />
        ))}
      </RailSection>

      {readsAs ? (
        <RailSection title={t("wiz_reads_as")}>
          <div className="mt-3 flex gap-4">
            <div className="w-0.5 shrink-0 self-stretch bg-accent" />
            <p className="font-ui text-[13.5px] leading-relaxed text-text-secondary">
              {readsAs}
            </p>
          </div>
        </RailSection>
      ) : null}
    </>
  );
}

/** The proceed block that closes every wizard rail. */
export function Proceed({
  step,
  total,
  primary,
  secondary,
  note,
  noteIcon = "lock",
}: {
  step: number;
  total: number;
  primary: ReactNode;
  secondary?: ReactNode;
  note?: string;
  noteIcon?: "lock" | "info";
}) {
  const t = useT();

  return (
    <div className="px-5 sm:px-8 py-7">
      <div className="flex items-center justify-between pb-4">
        <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
          {t("wiz_proceed")}
        </h3>
        <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
          {t("wiz_step_of", { step, total })}
        </span>
      </div>

      <div className="space-y-3">
        {primary}
        {secondary}
      </div>

      {note ? (
        <div className="flex gap-2.5 pt-4">
          <span className="mt-px shrink-0 text-text-dim">
            {noteIcon === "lock" ? <LockIcon /> : <InfoGlyph />}
          </span>
          <p className="font-mono text-[10px] leading-relaxed tracking-[0.08em] text-text-dim uppercase">
            {note}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function InfoGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7.2v4M8 4.8v.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Selectable card used for postures, universe modes, compliance profiles,
 * autonomy levels and strategy classes. The active one gets an accent wash,
 * an accent title and a check in the corner.
 */
export function ChoiceCard({
  title,
  body,
  meta,
  metaTone = "muted",
  active = false,
  icon,
  children,
  className = "",
}: {
  title: string;
  body?: string;
  meta?: string;
  metaTone?: "muted" | "warning" | "accent";
  active?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full flex-1 flex-col gap-2.5 border p-5 transition-colors ${
        active ? "border-accent bg-accent-wash" : "border-grid"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon ? (
            <span className={active ? "text-accent" : "text-text-dim"}>{icon}</span>
          ) : null}
          <h3
            className={`font-mono text-[11.5px] tracking-[0.1em] uppercase ${
              active ? "text-accent" : "text-text-primary"
            }`}
          >
            {title}
          </h3>
        </div>
        {active ? <CheckIcon className="size-3 shrink-0 text-accent" /> : null}
      </div>

      {body ? (
        <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">{body}</p>
      ) : null}

      {children}

      {meta ? (
        <p
          className={`mt-auto pt-1.5 font-mono text-[9.5px] tracking-[0.12em] uppercase ${
            metaTone === "warning"
              ? "text-warning"
              : metaTone === "accent"
                ? "text-accent"
                : "text-text-muted"
          }`}
        >
          {meta}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A group of ChoiceCards.
 *
 * Gapped rather than enclosed: the cards used to sit inside one bordered box
 * subdivided by internal rules, which drew a heavy crate around what is really
 * a set of peers. Each card now carries its own hairline and they are separated
 * by space, so the group reads as options rather than as a table.
 *
 * Default is one row. `cols={2}` lays them 2-up — use it past three cards,
 * where a single row squeezes the body copy to four-plus lines. Both variants
 * stack on narrow viewports instead of crushing.
 */
export function ChoiceRow({
  children,
  cols,
}: {
  children: ReactNode;
  cols?: 2;
}) {
  return (
    <div
      className={
        cols === 2
          ? "grid grid-cols-1 gap-2.5 sm:grid-cols-2"
          : "flex flex-col gap-2.5 sm:flex-row"
      }
    >
      {children}
    </div>
  );
}

/**
 * A pill selector.
 *
 * The lighter alternative to ChoiceCard, for choices whose options are short
 * enough to name in two or three words. A row of pills plus one line of copy
 * describing the ACTIVE choice carries the same information as a grid of cards
 * at a fraction of the weight — and scales past four options, where a card grid
 * starts wrapping into a wall.
 *
 * Use ChoiceCard when every option's body copy must be visible at once for the
 * choice to be made; use this when the descriptions are reassurance rather than
 * the basis of the decision.
 */
export function Pill({
  active = false,
  disabled = false,
  onClick,
  children,
  suffix,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  /** Trailing dim text, e.g. "soon". Never the reason to pick it. */
  suffix?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 font-mono text-[12px] tracking-[0.02em] transition-colors ${
        disabled
          ? "cursor-not-allowed border-grid text-text-muted"
          : active
            ? "border-accent bg-accent-wash text-accent"
            : "border-border text-text-secondary hover:border-grid-strong hover:text-text-primary"
      }`}
    >
      {children}
      {suffix ? (
        <span className="font-mono text-[9.5px] tracking-[0.12em] text-text-muted uppercase">
          {suffix}
        </span>
      ) : null}
    </button>
  );
}

export function PillRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

/** Compact section heading used by the builder steps. */
export function StepHead({
  index,
  title,
  note,
}: {
  index: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-3">
      <h2 className="flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] text-accent">{index}</span>
        <span className="font-mono text-[11.5px] tracking-[0.12em] text-text-primary uppercase">
          {title}
        </span>
      </h2>
      {note ? <p className="font-ui text-[12px] text-text-dim">{note}</p> : null}
    </div>
  );
}

/**
 * A pill that displays rather than selects.
 *
 * Same shape as Pill, no button semantics. Entry-rule values and signal-source
 * availability both look like pills but are not choices — rendering them as
 * buttons put aria-pressed on things nothing can press, which tells a screen
 * reader they are toggles.
 */
export function PillTag({
  tone = "neutral",
  children,
  suffix,
}: {
  tone?: "accent" | "neutral" | "dim";
  children: ReactNode;
  suffix?: string;
}) {
  return (
    <span
      className={`flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 font-mono text-[12px] tracking-[0.02em] ${
        tone === "accent"
          ? "border-accent bg-accent-wash text-accent"
          : tone === "dim"
            ? "border-grid text-text-muted"
            : "border-border text-text-secondary"
      }`}
    >
      {children}
      {suffix ? (
        <span className="font-mono text-[9.5px] tracking-[0.12em] text-text-muted uppercase">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}
