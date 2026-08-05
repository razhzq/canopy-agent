"use client";

import { useState } from "react";
import { Pill, PillRow, PillTag, StepHead } from "@/components/wizard";
import type { DetectionRule, ExitRules } from "@/lib/api";

/**
 * Step 2 of the builder: what makes the agent buy.
 *
 * Templates lead, tuning is collapsed. The platforms that serve retail well
 * ship configured strategies and let you adjust; the ones that hand over a
 * blank canvas of primitives buy flexibility with a learning curve nobody
 * asked for. `note.md` sets the bar at five minutes.
 *
 * DELIBERATELY NOT A FUNDAMENTAL-VS-TECHNICAL FORK. Traders use both, so
 * exclusivity is worse than reality — and there is no price history behind the
 * Wintel contract today, so a "technical" branch would be a button with nothing
 * behind it. Analysis styles appear below as signal SOURCES, with the ones we
 * cannot yet honour shown as unavailable rather than hidden.
 */

export interface RuleSpec {
  key: string;
  label: string;
  help: string;
  op: "gte" | "lte";
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
}

/**
 * Every key is a fact the RWA specialist actually gathers, so a rule you set is
 * a rule that runs. A key the SME never produces would silently never apply and
 * the asset would simply never qualify, with nothing explaining why.
 */
export const RWA_RULES: RuleSpec[] = [
  {
    key: "liquidityUsd",
    label: "Liquidity floor",
    help: "Pool depth on Solana. Applies to every asset, including gold.",
    op: "gte",
    value: 50_000,
    min: 0,
    max: 500_000,
    step: 10_000,
    unit: "$",
  },
  {
    key: "dailyVolPct",
    label: "Max daily volatility",
    help: "Trailing realised volatility of the underlying, from Wintel.",
    op: "lte",
    value: 5,
    min: 1,
    max: 15,
    step: 0.5,
    unit: "%",
  },
  {
    key: "maxEventScore",
    label: "Max recent event severity",
    help: "Skip anything that has had a serious abnormal-activity event this week.",
    op: "lte",
    value: 70,
    min: 0,
    max: 100,
    step: 5,
    unit: "",
  },
  {
    key: "netMarginPct",
    label: "Min net margin",
    help: "From SEC filings. Applies to equities; skipped for commodities.",
    op: "gte",
    value: 5,
    min: -20,
    max: 50,
    step: 1,
    unit: "%",
  },
];

/**
 * Templates are the entry point, not a shortcut. Each is a complete, runnable
 * position — every value below is one the SME can evaluate today.
 */
export const TEMPLATES = [
  {
    key: "quality",
    title: "Quality accumulation",
    body: "Liquid, profitable, calm. Buys what is boring and skips what is moving. The default.",
    meta: "Most conservative",
    values: { liquidityUsd: 50_000, dailyVolPct: 5, maxEventScore: 70, netMarginPct: 5 },
    exits: { takeProfitPct: 25, stopLossPct: 12, maxHoldDays: 0 },
  },
  {
    key: "averse",
    title: "Event-averse",
    body: "The same idea, tightened: deeper liquidity, calmer tape, and nothing that has had an abnormal week.",
    meta: "Fewest trades",
    values: { liquidityUsd: 100_000, dailyVolPct: 3, maxEventScore: 30, netMarginPct: 8 },
    exits: { takeProfitPct: 15, stopLossPct: 8, maxHoldDays: 45 },
  },
  {
    key: "opportunistic",
    title: "Opportunistic",
    body: "Tolerates volatility and weaker margins to see more candidates. Expect more proposals and more rejections.",
    meta: "Most active",
    values: { liquidityUsd: 50_000, dailyVolPct: 10, maxEventScore: 85, netMarginPct: 0 },
    exits: { takeProfitPct: 45, stopLossPct: 20, maxHoldDays: 14 },
  },
] as const;

/**
 * Where an entry signal can come from.
 *
 * The unavailable ones are the data-partner roadmap made visible. Showing them
 * greyed is more honest than hiding them and more useful than a button that
 * does nothing.
 */
const SOURCES = [
  { name: "Fundamentals", detail: "Margins, filings, balance sheet", via: "Wintel", ready: true },
  { name: "News & events", detail: "Abnormal activity, filings search", via: "Wintel", ready: true },
  { name: "Technical", detail: "Indicators over price history", via: "Needs a bars feed", ready: false },
  { name: "Sentiment", detail: "X and social", via: "Elfa.ai", ready: false },
  { name: "Smart money", detail: "Wallet flow", via: "Nansen", ready: false },
];

export function fmt(v: number, unit: string): string {
  if (unit === "$") return v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;
  return `${v}${unit}`;
}

export const toPayload = (rules: RuleSpec[]): DetectionRule[] =>
  rules.map((r) => ({ key: r.key, op: r.op, value: r.value }));

export function StrategyStep({
  rules,
  onChange,
  template,
  onTemplate,
  exits,
  onExits,
}: {
  rules: RuleSpec[];
  onChange: (next: RuleSpec[]) => void;
  template: string | null;
  onTemplate: (key: string) => void;
  exits: ExitRules;
  onExits: (next: ExitRules) => void;
}) {
  const [open, setOpen] = useState(false);

  function pick(key: string): void {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    const values = t.values as Record<string, number>;
    onChange(rules.map((r) => (r.key in values ? { ...r, value: values[r.key] } : r)));
    onExits({ ...t.exits });
    onTemplate(key);
  }

  function setExit(patch: Partial<ExitRules>): void {
    onExits({ ...exits, ...patch });
    onTemplate("");
  }

  function setRule(key: string, value: number): void {
    onChange(rules.map((r) => (r.key === key ? { ...r, value } : r)));
    // Adjusting a value means this is no longer that template. Say so rather
    // than leaving a card highlighted that no longer describes the rules.
    onTemplate("");
  }

  const active = TEMPLATES.find((t) => t.key === template);

  return (
    <div className="space-y-7">
      <section>
        <StepHead index="01" title="Starting point" note="Each one runs as-is." />
        <PillRow>
          {TEMPLATES.map((t) => (
            <Pill key={t.key} active={template === t.key} onClick={() => pick(t.key)}>
              {t.title}
            </Pill>
          ))}
          {!template ? <Pill active>Custom</Pill> : null}
        </PillRow>
        <p className="max-w-[64ch] pt-4 font-ui text-[13px] leading-relaxed text-text-secondary">
          {active ? (
            <>
              {active.body}{" "}
              <span className="font-mono text-[11.5px] text-text-dim">· {active.meta}</span>
            </>
          ) : (
            "Adjusted from a template. Pick one above to start over from a known set."
          )}
        </p>
      </section>

      <section>
        <StepHead index="02" title="Entry rules" note="What has to be true before it buys." />

        <div className="flex flex-wrap items-center gap-2">
          {rules.map((r) => (
            <PillTag key={r.key} tone="accent">
              {r.label.split(" ")[0]} {r.op === "gte" ? "≥" : "≤"} {fmt(r.value, r.unit)}
            </PillTag>
          ))}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="h-9 px-2 font-mono text-[10.5px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:text-accent"
          >
            {open ? "Done" : "Tune"}
          </button>
        </div>

        {open ? (
          <div className="mt-4 border-t border-grid">
            {rules.map((r) => (
              <Slider
                key={r.key}
                label={r.label}
                qualifier={r.op === "gte" ? "at least" : "at most"}
                help={r.help}
                value={r.value}
                min={r.min}
                max={r.max}
                step={r.step}
                display={fmt(r.value, r.unit)}
                onChange={(v) => setRule(r.key, v)}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <StepHead
          index="03"
          title="Exit rules"
          note="Entry rules alone would buy and never sell."
        />
        <div className="border-t border-grid">
          <Slider
            label="Take profit"
            help="Close when the position is up this much."
            value={exits.takeProfitPct}
            min={2}
            max={200}
            step={1}
            display={`+${exits.takeProfitPct}%`}
            onChange={(v) => setExit({ takeProfitPct: v })}
          />
          <Slider
            label="Stop loss"
            help="Close when it is down this much. A magnitude — 12 means twelve percent down."
            value={exits.stopLossPct}
            min={1}
            max={90}
            step={1}
            display={`−${exits.stopLossPct}%`}
            onChange={(v) => setExit({ stopLossPct: v })}
          />
          <Slider
            label="Time limit"
            help="Close regardless of price after this long."
            value={exits.maxHoldDays ?? 0}
            min={0}
            max={180}
            step={1}
            display={exits.maxHoldDays ? `${exits.maxHoldDays}d` : "Never"}
            onChange={(v) => setExit({ maxHoldDays: v })}
          />
        </div>
        <p className="pt-3 font-ui text-[12.5px] leading-relaxed text-text-secondary">
          Exits are evaluated every cycle, before the agent looks for anything new — including
          on cycles where it finds nothing to buy. A position whose price cannot be read is
          never closed on a guess.
        </p>
      </section>

      <section>
        <StepHead index="04" title="Signal sources" note="What these rules draw on today." />
        <PillRow>
          {SOURCES.map((s) => (
            <PillTag key={s.name} tone={s.ready ? "accent" : "dim"} suffix={s.via}>
              {s.name}
            </PillTag>
          ))}
        </PillRow>
        <p className="max-w-[64ch] pt-4 font-ui text-[12.5px] leading-relaxed text-text-secondary">
          Dimmed sources are not wired yet. Your rules run on the two that are — nothing here
          silently does nothing.
        </p>
      </section>
    </div>
  );
}

/**
 * One labelled slider row.
 *
 * Was two near-identical components — the entry rules had their own, the exits
 * had another. Same grid, same three columns, drifting apart.
 *
 * Borderless: the rows sit under a single hairline rather than each inside its
 * own box, so a column of them reads as a list instead of a stack of crates.
 */
function Slider({
  label,
  qualifier,
  help,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  qualifier?: string;
  help: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid gap-3 border-b border-grid py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_220px_76px] lg:items-center lg:gap-5">
      <div className="min-w-0">
        <p className="font-mono text-[12px] text-text-primary">
          {label}
          {qualifier ? <span className="text-text-dim"> {qualifier}</span> : null}
        </p>
        <p className="pt-0.5 font-ui text-[11.5px] leading-relaxed text-text-dim">{help}</p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="accent-accent"
      />
      <span className="tnum text-right font-mono text-[13px] text-accent">{display}</span>
    </div>
  );
}

/** Platform default when no template has been picked. */
export const DEFAULT_EXITS: ExitRules = { takeProfitPct: 25, stopLossPct: 12, maxHoldDays: 0 };
