import Link from "next/link";
import type { ReactNode } from "react";
import { CheckIcon, LockIcon, RailRow, RailSection } from "@/components/ui";

export type Step = { index: string; label: string; href: string };

/**
 * The five-segment progress bar across the top of both wizards. Completed
 * steps trade their number for a check; the current step is washed in accent.
 */
export function StepBar({
  steps,
  current,
}: {
  steps: Step[];
  /** Zero-based index of the active step. */
  current: number;
}) {
  return (
    <div className="flex border-b border-grid">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Link
            key={step.index}
            href={step.href}
            className={`flex flex-1 items-center gap-3 border-r border-grid px-8 py-4.5 last:border-r-0 ${
              active ? "bg-accent-wash" : ""
            }`}
          >
            <span
              className={`tnum font-mono text-[11px] ${
                active ? "text-accent" : done ? "text-accent" : "text-text-muted"
              }`}
            >
              {done ? <CheckIcon /> : step.index}
            </span>
            <span
              className={`font-mono text-[12px] tracking-[0.1em] uppercase ${
                active
                  ? "text-accent"
                  : done
                    ? "text-text-secondary"
                    : "text-text-dim"
              }`}
            >
              {step.label}
            </span>
          </Link>
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
    <section className="flex items-end justify-between gap-8 border-b border-grid px-8 pt-6 pb-[22px]">
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
  return (
    <>
      <RailSection title="Mandate" note="Draft">
        {rows.map(([k, v, tone]) => (
          <RailRow key={k} label={k} value={v} tone={tone} />
        ))}
      </RailSection>

      {readsAs ? (
        <RailSection title="Reads as">
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
  return (
    <div className="px-8 py-7">
      <div className="flex items-center justify-between pb-4">
        <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
          Proceed
        </h3>
        <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
          Step {step} of {total}
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
      className={`flex flex-1 flex-col gap-3 p-6 ${
        active ? "bg-accent-wash" : ""
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon ? (
            <span className={active ? "text-accent" : "text-text-dim"}>{icon}</span>
          ) : null}
          <h3
            className={`font-mono text-[13px] tracking-[0.08em] uppercase ${
              active ? "text-accent" : "text-text-primary"
            }`}
          >
            {title}
          </h3>
        </div>
        {active ? <CheckIcon className="shrink-0 text-accent" /> : null}
      </div>

      {body ? (
        <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
          {body}
        </p>
      ) : null}

      {children}

      {meta ? (
        <p
          className={`mt-auto pt-2 font-mono text-[10px] tracking-[0.1em] uppercase ${
            metaTone === "warning"
              ? "text-warning"
              : metaTone === "accent"
                ? "text-accent"
                : "text-text-dim"
          }`}
        >
          {meta}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A hairline box enclosing ChoiceCards. Dividers live here rather than on the
 * cards so the two-column variant doesn't need per-card border arithmetic.
 *
 * Default is one row. `cols={2}` lays the cards out 2-up — use it past three
 * cards, where a single row squeezes the body copy to four-plus lines. It
 * assumes an even count; an odd one leaves a gap in the final row.
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
          ? "grid grid-cols-2 border border-grid [&>*]:border-grid [&>*:nth-child(odd)]:border-r [&>*:not(:nth-last-child(-n+2))]:border-b"
          : "flex border border-grid [&>*]:border-grid [&>*:not(:last-child)]:border-r"
      }
    >
      {children}
    </div>
  );
}
