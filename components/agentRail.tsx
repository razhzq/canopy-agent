"use client";

import { AssetLogo, Rule } from "@/components/ui";
import { CHIP, FieldNote, LABEL, NUM, SECONDARY, SURFACE, SectionLabel } from "@/components/kit";
import { AgentFacts } from "@/components/agentFacts";
import { CopyTerms } from "@/components/copyTerms";
import { AssetCategory } from "@/components/tokenCategory";
import { ScreenChips } from "@/components/discoveryFilters";
import {
  DEFAULT_TIMEFRAME,
  RWA_RULES,
  fmt,
  ruleBasisNote,
  ruleLabel,
  withRuleParams,
  type Timeframe,
} from "@/components/buildStrategy";
import {
  selectionIssuer,
  selectionKey,
  selectionLabel,
  type AgentRow,
  type CopyLpInput,
  type DetectionRule,
  type DiscoverySpec,
  type ExitRules,
  type SetupSpec,
  type UniverseAsset,
  type UniverseSelection,
} from "@/lib/api";
import { periodsText } from "@/lib/rulePeriods";
import { tokenPrice } from "@/lib/format";
import { useT } from "@/lib/i18n";

/**
 * The agent workspace rail: the recipe, what it is pointed at, and how it runs.
 *
 * WHAT THIS IS FOR, which decides everything below it. The main column is the
 * agent's behaviour over time — the curve, the positions, what it is watching,
 * what it did. The rail is its CONFIGURATION: the three answers that do not
 * change between cycles. Anything in here that the main column already states
 * is the page repeating itself, and the rail is the half a reader skips.
 *
 * WHAT WAS WRONG WITH IT, since the fix only makes sense against the fault:
 *
 *   — Three headings in three registers. "Strategy · applies to every market"
 *     was a label with a sentence stapled on; "Or let it find its own" was
 *     lifted from the builder, where it is the second half of a choice, and in
 *     a rail it is a fragment continuing nothing; "Agent-level" was our word
 *     for it. Kit rule 7: a screen with three label treatments has no system.
 *   — One pile of chips holding four kinds of fact: entry rules, a liquidity
 *     floor, the exits, and the bar size. Chips wrap, so the reading order was
 *     not even stable across widths.
 *   — The screen as a middot-joined paragraph, breaking mid-phrase in a 420px
 *     column: "Volume against / depth ≥ 0.3". Thresholds rendered as prose.
 *   — Two actions inside the blocks they act on, the heavier of them a
 *     full-width bordered button under a section that had nothing above it to
 *     explain what it added to. Rule 5: actions are not properties.
 *   — Three facts restating the header, the equity caption and the positions
 *     table, and one — "open positions 2 / 2" — that was simply wrong.
 *
 * So: one heading register, chips grouped and labelled, the screen in the same
 * chip vocabulary as the rules, both actions in their heading rows, and a facts
 * table cut down to what lives nowhere else.
 */
export function AgentRail({
  agent,
  strategy,
  rules,
  anyOf,
  setup,
  exits,
  sells,
  timeframe,
  planSummary,
  markets,
  screen,
  entry,
  cadenceSec,
  positionCap,
  onEdit,
  onAddMarket,
  onRemoveMarket,
  removingKey,
  removeError,
  copyLp = null,
}: {
  agent: AgentRow;
  /**
   * The copy plan, on a copy LP agent. It has no rules, bar size or markets,
   * so the rail shows who it copies and on what terms instead.
   */
  copyLp?: CopyLpInput | null;
  /** Null while the recipe is still loading — the Edit action waits for it. */
  strategy: unknown | null;
  rules: DetectionRule[];
  anyOf: DetectionRule[][];
  setup?: SetupSpec;
  exits: ExitRules | null;
  /** The sell-signal conditions, phrased by the builder's own writer, or null. */
  sells: string | null;
  timeframe: Timeframe;
  /** The accumulation plan in words, or null when it takes one entry per asset. */
  planSummary: string | null;
  markets: { sel: UniverseSelection; asset: UniverseAsset | null }[];
  screen?: DiscoverySpec;
  entry: DetectionRule | null;
  cadenceSec: number | null;
  positionCap: number | null;
  onEdit: () => void;
  onAddMarket: () => void;
  onRemoveMarket: (sel: UniverseSelection) => void;
  removingKey: string | null;
  removeError: string | null;
}) {
  const t = useT();

  /**
   * Does any rule on screen already state the strategy's bar size?
   *
   * `ruleLabel` prints "(33 × 5m)" for a bar-based rule with a window, so on
   * most strategies a "Chart: 5m" chip repeats what is already in front of the
   * reader — three times over, once per rule. The chip was written for the case
   * where nothing carries a window (a strategy of pure liquidity and market-cap
   * floors), and its own comment said so while it rendered unconditionally.
   *
   * The `chart` check is the part a naive version misses: a rule pinned to
   * another chart prints "(14 × 1h)" on a 5-minute strategy, which states that
   * rule's bar size and leaves the strategy's own unsaid.
   */
  const statesTimeframe = [...rules, ...anyOf.flat(), ...(setup?.arm ?? [])].some((r) => {
    const base = RWA_RULES.find((s) => s.key === r.key);
    if (!base) return false;
    const spec = withRuleParams(base, r);
    return (
      spec.basis === "bars" && !!periodsText(spec) && (spec.chart ?? timeframe) === timeframe
    );
  });

  const hasEntry = rules.length > 0 || anyOf.length > 0;
  const hasExits = !!exits;

  return (
    <aside className="min-w-0 border-t border-grid px-5 sm:px-8 py-6 lg:border-t-0">
      {copyLp ? (
        <CopyTerms plan={copyLp} onEdit={onEdit} editable={!!strategy} />
      ) : (
      <>
      {/* ---------------------------------------------------- strategy -- */}
      {/* NO HAIRLINE ON A HEADING THAT CARRIES A CONTROL. The rule was drawn
          to fill the space between a label and the edge; with a button on that
          edge it runs INTO the button, tying the two together and leaving the
          heading looking like a form field. The gap does the separating.

          The button is a real one. It was demoted to quiet text on the argument
          that rule 6 keeps utilities quiet — but editing the strategy is not a
          utility, it is the main thing an owner comes to this rail to do, and
          shrinking it to a grey word on the right made the one action in the
          section the least visible thing in it. Rule 5 was the real complaint
          about where it sat, and moving it out of the card answered that. */}
      <Rule
        label={t("ad_sec_strategy")}
        line={false}
        right={
          // Dimmed rather than hidden while the recipe loads (rule 12): the
          // dialog edits a diff against what was fetched, so opening it against
          // nothing would present an empty recipe as this agent's.
          <button
            type="button"
            onClick={onEdit}
            disabled={!strategy}
            className={`${SECONDARY} disabled:cursor-not-allowed`}
          >
            {t("ad_edit_strategy")}
          </button>
        }
      />
      <p className={`pt-2 font-ui text-[12.5px] leading-relaxed text-text-dim`}>
        {t("ad_strategy_applies")}
      </p>

      {/* THE WATCH LEG, ABOVE THE ENTRY RULES AND VISUALLY BEFORE THEM.
          A two-stage strategy does not evaluate the rules below until this has
          happened on an earlier bar. Rendering them as one flat list would read
          as "all of these at once", which is the single-stage strategy this
          exists to be different from. */}
      {setup ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
          <p className="border-b border-grid px-3.5 py-2 font-ui text-[11.5px] font-medium text-accent">
            {t("ad_first_wait")}
          </p>
          <div className="flex flex-wrap gap-2 p-3.5">
            {setup.arm.map((r) => (
              <RuleChip key={r.key} rule={r} timeframe={timeframe} />
            ))}
          </div>
          <p className="border-t border-grid px-3.5 py-2 font-ui text-[12px] text-text-muted">
            {t("ad_then_bars", { bars: setup.expiresAfterBars })}
            {setup.invalidateIf?.length ? t("ad_then_bars_invalidate") : ""}
          </p>
        </div>
      ) : null}

      {/* ONE SURFACE, BANDED — not three cards and not one flat wrap.
          Three cards would be three bordered objects in a group where none is
          actionable (rules 2 and 3). One wrap is what this replaced. The bands
          are a genuine change of kind, which is the only thing rule 10 spends a
          hairline on; inside a band the chips are siblings and get none. */}
      <div className={`mt-4 overflow-hidden ${SURFACE}`}>
        <Band label={setup ? t("ad_then_buy") : t("ad_group_entry")}>
          {hasEntry ? (
            <>
              {rules.map((r) => (
                <RuleChip key={r.key} rule={r} timeframe={timeframe} />
              ))}
              {/* One chip per GROUP, not per member. Splitting a group into
                  loose chips would show an either/or as a row of conditions
                  indistinguishable from the ANDed ones — the owner would read
                  their strategy as stricter than it is. */}
              {anyOf.map((group) => (
                <AnyOfChip
                  key={group.map((g) => g.key).join("|")}
                  group={group}
                  timeframe={timeframe}
                />
              ))}
            </>
          ) : (
            <span className="font-ui text-[12.5px] text-text-muted">{t("ad_no_rules")}</span>
          )}
        </Band>

        {hasExits ? (
          <Band label={t("ad_group_exit")}>
            {exits.takeProfitPct > 0 ? (
              <Chip>
                {t("ad_chip_take_profit")} <Num>+{exits.takeProfitPct}%</Num>
              </Chip>
            ) : null}
            <Chip>
              {t("ad_chip_stop_loss")} <Num>−{exits.stopLossPct}%</Num>
            </Chip>
            {sells ? (
              <Chip>
                {t("ad_chip_sell_signal")} {sells}
              </Chip>
            ) : null}
          </Band>
        ) : null}

        {statesTimeframe ? null : (
          <Band label={t("ad_group_measured")}>
            <Chip>
              <Num>{timeframe}</Num>
            </Chip>
          </Band>
        )}

        {/* SIZING AND LIMITS — what "How it runs" held, inside the recipe it
            belongs to. How much each trade takes, how often it checks, whether
            it asks first, and the caps that stop it buying. The panel it came
            from sat under Markets and restated nothing else there; these are
            the strategy's own settings. */}
        {/* No top hairline: the band above already draws its bottom one. */}
        <div className="px-3.5 pt-3 pb-1">
          <SectionLabel>{t("ad_group_sizing")}</SectionLabel>
          <div className="pt-1">
            <AgentFacts agent={agent} cadenceSec={cadenceSec} positionCap={positionCap} variant="sizing" />
          </div>
        </div>

        {planSummary ? (
          <div className="border-t border-grid px-3.5 py-2.5">
            <p className={LABEL}>{t("ad_accumulation")}</p>
            <p className="pt-1 font-ui text-[12.5px] leading-relaxed text-text-primary">
              {planSummary}
            </p>
            {/* The part nobody expects, and the reason the exits above are not
                what they look like: a position averaged into three times exits
                as ONE, on the blended cost. */}
            <div className="pt-1">
              <FieldNote tone="warn">{t("ad_accumulation_warning")}</FieldNote>
            </div>
          </div>
        ) : null}
      </div>

      {/* ----------------------------------------------------- markets -- */}
      <div className="mt-6 border-t border-grid pt-5">
        <Rule
          label={t("ad_sec_markets")}
          line={false}
          right={
            <button type="button" onClick={onAddMarket} className={SECONDARY}>
              {t("ad_add_market")}
            </button>
          }
        />
        {/* The heading used to be four different sentences depending on what
            was pinned — a noun, a verb phrase, or the builder's fragment. The
            distinction they were reaching for is a fact about the list, so it
            is stated as one, under a heading that no longer moves. */}
        <p className={`pt-2 font-ui text-[12.5px] leading-relaxed text-text-dim`}>
          {markets.length === 0 && !screen
            ? t("ad_no_universe", { class: agent.strategy_class })
            : screen
              ? t("ad_markets_screened")
              : t("ad_markets_pinned")}
        </p>

        {/* The screen, above the markets it produced. For a discovery agent the
            list below is a RESULT — what matched this hour — rather than a
            configuration, so what chose it belongs above it. */}
        {screen ? (
          <div className="pt-3">
            <SectionLabel>{t("ad_group_screen")}</SectionLabel>
            <div className="pt-2">
              <ScreenChips spec={screen} />
            </div>
          </div>
        ) : null}

        {markets.length > 0 ? (
          <div className={`mt-3 overflow-hidden ${SURFACE}`}>
            {markets.map((m) => (
              <MarketRow
                key={selectionKey(m.sel)}
                label={m.asset ? `${m.asset.symbol}/USDC` : selectionLabel(m.sel)}
                asset={m.asset}
                selection={m.sel}
                entry={entry}
                // Not offered on the last one. An empty list means "every
                // market in the class", so removing it would widen the agent
                // rather than narrow it — the backend refuses, and offering a
                // button that always fails is worse than not offering one.
                onRemove={markets.length > 1 ? () => onRemoveMarket(m.sel) : undefined}
                removing={removingKey === selectionKey(m.sel)}
              />
            ))}
          </div>
        ) : null}

        {removeError ? (
          <div className="pt-3" role="alert">
            <FieldNote tone="bad">{removeError}</FieldNote>
          </div>
        ) : null}
      </div>
      </>
      )}

    </aside>
  );
}

/**
 * One labelled band of chips inside the strategy card.
 *
 * `SectionLabel` because rule 7 allows exactly one label treatment, and the
 * hairline because entry, exit and measurement are different KINDS of fact —
 * the only thing rule 10 spends a rule on.
 */
function Band({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-grid px-3.5 py-3 last:border-b-0">
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-wrap gap-2 pt-2">{children}</div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className={CHIP}>{children}</span>;
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className={NUM}>{children}</span>;
}

/** A stored rule, labelled with the spec the builder set it from. */
function RuleChip({
  rule,
  timeframe = DEFAULT_TIMEFRAME,
}: {
  rule: DetectionRule;
  timeframe?: Timeframe;
}) {
  const t = useT();
  const base = RWA_RULES.find((r) => r.key === rule.key);
  const spec = base ? withRuleParams(base, rule) : undefined;
  // A rule that does not follow the strategy's bar size says so HERE too, not
  // only in the builder. Someone reading a running 15-minute agent sees "Max
  // change on the day ≤ −4%" beside rules measured in minutes, and nothing on
  // the page tells them that one is still asking about the last 24 hours.
  const basisNote = spec ? ruleBasisNote(spec, timeframe, t) : null;
  return (
    <Chip>
      {spec ? ruleLabel(spec, timeframe, t) : rule.key}{" "}
      {rule.op === "gte" ? "≥" : rule.op === "lte" ? "≤" : "="}{" "}
      <Num>{spec ? fmt(rule.value, spec.unit) : rule.value}</Num>
      {basisNote ? (
        <span className="pl-1.5 text-text-muted" title={basisNote}>
          · {rule.key === "changePct" ? "24h" : "daily"}
        </span>
      ) : null}
    </Chip>
  );
}

/**
 * An "either of these" group.
 *
 * One chip for the whole group, with the alternatives joined by "or" and the
 * word itself given the accent — the entire difference between this and the
 * chips beside it is that ANY one of these satisfies the strategy, and that
 * distinction has to survive a glance. A group rendered as separate chips reads
 * as additional requirements, which is the opposite of what it means.
 */
function AnyOfChip({
  group,
  timeframe = DEFAULT_TIMEFRAME,
}: {
  group: DetectionRule[];
  timeframe?: Timeframe;
}) {
  const t = useT();
  return (
    <Chip>
      {group.map((rule, i) => {
        const base = RWA_RULES.find((r) => r.key === rule.key);
        const spec = base ? withRuleParams(base, rule) : undefined;
        return (
          <span key={rule.key}>
            {i > 0 ? (
              <span className="px-1 text-accent uppercase">{t("ad_anyof_or")}</span>
            ) : null}
            {spec ? ruleLabel(spec, timeframe, t) : rule.key}{" "}
            {rule.op === "gte" ? "≥" : rule.op === "lte" ? "≤" : "="}{" "}
            <Num>{spec ? fmt(rule.value, spec.unit) : rule.value}</Num>
          </span>
        );
      })}
    </Chip>
  );
}

/**
 * One market the agent may trade: what it is, what it costs, how far it is from
 * firing, and a quiet way to remove it.
 *
 * The meter is the distance to the entry rule, which only reads as a distance
 * for a one-dimensional rule (a dip) — so it renders for one and not for the
 * rest, rather than inventing a scale for rules that do not have one.
 */
function MarketRow({
  label,
  asset,
  selection,
  entry,
  onRemove,
  removing,
}: {
  label: string;
  asset: UniverseAsset | null;
  /** The universe selection, so the logo resolves exactly the way the universe
      did — issuer and identity come from the same source the rest of the page
      uses. */
  selection: UniverseSelection;
  entry: DetectionRule | null;
  /** Absent when removal is not offered — the last market, or a shared strategy. */
  onRemove?: () => void;
  removing?: boolean;
}) {
  const t = useT();
  const change = numOrNull(asset?.changePct);
  const price = numOrNull(asset?.priceUsd);

  // `changePct <= -4` — progress is how much of the fall has happened.
  const target = entry && entry.op === "lte" ? entry.value : null;
  const pct =
    target !== null && target < 0 && change !== null
      ? Math.max(0, Math.min(1, change / target))
      : null;
  const fired = pct !== null && pct >= 1;

  return (
    <div className="group border-b border-grid px-3 py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <AssetLogo
            symbol={selectionLabel(selection)}
            issuer={selectionIssuer(selection) ?? asset?.issuer}
            src={asset?.iconUrl}
            size={16}
          />
          <span className="truncate font-mono text-[12px] text-text-primary">{label}</span>
          {/* What kind of thing it is, beside what it is called. A screened
              universe is a list of tickers nobody has met. */}
          <AssetCategory asset={asset} />
        </span>
        <span
          className={`tnum shrink-0 font-mono text-[12px] ${
            change === null ? "text-text-muted" : change >= 0 ? "text-accent" : "text-negative"
          }`}
        >
          {change === null
            ? "—"
            : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}%`}
          {target !== null ? (
            <span className="pl-1 text-text-dim">{t("ad_of_target", { target })}</span>
          ) : null}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2 pt-0.5">
        <span className="truncate font-ui text-[11.5px] text-text-dim">
          {price === null ? t("ad_not_priced") : tokenPrice(price).display}
        </span>
        {/* Quiet until pointed at. A destructive control on every row competes
            with the prices, which are what the list is for. It holds the second
            line's right edge so revealing it never reflows the row. */}
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            aria-label={t("ad_remove_aria", { label })}
            title={t("ad_remove_title")}
            // MICRO's size and tracking, but a destructive hover instead of the
            // accent one — the kit's hover colour means "this is the way
            // forward", and this is the opposite.
            className="shrink-0 font-ui text-[11px] text-text-dim opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-negative disabled:opacity-40"
          >
            {t(removing ? "ad_removing" : "ad_remove")}
          </button>
        ) : null}
      </div>

      {pct !== null ? (
        <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-grid">
          <span
            className={`block h-1 rounded-full ${fired ? "bg-negative" : "bg-accent"}`}
            style={{ width: `${pct * 100}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}

/** A usable number off the wire, or null — never NaN reaching a template. */
function numOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : null;
  return n === null || !Number.isFinite(n) ? null : n;
}
