"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  screenMarkets,
  num,
  type DiscoverySpec,
  type ScreenFilter,
  type ScreenMetric,
  type ScreenPreview,
} from "@/lib/api";
import { tokenPrice } from "@/lib/format";
import { AssetLogo } from "@/components/ui";
import {
  CHIP,
  FieldNote,
  FOCUS,
  LABEL,
  QUIET,
  SectionLabel,
  SEGMENT_ITEM,
  SEGMENT_OFF,
  SEGMENT_ON,
  SEGMENT_TRACK,
  SURFACE,
} from "@/components/kit";
import { useT, type TranslationKey } from "@/lib/i18n";

/**
 * Step 1's other half — describing a market instead of naming one.
 *
 * WHY A PANEL AND NOT A SECOND TAB
 *
 * The two are not alternatives. A strategy may pin markets AND carry a screen,
 * and the pinned ones are always traded whether or not they satisfy it — a
 * market somebody chose is a decision, and a filter does not get to overrule
 * it. Making this a tab beside the table would say the opposite.
 *
 * WHY THE MATCH COUNT IS A NETWORK CALL
 *
 * The universe is already loaded in the browser, so counting matches locally
 * would be free. It is done server-side anyway, against the same
 * `screenUniverse` the tick runs, because a predicate implemented twice agrees
 * right up until it does not — and the way that surfaces is an agent holding
 * something the preview said it would skip. One definition, two callers.
 */

/* --------------------------------------------------------------- metrics -- */

/**
 * Everything a filter can name, in the order the panel draws it.
 *
 * `unit` decides how a bound is typed and read back: money gets separators and
 * a `$`, a percentage a `%`, a ratio neither. Formatting by the metric's own
 * type rather than by a single "number" treatment is what stops a market cap
 * and a buy/sell ratio being rendered as the same kind of thing.
 */
type Unit = "usd" | "pct" | "ratio" | "count" | "hours";

interface MetricDef {
  key: ScreenMetric;
  unit: Unit;
  /** Absent where the label already says it. */
  note?: TranslationKey;
}

const SIZE: MetricDef[] = [
  { key: "marketCapUsd", unit: "usd", note: "dsc_marketCapUsd_note" },
  { key: "fdvUsd", unit: "usd" },
  { key: "liquidityUsd", unit: "usd", note: "dsc_liquidityUsd_note" },
];

const ACTIVITY: MetricDef[] = [
  { key: "volume24hUsd", unit: "usd", note: "dsc_volume24hUsd_note" },
  { key: "volume1hUsd", unit: "usd" },
  { key: "volumeToLiquidity", unit: "ratio", note: "dsc_volumeToLiquidity_note" },
  { key: "txns24h", unit: "count" },
  { key: "buySellRatio24h", unit: "ratio", note: "dsc_buySellRatio24h_note" },
  { key: "change1hPct", unit: "pct" },
  { key: "change6hPct", unit: "pct" },
  { key: "change24hPct", unit: "pct" },
];

const AGE: MetricDef[] = [
  { key: "pairAgeHours", unit: "hours", note: "dsc_pairAgeHours_note" },
];

const ALL_METRICS = [...SIZE, ...ACTIVITY, ...AGE];

/* ----------------------------------------------------------------- entry -- */

export function DiscoveryFilters({
  value,
  onChange,
}: {
  value?: DiscoverySpec;
  onChange: (next: DiscoverySpec | undefined) => void;
}) {
  // The panel IS the tab. Selecting Discovery in step 1 creates the spec, so
  // there is nothing to render here but the editor — and `value` is only
  // undefined for the instant between "Remove screen" and the caller switching
  // back to the market table.
  if (!value) return null;
  return <Editor value={value} onChange={onChange} />;
}

/**
 * What a screen starts as.
 *
 * NOT EMPTY, because the contract has two required fields and leaving them
 * unanswered would surface as a server refusal rather than as a choice. Both
 * are the cautious end: `verified` is the tier the engine has always demanded
 * of real funds, and twenty is well inside the sixty-a-cycle ceiling.
 *
 * Every metric bound DOES start unset. A screen that opened with numbers in it
 * would be asserting bounds nobody chose, and the reader would have to work out
 * which of them were theirs.
 *
 * Exported because the tab that shows this panel is what creates it — see
 * PickMarket. One definition, so the thing a click produces and the thing this
 * component expects cannot drift.
 */
export const DEFAULT_DISCOVERY: DiscoverySpec = {
  filters: [],
  minTier: "verified",
  maxCandidates: 20,
};

/* ---------------------------------------------------------------- editor -- */

function Editor({
  value,
  onChange,
}: {
  value: DiscoverySpec;
  onChange: (next: DiscoverySpec | undefined) => void;
}) {
  const t = useT();
  const preview = useScreenPreview(value);
  const [showing, setShowing] = useState(false);

  const set = (patch: Partial<DiscoverySpec>) => onChange({ ...value, ...patch });

  /** The current bound for one metric and direction, or undefined. */
  const boundOf = (key: ScreenMetric, op: "gte" | "lte"): number | undefined =>
    value.filters.find((f) => f.key === key && f.op === op)?.value;

  /**
   * Sets or clears one bound.
   *
   * CLEARING REMOVES THE FILTER rather than setting it to zero. An unset bound
   * and a bound of zero are different statements — the second is a figure
   * somebody chose, and for `lte` it is a screen that matches nothing.
   */
  const setBound = (key: ScreenMetric, op: "gte" | "lte", next: number | undefined) => {
    const rest = value.filters.filter((f) => !(f.key === key && f.op === op));
    const filters: ScreenFilter[] =
      next === undefined ? rest : [...rest, { key, op, value: next }];
    set({ filters });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-[62ch] font-ui text-[13px] leading-relaxed text-text-secondary">
          {t("dsc_intro")}
        </p>
        <button type="button" onClick={() => onChange(undefined)} className={QUIET}>
          {t("dsc_remove")}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Group title={t("dsc_group_size")}>
            {SIZE.map((m) => (
              <Range key={m.key} def={m} boundOf={boundOf} onBound={setBound} />
            ))}
          </Group>

          <Group title={t("dsc_group_age")}>
            {AGE.map((m) => (
              <Range key={m.key} def={m} boundOf={boundOf} onBound={setBound} />
            ))}
          </Group>

          <Group title={t("dsc_group_activity")}>
            {ACTIVITY.map((m) => (
              <Range key={m.key} def={m} boundOf={boundOf} onBound={setBound} />
            ))}
          </Group>
        </div>

        <div className="space-y-6">
          <TierControl value={value.minTier} onChange={(minTier) => set({ minTier })} />

          <Group title={t("dsc_group_quality")} note={t("dsc_exclude_note")}>
            <Exclusion
              label={t("dsc_exclude_stablecoins")}
              on={value.exclude?.stablecoins ?? true}
              onChange={(on) => set({ exclude: { ...value.exclude, stablecoins: on } })}
            />
            <Exclusion
              label={t("dsc_exclude_solDerivatives")}
              on={value.exclude?.solDerivatives ?? true}
              onChange={(on) => set({ exclude: { ...value.exclude, solDerivatives: on } })}
            />
            <Exclusion
              label={t("dsc_exclude_rwaImpersonators")}
              on={value.exclude?.rwaImpersonators ?? true}
              onChange={(on) => set({ exclude: { ...value.exclude, rwaImpersonators: on } })}
            />
            <Exclusion
              label={t("dsc_exclude_withoutPool")}
              note={t("dsc_exclude_withoutPool_note")}
              on={value.exclude?.withoutPool ?? true}
              onChange={(on) => set({ exclude: { ...value.exclude, withoutPool: on } })}
            />
          </Group>

          <SafetyControl value={value} onChange={set} />

          <Group title={t("dsc_cap")} note={t("dsc_cap_note")}>
            <div className="flex items-center gap-2">
              <NumberInput
                unit="count"
                value={value.maxCandidates}
                onChange={(n) =>
                  // Never cleared: the cap is required, so an empty box falls
                  // back to the default rather than producing a spec the server
                  // will refuse.
                  set({ maxCandidates: n === undefined ? 20 : Math.min(60, Math.max(1, n)) })
                }
              />
              <span className={LABEL}>{t("dsc_cap_unit")}</span>
            </div>
          </Group>
        </div>
      </div>

      <MatchCount preview={preview} showing={showing} onToggle={() => setShowing((s) => !s)} />
      {showing ? <Sample preview={preview} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------- controls -- */

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <SectionLabel>{title}</SectionLabel>
      <div className="space-y-3">{children}</div>
      {note ? <FieldNote>{note}</FieldNote> : null}
    </div>
  );
}

/**
 * One metric, with an optional floor and an optional ceiling.
 *
 * BOTH SIDES ARE BLANK BY DEFAULT AND STAY BLANK. A `0` placeholder would read
 * as a bound somebody chose — and for the "at most" side it is a screen that
 * matches nothing, which is the failure that looks like a broken feature rather
 * than a misconfigured one.
 */
function Range({
  def,
  boundOf,
  onBound,
}: {
  def: MetricDef;
  boundOf: (key: ScreenMetric, op: "gte" | "lte") => number | undefined;
  onBound: (key: ScreenMetric, op: "gte" | "lte", next: number | undefined) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-[10rem] font-ui text-[12.5px] text-text-secondary">
          {t(def.key === "change24hPct" ? "dsc_change24hPct" : (`dsc_${def.key}` as TranslationKey))}
        </span>
        <label className="flex items-center gap-1.5">
          <span className={LABEL}>{t("dsc_min")}</span>
          <NumberInput
            unit={def.unit}
            value={boundOf(def.key, "gte")}
            onChange={(n) => onBound(def.key, "gte", n)}
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className={LABEL}>{t("dsc_max")}</span>
          <NumberInput
            unit={def.unit}
            value={boundOf(def.key, "lte")}
            onChange={(n) => onBound(def.key, "lte", n)}
          />
        </label>
      </div>
      {def.note ? <FieldNote>{t(def.note)}</FieldNote> : null}
    </div>
  );
}

/**
 * A number, typed in the unit its metric is measured in.
 *
 * Kept as a STRING while it is being edited, and only converted on the way out.
 * Round-tripping through a number on every keystroke eats a lone "." and makes
 * "1.5" impossible to type, and it turns a half-typed "0.0" into 0 — a bound
 * the reader never chose.
 *
 * Hours are typed in DAYS above 48 of them, because nobody thinks about a
 * fortnight in hours, and the stored unit stays hours so the engine never has
 * to know about the convenience.
 */
function NumberInput({
  value,
  unit,
  onChange,
}: {
  value: number | undefined;
  unit: Unit;
  onChange: (next: number | undefined) => void;
}) {
  const t = useT();
  const asDays = unit === "hours";
  const shown = value === undefined ? "" : asDays ? String(value / 24) : String(value);
  const [draft, setDraft] = useState(shown);
  const focused = useRef(false);

  // Follow the value while nobody is typing — a preset click has to be visible
  // in the fields it filled — and never while they are, or the caret jumps.
  useEffect(() => {
    if (!focused.current) setDraft(shown);
  }, [shown]);

  const commit = (raw: string) => {
    setDraft(raw);
    const trimmed = raw.trim();
    if (trimmed === "") return void onChange(undefined);
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return;
    onChange(asDays ? n * 24 : n);
  };

  return (
    <span className="flex items-center gap-1">
      {unit === "usd" ? <span className="font-mono text-[11px] text-text-dim">$</span> : null}
      <input
        value={draft}
        inputMode="decimal"
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setDraft(shown);
        }}
        onChange={(e) => commit(e.target.value)}
        placeholder={t("dsc_any")}
        aria-label={t("dsc_any")}
        className={`h-8 w-[5.5rem] rounded-md border border-grid bg-transparent px-2 text-right font-mono text-[12px] tnum text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent ${FOCUS}`}
      />
      {unit === "pct" ? <span className="font-mono text-[11px] text-text-dim">%</span> : null}
      {asDays ? <span className={LABEL}>{t("dsc_unit_days")}</span> : null}
    </span>
  );
}

/**
 * How well known a token has to be.
 *
 * The live-funds consequence sits BESIDE the control rather than under a hazard
 * heading. It is the fact that decides whether this screen can trade with real
 * money at all, and the same sentence reads as an excuse in a warning box and
 * as an answer here — which is where the hesitation actually is.
 */
function TierControl({
  value,
  onChange,
}: {
  value: DiscoverySpec["minTier"];
  onChange: (next: DiscoverySpec["minTier"]) => void;
}) {
  const t = useT();
  const options: { key: DiscoverySpec["minTier"]; labelKey: TranslationKey; noteKey: TranslationKey }[] = [
    { key: "verified", labelKey: "dsc_tier_verified", noteKey: "dsc_tier_verified_note" },
    { key: "listed", labelKey: "dsc_tier_listed", noteKey: "dsc_tier_listed_note" },
    { key: "pool", labelKey: "dsc_tier_pool", noteKey: "dsc_tier_pool_note" },
  ];
  const active = options.find((o) => o.key === value);

  return (
    <div className="space-y-3">
      <SectionLabel>{t("dsc_tier")}</SectionLabel>
      <div className={SEGMENT_TRACK}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`${SEGMENT_ITEM} ${value === o.key ? SEGMENT_ON : SEGMENT_OFF} ${FOCUS}`}
          >
            {t(o.labelKey)}
          </button>
        ))}
      </div>
      {active ? <FieldNote>{t(active.noteKey)}</FieldNote> : null}
      <FieldNote>{t("dsc_tier_live_note")}</FieldNote>
    </div>
  );
}

function SafetyControl({
  value,
  onChange,
}: {
  value: DiscoverySpec;
  onChange: (patch: Partial<DiscoverySpec>) => void;
}) {
  const t = useT();
  const s = value.safety;
  const patch = (next: NonNullable<DiscoverySpec["safety"]>) =>
    onChange({ safety: { ...s, ...next } });

  return (
    <Group title={t("dsc_group_safety")} note={t("dsc_safety_note")}>
      <Exclusion
        label={t("dsc_safety_mint")}
        on={s?.mintRenounced ?? false}
        onChange={(on) => patch({ mintRenounced: on })}
      />
      <Exclusion
        label={t("dsc_safety_freeze")}
        on={s?.freezeRenounced ?? false}
        onChange={(on) => patch({ freezeRenounced: on })}
      />
      <Exclusion
        label={t("dsc_safety_lp")}
        on={s?.lpLockedOrBurned ?? false}
        onChange={(on) => patch({ lpLockedOrBurned: on })}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-ui text-[12.5px] text-text-secondary">
          {t("dsc_safety_holder")}
        </span>
        <NumberInput
          unit="pct"
          value={s?.maxTopHolderPct}
          onChange={(n) => patch({ maxTopHolderPct: n })}
        />
      </div>
    </Group>
  );
}

function Exclusion({
  label,
  note,
  on,
  onChange,
}: {
  label: string;
  note?: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked)}
          className={`size-3.5 accent-accent ${FOCUS}`}
        />
        <span className="font-ui text-[12.5px] text-text-secondary">{label}</span>
      </label>
      {note ? <FieldNote>{note}</FieldNote> : null}
    </div>
  );
}

/* --------------------------------------------------------------- preview -- */

/**
 * What this screen matches, re-asked as it is edited.
 *
 * Debounced, and every in-flight answer is discarded once a newer edit lands —
 * a slow response arriving after a fast one would otherwise overwrite the count
 * for the screen currently on screen with the count for a screen that is no
 * longer there.
 */
function useScreenPreview(spec: DiscoverySpec) {
  const { getAccessToken, authenticated } = usePrivy();
  const [state, setState] = useState<
    | { phase: "idle" }
    | { phase: "loading" }
    | { phase: "ready"; data: ScreenPreview }
    | { phase: "error"; message: string }
  >({ phase: "idle" });

  // Serialised, so the effect re-runs on a real change to the screen rather
  // than on every re-render of a new object with the same contents.
  const key = useMemo(() => JSON.stringify(spec), [spec]);

  /**
   * Held in a ref and kept OUT of the effect's deps.
   *
   * The effect calls `setState` on entry, which re-renders — so if
   * `getAccessToken` is not referentially stable across renders, listing it as a
   * dependency re-runs the effect, which sets state, which re-renders, forever.
   * The debounce timer would be cleared and restarted on every pass and the
   * request would never actually fire: a match count stuck on "Checking…" while
   * the tab burns a core.
   *
   * A ref is the fix rather than a `useCallback` at the call site, because the
   * stability of somebody else's hook is not something this component can
   * promise on their behalf.
   */
  const tokenFn = useRef(getAccessToken);
  tokenFn.current = getAccessToken;

  useEffect(() => {
    if (!authenticated) return;
    let live = true;
    setState({ phase: "loading" });
    const timer = setTimeout(async () => {
      try {
        const token = await tokenFn.current();
        if (!token || !live) return;
        const data = await screenMarkets(token, JSON.parse(key) as DiscoverySpec);
        if (live) setState({ phase: "ready", data });
      } catch (err) {
        if (live) {
          setState({
            phase: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key, authenticated]);

  return state;
}

function MatchCount({
  preview,
  showing,
  onToggle,
}: {
  preview: ReturnType<typeof useScreenPreview>;
  showing: boolean;
  onToggle: () => void;
}) {
  const t = useT();

  if (preview.phase === "idle" || preview.phase === "loading") {
    return <p className={LABEL}>{t("dsc_matching")}</p>;
  }
  if (preview.phase === "error") {
    return <FieldNote tone="bad">{t("dsc_match_failed", { message: preview.message })}</FieldNote>;
  }

  const { matched, swept, safetyPending } = preview.data;
  return (
    <div className="space-y-2 border-t border-grid pt-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={`font-mono text-[13px] ${matched === 0 ? "text-warning" : "text-accent"}`}
        >
          {matched === 0
            ? t("dsc_match_none")
            : matched === 1
              ? t("dsc_match_one")
              : t("dsc_match_many", { count: matched })}
        </span>
        <span className={LABEL}>{t("dsc_match_of", { swept })}</span>
        {matched > 0 ? (
          <button type="button" onClick={onToggle} className={QUIET}>
            {showing ? t("dsc_sample_hide") : t("dsc_sample_show")}
          </button>
        ) : null}
      </div>
      {safetyPending ? <FieldNote tone="warn">{t("dsc_safety_pending")}</FieldNote> : null}
      <FieldNote>{t("dsc_stale_note")}</FieldNote>
    </div>
  );
}

/**
 * A few of the rows that matched, and a few that just did not.
 *
 * The near-misses earn their space: "142 matched" says nothing to somebody
 * whose filter is one zero out, and the reasons here are the screen's own — the
 * same sentences the agent's cycle trace will print when it drops a token.
 */
function Sample({ preview }: { preview: ReturnType<typeof useScreenPreview> }) {
  const t = useT();
  if (preview.phase !== "ready") return null;
  const { sample, nearMisses } = preview.data;

  return (
    <div className="space-y-4">
      <div className={`${SURFACE} divide-y divide-grid`}>
        {sample.map((a) => (
          <div
            key={a.mint ?? a.symbol}
            className="grid grid-cols-1 items-center gap-x-4 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_110px_110px_90px]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <AssetLogo symbol={a.symbol} src={a.iconUrl} size={16} />
              <span className="truncate font-mono text-[12.5px] text-text-primary">
                {a.symbol}
              </span>
              {a.name ? (
                <span className="truncate font-ui text-[11px] text-text-dim">{a.name}</span>
              ) : null}
            </span>
            <span className="tnum text-right font-mono text-[12px] text-text-secondary">
              {tokenPrice(num(a.priceUsd)).display}
            </span>
            <span className="tnum text-right font-mono text-[12px] text-text-secondary">
              {money(num(a.marketCapUsd))}
            </span>
            <span
              className={`tnum text-right font-mono text-[12px] ${
                num(a.changePct) === null
                  ? "text-text-dim"
                  : num(a.changePct)! >= 0
                    ? "text-accent"
                    : "text-negative"
              }`}
            >
              {num(a.changePct) === null
                ? "—"
                : `${num(a.changePct)! >= 0 ? "+" : ""}${num(a.changePct)!.toFixed(1)}%`}
            </span>
          </div>
        ))}
      </div>

      {nearMisses.length > 0 ? (
        <div className="space-y-2">
          <SectionLabel>{t("dsc_near_misses")}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {nearMisses.map((m, i) => (
              <span key={`${m.symbol}-${i}`} className={CHIP}>
                <span className="font-mono text-text-primary">{m.symbol}</span>
                <span className="text-text-dim"> — {m.reason}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Money at a glance. Absent stays a dash — never a zero. */
function money(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

/* ------------------------------------------------------------- describing -- */

/**
 * A screen as one readable sentence.
 *
 * WHY A RUNNING AGENT NEEDS THIS AT ALL. Its markets panel lists a set, and for
 * a discovery agent that set is a RESULT — what the screen happened to match
 * this hour — not a configuration. Showing only the list would answer "what does
 * it hold" while silently dropping "and why those", which is the one question a
 * screen makes worth asking.
 *
 * Read-only and deliberately not a control. Editing a running agent's screen is
 * a different job from reading it, and offering the whole panel here would put a
 * dozen inputs where a sentence belongs.
 */
export function describeScreen(
  spec: DiscoverySpec,
  t: (k: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  const parts: string[] = [];

  // Grouped by metric so a range reads as one clause. Two separate clauses —
  // "market cap at least $5M" and "market cap at most $100M" — is how a
  // sentence stops being one.
  const byKey = new Map<ScreenMetric, { gte?: number; lte?: number }>();
  for (const f of spec.filters) {
    const entry = byKey.get(f.key) ?? {};
    entry[f.op] = f.value;
    byKey.set(f.key, entry);
  }

  for (const [key, bound] of byKey) {
    const def = ALL_METRICS.find((m) => m.key === key);
    const name = t(`dsc_${key}` as TranslationKey);
    const fmt = (n: number) => formatBound(n, def?.unit ?? "ratio", t);
    if (bound.gte !== undefined && bound.lte !== undefined) {
      parts.push(`${name} ${fmt(bound.gte)}–${fmt(bound.lte)}`);
    } else if (bound.gte !== undefined) {
      parts.push(`${name} ≥ ${fmt(bound.gte)}`);
    } else if (bound.lte !== undefined) {
      parts.push(`${name} ≤ ${fmt(bound.lte)}`);
    }
  }

  parts.push(t(`dsc_tier_${spec.minTier}` as TranslationKey));
  return parts.join(" · ");
}

/** One bound, in the unit its metric is measured in. */
function formatBound(
  n: number,
  unit: Unit,
  t: (k: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  switch (unit) {
    case "usd":
      return money(n);
    case "pct":
      return `${n}%`;
    case "hours":
      // Hours are how the engine stores it and days are how anybody says it.
      return n >= 48 ? `${Math.round(n / 24)} ${t("dsc_unit_days")}` : `${n} ${t("dsc_unit_hours")}`;
    case "count":
      return n.toLocaleString("en-US");
    case "ratio":
      return String(n);
  }
}
