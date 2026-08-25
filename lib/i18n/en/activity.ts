// The activity log on an agent's page, and the account-wide feed that shows
// the same cycles. One namespace because `headline` and the status lookups are
// shared between them — two copies would drift, in either language.

export const enActivity = {
  // ── Empty and polling ──────────────────────────────────────────
  activity_empty_title: "Nothing yet",
  activity_empty_body:
    "The first cycle is starting now and appears here within a minute or two — it runs whether or not the agent finds anything to buy. After that it wakes once an hour.",
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
} as const;
