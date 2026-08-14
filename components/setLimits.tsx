"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  composeAgent,
  type AddPlan,
  type RankingSpec,
  type ComplianceProfile,
  type ExitRules,
  type UniverseAsset,
} from "@/lib/api";
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
  /**
   * Which compliance screen the agent runs.
   *
   * Absent means the author never chose, which defers to the server default —
   * NOT "none". The distinction matters: a strategy built before this was a
   * choice must keep behaving exactly as it did.
   */
  complianceProfile?: ComplianceProfile;
  /**
   * Keep only the best N of whatever passes the rules.
   *
   * Absent means keep all, which is how every strategy behaved before this
   * existed — and is the right default for a single-market strategy, where
   * there is nothing to rank against.
   */
  ranking?: RankingSpec;
}

/** Verification capital. The budget is expressed against it. */
const CAPITAL_USD = 10_000;

/**
 * Smallest position the builder will set, and the step it moves in.
 *
 * Not $1: a trade that small is mostly fees on any pool, so offering it would be
 * offering something that cannot fill well. Not $100 either — that was the old
 * floor, and it silently multiplied "$10 each trade" by ten.
 */
const MIN_POSITION_USD = 10;

export function SetLimits({
  markets,
  value,
  onChange,
  onBack,
}: {
  /**
   * Every market the strategy will screen, sharing one class.
   *
   * The first is the representative for anything that needs a single example —
   * the heading, the placeholder. The composer is told about ALL of them,
   * because a strategy screening three assets and told it trades one will
   * happily write a rule that only makes sense for the one.
   */
  markets: UniverseAsset[];
  value: Limits;
  onChange: (next: Limits) => void;
  onBack: () => void;
}) {
  const market = markets[0];
  const { getAccessToken } = usePrivy();
  const [mode, setMode] = useState<"write" | "preset">("write");
  const [sentence, setSentence] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [reading, setReading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The exchange so far, oldest first. Rendered above the input. */
  const [turns, setTurns] = useState<Turn[]>([]);
  /**
   * Everything the author has said, in order.
   *
   * The compose endpoint is single-shot — it reads a description and returns a
   * draft, with no memory of what came before. So a follow-up answer is not
   * sent on its own: the whole spec is re-sent as one description each time,
   * which is what lets "and stop out at 3%" refine a strategy instead of
   * replacing it with a strategy that is only a stop.
   */
  const [spec, setSpec] = useState<string[]>([]);

  const active = value.rules.filter((r) => r.enabled !== false);
  /**
   * Whether the rules editor is on the page.
   *
   * An active rule means a sentence compiled into something — or that the
   * reader came back to this step with a strategy already set — so there is a
   * reading to show. `manualRules` is the escape hatch for someone who would
   * rather not write a sentence at all: the capability is unchanged, it just is
   * not what the step opens on.
   *
   * Preset always shows it. The two halves of the toggle are not the same kind
   * of thing: Write it is one sentence to compose, and a wall of Off switches
   * under it drowns that out — while Preset is picking from known sets of
   * values, which is a question you cannot answer without seeing them.
   */
  const [manualRules, setManualRules] = useState(false);
  const showRules = active.length > 0 || manualRules || mode === "preset";

  // Recomputed on every render rather than stored: the author can edit a rule
  // or a budget field by hand at any time, and a checklist that only refreshed
  // on a chat turn would go on reporting a gap the sliders had already closed.
  const reqs = requirements(value, spec.join(" "));
  const gap = reqs.find((r) => r.state !== "met");

  /**
   * One turn of the exchange: say something, get the strategy back as it now
   * stands, and get asked for whatever the executor still cannot infer.
   *
   * The asking is deliberately NOT the model's job. The compiler returns a
   * draft; what a trade actually requires — an entry condition, a target, a
   * stop, a size — is a fixed list this file knows, so the follow-up question
   * is derived from the draft rather than generated. That means the questions
   * cannot drift, cannot ask for something the engine does not use, and cannot
   * claim the strategy is ready when a required field is still a default.
   */
  async function send(text: string) {
    const said = text.trim();
    if (!said || busy) return;

    const nextSpec = [...spec, said];
    setSpec(nextSpec);
    setSentence("");
    setTurns((t) => [...t, { role: "you", text: said }]);
    setBusy(true);
    setError(null);

    // Sizing never reaches the compiler — /agents/compose returns rules and
    // exits, not a budget — so a stated size is read here and applied
    // directly. Without this, answering "put $1,000 in per trade" would be
    // silently dropped and the executor's own question would repeat.
    const sized = readSizing(said, value);
    let next: Limits = sized ?? value;

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in to compile a rule.");
      const { draft, notes: refused } = await composeAgent(
        token,
        // The market is named for it, so the sentence does not have to be. The
        // underlying is only named when there is one — a token has none, and
        // "(undefined)" reads as a bug to the model as much as to a person.
        // Every market named, not just the first. The rules apply to all of
        // them, and a composer that believes it is writing for one asset will
        // reach for facts only that asset has.
        `Trading ${markets
          .map((m) => `${m.symbol}${m.underlying ? ` (${m.underlying})` : ""}`)
          .join(", ")}. ` +
          nextSpec.join(" "),
      );
      setNotes(refused);

      if (!draft) {
        const why = refused[0] ?? "That could not be turned into rules.";
        setError(why);
        setTurns((t) => [
          ...t,
          { role: "agent", text: why, tone: "note" },
          {
            role: "agent",
            text: "Say it in terms of a condition I can measure — a move on the day, a level, a depth of pool.",
            tone: "ask",
          },
        ]);
        return;
      }

      setReading(draft.reading || null);
      next = {
        ...next,
        timeframe: draft.timeframe ?? next.timeframe,
        // The composer may have read an accumulation plan out of the sentence.
        // Absent means the sentence did not ask for one — which must CLEAR any
        // previous plan rather than leave a stale one attached to rules that no
        // longer mention it.
        addPlan: draft.addPlan,
        // Only rules the compiler actually set are switched on. The rest stay
        // available but off, rather than silently applying a default nobody
        // asked for.
        rules: next.rules.map((r) => {
          const hit = draft.rules.find((d) => d.key === r.key);
          return hit ? { ...r, value: hit.value, enabled: true } : { ...r, enabled: false };
        }),
        exits: draft.exits,
      };
      onChange(next);

      // Read the gaps off what we just built, not off `value` — the parent's
      // state has not come back down yet, and asking about the previous draft
      // is how a chat ends up requesting something you just gave it.
      const reqs = requirements(next, nextSpec.join(" "));
      const gap = reqs.find((r) => r.state !== "met");

      setTurns((t) => [
        ...t,
        ...(draft.reading ? [{ role: "agent" as const, text: draft.reading }] : []),
        ...refused.map((n) => ({ role: "agent" as const, text: n, tone: "note" as const })),
        gap?.ask
          ? { role: "agent" as const, text: gap.ask, tone: "ask" as const }
          : {
              role: "agent" as const,
              text: "That is enough to trade on — entry, target, stop and size are all set. Adjust anything below, or carry on to the route.",
              tone: "ready" as const,
            },
      ]);
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err);
      setError(why);
      setTurns((t) => [...t, { role: "agent", text: why, tone: "note" }]);
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
          {markets.length === 1 ? `${market.symbol}/USDC` : `${markets.length} markets`} ·{" "}
          {market.kind === "crypto"
            ? "Crypto"
            : market.assetClass === "commodity"
              ? "Tokenized commodity"
              : "Tokenized equity"}
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
            Strategy · {markets.length === 1 ? market.symbol : `${markets.length} markets`}
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
          <>
            <div className="border border-grid-strong">
              {turns.length > 0 ? (
                <ol className="max-h-[300px] overflow-y-auto border-b border-grid">
                  {turns.map((t, i) => (
                    <TurnRow key={i} turn={t} />
                  ))}
                  {busy ? (
                    <li className="px-4 py-2.5">
                      <p className="font-mono text-[9.5px] tracking-[0.12em] text-text-muted uppercase">
                        Reading it…
                      </p>
                    </li>
                  ) : null}
                </ol>
              ) : null}

              <textarea
                value={sentence}
                onChange={(e) => setSentence(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void send(sentence);
                  }
                }}
                rows={2}
                maxLength={2000}
                placeholder={
                  turns.length === 0
                    ? `e.g. buy ${market.symbol} when it is down 4% or more on the day and the pool is deep, take profit at 3%, stop out at 2%`
                    : "Answer, or add anything else it should know…"
                }
                aria-label="Describe the rule"
                className="w-full resize-none bg-transparent px-4 py-3 font-ui text-[14px] leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
              />
              <div className="flex items-center justify-between gap-4 border-t border-grid px-4 py-2.5">
                <span className="font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
                  {busy ? "Compiling…" : "⌘⏎ to send"}
                </span>
                <button
                  type="button"
                  onClick={() => void send(sentence)}
                  disabled={busy || sentence.trim().length === 0}
                  className="flex h-8 items-center border border-accent bg-accent-wash px-5 font-mono text-[10px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
                >
                  {turns.length === 0 ? "Compile" : "Send"}
                </button>
              </div>
            </div>

            {/* One tap for the question just asked. The chips are sentences,
                not values, because they are sent as the author's own words and
                compiled the same way anything typed here would be — a chip
                that set a field directly would be a different mechanism
                wearing the same clothes. */}
            {gap?.chips && !busy ? (
              <div className="flex flex-wrap gap-2 pt-3">
                {gap.chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => void send(c)}
                    className="h-8 rounded-full border border-border px-3.5 font-ui text-[12px] text-text-secondary transition-colors hover:border-accent hover:text-accent"
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}

            {/* What the executor needs, and where each of those stands. Shown
                from the first turn onwards: before that it is a list of things
                nobody has been asked for yet, which reads as a form. */}
            {turns.length > 0 ? <Checklist reqs={reqs} /> : null}
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                // Sent, not typed into the box: a preset IS a first message,
                // and dropping the author back at a full input with a Compile
                // button still to press made picking one feel like it had not
                // worked.
                onClick={() => {
                  setMode("write");
                  void send(p.prompt);
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

        {/* Before a compile there is nothing to read back, so this step is the
            sentence and nothing else. The eleven rules used to render below
            regardless — every one switched Off, and identical under both halves
            of the toggle — which read as a form to fill in by hand and buried
            the one thing the step actually asks for.

            Setting them by hand is still allowed; it is just no longer what the
            page opens on. */}
        {showRules ? null : (
          <p className="max-w-[70ch] pt-3 font-ui text-[12.5px] leading-relaxed text-text-secondary">
            The rules appear here once you compile — every one of them editable before anything
            runs. Or{" "}
            <button
              type="button"
              onClick={() => setManualRules(true)}
              className="text-accent underline underline-offset-2 transition-opacity hover:opacity-80"
            >
              set them by hand
            </button>
            .
          </p>
        )}
      </section>

      {/* ---------------------------------------------------- read as */}
      {showRules ? (
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
            {/* The ceiling is the strategy route's, not the composer's.
                /agents/compose clamps a target to 200% (compose.ts's
                takeProfitPct range), but that is a bound on what a SENTENCE may
                be read as — the endpoint that stores a strategy asks only for
                takeProfitPct > 0. Copying the composer's ceiling onto the field
                meant a target typed by hand was refused for a reason that
                applied to a different path.

                One consequence to know: a target above 200% has to be typed.
                Ask for it in the sentence and the composer will still hand back
                200, because that clamp lives in canopy-be. */}
            <ExitChip
              label="Take profit"
              value={value.exits.takeProfitPct}
              min={2}
              max={1000}
              suffix="%"
              resumeAt={45}
              onChange={(n) => onChange({ ...value, exits: { ...value.exits, takeProfitPct: n } })}
            />
            <ExitChip
              label="Stop loss"
              value={value.exits.stopLossPct}
              min={1}
              max={90}
              suffix="%"
              resumeAt={20}
              onChange={(n) => onChange({ ...value, exits: { ...value.exits, stopLossPct: n } })}
            />
            {/* Both default to OFF, unlike the two above. A trailing stop nobody
                asked for closes positions its author meant to keep, so these
                are opt-in rather than a level to adjust. */}
            <ExitChip
              label="Trailing stop"
              value={value.exits.trailingStopPct ?? 0}
              min={1}
              max={90}
              suffix="%"
              resumeAt={12}
              onChange={(n) =>
                onChange({ ...value, exits: { ...value.exits, trailingStopPct: n } })
              }
            />
            <ExitChip
              label="Break-even at"
              value={value.exits.breakevenAfterPct ?? 0}
              min={1}
              max={200}
              suffix="%"
              resumeAt={5}
              onChange={(n) =>
                onChange({ ...value, exits: { ...value.exits, breakevenAfterPct: n } })
              }
            />
            <ScaleOutLadder
              rungs={value.exits.scaleOut ?? []}
              onChange={(next) =>
                onChange({
                  ...value,
                  exits: { ...value.exits, scaleOut: next.length > 0 ? next : undefined },
                })
              }
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
            Nothing runs until you confirm these. Switch a rule off to stop it applying, or
            rewrite the sentence above and compile again. {active.length}{" "}
            {active.length === 1 ? "rule is" : "rules are"} active.
          </p>
        </section>
      ) : null}

      {/* --------------------------------------------------- accumulation */}
      {/* Held back for the same reason: how a position accumulates is a
          refinement of an entry, and it changes what the exits MEASURE. Both
          are meaningless beside a strategy that has not been written yet. */}
      {showRules ? (
        <AddPlanCard
          plan={value.addPlan}
          exits={value.exits}
          onChange={(addPlan) => onChange({ ...value, addPlan })}
        />
      ) : null}

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
            min={MIN_POSITION_USD}
            max={CAPITAL_USD}
            step={MIN_POSITION_USD}
            help={`Most per trade, per market. Never exceeded. ${(
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

      {/* ------------------------------------------------------ ranking */}
      {/*
        Only when there is something to rank. A top-3 of one market is that
        market, so offering the control on a single-asset strategy would be
        offering a setting that cannot do anything — the same reason ATR is
        hidden for tokenized stocks.
      */}
      {markets.length > 1 ? (
        <section>
          <h3 className="pb-3 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            How many to hold
          </h3>
          <RankingControl
            markets={markets.length}
            value={value.ranking}
            onChange={(ranking) => onChange({ ...value, ranking })}
          />
        </section>
      ) : null}

      {/* --------------------------------------------------- compliance */}
      {/*
        Only for tokenized real-world assets. The screen reads a filer's balance
        sheet and its revenue mix, and an SPL token has neither — offering the
        choice on a crypto strategy would be offering a setting that cannot do
        anything.
      */}
      {market.kind !== "crypto" ? (
        <section>
          <h3 className="pb-3 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            Compliance screen
          </h3>
          <div className="flex flex-wrap gap-2">
            {COMPLIANCE_CHOICES.map((choice) => {
              const active = (value.complianceProfile ?? "none") === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ ...value, complianceProfile: choice.id })}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-accent bg-accent/10 text-text"
                      : "border-line text-text-dim hover:border-line-bright hover:text-text"
                  }`}
                >
                  <span className="block font-mono text-[11px] tracking-[0.08em] uppercase">
                    {choice.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-text-dim">
                    {choice.help}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="pt-2 text-[11px] leading-snug text-text-dim">
            {/*
              Stated plainly because it is a universe change, not a preference.
              Someone who picks a screen and then cannot find an asset they
              expected deserves to have been told why in advance.
            */}
            A screen narrows what the agent may hold. It is applied before the
            analyst sees anything, so a filtered asset never appears in a cycle.
          </p>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Keep only the best N of whatever passed the rules.
 *
 * Off by default and deliberately so. Ranking narrows what the agent may buy,
 * and a narrowing nobody asked for is the kind of setting people discover months
 * later while wondering why two of their markets never trade.
 */
function RankingControl({
  markets,
  value,
  onChange,
}: {
  markets: number;
  value?: RankingSpec;
  onChange: (next: RankingSpec | undefined) => void;
}) {
  const on = !!value;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={!on}
          onClick={() => onChange(undefined)}
          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
            !on ? "border-accent bg-accent/10 text-text" : "border-line text-text-dim hover:text-text"
          }`}
        >
          <span className="block font-mono text-[11px] tracking-[0.08em] uppercase">
            All of them
          </span>
          <span className="mt-1 block text-[11px] text-text-dim">
            Buy anything that passes the rules.
          </span>
        </button>
        <button
          type="button"
          aria-pressed={on}
          onClick={() =>
            onChange(value ?? { by: "momentum20dPct", take: Math.min(3, markets), prefer: "highest" })
          }
          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
            on ? "border-accent bg-accent/10 text-text" : "border-line text-text-dim hover:text-text"
          }`}
        >
          <span className="block font-mono text-[11px] tracking-[0.08em] uppercase">
            Only the best
          </span>
          <span className="mt-1 block text-[11px] text-text-dim">
            Rank what passes, act on the top few.
          </span>
        </button>
      </div>

      {value ? (
        <div className="flex flex-wrap items-center gap-2 font-mono text-[12px]">
          <span className="text-text-dim">Hold the best</span>
          <input
            type="number"
            min={1}
            max={Math.max(1, markets)}
            value={value.take}
            onChange={(e) =>
              onChange({ ...value, take: Math.max(1, Math.min(markets, Number(e.target.value))) })
            }
            className="w-16 border border-line bg-transparent px-2 py-1 text-right text-text-primary"
            aria-label="How many to hold"
          />
          <span className="text-text-dim">of {markets}, by</span>
          <select
            value={`${value.by}:${value.prefer}`}
            onChange={(e) => {
              const [by, prefer] = e.target.value.split(":");
              onChange({ ...value, by, prefer: prefer as "highest" | "lowest" });
            }}
            className="border border-line bg-transparent px-2 py-1 text-text-primary"
            aria-label="Rank by"
          >
            {/* Each option names the DIRECTION as well as the measure, because
                both ends are wanted and neither is a sensible default. */}
            <option value="momentum20dPct:highest">strongest recent return</option>
            <option value="momentum20dPct:lowest">weakest recent return</option>
            <option value="rsi14:lowest">most oversold</option>
            <option value="liquidityUsd:highest">deepest pool</option>
            <option value="dailyVolPct:lowest">calmest</option>
          </select>
        </div>
      ) : null}

      <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">
        Ranking runs after your rules, never instead of them — a market that fails a rule is never
        ranked back in. Anything left out is named in the cycle log, so a market that never trades
        is never a mystery.
      </p>
    </div>
  );
}

/**
 * The compliance screens on offer.
 *
 * "None" is first and is the default. Shariah screening removes conventional
 * financials and over-leveraged balance sheets from the universe outright, so
 * it is a decision the author makes deliberately rather than a box they find
 * already ticked.
 */
/**
 * The partial-profit ladder.
 *
 * NOT AN ExitChip, because a ladder is a list rather than a level. Each rung is
 * a pair — how much, and at what gain — and they fire in order, once each. The
 * chips above are single numbers and squeezing a sequence into one would hide
 * the thing that makes it a ladder.
 *
 * The remainder is shown as its own row and cannot be edited. It is not a
 * setting; it is whatever the rungs leave behind, and showing it as a
 * consequence rather than a field is what makes "and let the rest ride" legible.
 */
function ScaleOutLadder({
  rungs,
  onChange,
}: {
  rungs: { atPct: number; fraction: number }[];
  onChange: (next: { atPct: number; fraction: number }[]) => void;
}) {
  const sold = rungs.reduce((sum, r) => sum + r.fraction, 0);
  const left = Math.max(0, 1 - sold);

  const setRung = (i: number, patch: Partial<{ atPct: number; fraction: number }>) =>
    onChange(rungs.map((r, n) => (n === i ? { ...r, ...patch } : r)));

  const add = () => {
    // Above the last rung, because they fire in ascending order — a new step
    // below an existing one would never be reached.
    const last = rungs[rungs.length - 1];
    const atPct = last ? last.atPct + 15 : 15;
    // Never propose a ladder that leaves nothing: the engine refuses it, and a
    // control that can build a refused state is a control that lies.
    const fraction = Math.min(0.25, Math.max(0.05, left - 0.05));
    if (fraction <= 0) return;
    onChange([...rungs, { atPct, fraction }]);
  };

  return (
    <div className="border-b border-grid px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[12px] text-text-primary">Take profit in steps</p>
          <p className="pt-0.5 font-ui text-[11.5px] leading-relaxed text-text-dim">
            {rungs.length === 0
              ? "Off — the position closes in one go."
              : "Each step sells part of the position once, then the rest keeps running."}
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={left <= 0.05}
          className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase transition-colors hover:text-text-primary disabled:opacity-30"
        >
          + Add step
        </button>
      </div>

      {rungs.length > 0 ? (
        <ul className="space-y-2 pt-3">
          {rungs.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 font-mono text-[12px]">
              <span className="text-text-dim">Sell</span>
              <input
                type="number"
                min={1}
                max={95}
                value={Math.round(r.fraction * 100)}
                onChange={(e) =>
                  setRung(i, { fraction: Math.min(0.95, Math.max(0.01, Number(e.target.value) / 100)) })
                }
                className="w-16 border border-line bg-transparent px-2 py-1 text-right text-text-primary"
                aria-label={`Step ${i + 1} size in percent`}
              />
              <span className="text-text-dim">% at</span>
              <input
                type="number"
                min={1}
                max={1000}
                value={r.atPct}
                onChange={(e) => setRung(i, { atPct: Math.max(1, Number(e.target.value)) })}
                className="w-20 border border-line bg-transparent px-2 py-1 text-right text-text-primary"
                aria-label={`Step ${i + 1} gain in percent`}
              />
              <span className="text-text-dim">% gain</span>
              <button
                type="button"
                onClick={() => onChange(rungs.filter((_, n) => n !== i))}
                className="ml-auto text-[10px] tracking-[0.14em] text-text-dim uppercase transition-colors hover:text-negative"
              >
                Remove
              </button>
            </li>
          ))}
          <li className="flex items-center gap-2 pt-1 font-ui text-[11.5px] text-text-dim">
            {/* The consequence, not a field. */}
            Leaves <span className="font-mono text-text-secondary">{Math.round(left * 100)}%</span>{" "}
            running, governed by the exits above.
          </li>
          {sold >= 1 ? (
            <li className="font-ui text-[11.5px] text-warning">
              These steps sell the whole position. Leave something behind, or use Take profit.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * What each exit does, in the two states it can be in.
 *
 * A table because the chips are no longer two-of-a-kind: a trailing stop and a
 * fixed stop are both "stops" and behave differently enough that one branching
 * sentence was already misleading before the other two arrived.
 */
const EXIT_COPY: Record<string, { on: string; off: string }> = {
  "Take profit": {
    on: "Closes the position once it is up this much.",
    off: "Off — a winner runs until something else closes it.",
  },
  "Stop loss": {
    on: "Closes without asking. A stop you can veto is not a stop.",
    off: "Off — nothing closes this on a loss. The drawdown breaker still applies to the book.",
  },
  "Trailing stop": {
    on: "Measured from the highest price since you entered, not from your entry. It only ever moves up.",
    off: "Off — gains are not protected on the way back down.",
  },
  "Break-even at": {
    on: "Once it has been up this much, it will not be allowed to close at a loss.",
    off: "Off — a position that was up can still round-trip into a loss.",
  },
};

const COMPLIANCE_CHOICES: {
  id: ComplianceProfile;
  label: string;
  help: string;
}[] = [
  {
    id: "none",
    label: "None",
    help: "Every asset in the market, screened only by your own rules.",
  },
  {
    id: "shariah",
    label: "Shariah",
    help: "Excludes conventional finance, leverage over the line, and non-compliant revenue.",
  },
];

/* ------------------------------------------------------------ what it needs -- */

interface Turn {
  role: "you" | "agent";
  text: string;
  /** `note` is something refused, `ask` a question, `ready` the all-clear. */
  tone?: "note" | "ask" | "ready";
}

/**
 * `met` — stated and applied. `assumed` — running on a default the author never
 * chose, which is a real value that will really trade, so it is neither a
 * failure nor a fact. `missing` — the executor cannot act at all.
 */
type ReqState = "met" | "assumed" | "missing";

interface Requirement {
  key: string;
  label: string;
  state: ReqState;
  /** Where the figure stands now, in the author's terms. */
  detail: string;
  /** What to ask if this is the first gap. Absent means nothing to ask. */
  ask?: string;
  /** Answers worth one tap. Sent verbatim, so they read as things a person says. */
  chips?: string[];
}

/**
 * Whether the author actually said something about a topic.
 *
 * Every exit comes back from the compiler populated — it clamps and defaults —
 * so the draft alone cannot distinguish "take profit at 25% because I said so"
 * from "take profit at 25% because nobody said otherwise". The difference
 * matters enough to keep asking about, and the only evidence of it is what was
 * typed. Crude on purpose: it decides whether to ASK a question, never what the
 * strategy is, so a false positive costs one unasked question and nothing else.
 */
function mentions(said: string, re: RegExp): boolean {
  return re.test(said.toLowerCase());
}

/**
 * The minimum a trade executor needs before it can act, in the order it needs
 * them: what makes it buy, where it gets out on the way up, where it gets out
 * on the way down, and how much it may commit.
 *
 * Cadence and bar size are NOT in this list. Both have engine-wide defaults
 * that are correct for the overwhelming majority of strategies (daily bars,
 * hourly wake-ups), and neither can make a position unsafe on its own.
 */
function requirements(limits: Limits, said: string): Requirement[] {
  const active = limits.rules.filter((r) => r.enabled !== false);
  const { takeProfitPct, stopLossPct } = limits.exits;

  return [
    {
      key: "entry",
      label: "Entry condition",
      state: active.length > 0 ? "met" : "missing",
      detail:
        active.length > 0
          ? `${active.length} ${active.length === 1 ? "rule" : "rules"} must all be true`
          : "nothing would ever trigger a buy",
      ask: "What has to be true before it buys?",
      chips: [
        "when it is down 4% or more on the day",
        "when RSI is under 30",
        "only when the pool is deep",
      ],
    },
    {
      key: "profit",
      label: "Take profit",
      // Switching an exit off is a decision, so the checklist reports it as met
      // rather than going on asking for a value the author has deliberately
      // removed. "+0%" would also read as a target of zero, which is the one
      // thing it does not mean.
      state:
        takeProfitPct <= 0 || mentions(said, /take profit|profit at|target|upside|\btp\b/)
          ? "met"
          : "assumed",
      detail: takeProfitPct > 0 ? `+${takeProfitPct}%` : "off",
      ask: `Where should it take profit? It is on +${takeProfitPct}% until you say.`,
      chips: ["take profit at 5%", "take profit at 15%", "take profit at 30%"],
    },
    {
      key: "stop",
      label: "Stop loss",
      state:
        stopLossPct <= 0 || mentions(said, /stop|cut it|\bsl\b|downside|lose/)
          ? "met"
          : "assumed",
      detail: stopLossPct > 0 ? `−${stopLossPct}%` : "off",
      ask: `Where should it stop out? It is on −${stopLossPct}% until you say.`,
      chips: ["stop out at 3%", "stop out at 8%", "stop out at 15%"],
    },
    {
      key: "size",
      label: "Position size",
      state: mentions(said, /\$|per trade|position size|stake|put in/) ? "met" : "assumed",
      detail: `${money(limits.positionUsd)} per trade · ${limits.tradesPerCycle} per cycle`,
      ask: `How much may it put into one trade? It is on ${money(limits.positionUsd)} of the ${money(
        CAPITAL_USD,
      )} paper book.`,
      chips: ["$500 per trade", "$1,000 per trade", "$2,500 per trade"],
    },
  ];
}

/**
 * Reads a stated position size out of a message.
 *
 * The compiler does not return sizing — /agents/compose answers with rules and
 * exits — so a sentence about money would otherwise be dropped on the floor
 * while the checklist went on asking for it.
 *
 * Only matches a figure with a unit that means "per trade", so "down 4% on the
 * day, and I have $10,000 in the account" cannot be mistaken for an order size.
 * Returns null when there is nothing to read, and clamps into the same range
 * the field below allows.
 */
function readSizing(text: string, limits: Limits): Limits | null {
  const m = /\$\s?([\d,]+(?:\.\d+)?)\s*(?:k\b)?[^.]{0,24}?(?:per trade|a trade|each trade|per position|per entry)/i.exec(
    text,
  );
  if (!m) return null;
  const raw = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const usd = /k\b/i.test(m[0]) ? raw * 1000 : raw;
  // Floor and step of 10, not 100.
  //
  // "$10 each trade" is a real request — it is how a grid or a wide ladder is
  // sized — and a $100 floor silently turned it into ten times the intended
  // size while the checklist reported the instruction as honoured. Rounding to
  // the nearest $100 did the same thing more quietly to $150.
  //
  // Matches what the server accepts, which is the point: a client floor above
  // the server's makes a capability unreachable, and the two disagreeing is the
  // same class of gap that let the budget be dropped entirely.
  const clamped = Math.min(Math.max(Math.round(usd / MIN_POSITION_USD) * MIN_POSITION_USD, MIN_POSITION_USD), CAPITAL_USD);
  return { ...limits, positionUsd: clamped };
}

/** One line of the exchange. */
function TurnRow({ turn }: { turn: Turn }) {
  const you = turn.role === "you";
  return (
    <li
      className={`border-b border-grid px-4 py-2.5 last:border-b-0 ${
        turn.tone === "ask" ? "bg-surface" : ""
      }`}
    >
      <p
        className={`pb-0.5 font-mono text-[9px] tracking-[0.14em] uppercase ${
          you ? "text-text-muted" : "text-accent"
        }`}
      >
        {you ? "You" : "Strategy desk"}
      </p>
      <p
        className={`font-ui text-[13px] leading-relaxed ${
          turn.tone === "note"
            ? "text-warning"
            : turn.tone === "ready"
              ? "text-accent"
              : you
                ? "text-text-secondary"
                : "text-text-primary"
        }`}
      >
        {turn.text}
      </p>
    </li>
  );
}

/**
 * The executor's own requirements, and where each stands.
 *
 * An `assumed` row is not a warning: those defaults are live values that will
 * really be traded on. It is marked so the author can tell the difference
 * between a number they chose and one that chose itself, which is exactly the
 * distinction a track record later depends on.
 */
function Checklist({ reqs }: { reqs: Requirement[] }) {
  const open = reqs.filter((r) => r.state !== "met").length;

  return (
    <div className="mt-4 border border-grid">
      <div className="flex items-center justify-between gap-4 border-b border-grid px-4 py-2.5">
        <h4 className="font-mono text-[9.5px] tracking-[0.14em] text-text-dim uppercase">
          Before it can trade
        </h4>
        <span
          className={`font-mono text-[9.5px] tracking-[0.1em] uppercase ${
            open === 0 ? "text-accent" : "text-text-muted"
          }`}
        >
          {open === 0 ? "All set" : `${open} still assumed`}
        </span>
      </div>
      <ul>
        {reqs.map((r) => (
          <li
            key={r.key}
            className="flex items-baseline justify-between gap-4 border-b border-grid px-4 py-2 last:border-b-0"
          >
            <span className="flex min-w-0 items-baseline gap-2.5">
              <span
                aria-hidden
                className={`inline-block size-1.5 shrink-0 rounded-full ${
                  r.state === "met"
                    ? "bg-accent"
                    : r.state === "assumed"
                      ? "bg-warning"
                      : "bg-negative"
                }`}
              />
              <span className="truncate font-ui text-[12.5px] text-text-primary">{r.label}</span>
            </span>
            <span
              className={`shrink-0 text-right font-mono text-[11.5px] ${
                r.state === "missing" ? "text-negative" : "text-text-secondary"
              }`}
            >
              {r.detail}
              {r.state === "assumed" ? (
                <span className="pl-1.5 text-[9.5px] tracking-[0.1em] text-text-muted uppercase">
                  assumed
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
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
      <NumberEntry
        value={r.value}
        min={r.min}
        max={r.max}
        step={r.step}
        unit={r.unit}
        disabled={!on}
        label={label}
        onChange={(n) => onChange({ value: n })}
      />
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

/**
 * A take profit or a stop loss: draggable, and typeable.
 *
 * The figure used to be a read-only span, so the ONLY way to reach a number was
 * to drag a slider across a 200-wide range — which cannot land on 37% reliably
 * and cannot express "exactly 3%" at all. Anyone with a level in mind was stuck
 * with whatever the drag happened to hit.
 *
 * The typed value is held as a draft string while it is being edited, because a
 * field that reformats every keystroke fights the person using it: clearing it
 * to type "45" would otherwise become 0 the moment the box empties, and the
 * slider would jump to its floor mid-edit. It commits on blur or Enter, and
 * Escape puts the previous number back.
 */
/**
 * One exit, which the author may switch off entirely.
 *
 * ZERO IS THE OFF STATE, matching what the engine reads: it skips the
 * comparison rather than treating 0 as a threshold. Both exits are optional —
 * running without a target lets a winner run, and running without a stop is the
 * owner's call to make. The portfolio drawdown breaker still applies either way
 * and is not reachable from here.
 *
 * `resumeAt` is where the value comes back when it is switched on again. The
 * slider cannot express "off", so without somewhere to return to, turning it
 * back on would land wherever the track happened to be.
 */
function ExitChip({
  label,
  value,
  min,
  max,
  suffix,
  resumeAt,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  resumeAt: number;
  onChange: (n: number) => void;
}) {
  const off = value <= 0;

  return (
    <div className="grid gap-3 border-b border-grid px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_200px_92px_58px] lg:items-center lg:gap-5">
      <div className="min-w-0">
        <p className="font-mono text-[12px] text-text-primary">{label}</p>
        <p className="pt-0.5 font-ui text-[11.5px] leading-relaxed text-text-dim">
          {EXIT_COPY[label]?.[off ? "off" : "on"] ??
            (off
              ? "Off."
              : "Closes the position once this is true.")}
        </p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={off ? min : value}
        disabled={off}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label} slider`}
        className="accent-accent disabled:opacity-30"
      />
      {off ? (
        <span className="text-right font-mono text-[12px] text-text-dim">Off</span>
      ) : (
        <NumberEntry
          value={value}
          min={min}
          max={max}
          step={1}
          unit={suffix}
          // The sign belongs to the direction, not the figure: a stop is entered
          // as 12 and shown as −12%, because "−" is a fact about a stop rather
          // than something the author should have to type or be able to omit.
          sign={label === "Stop loss" ? "−" : "+"}
          label={label}
          onChange={onChange}
        />
      )}
      <button
        type="button"
        aria-pressed={!off}
        onClick={() => onChange(off ? resumeAt : 0)}
        className="text-right font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase transition-colors hover:text-text-primary"
      >
        {off ? "On" : "Off"}
      </button>
    </div>
  );
}

/**
 * A number you can drag to or type in.
 *
 * Every figure in this step used to be a read-only span beside a slider, so the
 * ONLY way to reach a value was to drag across its whole range — which cannot
 * land on 37% reliably and cannot express "exactly 3%" at all. Anyone with a
 * level in mind was stuck with whatever the drag happened to hit.
 *
 * The typed value is held as a draft string while it is being edited, because a
 * field that reformats every keystroke fights the person using it: clearing the
 * box to type "45" would otherwise read as 0 the moment it empties, and the
 * slider would jump to its floor mid-edit. It commits on blur or Enter; Escape
 * restores the previous number.
 *
 * Out-of-range entries are clamped to what the engine accepts and SAY so. A
 * silent clamp is how someone ends up believing they set a 300% target and
 * finding a 200% one in the record.
 */
function NumberEntry({
  value,
  min,
  max,
  step,
  unit,
  sign,
  label,
  disabled = false,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  /** "$" renders ahead of the number; anything else follows it. */
  unit: string;
  /** Direction marker for exits. Display only — never part of the entry. */
  sign?: "+" | "−";
  label: string;
  disabled?: boolean;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [clamped, setClamped] = useState<number | null>(null);

  function commit() {
    if (draft === null) return;
    const cleaned = draft.replace(/[^\d.]/g, "");
    const parsed = Number(cleaned);
    setDraft(null);
    // An unreadable entry keeps the previous number rather than becoming zero:
    // a stop of 0% is a position that closes the instant it opens.
    if (cleaned === "" || !Number.isFinite(parsed)) return;
    // To the nearest step the slider itself uses, so dragging and typing cannot
    // produce values of different precision for the same rule.
    const snapped = Math.round(parsed / step) * step;
    const next = Math.min(Math.max(snapped, min), max);
    setClamped(next === snapped ? null : next);
    onChange(next);
  }

  const isMoney = unit === "$";

  return (
    <div className={`text-right ${disabled ? "text-text-muted" : "text-accent"}`}>
      <div className="flex items-baseline justify-end gap-px font-mono text-[13px]">
        {sign ? <span aria-hidden>{sign}</span> : null}
        {isMoney ? <span aria-hidden>$</span> : null}
        <input
          type="text"
          inputMode="decimal"
          value={draft ?? String(value)}
          disabled={disabled}
          onChange={(e) => {
            setClamped(null);
            setDraft(e.target.value);
          }}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
          aria-label={`${label}, value`}
          size={1}
          className="tnum w-[7ch] border-b border-transparent bg-transparent text-right outline-none transition-colors hover:border-grid-strong focus:border-accent disabled:cursor-not-allowed"
        />
        {isMoney ? null : <span aria-hidden>{unit}</span>}
      </div>
      {clamped === null ? null : (
        <p className="pt-0.5 font-mono text-[9px] tracking-[0.06em] text-warning uppercase">
          {clamped === max ? `Max ${fmt(max, unit)}` : `Min ${fmt(min, unit)}`}
        </p>
      )}
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
