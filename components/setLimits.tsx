"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  classFor,
  composeAgent,
  type Clause,
  type DetectionRule,
  type SetupSpec,
  type AddPlan,
  type RankingSpec,
  type ComplianceProfile,
  type ExitRules,
  type UniverseAsset,
} from "@/lib/api";
import {
  AddPlanCard,
  CADENCES,
  CADENCE_FOR_TIMEFRAME,
  DEFAULT_TIMEFRAME,
  RWA_RULES,
  TIMEFRAMES,
  fmt,
  rescaleRuleValue,
  ruleBasisNote,
  ruleLabel,
  ruleSpan,
  scaleRule,
  timeframesForClass,
  type RuleSpec,
  type Timeframe,
} from "@/components/buildStrategy";
import { Pill, PillRow } from "@/components/wizard";
import { ModelBadge } from "@/components/modelBadge";
import { useT, type Translate, type TranslationKey } from "@/lib/i18n";

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
   * Seconds between cycles — how often the agent wakes.
   *
   * NOT the same axis as `timeframe`, which is the resolution of what it looks
   * at. Absent means the author never chose, which defers to the engine default
   * (hourly) rather than asserting one on their behalf — the same rule
   * `complianceProfile` follows below.
   */
  cadenceSec?: number;
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
  /**
   * Either/or groups, ANDed with {@link rules}. Absent means a plain
   * conjunction, which is what every strategy built before this is.
   *
   * Composer-only, like {@link setup}: there is no control for these, so what
   * arrives from a sentence is the only way one exists. That is exactly why
   * they are rendered read-only below rather than left invisible — a condition
   * that trades and cannot be seen is the thing this step exists to prevent.
   */
  anyOf?: DetectionRule[][];
  /** Two-stage entry. Absent means the rules are the whole test. */
  setup?: SetupSpec;
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

/**
 * Move a whole strategy to a new bar size.
 *
 * Three things travel together and always have to: the timeframe itself, the
 * cadence paired with it, and every percent-of-price threshold in the rule set.
 * Changing the first alone is what made an intraday strategy look configured
 * and behave like a broken one — daily-width thresholds nothing intraday ever
 * reaches, on a chart the agent only glances at once an hour.
 */
function retimeframe(limits: Limits, to: Timeframe): Limits {
  const from = limits.timeframe ?? DEFAULT_TIMEFRAME;
  if (from === to) return limits;
  return {
    ...limits,
    timeframe: to,
    // Cadence follows the bar size. The row below stays editable, so this is a
    // default and not a lock.
    cadenceSec: CADENCE_FOR_TIMEFRAME[to],
    rules: limits.rules.map((r) => ({
      ...r,
      value: rescaleRuleValue(r, from, to),
    })),
  };
}

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
  const t = useT();
  // Every market in a strategy shares one class, so the first decides which bar
  // sizes are on offer — the same rule the ATR rule and the compliance screen
  // already follow.
  const servedTimeframes = timeframesForClass(classFor(market));
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
  /**
   * What the author has settled, per the composer that read their sentence.
   *
   * Not accumulated. Every compose call re-sends the WHOLE spec, so each answer
   * describes everything said so far and replaces its predecessor — merging
   * them would keep a stop "settled" after a later sentence had reworded it
   * away.
   *
   * An older backend sends no provenance at all, and then this stays empty: the
   * checklist reports everything as assumed, asks one more question than it
   * needs to, and never claims something was agreed that was not.
   */
  const [settled, setSettled] = useState<Settled>(NOTHING_SETTLED);
  /**
   * The sentence, clause by clause, as the composer accounted for it.
   *
   * Replaced per turn for the same reason {@link settled} is: the whole spec is
   * re-sent every time, so the newest ledger describes all of it.
   */
  const [clauses, setClauses] = useState<Clause[]>([]);

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
  const reqs = requirements(value, settled, t);
  const question = nextQuestion(clauses, reqs, t);

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
    setTurns((prev) => [...prev, { role: "you", text: said }]);
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
      if (!token) throw new Error(t("sl_sign_in"));
      const { draft, notes: refused, provenance } = await composeAgent(
        token,
        // The market is named for it, so the sentence does not have to be. The
        // underlying is only named when there is one — a token has none, and
        // "(undefined)" reads as a bug to the model as much as to a person.
        // Every market named, not just the first. The rules apply to all of
        // them, and a composer that believes it is writing for one asset will
        // reach for facts only that asset has.
        t("sl_trading_prefix", {
          markets: markets
            .map(
              (m) => `${m.symbol}${m.underlying ? ` (${m.underlying})` : ""}`,
            )
            .join(", "),
        }) + nextSpec.join(" "),
      );
      // A bar size this class cannot be screened at is refused HERE, where the
      // author is still in the sentence that asked for it. Left to travel, it
      // deploys cleanly and the agent buys nothing — the specialist states the
      // refusal in a screening trace, which is the last place anyone looks.
      const unserved =
        draft?.timeframe && !servedTimeframes.includes(draft.timeframe)
          ? draft.timeframe
          : null;
      /**
       * What the author asked for that the engine could not take as written.
       *
       * Two kinds, and they read differently on purpose. A CLAMP is a number
       * the author chose being moved to the nearest one that exists — the
       * clearest case is a 1% target against a 2% floor, which used to be
       * applied in silence and left someone believing they had set 1%. An
       * UNATTRIBUTED rule is the reverse: a rule in the strategy that nothing
       * in the sentence asked for, which is not an error and is the only
       * warning anyone gets that a phrase may have been read as something else.
       *
       * Both are stated, neither blocks. Whether a 1% target was worth having
       * is the author's call; whether they know it became 2% is ours.
       */
      const misfits = [
        ...(provenance?.adjusted ?? []).map((a) =>
          t("sl_exit_adjusted", {
            label: t(EXIT_FIELD_LABEL[a.field] ?? "sl_exit_generic"),
            asked: a.asked,
            became: a.became,
          }),
        ),
        ...(provenance?.unattributed ?? [])
          .map((key) => value.rules.find((r) => r.key === key))
          .filter((r): r is RuleSpec => !!r)
          .map((r) =>
            t("sl_rule_unattributed", {
              rule: ruleLabel(r, draft?.timeframe ?? DEFAULT_TIMEFRAME, t),
            }),
          ),
      ];

      const notesOut = [
        // `refused` is the composer's own list of what it could not use,
        // authored server-side and quoted as it arrives.
        ...refused,
        ...misfits,
        ...(unserved
          ? [
              t(
                classFor(market) === "spot"
                  ? "sl_unserved_bars_spot"
                  : "sl_unserved_bars_rwa",
                {
                  tf: unserved,
                  kept: value.timeframe ?? DEFAULT_TIMEFRAME,
                  available: servedTimeframes.join(", "),
                },
              ),
            ]
          : []),
      ];
      setNotes(notesOut);

      const nextSettled: Settled = {
        stated: provenance?.stated ?? [],
        // Sticky, unlike the exits. A size the author gave is applied to the
        // limits and stays there, so it stays settled — the exits are re-read
        // from the whole spec on every turn and can genuinely change back.
        sizeStated: settled.sizeStated || sized !== null,
      };
      setSettled(nextSettled);
      setClauses(provenance?.clauses ?? []);

      if (!draft) {
        const why = refused[0] ?? t("sl_not_rules");
        setError(why);
        setTurns((prev) => [
          ...prev,
          { role: "agent", text: why, tone: "note" },
          {
            role: "agent",
            text: t("sl_measurable"),
            tone: "ask",
          },
        ]);
        return;
      }

      setReading(draft.reading || null);
      // Cadence trails the bar size, but only when the bar size actually MOVED.
      // "Trade BTC on 5-minute bars" that leaves cadence hourly reads every
      // 12th bar and steps over the rest, which nobody means — and the reverse
      // mistake is just as bad: re-running compose to add a stop must not
      // silently undo a cadence the author set by hand.
      const prevTf = next.timeframe ?? DEFAULT_TIMEFRAME;
      // An unserved bar size never becomes the strategy's — `unserved` above
      // already told the author why.
      const nextTf = (unserved ? undefined : draft.timeframe) ?? next.timeframe;
      next = {
        ...next,
        timeframe: nextTf,
        cadenceSec:
          nextTf && nextTf !== prevTf
            ? CADENCE_FOR_TIMEFRAME[nextTf]
            : next.cadenceSec,
        // The composer may have read an accumulation plan out of the sentence.
        // Absent means the sentence did not ask for one — which must CLEAR any
        // previous plan rather than leave a stale one attached to rules that no
        // longer mention it.
        addPlan: draft.addPlan,
        // The three the composer produces and this step used to discard.
        //
        // anyOf and setup take the draft's value outright, absent included:
        // nothing but a sentence can set them, so clearing on absence loses
        // nothing a person chose — it is the same rule addPlan follows above.
        //
        // ranking does NOT clear, and the difference is deliberate. It has a
        // control on this very screen, so treating absence as "remove it" would
        // delete a choice made by hand two fields away the moment another
        // sentence was sent.
        anyOf: draft.anyOf,
        setup: draft.setup,
        ranking: draft.ranking ?? next.ranking,
        // Only rules the compiler actually set are switched on. The rest stay
        // available but off, rather than silently applying a default nobody
        // asked for.
        rules: next.rules.map((r) => {
          const hit = draft.rules.find((d) => d.key === r.key);
          // A rule the composer set arrives in the units of the bar size it was
          // composed AT, so it is taken verbatim. A rule it did not mention is
          // carrying a threshold from the previous bar size, and if the bar
          // size just moved that number no longer means what it meant — so it
          // is rescaled, exactly as the pill path does. Off either way until
          // something asks for it, but off with a number that still reads.
          if (hit) return { ...r, value: hit.value, enabled: true };
          const moved = nextTf && nextTf !== prevTf;
          return {
            ...r,
            value: moved ? rescaleRuleValue(r, prevTf, nextTf) : r.value,
            enabled: false,
          };
        }),
        exits: draft.exits,
      };
      onChange(next);

      // Read the gaps off what we just built, not off `value` — the parent's
      // state has not come back down yet, and asking about the previous draft
      // is how a chat ends up requesting something you just gave it.
      const reqs = requirements(next, nextSettled, t);
      const q = nextQuestion(provenance?.clauses ?? [], reqs, t);

      setTurns((prev) => [
        ...prev,
        ...(draft.reading
          ? [{ role: "agent" as const, text: draft.reading }]
          : []),
        ...notesOut.map((n) => ({
          role: "agent" as const,
          text: n,
          tone: "note" as const,
        })),
        q
          ? { role: "agent" as const, text: q.text, tone: "ask" as const }
          : {
              role: "agent" as const,
              text: t("sl_ready"),
              tone: "ready" as const,
            },
      ]);
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err);
      setError(why);
      setTurns((prev) => [...prev, { role: "agent", text: why, tone: "note" }]);
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
          {t("sl_step")}
        </p>
        <h2 className="font-mono text-[22px] leading-none text-text-primary">
          {t("sl_title")}
        </h2>
        <p className="flex flex-wrap items-center gap-2 font-mono text-[12px] text-text-secondary">
          {markets.length === 1
            ? t("sl_markets_one", { symbol: market.symbol })
            : t("sl_markets_many", { count: markets.length })}{" "}
          ·{" "}
          {t(
            market.kind === "crypto"
              ? "sl_class_crypto"
              : market.assetClass === "commodity"
                ? "sl_class_commodity"
                : "sl_class_equity",
          )}
          <button
            type="button"
            onClick={onBack}
            className="font-mono text-[10.5px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-accent"
          >
            {t("sl_change")}
          </button>
        </p>
      </div>

      {/* ------------------------------------------------------- write it */}
      <section>
        <div className="flex items-center justify-between pb-3">
          <h3 className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            {t("sl_strategy_for", {
              markets:
                markets.length === 1
                  ? market.symbol
                  : t("sl_markets_many", { count: markets.length }),
            })}
          </h3>
          <div className="flex items-center gap-0.5 rounded-full border border-grid p-1">
            {(["write", "preset"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`h-7 rounded-full px-3.5 font-mono text-[11px] transition-colors ${
                  mode === m
                    ? "bg-accent-wash text-accent"
                    : "text-text-dim hover:text-text-primary"
                }`}
              >
                {t(m === "write" ? "sl_mode_write" : "sl_mode_preset")}
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
                        {t("sl_reading_it")}
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
                    ? t("sl_compose_placeholder", { symbol: market.symbol })
                    : t("sl_compose_followup")
                }
                aria-label={t("sl_compose_aria")}
                className="w-full resize-none bg-transparent px-4 py-3 font-ui text-[14px] leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
              />
              <div className="flex items-center justify-between gap-4 border-t border-grid px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
                    {t(busy ? "sl_compiling" : "sl_send_hint")}
                  </span>
                  {/* WHO is reading the sentence, stated where it is read.
                      Step 3 lets an agent be given a different model to reason
                      with, and the obvious wrong assumption is that the choice
                      reaches back here. It cannot: this runs before the agent,
                      its wallet, or its balance exists. */}
                  <ModelBadge className="hidden sm:inline-flex" />
                </span>
                <button
                  type="button"
                  onClick={() => void send(sentence)}
                  disabled={busy || sentence.trim().length === 0}
                  className="flex h-8 items-center border border-accent bg-accent-wash px-5 font-mono text-[10px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
                >
                  {t(turns.length === 0 ? "sl_compile" : "sl_send")}
                </button>
              </div>
            </div>

            {/* One tap for the question just asked. The chips are sentences,
                not values, because they are sent as the author's own words and
                compiled the same way anything typed here would be — a chip
                that set a field directly would be a different mechanism
                wearing the same clothes. */}
            {question && question.chips.length > 0 && !busy ? (
              <div className="flex flex-wrap gap-2 pt-3">
                {question.chips.map((c) => (
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
                key={p.labelKey}
                type="button"
                // Sent, not typed into the box: a preset IS a first message,
                // and dropping the author back at a full input with a Compile
                // button still to press made picking one feel like it had not
                // worked.
                onClick={() => {
                  setMode("write");
                  void send(t(p.promptKey));
                }}
                className="h-9 rounded-full border border-border px-4 font-mono text-[11.5px] text-text-secondary transition-colors hover:border-accent hover:text-accent"
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>
        )}

        {error ? (
          <p className="pt-2.5 font-ui text-[12.5px] leading-relaxed text-negative">
            {error}
          </p>
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
            {t("sl_rules_appear")}{" "}
            <button
              type="button"
              onClick={() => setManualRules(true)}
              className="text-accent underline underline-offset-2 transition-opacity hover:opacity-80"
            >
              {t("sl_set_by_hand")}
            </button>
            .
          </p>
        )}
      </section>

      {/* ---------------------------------------------------- read as */}
      {showRules ? (
        <section>
          <h3 className="pb-3 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            {t("sl_read_as")}
          </h3>

          {reading ? (
            <p className="max-w-[70ch] pb-3 font-ui text-[13px] leading-relaxed text-text-secondary">
              {reading}
            </p>
          ) : null}

          <ClauseLedger clauses={clauses} />

          <ComposedOnly
            anyOf={value.anyOf}
            setup={value.setup}
            catalogue={value.rules}
            timeframe={value.timeframe ?? DEFAULT_TIMEFRAME}
            onClearAnyOf={() => onChange({ ...value, anyOf: undefined })}
            onClearSetup={() => onChange({ ...value, setup: undefined })}
          />

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
              labelKey="sl_take_profit"
              value={value.exits.takeProfitPct}
              min={2}
              max={1000}
              suffix="%"
              resumeAt={45}
              onChange={(n) =>
                onChange({
                  ...value,
                  exits: { ...value.exits, takeProfitPct: n },
                })
              }
            />
            <ExitChip
              labelKey="sl_stop_loss"
              value={value.exits.stopLossPct}
              min={1}
              max={90}
              suffix="%"
              resumeAt={20}
              onChange={(n) =>
                onChange({
                  ...value,
                  exits: { ...value.exits, stopLossPct: n },
                })
              }
            />
            {/* Both default to OFF, unlike the two above. A trailing stop nobody
                asked for closes positions its author meant to keep, so these
                are opt-in rather than a level to adjust. */}
            <ExitChip
              labelKey="sl_trailing_stop"
              value={value.exits.trailingStopPct ?? 0}
              min={1}
              max={90}
              suffix="%"
              resumeAt={12}
              onChange={(n) =>
                onChange({
                  ...value,
                  exits: { ...value.exits, trailingStopPct: n },
                })
              }
            />
            <ExitChip
              labelKey="sl_breakeven"
              value={value.exits.breakevenAfterPct ?? 0}
              min={1}
              max={200}
              suffix="%"
              resumeAt={5}
              onChange={(n) =>
                onChange({
                  ...value,
                  exits: { ...value.exits, breakevenAfterPct: n },
                })
              }
            />
            <ScaleOutLadder
              rungs={value.exits.scaleOut ?? []}
              onChange={(next) =>
                onChange({
                  ...value,
                  exits: {
                    ...value.exits,
                    scaleOut: next.length > 0 ? next : undefined,
                  },
                })
              }
            />
          </div>

          {notes.length > 0 ? (
            <ul className="space-y-0.5 pt-2.5">
              {notes.map((n) => (
                <li
                  key={n}
                  className="font-ui text-[12px] leading-relaxed text-warning"
                >
                  {n}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="max-w-[70ch] pt-3 font-ui text-[12.5px] leading-relaxed text-text-secondary">
            {active.length === 1
              ? t("sl_nothing_runs_one")
              : t("sl_nothing_runs_many", { count: active.length })}
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
          // Every market in a strategy shares one class, so the first speaks
          // for all of them. It decides whether ATR spacing is offered at all:
          // ATR needs a high and a low per bar, which the tokenized-stock feed
          // does not carry.
          strategyClass={classFor(market)}
        />
      ) : null}

      {/* ------------------------------------------------------- timing */}
      {/*
        Two axes, deliberately separate controls: the bar size the rules above
        are MEASURED on, and how often the agent wakes to evaluate them. They
        were modelled from the start and reachable from nowhere — the only way
        to get 15-minute bars was to say so in the sentence, and cadence never
        left the engine default at all, so a 5-minute strategy woke hourly and
        stepped over eleven bars in twelve.

        Held behind `showRules` like accumulation: a bar size is a property of
        rules, and there is nothing to measure before one exists.
      */}
      {showRules ? (
        <section>
          <h3 className="pb-3 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            {t("sl_chart_timeframe")}
          </h3>
          <PillRow>
            {/* `tf`, not `t` — the translator owns that name in this file. */}
            {TIMEFRAMES.map((tf) => {
              // Served for THIS class, not in general. A crypto strategy on 30m
              // deploys, wakes and buys nothing — the venue cannot build the
              // bar — so the pill is disabled rather than offered and refused
              // later by a screening trace nobody opens.
              const served = servedTimeframes.includes(tf.tf);
              return (
                <Pill
                  key={tf.tf}
                  active={(value.timeframe ?? DEFAULT_TIMEFRAME) === tf.tf}
                  disabled={!served}
                  suffix={served ? undefined : t("sl_not_served")}
                  onClick={() => onChange(retimeframe(value, tf.tf))}
                >
                  {t(tf.labelKey)}
                </Pill>
              );
            })}
          </PillRow>
          <p className="max-w-[64ch] pt-3 font-ui text-[12.5px] leading-relaxed text-text-secondary">
            {(() => {
              const hit = TIMEFRAMES.find(
                (tf) => tf.tf === (value.timeframe ?? DEFAULT_TIMEFRAME),
              );
              return hit ? t(hit.detailKey) : null;
            })()}{" "}
            <span className="text-text-dim">{t("sl_timeframe_help")}</span>
          </p>

          <h3 className="pt-6 pb-3 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            {t("sl_cycle")}
          </h3>
          <PillRow>
            {CADENCES.map((c) => (
              <Pill
                key={c.sec}
                active={
                  (value.cadenceSec ??
                    CADENCE_FOR_TIMEFRAME[
                      value.timeframe ?? DEFAULT_TIMEFRAME
                    ]) === c.sec
                }
                onClick={() => onChange({ ...value, cadenceSec: c.sec })}
              >
                {t(c.labelKey)}
              </Pill>
            ))}
          </PillRow>
          <p className="max-w-[64ch] pt-3 font-ui text-[12.5px] leading-relaxed text-text-secondary">
            {(() => {
              const tf = value.timeframe ?? DEFAULT_TIMEFRAME;
              const sec = value.cadenceSec ?? CADENCE_FOR_TIMEFRAME[tf];
              const paired = CADENCE_FOR_TIMEFRAME[tf];
              return (
                <>
                  {(() => {
                    const hit = CADENCES.find((c) => c.sec === sec);
                    return hit ? t(hit.detailKey) : null;
                  })()}{" "}
                  <span className="text-text-dim">
                    {t(
                      sec === paired
                        ? "bs_cadence_matched"
                        : sec < paired
                          ? "bs_cadence_faster"
                          : "bs_cadence_slower",
                    )}
                  </span>
                </>
              );
            })()}
          </p>
        </section>
      ) : null}

      {/* ------------------------------------------------------- budget */}
      <section>
        <h3 className="pb-3 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
          {t("sl_budget")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("sl_position_limit")}
            value={value.positionUsd}
            unit="USDC"
            min={MIN_POSITION_USD}
            max={CAPITAL_USD}
            step={MIN_POSITION_USD}
            help={t("sl_position_help", {
              pct: ((value.positionUsd / CAPITAL_USD) * 100).toFixed(0),
              book: money(CAPITAL_USD),
            })}
            onChange={(n) => onChange({ ...value, positionUsd: n })}
          />
          <Field
            label={t("sl_trades_per_cycle")}
            value={value.tradesPerCycle}
            unit={t("sl_unit_trades")}
            min={1}
            max={10}
            step={1}
            // Deliberately not "per day": the ceiling the engine enforces is
            // per cycle, and relabelling it would misstate what it does.
            help={t("sl_trades_help")}
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
            {t("sl_how_many")}
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
            {t("sl_compliance")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {COMPLIANCE_CHOICES.map((choice) => {
              const active = (value.complianceProfile ?? "none") === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange({ ...value, complianceProfile: choice.id })
                  }
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-accent bg-accent/10 text-text"
                      : "border-line text-text-dim hover:border-line-bright hover:text-text"
                  }`}
                >
                  <span className="block font-mono text-[11px] tracking-[0.08em] uppercase">
                    {t(choice.labelKey)}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-text-dim">
                    {t(choice.helpKey)}
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
            {t("sl_compliance_note")}
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
  const t = useT();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={!on}
          onClick={() => onChange(undefined)}
          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
            !on
              ? "border-accent bg-accent/10 text-text"
              : "border-line text-text-dim hover:text-text"
          }`}
        >
          <span className="block font-mono text-[11px] tracking-[0.08em] uppercase">
            {t("sl_all_of_them")}
          </span>
          <span className="mt-1 block text-[11px] text-text-dim">
            {t("sl_all_of_them_help")}
          </span>
        </button>
        <button
          type="button"
          aria-pressed={on}
          onClick={() =>
            onChange(
              value ?? {
                by: "momentum20dPct",
                take: Math.min(3, markets),
                prefer: "highest",
              },
            )
          }
          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
            on
              ? "border-accent bg-accent/10 text-text"
              : "border-line text-text-dim hover:text-text"
          }`}
        >
          <span className="block font-mono text-[11px] tracking-[0.08em] uppercase">
            {t("sl_only_best")}
          </span>
          <span className="mt-1 block text-[11px] text-text-dim">
            {t("sl_only_best_help")}
          </span>
        </button>
      </div>

      {value ? (
        <div className="flex flex-wrap items-center gap-2 font-mono text-[12px]">
          <span className="text-text-dim">{t("sl_hold_best")}</span>
          <input
            type="number"
            min={1}
            max={Math.max(1, markets)}
            value={value.take}
            onChange={(e) =>
              onChange({
                ...value,
                take: Math.max(1, Math.min(markets, Number(e.target.value))),
              })
            }
            className="w-16 border border-line bg-transparent px-2 py-1 text-right text-text-primary"
            aria-label={t("sl_how_many_aria")}
          />
          <span className="text-text-dim">
            {t("sl_of_by", { count: markets })}
          </span>
          <select
            value={`${value.by}:${value.prefer}`}
            onChange={(e) => {
              const [by, prefer] = e.target.value.split(":");
              onChange({
                ...value,
                by,
                prefer: prefer as "highest" | "lowest",
              });
            }}
            className="border border-line bg-transparent px-2 py-1 text-text-primary"
            aria-label={t("sl_rank_by_aria")}
          >
            {/* Each option names the DIRECTION as well as the measure, because
                both ends are wanted and neither is a sensible default. */}
            <option value="momentum20dPct:highest">
              {t("rank_momentum_high")}
            </option>
            <option value="momentum20dPct:lowest">
              {t("rank_momentum_low")}
            </option>
            <option value="rsi14:lowest">{t("rank_rsi_low")}</option>
            <option value="liquidityUsd:highest">
              {t("rank_liquidity_high")}
            </option>
            <option value="dailyVolPct:lowest">{t("rank_vol_low")}</option>
          </select>
        </div>
      ) : null}

      <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">
        {t("sl_ranking_note")}
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
  const t = useT();

  const setRung = (
    i: number,
    patch: Partial<{ atPct: number; fraction: number }>,
  ) => onChange(rungs.map((r, n) => (n === i ? { ...r, ...patch } : r)));

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
          <p className="font-mono text-[12px] text-text-primary">
            {t("sl_steps_title")}
          </p>
          <p className="pt-0.5 font-ui text-[11.5px] leading-relaxed text-text-dim">
            {t(rungs.length === 0 ? "sl_steps_off" : "sl_steps_on")}
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={left <= 0.05}
          className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase transition-colors hover:text-text-primary disabled:opacity-30"
        >
          {t("sl_add_step")}
        </button>
      </div>

      {rungs.length > 0 ? (
        <ul className="space-y-2 pt-3">
          {rungs.map((r, i) => (
            <li
              key={i}
              className="flex flex-wrap items-center gap-2 font-mono text-[12px]"
            >
              <span className="text-text-dim">{t("sl_sell")}</span>
              <input
                type="number"
                min={1}
                max={95}
                value={Math.round(r.fraction * 100)}
                onChange={(e) =>
                  setRung(i, {
                    fraction: Math.min(
                      0.95,
                      Math.max(0.01, Number(e.target.value) / 100),
                    ),
                  })
                }
                className="w-16 border border-line bg-transparent px-2 py-1 text-right text-text-primary"
                aria-label={t("sl_step_size_aria", { n: i + 1 })}
              />
              <span className="text-text-dim">{t("sl_pct_at")}</span>
              <input
                type="number"
                min={1}
                max={1000}
                value={r.atPct}
                onChange={(e) =>
                  setRung(i, { atPct: Math.max(1, Number(e.target.value)) })
                }
                className="w-20 border border-line bg-transparent px-2 py-1 text-right text-text-primary"
                aria-label={t("sl_step_gain_aria", { n: i + 1 })}
              />
              <span className="text-text-dim">{t("sl_pct_gain")}</span>
              <button
                type="button"
                onClick={() => onChange(rungs.filter((_, n) => n !== i))}
                className="ml-auto text-[10px] tracking-[0.14em] text-text-dim uppercase transition-colors hover:text-negative"
              >
                {t("common_remove")}
              </button>
            </li>
          ))}
          <li className="flex items-center gap-2 pt-1 font-ui text-[11.5px] text-text-dim">
            {/* The consequence, not a field. */}
            {t("sl_leaves_running", { pct: Math.round(left * 100) })}
          </li>
          {sold >= 1 ? (
            <li className="font-ui text-[11.5px] text-warning">
              {t("sl_sells_everything")}
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
// Keyed by the exit's own label key rather than by its English words, so the
// lookup cannot break when the label is translated.
const EXIT_COPY: Record<string, { on: TranslationKey; off: TranslationKey }> = {
  sl_take_profit: { on: "exit_tp_on", off: "exit_tp_off" },
  sl_stop_loss: { on: "exit_sl_on", off: "exit_sl_off" },
  sl_trailing_stop: { on: "exit_trail_on", off: "exit_trail_off" },
  sl_breakeven: { on: "exit_be_on", off: "exit_be_off" },
};

const COMPLIANCE_CHOICES: {
  id: ComplianceProfile;
  labelKey: TranslationKey;
  helpKey: TranslationKey;
}[] = [
  { id: "none", labelKey: "compliance_none", helpKey: "compliance_none_help" },
  {
    id: "shariah",
    labelKey: "compliance_shariah",
    helpKey: "compliance_shariah_help",
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
  /** Already translated — `requirements` takes the translator. */
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
 * What the author actually settled, as the composer reports it.
 *
 * This used to be read out of the raw sentence with a regex, because every exit
 * comes back from the compiler populated — it clamps and defaults — so the
 * draft alone cannot distinguish "take profit at 25% because I said so" from
 * "take profit at 25% because nobody said otherwise". The regex was crude on
 * purpose and the cost was capped at one unasked question.
 *
 * The cost turned out not to be capped. A sentence reading "stop loss when it
 * reaches 50% drawdown" contains the word "stop", so the checklist marked the
 * stop settled and asked nothing — while the stop that compiled measured from
 * a different reference point than the one described. The word was present; the
 * agreement was not, and searching text cannot tell those apart.
 *
 * The model reading the sentence knew all along. It is asked now, and this
 * reads its answer.
 *
 * `sizeStated` is not in the server's list because sizing never reaches the
 * compiler at all — {@link readSizing} parses it here. The flag is the fact of
 * that parse having succeeded, which is the same claim, evidenced instead of
 * guessed at a second time.
 */
export interface Settled {
  /** Exit field names the author named. @see ComposeProvenance.stated */
  stated: string[];
  /** Whether a per-trade size was read out of something the author wrote. */
  sizeStated: boolean;
}

/** Nothing settled yet — what an author who has not spoken has agreed to. */
export const NOTHING_SETTLED: Settled = { stated: [], sizeStated: false };

/**
 * Engine field names, in the words the author sees them under.
 *
 * The server reports which exit it adjusted by its own field name, and telling
 * someone "takeProfitPct was adjusted" names a variable rather than the control
 * sitting on their screen.
 */
const EXIT_FIELD_LABEL: Record<string, TranslationKey> = {
  takeProfitPct: "sl_take_profit",
  stopLossPct: "sl_stop_loss",
  trailingStopPct: "sl_trailing_stop",
  breakevenAfterPct: "sl_breakeven",
  maxHoldDays: "sl_time_limit",
};

/**
 * The minimum a trade executor needs before it can act, in the order it needs
 * them: what makes it buy, where it gets out on the way up, where it gets out
 * on the way down, and how much it may commit.
 *
 * Cadence and bar size are NOT in this list. Both have engine-wide defaults
 * that are correct for the overwhelming majority of strategies (daily bars,
 * hourly wake-ups), and neither can make a position unsafe on its own.
 */
function requirements(
  limits: Limits,
  settled: Settled,
  t: Translate,
): Requirement[] {
  const active = limits.rules.filter((r) => r.enabled !== false);
  const { takeProfitPct, stopLossPct } = limits.exits;

  return [
    {
      key: "entry",
      label: t("req_entry"),
      state: active.length > 0 ? "met" : "missing",
      detail:
        active.length === 0
          ? t("req_entry_none")
          : active.length === 1
            ? t("req_entry_one")
            : t("req_entry_many", { count: active.length }),
      ask: t("req_entry_ask"),
      // Sent verbatim as the author's own words, so they are written in the
      // reader's language — the composer answers in whatever it is given.
      chips: [
        t("req_entry_chip_1"),
        t("req_entry_chip_2"),
        t("req_entry_chip_3"),
      ],
    },
    {
      key: "profit",
      label: t("req_profit"),
      // Switching an exit off is a decision, so the checklist reports it as met
      // rather than going on asking for a value the author has deliberately
      // removed. "+0%" would also read as a target of zero, which is the one
      // thing it does not mean.
      state:
        takeProfitPct <= 0 || settled.stated.includes("takeProfitPct")
          ? "met"
          : "assumed",
      detail: takeProfitPct > 0 ? `+${takeProfitPct}%` : t("req_off"),
      ask: t("req_profit_ask", { pct: takeProfitPct }),
      chips: [
        t("req_profit_chip_1"),
        t("req_profit_chip_2"),
        t("req_profit_chip_3"),
      ],
    },
    {
      key: "stop",
      label: t("req_stop"),
      state:
        stopLossPct <= 0 || settled.stated.includes("stopLossPct")
          ? "met"
          : "assumed",
      detail: stopLossPct > 0 ? `−${stopLossPct}%` : t("req_off"),
      ask: t("req_stop_ask", { pct: stopLossPct }),
      chips: [t("req_stop_chip_1"), t("req_stop_chip_2"), t("req_stop_chip_3")],
    },
    {
      key: "size",
      label: t("req_size"),
      state: settled.sizeStated ? "met" : "assumed",
      detail: t("req_size_detail", {
        amount: money(limits.positionUsd),
        count: limits.tradesPerCycle,
      }),
      ask: t("req_size_ask", {
        amount: money(limits.positionUsd),
        book: money(CAPITAL_USD),
      }),
      chips: [t("req_size_chip_1"), t("req_size_chip_2"), t("req_size_chip_3")],
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
  const m =
    /\$\s?([\d,]+(?:\.\d+)?)\s*(?:k\b)?[^.]{0,24}?(?:per trade|a trade|each trade|per position|per entry)/i.exec(
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
  const clamped = Math.min(
    Math.max(
      Math.round(usd / MIN_POSITION_USD) * MIN_POSITION_USD,
      MIN_POSITION_USD,
    ),
    CAPITAL_USD,
  );
  return { ...limits, positionUsd: clamped };
}

/** One line of the exchange. */
function TurnRow({ turn }: { turn: Turn }) {
  const you = turn.role === "you";
  const t = useT();
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
        {t(you ? "sl_you" : "sl_desk")}
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
 * The two entry shapes only a sentence can build.
 *
 * READ-ONLY, AND THAT IS THE COMPROMISE. Either/or groups and two-stage entries
 * have no editor — building one would be a screen of its own — so for a while
 * the builder simply dropped them, which made the composer's best work
 * unreachable from the flow that produces it. Carrying them without showing
 * them would have been worse: a condition that decides trades and cannot be
 * seen is the exact failure the rest of this step exists to prevent.
 *
 * So they are shown, and they can be REMOVED. Remove is the one edit that
 * needs no editor and cannot produce something incoherent, and it means nobody
 * is stuck with a group they did not want. Changing one is a sentence away.
 */
function ComposedOnly({
  anyOf,
  setup,
  catalogue,
  timeframe,
  onClearAnyOf,
  onClearSetup,
}: {
  anyOf?: DetectionRule[][];
  setup?: SetupSpec;
  /** The rule specs, for labels — a DetectionRule carries a key, not a name. */
  catalogue: RuleSpec[];
  timeframe: Timeframe;
  onClearAnyOf: () => void;
  onClearSetup: () => void;
}) {
  const t = useT();
  const groups = (anyOf ?? []).filter((g) => g.length > 0);
  if (groups.length === 0 && !setup) return null;

  // A rule the catalogue does not carry still has to render. It cannot be
  // labelled, so it prints its key — ugly, and better than a row that silently
  // disappears from a condition that will still be evaluated.
  const label = (r: DetectionRule) => {
    const spec = catalogue.find((c) => c.key === r.key);
    return spec
      ? `${ruleLabel(spec, timeframe, t)} ${r.op === "lte" ? "≤" : "≥"} ${r.value}${spec.unit}`
      : `${r.key} ${r.op === "lte" ? "≤" : "≥"} ${r.value}`;
  };

  return (
    <div className="mb-3 border border-grid">
      {groups.length > 0 ? (
        <div className="border-b border-grid px-4 py-3 last:border-b-0">
          <div className="flex items-baseline justify-between gap-4">
            <h4 className="font-mono text-[9.5px] tracking-[0.14em] text-text-dim uppercase">
              {t("sl_anyof_title")}
            </h4>
            <button
              type="button"
              onClick={onClearAnyOf}
              className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase transition-colors hover:text-text-primary"
            >
              {t("sl_composed_remove")}
            </button>
          </div>
          {groups.map((g, i) => (
            <p
              key={i}
              className="pt-1.5 font-ui text-[12.5px] leading-relaxed text-text-primary"
            >
              {g.map(label).join(t("sl_anyof_or"))}
            </p>
          ))}
        </div>
      ) : null}

      {setup ? (
        <div className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-4">
            <h4 className="font-mono text-[9.5px] tracking-[0.14em] text-text-dim uppercase">
              {t("sl_setup_title")}
            </h4>
            <button
              type="button"
              onClick={onClearSetup}
              className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase transition-colors hover:text-text-primary"
            >
              {t("sl_composed_remove")}
            </button>
          </div>
          <p className="pt-1.5 font-ui text-[12.5px] leading-relaxed text-text-primary">
            {setup.arm.map(label).join(", ")}
          </p>
          <p className="pt-0.5 font-ui text-[11.5px] leading-relaxed text-text-dim">
            {t("sl_setup_expires", { bars: setup.expiresAfterBars })}
            {setup.invalidateIf?.length
              ? ` ${t("sl_setup_invalidate", { rules: setup.invalidateIf.map(label).join(", ") })}`
              : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** A question worth one turn, with answers worth one tap. */
interface Ask {
  text: string;
  chips: string[];
}

/**
 * What to ask next, if anything.
 *
 * THE LEDGER OUTRANKS THE CHECKLIST, and the order is the whole point. The
 * checklist asks about fields nobody filled in — a size, a target — and those
 * questions were the only ones this step could ask. A misread clause is a
 * different kind of gap: the author DID say something, it was heard, and it
 * produced a rule answering a different question. Asking about a default while
 * a stated instruction sits misread is answering the easier question first.
 *
 * The gate is the checklist's own: a question earns its turn only if two
 * different answers compile to two different strategies. `unsupported` is the
 * one that had to be argued about. No reply makes the engine able to measure an
 * Ichimoku cloud, so asking looks like theatre — but the author can put
 * SOMETHING ELSE in its place, and that substitution is a different strategy,
 * which clears the gate. The wording carries the weight: it offers a
 * replacement rather than inviting a reword, because rewording will not work
 * and implying otherwise sends someone in circles.
 *
 * The frequency argues for it too. Asked for a change against a vocabulary of
 * levels, the model does not quietly reach for the nearest rule — it says it
 * cannot, every time it was probed. So `unsupported` is where a dropped
 * instruction actually lands, and a state that never asks is a state where the
 * author's own words go quiet.
 *
 * Still one question per turn, still derived rather than generated, and it
 * never blocks: the draft is on screen either way.
 */
function nextQuestion(clauses: Clause[], reqs: Requirement[], t: Translate): Ask | null {
  const misread = clauses.find((c) => c.status === "reinterpreted");
  if (misread) {
    return {
      text: t("sl_ask_reinterpreted", { phrase: misread.phrase }),
      // Sent verbatim as the author's own words, like every other chip here.
      chips: [
        t("sl_ask_reint_chip_1"),
        t("sl_ask_reint_chip_2"),
        t("sl_ask_reint_chip_3"),
      ],
    };
  }

  const dropped = clauses.find((c) => c.status === "unsupported");
  if (dropped) {
    return {
      text: t("sl_ask_unsupported", { phrase: dropped.phrase }),
      chips: [t("sl_ask_unsup_chip_1"), t("sl_ask_unsup_chip_2")],
    };
  }

  const lost = clauses.find((c) => c.status === "unclear");
  // No chips: the answer is whatever that phrase was supposed to mean, and
  // three guesses at it would be putting words in someone's mouth.
  if (lost) return { text: t("sl_ask_unclear", { phrase: lost.phrase }), chips: [] };

  const gap = reqs.find((r) => r.state !== "met");
  return gap?.ask ? { text: gap.ask, chips: gap.chips ?? [] } : null;
}

/**
 * The sentence back, clause by clause.
 *
 * WHY EVERY CLAUSE AND NOT JUST THE PROBLEMS. A list of only the trouble reads
 * as a list of errors, and most of these are not errors — a clamped target and
 * a reinterpreted phrase are things the author may well want, once they know.
 * Showing the honoured clauses beside them is what makes the flagged ones
 * legible as "here is what happened to each thing you said" instead of "here is
 * what you got wrong", and it is the only way to see an omission: a clause you
 * wrote that produced nothing is visible only against the ones that did.
 *
 * Nothing here blocks. The strategy on screen is the strategy either way.
 */
function ClauseLedger({ clauses }: { clauses: Clause[] }) {
  const t = useT();
  if (clauses.length === 0) return null;

  // Order follows the SENTENCE, not severity. Someone reads this against what
  // they typed, and resorting it by badness breaks that correspondence for the
  // sake of a ranking they did not ask for.
  return (
    <ul className="mb-3 border border-grid">
      {clauses.map((c, i) => (
        <li
          key={`${i}-${c.phrase}`}
          className="flex items-baseline gap-2.5 border-b border-grid px-4 py-2 last:border-b-0"
        >
          <span
            aria-hidden
            className={`mt-1.5 inline-block size-1.5 shrink-0 rounded-full ${CLAUSE_DOT[c.status]}`}
          />
          <span className="min-w-0">
            <span className="font-ui text-[12.5px] text-text-primary">{c.phrase}</span>
            <span className="pl-2 font-mono text-[9.5px] tracking-[0.1em] text-text-muted uppercase">
              {t(CLAUSE_LABEL[c.status])}
            </span>
            {c.detail ? (
              <span className="block pt-0.5 font-ui text-[11.5px] leading-relaxed text-text-dim">
                {c.detail}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Colour carries the same meaning it does in the checklist above: accent for
 * settled, warning for live-but-unchosen, negative for cannot.
 *
 * `reinterpreted` takes the warning colour rather than the negative one on
 * purpose. Nothing failed — a rule was set and it will trade. What is wrong is
 * only that it may not be the one described, and painting that as an error
 * would train people to dismiss it.
 */
const CLAUSE_DOT: Record<Clause["status"], string> = {
  honoured: "bg-accent",
  adjusted: "bg-warning",
  reinterpreted: "bg-warning",
  unsupported: "bg-negative",
  unclear: "bg-text-muted",
};

const CLAUSE_LABEL: Record<Clause["status"], TranslationKey> = {
  honoured: "sl_clause_honoured",
  adjusted: "sl_clause_adjusted",
  reinterpreted: "sl_clause_reinterpreted",
  unsupported: "sl_clause_unsupported",
  unclear: "sl_clause_unclear",
};

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
  const t = useT();

  return (
    <div className="mt-4 border border-grid">
      <div className="flex items-center justify-between gap-4 border-b border-grid px-4 py-2.5">
        <h4 className="font-mono text-[9.5px] tracking-[0.14em] text-text-dim uppercase">
          {t("sl_before_trade")}
        </h4>
        <span
          className={`font-mono text-[9.5px] tracking-[0.1em] uppercase ${
            open === 0 ? "text-accent" : "text-text-muted"
          }`}
        >
          {open === 0
            ? t("sl_all_set")
            : t("sl_still_assumed", { count: open })}
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
              <span className="truncate font-ui text-[12.5px] text-text-primary">
                {r.label}
              </span>
            </span>
            <span
              className={`shrink-0 text-right font-mono text-[11.5px] ${
                r.state === "missing" ? "text-negative" : "text-text-secondary"
              }`}
            >
              {r.detail}
              {r.state === "assumed" ? (
                <span className="pl-1.5 text-[9.5px] tracking-[0.1em] text-text-muted uppercase">
                  {t("sl_assumed")}
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

const PRESETS: { labelKey: TranslationKey; promptKey: TranslationKey }[] = [
  { labelKey: "preset_dip", promptKey: "preset_dip_prompt" },
  { labelKey: "preset_calm", promptKey: "preset_calm_prompt" },
  { labelKey: "preset_deep", promptKey: "preset_deep_prompt" },
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
  const t = useT();
  // Never `t(r.labelKey)` directly: at any non-daily timeframe the bare label
  // omits the one thing that decides what the number means.
  const label = ruleLabel(r, timeframe, t);
  const basisNote = ruleBasisNote(r, timeframe, t);
  // Bounds as they apply at THIS bar size. The spec's own min/max/step are
  // written in daily terms and stay the base; a percent-of-price rule on
  // 15-minute bars gets a range a fifteen-minute move can actually reach.
  //
  // Widened to hold whatever value is already set, never narrowed onto it. The
  // composer clamps to the DAILY table whatever bar size it composed at, so it
  // can hand back a 3% trend floor on 15-minute bars — outside the scaled range
  // and still what the author asked for. A slider whose max sits under its own
  // value reports a number nobody chose, so the range gives way, not the value.
  const scaled = scaleRule(r, timeframe);
  const bounds = {
    ...scaled,
    min: Math.min(scaled.min, r.value),
    max: Math.max(scaled.max, r.value),
  };
  // Fraction of the track left of the thumb, for the accent fill. WebKit has no
  // native "progress" element on a range, so the filled portion is painted as a
  // hard-stop gradient behind the thumb.
  const fillPct =
    bounds.max > bounds.min
      ? Math.min(100, Math.max(0, ((r.value - bounds.min) / (bounds.max - bounds.min)) * 100))
      : 0;
  // What the window is in wall-clock time. The label says "14 × 15m"; this says
  // what nobody should have to work out from it.
  const span = ruleSpan(r, timeframe, t);
  return (
    <div className="grid gap-3 border-b border-grid px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_220px_96px_58px] sm:items-center sm:gap-5">
      <div className="min-w-0">
        <p
          className={`font-mono text-[12px] ${on ? "text-text-primary" : "text-text-muted"}`}
        >
          {label}{" "}
          <span className="text-text-dim">
            {t(r.op === "gte" ? "rule_at_least" : "rule_at_most")}
          </span>
        </p>
        <p className="pt-0.5 font-ui text-[11.5px] leading-relaxed text-text-dim">
          {t(r.helpKey)}
          {span ? (
            <span className="text-text-muted">{t("sl_window", { span })}</span>
          ) : null}
        </p>
        {basisNote ? (
          <p className="pt-0.5 font-ui text-[11px] leading-relaxed text-text-muted">
            {basisNote}
          </p>
        ) : null}
      </div>
      <input
        type="range"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={r.value}
        disabled={!on}
        onChange={(e) => onChange({ value: Number(e.target.value) })}
        aria-label={label}
        className="rule-slider w-full accent-accent disabled:opacity-40"
        style={
          on
            ? {
                background: `linear-gradient(to right, var(--color-accent) ${fillPct}%, var(--color-grid-strong) ${fillPct}%)`,
              }
            : undefined
        }
      />
      <NumberEntry
        value={r.value}
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
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
          on
            ? "border-accent text-accent"
            : "border-grid text-text-muted hover:text-text-secondary"
        }`}
      >
        {t(on ? "sl_on" : "sl_off")}
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
  labelKey,
  value,
  min,
  max,
  suffix,
  resumeAt,
  onChange,
}: {
  // The KEY rather than the label: EXIT_COPY is looked up on it, and a lookup
  // keyed on translated words would miss in every language but English.
  labelKey: TranslationKey;
  value: number;
  min: number;
  max: number;
  suffix: string;
  resumeAt: number;
  onChange: (n: number) => void;
}) {
  const off = value <= 0;
  const t = useT();
  const label = t(labelKey);
  const fillPct =
    max > min
      ? Math.min(100, Math.max(0, (((off ? min : value) - min) / (max - min)) * 100))
      : 0;

  return (
    <div className="grid gap-3 border-b border-grid px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_220px_96px_58px] sm:items-center sm:gap-5">
      <div className="min-w-0">
        <p className="font-mono text-[12px] text-text-primary">{label}</p>
        <p className="pt-0.5 font-ui text-[11.5px] leading-relaxed text-text-dim">
          {t(
            EXIT_COPY[labelKey]?.[off ? "off" : "on"] ??
              (off ? "exit_generic_off" : "exit_generic_on"),
          )}
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
        aria-label={t("sl_slider_aria", { label })}
        className="rule-slider w-full accent-accent disabled:opacity-30"
        style={
          off
            ? undefined
            : {
                background: `linear-gradient(to right, var(--color-accent) ${fillPct}%, var(--color-grid-strong) ${fillPct}%)`,
              }
        }
      />
      {off ? (
        <span className="text-right font-mono text-[12px] text-text-dim">
          {t("sl_off")}
        </span>
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
          sign={labelKey === "sl_stop_loss" ? "−" : "+"}
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
        {t(off ? "sl_on" : "sl_off")}
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
  const t = useT();

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
    <div
      className={`text-right ${disabled ? "text-text-muted" : "text-accent"}`}
    >
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
          aria-label={t("sl_value_aria", { label })}
          size={1}
          className="tnum w-[7ch] border-b border-transparent bg-transparent text-right outline-none transition-colors hover:border-grid-strong focus:border-accent disabled:cursor-not-allowed"
        />
        {isMoney ? null : <span aria-hidden>{unit}</span>}
      </div>
      {clamped === null ? null : (
        <p className="pt-0.5 font-mono text-[9px] tracking-[0.06em] text-warning uppercase">
          {clamped === max
            ? t("sl_max_clamp", { value: fmt(max, unit) })
            : t("sl_min_clamp", { value: fmt(min, unit) })}
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
      <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
        {label}
      </p>
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
      <p className="pt-2.5 font-ui text-[11.5px] leading-relaxed text-text-dim">
        {help}
      </p>
    </div>
  );
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export { CAPITAL_USD, RWA_RULES };
