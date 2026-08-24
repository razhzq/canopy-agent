"use client";

import { ChevronLeft, Pencil, Play } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

/**
 * The chrome the creation flow wears on a phone — wireframes B1–B6.
 *
 * CHROME ONLY. `PickMarket` and `SetLimits` hold the real work —
 * the compose call, the rule compiler, the clamping, the validation — and this
 * wraps them rather than reimplementing any of it. A second set of pickers
 * would be a second set of rules to keep in step with the specialist, which is
 * the one thing this codebase keeps proving it cannot afford.
 *
 * What is genuinely different on a phone is the navigation: the desktop rail
 * ("your agent so far") has nowhere to live, so the steps become full screens
 * with one action at the bottom, and the rail's job moves to the review screen.
 */

/** "1" → "01". The wizard counts in two digits everywhere it counts at all. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function BuildFrame({
  step,
  steps = 2,
  title,
  onBack,
  children,
  cta,
}: {
  /** 1-based within the wizard, or null on the screens outside it (name, review). */
  step: number | null;
  /**
   * How many steps the wizard has. A prop rather than a constant because it has
   * already changed once — the route step went when the market started settling
   * the venue — and the count was hardcoded in two places here, which is how
   * "02 / 03" survives a flow that stops at two.
   */
  steps?: number;
  title: string;
  onBack: () => void;
  children: ReactNode;
  cta: ReactNode;
}) {
  const t = useT();

  return (
    <div className="flex min-h-[100dvh] flex-col lg:hidden">
      <div className="flex items-center justify-between px-[18px] py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("build_back_aria")}
          className="-ml-1 p-1"
        >
          <ChevronLeft className="size-6 text-text-primary" aria-hidden />
        </button>
        <span className="font-ui text-[15px] font-semibold text-text-primary">{title}</span>
        <span className="font-mono text-[11px] font-semibold tracking-[0.6px] text-text-dim">
          {step === null ? "" : `${pad(step)} / ${pad(steps)}`}
        </span>
      </div>

      {step === null ? null : (
        <div className="flex gap-1.5 px-[18px] pb-4">
          {Array.from({ length: steps }, (_, i) => i + 1).map((i) => (
            <span
              key={i}
              className={`h-[3px] flex-1 rounded-sm ${i <= step ? "bg-accent" : "bg-grid-strong"}`}
            />
          ))}
        </div>
      )}

      {/* The picker scrolls; the action does not. A "Continue" that scrolls off
          the bottom of a long step is one people hunt for. */}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

      <div className="shrink-0 border-t border-grid px-[18px] pt-4 pb-[calc(env(safe-area-inset-bottom)+18px)]">
        {cta}
      </div>
    </div>
  );
}

export function BuildCta({
  label,
  hint,
  onClick,
  disabled,
  busy,
  icon,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  icon?: ReactNode;
}) {
  const t = useT();

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || busy}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-accent font-ui text-[15px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
      >
        {icon}
        {busy ? t("build_working") : label}
      </button>
      {hint ? (
        <p className="text-center font-ui text-[11px] leading-relaxed text-text-dim">{hint}</p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- name --- */

const MAX = 120;
const SUGGESTIONS = ["jito-momentum", "sol-carry", "rwa-rotate"];

/**
 * B1 — the name, asked first.
 *
 * A full screen rather than the desktop modal. `nameAgent.tsx` explains why it
 * comes first: it is the one field that outlives the draft, travelling with the
 * published record and every deployment of it. On a phone a modal over an empty
 * page is just a page with a border, so it becomes the page.
 */
export function BuildName({
  value,
  onChange,
  onConfirm,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const trimmed = value.trim();
  const t = useT();

  return (
    <BuildFrame
      step={null}
      title={t("name_m_title")}
      onBack={onCancel}
      cta={
        <BuildCta
          label={t("name_continue")}
          hint={t("name_m_hint")}
          disabled={trimmed.length === 0}
          onClick={onConfirm}
        />
      }
    >
      <div className="space-y-5 px-[18px] pt-1.5">
        <div className="space-y-2">
          <h1 className="font-ui text-[22px] leading-tight font-semibold tracking-[-0.5px] text-text-primary">
            {t("name_title")}
          </h1>
          <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
            {t("name_m_body")}
          </p>
        </div>

        <div className="flex h-[54px] items-center gap-2.5 rounded-xl border border-accent bg-bg px-[15px]">
          <input
            value={value}
            autoFocus
            onChange={(e) => onChange(e.target.value.slice(0, MAX))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && trimmed) onConfirm();
            }}
            placeholder="jito-momentum"
            className="min-w-0 flex-1 bg-transparent font-mono text-[16px] font-semibold text-text-primary outline-none placeholder:text-text-dim"
          />
          <span className="shrink-0 font-mono text-[10px] text-text-dim">
            {value.length}/{MAX}
          </span>
        </div>

        <div className="space-y-2.5">
          <p className="font-mono text-[8.5px] font-semibold tracking-[0.9px] text-text-dim uppercase">
            {t("name_m_suggestions")}
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange(s)}
                className="flex h-[34px] items-center rounded-[9px] border border-border bg-surface px-3 font-mono text-[11.5px] font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </BuildFrame>
  );
}

/* -------------------------------------------------------------- review --- */

export function BuildReview({
  name,
  rows,
  onEditName,
  onBack,
  onStart,
  busy,
  error,
  warnings,
}: {
  name: string;
  rows: { label: string; value: string; tone?: "accent" | "negative"; step?: string }[];
  onEditName: () => void;
  onBack: () => void;
  onStart: () => void;
  busy: boolean;
  error: string | null;
  warnings: string[];
}) {
  const t = useT();

  return (
    <BuildFrame
      step={null}
      title={t("review_title")}
      onBack={onBack}
      cta={
        <BuildCta
          label={t(warnings.length > 0 ? "review_start_anyway" : "review_create")}
          onClick={onStart}
          busy={busy}
          icon={<Play className="size-4" aria-hidden />}
        />
      }
    >
      <div className="px-[18px] pt-1.5 pb-2">
        <div className="flex items-center gap-2.5">
          <h1 className="min-w-0 flex-1 truncate font-mono text-[22px] leading-none font-semibold tracking-[-0.5px] text-text-primary">
            {name}
          </h1>
          <button
            type="button"
            onClick={onEditName}
            aria-label={t("build_rename_aria")}
            className="p-1"
          >
            <Pencil className="size-4 text-text-dim" aria-hidden />
          </button>
        </div>
        <p className="pt-2 font-ui text-[13px] leading-relaxed text-text-secondary">
          {t("review_body")}
        </p>
      </div>

      <div className="mt-4 border-y border-grid bg-panel px-[18px] py-1">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`flex items-center gap-2.5 py-2.5 ${i ? "border-t border-grid" : ""}`}
          >
            <span className="min-w-0 flex-1 font-ui text-[12.5px] text-text-dim">{r.label}</span>
            <span
              className={`font-mono text-[12.5px] font-semibold ${
                r.tone === "accent"
                  ? "text-accent"
                  : r.tone === "negative"
                    ? "text-negative"
                    : "text-text-primary"
              }`}
            >
              {r.value}
            </span>
            {r.step ? (
              <span className="w-4 shrink-0 text-right font-mono text-[9px] font-semibold text-text-muted">
                {r.step}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Warnings from `createStrategy`, which holds the strategy back rather
          than starting it. Shown before the button that overrides them. */}
      {warnings.length > 0 ? (
        <div className="mx-[18px] mt-4 space-y-2 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-3">
          <p className="font-mono text-[9px] font-semibold tracking-[0.8px] text-warning uppercase">
            {t("review_warnings")}
          </p>
          {warnings.map((w) => (
            <p key={w} className="font-ui text-[12px] leading-relaxed text-text-secondary">
              {w}
            </p>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="px-[18px] pt-4 font-ui text-[12.5px] text-negative">{error}</p>
      ) : null}

      <p className="px-[18px] py-4 font-ui text-[12px] leading-relaxed text-text-dim">
        {t("review_note")}
      </p>
    </BuildFrame>
  );
}
