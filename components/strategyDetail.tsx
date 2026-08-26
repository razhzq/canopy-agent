"use client";

import Link from "next/link";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { EquityCurve } from "@/components/charts";
import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonAgentDetail, SkeletonPanel } from "@/components/skeleton";
import { AssetLogo, Badge, Breadcrumb } from "@/components/ui";
import {
  FOCUS,
  SEGMENT_ITEM,
  SEGMENT_OFF,
  SEGMENT_ON,
  SEGMENT_TRACK,
} from "@/components/kit";
import { ModelBadge } from "@/components/modelBadge";
import { useLocale, type Locale, type Translate } from "@/lib/i18n";
import {
  getStrategy,
  getStrategyRecord,
  getStrategyTrades,
  getUniverse,
  num,
  type RecordDay,
  type RecordPosition,
  type RecordTrade,
  type StrategyRecord,
  type TradePage,
  type UniverseAsset,
} from "@/lib/api";
import { tokenPrice, tokenQty, usd } from "@/lib/format";
import { useApi } from "@/lib/useApi";

/**
 * A strategy's public page — wireframe 1b.
 *
 * PERFORMANCE IS PUBLIC; THE RECIPE IS NOT.
 *
 * The governing rule, and it costs something real: this page used to list the
 * agent's positions by symbol, which is a pleasant amount of detail and also
 * hands over what it trades. For a focused strategy that IS the strategy, and a
 * marketplace where strategies can be read is one where nobody lists a good
 * one. So the record is published by DAY — return, trades, drawdown — and
 * individual trades never appear.
 *
 * The owner is not restricted here; they simply have somewhere better. Their
 * own agent, with its positions, thread and full transcript, is the workspace.
 */

type Range = "30d" | "90d" | "all";

/**
 * The record, read three ways: what is open now, what closed, and what the
 * days themselves looked like. The curve is not among them — it is the
 * section above, because a line is the one thing here that wants the width.
 */
type View = (typeof TABS)[number];

const TABS = ["positions", "history", "days"] as const;

/** Rows per page — the same in both tables, so the pager never moves. */
const ROWS_PER_PAGE = 10;

const TAB_LABEL: Record<
  View,
  "sd_tab_positions" | "sd_tab_history" | "sd_tab_days"
> = {
  positions: "sd_tab_positions",
  history: "sd_tab_history",
  days: "sd_tab_days",
};

/**
 * Stable empty series.
 *
 * `?? []` mints a new array every render, which would make the memo below
 * recompute continuously while the record is still loading.
 */
const NO_POINTS: StrategyRecord["points"] = [];

/** Stable empty universe, for the same reason as {@link NO_POINTS}. */
const NO_ASSETS: UniverseAsset[] = [];

export function StrategyDetail({ strategyId }: { strategyId: number }) {
  const { t, locale } = useLocale();
  // `token`, not `t` — the translator holds that name in this file.
  const meta = useApi((token) => getStrategy(token, strategyId), [strategyId]);
  const record = useApi<StrategyRecord>(
    (token) => getStrategyRecord(token, strategyId),
    [strategyId],
  );
  const [range, setRange] = useState<Range>("30d");
  /**
   * Live marks for the open book.
   *
   * The record does not price anything — it reports what the agent holds and
   * what it paid. The universe is where a price comes from, the same source
   * the owner's own page marks its book against, so the two cannot disagree
   * about what a position is worth. Failure is silent and yields no marks: a
   * row then shows cost without a value, which is honest, where a value
   * carried at cost would read as flat and claim the position had not moved.
   */
  const universe = useApi(
    (token) =>
      getUniverse(
        token,
        meta.phase === "ready" ? meta.data.strategy.strategy_class : "rwa",
      ),
    [meta.phase === "ready" ? meta.data.strategy.strategy_class : null],
  );
  const marks = universe.phase === "ready" ? universe.data.assets : NO_ASSETS;
  const [view, setView] = useState<View>("positions");
  // One tab stop for the whole strip (roving tabindex, below), so the arrow
  // keys need to move focus themselves — the browser no longer will.
  const tabRefs = useRef<Record<View, HTMLButtonElement | null>>({
    positions: null,
    history: null,
    days: null,
  });

  /**
   * APG tabs: ←/→ step and wrap, Home/End jump to the ends.
   *
   * Selection FOLLOWS focus (automatic activation), which the pattern allows
   * when showing a panel is cheap — all three views are already in memory, so
   * arrowing across them costs nothing and saves a press. `preventDefault`
   * because ←/→ would otherwise scroll the page sideways.
   */
  const onTabKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.indexOf(view);
    const next =
      e.key === "ArrowRight"
        ? TABS[(i + 1) % TABS.length]
        : e.key === "ArrowLeft"
          ? TABS[(i - 1 + TABS.length) % TABS.length]
          : e.key === "Home"
            ? TABS[0]
            : e.key === "End"
              ? TABS[TABS.length - 1]
              : null;
    if (!next) return;
    e.preventDefault();
    setView(next);
    tabRefs.current[next]?.focus();
  };

  // Every hook runs before the first early return below. Placing this after
  // them meant the memo existed only once `meta` had loaded, so the hook order
  // changed between renders — which React detects and which corrupts state.
  const ready = record.phase === "ready" ? record.data : null;
  const points = ready?.points ?? NO_POINTS;

  // The curve's window. Cycles run hourly, so a day is roughly 24 readings —
  // approximate on purpose, because the alternative is filtering by timestamp
  // on a series that already arrives ordered and bounded.
  const windowed = useMemo(() => {
    if (range === "all") return points;
    const keep = range === "30d" ? 30 * 24 : 90 * 24;
    return points.slice(Math.max(points.length - keep, 0));
  }, [points, range]);

  const crumbs = (name?: string) => (
    <div className="px-5 sm:px-8 pt-6">
      <Breadcrumb
        parts={[
          { label: t("sd_crumb_agents"), href: "/agents" },
          name ?? t("sd_crumb_fallback"),
        ]}
      />
    </div>
  );

  if (meta.phase === "loading")
    return (
      <>
        {crumbs()}
        <SkeletonAgentDetail labelKey="loading_strategy" />
      </>
    );
  if (meta.phase === "signed-out")
    return (
      <>
        {crumbs()}
        <SignedOutState />
      </>
    );
  if (meta.phase === "error")
    return (
      <>
        {crumbs()}
        <ErrorState message={meta.message} onRetry={meta.reload} />
      </>
    );

  const { strategy, verification, isMine } = meta.data;
  const live = strategy.status === "published";
  // Both unpublished-with-a-record states. A draft reaches this page for a
  // non-author only when an agent is running on it, so it is a paper record in
  // exactly the sense a verifying one is — and neither can be deployed.
  const onPaper =
    strategy.status === "verifying" || strategy.status === "draft";
  const days = verification.day;

  // null means the API did not send a daily breakdown at all — an older build.
  // Distinct from an empty array, which genuinely means no trading days. The
  // difference matters: "no days" is a claim about the agent, and making it
  // from a missing field would be the page inventing a fact.
  const daily = Array.isArray(ready?.daily) ? ready.daily : null;
  const capital = ready?.capitalUsd ?? 0;

  const equity = points.length > 0 ? points[points.length - 1].equityUsd : null;
  const ret =
    equity === null || capital === 0
      ? null
      : ((equity - capital) / capital) * 100;
  const drawdown = maxDrawdownPct(points.map((p) => p.equityUsd));
  // The server's count when it sends one. The fallback sums the day table the
  // old way, and stays only for a backend that predates the field — it is the
  // derivation that kept getting this wrong, not a second opinion worth having.
  const trades30 =
    ready?.trades30 ??
    (daily ?? [])
      .filter((d) => withinDays(d.day, 30))
      .reduce((s, d) => s + d.trades, 0);
  const perDay = days > 0 ? trades30 / Math.min(days, 30) : 0;
  // The array when we have it, the count when the record only reports one —
  // the tab badge must not claim zero holdings for a page still loading them.
  const openCount = ready?.positions?.length ?? ready?.openPositions ?? 0;

  return (
    <>
      {crumbs(strategy.name)}

      {/* ------------------------------------------------------------ head */}
      <section className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 px-5 sm:px-8 pt-4 pb-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-[28px] leading-none text-text-primary">
              {strategy.name}
            </h1>
            {/* Straight after the name, ahead of the state badges: what it is
                made of, before what it is currently doing. */}
            <ModelBadge model={strategy.model} />
            {live ? <Badge tone="accent">{t("sd_badge_listed")}</Badge> : null}
            {/* Draft and verifying are both paper, and the page says so the
                same way for both. A draft only reaches a non-author at all
                once an agent is running on it, so "Paper" is a statement
                about a real record rather than about an empty shell. */}
            {onPaper ? <Badge tone="muted">{t("sd_badge_paper")}</Badge> : null}
            {strategy.status === "delisted" ? (
              <Badge tone="warning">{t("sd_badge_delisted")}</Badge>
            ) : null}
            {isMine ? <Badge tone="muted">{t("sd_badge_yours")}</Badge> : null}
          </div>
          <p className="font-mono text-[10.5px] tracking-[0.06em] text-text-dim uppercase">
            {/* A draft has neither of the first two — it has only when it was
                created, which for a draft with an agent on it IS when the
                record started. */}
            {t("sd_meta", {
              class: strategy.strategy_class,
              fee: strategy.fee_pct,
              date: since(
                strategy.verification_started_at ??
                  strategy.published_at ??
                  strategy.created_at ??
                  null,
                locale,
              ),
            })}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {isMine && ready?.agentId ? (
            <Link
              href={`/workspace/${ready.agentId}?tab=chat`}
              className="flex h-11 items-center border border-border px-5 font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase transition-colors hover:border-accent hover:text-accent"
            >
              {t("sd_open_workspace")}
            </Link>
          ) : null}
          {live ? (
            <Link
              href={`/deploy/describe?strategy=${strategy.id}`}
              className="flex h-11 items-center border border-accent bg-accent-wash px-6 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
            >
              {t("sd_deploy_this")}
            </Link>
          ) : (
            <Link
              href="/build/new"
              className="flex h-11 items-center border border-accent bg-accent-wash px-6 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
            >
              {t("sd_create_own")}
            </Link>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------- stats */}
      <section className="border-y border-grid px-5 sm:px-8 py-6">
        <div className="flex flex-wrap gap-x-12 gap-y-5">
          <Stat
            label={t("sd_return")}
            value={ret === null ? "—" : signedPct(ret)}
            tone={ret === null ? "neutral" : ret >= 0 ? "accent" : "negative"}
          />
          {/* The record agent's own capital, off the record endpoint — the same
              figure Return is measured against, so the two cannot disagree.
              This used to read `strategy.aum_usd`, which is an aggregate the
              LIST query computes and the detail route does not select, so it
              arrived undefined and rendered "$NaN".
              Just "Capital", not "Capital deployed": on a paper run nothing is
              deployed, and the head already carries a Paper run badge saying
              so. The plain noun is true of both books. */}
          <Stat
            label={t("sd_capital")}
            value={ready === null ? "—" : money(capital)}
          />
          <Stat
            label={t("sd_max_drawdown")}
            value={drawdown === 0 ? "—" : `−${drawdown.toFixed(2)}%`}
            tone={drawdown > 0 ? "negative" : "neutral"}
          />
          <Stat label={t("sd_trades_30d")} value={String(trades30)} />
        </div>
      </section>

      {/* ----------------------------------------------------- performance */}
      {/* THE CURVE GETS THE FULL WIDTH, ALONE.
      
          It is the question a visitor arrives with and the only reading that
          exists before the agent has opened anything, so it is not one tab
          among three — it is the section, and the two tables below are the
          working behind it. A line is also the one thing on this page that
          gets better with width; a table does not. */}
      <section className="border-b border-grid px-5 sm:px-8 py-7">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <h2 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
            {t("sd_tab_performance")}
          </h2>
          <div className={SEGMENT_TRACK}>
            {(["30d", "90d", "all"] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`${SEGMENT_ITEM} ${FOCUS} ${
                  range === r ? SEGMENT_ON : SEGMENT_OFF
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {record.phase === "loading" ? (
          <SkeletonPanel labelKey="loading_record" />
        ) : record.phase === "error" ? (
          <ErrorState message={record.message} onRetry={record.reload} />
        ) : windowed.length < 2 ? (
          <div className="border border-grid bg-panel px-5 sm:px-8 py-10 text-center">
            <p className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
              {t("sd_not_enough_title")}
            </p>
            <p className="mx-auto max-w-[46ch] pt-2 font-ui text-[13px] leading-relaxed text-text-secondary">
              {t("sd_not_enough_body")}
            </p>
          </div>
        ) : (
          <div className="border border-grid p-4">
            <EquityCurve
              values={windowed.map((p) => p.equityUsd)}
              baseline={capital}
              height={220}
            />
            <div className="flex items-center justify-between pt-3 font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
              <span>{t("sd_cycle_n", { seq: windowed[0].tickSeq })}</span>
              <span className="text-text-muted">{t("sd_dashed_line")}</span>
              <span>
                {t("sd_cycle_n", {
                  seq: windowed[windowed.length - 1].tickSeq,
                })}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* --------------------------------- what is on offer | the two tables */}
      {/* The terms of the listing on the left, the record's two tables on the
          right. The facts are six short lines and a table is a table, so the
          columns are sized to what they hold rather than split evenly.

          Positions and days share one frame because they are the same book
          read two ways — what is open now, and what the days behind the curve
          were. Stacked, the second one was a scroll past the first for a
          reader who only wanted one of them. */}
      <section className="grid gap-8 px-5 sm:px-8 py-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* ------------------------------------------- public information -- */}
        <div className="min-w-0">
          <h2 className="pb-3.5 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            {t("sd_public_info")}
          </h2>
          <div>
            <Fact
              label={t("sd_fact_class")}
              value={strategy.strategy_class.toUpperCase()}
            />
            <Fact
              label={t("sd_fact_status")}
              value={t(
                days === 1 ? "sd_status_days_one" : "sd_status_days_many",
                {
                  status: t(
                    live
                      ? "sd_status_listed"
                      : onPaper
                        ? "sd_status_paper"
                        : "sd_status_delisted",
                  ),
                  count: days,
                },
              )}
            />
            <Fact
              label={t("sd_fact_trades_day")}
              value={perDay > 0 ? `~${perDay.toFixed(1)}` : "—"}
            />
            <Fact
              label={t("sd_fact_win_rate")}
              value={
                ready?.winRatePct === null || ready?.winRatePct === undefined
                  ? "—"
                  : `${ready.winRatePct.toFixed(0)}%`
              }
              note={
                ready
                  ? t("sd_closed_note", { count: ready.closedPositions })
                  : undefined
              }
            />
            <Fact label={t("sd_fact_custody")} value={t("sd_custody_value")} />
            <Fact
              label={t("sd_fact_creator_fee")}
              value={t("sd_creator_fee_value", { pct: strategy.fee_pct })}
              last
            />
          </div>

          {/* Inside the column, boxed — it is a term of the listing, not a
              footnote about the page. */}
          <p className="mt-5 border border-grid-strong p-3.5 font-ui text-[12px] leading-relaxed text-text-secondary">
            {t("sd_private_note")}
          </p>
        </div>

        {/* ------------------------------------------------- the two books -- */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div
              role="tablist"
              aria-label={t("sd_record_tabs")}
              className={SEGMENT_TRACK}
            >
              {TABS.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  id={`sd-tab-${v}`}
                  ref={(el) => {
                    tabRefs.current[v] = el;
                  }}
                  aria-selected={view === v}
                  aria-controls={`sd-view-${v}`}
                  // Roving tabindex: Tab reaches the strip once and lands on
                  // the selected tab, then Tab leaves it for the panel. A tab
                  // strip that costs a press per tab to walk past is a tab
                  // strip nobody tabs past.
                  tabIndex={view === v ? 0 : -1}
                  onClick={() => setView(v)}
                  onKeyDown={onTabKey}
                  className={`${SEGMENT_ITEM} ${FOCUS} ${
                    view === v ? SEGMENT_ON : SEGMENT_OFF
                  }`}
                >
                  {t(TAB_LABEL[v])}
                  {/* The count rides on the tab, so a visitor knows whether it
                      is worth opening before they open it. */}
                  {v === "positions" && openCount > 0 ? (
                    <span className="tnum text-[9.5px] text-text-muted">
                      {openCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {/* One line of provenance for whichever table is showing. */}
            <span className="font-mono text-[9.5px] tracking-[0.12em] text-text-muted uppercase">
              {view === "positions"
                ? openCount === 1
                  ? t("sd_holdings_one")
                  : t("sd_holdings_many", { count: openCount })
                : view === "history"
                  ? t("sd_trades_note")
                  : t("sd_by_day_note")}
            </span>
          </div>

          {/* ------------------------------------------------- positions -- */}
          {view === "positions" ? (
            <div
              role="tabpanel"
              id="sd-view-positions"
              aria-labelledby="sd-tab-positions"
              tabIndex={0}
              className={FOCUS}
            >
              {ready === null ? (
                <SkeletonPanel labelKey="loading_record" />
              ) : !ready.positions || ready.positions.length === 0 ? (
                <p className="border border-grid bg-panel px-6 py-8 text-center font-ui text-[13px] text-text-secondary">
                  {t("sd_no_positions")}
                </p>
              ) : (
                <>
                  {/* Said once, plainly. The entry price is the author's own
                      execution — a deployer starting today gets their own. */}
                  <p className="max-w-[78ch] pb-4 font-ui text-[12.5px] leading-relaxed text-text-dim">
                    {t("sd_holdings_note")}
                  </p>

                  <div className="overflow-x-auto border border-grid">
                    <div className="min-w-[600px]">
                      <div
                        className={`${BOOK_COLS} border-b border-grid px-4 py-2.5 font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase`}
                      >
                        <span>{t("sd_col_asset")}</span>
                        <span className="text-right">
                          {t("sd_col_quantity")}
                        </span>
                        <span className="text-right">{t("sd_col_cost")}</span>
                        <span className="text-right">{t("sd_col_value")}</span>
                        <span className="text-right">{t("sd_col_pnl")}</span>
                      </div>
                      {ready.positions.map((p) => (
                        <PositionRow
                          key={`${p.symbol}-${p.openedAt}`}
                          p={p}
                          marks={marks}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {/* --------------------------------------------------- history -- */}
          {view === "history" ? (
            <div
              role="tabpanel"
              id="sd-view-history"
              aria-labelledby="sd-tab-history"
              tabIndex={0}
              className={FOCUS}
            >
              {/* Its own component so its request lives and dies with the tab:
                  a visitor who never opens History never asks the API for it,
                  and the page it was left on is not state the whole page has
                  to carry. */}
              <TradeHistory strategyId={strategyId} marks={marks} />
            </div>
          ) : null}

          {/* ------------------------------------------------------ days -- */}
          {view === "days" ? (
            <div
              role="tabpanel"
              id="sd-view-days"
              aria-labelledby="sd-tab-days"
              tabIndex={0}
              className={FOCUS}
            >
              {record.phase === "loading" ? (
                <SkeletonPanel labelKey="loading_record" />
              ) : record.phase === "error" ? (
                <ErrorState message={record.message} onRetry={record.reload} />
              ) : daily === null ? (
                // The API answered without a daily breakdown. Saying so beats
                // claiming the agent has never traded.
                <p className="border border-grid bg-panel px-6 py-8 text-center font-ui text-[13px] leading-relaxed text-text-secondary">
                  {t("sd_no_daily")}
                </p>
              ) : daily.length === 0 ? (
                <p className="border border-grid bg-panel px-6 py-8 text-center font-ui text-[13px] text-text-secondary">
                  {t("sd_no_cycles")}
                </p>
              ) : (
                <DayTable daily={daily} />
              )}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------- bits -- */

/**
 * One open holding: what it cost, what it is worth, and the gap.
 *
 * The public book used to be quantity and a holding period, which does not
 * say the one thing a reader opens a record to learn — whether the position
 * is up or down. Cost comes from the record; the mark comes from the
 * universe. A position the universe cannot price shows its cost and says so
 * rather than carrying cost forward as value, which would render as flat.
 */
function PositionRow({
  p,
  marks,
}: {
  p: RecordPosition;
  marks: UniverseAsset[];
}) {
  const { t } = useLocale();
  const qty = Number(p.qty);
  const cost = p.costUsd === undefined ? null : Number(p.costUsd);
  // One lookup, two uses: the mark, and the icon the same row should wear.
  const asset = marks.find((a) => a.symbol === p.symbol);
  const mark = asset?.priceUsd ?? null;
  const value = mark === null ? null : mark * qty;
  const pnl = value === null || cost === null ? null : value - cost;
  const pnlPct =
    value === null || cost === null || cost <= 0
      ? null
      : ((value - cost) / cost) * 100;
  const entry = cost !== null && qty > 0 ? cost / qty : null;

  return (
    <div
      className={`${BOOK_COLS} border-b border-grid px-4 py-2.5 last:border-b-0`}
    >
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          {/* The mark's own icon when the universe has one — there are five
              hundred-odd tokens and only a dozen ship a bundled ticker file.
              AssetLogo falls back to a monogram, so a row is never iconless. */}
          <AssetLogo
            symbol={p.symbol}
            issuer={asset?.issuer}
            src={asset?.iconUrl}
          />
          <span className="truncate font-mono text-[12.5px] text-text-primary">
            {p.symbol}
          </span>
        </span>
      </span>
      <Money value={qty === 0 ? "—" : tokenQty(qty, mark)} />
      <Money
        value={cost === null ? "—" : usd(cost)}
        note={
          entry === null
            ? null
            : t("sd_at_price", { price: tokenPrice(entry).display })
        }
      />
      <Money
        value={value === null ? t("sd_not_priced") : usd(value)}
        note={
          mark === null
            ? null
            : t("sd_at_price", { price: tokenPrice(mark).display })
        }
        muted={value === null}
      />
      <Delta usd={pnl} pct={pnlPct} />
    </div>
  );
}

/**
 * One closed trade: what it cost, what it returned, and the result.
 *
 * Proceeds are not a column on the record — they are the cost plus what the
 * trade realised, which is the same arithmetic the owner's history does from
 * a fill. Derived rather than sent, so the two cannot drift apart.
 */
function TradeRow({ tr, marks }: { tr: RecordTrade; marks: UniverseAsset[] }) {
  const { t } = useLocale();
  const asset = marks.find((a) => a.symbol === tr.symbol);
  const qty = Number(tr.qty);
  const cost = tr.costUsd === undefined ? null : Number(tr.costUsd);
  const realised = tr.realizedUsd === undefined ? null : Number(tr.realizedUsd);
  const proceeds = cost === null || realised === null ? null : cost + realised;
  const entry = cost !== null && qty > 0 ? cost / qty : null;
  const exit = proceeds !== null && qty > 0 ? proceeds / qty : null;

  return (
    <div
      className={`${BOOK_COLS} border-b border-grid px-4 py-2.5 last:border-b-0`}
    >
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <AssetLogo
            symbol={tr.symbol}
            issuer={asset?.issuer}
            src={asset?.iconUrl}
          />
          <span className="truncate font-mono text-[12.5px] text-text-primary">
            {tr.symbol}
          </span>
          {tr.underlying ? (
            <span className="shrink-0 font-mono text-[10px] text-text-dim">
              {tr.underlying}
            </span>
          ) : null}
        </span>
        <span className="block pt-0.5 font-ui text-[11px] text-text-dim">
          {t("sd_closed_after", {
            held: span(tr.openedAt, tr.closedAt, t),
            ago: span(tr.closedAt, null, t),
          })}
        </span>
      </span>
      <Money value={qty === 0 ? "—" : tokenQty(qty, exit)} />
      <Money
        value={cost === null ? "—" : usd(cost)}
        note={
          entry === null
            ? null
            : t("sd_at_price", { price: tokenPrice(entry).display })
        }
      />
      <Money
        value={proceeds === null ? "—" : usd(proceeds)}
        note={
          exit === null
            ? null
            : t("sd_at_price", { price: tokenPrice(exit).display })
        }
      />
      <Delta usd={realised} pct={tr.returnPct} />
    </div>
  );
}

/** A figure with the price behind it underneath. Dollars lead. */
function Money({
  value,
  note,
  muted = false,
}: {
  value: string;
  note?: string | null;
  muted?: boolean;
}) {
  return (
    <span className="text-right">
      <span
        className={`tnum block font-mono text-[12.5px] ${
          muted ? "text-text-muted" : "text-text-secondary"
        }`}
      >
        {value}
      </span>
      {note ? (
        <span className="tnum block pt-0.5 font-mono text-[11px] text-text-dim">
          {note}
        </span>
      ) : null}
    </span>
  );
}

/**
 * A result in dollars with its percentage under it.
 *
 * Dollars lead for the reason the owner's book gives: −6% is a rounding error
 * on one position and the worst loss on the book on another, and a percentage
 * alone cannot be weighed against the rest.
 */
function Delta({
  usd: amount,
  pct,
}: {
  usd: number | null;
  pct: number | null;
}) {
  return (
    <span
      className={`text-right ${
        amount === null
          ? "text-text-muted"
          : amount > 0
            ? "text-accent"
            : amount < 0
              ? "text-negative"
              : "text-text-secondary"
      }`}
    >
      <span className="tnum block font-mono text-[12.5px]">
        {amount === null ? "—" : usd(amount, { sign: true })}
      </span>
      {pct === null ? null : (
        <span className="tnum block pt-0.5 font-mono text-[11px] opacity-70">
          {signedPct(pct)}
        </span>
      )}
    </span>
  );
}

const BOOK_COLS =
  "grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] items-center gap-x-4";

/**
 * The days behind the curve, paged.
 *
 * The curve above says the same thing as a shape; this says it as figures,
 * with the two things a line cannot show — how many trades a day took, and
 * how far it fell inside the day before it recovered.
 *
 * Its page lives here rather than on the page, so switching tabs and coming
 * back starts at the top, which is where a reader of a record wants to be.
 */
function DayTable({ daily }: { daily: RecordDay[] }) {
  const [page, setPage] = useState(0);
  const { t } = useLocale();

  const pages = Math.max(1, Math.ceil(daily.length / ROWS_PER_PAGE));
  // Clamped, not reset: a poll returning fewer days must not strand the
  // reader on a page that no longer exists.
  const at = Math.min(page, pages - 1);
  const from = at * ROWS_PER_PAGE;
  const rows = daily.slice(from, from + ROWS_PER_PAGE);

  return (
    <div className="border border-grid">
      {/* Its own scroller: four columns of figures must not make the page
          scroll sideways on a narrow screen (§9). */}
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div
            className={`${DAY_COLS} border-b border-grid px-4 py-2.5 font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase`}
          >
            <span>{t("sd_col_day")}</span>
            <span className="text-right">{t("sd_col_return")}</span>
            <span className="text-right">{t("sd_col_trades")}</span>
            <span className="text-right">{t("sd_col_max_dd")}</span>
          </div>
          {rows.map((d) => (
            <DayRow key={d.day} day={d} />
          ))}
        </div>
      </div>

      {pages > 1 ? (
        <Pager
          page={at}
          pages={pages}
          from={from + 1}
          to={from + rows.length}
          total={daily.length}
          onPage={setPage}
        />
      ) : null}
    </div>
  );
}

function DayRow({ day: d }: { day: RecordDay }) {
  const { t, locale } = useLocale();
  // Compared on the DATE, not on the rendered word: `dayLabel` is translated,
  // and matching its output against the English "Today" would light the row
  // in one language only.
  const today = daysAgo(d.day) <= 0;
  // A day with a single reading has no change to measure — distinct from a day
  // that moved and came back to zero.
  const measurable = d.cycles >= 2 || d.realizedUsd !== 0;

  return (
    <div
      className={`${DAY_COLS} border-b border-grid px-4 py-2.5 last:border-b-0 ${
        today ? "bg-accent-wash" : ""
      }`}
    >
      <span className="flex min-w-0 items-baseline gap-2">
        <span
          className={`truncate font-mono text-[12.5px] ${
            today ? "text-accent" : "text-text-primary"
          }`}
        >
          {dayLabel(d.day, t, locale)}
        </span>
        {/* Cycles run, so a day it held rather than traded still reads as a
            day it was working. */}
        <span className="shrink-0 font-mono text-[9.5px] tracking-[0.06em] text-text-muted uppercase">
          {d.cycles === 1
            ? t("sd_cycles_one")
            : t("sd_cycles_many", { count: d.cycles })}
        </span>
      </span>
      <span
        className={`tnum text-right font-mono text-[12.5px] ${
          !measurable
            ? "text-text-dim"
            : d.returnPct > 0
              ? "text-accent"
              : d.returnPct < 0
                ? "text-negative"
                : "text-text-secondary"
        }`}
      >
        {measurable ? signedPct(d.returnPct) : "—"}
      </span>
      <span className="tnum text-right font-mono text-[12.5px] text-text-secondary">
        {d.trades}
      </span>
      <span className="tnum text-right font-mono text-[12.5px] text-text-dim">
        {num(d.maxDrawdownPct) === null
          ? "—"
          : `−${num(d.maxDrawdownPct)!.toFixed(2)}%`}
      </span>
    </div>
  );
}

const DAY_COLS =
  "grid grid-cols-[minmax(0,1fr)_110px_120px_120px] items-center gap-x-4";

/**
 * The closed book, paged.
 *
 * A ROUND TRIP IS A TRADE. The endpoint publishes closed positions rather than
 * fills, so a row here is one complete idea — what it bought, how long it held
 * it, and how it ended — instead of a leg of one.
 *
 * PERCENTAGES, NO DOLLARS. The API does not send realised amounts or cost
 * basis, so this cannot print the author's sizing even by accident. A reader
 * gets the result of the trade; a deployer's own dollars will be their own.
 */
function TradeHistory({
  strategyId,
  marks,
}: {
  strategyId: number;
  marks: UniverseAsset[];
}) {
  const { t } = useLocale();
  const [page, setPage] = useState(0);
  const trades = useApi(
    (token) => getStrategyTrades(token, strategyId, page, ROWS_PER_PAGE),
    [strategyId, page],
  );

  /**
   * The last page that actually landed, held across the next one's request.
   *
   * `useApi` blanks to `loading` on every dep change, which for a pager means
   * the table and the control under it vanish on each press — the reader loses
   * the row of numbers they are aiming at, mid-aim. Keeping the previous page
   * up (dimmed) means only the rows change.
   */
  const shown = useRef<TradePage | null>(null);
  if (trades.phase === "ready") shown.current = trades.data;
  const data = trades.phase === "ready" ? trades.data : shown.current;

  if (trades.phase === "error" && data === null)
    return <ErrorState message={trades.message} onRetry={trades.reload} />;
  if (data === null) return <SkeletonPanel labelKey="loading_record" />;

  if (data.total === 0)
    return (
      <p className="border border-grid bg-panel px-6 py-8 text-center font-ui text-[13px] text-text-secondary">
        {t("sd_no_trades")}
      </p>
    );

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const from = data.page * data.pageSize;

  return (
    <div
      className={`border border-grid transition-opacity ${
        trades.phase === "loading" ? "opacity-50" : ""
      }`}
      aria-busy={trades.phase === "loading"}
    >
      {/* Its own scroller: five columns of figures must not make the page
          scroll sideways on a narrow screen (§9). */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div
            className={`${BOOK_COLS} border-b border-grid px-4 py-2.5 font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase`}
          >
            <span>{t("sd_col_asset")}</span>
            <span className="text-right">{t("sd_col_quantity")}</span>
            <span className="text-right">{t("sd_col_cost")}</span>
            <span className="text-right">{t("sd_col_proceeds")}</span>
            <span className="text-right">{t("sd_col_result")}</span>
          </div>
          {data.trades.map((tr) => (
            <TradeRow
              key={`${tr.symbol}-${tr.closedAt}`}
              tr={tr}
              marks={marks}
            />
          ))}
        </div>
      </div>

      {pages > 1 ? (
        <Pager
          page={data.page}
          pages={pages}
          from={from + 1}
          to={from + data.trades.length}
          total={data.total}
          onPage={setPage}
        />
      ) : null}
    </div>
  );
}

/**
 * A numbered pager for a table inside a frame.
 *
 * NUMBERS, NOT NEWER/OLDER. A relative pair tells you which way you are about
 * to move and nothing else — not how much there is, not where you are in it,
 * and it cannot take you back to where you started in one press. A reader
 * checking a record wants both facts at once ("30 of 90, I am on page 3"),
 * and page 1 has to be one click away from page 9.
 *
 * The window is fixed at five numbers with an ellipsis on whichever side is
 * elided, so the control never changes width as the reader walks it — a pager
 * that reflows under the cursor makes people miss the page they aimed at.
 */
function Pager({
  page,
  pages,
  from,
  to,
  total,
  onPage,
}: {
  /** Zero-based. */
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
  onPage: (next: number) => void;
}) {
  const { t } = useLocale();
  const window = pageWindow(page, pages);

  return (
    <nav
      aria-label={t("sd_pager_label")}
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-grid px-4 py-2.5"
    >
      <span
        className="tnum font-mono text-[9.5px] tracking-[0.12em] text-text-muted uppercase"
        aria-live="polite"
      >
        {t("sd_page_range", { from, to, total })}
      </span>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          aria-label={t("sd_page_prev")}
          className={PAGE_STEP}
        >
          ‹
        </button>

        {window.map((n, i) =>
          n === null ? (
            // Not a button and not focusable — an ellipsis is a statement that
            // pages were left out, not a place you can go.
            <span
              key={`gap-${i}`}
              aria-hidden
              className="px-1 font-mono text-[10px] text-text-muted"
            >
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              aria-label={t("sd_page_n", { n: n + 1 })}
              aria-current={n === page ? "page" : undefined}
              className={`${PAGE_STEP} ${
                n === page ? "bg-accent-wash text-accent" : ""
              }`}
            >
              {n + 1}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages - 1}
          aria-label={t("sd_page_next")}
          className={PAGE_STEP}
        >
          ›
        </button>
      </div>
    </nav>
  );
}

/** One page control. Square, so a row of them reads as one ruler. */
const PAGE_STEP = `tnum flex size-6 items-center justify-center rounded-md font-mono text-[10px] text-text-dim transition-colors hover:text-text-primary disabled:pointer-events-none disabled:opacity-30 ${FOCUS}`;

/**
 * Which page numbers to show: at most five, with `null` where a run was
 * elided. Always includes the first and last page — those are the two a
 * reader reaches for by name.
 */
function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i);
  // Clamped so the run keeps its length at both ends — the control must not
  // narrow to two numbers just because the reader walked to the last page.
  const start = Math.min(Math.max(page - 1, 1), pages - 4);
  const run = [start, start + 1, start + 2];
  const out: (number | null)[] = [0];
  // An ellipsis only where a run was actually elided; next to the number it
  // would have hidden, it is a lie about one missing page.
  if (start > 1) out.push(null);
  out.push(...run);
  if (start + 2 < pages - 2) out.push(null);
  out.push(pages - 1);
  return out;
}

function Fact({
  label,
  value,
  note,
  last = false,
}: {
  label: string;
  value: string;
  note?: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-4 py-2.5 ${
        last ? "" : "border-b border-grid"
      }`}
    >
      <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
        {label}
      </span>
      <span className="truncate font-mono text-[12.5px] text-text-primary">
        {value}
        {note ? (
          <span className="pl-2 text-[10px] text-text-muted">{note}</span>
        ) : null}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "accent" | "negative" | "neutral";
}) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[9.5px] tracking-[0.12em] text-text-dim uppercase">
        {label}
      </p>
      <p
        className={`tnum font-mono text-[22px] leading-none whitespace-nowrap ${
          tone === "accent"
            ? "text-accent"
            : tone === "negative"
              ? "text-negative"
              : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- helpers -- */

function maxDrawdownPct(values: number[]): number {
  if (values.length === 0) return 0;
  let peak = values[0];
  let worst = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) worst = Math.max(worst, ((peak - v) / peak) * 100);
  }
  return worst;
}

/**
 * Is this day inside the trailing `n`-day window?
 *
 * Counted in calendar days off {@link daysAgo}, so a 30-day window is today
 * plus the 29 before it — the same 30 rows a reader would count off the table.
 */
function withinDays(day: string, n: number): boolean {
  const ago = daysAgo(day);
  return Number.isFinite(ago) && ago >= 0 && ago < n;
}

/** Whole days between a date and now. Negative is impossible here; 0 is today. */
/**
 * Whole days between a record day and the reader's today.
 *
 * CALENDAR DAYS, NOT ELAPSED MILLISECONDS. `new Date("2026-08-27")` is UTC
 * midnight, and subtracting it from `Date.now()` measures a gap in time rather
 * than a distance in days — east of Greenwich that gap is negative for the
 * first eight hours of every day, so today came back as −1 and yesterday as 0,
 * and `dayLabel` printed "Today" on both of them.
 *
 * Splitting the parts and building a LOCAL date compares the two calendars the
 * reader actually thinks in: today is 0, yesterday is 1, always.
 */
function daysAgo(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return Number.NaN;
  const then = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - then.getTime()) / 86_400_000);
}

function dayLabel(day: string, t: Translate, locale: Locale): string {
  const diff = daysAgo(day);
  if (diff <= 0) return t("sd_today");
  if (diff === 1) return t("sd_yesterday");
  return new Date(day).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-GB", {
    day: "numeric",
    month: "short",
  });
}

function since(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-GB", {
    day: "numeric",
    month: "short",
  });
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function signedPct(n: number): string {
  return `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(2)}%`;
}

/**
 * A holding's size, trimmed to something readable.
 *
 * Token quantities arrive as decimal strings with twelve places; printing them
 * whole turns a table of holdings into a table of noise.
 */

/** How long a position has been open. Its age is the part that is public. */
/**
 * A span in the coarsest unit that still says something: hours under a day,
 * days above it. `to` null measures to now — "how long ago", same shape as
 * "how long for", which is why one function serves both columns.
 */
function span(from: string, to: string | null, t: Translate): string {
  const end = to === null ? Date.now() : new Date(to).getTime();
  const h = Math.floor((end - new Date(from).getTime()) / 3_600_000);
  if (h < 1) return t("sd_span_hour");
  if (h < 24) return t("sd_span_hours", { n: h });
  return t("sd_span_days", { n: Math.floor(h / 24) });
}
