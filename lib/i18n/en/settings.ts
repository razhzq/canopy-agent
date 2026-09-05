// The settings page does two things: shows how many agents you have, and
// connects Telegram. Every string here earns its place against that.

export const enSettings = {
  // ── Agents ─────────────────────────────────────────────────────
  billing_section: "Agents",
  billing_note: "{used} of {slots} · {live} live",
  billing_paper_agents: "Paper agents",
  billing_paper_note_earned: "{base} free + {earned} from invites",
  billing_paper_note_base: "{base} free",
  billing_live_agents: "Live agents",
  billing_live_each: "{amount}/mo each",
  billing_live_total: "{amount}/mo total",

  // One line, not a callout: the only way to more paper agents.
  billing_invite_line: "Each invite that joins adds a paper agent. Your code is {code}.",
  billing_invite_line_nocode: "Each invite that joins adds a paper agent.",

  billing_over_title: "Over your allowance",
  billing_over_body: "These keep running. Create another once you're under {slots}.",

  billing_failed_title: "That didn't go through",
  billing_none_found_title: "No subscription yet",
  billing_none_found_body: "Payments take a minute to reach us. Check again shortly.",

  billing_agent_number: "Agent #{id}",
  // "Cancelled" would be a lie while it is still live and still paid for.
  billing_live_until: "Live until {date}, then paused",
  billing_renews: "{amount}/mo · renews {date}",
  billing_cancel: "Cancel",
  billing_date_unknown: "unknown",

  billing_live_price: "Live is {amount}/mo per agent, started from the agent's page.",
  billing_recheck: "Check payment",
  billing_checking: "Checking…",
  billing_ending_title: "Ending this period",
  billing_ending_body: "They trade live until then, then pause holding their positions.",
  billing_session_expired: "Session expired. Sign in again.",

  // ── Telegram ───────────────────────────────────────────────────
  tg_section: "Telegram",
  tg_state_connected: "connected",
  tg_state_muted: "muted",
  tg_state_not_connected: "not connected",
  tg_signed_out_note: "Notification settings belong to your account.",
  tg_unavailable_title: "Not available here",
  tg_unavailable_body: "This deployment has no Telegram bot.",

  tg_will_send_title: "You'll get",
  tg_will_send_1: "Every trade, with the result.",
  tg_will_send_2: "Anything waiting on your decision.",
  tg_will_send_3: "Stops and freezes, and when they lift.",
  tg_wont_line: "Not quiet cycles. Approvals stay in Canopy.",

  tg_connected: "Connected",
  tg_connected_as: "@{username}",
  tg_not_connected_body: "Alerts about your agents, in a chat.",
  tg_delivering: "Delivering",
  tg_muted_body: "Muted",
  tg_delivery_aria: "Delivery",
  tg_toggle_delivering: "Delivering",
  tg_toggle_muted: "Muted",
  tg_connect: "Connect Telegram",
  tg_opening: "Opening Telegram…",
  // After Connect: the claim finishes in Telegram, and this page watches for it.
  tg_waiting: "Waiting for Telegram",
  tg_waiting_help: "Send the message Telegram opened with. This updates by itself.",
  tg_open_again: "Open Telegram again",
  tg_reconnect: "Reconnect",
  tg_reconnect_title: "Issue a fresh code. This link stays until the new chat is confirmed.",
  tg_disconnect: "Disconnect",
  tg_disconnect_title: "Forget this chat. Reconnecting needs a new code.",
} as const;
