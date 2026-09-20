"use client";

import { useMemo, useState } from "react";
import { Fig } from "@/components/equity";
import { ProfitBody } from "@/components/profitHistory";
import { SEGMENT_ITEM, SEGMENT_OFF, SEGMENT_ON, SEGMENT_TRACK, Tick } from "@/components/kit";
import { markOpenBook } from "@/lib/perf";
import { dayKey, lpDaysFromEquity, type LpDay } from "@/lib/lpDays";
import type { AgentDetail, EquitySeries, LpBook, UniverseAsset } from "@/lib/api";
import { useLocale } from "@/lib/i18n";

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
}: {
  series: EquitySeries | null;
  positions: AgentDetail["positions"];
  universe: UniverseAsset[];
}) {
  const { t } = useLocale();
  const [view, setView] = useState<"chart" | "calendar">("chart");
  const [range, setRange] = useState<LpRange>("all");

  if (series === null || series.points.length === 0) return <NoRecord />;

  const f = lpFigures(series, positions, universe);
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
            <Tick
              value={windowProfit}
              className={`tnum font-mono text-[13px] ${windowProfit >= 0 ? "text-accent" : "text-negative"}`}
            >
              {signed(windowProfit)} · {signedPct(windowPct)}
            </Tick>
            <span className="font-ui text-[12px] text-text-dim">
              {view === "calendar"
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
        <div className="grid grid-cols-2 border-b border-grid md:grid-cols-5">
          <Fig
            cell={0}
            label={`${t("lp_perf_fees")}${f.feesEstimated ? " *" : ""}`}
            value={money(f.feesUsd)}
            tone="accent"
            note={
              f.feesPartial
                ? t("lp_perf_fees_partial", { known: f.feesKnown, closed: f.closed })
                : t("lp_perf_fees_note")
            }
          />
          <Fig
            cell={1}
            label={t("lp_perf_profit")}
            value={signed(f.profitUsd)}
            tone={f.profitUsd >= 0 ? "accent" : "negative"}
            note={t("lp_perf_profit_note", { realised: signed(f.realizedUsd) })}
          />
          <Fig
            cell={2}
            label={t("lp_perf_open")}
            value={String(f.openCount)}
            note={f.openInvestedUsd > 0 ? t("lp_perf_open_note", { amount: money(f.openInvestedUsd) }) : undefined}
          />
          <Fig
            cell={3}
            label={t("lp_perf_closed")}
            value={String(f.closed)}
          />
          <Fig
            cell={4}
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
            cell={5}
            label={t("lp_perf_avg_invested")}
            value={f.avgInvestedUsd === null ? null : money(f.avgInvestedUsd)}
            pending={t("lp_perf_after_first_close")}
            note={t("lp_perf_avg_invested_note")}
          />
          <Fig
            cell={6}
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
            cell={7}
            label={t("lp_perf_best_day")}
            value={f.bestDayUsd === null ? null : signed(f.bestDayUsd)}
            pending={t("lp_perf_after_a_day")}
            tone="accent"
            note={f.bestDay ? t("lp_perf_best_day_note", { day: f.bestDay }) : undefined}
          />
          <Fig
            cell={8}
            label={t("lp_perf_earning_days")}
            value={f.days.length === 0 ? null : `${f.earningDays} / ${f.days.length}`}
            pending={t("lp_perf_after_a_day")}
            note={t("lp_perf_earning_days_note")}
          />
          <Fig
            cell={9}
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
          />
        </div>
      </div>

      {f.feesEstimated ? (
        <p className="font-ui text-[11px] leading-relaxed text-text-muted">
          {t("lp_perf_estimated")}
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

  // Carry the running total across the empty stretch so the line resumes at the
  // height it left off, rather than dropping to zero on the first quiet day.
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
}: {
  series: EquitySeries | null;
  positions: AgentDetail["positions"];
  universe: UniverseAsset[];
}) {
  const { t } = useLocale();
  if (series === null || series.points.length === 0) return <NoRecord />;
  const f = lpFigures(series, positions, universe);

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
      </div>
      <div className="px-[18px] pt-4">
        {/* Chart only. A seven-column grid of dollar amounts does not survive a
            360px screen, and a calendar nobody can read is not a calendar. */}
        <ProfitBody days={f.days} view="chart" height={168} />
      </div>
      <div className="mt-4 grid grid-cols-2 border-t border-grid">
        <Fig cell={0} edges="" label={t("lp_perf_fees")} value={money(f.feesUsd)} tone="accent" />
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
}: {
  points: EquitySeries["points"];
  capitalUsd: number;
  lp?: LpBook;
}) {
  const { t } = useLocale();
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

function Rail({ figures }: { figures: LpFigures }) {
  const { t } = useLocale();
  const f = figures;
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
        value={money(f.feesUsd)}
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

interface LpFigures {
  days: LpDay[];
  netWorthUsd: number;
  profitUsd: number;
  realizedUsd: number;
  feesUsd: number;
  feesKnown: number;
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
function lpFigures(
  series: EquitySeries,
  positions: AgentDetail["positions"],
  universe: UniverseAsset[],
): LpFigures {
  const points = series.points;
  const last = points[points.length - 1];
  // The baseline is the book's starting capital, which is what the curve is
  // drawn against everywhere else in the product.
  const baseline = series.capitalUsd > 0 ? series.capitalUsd : (points[0]?.equityUsd ?? 0);
  const days = lpDaysFromEquity(points, baseline);
  const lp = series.lp;

  // Unclaimed fees are only known per open position, valued this request — the
  // aggregate cannot carry them because they are not stored anywhere.
  const unclaimed = positions.reduce(
    (s, p) => s + (p.lp?.now?.unclaimedFeesUsd ?? 0),
    0,
  );
  // `markOpenBook` is what the rest of the app uses to price an open book; it
  // is called for its side effect of agreeing with the positions table.
  void markOpenBook(positions, universe);

  const closed = lp?.closed ?? series.closedPositions;
  const winners = lp?.winners ?? series.winningPositions;
  const feesUsd = (lp?.feesEarnedUsd ?? 0) + (lp?.claimedFeesUsd ?? 0) + unclaimed;
  const realizedUsd = lp?.realizedUsd ?? series.realizedPnlUsd;

  const firstAt = lp?.firstOpenedAt ?? points[0]?.at ?? null;
  const daysLive = firstAt
    ? Math.max(1, Math.round((Date.now() - Date.parse(firstAt)) / 86_400_000))
    : days.length;
  const profitUsd = last.equityUsd - baseline;
  // The best single day, which is a fact about how this book earns: a pool
  // that pays steadily and one that had a single frantic afternoon can show
  // the same total, and an owner deciding whether to add to it wants to know
  // which of the two they have.
  const best = days.reduce<LpDay | null>(
    (top, d) => (d.profitUsd > 0 && (!top || d.profitUsd > top.profitUsd) ? d : top),
    null,
  );

  return {
    days,
    netWorthUsd: last.equityUsd,
    profitUsd,
    realizedUsd,
    feesUsd,
    feesKnown: lp?.feesKnown ?? 0,
    feesPartial: !!lp && lp.closed > 0 && lp.feesKnown < lp.closed,
    feesEstimated: lp?.feesEstimated ?? false,
    closed,
    winners,
    winRatePct: closed > 0 ? (winners / closed) * 100 : null,
    avgInvestedUsd: lp?.avgInvestedUsd ?? null,
    monthlyUsd: daysLive >= 30 ? profitUsd / (daysLive / 30.44) : null,
    perPositionUsd: closed > 0 ? realizedUsd / closed : null,
    daysLive,
    openCount: lp?.openCount ?? positions.filter((p) => !!p.lp).length,
    openInvestedUsd: lp?.openInvestedUsd ?? 0,
    bestDayUsd: best ? best.profitUsd : null,
    bestDay: best ? best.day : null,
    earningDays: days.filter((d) => d.profitUsd > 0).length,
  };
}

function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${Math.abs(n).toLocaleString("en-US", {
    maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0,
  })}`;
}

/** A percentage with a real minus, matching the trading panel's. */
function signedPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const body = `${Math.abs(n).toFixed(2)}%`;
  return n < 0 ? `−${body}` : `+${body}`;
}

function signed(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n < 0 ? `−${money(n)}` : `+${money(n)}`;
}
