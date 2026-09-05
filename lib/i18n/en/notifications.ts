// The notification bell's dropdown and the page it becomes on a phone. One
// namespace because they render the same rows.

export const enNotifs = {
  nc_aria: "Notifications",
  nc_aria_unread: "Notifications, {count} unread",
  nc_fill_bought: "Bought",
  nc_fill_sold: "Sold",
  nc_fill_added: "Added liquidity",
  nc_fill_removed: "Removed liquidity",
  nc_fill_paper: "paper",
  nc_fill_realised: "Realised",
  nc_tab_all: "All",
  nc_tab_approvals: "Waiting",
  nc_tab_trades: "Trades",
  nc_empty_waiting: "Nothing is waiting on you.",
  nc_empty_trades: "No fills yet.",
  nc_mark_all_failed: "Didn't clear — retry",
  nc_mark_all: "Mark all read",
  nc_marking_all: "Clearing…",
  nc_title: "Notifications",
  nc_empty:
    "Nothing yet. Your agents will report here when they trade, when something needs you, and when a limit is breached — a quiet feed means they looked and found nothing worth doing.",
  nc_empty_page:
    "Nothing yet. Your agents report here when they trade, when something needs you, and when a limit is breached — a quiet feed means they looked and found nothing worth doing.",
  nc_empty_filter: "Nothing in this filter.",
  nc_unread: "{count} unread",
  nc_undeliverable:
    "Couldn't reach your Telegram — you're seeing this here instead.",

  // ── Filters ────────────────────────────────────────────────────
  nc_filter_all: "All",
  nc_filter_needs: "Needs you",
  nc_filter_trades: "Trades",
  nc_filter_risk: "Risk",

  // ── Approve bar ────────────────────────────────────────────────
  nc_applied: "Applied — it follows the new rule from its next cycle.",
  nc_dismissed: "Left as it was.",
  nc_decline: "Decline",
  nc_apply: "Apply",
  nc_applying: "Applying…",
  nc_why: "Why?",
  nc_session_expired: "your session expired — sign in and try again",

  // ── Telegram strip ─────────────────────────────────────────────
  nc_tg_offer: "Get these on Telegram",
  nc_tg_connect: "Connect",
  nc_tg_busy: "…",
  nc_tg_reconnect: "Reconnect",
  nc_tg_reconnect_title:
    "Issue a fresh link. The current chat keeps working until the new one is confirmed.",

  // ── Kinds ──────────────────────────────────────────────────────
  nc_kind_fill: "Trade",
  nc_kind_proposal: "Needs you",
  nc_kind_breach: "Breach",
  nc_kind_risk_hold: "Risk hold",
  nc_kind_state_change: "Status",
  nc_kind_cycle: "Cycle",
  nc_kind_unknown: "Update",

  // ── Chat sheet ─────────────────────────────────────────────────
  chat_title: "Chat with {name}",
  chat_your_agent: "your agent",
  chat_agent_fallback: "Your agent",
  chat_subtitle: "Proposes · you decide",
  chat_waiting_count: "{count} waiting",
  chat_close_aria: "Close chat",
  chat_button_aria: "Chat with your agent",
  chat_button_close: "Close chat",
  chat_button_aria_waiting: "Chat with your agent — {count} waiting on you",
} as const;

// The agent thread — the conversation an owner has with their own agent, and
// the diff it proposes.
export const enThread = {
  th_sign_in: "Sign in again.",
  th_answering: "Answering",
  th_latest: "Latest",
  th_message_aria: "Message this agent",
  th_placeholder: "Ask it something, or tell it what to change…",
  th_chars_left: "{count} characters left",
  th_enter_hint: "Enter to send · Shift+Enter for a new line",
  th_send_aria: "Send",

  // The pipeline's real stages, reported as it crosses them.
  th_stage_reading: "Reading your message",
  th_stage_drafting: "Drafting the changes",
  th_stage_searching: "Checking its record",

  th_applied: "Applied",
  th_declined: "Declined",
  th_settled: "Settled",
  th_read_cycle: "Read cycle {cycles}",
  th_read_cycles: "Read cycles {cycles}",
  th_settled_suffix: " · settled",
  th_see_cycle: "See the cycle →",
  th_mark_handled: "Mark handled",
  th_takes_effect:
    "Takes effect from the next cycle. Same agent, same positions.",
  th_leave_it: "Leave it",
  th_apply: "Apply",
  th_applying: "Applying…",
} as const;
