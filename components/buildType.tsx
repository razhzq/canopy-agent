"use client";

import { ArrowLeftRight, CandlestickChart, Copy } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { FOCUS } from "@/components/kit";
import { MIN_PAPER_BOOK_USD } from "@/components/setLimits";
import { useT, type TranslationKey } from "@/lib/i18n";

/**
 * What an agent does. Asked before anything else, because everything after it
 * depends on the answer: a rule-based agent picks markets, writes a strategy
 * and chooses a model; a copy agent names a wallet and sets limits, and never
 * reasons at all. The design is `Build — 00 Type` in canopyatlas.pen.
 */
export type AgentKind = "spot" | "perp" | "copyLp";

const KINDS: {
  kind: AgentKind;
  icon: ReactNode;
  title: TranslationKey;
  line: TranslationKey;
  facts: [TranslationKey, TranslationKey][];
}[] = [
  {
    kind: "spot",
    icon: <ArrowLeftRight className="size-[18px]" />,
    title: "bt_spot",
    line: "bt_spot_line",
    facts: [
      ["bt_fact_trades", "bt_spot_trades"],
      ["bt_fact_decides", "bt_spot_decides"],
      ["bt_fact_steps", "bt_rule_steps"],
    ],
  },
  {
    kind: "perp",
    icon: <CandlestickChart className="size-[18px]" />,
    title: "bt_perp",
    line: "bt_perp_line",
    facts: [
      ["bt_fact_trades", "bt_perp_trades"],
      ["bt_fact_direction", "bt_perp_direction"],
      ["bt_fact_steps", "bt_rule_steps"],
    ],
  },
  {
    kind: "copyLp",
    icon: <Copy className="size-[18px]" />,
    title: "bt_copy",
    line: "bt_copy_line",
    facts: [
      ["bt_fact_follows", "bt_copy_follows"],
      ["bt_fact_sized", "bt_copy_sized"],
      ["bt_fact_steps", "bt_copy_steps"],
    ],
  },
];

export const KIND_TITLE: Record<AgentKind, TranslationKey> = { spot: "bt_spot", perp: "bt_perp", copyLp: "bt_copy" };

export function PickType({
  kind,
  onKindChange,
  capitalUsd,
  onCapitalChange,
}: {
  kind: AgentKind;
  onKindChange: (next: AgentKind) => void;
  capitalUsd: number | null;
  onCapitalChange: (next: number | null) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-ui text-[28px] font-light leading-tight tracking-[-0.02em] text-text-primary">{t("bt_title")}</h1>
        <p className="mt-1.5 font-ui text-[13.5px] text-text-muted">{t("bt_lede")}</p>
      </header>

      <div role="radiogroup" aria-label={t("bt_title")} className="grid gap-4 md:grid-cols-3">
        {KINDS.map((k) => {
          const on = k.kind === kind;
          return (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onKindChange(k.kind)}
              className={`flex flex-col gap-4 rounded-2xl border p-5 text-left transition-colors ${FOCUS} ${
                on ? "border-accent/70 bg-accent-wash/40" : "border-grid hover:border-grid-strong"
              }`}
            >
              <span className="flex w-full items-center justify-between">
                <span
                  className={`flex size-9 items-center justify-center rounded-[10px] ${
                    on ? "bg-accent-wash text-accent" : "bg-surface-2 text-text-secondary"
                  }`}
                >
                  {k.icon}
                </span>
                <span
                  aria-hidden
                  className={`flex size-[18px] items-center justify-center rounded-full border-[1.5px] ${on ? "border-accent" : "border-grid-strong"}`}
                >
                  {on ? <span className="size-2 rounded-full bg-accent" /> : null}
                </span>
              </span>
              <span className="block">
                <span className="block font-ui text-[16px] font-medium text-text-primary">{t(k.title)}</span>
                <span className="mt-1.5 block font-ui text-[13px] leading-relaxed text-text-secondary">{t(k.line)}</span>
              </span>
              <span className="block w-full space-y-2 border-t border-grid pt-3">
                {k.facts.map(([label, value]) => (
                  <span key={label} className="flex items-baseline justify-between gap-3">
                    <span className="font-ui text-[12px] text-text-muted">{t(label)}</span>
                    <span className="truncate font-ui text-[12.5px] text-text-primary">{t(value)}</span>
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <PaperBookField value={capitalUsd} onChange={onCapitalChange} />
    </div>
  );
}

const QUICK_BOOKS = [100, 1_000, 10_000, 50_000];

/** Parses what was typed: digits with optional separators, "1.5k", "2m". Null when it is not an amount. */
export function parseAmount(text: string): number | null {
  const m = /^\s*\$?\s*([\d,]*\.?\d+)\s*([km])?\s*$/i.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const mult = m[2]?.toLowerCase() === "k" ? 1_000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : 1;
  return Math.round(n * mult * 100) / 100;
}

export function formatUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/**
 * The paper book: any amount from $100. `null` while the field holds something
 * that is not a valid book, which the builder reads as "cannot continue".
 */
export function PaperBookField({ value, onChange }: { value: number | null; onChange: (next: number | null) => void }) {
  const t = useT();
  const [text, setText] = useState(value === null ? "" : value.toLocaleString("en-US"));
  // Follow a value set from outside (a quick pick, a restored draft) without
  // fighting the owner mid-typing.
  useEffect(() => {
    const parsed = parseAmount(text);
    if (value !== null && parsed !== value) setText(value.toLocaleString("en-US"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const parsed = parseAmount(text);
  const state = text.trim() === "" ? "empty" : parsed === null || parsed < MIN_PAPER_BOOK_USD ? "below" : parsed >= 1_000_000 ? "large" : "ok";
  const min = formatUsd(MIN_PAPER_BOOK_USD);

  function commit(next: string): void {
    setText(next);
    const n = parseAmount(next);
    onChange(n !== null && n >= MIN_PAPER_BOOK_USD ? n : null);
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-grid px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="font-ui text-[14px] font-medium text-text-primary">{t("bt_book")}</h2>
        <p className="mt-1 font-ui text-[12.5px] text-text-muted">{t("bt_book_help", { min })}</p>
      </div>
      <div className="flex flex-col items-start gap-1.5 lg:items-end">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            {QUICK_BOOKS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={value === n}
                onClick={() => commit(n.toLocaleString("en-US"))}
                className={`tnum h-8 rounded-full px-3 font-mono text-[12px] transition-colors ${FOCUS} ${
                  value === n ? "bg-surface-2 text-text-primary" : "border border-grid text-text-secondary hover:text-text-primary"
                }`}
              >
                {formatUsd(n)}
              </button>
            ))}
          </div>
          <label
            className={`flex h-11 w-[200px] items-center gap-1.5 rounded-xl border-[1.5px] px-3.5 transition-colors ${
              state === "below" || state === "empty" ? "border-negative/70" : "border-grid-strong focus-within:border-accent"
            }`}
          >
            <span className="font-mono text-[15px] text-text-muted">$</span>
            <input
              value={text}
              onChange={(e) => commit(e.target.value)}
              inputMode="decimal"
              spellCheck={false}
              autoComplete="off"
              aria-label={t("bt_book_aria")}
              aria-invalid={state === "below" || state === "empty"}
              className="tnum w-full min-w-0 bg-transparent font-mono text-[17px] text-text-primary outline-none"
            />
            <span className="font-ui text-[12px] text-text-muted">USD</span>
          </label>
        </div>
        {state === "below" ? (
          <p className="font-ui text-[12px] text-negative">{t("bt_book_below", { min })}</p>
        ) : state === "empty" ? (
          <p className="font-ui text-[12px] text-negative">{t("bt_book_empty", { min })}</p>
        ) : state === "large" && parsed !== null ? (
          <p className="font-ui text-[12px] text-text-secondary">{t("bt_book_large", { amount: formatUsd(parsed) })}</p>
        ) : null}
      </div>
    </section>
  );
}
