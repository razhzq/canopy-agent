// Strings shared by more than one screen: the empty / error / signed-out
// states, generic verbs, and the words that label a control rather than a
// concept ("Copy", "Close", "Cancel").
//
// Anything used by exactly one component belongs in that component's
// namespace, not here — this file is for the strings that would otherwise be
// translated twice and drift.

export const enCommon = {
  // ── Live-screen states ─────────────────────────────────────────
  state_signed_out_title: "Sign in to continue",
  state_signed_out_body:
    "Your agents are tied to your Canopy account. Signing in here uses the same login as the exchange.",
  state_sign_in: "Sign in",
  state_error_title: "Could not load",
  state_try_again: "Try again",

  // ── Generic verbs and controls ─────────────────────────────────
  common_cancel: "Cancel",
  common_close: "Close",
  common_back: "Back",
  common_next: "Next",
  common_continue: "Continue",
  common_confirm: "Confirm",
  common_save: "Save",
  common_done: "Done",
  common_copy: "Copy",
  common_copied: "Copied",
  common_retry: "Retry",
  common_loading: "Loading…",
  common_none: "None",
  common_all: "All",
  common_yes: "Yes",
  common_no: "No",
  common_edit: "Edit",
  common_remove: "Remove",
  common_view: "View",
  common_dismiss: "Dismiss",
  common_source_of: "Source: {source}",
  common_breadcrumb: "Breadcrumb",

  // ── Errors thrown client-side ──────────────────────────────────
  // One key, not four. Three screens had grown their own copy of this exact
  // sentence, which is three chances for them to disagree in a second language.
  error_not_signed_in: "not signed in",
  error_session_expired: "your session expired — sign in and try again",
  // RPC transport failures, surfaced when canopy-be cannot answer and the
  // browser reads the chain itself. See lib/chainBalance.
  error_rpc_status: "the network returned {status}",
  error_rpc_empty: "the network returned no result",

  // ── Relative time ──────────────────────────────────────────────
  // Short on purpose: these render inside 90px table columns and beside
  // mobile rows measured to the pixel. See `relativeTime` in lib/format.
  time_just_now: "just now",
  // For a thing that has not happened at all, where "—" would read as a
  // missing reading rather than as an agent that has never run.
  time_never: "never",
  time_minutes: "{count}m ago",
  time_hours: "{count}h ago",
  time_days: "{count}d ago",

  // The elapsed-only form, with no "ago". Used where the column is a timestamp
  // gutter and the surrounding rows already establish that these are ages.
  time_compact_now: "now",
  time_compact_minutes: "{count}m",
  time_compact_hours: "{count}h",
  time_compact_days: "{count}d",

  // ── Skeleton labels ────────────────────────────────────────────
  // The whole of what a screen reader gets while a page is in flight, so each
  // one names the SPECIFIC thing being fetched — "Loading" alone tells someone
  // who cannot see the bars nothing they did not already know.
  // The spoken stand-in for a sparkline with nothing to draw.
  chart_no_readings: "No readings",

  loading_agent: "Loading agent",
  loading_agents: "Loading your agents",
  loading_strategy: "Loading strategy",
  loading_cycles: "Loading cycles",
  loading_trace: "Loading the trace",
  loading_record: "Loading record",
  loading_trades: "Loading trades",
  loading_thread: "Loading the thread",
  loading_notifications: "Loading notifications",
  loading_wallets: "Reading your wallets",
  loading_activity: "Loading activity",
  loading_marketplace: "Loading marketplace",
  loading_portfolio: "Loading your portfolio",
  loading_plan: "Loading your plan",
  loading_telegram: "Loading Telegram settings",
} as const;
