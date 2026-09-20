// The liquidity agent's performance panel.
//
// ITS OWN NAMESPACE, and not an extension of `equity.ts`, for two reasons. The
// first is that these are different questions: an LP book is not judged on
// Sharpe or drawdown but on what it earned and what it charged for it, and
// mixing the two vocabularies in one file is how a figure ends up on the wrong
// panel. The second is the prefix — `lp_*` already belongs to positions.ts
// (lp_total_value, lp_col_fees …), so everything here is `lp_perf_*`.
//
// Weekday and month names are deliberately NOT keys: the calendar reads them
// from Intl against the reader's locale, which is both correct in more
// languages than we will ever translate and impossible to get out of step.

export const enLpPerf = {
  // ── The rail ───────────────────────────────────────────────────
  lp_perf_net_worth: "Total net worth",
  lp_perf_net_worth_note: "Wallet plus the value of every open position",
  lp_perf_closed: "Positions closed",
  lp_perf_win_rate: "Win rate",
  lp_perf_win_rate_note: "{won} of {closed} closed in profit",
  lp_perf_avg_invested: "Avg invested",
  lp_perf_avg_invested_note: "Per closed position",
  lp_perf_fees: "Fees earned",
  // Said here rather than as a ninth figure: the gap between fees and profit IS
  // impermanent loss, and naming it where the reader meets it beats a number we
  // cannot compute per day.
  lp_perf_fees_note: "Claimed and unclaimed. Profit below is this less impermanent loss.",
  lp_perf_fees_partial: "From {known} of {closed} closed positions",
  lp_perf_profit: "Total profit",
  lp_perf_profit_note: "{realised} of it realised",
  lp_perf_monthly: "Avg per month",
  lp_perf_monthly_note: "Over {days} days live",
  lp_perf_per_position: "Avg per position",
  lp_perf_per_position_note: "Realised, across {closed} closed",

  lp_perf_range_30d: "30d",
  lp_perf_caption_all: "since it started",
  lp_perf_caption_7d: "over 7 days",
  lp_perf_caption_30d: "over 30 days",
  lp_perf_open: "Open now",
  lp_perf_open_note: "{amount} at work",
  lp_perf_best_day: "Best day",
  lp_perf_best_day_note: "on {day}",
  lp_perf_earning_days: "Days earning",
  lp_perf_earning_days_note: "Days the book moved up",
  lp_perf_after_a_day: "after a day",

  // ── Profit history ─────────────────────────────────────────────
  lp_perf_history: "Profit history",
  lp_perf_view_chart: "Chart",
  lp_perf_view_calendar: "Calendar",
  lp_perf_bucket_day: "Day",
  lp_perf_bucket_week: "Week",
  lp_perf_bucket_month: "Month",
  lp_perf_total_in_view: "Total profit",
  lp_perf_running: "{amount} total",
  lp_perf_month_total: "{month} total",
  lp_perf_day_reading: "{day} · {amount}",
  lp_perf_prev_month: "Previous month",
  lp_perf_next_month: "Next month",

  // ── Nothing to show yet ────────────────────────────────────────
  lp_perf_no_history_title: "No profit history yet",
  lp_perf_no_history_body:
    "This agent needs to run for a day before there is anything to draw. Its positions and fees are below in the meantime.",
  lp_perf_after_first_close: "after the first close",
  lp_perf_after_30_days: "after 30 days",
  // One footnote under the rail, never a marker per figure.
  lp_perf_estimated:
    "* Fee figures on a paper book are modelled from the pool's own rate, not observed on-chain.",
} as const;
