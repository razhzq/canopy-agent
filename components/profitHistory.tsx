"use client";

import { useMemo, useState } from "react";
import { ProfitBars, barScale } from "@/components/charts";
import { axisWhen, bandIndex, Marker } from "@/components/equity";
import { USD_FORMAT, type BookFormat } from "@/lib/bookUnit";
import { ICON_BUTTON } from "@/components/kit";
import { bucketDays, dayKey, monthGrid, type Bucket, type LpDay } from "@/lib/lpDays";
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
  onScrub,
  fmt = USD_FORMAT,
}: {
  days: LpDay[];
  /** False for a day inside the window that has no reading yet. */
  present?: boolean[];
  view: "chart" | "calendar";
  height?: number;
  /**
   * The column under the pointer, handed to the panel.
   *
   * THE READING GOES UPWARD, into the headline the eye is already on — the
   * house pattern, stated in ReadableCurve's own doc and violated here until
   * now by a card floating over the bars. Absent on the public page's compact
   * mount, which has no headline to report into and draws its own reading in
   * the footer instead.
   */
  onScrub?: (i: number | null) => void;
  /**
   * How to render amounts (CANOPY_127). Dollars by default.
   *
   * PASSED IN RATHER THAN CHOSEN HERE, because this chart is mounted beside a
   * headline that has already made the choice. Two units on one panel — a
   * figure above in SOL and a tooltip below in dollars — is worse than either
   * unit alone, and the reader has no way to tell which one is lying.
   *
   * Only the LABELS change. Converting at one rate is a uniform scale, so the
   * bars, the axis positions and the line are identical either way.
   */
  fmt?: BookFormat;
}) {
  const { t, locale } = useLocale();
  const signed = fmt.signed;
  const [hover, setHover] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string>(() =>
    days.length > 0 ? days[days.length - 1].day : dayKey(new Date()),
  );
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);

  /*
   * ONE COLUMN PER DAY STOPS WORKING LONG BEFORE THE DATA DOES.
   *
   * The narrowest mount is a phone at ~324px and the narrowest band still
   * legible is about 3.5px — a 2.5px bar with a 1px gap — so 92 columns is the
   * ceiling. Past it the days roll up into weeks, and past two years into
   * months. It matters most on mobile, which windows nothing at all: a
   * year-old book was 365 columns in 324px, under a pixel each.
   *
   * Automatic rather than a control. There is no window long enough yet for a
   * manual bucket to be a real choice, and a third segmented switch is the
   * second toolbar this component exists to avoid.
   */
  const bucket: Bucket = days.length <= 92 ? "day" : days.length <= 730 ? "week" : "month";
  const rows = useMemo(
    () => (bucket === "day" ? null : bucketDays(days, bucket)),
    [days, bucket],
  );

  if (days.length === 0) {
    return (
      <p className="py-12 text-center font-ui text-[12.5px] text-text-dim">
        {t("lp_perf_no_history_body")}
      </p>
    );
  }

  if (view === "calendar") {
    return <Calendar byDay={byDay} cursor={cursor} onCursor={setCursor} days={days} fmt={fmt} />;
  }

  // Bucketed columns are always readings; only the day view synthesises gaps.
  const values = rows ? rows.map((r) => r.profitUsd) : days.map((d) => d.profitUsd);
  const seen = rows ? undefined : present;
  const keys = rows ? rows.map((r) => r.day) : days.map((d) => d.day);
  const n = values.length;

  const real = (i: number) => seen === undefined || seen[i];
  const total = values.reduce((s, v, i) => s + (real(i) ? v : 0), 0);
  // Always at least a day, so the ends read as dates rather than as clock
  // times on a chart whose columns are days.
  const axisSpan = Math.max(span(days), 25 * 3_600_000);

  const at = hover === null ? null : Math.min(hover, n - 1);
  const shown = at !== null && real(at) ? at : null;

  const set = (i: number | null) => {
    setHover(i);
    onScrub?.(i !== null && real(i) ? i : null);
  };
  const track = (clientX: number, el: HTMLElement) => set(bandIndex(clientX, el, n));

  const s = barScale(values.filter((_, i) => real(i)));

  return (
    <div>
      <div
        className="relative touch-pan-y"
        onMouseMove={(e) => track(e.clientX, e.currentTarget)}
        onMouseLeave={() => set(null)}
        onTouchStart={(e) => track(e.touches[0].clientX, e.currentTarget)}
        onTouchMove={(e) => track(e.touches[0].clientX, e.currentTarget)}
        onTouchEnd={() => set(null)}
      >
        {/* THE COLUMN, NOT A HAIRLINE. A 1px crosshair is the right mark over a
            curve, whose reading is a point; here it would sit behind a bar four
            dozen times its width and never be seen. The band says "this one"
            at every density, and it sits behind the bars. */}
        {shown !== null ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 z-0 bg-surface-2"
            style={{ left: `${(shown / n) * 100}%`, width: `${(1 / n) * 100}%` }}
          />
        ) : null}

        <ProfitBars values={values} present={seen} height={height} hover={shown} />

        {/* At the bar's own tip, ringed by that bar's own sign — this chart has
            a direction per column, unlike a curve which has one overall. */}
        {shown !== null ? (
          <Marker
            left={((shown + 0.5) / n) * 100}
            top={s.pct(values[shown])}
            ring={values[shown] < 0 ? "var(--color-negative)" : "var(--color-accent)"}
          />
        ) : null}
      </div>

      <AxisTicks keys={keys} bucket={bucket} locale={locale} spanMs={axisSpan} />

      {/* ONLY WHERE THERE IS NO HEADLINE TO REPORT INTO. The panel's hero
          already carries the window's profit, so printing it again 250px below
          said the same number twice — and a centred total sits exactly where
          the middle axis tick does. The compact mount on the public page has
          no hero, so there it stays and doubles as the scrub readout. */}
      {onScrub === undefined ? (
        <p className="tnum pt-1 text-center font-mono text-[11.5px] text-text-secondary">
          {shown !== null
            ? t("lp_perf_day_reading", {
                day: bucketLabel(keys[shown], bucket, locale, axisSpan),
                amount: signed(values[shown]),
              })
            : `${t("lp_perf_total_in_view")} ${signed(total)}`}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The dates under the columns.
 *
 * TWO ENDS IS NOT AN AXIS once there are thirty of them. The first and last
 * pin to the container edges rather than to their band centres — at three
 * columns the first centre is a sixth of the way in, and a date floating there
 * annotates nothing — and the interior ticks sit on the centres they name.
 *
 * Interior ticks leave on a narrow screen: five labels is about 48px of glyphs
 * in a 65px slot at phone width, and two honest ends beat five overlapping
 * ones.
 */
function AxisTicks({
  keys,
  bucket,
  locale,
  spanMs,
}: {
  keys: string[];
  bucket: Bucket;
  locale: Locale;
  spanMs: number;
}) {
  const n = keys.length;
  const step = n <= 9 ? 1 : Math.ceil(n / 5);
  const inner: number[] = [];
  // Stop short of the pinned right-hand end: an interior tick at 95% and the
  // end label both want the same pixels, and the end one cannot move.
  for (let i = step; i < n - 1; i += step) {
    if ((i + 0.5) / n < 0.86) inner.push(i);
  }

  return (
    <div className="relative h-4 pt-2 font-ui text-[11.5px] text-text-muted">
      <span className="tnum absolute left-0 font-mono">
        {bucketLabel(keys[0], bucket, locale, spanMs)}
      </span>
      {inner.map((i) => (
        <span
          key={i}
          className="tnum absolute hidden -translate-x-1/2 font-mono sm:inline"
          style={{ left: `${((i + 0.5) / n) * 100}%` }}
        >
          {bucketLabel(keys[i], bucket, locale, spanMs)}
        </span>
      ))}
      {n > 1 ? (
        <span className="tnum absolute right-0 font-mono">
          {bucketLabel(keys[n - 1], bucket, locale, spanMs)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A column's own label.
 *
 * `axisWhen` speaks in instants, and a month bar is not one: past a year it
 * would print "1 Sep 2025" on a bar that means the whole of September, which
 * is a precision the column does not have. Note `bucketDays` keys a month as
 * `YYYY-MM`, so it needs a day before it will parse.
 */
function bucketLabel(key: string, bucket: Bucket, locale: Locale, spanMs: number): string {
  if (bucket !== "month") return axisWhen(`${key}T12:00:00`, locale, spanMs);
  const d = new Date(`${key}-01T00:00:00`);
  return d.toLocaleDateString(dateLocale(locale), {
    month: "short",
    ...(spanMs > 365 * 24 * 3_600_000 ? { year: "2-digit" } : {}),
  });
}

/** A month of days, as a wall calendar draws them. */
function Calendar({
  byDay,
  cursor,
  onCursor,
  days,
  fmt = USD_FORMAT,
}: {
  byDay: Map<string, LpDay>;
  cursor: string;
  onCursor: (day: string) => void;
  days: LpDay[];
  fmt?: BookFormat;
}) {
  const signed = fmt.signed;
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


