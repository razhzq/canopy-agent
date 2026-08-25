// The desktop agent page (wireframe 1k) — the owner's view of one agent: its
// performance, its book, what it is watching for, its strategy rail, and the
// two destructive controls at the bottom.

export const enAgentDetail = {
  ad_signed_out_note: "Sign in to see this agent.",
  ad_sign_in_to_change: "Sign in to change this agent.",
  ad_back: "← My agents",

  // ── Book switch ────────────────────────────────────────────────
  ad_book_aria: "Paper or live book",
  ad_book_paper: "Paper",
  ad_book_live: "Live",
  ad_live_closed: "Real-money trading isn't open yet",
  ad_no_paper_run: "This agent has no paper run",
  ad_promote_hint: "Set this agent up to trade real capital",
  ad_settled_paper_note: "The settled paper run. This agent trades live now.",
  // The hovered reason is a clause; the full stop belongs to the sentence, and
  // Chinese ends one with a different mark.
  ad_hover_reason: "{reason}.",
  ad_stopped_itself: "Stopped itself: {reason}.",

  // ── Status chip ────────────────────────────────────────────────
  ad_status_running: "Running",
  ad_status_closing: "Closing out",

  // ── Section rules ──────────────────────────────────────────────
  ad_sec_performance: "Performance",
  ad_sec_positions: "Positions",
  ad_sec_watching: "Watching now",
  ad_sec_activity: "Activity",
  ad_sec_strategy: "Strategy · applies to every market",
  ad_sec_agent_level: "Agent-level",

  // ── Watching now ───────────────────────────────────────────────
  ad_checked: "checked {when}",
  ad_starting: "starting",
  ad_next: " · next {when}",
  ad_not_ticking: "not ticking",
  ad_model_unfunded:
    "Waiting for its model balance. {model} is prepaid — fund it and this agent starts on its own, no restart needed.",
  ad_model_generic: "The model",
  ad_entry_note: "Entry condition. Nothing is bought until this is met.",
  ad_rules_unreadable:
    "This strategy's rules are not readable — the detail route returned no rule set.",
  // The headline sentence. `who` is a ticker or the generic subject below.
  ad_headline_drop: "{who} drops {pct}%+ on the day",
  ad_headline_rule: "{label} {op} {value}",
  ad_headline_market: "The market",

  ad_exit_take_profit: "Exit — take profit",
  ad_exit_stop_loss: "Exit — stop-loss",
  ad_exit_unset: "Not set — platform default for the posture.",
  ad_tp_body: "Sell at +{pct}% from entry",
  ad_sl_body: "Sell at −{pct}% from entry",
  ad_sl_body_hold: "Sell at −{pct}% from entry, or after {days}d",
  ad_breaker_note:
    "Agent-wide breaker at −{pct}% from the high-water mark: past that it liquidates and stops on its own.",

  // ── Activity ───────────────────────────────────────────────────
  ad_all_cycles: "All cycles →",
  ad_append_only:
    "Append-only. Every check is recorded, whether it traded or not.",
  ad_append_only_skipped:
    "Append-only. Every check is recorded, whether it traded or not — the last cycle did not trade: {reason}.",

  // ── Strategy rail ──────────────────────────────────────────────
  ad_first_wait: "First, wait for",
  ad_then_bars:
    "Then the rules below apply, on a later bar, for up to {bars} bars. Nothing is bought on the bar the setup appears.",
  ad_then_bars_invalidate:
    " The wait is cancelled if the setup breaks down first.",
  ad_then_buy: "Then buy when",
  ad_no_rules: "No rules returned.",
  ad_chip_take_profit: "Take profit:",
  ad_chip_stop_loss: "Stop-loss:",
  ad_chip_chart: "Chart:",
  ad_accumulation: "Accumulation",
  ad_accumulation_warning:
    "Take profit and stop-loss measure the blend of every entry, not each one separately.",
  ad_edit_strategy: "Edit strategy",
  ad_anyof_or: "or",

  // ── Universe ───────────────────────────────────────────────────
  ad_universe: "Universe",
  ad_screening_one: "Screening 1 market",
  ad_screening_many: "Screening {count} markets",
  ad_no_universe:
    "No universe is pinned, so the agent screens the whole {class} class each cycle.",
  ad_add_market: "+ Add market",
  ad_not_priced: "not priced",
  ad_remove: "Remove",
  ad_removing: "…",
  ad_remove_aria: "Stop trading {label}",
  ad_remove_title: "Stop trading this market. Anything held stays open.",
  ad_of_target: "/ {target}%",

  // ── Agent-level rail ───────────────────────────────────────────
  ad_row_book: "Book",
  ad_book_paper_value: "Paper · simulated fills",
  ad_book_live_value: "Live · real capital",
  ad_row_capital: "Capital",
  ad_row_cadence: "Cadence",
  ad_row_deployed: "Deployed",
  ad_row_autonomy: "Autonomy",
  ad_row_position_cap: "Position cap",
  ad_position_cap_value: "≤ {amount} per market",
  ad_row_open_positions: "Open positions",
  ad_row_compliance: "Compliance",
  ad_cadence_days: "{n}d",
  ad_cadence_hours: "{n}h",
  ad_cadence_minutes: "{n} min",

  // ── Controls ───────────────────────────────────────────────────
  ad_resume_agent: "Resume agent",
  ad_pause_agent: "Pause agent",
  ad_close_all: "Close all positions",
  ad_delete_agent: "Delete agent",
  ad_busy: "…",
  ad_flatten_nothing: "Nothing was open to close.",
  ad_flatten_one: "Closed 1 position. The agent is paused.",
  ad_flatten_many: "Closed {count} positions. The agent is paused.",

  // ── Delete dialog ──────────────────────────────────────────────
  ad_delete_title: "Delete this agent?",
  ad_delete_1_empty: "It holds nothing, so there is nothing to sell.",
  ad_delete_1_one:
    "It closes 1 position at the current pool price — {amount} invested. This is a real sale and the result lands in your record.",
  ad_delete_1_many:
    "It closes {count} positions at the current pool price — {amount} invested. This is a real sale and the result lands in your record.",
  ad_delete_2:
    "It revokes its own wallet authority. That cannot be undone here.",
  ad_delete_3:
    "It disappears from your agents. Pausing is the reversible option.",
  ad_delete_4:
    "{name} comes off Explore with it — this is your last agent on it. Anyone already deployed keeps running; nobody new can deploy.",
  ad_delete_kept:
    "Nothing is erased. Every cycle, decision and trade stays on the record, and the strategy keeps whatever track record this agent earned.",
  ad_delete_unpriced:
    "If a position cannot be priced when you confirm, the agent winds down and stays visible instead of being hidden while it still holds something.",
  ad_delete_confirm_with_positions: "Close positions and delete",
  ad_closing: "Closing…",

  // ── Flatten dialog ─────────────────────────────────────────────
  ad_flatten_title: "Close every position?",
  ad_flatten_1_one:
    "It sells 1 position at the current pool price — {amount} invested. Real sales, and the result lands in your record.",
  ad_flatten_1_many:
    "It sells {count} positions at the current pool price — {amount} invested. Real sales, and the result lands in your record.",
  ad_flatten_2:
    "It then pauses. Otherwise it would start buying again on its next cycle.",
  ad_flatten_3:
    "The agent, its strategy and its whole record stay exactly as they are.",
  ad_flatten_resume: "Resume it whenever you want. Nothing here is one-way.",
  ad_flatten_unpriced:
    "A position that cannot be priced right now is left open rather than sold at a guess. The agent keeps trying and stays visible while it settles.",

  // ── Relative time, forward ─────────────────────────────────────
  ad_due_now: "due now",
  ad_in_minutes: "in {count} min",
  ad_in_hours: "in {count}h",
} as const;
