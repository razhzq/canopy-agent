"use client";

import { useMemo, useState } from "react";
import { ProfitBarsLine } from "@/components/charts";
import { axisWhen, trackIndex } from "@/components/equity";
import { ICON_BUTTON } from "@/components/kit";
import { dayKey, monthGrid, type LpDay } from "@/lib/lpDays";
import { useLocale, dateLocale, type Locale } from "@/lib/i18n";

/**
 * What a liquidity book earned, day by day — as a chart or as a calendar.
 *
 * TWO VIEWS OF ONE SERIES, because the two questions are different. The chart
 * answers "is this going anywhere": shape, direction, whether the good days are
 * getting bigger. The calendar answers "what happened on the 14th": a specific
 * day, found by looking where it would be on a wall. Neither is a better
 * version of the other, which is why this is a toggle and not a preference.
 *
 * THE CONTROLS ARE NOT ALL ALWAYS THERE. A calendar is a grid of days in a
 * month: a Week/Month bucket would have nothing to change and a range of "3M"
 * would contradict the month it is drawing. Rather than draw both controls
 * disabled — a control that can never be pressed is worse than one that is not
 * there — the bucket and range switches belong to the chart and leave with it.
 * The calendar brings its own navigation instead, which is the ‹ › a month
 * actually needs.
 */
/**
 * The history itself — the chart or the grid, with no controls of its own.
 *
 * TOOLBARS BELONG TO THE PANEL. The performance panel already owns a range
 * switch and sits inside one bordered card with the figures across its top;
 * a component that brought its own row of segmented controls would put a
 * second toolbar inside that card and turn one object into two. So this takes
 * the view and the window as props and draws what it is told.
 */
export function ProfitBody({
  days,
  present,
  view,
  height = 220,
}: {
  days: LpDay[];
  /** False for a day inside the window that has no reading yet. */
  present?: boolean[];
  view: "chart" | "calendar";
  height?: number;
}) {
  const { t, locale } = useLocale();
  const [hover, setHover] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string>(() =>
    days.length > 0 ? days[days.length - 1].day : dayKey(new Date()),
  );
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);

  if (days.length === 0) {
    return (
      <p className="px-5 py-12 text-center font-ui text-[12.5px] text-text-dim">
        {t("lp_perf_no_history_body")}
      </p>
    );
  }

  if (view === "calendar") {
    return <Calendar byDay={byDay} cursor={cursor} onCursor={setCursor} days={days} />;
  }

  const real = (i: number) => present === undefined || present[i];
  const total = days.reduce((s, d, i) => s + (real(i) ? d.profitUsd : 0), 0);
  // A day with no reading cannot be hovered: there is nothing to say about it,
  // and a tooltip reading "$0" would answer a question nobody asked.
  // Always at least a day, so the ends read as dates rather than as clock
  // times on a chart whose columns are days.
  const axisSpan = Math.max(span(days), 25 * 3_600_000);
  const at = hover === null ? null : Math.min(hover, days.length - 1);
  const hovered = at !== null && real(at) ? days[at] : null;
  const hoveredAt = hovered ? at! : null;

  return (
    <div>
      <div
        className="relative"
        onMouseMove={(e) => setHover(trackIndex(e.clientX, e.currentTarget, days.length))}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) =>
          setHover(trackIndex(e.touches[0].clientX, e.currentTarget, days.length))
        }
        onTouchMove={(e) =>
          setHover(trackIndex(e.touches[0].clientX, e.currentTarget, days.length))
        }
        onTouchEnd={() => setHover(null)}
      >
        <ProfitBarsLine
          bars={days.map((d) => d.profitUsd)}
          cumulative={days.map((d) => d.cumulativeUsd)}
          present={present}
          height={height}
          hover={hoveredAt}
        />

        {/* THE READING, WHERE THE POINTER IS. The footer below still carries
            the window's total, but a chart of thirty columns needs the answer
            next to the column — following the eye rather than making it travel
            to the bottom of the panel and back for every day it checks.
            Clamped inside the container and pointer-transparent, so it can
            never sit under the cursor and block the column it describes. */}
        {hovered && hoveredAt !== null ? (
          <span
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-panel px-2.5 py-1.5 whitespace-nowrap shadow-[0_20px_44px_-16px_rgba(0,0,0,0.9)]"
            style={{
              left: `${Math.min(Math.max(pointAt(hoveredAt, days.length), 8), 92)}%`,
            }}
          >
            <span className="block font-ui text-[11px] text-text-muted">
              {shortDay(hovered.day, locale)}
            </span>
            <span
              className={`tnum block font-mono text-[13px] ${
                hovered.profitUsd >= 0 ? "text-accent" : "text-negative"
              }`}
            >
              {signed(hovered.profitUsd)}
            </span>
            <span className="tnum block font-mono text-[11px] text-text-dim">
              {t("lp_perf_running", { amount: signed(hovered.cumulativeUsd) })}
            </span>
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3 pt-2 font-ui text-[11.5px] text-text-muted">
        {/* A ONE-DAY WINDOW HAS ONE END. `axisWhen` reads a span under a day
            as a time of day and would print "12:00" at both ends of a chart
            covering a single date — two labels agreeing on nothing. Forced to
            the date, and the far end drops out entirely. */}
        <span className="tnum font-mono">
          {axisWhen(`${days[0].day}T12:00:00`, locale, axisSpan)}
        </span>
        {/* The reading follows the pointer, where the total sits when it does
            not — so the eye never moves to read it. */}
        <span className="tnum font-mono text-text-secondary">
          {`${t("lp_perf_total_in_view")} ${signed(total)}`}
        </span>
        <span className="tnum font-mono">
          {days.length > 1
            ? axisWhen(`${days[days.length - 1].day}T12:00:00`, locale, axisSpan)
            : ""}
        </span>
      </div>
    </div>
  );
}

/** Where a column sits across the panel, as a percentage. Matches the chart. */
function pointAt(i: number, count: number): number {
  return count === 1 ? 50 : (i / (count - 1)) * 100;
}

/** A month of days, as a wall calendar draws them. */
function Calendar({
  byDay,
  cursor,
  onCursor,
  days,
}: {
  byDay: Map<string, LpDay>;
  cursor: string;
  onCursor: (day: string) => void;
  days: LpDay[];
}) {
  const { t, locale } = useLocale();
  const at = new Date(`${cursor}T00:00:00`);
  const year = at.getFullYear();
  const month = at.getMonth();
  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const today = dayKey(new Date());

  const first = days[0]?.day ?? cursor;
  const last = days[days.length - 1]?.day ?? cursor;
  const canPrev = `${year}-${`${month + 1}`.padStart(2, "0")}` > first.slice(0, 7);
  const canNext = `${year}-${`${month + 1}`.padStart(2, "0")}` < last.slice(0, 7);

  const monthTotal = cells
    .filter((c) => !c.outside)
    .reduce((s, c) => s + (byDay.get(c.day)?.profitUsd ?? 0), 0);

  const step = (by: number) => {
    const next = new Date(year, month + by, 1);
    onCursor(dayKey(next));
  };

  // Weekday names from the reader's own locale rather than from our strings —
  // correct in more languages than we will ever translate, and impossible to
  // get out of step with the month heading beside it.
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(dateLocale(locale), { weekday: "short" });
    // 2023-01-01 was a Sunday, which is the column this grid starts on.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)));
  }, [locale]);

  const monthLabel = new Date(year, month, 1).toLocaleDateString(dateLocale(locale), {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 pb-3">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!canPrev}
          aria-label={t("lp_perf_prev_month")}
          className={`${ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-30`}
        >
          ‹
        </button>
        <span className="font-ui text-[13.5px] font-medium text-text-primary">{monthLabel}</span>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={!canNext}
          aria-label={t("lp_perf_next_month")}
          className={`${ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-30`}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekdays.map((w) => (
          <span
            key={w}
            className="pb-1 text-center font-ui text-[11px] text-text-muted"
          >
            {w}
          </span>
        ))}
        {cells.map((c) => {
          const d = c.outside ? undefined : byDay.get(c.day);
          const earned = d && d.profitUsd !== 0;
          return (
            <span
              key={c.day}
              className={`flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-center ${
                c.outside
                  ? "opacity-25"
                  : earned
                    ? "border border-grid-strong bg-surface"
                    : "border border-transparent"
              } ${c.day === today ? "ring-1 ring-accent/40" : ""}`}
            >
              <span
                className={`tnum font-mono text-[11.5px] ${
                  c.outside ? "text-text-dim" : "text-text-secondary"
                }`}
              >
                {c.date}
              </span>
              {/* A day with no reading shows nothing at all. A zero would say
                  the book was flat, where the truth is that nobody looked. */}
              {earned ? (
                <span
                  className={`tnum font-mono text-[11px] ${
                    d!.profitUsd >= 0 ? "text-accent" : "text-negative"
                  }`}
                >
                  {signed(d!.profitUsd)}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>

      <p className="pt-3 text-right font-ui text-[12px] text-text-muted">
        {t("lp_perf_month_total", { month: monthLabel })}{" "}
        <span className={`tnum font-mono ${monthTotal >= 0 ? "text-accent" : "text-negative"}`}>
          {signed(monthTotal)}
        </span>
      </p>
    </div>
  );
}

/** How much clock the drawn window covers, for the axis ends. */
function span(days: LpDay[]): number {
  if (days.length < 2) return 0;
  return (
    Date.parse(`${days[days.length - 1].day}T00:00:00`) -
    Date.parse(`${days[0].day}T00:00:00`)
  );
}

function shortDay(day: string, locale: Locale): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(dateLocale(locale), {
    day: "numeric",
    month: "short",
  });
}

/** Dollars with a real minus, matching every other signed figure in the app. */
function signed(n: number): string {
  const abs = Math.abs(n);
  const body = `$${abs.toLocaleString("en-US", { maximumFractionDigits: abs < 100 ? 2 : 0 })}`;
  return n < 0 ? `−${body}` : `+${body}`;
}
