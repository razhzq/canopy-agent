import type { EquityPoint } from "@/lib/api";

/**
 * A liquidity book's profit, day by day.
 *
 * WHERE THE NUMBERS COME FROM, and why there is no new table behind them.
 * An LP agent writes an equity reading every cycle, and an LP position's mark
 * already includes its claimed and unclaimed fees — so the change in equity
 * across a day IS that day's profit, fees and impermanent loss netted. The
 * alternative was a per-position snapshot journal, which cannot be backfilled:
 * every agent alive today would have shown an empty panel until enough ticks
 * accumulated. A coarse figure for every agent beats an exact one for none.
 *
 * WHAT THIS CANNOT TELL YOU, stated plainly because the panel is built on it:
 *
 *   1. It cannot separate fees from impermanent loss. A day is a net figure.
 *      The rail's lifetime "fees earned" sits beside "total profit" precisely
 *      so the gap between them is visible; that gap is the loss, and it is the
 *      only honest way to show it without inventing per-day attribution.
 *   2. On a LIVE book, money sent into the agent's wallet mid-life lifts
 *      equity and lands here as profit. There is no funding ledger to subtract
 *      — `capital_usd` is re-baselined exactly once, at the first funded cycle
 *      (runner.ts) — so this is a real limitation and not a rounding one. It
 *      cannot happen on a paper book, which is every copy-LP agent today. DO
 *      NOT "fix" this with an outlier filter: discarding a large day because it
 *      is large would hide a genuinely good day and would still keep a small
 *      deposit. When a funding ledger exists, subtract it HERE.
 *   3. Resolution is the cycle cadence. A day with no cycles has no reading,
 *      and it carries forward flat rather than interpolating.
 */
export interface LpDay {
  /** `YYYY-MM-DD` in the READER's calendar — see `localDay`. */
  day: string;
  /** What the book made that day: equity now minus equity at the last reading. */
  profitUsd: number;
  /** Profit since the book began — the line drawn over the bars. */
  cumulativeUsd: number;
  /** True when the day had no reading of its own and carries the one before it. */
  carried: boolean;
  /**
   * Where the figure came from.
   *
   * "equity" is the derivation above. The field exists so that a later
   * per-position marks journal can serve `feesUsd`/`ilUsd` on the same shape
   * without any component learning a second one — the bars become stacked, the
   * panel does not change.
   */
  source: "equity";
  /** Present only once a marks journal exists. Unused today, by design. */
  feesUsd?: number;
  ilUsd?: number;
}

/**
 * The reader's calendar day for an instant.
 *
 * LOCAL, NOT UTC, and this is the one decision in the file worth arguing over.
 * The backend buckets days by slicing the ISO string, which is UTC. A calendar
 * grid is a human artifact — someone asking "what did I earn on the 18th" means
 * their own 18th — and in UTC+8 a UTC day ends at eight in the morning, so a
 * third of every day would land in the wrong cell. Nothing here is joined back
 * to a server-produced day string, so local is both safe and the only choice
 * that lets the chart, the grid and the date labels agree.
 */
function localDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** `YYYY-MM-DD` for a Date, in the same calendar as {@link localDay}. */
export function dayKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * The day series behind the panel.
 *
 * The baseline is what the book started with, so the first day's profit is
 * measured against it rather than against itself — an agent that made $40 on
 * its first day made $40, not nothing.
 */
export function lpDaysFromEquity(
  points: readonly EquityPoint[],
  baseline: number,
): LpDay[] {
  if (points.length === 0) return [];

  // By time, not by arrival: "the last reading of a day" is a claim about the
  // clock, and a caller handing these over newest-first must not get the first.
  const ordered = [...points]
    .filter((p) => Number.isFinite(p.equityUsd))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  if (ordered.length === 0) return [];

  const lastOfDay = new Map<string, number>();
  for (const p of ordered) {
    const key = localDay(p.at);
    if (key) lastOfDay.set(key, p.equityUsd);
  }

  const keys = [...lastOfDay.keys()].sort();
  const out: LpDay[] = [];
  let previous = Number.isFinite(baseline) ? baseline : (lastOfDay.get(keys[0]) ?? 0);

  // Walk the calendar, not the readings, so a quiet week is a run of flat days
  // rather than a gap the chart would silently close up.
  const cursor = new Date(`${keys[0]}T00:00:00`);
  const end = new Date(`${keys[keys.length - 1]}T00:00:00`);
  while (cursor <= end) {
    const key = dayKey(cursor);
    const reading = lastOfDay.get(key);
    const equity = reading ?? previous;
    out.push({
      day: key,
      profitUsd: equity - previous,
      cumulativeUsd: equity - baseline,
      carried: reading === undefined,
      source: "equity",
    });
    previous = equity;
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export type Bucket = "day" | "week" | "month";

/** A day, a week or a month of the series, as one column. */
export interface LpBucketRow {
  /** The first day in the bucket — what the axis labels and the grid key on. */
  day: string;
  profitUsd: number;
  cumulativeUsd: number;
  days: number;
}

/**
 * Days rolled up.
 *
 * Profit SUMS and cumulative takes the LAST value — the distinction that is
 * easy to get wrong and impossible to see once it is. Profit is a flow: a
 * week's profit is its days added together. Cumulative is a level: a week's
 * cumulative is where the book stood when the week ended, never the sum of
 * seven running totals.
 */
export function bucketDays(days: readonly LpDay[], bucket: Bucket): LpBucketRow[] {
  if (bucket === "day") {
    return days.map((d) => ({
      day: d.day,
      profitUsd: d.profitUsd,
      cumulativeUsd: d.cumulativeUsd,
      days: 1,
    }));
  }

  const rows: LpBucketRow[] = [];
  let current: LpBucketRow | null = null;
  let currentKey = "";

  for (const d of days) {
    const date = new Date(`${d.day}T00:00:00`);
    const key =
      bucket === "month"
        ? d.day.slice(0, 7)
        : // The week's Sunday, matching the calendar grid's first column.
          dayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay()));

    if (!current || key !== currentKey) {
      current = { day: key, profitUsd: 0, cumulativeUsd: 0, days: 0 };
      currentKey = key;
      rows.push(current);
    }
    current.profitUsd += d.profitUsd;
    current.cumulativeUsd = d.cumulativeUsd;
    current.days += 1;
  }
  return rows;
}

export type Range = "7D" | "1M" | "3M" | "1Y" | "YTD" | "ALL";

/** The tail of the series a range asks for. Calendar days, not elapsed hours. */
export function daysIn(days: readonly LpDay[], range: Range): LpDay[] {
  if (range === "ALL" || days.length === 0) return [...days];

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "7D") from.setDate(from.getDate() - 6);
  else if (range === "1M") from.setMonth(from.getMonth() - 1);
  else if (range === "3M") from.setMonth(from.getMonth() - 3);
  else if (range === "1Y") from.setFullYear(from.getFullYear() - 1);
  else if (range === "YTD") from.setMonth(0, 1);

  const cutoff = dayKey(from);
  return days.filter((d) => d.day >= cutoff);
}

/** One cell of a month grid. `outside` days belong to the neighbouring month. */
export interface MonthCell {
  day: string;
  date: number;
  outside: boolean;
}

/**
 * A month as the weeks a calendar draws, Sunday first.
 *
 * Always whole weeks, so the grid is rectangular and the leading and trailing
 * cells are real dates rather than blanks — a reader scanning the last row of
 * September should see the 1st of October where it actually falls.
 */
export function monthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells: MonthCell[] = [];
  const cursor = new Date(start);
  // Six weeks covers every possible month layout; the last row is dropped when
  // it is entirely outside, which is what keeps a short February to five rows.
  for (let i = 0; i < 42; i += 1) {
    cells.push({
      day: dayKey(cursor),
      date: cursor.getDate(),
      outside: cursor.getMonth() !== month,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  const lastWeekStart = 35;
  const trailingWeekIsAllOutside = cells
    .slice(lastWeekStart)
    .every((c) => c.outside);
  return trailingWeekIsAllOutside ? cells.slice(0, lastWeekStart) : cells;
}

/** Several books' days added together, for a page that shows more than one agent. */
export function mergeDays(series: readonly LpDay[][]): LpDay[] {
  const byDay = new Map<string, { profitUsd: number; carried: boolean }>();
  for (const days of series) {
    for (const d of days) {
      const at = byDay.get(d.day);
      if (at) {
        at.profitUsd += d.profitUsd;
        // Carried only when EVERY book was quiet — one book's reading makes the
        // day a real one for the total.
        at.carried = at.carried && d.carried;
      } else {
        byDay.set(d.day, { profitUsd: d.profitUsd, carried: d.carried });
      }
    }
  }
  let running = 0;
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, v]) => {
      running += v.profitUsd;
      return {
        day,
        profitUsd: v.profitUsd,
        cumulativeUsd: running,
        carried: v.carried,
        source: "equity" as const,
      };
    });
}
