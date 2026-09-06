"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Modal } from "@/components/modal";
import {
  ComposedOnly,
  ExitChip,
  RuleChip,
  ScaleOutLadder,
} from "@/components/setLimits";
import {
  AddPlanCard,
  DEFAULT_EXITS,
  DEFAULT_TIMEFRAME,
  RWA_RULES,
  TIMEFRAMES,
  rescaleRuleValue,
  rulesForClass,
  timeframesForClass,
  toPayload,
  type RuleSpec,
  type Timeframe,
} from "@/components/buildStrategy";
import { Pill, PillRow } from "@/components/wizard";
import { FieldNote, InfoDot, PRIMARY, SECONDARY } from "@/components/kit";
import { useT } from "@/lib/i18n";
import {
  getAgentFunding,
  updateAgentStrategy,
  type AddPlan,
  type DetectionRule,
  type ExitRules,
  type SetupSpec,
  type StrategyRow,
  type AgentMandate,
} from "@/lib/api";

/**
 * "Edit strategy" — the owner changing their own recipe, in place.
 *
 * WHY THIS IS A DIALOG AND NOT THE CHAT.
 *
 * The button used to open the agent thread, which is the right surface for
 * "should I be taking profit sooner" and the wrong one for "set the stop to
 * 8%". The second is a question with a known answer: routing it through a model
 * call, a proposed diff and a round of approval charges three steps for a value
 * the owner already has in mind, and the thread is where they end up either
 * way. The conversation is still there and still applies a proposal through the
 * same backend function — this is the short path to the same act.
 *
 * WHAT IT EDITS, AND WHAT IT DELIBERATELY DOES NOT
 *
 * Everything here is RECIPE: the entry rules, the exits, the bar size they are
 * measured on, and how a position accumulates. The universe is not — it has its
 * own controls in the rail behind this dialog, because adding a market screens
 * it immediately and removing one must not sell. Cadence is not: it is copied
 * onto the agent at deploy and is not editable afterwards, which is why the
 * timeframe section says so out loud rather than moving a number that will not
 * move.
 *
 * NOTHING IS SENT THAT WAS NOT CHANGED. The patch is a diff against what was
 * loaded, so opening this dialog and closing it writes nothing, and an edit to
 * the take-profit cannot quietly restate the rules as a side effect.
 */
export function EditStrategyModal({
  agentId,
  strategy,
  mandate,
  isPaper = true,
  equityUsd = null,
  onClose,
  onSaved,
}: {
  agentId: number;
  /** The strategy as `getStrategy` returned it — s.*, so the recipe is whole. */
  strategy: StrategyRow;
  /**
   * The agent's own caps and capital. Sizing is read from HERE rather than
   * from the strategy row because the tick reads it from here: the mandate
   * holds a snapshot of the strategy's caps taken at creation, and it is the
   * snapshot that sizes every buy.
   */
  mandate?: AgentMandate;
  /**
   * Live agents size against the USDC in their wallet; paper agents against
   * the paper book. Decides which balance the percent is shown in dollars of.
   */
  isPaper?: boolean;
  /** The paper book's latest equity, for restating the percent in dollars. */
  equityUsd?: number | null;
  onClose: () => void;
  /** Called after a successful save, so the page behind reloads. */
  onSaved: () => void;
}) {
  const t = useT();
  const { getAccessToken } = usePrivy();

  // Every market in a strategy shares one class, and the strategy carries it —
  // so this does not have to be inferred from the resolved universe, which may
  // be empty on a discovery agent.
  const klass: "rwa" | "spot" =
    strategy.strategy_class === "spot" ? "spot" : "rwa";
  const servedTimeframes = timeframesForClass(klass);

  /**
   * Stored rules this editor cannot render, carried through untouched.
   *
   * Two ways to land here: a key the catalogue does not carry at all, and an
   * `eq` comparator, which `RuleSpec` cannot express — its slider is a floor or
   * a ceiling. Either way the rule is REAL and the agent evaluates it, so
   * dropping it on save would silently loosen a strategy while the dialog
   * reported an unrelated change. They ride along in the payload and are
   * counted in a note below.
   */
  const passthrough = useMemo<DetectionRule[]>(() => {
    const catalogue = rulesForClass(klass);
    return (strategy.rules ?? []).filter(
      (r) =>
        r.op === "eq" ||
        (!catalogue.some((c) => c.key === r.key) &&
          !RWA_RULES.some((c) => c.key === r.key)),
    );
  }, [strategy.rules, klass]);

  /**
   * The catalogue, with the stored thresholds written into it.
   *
   * Rules the strategy does not carry are present and OFF rather than absent:
   * an editor that only lists what is already set can tighten a strategy and
   * never add to it, which is half of what "edit" means. A rule stored under a
   * key this class does not normally offer is appended rather than dropped —
   * it is running, so it is editable.
   */
  const initialRules = useMemo<RuleSpec[]>(() => {
    const stored = strategy.rules ?? [];
    const base = rulesForClass(klass).map((spec) => {
      const hit = stored.find((s) => s.key === spec.key && s.op !== "eq");
      return hit
        ? { ...spec, op: hit.op as "gte" | "lte", value: hit.value, enabled: true }
        : { ...spec, enabled: false };
    });
    const extra = stored
      .filter(
        (s) => s.op !== "eq" && !base.some((b) => b.key === s.key),
      )
      .map((s): RuleSpec | null => {
        const spec = RWA_RULES.find((r) => r.key === s.key);
        return spec
          ? {
              ...spec,
              op: s.op as "gte" | "lte",
              value: s.value,
              enabled: true,
            }
          : null;
      })
      .filter((r): r is RuleSpec => r !== null);
    return [...base, ...extra];
  }, [strategy.rules, klass]);

  /**
   * The exits, defaulted for display when the column is NULL.
   *
   * A null column means the strategy is running the posture default, which is
   * not a set of values this client knows — so the numbers shown are the
   * builder's own defaults and the section says they are being set rather than
   * changed. The alternative was rendering zeros, which reads as "no stop
   * loss" for a strategy that has one.
   */
  const initialExits: ExitRules = strategy.exits ?? DEFAULT_EXITS;
  const exitsWereUnset = !strategy.exits;

  const initialTimeframe: Timeframe =
    (strategy.timeframe as Timeframe) ?? DEFAULT_TIMEFRAME;

  const [rules, setRules] = useState<RuleSpec[]>(initialRules);
  const [exits, setExits] = useState<ExitRules>(initialExits);
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [addPlan, setAddPlan] = useState<AddPlan | undefined>(
    strategy.add_plan ?? undefined,
  );
  const [anyOf, setAnyOf] = useState<DetectionRule[][] | undefined>(
    strategy.anyOf,
  );
  const [setup, setSetup] = useState<SetupSpec | undefined>(strategy.setup);

  /**
   * BUDGET. The cap is a PERCENT, and that is what the field takes. What it
   * is a percent of depends on the book: a live agent sizes every buy against
   * the USDC in its wallet at that moment, a paper agent against its paper
   * book. The line under the field says the dollars that works out to right
   * now, so the number means something before it is saved. Committed on blur
   * or Enter, so typing "1" on the way to "10" is not clamped to something
   * else.
   */
  const initialPct = mandate?.constraints?.maxPositionPct ?? 15;
  const initialTrades = mandate?.constraints?.maxTradesPerTick ?? 10;
  const [positionPct, setPositionPct] = useState<number>(initialPct);
  const [tradesPerTick, setTradesPerTick] = useState<number>(initialTrades);
  const [positionDraft, setPositionDraft] = useState<string | null>(null);
  // The live wallet's USDC, read once when the dialog opens for a live agent.
  const [walletUsdc, setWalletUsdc] = useState<number | null>(null);
  useEffect(() => {
    if (isPaper) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const f = await getAgentFunding(token, agentId);
        if (!cancelled) setWalletUsdc(f.usdc);
      } catch {
        /* the percent still saves; only the dollar restatement is missing */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPaper, agentId, getAccessToken]);
  // Paper: the book's current equity (falling back to its capital before the
  // first cycle). Live: the wallet's USDC; open positions count too, at the
  // cycle, but the restatement here is the cash that is visible to read.
  const baseUsd = isPaper ? (equityUsd ?? mandate?.capitalUsd ?? null) : walletUsdc;
  const positionUsd = baseUsd === null ? null : (baseUsd * positionPct) / 100;

  function commitPosition() {
    if (positionDraft === null) return;
    const raw = Number(positionDraft.replace(/[^\d.]/g, ""));
    setPositionDraft(null);
    if (!Number.isFinite(raw) || raw <= 0) return;
    setPositionPct(Math.min(100, Math.max(0.001, Math.round(raw * 1000) / 1000)));
  }

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setRule = (key: string, patch: Partial<RuleSpec>) =>
    setRules((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );

  /**
   * Move every percent-of-price threshold with the bar size.
   *
   * The same act `retimeframe` performs in the builder, and for the same
   * reason: "min trend ≥ 3%" carried unchanged onto 15-minute bars is not a
   * stricter version of the ask, it is a filter nothing passes. Cadence does
   * NOT follow here — it is fixed on a deployed agent — which is the one way
   * this differs from the builder, and the note below the pills says so.
   */
  const retimeframe = (to: Timeframe) => {
    if (to === timeframe) return;
    setRules((prev) =>
      prev.map((r) => ({ ...r, value: rescaleRuleValue(r, timeframe, to) })),
    );
    setTimeframe(to);
  };

  const enabled = rules.filter((r) => r.enabled !== false);
  const nextRules: DetectionRule[] = [...toPayload(enabled), ...passthrough];

  /**
   * A strategy with nothing to satisfy buys the first thing it screens.
   *
   * Refused here rather than saved and discovered later: the engine has no
   * "match nothing" state, so an empty condition set is the widest possible
   * agent wearing the name of the narrowest.
   */
  const hasEntry =
    nextRules.length > 0 || (anyOf ?? []).some((g) => g.length > 0) || !!setup;

  /**
   * What actually changed, as the request body.
   *
   * Compared against what was LOADED rather than tracked as the user types: a
   * value dragged away and back is not a change, and sending it as one would
   * put an edit in the agent's thread that nobody made.
   */
  const patch = (() => {
    const p: {
      rules?: DetectionRule[];
      anyOf?: DetectionRule[][];
      setup?: SetupSpec | null;
      exits?: ExitRules;
      timeframe?: Timeframe;
      addPlan?: AddPlan | null;
      maxPositionPct?: number;
      maxTradesPerTick?: number;
    } = {};
    const same = (a: unknown, b: unknown) =>
      JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

    if (positionPct !== initialPct) p.maxPositionPct = positionPct;
    if (tradesPerTick !== initialTrades) p.maxTradesPerTick = tradesPerTick;

    if (!same(nextRules, strategy.rules ?? [])) p.rules = nextRules;
    // Groups and setups are only ever REMOVED here — there is no control to
    // author one, so the composer's output is either kept whole or cleared.
    if (!same(anyOf, strategy.anyOf)) p.anyOf = anyOf ?? [];
    if (!same(setup, strategy.setup)) p.setup = setup ?? null;
    // Whole, never partial: the route replaces the exit set, which is what
    // lets a trailing stop be switched off. A merge cannot express "off".
    if (!same(exits, strategy.exits)) p.exits = exits;
    if (timeframe !== initialTimeframe) p.timeframe = timeframe;
    // `null` is the instruction to stop accumulating, and it is not the same
    // as leaving the plan alone — the API takes the distinction seriously.
    if (!same(addPlan, strategy.add_plan)) p.addPlan = addPlan ?? null;
    return p;
  })();

  const dirty = Object.keys(patch).length > 0;

  async function save() {
    if (!dirty || !hasEntry || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("es_sign_in"));
      await updateAgentStrategy(token, agentId, patch);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t("es_title")} variant="wide" onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-5">
        <p className="max-w-[70ch] font-ui text-[13px] leading-relaxed text-text-secondary">
          {t("es_intro")}
        </p>

        {/* ------------------------------------------------------- entry */}
        <div className="-mt-1">
          <Section title={t("es_entry")} help={t("es_entry_help")} />
        </div>

        <ComposedOnly
          anyOf={anyOf}
          setup={setup}
          catalogue={rules}
          timeframe={timeframe}
          onClearAnyOf={() => setAnyOf(undefined)}
          onClearSetup={() => setSetup(undefined)}
        />

        <div className="overflow-hidden rounded-xl border border-border bg-bg">
          {rules.map((r) => (
            <RuleChip
              key={r.key}
              rule={r}
              timeframe={timeframe}
              onChange={(p) => setRule(r.key, p)}
            />
          ))}
        </div>

        {passthrough.length > 0 ? (
          <div className="pt-2.5">
            <FieldNote>
              {t("es_passthrough", { count: passthrough.length })}
            </FieldNote>
          </div>
        ) : null}

        {hasEntry ? null : (
          <div className="pt-2.5" role="alert">
            <FieldNote tone="bad">{t("es_no_entry")}</FieldNote>
          </div>
        )}

        {/* ------------------------------------------------------- exits */}
        <Section title={t("es_exits")} help={t("es_exits_help")} />

        {exitsWereUnset ? (
          <div className="pb-2.5">
            <FieldNote tone="warn">{t("es_exits_unset")}</FieldNote>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-border bg-bg">
          <ExitChip
            labelKey="sl_take_profit"
            value={exits.takeProfitPct}
            min={2}
            max={1000}
            suffix="%"
            resumeAt={45}
            onChange={(n) => setExits({ ...exits, takeProfitPct: n })}
          />
          <ExitChip
            labelKey="sl_stop_loss"
            value={exits.stopLossPct}
            min={1}
            max={90}
            suffix="%"
            resumeAt={20}
            onChange={(n) => setExits({ ...exits, stopLossPct: n })}
          />
          <ExitChip
            labelKey="sl_trailing_stop"
            value={exits.trailingStopPct ?? 0}
            min={1}
            max={90}
            suffix="%"
            resumeAt={12}
            onChange={(n) => setExits({ ...exits, trailingStopPct: n })}
          />
          <ExitChip
            labelKey="sl_breakeven"
            value={exits.breakevenAfterPct ?? 0}
            min={1}
            max={200}
            suffix="%"
            resumeAt={5}
            onChange={(n) => setExits({ ...exits, breakevenAfterPct: n })}
          />
          <ScaleOutLadder
            rungs={exits.scaleOut ?? []}
            onChange={(next) =>
              setExits({
                ...exits,
                scaleOut: next.length > 0 ? next : undefined,
              })
            }
          />
        </div>

        {/* ------------------------------------------------ accumulation */}
        <Section
          title={t("es_accumulation")}
          help={t("es_accumulation_help")}
        />
        <AddPlanCard
          plan={addPlan}
          exits={exits}
          onChange={setAddPlan}
          strategyClass={klass}
        />

        {/* ------------------------------------------------------ budget */}
        <Section title={t("es_budget")} help={t("es_budget_help")} />
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-1 gap-3 border-b border-grid px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
            <div className="min-w-0">
              <p className="font-ui text-[13px] font-medium text-text-primary">{t("es_position_limit")}</p>
              {/* Re-keyed so the restated number fades in rather than flickers. */}
              <p
                key={`${positionPct}-${baseUsd ?? "?"}`}
                className="reveal-in pt-0.5 font-ui text-[12px] leading-relaxed text-text-dim"
              >
                {positionUsd !== null && baseUsd !== null
                  ? t(isPaper ? "es_position_of_book" : "es_position_of_wallet", {
                      usd: `$${positionUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
                      base: `$${baseUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
                    })
                  : t(isPaper ? "es_position_of_book_unknown" : "es_position_of_wallet_unknown")}
              </p>
            </div>
            <div className="flex items-baseline justify-end gap-px font-mono text-[13.5px] text-text-primary">
              <input
                type="text"
                inputMode="decimal"
                value={positionDraft ?? String(positionPct)}
                onChange={(e) => setPositionDraft(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={commitPosition}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitPosition();
                    e.currentTarget.blur();
                  }
                  if (e.key === "Escape") {
                    setPositionDraft(null);
                    e.currentTarget.blur();
                  }
                }}
                aria-label={t("es_position_limit")}
                style={{
                  width: `${Math.max(2, (positionDraft ?? String(positionPct)).length) + 0.5}ch`,
                }}
                className="tnum border-b border-transparent bg-transparent text-right outline-none transition-colors hover:border-grid-strong focus:border-accent"
              />
              <span aria-hidden>%</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="font-ui text-[13px] font-medium text-text-primary">{t("es_trades_per_cycle")}</p>
              <InfoDot label={t("es_trades_per_cycle")}>{t("es_trades_help")}</InfoDot>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-border p-0.5 sm:justify-self-end">
              <button
                type="button"
                aria-label={t("es_fewer")}
                disabled={tradesPerTick <= 1}
                onClick={() => setTradesPerTick((n) => Math.max(1, n - 1))}
                className="flex size-7 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary disabled:opacity-30 disabled:hover:bg-transparent"
              >
                −
              </button>
              <span
                key={tradesPerTick}
                className="tnum reveal-in min-w-[2ch] text-center font-mono text-[13.5px] text-text-primary"
                aria-live="polite"
              >
                {tradesPerTick}
                <span className="pl-1 font-ui text-[12px] text-text-dim">
                  {t(tradesPerTick === 1 ? "es_unit_trade" : "es_unit_trades")}
                </span>
              </span>
              <button
                type="button"
                aria-label={t("es_more")}
                disabled={tradesPerTick >= 10}
                onClick={() => setTradesPerTick((n) => Math.min(10, n + 1))}
                className="flex size-7 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary disabled:opacity-30 disabled:hover:bg-transparent"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------- timeframe */}
        <Section
          title={t("es_timeframe")}
          help={
            <>
              {t("es_timeframe_note")}
              {/* Named separately because it is the surprise: the builder moves
                  cadence with the bar size, and this dialog cannot. */}
              <span className="block pt-1.5 text-text-dim">
                {t("es_cadence_note")}
              </span>
            </>
          }
        />
        <PillRow>
          {TIMEFRAMES.map((tf) => {
            const served = servedTimeframes.includes(tf.tf);
            return (
              <Pill
                key={tf.tf}
                active={timeframe === tf.tf}
                disabled={!served}
                suffix={served ? undefined : t("sl_not_served")}
                onClick={() => retimeframe(tf.tf)}
              >
                {t(tf.labelKey)}
              </Pill>
            );
          })}
        </PillRow>
      </div>

      {/* Pinned: the body scrolls, and a Save that scrolls off the bottom of a
          laptop screen is one people cannot reach. */}
      <div className="shrink-0 border-t border-grid px-6 py-3.5">
        {error ? (
          <div className="pb-2.5" role="alert">
            <FieldNote tone="bad">{error}</FieldNote>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-4">
          <p className="min-w-0 font-ui text-[12px] leading-relaxed text-text-dim">
            {dirty ? t("es_takes_effect") : t("es_no_changes")}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} className={SECONDARY}>
              {t("es_cancel")}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || !hasEntry || busy}
              className={`${PRIMARY} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {busy ? t("es_saving") : t("es_save")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * A section heading with its explanation held behind an info mark.
 *
 * The prose that used to sit under each of these was correct and nobody read
 * it: four paragraphs between four groups of controls is a dialog you scroll
 * rather than one you use, and the reader has to pass all of it every time to
 * reach a control they already understand. The heading names the group; the
 * mark answers "what is this" for the one visit where that is still a question.
 */
function Section({ title, help }: { title: string; help: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 pt-6 pb-2.5">
      <h3 className="font-ui text-[14px] font-medium text-text-primary">{title}</h3>
      <InfoDot label={title}>{help}</InfoDot>
    </div>
  );
}
