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

/**
 * What a rule's number is measured against — which decides whether the
 * strategy's timeframe changes its meaning.
 *
 *   bars    computed from the price series, so its window IS the timeframe.
 *           "RSI 14" is a fortnight on daily bars and about three hours on 15m.
 *   daily   from the research feed (volatility, change on the day, event
 *           scores), which is daily whatever the strategy's timeframe is. A
 *           15-minute strategy still reads "change on the day" as the DAY.
 *   static  neither — pool depth, margin from filings. No time window at all.
 *
 * The distinction is not cosmetic: without it a 5-minute strategy would appear
 * to be filtering on 5-minute volatility while actually filtering on daily.
 */
export type RuleBasis = "bars" | "daily" | "static";

export interface RuleSpec {
  key: string;
  /** Unit-free. Windows come from `periods`, rendered against the timeframe. */
  label: string;
  help: string;
  op: "gte" | "lte";
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  basis: RuleBasis;
  /** Window in PERIODS, e.g. "14" or "20 vs 50". Only meaningful for `bars`. */
  periods?: string;
  /**
   * Whether this rule applies. Undefined means on, so the older two-step
   * builder keeps working unchanged.
   *
   * The compile step needs the distinction: a rule the sentence never mentioned
   * must not quietly apply a default the author did not ask for.
   */
  enabled?: boolean;
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
    basis: "static",
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
    basis: "daily",
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
    basis: "daily",
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
    basis: "static",
    help: "From SEC filings. Applies to equities; skipped for commodities.",
    op: "gte",
    value: 5,
    min: -20,
    max: 50,
    step: 1,
    unit: "%",
  },
  {
    key: "changePct",
    label: "Max change on the day",
    basis: "daily",
    help: "Buy only after a fall. −4 means it must already be down 4% or more today.",
    op: "lte",
    value: -4,
    min: -20,
    max: 20,
    step: 0.5,
    unit: "%",
  },
  // Technical, computed from daily closes. Windows fit the 120-day history.
  {
    key: "rsi14",
    label: "Max RSI",
    basis: "bars",
    periods: "14",
    help: "Daily RSI. 70+ is conventionally overbought — lower this to avoid buying into a run.",
    op: "lte",
    value: 70,
    min: 10,
    max: 90,
    step: 5,
    unit: "",
  },
  {
    key: "smaSpreadPct",
    label: "Min trend",
    basis: "bars",
    periods: "20 vs 50",
    help: "Gap between the 20- and 50-day averages. Above 0 means the short average leads — an uptrend.",
    op: "gte",
    value: 0,
    min: -20,
    max: 20,
    step: 1,
    unit: "%",
  },
  {
    key: "belowHigh60dPct",
    label: "Min below high",
    basis: "bars",
    periods: "60",
    help: "How far under the 60-day high it must sit. Above 0 buys pullbacks rather than breakouts.",
    op: "gte",
    value: 0,
    min: 0,
    max: 60,
    step: 1,
    unit: "%",
  },
  {
    key: "macdHistPct",
    label: "Min MACD histogram",
    basis: "bars",
    periods: "12/26/9",
    help: "MACD (12/26/9), measured as a percent of price so one setting works across gold and equities. Above 0 means the crossover has already happened.",
    op: "gte",
    value: 0,
    min: -2,
    max: 2,
    step: 0.05,
    unit: "%",
  },
  {
    key: "bollingerPctB",
    label: "Max Bollinger %B",
    basis: "bars",
    periods: "20",
    help: "Where price sits in the 20-day bands: 0 is the lower band, 50 the average, 100 the upper. Lower this to buy near the bottom of the range.",
    op: "lte",
    value: 50,
    min: -20,
    max: 120,
    step: 5,
    unit: "",
  },
  {
    key: "bollingerBandwidthPct",
    label: "Max Bollinger bandwidth",
    basis: "bars",
    periods: "20",
    help: "How wide the bands are, as a percent of price. Lower this to trade only when volatility has squeezed.",
    op: "lte",
    value: 20,
    min: 1,
    max: 40,
    step: 1,
    unit: "%",
  },
];

/** Bar sizes a strategy's technical rules can be measured on. */
export type Timeframe = "1d" | "1h" | "30m" | "15m" | "5m";
export const DEFAULT_TIMEFRAME: Timeframe = "1d";

export const TIMEFRAMES: { tf: Timeframe; label: string; detail: string }[] = [
  { tf: "1d", label: "1 day", detail: "The default. ~120 days of history behind every indicator." },
  { tf: "1h", label: "1 hour", detail: "Two months of history. A 14-period RSI spans two days." },
  { tf: "30m", label: "30 min", detail: "Six weeks of history." },
  { tf: "15m", label: "15 min", detail: "A month of history. A 14-period RSI spans about 3½ hours." },
  { tf: "5m", label: "5 min", detail: "A month of history. The finest the scheduler can act on." },
];

/**
 * How a rule reads at a given timeframe.
 *
 * The whole reason this function exists rather than a hardcoded string: "Max
 * RSI (14d)" was correct while daily was the only option and becomes a LIE at
 * any other. A user on 15-minute bars reading "14d" would set a threshold for
 * a fortnight of selling and get one for three hours of it — same label, same
 * number, a different statistic, and nothing on screen to reveal the swap.
 *
 * Daily-basis rules say "daily" out loud for the mirror-image reason: they do
 * NOT follow the timeframe, so on a 5-minute strategy they are the one thing
 * still measured in days.
 */
export function ruleLabel(spec: RuleSpec, timeframe: Timeframe = DEFAULT_TIMEFRAME): string {
  if (spec.basis !== "bars" || !spec.periods) return spec.label;
  // "14d" reads better than "14 × 1d" and is what every chart calls it.
  const window = timeframe === "1d" ? `${spec.periods}d` : `${spec.periods} × ${timeframe}`;
  return `${spec.label} (${window})`;
}

/** One line stating what a rule is measured against. Pairs with the label. */
export function ruleBasisNote(spec: RuleSpec, timeframe: Timeframe = DEFAULT_TIMEFRAME): string | null {
  if (spec.basis === "daily" && timeframe !== "1d") {
    return "Always daily — this one does not follow the strategy timeframe.";
  }
  return null;
}

/**
 * How often the agent wakes.
 *
 * Cadence is NOT chart timeframe — that is TIMEFRAMES above, and the two are
 * now separate choices because the data finally supports it. This is how often
 * the agent looks; timeframe is the resolution of what it looks at.
 *
 * The pairing that makes sense is cadence == timeframe: one new bar per cycle.
 * Faster re-reads a bar that has not changed and pays for an LLM call to reach
 * the same conclusion; slower steps over bars without ever seeing them.
 *
 * The 5-minute floor is the sweep cron's own period — anything faster is a
 * promise the scheduler cannot keep.
 */
export const CADENCES: { sec: number; label: string; detail: string }[] = [
  { sec: 300, label: "5 min", detail: "Fastest stops. ~288 model calls a day." },
  { sec: 900, label: "15 min", detail: "Reacts within the session. ~96 a day." },
  { sec: 3600, label: "1 hour", detail: "The default. ~24 a day." },
  { sec: 14_400, label: "4 hours", detail: "Quiet. ~6 a day." },
  { sec: 86_400, label: "1 day", detail: "One cycle a day." },
];

/** The cadence that gives exactly one new bar per cycle. */
export const CADENCE_FOR_TIMEFRAME: Record<Timeframe, number> = {
  "1d": 86_400,
  "1h": 3600,
  "30m": 1800,
  "15m": 900,
  "5m": 300,
};

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
  { name: "Technical", detail: "RSI, trend, distance from high — daily", via: "Wintel", ready: true },
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
  cadenceSec,
  onCadence,
  timeframe = DEFAULT_TIMEFRAME,
  onTimeframe,
}: {
  rules: RuleSpec[];
  onChange: (next: RuleSpec[]) => void;
  template: string | null;
  onTemplate: (key: string) => void;
  exits: ExitRules;
  onExits: (next: ExitRules) => void;
  cadenceSec: number;
  onCadence: (sec: number) => void;
  timeframe?: Timeframe;
  onTimeframe?: (tf: Timeframe) => void;
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
              {ruleLabel(r, timeframe)} {r.op === "gte" ? "≥" : "≤"} {fmt(r.value, r.unit)}
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
                label={ruleLabel(r, timeframe)}
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

      {onTimeframe ? (
        <section>
          <StepHead
            index="04"
            title="Chart timeframe"
            note="The bar size every rule above is measured on."
          />
          <PillRow>
            {TIMEFRAMES.map((t) => (
              <Pill
                key={t.tf}
                active={timeframe === t.tf}
                onClick={() => {
                  onTimeframe(t.tf);
                  // Move cadence with it. Leaving a 1-day cadence on a
                  // 5-minute chart reads every 288th bar and ignores the rest,
                  // which is not a thing anyone picks on purpose — and the
                  // pairing is still editable in the next step.
                  onCadence(CADENCE_FOR_TIMEFRAME[t.tf]);
                }}
              >
                {t.label}
              </Pill>
            ))}
          </PillRow>
          <p className="max-w-[64ch] pt-4 font-ui text-[12.5px] leading-relaxed text-text-secondary">
            {TIMEFRAMES.find((t) => t.tf === timeframe)?.detail}{" "}
            <span className="text-text-dim">
              This changes what your rules mean, not just how often they run. RSI 14 is a
              fortnight of selling on daily bars and about three hours on 15-minute ones — the
              labels above update to match. Volatility, change on the day and event severity
              stay daily whatever you pick here.
            </span>
          </p>
        </section>
      ) : null}

      <section>
        <StepHead
          index={onTimeframe ? "05" : "04"}
          title="Cycle"
          note="How often it wakes — not the chart timeframe."
        />
        <PillRow>
          {CADENCES.map((c) => (
            <Pill key={c.sec} active={cadenceSec === c.sec} onClick={() => onCadence(c.sec)}>
              {c.label}
            </Pill>
          ))}
        </PillRow>
        <p className="max-w-[64ch] pt-4 font-ui text-[12.5px] leading-relaxed text-text-secondary">
          {CADENCES.find((c) => c.sec === cadenceSec)?.detail}{" "}
          <span className="text-text-dim">
            {cadenceSec === CADENCE_FOR_TIMEFRAME[timeframe]
              ? "Matched to your timeframe — one new bar each cycle."
              : cadenceSec < CADENCE_FOR_TIMEFRAME[timeframe]
                ? "Faster than your timeframe: some cycles re-read a bar that has not changed yet, and pay for a model call to reach the same answer. What it does buy is tighter stops, since exits are checked every cycle."
                : "Slower than your timeframe: the agent will step over bars without ever seeing them. Deliberate if you want to sample a fast chart slowly."}
          </span>
        </p>
      </section>

      <section>
        <StepHead index={onTimeframe ? "06" : "05"} title="Signal sources" note="What these rules draw on today." />
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

/* ------------------------------------------------------------ accumulation -- */

/**
 * Buying more of something the agent already holds.
 *
 * OFF BY DEFAULT, AND THE DEFAULT IS THE PRODUCT DECISION.
 *
 * Every strategy that exists buys once per asset. Accumulation is a different
 * shape of strategy, not a setting to nudge, so the card starts collapsed with
 * one switch — and turning it on says plainly what it changes about the exits
 * above, because that is the part nobody expects.
 */
export type AddTrigger =
  | { kind: "schedule"; everySec: number }
  | { kind: "drawdown"; pct: number }
  | { kind: "gain"; pct: number };

export type AddSizing =
  | { kind: "fixedUsd"; usd: number }
  | { kind: "pctOfCapital"; pct: number }
  | { kind: "ladder"; baseUsd: number; factor: number };

export interface AddPlanShape {
  mode: "all" | "any";
  triggers: AddTrigger[];
  sizing: AddSizing;
  maxAdds?: number;
  maxTotalUsd?: number;
  minSpacingSec?: number;
}

const SPACINGS: { sec: number; label: string }[] = [
  { sec: 3600, label: "1 hour" },
  { sec: 86_400, label: "1 day" },
  { sec: 604_800, label: "1 week" },
  { sec: 2_592_000, label: "1 month" },
];

/** A starting plan that is coherent on its own — weekly, fixed, bounded. */
const DEFAULT_ADD_PLAN: AddPlanShape = {
  mode: "all",
  triggers: [{ kind: "schedule", everySec: 604_800 }],
  sizing: { kind: "fixedUsd", usd: 100 },
  maxAdds: 10,
  minSpacingSec: 86_400,
};

/**
 * The same coherence checks the backend runs, so the author sees them while
 * editing rather than after submitting.
 *
 * Deliberately duplicated rather than fetched: a warning that needs a round
 * trip does not appear while someone is dragging a slider, which is exactly
 * when it is useful. The backend remains the authority and warns again on
 * create — this copy existing does not make that one optional.
 */
export function localAddPlanWarnings(
  plan: AddPlanShape | undefined,
  exits: ExitRules,
): string[] {
  if (!plan) return [];
  const out: string[] = [];
  const stop = Math.abs(exits.stopLossPct);
  const target = Math.abs(exits.takeProfitPct);

  for (const t of plan.triggers) {
    if (t.kind === "drawdown" && t.pct >= stop) {
      out.push(
        `Adding at −${t.pct}% will rarely fire: the ${stop}% stop closes the position first.`,
      );
    } else if (t.kind === "drawdown" && stop - t.pct <= 3) {
      out.push(
        `Adding at −${t.pct}% leaves only ${(stop - t.pct).toFixed(0)} points before the ${stop}% stop — expect to buy, then be stopped out of the bigger position.`,
      );
    }
    if (t.kind === "gain" && t.pct >= target) {
      out.push(`Adding at +${t.pct}% will rarely fire: the ${target}% target sells first.`);
    }
  }

  const first =
    plan.sizing.kind === "fixedUsd"
      ? plan.sizing.usd
      : plan.sizing.kind === "ladder"
        ? plan.sizing.baseUsd
        : null;
  if (plan.maxTotalUsd !== undefined && first !== null && plan.maxTotalUsd < first) {
    out.push(
      `A $${plan.maxTotalUsd} ceiling is smaller than the $${first} first add, so this plan can never buy.`,
    );
  }
  if (plan.sizing.kind === "ladder" && plan.sizing.factor > 1 && plan.maxAdds === undefined) {
    out.push("A doubling ladder with no limit on adds compounds fast. Set a maximum.");
  }
  return out;
}

export function AddPlanCard({
  plan,
  exits,
  onChange,
}: {
  plan?: AddPlanShape;
  exits: ExitRules;
  onChange: (next: AddPlanShape | undefined) => void;
}) {
  const on = !!plan;
  const warnings = localAddPlanWarnings(plan, exits);

  const setTrigger = (t: AddTrigger) =>
    onChange(plan ? { ...plan, triggers: [t] } : { ...DEFAULT_ADD_PLAN, triggers: [t] });
  const setSizing = (sizing: AddSizing) => plan && onChange({ ...plan, sizing });

  const trigger = plan?.triggers[0];

  return (
    <section>
      <StepHead
        index="04"
        title="Accumulation"
        note="Buying more of what it already holds. Off by default."
      />

      <button
        type="button"
        onClick={() => onChange(on ? undefined : DEFAULT_ADD_PLAN)}
        aria-pressed={on}
        className={`h-8 rounded-full border px-3 font-mono text-[10px] tracking-[0.08em] uppercase transition-colors ${
          on ? "border-accent text-accent" : "border-grid text-text-muted hover:text-text-secondary"
        }`}
      >
        {on ? "Accumulating" : "One entry per asset"}
      </button>

      {!on ? (
        <p className="max-w-[64ch] pt-3 font-ui text-[12.5px] leading-relaxed text-text-secondary">
          The agent buys once and then manages that position. Turn this on to average in — on a
          schedule, on dips, or on strength.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          <p className="max-w-[64ch] font-ui text-[12.5px] leading-relaxed text-warning">
            Your take profit and stop loss now measure the BLEND of everything you have bought,
            not each entry separately. A position averaged down three times exits as one.
          </p>

          <div>
            <p className="pb-2 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
              When to add
            </p>
            <PillRow>
              <Pill
                active={trigger?.kind === "schedule"}
                onClick={() => setTrigger({ kind: "schedule", everySec: 604_800 })}
              >
                On a schedule
              </Pill>
              <Pill
                active={trigger?.kind === "drawdown"}
                onClick={() => setTrigger({ kind: "drawdown", pct: 5 })}
              >
                When it falls
              </Pill>
              <Pill
                active={trigger?.kind === "gain"}
                onClick={() => setTrigger({ kind: "gain", pct: 5 })}
              >
                When it rises
              </Pill>
            </PillRow>

            {trigger?.kind === "schedule" ? (
              <PillRow>
                {SPACINGS.map((sp) => (
                  <Pill
                    key={sp.sec}
                    active={trigger.everySec === sp.sec}
                    onClick={() => setTrigger({ kind: "schedule", everySec: sp.sec })}
                  >
                    Every {sp.label}
                  </Pill>
                ))}
              </PillRow>
            ) : trigger ? (
              <Slider
                label={trigger.kind === "drawdown" ? "Falls by" : "Rises by"}
                help={
                  trigger.kind === "drawdown"
                    ? "Measured from your average cost, not from the last entry."
                    : "Adding to a winner. Measured from your average cost."
                }
                value={trigger.pct}
                min={1}
                max={90}
                step={1}
                display={`${trigger.kind === "drawdown" ? "−" : "+"}${trigger.pct}%`}
                onChange={(v) => setTrigger({ ...trigger, pct: v })}
              />
            ) : null}
          </div>

          <div>
            <p className="pb-2 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
              How much
            </p>
            <PillRow>
              <Pill
                active={plan!.sizing.kind === "fixedUsd"}
                onClick={() => setSizing({ kind: "fixedUsd", usd: 100 })}
              >
                Fixed amount
              </Pill>
              <Pill
                active={plan!.sizing.kind === "pctOfCapital"}
                onClick={() => setSizing({ kind: "pctOfCapital", pct: 5 })}
              >
                Share of capital
              </Pill>
              <Pill
                active={plan!.sizing.kind === "ladder"}
                onClick={() => setSizing({ kind: "ladder", baseUsd: 100, factor: 1.5 })}
              >
                Growing ladder
              </Pill>
            </PillRow>

            {plan!.sizing.kind === "fixedUsd" ? (
              <Slider
                label="Each add"
                help="The same amount every time."
                value={plan!.sizing.usd}
                min={10}
                max={5_000}
                step={10}
                display={`$${plan!.sizing.usd.toLocaleString("en-US")}`}
                onChange={(v) => setSizing({ kind: "fixedUsd", usd: v })}
              />
            ) : plan!.sizing.kind === "pctOfCapital" ? (
              <Slider
                label="Each add"
                help="A share of the capital this agent was given."
                value={plan!.sizing.pct}
                min={1}
                max={50}
                step={1}
                display={`${plan!.sizing.pct}%`}
                onChange={(v) => setSizing({ kind: "pctOfCapital", pct: v })}
              />
            ) : (
              <>
                <Slider
                  label="First add"
                  help="Where the ladder starts."
                  value={plan!.sizing.baseUsd}
                  min={10}
                  max={2_000}
                  step={10}
                  display={`$${plan!.sizing.baseUsd.toLocaleString("en-US")}`}
                  onChange={(v) =>
                    setSizing({ ...(plan!.sizing as { kind: "ladder"; factor: number }), kind: "ladder", baseUsd: v })
                  }
                />
                <Slider
                  label="Each add grows by"
                  help="Compounds. A 2x ladder makes the tenth add 512 times the first."
                  value={(plan!.sizing as { factor: number }).factor}
                  min={1}
                  max={3}
                  step={0.1}
                  display={`${(plan!.sizing as { factor: number }).factor.toFixed(1)}x`}
                  onChange={(v) =>
                    setSizing({ ...(plan!.sizing as { kind: "ladder"; baseUsd: number }), kind: "ladder", factor: v })
                  }
                />
              </>
            )}
          </div>

          <div>
            <p className="pb-2 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
              Where it stops
            </p>
            <Slider
              label="Most adds"
              help="Per position. The count resets when the position closes."
              value={plan!.maxAdds ?? 10}
              min={1}
              max={100}
              step={1}
              display={`${plan!.maxAdds ?? 10}`}
              onChange={(v) => onChange({ ...plan!, maxAdds: v })}
            />
            <Slider
              label="Wait at least"
              help="A floor between adds, whatever the condition above says."
              value={plan!.minSpacingSec ?? 86_400}
              min={300}
              max={2_592_000}
              step={300}
              display={
                SPACINGS.find((sp) => sp.sec === (plan!.minSpacingSec ?? 86_400))?.label ??
                `${Math.round((plan!.minSpacingSec ?? 86_400) / 3600)}h`
              }
              onChange={(v) => onChange({ ...plan!, minSpacingSec: v })}
            />
          </div>

          {warnings.length > 0 ? (
            <ul className="space-y-1 border-t border-grid pt-3">
              {warnings.map((w) => (
                <li key={w} className="font-ui text-[12px] leading-relaxed text-warning">
                  {w}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="max-w-[64ch] font-ui text-[12px] leading-relaxed text-text-dim">
            Every add goes through the same checks as a first purchase — position cap, compliance,
            safety screen. A plan cannot buy past a limit you set elsewhere.
          </p>
        </div>
      )}
    </section>
  );
}
