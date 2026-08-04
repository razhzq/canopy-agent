import Link from "next/link";
import type { ReactNode } from "react";

/* ---------------------------------------------------------------- tone ---- */

export type Tone =
  | "accent"
  | "negative"
  | "warning"
  | "neutral"
  | "muted"
  | "simulated";

const TONE_TEXT: Record<Tone, string> = {
  accent: "text-accent",
  negative: "text-negative",
  warning: "text-warning",
  neutral: "text-text-primary",
  muted: "text-text-dim",
  simulated: "text-simulated",
};

const TONE_BORDER: Record<Tone, string> = {
  accent: "border-accent text-accent",
  negative: "border-negative text-negative",
  warning: "border-warning text-warning",
  neutral: "border-border text-text-secondary",
  muted: "border-grid-strong text-text-dim",
  simulated: "border-grid-strong text-simulated",
};

/** Signed number: green when positive, red when negative, dim at zero. */
export function toneForDelta(value: number): Tone {
  if (value > 0) return "accent";
  if (value < 0) return "negative";
  return "muted";
}

/* --------------------------------------------------------------- badge ---- */

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center border px-1.5 py-[3px] font-mono text-[10px] leading-none tracking-[0.08em] uppercase ${TONE_BORDER[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Filled status chip — used for RUNNING and other live states. */
export function Pill({
  children,
  tone = "accent",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 border px-2 py-1 font-mono text-[10px] leading-none tracking-[0.08em] uppercase ${TONE_BORDER[tone]}`}
    >
      <span
        className={`size-1.5 rounded-full ${tone === "accent" ? "bg-accent" : "bg-current"}`}
      />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- section ---- */

/**
 * The numbered section header that runs down every screen:
 * `01  PERFORMANCE                        NET OF FEES AND SLIPPAGE`
 */
export function SectionHead({
  index,
  title,
  note,
  children,
}: {
  index: string;
  title: string;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 pb-6">
      <div className="flex items-center gap-6">
        <span className="w-4 font-mono text-[11px] text-accent">{index}</span>
        <h2 className="font-mono text-[14px] tracking-[0.06em] text-text-primary">
          {title}
        </h2>
        {children}
      </div>
      {note ? (
        <div className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
          {note}
        </div>
      ) : null}
    </div>
  );
}

/** A full-bleed horizontal band with a hairline underneath. */
export function Band({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-b border-grid ${className}`}>{children}</section>
  );
}

/* ---------------------------------------------------------------- stat ---- */

export function StatCell({
  label,
  value,
  tone = "neutral",
  size = "md",
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
        {label}
      </span>
      <span
        className={`tnum font-mono ${size === "md" ? "text-[22px]" : "text-[15px]"} leading-none ${TONE_TEXT[tone]}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Row of stat cells divided by hairlines — the ribbon under every page title. */
export function StatRail({
  items,
  className = "",
}: {
  items: { label: string; value: ReactNode; tone?: Tone }[];
  className?: string;
}) {
  return (
    <div className={`flex ${className}`}>
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`flex-1 px-8 py-6 ${i > 0 ? "border-l border-grid" : ""}`}
        >
          <StatCell label={item.label} value={item.value} tone={item.tone} />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- rails ---- */

/** `LABEL ....................... value` — the sidebar summary row. */
export function RailRow({
  label,
  value,
  tone = "neutral",
  mono = true,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-grid py-3.5">
      <span className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
        {label}
      </span>
      <span
        className={`tnum text-right text-[12px] ${mono ? "font-mono" : "font-ui"} ${TONE_TEXT[tone]}`}
      >
        {value}
      </span>
    </div>
  );
}

export function RailSection({
  title,
  note,
  children,
  className = "",
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-b border-grid px-8 py-7 ${className}`}>
      <div className="flex items-center justify-between gap-4 pb-2">
        <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
          {title}
        </h3>
        {note ? (
          <span className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
            {note}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------- callout ---- */

const CALLOUT_TONE: Record<string, { bar: string; icon: string }> = {
  info: { bar: "bg-grid-strong", icon: "text-text-dim" },
  warning: { bar: "bg-warning", icon: "text-warning" },
  accent: { bar: "bg-accent", icon: "text-accent" },
  negative: { bar: "bg-negative", icon: "text-negative" },
};

export function Callout({
  tone = "info",
  icon,
  title,
  children,
  filled = true,
}: {
  tone?: keyof typeof CALLOUT_TONE;
  icon?: ReactNode;
  title?: string;
  children?: ReactNode;
  filled?: boolean;
}) {
  const t = CALLOUT_TONE[tone];
  return (
    <div className={`flex gap-4 ${filled ? "bg-panel" : ""} px-5 py-4`}>
      <div className={`w-0.5 shrink-0 self-stretch ${t.bar}`} />
      <div className="flex gap-3">
        {icon ? <span className={`mt-0.5 shrink-0 ${t.icon}`}>{icon}</span> : null}
        <div className="space-y-1.5">
          {title ? (
            <p className="font-mono text-[12px] tracking-[0.06em] text-text-primary uppercase">
              {title}
            </p>
          ) : null}
          {children ? (
            <div className="font-ui text-[13px] leading-relaxed text-text-secondary">
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- buttons ---- */

export function PrimaryButton({
  children,
  href,
  className = "",
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  const cls = `flex h-12 w-full items-center justify-center gap-2.5 bg-accent font-mono text-[12px] tracking-[0.1em] text-bg uppercase transition-opacity hover:opacity-90 ${className}`;
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" className={cls}>
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  href,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  tone?: Tone;
  className?: string;
}) {
  const cls = `flex h-11 w-full items-center justify-center gap-2.5 border font-mono text-[11px] tracking-[0.1em] uppercase transition-colors hover:bg-surface ${TONE_BORDER[tone]} ${className}`;
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" className={cls}>
      {children}
    </button>
  );
}

/** Small square-cornered control used in toolbars (90D, FILTERS, RETURN…). */
export function ToolButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-9 items-center gap-2 border border-border px-3.5 font-mono text-[11px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:border-grid-strong hover:text-text-primary"
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- misc ----- */

/** Square agent avatar placeholder — the design shows an empty tile. */
export function AgentTile({ size = 34 }: { size?: number }) {
  return (
    <div
      className="shrink-0 border border-grid-strong bg-surface-2"
      style={{ width: size, height: size }}
    />
  );
}

export function Breadcrumb({ parts }: { parts: string[] }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
      {parts.map((part, i) => (
        <span key={part} className="flex items-center gap-2">
          {i > 0 ? <span className="text-grid-strong">/</span> : null}
          {part}
        </span>
      ))}
    </div>
  );
}

/** Two-column page body: 1004px main + 436px rail, matching the design grid. */
export function Columns({
  main,
  rail,
}: {
  main: ReactNode;
  rail: ReactNode;
}) {
  return (
    <div className="flex items-stretch">
      <div className="min-w-0 flex-1">{main}</div>
      <aside className="w-[436px] shrink-0 border-l border-grid">{rail}</aside>
    </div>
  );
}

export function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-3.5 ${className}`} aria-hidden>
      <path
        d="M3 8.5 6.2 11.7 13 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-3.5 ${className}`} aria-hidden>
      <rect
        x="3.5"
        y="7"
        width="9"
        height="6.5"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

export function BlockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-3.5 ${className}`} aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M4.5 4.5 11.5 11.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function InfoIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-3.5 ${className}`} aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M8 7.2v4M8 4.8v.9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WarnIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-3.5 ${className}`} aria-hidden>
      <path
        d="M8 2.5 14.5 13.5h-13L8 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M8 6.6v3.1M8 11.4v.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-3.5 ${className}`} aria-hidden>
      <path
        d="M2.5 8h11M9.5 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-4 ${className}`} aria-hidden>
      <path
        d="M6 3.5 10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
