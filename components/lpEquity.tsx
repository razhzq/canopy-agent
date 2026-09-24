"use client";

import { useMemo, useState } from "react";
import { Fig } from "@/components/equity";
import { ProfitBody } from "@/components/profitHistory";
import { SEGMENT_ITEM, SEGMENT_OFF, SEGMENT_ON, SEGMENT_TRACK, Tick } from "@/components/kit";
import { markOpenBook } from "@/lib/perf";
import { dayKey, lpDaysFromEquity, type LpDay } from "@/lib/lpDays";
import { getAgentFunding, type AgentDetail, type EquitySeries, type LpBook, type UniverseAsset } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useLocale, dateLocale, type Locale } from "@/lib/i18n";
import { bookFormat, useBookUnit, USD_FORMAT, type BookFormat } from "@/lib/bookUnit";

/**
 * A liquidity agent's performance, which is not a trading agent's.
 *
 * WHY THIS PANEL EXISTS AT ALL. The equity panel judges an agent the way a desk
 * judges a trader: Sharpe, Sortino, profit factor, drawdown — every one of them
 * a statement about the distribution of discrete bets. Liquidity provision is
 * not a sequence of bets. It is capital parked in a price range earning a share
 * of the flow through it, and the questions that decide whether it is working
 * are: what is it worth, what has it earned in fees, what did it earn today,
 * and how often does a position come out ahead. None of those appear on the
 * other panel, and most of what does appear there cannot be computed honestly
 * from a book that never takes a position in the ordinary sense.
 *
 * THE ONE NUMBER THAT TIES IT TOGETHER. "Total profit" here is the END OF THE
 * LINE on the chart — equity now minus the book's baseline — and not a sum of
 * realised and unrealised taken from somewhere else. They are nearly the same
 * figure and would disagree at the edges, and a panel whose headline contradicts
 * its own chart is worse than one that omits the headline.
 */
export function LpEquityView({
  series,
  positions,
  universe,
  unit = "USD",
  solUsd = null,
  live = null,
}: {
  series: EquitySeries | null;
  positions: AgentDetail["positions"];
  universe: UniverseAsset[];
  /** What a live book is worth NOW; see {@link LiveWorth}. Null uses the last reading. */
  live?: LiveWorth | null;
  /**
   * The unit this agent's book is actually kept in (CANOPY_127).
   *
   * "SOL" turns on the toggle below. Every figure on this panel arrives in
   * dollars either way — the book valued at `solUsd` — so switching is a
   * render choice, not a second fetch.
   */
  unit?: "USD" | "SOL";
  /** The one rate every figure here was derived at. Null hides the toggle. */
  solUsd?: number | null;
}) {
  const { t, locale } = useLocale();
  const [view, setView] = useState<"chart" | "calendar">("chart");
  const [range, setRange] = useState<LpRange>("all");
  const [scrub, setScrub] = useState<number | null>(null);
  // A choice worth offering only when there is one: a USD book has one unit,
  // and a SOL book with no readable rate cannot be converted honestly.
  const canToggle = unit === "SOL" && typeof solUsd === "number" && solUsd > 0;
  const [shownUnit, setShownUnit] = useBookUnit(canToggle);
  const base = seriesBase(series, unit);
  const fmt = bookFormat(shownUnit, solUsd, base === "sol" ? "SOL" : "USD");
  const money = fmt.money;
  const signed = fmt.signed;

  if (series === null || series.points.length === 0) return <NoRecord />;

  const f = lpFigures(series, positions, universe, base, solUsd, live);
  const shown =
    view === "calendar"
      ? f.days.map((day) => ({ day, present: true }))
      : daysInRange(f.days, range);
  const windowProfit = shown.reduce((s, d) => s + (d.present ? d.day.profitUsd : 0), 0);
  const windowPct = f.netWorthUsd - windowProfit !== 0
    ? (windowProfit / (f.netWorthUsd - windowProfit)) * 100
    : 0;

  const ranges: { key: LpRange; label: string; ok: boolean }[] = [
    { key: "7d", label: t("equity_range_7d"), ok: f.days.length >= 2 },
    { key: "30d", label: t("lp_perf_range_30d"), ok: f.days.length >= 2 },
    { key: "all", label: t("equity_range_all"), ok: true },
  ];

  /**
   * The reading follows the pointer, into the headline.
   *
   * The 34px net worth NEVER changes on a scrub — it is a now-figure, and
   * animating it against a day three weeks ago would misstate what the book is
   * worth. Only the line beneath it swaps.
   */
  const day = scrub === null ? null : shown[scrub];

  return (
    <div className="space-y-4">
      {/* THE HERO, and the same one the trading panel has: one large number and
          the controls that change what it measures. What differs is the number
          — a liquidity book's net worth is its wallet plus what its positions
          are worth, fees included — not the shape. */}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="space-y-1.5">
          <p className="font-ui text-[12.5px] text-text-dim">{t("lp_perf_net_worth")}</p>
          <Tick
            value={f.netWorthUsd}
            className="tnum block font-mono text-[34px] leading-none tracking-[-0.02em] text-text-primary"
          >
            {money(f.netWorthUsd)}
          </Tick>
          <p className="flex flex-wrap items-baseline gap-x-2">
            {/* NO `Tick` WHILE SCRUBBING. It animates on every value change, so
                dragging across thirty columns would fire thirty count-ups in
                the headline. The window figure keeps its animation at rest. */}
            {day ? (
              <span
                className={`tnum font-mono text-[13px] ${
                  day.day.profitUsd >= 0 ? "text-accent" : "text-negative"
                }`}
              >
                {signed(day.day.profitUsd)}
              </span>
            ) : (
              <Tick
                value={windowProfit}
                className={`tnum font-mono text-[13px] ${windowProfit >= 0 ? "text-accent" : "text-negative"}`}
              >
                {signed(windowProfit)} · {signedPct(windowPct)}
              </Tick>
            )}
            <span className="inline-block min-w-[9ch] font-ui text-[12px] text-text-dim">
              {day
                ? shortDay(day.day.day, locale)
                : view === "calendar"
                  ? t("lp_perf_caption_all")
                  : t(
                      range === "all"
                        ? "lp_perf_caption_all"
                        : range === "7d"
                          ? "lp_perf_caption_7d"
                          : "lp_perf_caption_30d",
                    )}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* The window. Hidden behind the calendar, which is a month at a time
              by construction and would contradict a range of "7d". */}
          {view === "chart" ? (
            <div role="group" aria-label={t("equity_range_aria")} className={SEGMENT_TRACK}>
              {ranges.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  disabled={!r.ok}
                  aria-pressed={range === r.key}
                  onClick={() => setRange(r.key)}
                  className={`${SEGMENT_ITEM} h-7 px-3 text-[12px] disabled:cursor-default disabled:opacity-40 ${
                    range === r.key ? SEGMENT_ON : SEGMENT_OFF
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ) : null}

          {/* SOL OR DOLLARS. The same book either way — this changes the
              LABELS, not the line: converting at one rate is a uniform scale,
              so the chart's shape is identical and only what the numbers are
              counted in moves.

              SOL LEADS because it is what the book actually is. The dollar
              view is a valuation of it at this moment, and an owner watching a
              still book in dollars would see it move on days it did nothing. */}
          {canToggle ? (
            <div role="group" aria-label={t("lp_perf_unit_aria")} className={SEGMENT_TRACK}>
              {(["SOL", "USD"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={shownUnit === u}
                  onClick={() => setShownUnit(u)}
                  className={`${SEGMENT_ITEM} h-7 px-3 text-[12px] ${
                    shownUnit === u ? SEGMENT_ON : SEGMENT_OFF
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          ) : null}

          {/* Graph or grid. The same series either way: one answers "is this
              going anywhere", the other "what happened on the 14th". */}
          <div role="group" className={SEGMENT_TRACK}>
            {(["chart", "calendar"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`${SEGMENT_ITEM} h-7 px-3 text-[12px] ${
                  view === v ? SEGMENT_ON : SEGMENT_OFF
                }`}
              >
                {t(v === "chart" ? "lp_perf_view_chart" : "lp_perf_view_calendar")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ONE BORDERED OBJECT (rule 3): the figures across the top, the history
          under them, one hairline between. Five across on a desktop — what the
          book is doing on the first row, what it has cost and returned on the
          second — and two across on a phone, where the ten flow as one grid so
          no row is left with an orphan. */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="grid grid-cols-2 border-b border-grid md:grid-cols-6">
          {/* FEES · VS HOLDING · PROFIT, in that order and adjacent on
              purpose: what the pool paid you, what the range cost you, and the
              net. Those three cells ARE the impermanent-loss story, which
              `lp_perf_fees_note` has had to explain in a sentence only because
              the middle term was missing from the strip.
              They do not reconcile arithmetically — vs-holding covers open
              positions only, where the other two are book-wide — and the note
              on the cell says so. */}
          <Fig
            cols={6}
            cell={0}
            label={`${t("lp_perf_fees")}${f.feesEstimated ? " *" : ""}${f.feesPartial ? " \u2020" : ""}`}
            value={f.feesUsd === null ? null : money(f.feesUsd)}
            pending={t("lp_perf_unpriced")}
            tone="accent"
            note={
              f.feesPartial
                ? t("lp_perf_fees_partial", { known: f.feesKnown, closed: f.closed })
                : t("lp_perf_fees_note")
            }
          />
          <Fig
            cols={6}
            cell={1}
            label={t("lp_perf_vs_hodl")}
            value={f.vsHodlPct === null ? null : signedPct(f.vsHodlPct)}
            pending={f.vsHodlUnreadable ? t("lp_perf_unpriced") : t("lp_perf_vs_hodl_pending")}
            // A DEAD BAND ROUND ZERO. "+0.00%" printed in the gain colour
            // claims a gain the figure does not have.
            tone={
              f.vsHodlPct === null || Math.abs(f.vsHodlPct) < 0.005
                ? "neutral"
                : f.vsHodlPct > 0
                  ? "accent"
                  : "negative"
            }
            note={
              f.vsHodlCovered < f.vsHodlOpen
                ? t("lp_perf_vs_hodl_partial", { covered: f.vsHodlCovered, open: f.vsHodlOpen })
                : t("lp_perf_vs_hodl_note")
            }
          />
          <Fig
            cols={6}
            cell={2}
            label={t("lp_perf_profit")}
            value={signed(f.profitUsd)}
            tone={f.profitUsd >= 0 ? "accent" : "negative"}
            note={t("lp_perf_profit_note", { realised: signed(f.realizedUsd) })}
          />
          <Fig
            cols={6}
            cell={3}
            label={t("lp_perf_open")}
            value={String(f.openCount)}
            note={f.openInvestedUsd > 0 ? t("lp_perf_open_note", { amount: money(f.openInvestedUsd) }) : undefined}
          />
          <Fig
            cols={6}
            cell={4}
            label={t("lp_perf_closed")}
            value={String(f.closed)}
          />
          <Fig
            cols={6}
            cell={5}
            label={t("lp_perf_win_rate")}
            value={f.winRatePct === null ? null : `${f.winRatePct.toFixed(1)}%`}
            pending={t("lp_perf_after_first_close")}
            note={
              f.winRatePct === null
                ? undefined
                : t("lp_perf_win_rate_note", { won: f.winners, closed: f.closed })
            }
          />
          <Fig
            cols={6}
            cell={6}
            label={t("lp_perf_avg_invested")}
            value={f.avgInvestedUsd === null ? null : money(f.avgInvestedUsd)}
            pending={t("lp_perf_after_first_close")}
            note={t("lp_perf_avg_invested_note")}
          />
          <Fig
            cols={6}
            cell={7}
            label={t("lp_perf_per_position")}
            value={f.perPositionUsd === null ? null : signed(f.perPositionUsd)}
            pending={t("lp_perf_after_first_close")}
            tone={(f.perPositionUsd ?? 0) >= 0 ? "accent" : "negative"}
            note={
              f.perPositionUsd === null
                ? undefined
                : t("lp_perf_per_position_note", { closed: f.closed })
            }
          />
          <Fig
            cols={6}
            cell={8}
            label={t("lp_perf_best_day")}
            value={f.bestDayUsd === null ? null : signed(f.bestDayUsd)}
            pending={t("lp_perf_after_a_day")}
            tone="accent"
            note={f.bestDay ? t("lp_perf_best_day_note", { day: f.bestDay }) : undefined}
          />
          <Fig
            cols={6}
            cell={9}
            label={t("lp_perf_earning_days")}
            value={f.days.length === 0 ? null : `${f.earningDays} / ${f.days.length}`}
            pending={t("lp_perf_after_a_day")}
            note={t("lp_perf_earning_days_note")}
          />
          {/* ELEVEN FIGURES IN A SIX-TRACK GRID would leave this one alone on
              a row; spanning two closes it at 6 + 6, and on a phone the same
              span makes it a full-width final row. */}
          <Fig
            cols={6}
            cell={10}
            span={2}
            label={t("lp_perf_monthly")}
            // GATED UNTIL THERE IS A MONTH. A six-day agent's profit multiplied
            // out to a month is the most misleading number this panel could
            // print, and nothing on the row would say it was extrapolated.
            value={f.monthlyUsd === null ? null : signed(f.monthlyUsd)}
            pending={t("lp_perf_after_30_days")}
            tone={(f.monthlyUsd ?? 0) >= 0 ? "accent" : "negative"}
            note={t("lp_perf_monthly_note", { days: f.daysLive })}
          />
        </div>

        <div className="px-5 pt-5 pb-4">
          <ProfitBody
            days={shown.map((d) => d.day)}
            present={shown.map((d) => d.present)}
            view={view}
            height={220}
            onScrub={setScrub}
            // THE SAME FORMATTER THE HEADLINE USES. The chart carries its own
            // readings — the calendar's day cells, the axis, the tooltip — and
            // leaving it on dollars while the figures above switched would put
            // two units on one panel.
            fmt={fmt}
          />
        </div>
      </div>

      {/* THE FOOTNOTES, one marker each rather than one marker meaning
          "something is off": * is modelled, † is incomplete. The partial-fee
          caveat used to live only in a hover-only note, so at rest the figure
          looked whole. */}
      {f.feesEstimated ? (
        <p className="font-ui text-[11px] leading-relaxed text-text-muted">
          {t("lp_perf_estimated")}
        </p>
      ) : null}
      {f.feesPartial ? (
        <p className="font-ui text-[11px] leading-relaxed text-text-muted">
          {t("lp_perf_fees_partial_footnote", { known: f.feesKnown, closed: f.closed })}
        </p>
      ) : null}
      {f.vsHodlPct !== null ? (
        <p className="font-ui text-[11px] leading-relaxed text-text-muted">
          {t("lp_perf_vs_hodl_footnote")}
        </p>
      ) : null}
    </div>
  );
}

type LpRange = "7d" | "30d" | "all";

/**
 * The window a range asks for, as calendar days — INCLUDING the ones that have
 * not happened yet.
 *
 * A five-day-old book asked for thirty days used to hand back five, which the
 * chart then stretched across the whole panel: five readings drawn as though
 * they were a month, with a line sweeping the full width. The window is a
 * statement about the calendar, so the days it does not have come back marked
 * absent and are drawn as nothing at all — the five sit at the right-hand end,
 * where they are, and the line starts where the record does.
 */
function daysInRange(days: LpDay[], range: LpRange): { day: LpDay; present: boolean }[] {
  if (range === "all") return days.map((day) => ({ day, present: true }));

  const n = range === "7d" ? 7 : 30;
  const byDay = new Map(days.map((d) => [d.day, d]));
  const out: { day: LpDay; present: boolean }[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (n - 1));

  // The running total is carried across the empty stretch so an absent day
  // does not read as a book that went to zero. Nothing draws it now that the
  // cumulative line is gone, but `LpDay` requires it and a synthesised day
  // claiming zero would be a worse placeholder than the truth.
  let carried = 0;
  for (let i = 0; i < n; i += 1) {
    const key = dayKey(cursor);
    const hit = byDay.get(key);
    if (hit) carried = hit.cumulativeUsd;
    out.push({
      day:
        hit ??
        { day: key, profitUsd: 0, cumulativeUsd: carried, carried: true, source: "equity" },
      present: hit !== undefined,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** The phone's version: the same figures, four at a time, chart only. */
export function LpEquityMobile({
  series,
  positions,
  universe,
  unit = "USD",
  solUsd = null,
  live = null,
}: {
  series: EquitySeries | null;
  positions: AgentDetail["positions"];
  universe: UniverseAsset[];
  unit?: "USD" | "SOL";
  solUsd?: number | null;
  live?: LiveWorth | null;
}) {
  const { t, locale } = useLocale();
  const [scrub, setScrub] = useState<number | null>(null);
  // THE SAME PREFERENCE AS THE DESKTOP PANEL, because `useBookUnit` reads one
  // stored key. Someone who chose dollars on a laptop is not asked again on a
  // phone.
  const canToggle = unit === "SOL" && typeof solUsd === "number" && solUsd > 0;
  const [shownUnit, setShownUnit] = useBookUnit(canToggle);
  const base = seriesBase(series, unit);
  const fmt = bookFormat(shownUnit, solUsd, base === "sol" ? "SOL" : "USD");
  const money = fmt.money;
  const signed = fmt.signed;
  if (series === null || series.points.length === 0) return <NoRecord />;
  const f = lpFigures(series, positions, universe, base, solUsd, live);
  const day = scrub === null ? null : f.days[scrub];

  return (
    <div>
      <div className="px-[18px]">
        <p className="font-ui text-[12px] text-text-dim">{t("lp_perf_net_worth")}</p>
        <Tick
          value={f.netWorthUsd}
          className="tnum block pt-1 font-mono text-[28px] leading-none tracking-[-0.02em] text-text-primary"
        >
          {money(f.netWorthUsd)}
        </Tick>
        {/* THE PHONE NEEDS SOMEWHERE TO REPORT TOO. Without this line a touch
            on the chart moves a marker and says nothing — and the finger is
            already covering the column it would have labelled. */}
        <p className="flex items-baseline gap-x-2 pt-1.5">
          {day ? (
            <>
              <span
                className={`tnum font-mono text-[13px] ${
                  day.profitUsd >= 0 ? "text-accent" : "text-negative"
                }`}
              >
                {signed(day.profitUsd)}
              </span>
              <span className="font-ui text-[12px] text-text-dim">
                {shortDay(day.day, locale)}
              </span>
            </>
          ) : (
            <span className="font-ui text-[12px] text-text-dim">
              {t("lp_perf_caption_all")}
            </span>
          )}
        </p>
      </div>
      <div className="px-[18px] pt-4">
        {/* Chart only. A seven-column grid of dollar amounts does not survive a
            360px screen, and a calendar nobody can read is not a calendar. */}
        <ProfitBody days={f.days} view="chart" height={168} onScrub={setScrub} />
      </div>
      <div className="mt-4 grid grid-cols-2 border-t border-grid">
        <Fig
          cell={0}
          edges=""
          label={t("lp_perf_fees")}
          value={f.feesUsd === null ? null : money(f.feesUsd)}
          pending={t("lp_perf_unpriced")}
          tone="accent"
        />
        <Fig
          cell={0}
          edges="border-l"
          label={t("lp_perf_profit")}
          value={signed(f.profitUsd)}
          tone={f.profitUsd >= 0 ? "accent" : "negative"}
        />
        <Fig
          cell={0}
          edges="border-t"
          label={t("lp_perf_win_rate")}
          value={f.winRatePct === null ? null : `${f.winRatePct.toFixed(0)}%`}
          pending={t("lp_perf_after_first_close")}
        />
        <Fig
          cell={0}
          edges="border-t border-l"
          label={t("lp_perf_closed")}
          value={String(f.closed)}
        />
      </div>
    </div>
  );
}

/**
 * The public page's version: the chart and four figures, no calendar.
 *
 * A month grid is a reconciliation tool for someone who owns the book. A
 * visitor is asking whether the thing is worth deploying, which is a question
 * about shape — so they get the shape and the four figures that qualify it.
 */
export function LpEquityCompact({
  points,
  capitalUsd,
  lp,
  fmt = USD_FORMAT,
}: {
  points: EquitySeries["points"];
  capitalUsd: number;
  lp?: LpBook;
  /**
   * How to render amounts. Dollars by default, which is right for the public
   * strategy page: a visitor comparing strategies has no book of their own and
   * no reason to read one of them in SOL.
   */
  fmt?: BookFormat;
}) {
  const { t } = useLocale();
  const money = fmt.money;
  const signed = fmt.signed;
  const days = useMemo(() => lpDaysFromEquity(points, capitalUsd), [points, capitalUsd]);
  if (points.length === 0) return <NoRecord />;

  const profit = points[points.length - 1].equityUsd - capitalUsd;
  const winRate =
    lp && lp.closed > 0 ? (lp.winners / lp.closed) * 100 : null;

  return (
    <div>
      <ProfitBody days={days} view="chart" height={200} />
      <div className="mt-4 grid grid-cols-2 border-t border-grid sm:grid-cols-4">
        <Fig
          cell={0}
          edges=""
          label={t("lp_perf_profit")}
          value={signed(profit)}
          tone={profit >= 0 ? "accent" : "negative"}
        />
        <Fig
          cell={0}
          edges="border-l"
          label={t("lp_perf_fees")}
          value={lp ? money(lp.feesEarnedUsd + lp.claimedFeesUsd) : null}
          tone="accent"
        />
        <Fig
          cell={0}
          edges="border-t sm:border-t-0 sm:border-l"
          label={t("lp_perf_win_rate")}
          value={winRate === null ? null : `${winRate.toFixed(0)}%`}
          pending={t("lp_perf_after_first_close")}
        />
        <Fig
          cell={0}
          edges="border-t border-l sm:border-t-0"
          label={t("lp_perf_closed")}
          value={lp ? String(lp.closed) : null}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- the rail -- */

function Rail({ figures, fmt = USD_FORMAT }: { figures: LpFigures; fmt?: BookFormat }) {
  const { t } = useLocale();
  const f = figures;
  const money = fmt.money;
  const signed = fmt.signed;
  return (
    <>
      <Fig cell={0} edges="" label={t("lp_perf_closed")} value={String(f.closed)} />
      <Fig
        cell={0}
        edges="border-t"
        label={t("lp_perf_win_rate")}
        value={f.winRatePct === null ? null : `${f.winRatePct.toFixed(1)}%`}
        pending={t("lp_perf_after_first_close")}
        note={
          f.winRatePct === null
            ? undefined
            : t("lp_perf_win_rate_note", { won: f.winners, closed: f.closed })
        }
      />
      <Fig
        cell={0}
        edges="border-t"
        label={t("lp_perf_avg_invested")}
        value={f.avgInvestedUsd === null ? null : money(f.avgInvestedUsd)}
        pending={t("lp_perf_after_first_close")}
        note={t("lp_perf_avg_invested_note")}
      />
      <Fig
        cell={0}
        edges="border-t"
        label={`${t("lp_perf_fees")}${f.feesEstimated ? " *" : ""}`}
        value={f.feesUsd === null ? null : money(f.feesUsd)}
        pending={t("lp_perf_unpriced")}
        tone="accent"
        note={
          f.feesPartial
            ? t("lp_perf_fees_partial", { known: f.feesKnown, closed: f.closed })
            : t("lp_perf_fees_note")
        }
      />
      <Fig
        cell={0}
        edges="border-t"
        label={t("lp_perf_profit")}
        value={signed(f.profitUsd)}
        tone={f.profitUsd >= 0 ? "accent" : "negative"}
        note={t("lp_perf_profit_note", { realised: signed(f.realizedUsd) })}
      />
      <Fig
        cell={0}
        edges="border-t"
        label={t("lp_perf_monthly")}
        // GATED UNTIL THERE IS A MONTH. A six-day agent's profit multiplied out
        // to a month is the most misleading number this panel could print, and
        // the reader has no way to know it was extrapolated.
        value={f.monthlyUsd === null ? null : signed(f.monthlyUsd)}
        pending={t("lp_perf_after_30_days")}
        tone={(f.monthlyUsd ?? 0) >= 0 ? "accent" : "negative"}
        note={t("lp_perf_monthly_note", { days: f.daysLive })}
      />
      <Fig
        cell={0}
        edges="border-t"
        // NOT "expected value", which the reference calls it. Expectancy is a
        // forecast built on a stationary win/loss distribution; LP returns are
        // path-dependent on pool volume and price, so the same arithmetic here
        // would be a prediction we cannot stand behind. This is the backward
        // looking mean, named as one.
        label={t("lp_perf_per_position")}
        value={f.perPositionUsd === null ? null : signed(f.perPositionUsd)}
        pending={t("lp_perf_after_first_close")}
        note={
          f.perPositionUsd === null
            ? undefined
            : t("lp_perf_per_position_note", { closed: f.closed })
        }
      />
    </>
  );
}

function NoRecord() {
  const { t } = useLocale();
  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-10 text-center">
      <p className="font-ui text-[14px] font-medium text-text-primary">
        {t("lp_perf_no_history_title")}
      </p>
      <p className="mx-auto max-w-[46ch] pt-2 font-ui text-[12.5px] leading-relaxed text-text-secondary">
        {t("lp_perf_no_history_body")}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- figures -- */

/**
 * What a live LP book is worth at this moment: the wallet as the chain holds
 * it, plus every open position valued now (liquidity and unclaimed fees), in
 * both units at one rate. Built by the agent page from the funding read, which
 * is the same read the wallet bar shows.
 */
export interface LiveWorth {
  sol: number;
  usd: number;
}

/**
 * {@link LiveWorth} for a live SOL book, or null when it cannot be stated
 * honestly: a paper agent, a USD one, a wallet that could not be read, or an
 * open position the server could not value this request. Null falls back to
 * the last reading, which is correct as of its cycle.
 *
 * `refreshKey` re-reads the wallet when the page reloads its detail, so a
 * close or a deposit moves the headline with the wallet bar beside it.
 */
export function useLiveWorth(
  agentId: number,
  enabled: boolean,
  positions: AgentDetail["positions"],
  refreshKey: unknown,
): LiveWorth | null {
  const state = useApi(
    (token) => (enabled ? getAgentFunding(token, agentId) : Promise.resolve(null)),
    [agentId, enabled, refreshKey],
  );
  if (!enabled || state.phase !== "ready" || !state.data) return null;
  const f = state.data;
  const rate = f.solUsd;
  if (f.unit !== "SOL" || !(typeof rate === "number" && rate > 0) || typeof f.balance !== "number") return null;
  const legs = positions.filter((p) => !!p.lp);
  if (legs.some((p) => !p.lp?.now)) return null;
  // Liquidity plus unclaimed fees: what the positions would hand back now.
  const openUsd = legs.reduce((sum, p) => sum + p.lp!.now!.valueUsd + p.lp!.now!.unclaimedFeesUsd, 0);
  return { sol: f.balance + openUsd / rate, usd: f.balance * rate + openUsd };
}

interface LpFigures {
  days: LpDay[];
  netWorthUsd: number;
  profitUsd: number;
  realizedUsd: number;
  /** Null when a pool could not be read — see the note in `lpFigures`. */
  feesUsd: number | null;
  feesKnown: number;
  /**
   * Open liquidity against having simply held the tokens. Negative is
   * impermanent loss. Null when nothing is open, or nothing could be priced —
   * `vsHodlUnreadable` tells those two apart.
   */
  vsHodlPct: number | null;
  /** How many open positions the figure above actually covers. */
  vsHodlCovered: number;
  vsHodlOpen: number;
  vsHodlUnreadable: boolean;
  feesPartial: boolean;
  feesEstimated: boolean;
  closed: number;
  winners: number;
  winRatePct: number | null;
  avgInvestedUsd: number | null;
  monthlyUsd: number | null;
  perPositionUsd: number | null;
  daysLive: number;
  openCount: number;
  openInvestedUsd: number;
  /** The single best day, and when — the shape of a book's luck. */
  bestDayUsd: number | null;
  bestDay: string | null;
  /** How many days the book actually moved up. Fees do not arrive every day. */
  earningDays: number;
}

/** Every figure the panel shows, resolved once so the rail and chart agree. */
/**
 * WHICH UNIT THIS SERIES IS MEASURED IN.
 *
 * "sol" when the backend recorded SOL quantities — a baseline and readings
 * each taken at the moment they were true. Then nothing is converted to draw
 * the SOL view, which is the whole point: a book holding the same SOL reads
 * flat however the price moves.
 *
 * "usd" otherwise, including a SOL agent whose readings predate the recording.
 * Those still convert by dividing, which drifts with the price — wrong, but
 * the only thing possible for history that was never measured in SOL.
 */
function seriesBase(series: EquitySeries | null, unit: "USD" | "SOL"): "usd" | "sol" {
  if (unit !== "SOL" || !series) return "usd";
  const hasBaseline = typeof series.capitalSol === "number" && series.capitalSol > 0;
  const hasReadings = series.points.some((p) => typeof p.equitySol === "number");
  return hasBaseline && hasReadings ? "sol" : "usd";
}

function lpFigures(
  series: EquitySeries,
  positions: AgentDetail["positions"],
  universe: UniverseAsset[],
  /** "sol" when the series carries SOL quantities; see `seriesBase`. */
  base: "usd" | "sol" = "usd",
  /** The current rate, for the figures that are only recorded in dollars. */
  solUsd?: number | null,
  live?: LiveWorth | null,
): LpFigures {
  /*
   * EVERY FIGURE THIS RETURNS IS IN THE SERIES' UNIT.
   *
   * The curve and its baseline come from SOL quantities recorded when they
   * were true. Everything else here — what the open book is worth, fees, the
   * aggregates — exists only in dollars, because that is what the LP tables
   * store. Those are NOW-figures, so valuing them at the CURRENT rate is
   * correct and carries none of the baseline problem: the error was only ever
   * dividing a frozen baseline and a live reading by the same current rate.
   *
   * What must not happen is the two units meeting in one object. Returning
   * `netWorthUsd` in dollars beside a SOL profit is what printed "238.658 SOL"
   * over a book of two SOL.
   */
  const inUnit = (usdValue: number): number =>
    base === "sol" && solUsd && solUsd > 0 ? usdValue / solUsd : usdValue;
  const inUnitOrNull = (usdValue: number | null): number | null =>
    usdValue === null ? null : inUnit(usdValue);
  const points = series.points;
  // ON A SOL BOOK, THE LAST READING THAT RECORDED SOL. A dollar-only row
  // divided by today's rate is the bug `seriesBase` exists to end; the API now
  // drops them, and this keeps an older API from reintroducing one.
  const last =
    base === "sol"
      ? ([...points].reverse().find((p) => typeof p.equitySol === "number") ?? points[points.length - 1])
      : points[points.length - 1];
  // The baseline is the book's starting capital, which is what the curve is
  // drawn against everywhere else in the product — in whichever unit the
  // readings are in, so the two are never subtracted across units.
  const baseline =
    base === "sol"
      ? (series.capitalSol ?? 0) > 0
        ? series.capitalSol!
        : (points[0]?.equitySol ?? 0)
      : series.capitalUsd > 0
        ? series.capitalUsd
        : (points[0]?.equityUsd ?? 0);
  const days = lpDaysFromEquity(points, baseline, base);
  const lp = series.lp;

  /*
   * Unclaimed fees are only known per open position, valued this request — the
   * aggregate cannot carry them because they are not stored anywhere.
   *
   * NULL WHEN ANY POOL COULD NOT BE READ, matching the positions table's own
   * `sum()` on the same page, which returns null unless every row has a value
   * and renders a dash. This used to fold a failed read into the total as
   * zero, so a panel quietly under-reporting fees sat directly above a table
   * honestly showing "—", for the same book, on the same screen.
   */
  const openLegs = positions.filter((p) => !!p.lp);
  const unclaimed = openLegs.every((p) => p.lp?.now)
    ? openLegs.reduce((s, p) => s + (p.lp!.now!.unclaimedFeesUsd ?? 0), 0)
    : null;
  // `markOpenBook` is what the rest of the app uses to price an open book; it
  // is called for its side effect of agreeing with the positions table.
  void markOpenBook(positions, universe);

  const closed = lp?.closed ?? series.closedPositions;
  const winners = lp?.winners ?? series.winningPositions;
  const feesUsd =
    unclaimed === null ? null : (lp?.feesEarnedUsd ?? 0) + (lp?.claimedFeesUsd ?? 0) + unclaimed;
  const realizedUsd = lp?.realizedUsd ?? series.realizedPnlUsd;

  const firstAt = lp?.firstOpenedAt ?? points[0]?.at ?? null;
  const daysLive = firstAt
    ? Math.max(1, Math.round((Date.now() - Date.parse(firstAt)) / 86_400_000))
    : days.length;
  const profitUsd = (base === "sol" ? (last.equitySol ?? inUnit(last.equityUsd)) : last.equityUsd) - baseline;
  // The best single day, which is a fact about how this book earns: a pool
  // that pays steadily and one that had a single frantic afternoon can show
  // the same total, and an owner deciding whether to add to it wants to know
  // which of the two they have.
  const best = days.reduce<LpDay | null>(
    (top, d) => (d.profitUsd > 0 && (!top || d.profitUsd > top.profitUsd) ? d : top),
    null,
  );

  const hodl = vsHodl(openLegs);

  return {
    days,
    // LIVE WHEN IT CAN BE. The curve is one reading per cycle, so between
    // cycles it lags the wallet — a close, a deposit or a fee lands and the
    // headline disagrees with the wallet beside it for up to a cycle. A live
    // book is valued now instead: the wallet as read, plus what its open
    // positions are worth this moment.
    netWorthUsd: live
      ? base === "sol"
        ? live.sol
        : live.usd
      : base === "sol"
        ? (last.equitySol ?? inUnit(last.equityUsd))
        : last.equityUsd,
    vsHodlPct: hodl.pct,
    vsHodlCovered: hodl.covered,
    vsHodlOpen: hodl.open,
    vsHodlUnreadable: hodl.unreadable,
    profitUsd,
    realizedUsd: inUnit(realizedUsd),
    feesUsd: inUnitOrNull(feesUsd),
    feesKnown: lp?.feesKnown ?? 0,
    feesPartial: !!lp && lp.closed > 0 && lp.feesKnown < lp.closed,
    feesEstimated: lp?.feesEstimated ?? false,
    closed,
    winners,
    winRatePct: closed > 0 ? (winners / closed) * 100 : null,
    avgInvestedUsd: inUnitOrNull(lp?.avgInvestedUsd ?? null),
    monthlyUsd: daysLive >= 30 ? profitUsd / (daysLive / 30.44) : null,
    perPositionUsd: closed > 0 ? inUnit(realizedUsd / closed) : null,
    daysLive,
    openCount: lp?.openCount ?? positions.filter((p) => !!p.lp).length,
    openInvestedUsd: inUnit(lp?.openInvestedUsd ?? 0),
    bestDayUsd: best ? best.profitUsd : null,
    bestDay: best ? best.day : null,
    earningDays: days.filter((d) => d.profitUsd > 0).length,
  };
}

/**
 * Open liquidity against simply having held the same two tokens.
 *
 * THE QUESTION AN LP ACTUALLY ASKS, and the answer has been on the wire since
 * the day the book shipped — `vsHodlPct` is computed for every open position
 * and, until now, read by nothing at all. The panel implied it instead, by
 * setting "fees earned" beside "total profit" and letting the gap between them
 * be the loss.
 *
 * WEIGHTED BY LIQUIDITY, because a $5,000 position 3% under and a $50 one 3%
 * up are not a wash and the reader is asking about their money. The weight
 * excludes fees, because the ratio itself excludes them — weighting a
 * fees-excluded figure by a fees-inclusive value would mix two bases.
 *
 * OPEN POSITIONS ONLY, and that is the wire's limit rather than a choice: the
 * hodl dollars are never sent, and a closed position has no hodl column at all.
 * So this can never be a book-wide figure and can never be shown in dollars.
 */
function vsHodl(openLegs: AgentDetail["positions"]): {
  pct: number | null;
  covered: number;
  open: number;
  unreadable: boolean;
} {
  const rows = openLegs.flatMap((p) => {
    const now = p.lp?.now;
    if (!now || now.vsHodlPct === null || now.vsHodlPct === undefined) return [];
    const w = now.holds.xUsd + now.holds.yUsd;
    return w > 0 ? [{ pct: now.vsHodlPct, w }] : [];
  });
  if (rows.length === 0) {
    // Two different silences: nothing is open, or something is open and its
    // pool would not read. They must not collapse into one dash.
    return { pct: null, covered: 0, open: openLegs.length, unreadable: openLegs.length > 0 };
  }
  const total = rows.reduce((s, r) => s + r.w, 0);
  return {
    pct: rows.reduce((s, r) => s + r.pct * r.w, 0) / total,
    covered: rows.length,
    open: openLegs.length,
    unreadable: false,
  };
}

/** A day, named the way the chart's own axis names it. */
function shortDay(day: string, locale: Locale): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(dateLocale(locale), {
    day: "numeric",
    month: "short",
  });
}

/**
 * A percentage with a real minus, matching the trading panel's.
 *
 * DELIBERATELY NOT UNIT-AWARE. A return of 4.2% is 4.2% whether the book is
 * counted in SOL or in dollars — converting both sides of a ratio cancels —
 * so this is one of the figures the toggle must leave alone.
 */
function signedPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const body = `${Math.abs(n).toFixed(2)}%`;
  return n < 0 ? `−${body}` : `+${body}`;
}


