// The activity log on an agent's page, and the account-wide feed that shows
// the same cycles. One namespace because `headline` and the status lookups are
// shared between them — two copies would drift, in either language.

export const enActivity = {
  // ── Empty and polling ──────────────────────────────────────────
  activity_empty_title: "Nothing yet",
  // The cycle's row is opened before its market preparation, so it appears
  // here within a poll of the agent being created rather than once all the
  // upstream work has finished — which used to take up to two minutes.
  activity_empty_body:
    "The first cycle starts the moment the agent is created and appears here within a few seconds — it runs whether or not the agent finds anything to buy. After that it wakes once an hour.",
  activity_checking: "Checking every 15s",
  activity_signed_out_note: "Sign in to see this agent.",

  // ── Replay progress ────────────────────────────────────────────
  activity_reveal_progress: "{shown} of {total}",
  activity_still_running: "still running",
  activity_hide_notes: "Hide screening notes",
  activity_notes_one: "1 screening note",
  activity_notes_many: "{count} screening notes",

  // ── Cycle status ───────────────────────────────────────────────
  activity_status_running: "Running",
  activity_status_ok: "Complete",
  activity_status_error: "Failed",
  activity_status_skipped: "Skipped",

  // ── Cycle headline ─────────────────────────────────────────────
  activity_headline_running: "Running now…",
  activity_headline_failed: "Cycle failed",
  activity_headline_skipped: "Skipped",
  activity_headline_closed_and_opened: "{closed} closed, {opened} opened",
  activity_headline_closed_one: "1 position closed",
  activity_headline_closed_many: "{count} positions closed",
  activity_headline_fills_one: "1 fill",
  activity_headline_fills_many: "{count} fills",
  activity_headline_approved: "{count} approved by the risk gate",
  activity_headline_blocked: "{count} blocked by the risk gate",
  activity_headline_nothing: "Screened the universe, proposed nothing",

  // A copy agent's header names the leader's verb. Not "fills": a mirrored
  // position is not a fill, and counting them as one read 0 on every cycle.
  activity_headline_mirrored: "Mirrored {count}",
  activity_headline_copy_closed: "Closed {count}",
  activity_headline_followed: "Followed {count}",
  activity_headline_not_copied: "Didn't copy {count}",
  activity_headline_copy_nothing: "Nothing to copy",
  activity_headline_baseline: "Started flat",
  activity_headline_join: " · ",

  // ── A liquidity book, above its feed ───────────────────────────
  activity_book_at_work: "{amount} at work across {positions}",
  activity_book_one: "1 position",
  activity_book_many: "{count} positions",
  activity_book_flat: "Nothing open right now — waiting on the leader",
  activity_book_note: "Updated every cycle",
  activity_copy_empty_title: "The leader hasn't moved yet",
  activity_copy_empty_body:
    "This agent copies what the wallet it follows does next, not what that wallet already holds. Every open, close and refusal will appear here.",

  // ── Account-wide feed ──────────────────────────────────────────
  feed_empty_title: "Nothing yet",
  feed_empty_no_agents:
    "Deploy an agent and every cycle it runs shows up here — including the ones where it decided to do nothing.",
  feed_empty_no_cycles:
    "Your agents haven't completed a cycle yet. The first one appears here as soon as they wake up.",
  feed_empty_action: "Create agent",
  feed_filter_all: "All",
  feed_filter_traded: "Traded",
  feed_filter_quiet: "Quiet",
  feed_none_traded: "No cycles traded in this window.",
  feed_all_traded: "Every cycle in this window traded.",
  feed_badge_paper: "Paper",
  // The footer, whole rather than assembled: it counts three different things
  // and English pluralises two of them with an apostrophe that has no analogue.
  feed_footer_one:
    "{shown} of {total} · last {per} cycles from 1 agent you own",
  feed_footer_many:
    "{shown} of {total} · last {per} cycles from {agents} agents you own",
  feed_footer_partial_one: " · 1 agent's log didn't load",
  feed_footer_partial_many: " · {count} agents' logs didn't load",

  // ── Skip reasons ───────────────────────────────────────────────
  skip_market_closed: "Markets were closed",
  skip_no_candidates: "Nothing passed the screen",
  skip_budget_exhausted: "Out of model budget",
  skip_model_balance_exhausted: "Out of model balance",
  skip_model_unfunded: "Waiting to be funded",
  skip_model_unavailable: "Model unavailable",
  skip_paused: "Agent is paused",
  skip_expired: "Mandate expired",
  skip_not_active: "Agent is not active",

  // ── Copy LP log ────────────────────────────────────────────────
  // A copy agent's activity is a flat log, not cycles, and speaks of the
  // leader and "the copy" — there is no agent voice, because nothing reasons.
  clplog_title: "Log",
  clplog_subtitle: "Every move the leader made, and what this copy did about it.",
  clplog_filter_aria: "Filter the log",
  clplog_filter_all: "All",
  clplog_filter_trades: "Trades",
  clplog_filter_skipped: "Skipped",
  clplog_filter_errors: "Errors",
  clplog_filter_empty: "Nothing of this kind in the entries loaded.",
  clplog_col_time: "Time",
  clplog_col_event: "Event",
  clplog_col_pool: "Pool",
  clplog_col_details: "Details",
  clplog_col_amount: "Amount",
  clplog_day_today: "Today · {date}",
  clplog_day_yesterday: "Yesterday · {date}",
  clplog_kind_opened: "Opened",
  clplog_kind_added: "Added",
  clplog_kind_reduced: "Reduced",
  clplog_kind_reranged: "Re-ranged",
  clplog_kind_closed: "Closed",
  clplog_kind_take_profit: "Take profit",
  clplog_kind_stop_loss: "Stop loss",
  clplog_kind_skipped: "Skipped",
  clplog_kind_error: "Error",
  clplog_kind_started: "Started",
  clplog_kind_note: "Update",
  clplog_started_flat: "Copying started. The leader held nothing yet.",
  clplog_started_one: "Copying started. 1 position the leader already held was left alone.",
  clplog_started_many: "Copying started. {count} positions the leader already held were left alone.",
  clplog_skipped_reason: "Not copied — {reason}",
  clplog_skipped: "Not copied.",
  clplog_failed: "Couldn't follow this move — {error}",
  clplog_opened: "Leader opened a position. Copied {share} of it.",
  clplog_closed: "{reason} Removed {size}.",
  clplog_closed_reason: "The leader closed this position.",
  clplog_added: "Leader added. Added {size}{limit}.",
  clplog_reduced: "Leader took some off. Removed {size}.",
  clplog_reranged: "Leader moved their range. The copy moved with it{limit}.",
  clplog_limit_cash: ", as far as the cash would go",
  clplog_limit_capped: ", up to your max amount",
  clplog_amount_in: "{amount} in",
  clplog_fees: "{fees} fees",
  clplog_tx_one: "Transaction",
  clplog_tx_many: "{count} transactions",
  clplog_view_tx: "View transaction",
  clplog_load_older: "Load older",
  clplog_loading_older: "Loading…",
  clplog_empty_title: "Nothing yet",
  clplog_empty_body: "Entries appear here when the leader opens, adds to, trims or closes a position, and when the copy follows or skips it.",
} as const;
