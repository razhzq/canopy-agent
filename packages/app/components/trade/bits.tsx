"use client";

import { type ReactNode, useState } from "react";
import { AssetLogo } from "@/components/ui";
import { FOCUS, SEGMENT_ITEM, SEGMENT_OFF, SEGMENT_ON, SEGMENT_TRACK } from "@/components/kit";
import { tokenPrice } from "@/lib/format";
import type { Safety } from "@/lib/market";

/** A unit price, subscript zeros and all, with the expanded form for readers. */
export function Price({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  const p = tokenPrice(value);
  return (
    <span className={`tnum font-mono ${className}`} aria-label={p.label}>
      {p.display}
    </span>
  );
}

/** A signed percent, green up and red down. */
export function Delta({ value, className = "", suffix = "" }: { value: number | null | undefined; className?: string; suffix?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className={`tnum font-mono text-text-muted ${className}`}>—</span>;
  const up = value >= 0;
  return (
    <span className={`tnum font-mono ${up ? "text-positive" : "text-negative"} ${className}`}>
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(2)}%{suffix}
    </span>
  );
}

export function TokenMark({ symbol, icon, size = 20 }: { symbol: string; icon: string | null; size?: number }) {
  return <AssetLogo symbol={symbol} src={icon} size={size} />;
}

/** Underline tabs: the bar's own selection, not a segmented pill. */
export function UnderlineTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
  className = "",
}: {
  tabs: { key: K; label: ReactNode }[];
  value: K;
  onChange: (k: K) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={`flex items-center gap-5 border-b border-border ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === value}
          onClick={() => onChange(t.key)}
          className={`-mb-px border-b py-2.5 font-ui text-[12.5px] font-medium transition-colors ${FOCUS} ${
            t.key === value ? "border-text-primary text-text-primary" : "border-transparent text-text-dim hover:text-text-primary"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: { key: K; label: ReactNode }[];
  value: K;
  onChange: (k: K) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`${SEGMENT_TRACK} ${className}`}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={o.key === value}
          onClick={() => onChange(o.key)}
          className={`${SEGMENT_ITEM} flex-1 ${FOCUS} ${o.key === value ? SEGMENT_ON : SEGMENT_OFF}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A filter chip with an optional count. */
export function FilterChip({
  on,
  onClick,
  children,
  count,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 font-ui text-[12.5px] transition-colors ${FOCUS} ${
        on ? "border-grid-strong bg-surface-2 text-text-primary" : "border-border text-text-dim hover:text-text-primary"
      }`}
    >
      {children}
      {count != null && <span className="tnum font-mono text-[11px] text-text-muted">{count}</span>}
    </button>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-ui text-[11.5px] text-text-dim transition-colors hover:bg-surface-2 hover:text-text-primary ${FOCUS}`}
    >
      {done ? (
        "Copied"
      ) : (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a1 1 0 0 1 1-1h10" />
        </svg>
      )}
    </button>
  );
}

export function StarIcon({ on, size = 16 }: { on: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    </svg>
  );
}

/** A dollar-amount field with preset picks. */
export function AmountField({
  label,
  value,
  onChange,
  presets,
  prefix = "$",
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets: string[];
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="flex h-11 items-center gap-1 rounded-xl border border-border bg-surface px-3 focus-within:border-grid-strong">
        <span className="font-ui text-[11.5px] text-text-muted">{label}</span>
        <span className="flex-1" />
        {prefix && <span className="tnum font-mono text-[14px] text-text-dim">{prefix}</span>}
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          className="tnum w-24 bg-transparent text-right font-mono text-[14px] text-text-primary outline-none"
          aria-label={label}
        />
        {suffix && <span className="tnum font-mono text-[14px] text-text-dim">{suffix}</span>}
      </label>
      {presets.length > 0 && (
      <div className="grid grid-cols-4 gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === value}
            onClick={() => onChange(p)}
            className={`h-8 rounded-lg border font-mono text-[12px] transition-colors ${FOCUS} ${
              p === value ? "border-grid-strong bg-surface-2 text-text-primary" : "border-border text-text-dim hover:text-text-primary"
            }`}
          >
            {prefix}
            {p}
            {suffix}
          </button>
        ))}
      </div>
      )}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  ok: "text-positive",
  warn: "text-warning",
  bad: "text-negative",
  unknown: "text-text-muted",
};

const STATUS_WORD: Record<string, string> = { ok: "Pass", warn: "Watch", bad: "Fail", unknown: "Unknown" };

export function scoreTone(score: number): string {
  return score >= 80 ? "text-positive" : score >= 50 ? "text-text-primary" : "text-negative";
}

/** The five checks and the score out of 100. */
export function SafetyCard({ safety }: { safety: Safety | null }) {
  if (!safety) {
    return (
      <div className="rounded-xl border border-border p-4">
        <p className="font-ui text-[12.5px] text-text-muted">Safety check loading</p>
      </div>
    );
  }
  const failing = safety.checks.filter((c) => c.status === "bad").length;
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-ui text-[13px] font-medium text-text-primary">Safety check</span>
        <span className={`tnum font-mono text-[13px] ${scoreTone(safety.score)}`}>{safety.score}/100</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div
          className={`h-full rounded-full ${safety.score >= 80 ? "bg-positive" : safety.score >= 50 ? "bg-text-dim" : "bg-negative"}`}
          style={{ width: `${Math.max(0, Math.min(100, safety.score))}%` }}
        />
      </div>
      <ul className="space-y-1.5">
        {safety.checks.map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-3 font-ui text-[12px]">
            <span className="text-text-dim">{c.label}</span>
            <span className="flex items-center gap-2">
              <span className="tnum font-mono text-text-secondary">{c.value}</span>
              <span className={`w-12 text-right ${STATUS_TONE[c.status]}`}>{STATUS_WORD[c.status]}</span>
            </span>
          </li>
        ))}
      </ul>
      {safety.score < 50 && (
        <p className="font-ui text-[12px] leading-relaxed text-negative" role="alert">
          Fails {failing} of 5 checks. Canopy will not buy this token.
        </p>
      )}
    </div>
  );
}
