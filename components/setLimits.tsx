"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { composeAgent, type AddPlan, type ExitRules, type UniverseAsset } from "@/lib/api";
import {
  AddPlanCard,
  DEFAULT_TIMEFRAME,
  RWA_RULES,
  fmt,
  ruleBasisNote,
  ruleLabel,
  type RuleSpec,
  type Timeframe,
} from "@/components/buildStrategy";

/**
 * Step 2 — set the limits. Wireframe 1e.
 *
 * WRITE IT, COMPILE IT, THEN EDIT THE CHIPS.
 *
 * The important idea in the wireframe, and the answer to the complaint that
 * started this: a sentence is compiled into rules you can SEE and adjust in
 * place. The old flow read a description, filled two form pages somewhere else,
 * and never showed its working — so a complex request and a trivial one looked
 * identical afterwards.
 *
 * Nothing is inferred silently. Every chip below is a rule the specialist
 * actually evaluates, every value is one the server clamped into range, and
 * anything asked for that could not be honoured comes back as a note.
 */

export interface Limits {
  rules: RuleSpec[];
  exits: ExitRules;
  /**
   * Bar size the technical rules are measured on. Absent means daily, matching
   * every strategy authored before this was a choice.
   */
  timeframe?: Timeframe;
  /**
   * How the strategy accumulates. Absent means one entry per asset.
   *
   * Setting one changes what the exits above MEASURE: they stop describing a
   * single entry and start describing the blended position. The card says so.
   */
  addPlan?: AddPlan;
  /** Most the agent may put into one position, in dollars. */
  positionUsd: number;
  /** Ceiling on entries per cycle. */
  tradesPerCycle: number;
}

/** Verification capital. The budget is expressed against it. */
const CAPITAL_USD = 10_000;

export function SetLimits({
  market,
  value,
  onChange,
  onBack,
}: {
  market: UniverseAsset;
  value: Limits;
  onChange: (next: Limits) => void;
  onBack: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const [mode, setMode] = useState<"write" | "preset">("write");
  const [sentence, setSentence] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [reading, setReading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = value.rules.filter((r) => r.enabled !== false);

  async function compile() {
    const text = sentence.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in to compile a rule.");
      const { draft, notes: refused } = await composeAgent(
        token,
        // The market is named for it, so the sentence does not have to be.
        `Trading ${market.symbol} (${market.underlying}). ${text}`,
      );
      setNotes(refused);
      if (!draft) {
        setError(refused[0] ?? "That could not be turned into rules.");
        return;
      }
      setReading(draft.reading || null);
      onChange({
        ...value,
        // The composer may have read an accumulation plan out of the sentence.
        // Absent means the sentence did not ask for one — which must CLEAR any
        // previous plan rather than leave a stale one attached to rules that no
        // longer mention it.
        addPlan: draft.addPlan,
        // Only rules the compiler actually set are switched on. The rest stay
        // available but off, rather than silently applying a default nobody
        // asked for.
        rules: value.rules.map((r) => {
          const hit = draft.rules.find((d) => d.key === r.key);
          return hit ? { ...r, value: hit.value, enabled: true } : { ...r, enabled: false };
        }),
        exits: draft.exits,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const setRule = (key: string, patch: Partial<RuleSpec>) =>
    onChange({
      ...value,
      rules: value.rules.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    });

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <p className="font-mono text-[10px] tracking-[0.12em] text-text-dim uppercase">
          Step 2 of 2 · Assign
        </p>
        <h2 className="font-mono text-[22px] leading-none text-text-primary">Set your limits</h2>
        <p className="flex flex-wrap items-center gap-2 font-mono text-[12px] text-text-secondary">
          {market.symbol}/USDC ·{" "}
          {market.assetClass === "commodity" ? "Tokenized commodity" : "Tokenized equity"}
          <button
            type="button"
            onClick={onBack}
            className="font-mono text-[10.5px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-accent"
          >
            — change
          </button>
        </p>
      </div>

      {/* ------------------------------------------------------- write it */}
      <section>
        <div className="flex items-center justify-between pb-3">
          <h3 className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            Strategy · {market.symbol}
          </h3>
          <div className="flex items-center gap-0.5 rounded-full border border-grid p-1">
            {(["write", "preset"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`h-7 rounded-full px-3.5 font-mono text-[11px] transition-colors ${
                  mode === m ? "bg-accent-wash text-accent" : "text-text-dim hover:text-text-primary"
                }`}
              >
                {m === "write" ? "Write it" : "Preset"}
              </button>
            ))}
          </div>
        </div>

        {mode === "write" ? (
          <div className="border border-grid-strong">
            <textarea
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void compile();
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder={`e.g. buy ${market.symbol} when it is down 4% or more on the day and the pool is deep, take profit at 3%, stop out at 2%`}
              aria-label="Describe the rule"
              className="w-full resize-none bg-transparent px-4 py-3 font-ui text-[14px] leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
            />
            <div className="flex items-center justify-between gap-4 border-t border-grid px-4 py-2.5">
              <span className="font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
                {busy ? "Compiling…" : "⌘⏎ to compile"}
              </span>
              <button
                type="button"
                onClick={() => void compile()}
                disabled={busy || sentence.trim().length === 0}
                className="flex h-8 items-center border border-accent bg-accent-wash px-5 font-mono text-[10px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
              >
                Compile
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setSentence(p.prompt);
                  setMode("write");
                }}
                className="h-9 rounded-full border border-border px-4 font-mono text-[11.5px] text-text-secondary transition-colors hover:border-accent hover:text-accent"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {error ? (
          <p className="pt-2.5 font-ui text-[12.5px] leading-relaxed text-negative">{error}</p>
        ) : null}
      </section>

      {/* ---------------------------------------------------- read as */}
      <section>
        <h3 className="pb-3 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
          Read as — edit any rule
        </h3>

        {reading ? (
          <p className="max-w-[70ch] pb-3 font-ui text-[13px] leading-relaxed text-text-secondary">
            {reading}
          </p>
        ) : null}

        <div className="border border-grid">
          {value.rules.map((r) => (
            <RuleChip
              key={r.key}
              rule={r}
              timeframe={value.timeframe ?? DEFAULT_TIMEFRAME}
              onChange={(p) => setRule(r.key, p)}
            />
          ))}
          <ExitChip
            label="Take profit"
            value={value.exits.takeProfitPct}
            min={2}
            max={200}
            suffix="%"
            onChange={(n) => onChange({ ...value, exits: { ...value.exits, takeProfitPct: n } })}
          />
          <ExitChip
            label="Stop loss"
            value={value.exits.stopLossPct}
            min={1}
            max={90}
            suffix="%"
            onChange={(n) => onChange({ ...value, exits: { ...value.exits, stopLossPct: n } })}
          />
        </div>

        {notes.length > 0 ? (
          <ul className="space-y-0.5 pt-2.5">
            {notes.map((n) => (
              <li key={n} className="font-ui text-[12px] leading-relaxed text-warning">
                {n}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="max-w-[70ch] pt-3 font-ui text-[12.5px] leading-relaxed text-text-secondary">
          Nothing runs until you confirm these. Switch a rule off to stop it applying, or rewrite
          the sentence above and compile again. {active.length}{" "}
          {active.length === 1 ? "rule is" : "rules are"} active.
        </p>
      </section>

      {/* --------------------------------------------------- accumulation */}
      <AddPlanCard
        plan={value.addPlan}
        exits={value.exits}
        onChange={(addPlan) => onChange({ ...value, addPlan })}
      />

      {/* ------------------------------------------------------- budget */}
      <section>
        <h3 className="pb-3 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
          Budget for this market
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Position size limit"
            value={value.positionUsd}
            unit="USDC"
            min={100}
            max={CAPITAL_USD}
            step={100}
            help={`Most per trade on this market. Never exceeded. ${(
              (value.positionUsd / CAPITAL_USD) *
              100
            ).toFixed(0)}% of the ${money(CAPITAL_USD)} paper book.`}
            onChange={(n) => onChange({ ...value, positionUsd: n })}
          />
          <Field
            label="Max trades per cycle"
            value={value.tradesPerCycle}
            unit="trades"
            min={1}
            max={10}
            step={1}
            // Deliberately not "per day": the ceiling the engine enforces is
            // per cycle, and relabelling it would misstate what it does.
            help="Entries per wake-up. The agent never splits an order to get around it."
            onChange={(n) => onChange({ ...value, tradesPerCycle: n })}
          />
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------- bits -- */

const PRESETS = [
  {
    label: "Buy the dip",
    prompt: "Buy when it is down 4% or more on the day, take profit at 3%, stop out at 2%.",
  },
  {
    label: "Only when calm",
    prompt: "Only trade when volatility is low and nothing abnormal happened this week.",
  },
  {
    label: "Deep pools only",
    prompt: "Only trade when the pool is deep. Take profit steadily and keep a tight stop.",
  },
];

function RuleChip({
  rule: r,
  timeframe = DEFAULT_TIMEFRAME,
  onChange,
}: {
  rule: RuleSpec;
  timeframe?: Timeframe;
  onChange: (patch: Partial<RuleSpec>) => void;
}) {
  const on = r.enabled !== false;
  // Never r.label directly: at any non-daily timeframe the bare label omits the
  // one thing that decides what the number means.
  const label = ruleLabel(r, timeframe);
  const basisNote = ruleBasisNote(r, timeframe);
  return (
    <div className="grid gap-3 border-b border-grid px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_200px_92px_58px] lg:items-center lg:gap-5">
      <div className="min-w-0">
        <p className={`font-mono text-[12px] ${on ? "text-text-primary" : "text-text-muted"}`}>
          {label} <span className="text-text-dim">{r.op === "gte" ? "at least" : "at most"}</span>
        </p>
        <p className="pt-0.5 font-ui text-[11.5px] leading-relaxed text-text-dim">{r.help}</p>
        {basisNote ? (
          <p className="pt-0.5 font-ui text-[11px] leading-relaxed text-text-muted">{basisNote}</p>
        ) : null}
      </div>
      <input
        type="range"
        min={r.min}
        max={r.max}
        step={r.step}
        value={r.value}
        disabled={!on}
        onChange={(e) => onChange({ value: Number(e.target.value) })}
        aria-label={label}
        className="accent-accent disabled:opacity-40"
      />
      <span
        className={`tnum text-right font-mono text-[13px] ${on ? "text-accent" : "text-text-muted"}`}
      >
        {fmt(r.value, r.unit)}
      </span>
      <button
        type="button"
        onClick={() => onChange({ enabled: !on })}
        aria-pressed={on}
        className={`h-7 rounded-full border px-2.5 font-mono text-[9.5px] tracking-[0.08em] uppercase transition-colors ${
          on ? "border-accent text-accent" : "border-grid text-text-muted hover:text-text-secondary"
        }`}
      >
        {on ? "On" : "Off"}
      </button>
    </div>
  );
}

function ExitChip({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="grid gap-3 border-b border-grid px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_200px_92px_58px] lg:items-center lg:gap-5">
      <div className="min-w-0">
        <p className="font-mono text-[12px] text-text-primary">{label}</p>
        <p className="pt-0.5 font-ui text-[11.5px] leading-relaxed text-text-dim">
          {label === "Stop loss"
            ? "Closes without asking. A stop you can veto is not a stop."
            : "Closes the position once it is up this much."}
        </p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="accent-accent"
      />
      <span className="tnum text-right font-mono text-[13px] text-accent">
        {label === "Stop loss" ? "−" : "+"}
        {value}
        {suffix}
      </span>
      <span />
    </div>
  );
}

function Field({
  label,
  value,
  unit,
  min,
  max,
  step,
  help,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  help: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="border border-grid p-4">
      <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">{label}</p>
      <div className="flex items-baseline gap-2 pt-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            // Clamped on the way in: a budget above the book is not a budget.
            if (Number.isFinite(n)) onChange(Math.min(Math.max(n, min), max));
          }}
          aria-label={label}
          className="tnum w-[120px] border-b border-grid-strong bg-transparent pb-1 font-mono text-[19px] text-text-primary outline-none focus:border-accent"
        />
        <span className="font-mono text-[11px] tracking-[0.08em] text-text-dim uppercase">
          {unit}
        </span>
      </div>
      <p className="pt-2.5 font-ui text-[11.5px] leading-relaxed text-text-dim">{help}</p>
    </div>
  );
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export { CAPITAL_USD, RWA_RULES };
