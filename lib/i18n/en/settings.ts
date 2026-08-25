// The settings page: plan and billing, and the Telegram connection.

export const enSettings = {
  // ── Plan ───────────────────────────────────────────────────────
  billing_section: "PLAN",
  billing_note: "{used} of {slots} agents · {live} live",
  billing_paper_agents: "Paper agents",
  billing_paper_note_earned: "{base} free + {earned} earned",
  billing_paper_note_base: "{base} free · invite to earn more",
  billing_live_agents: "Live agents",
  billing_live_each: "{amount}/mo each",
  billing_live_total: "{amount}/mo total",

  billing_invite_title: "Invite someone, get an agent",
  billing_invite_body:
    "Every person who joins on your invite code adds one paper agent to your allowance, permanently. There is no limit.",
  billing_invite_yours: "Yours is {code} — it's in the account menu, top right.",

  billing_over_title: "More agents than your allowance",
  billing_over_body:
    "These were deployed before the limit existed and they keep running. You cannot create another until you are back under {slots}.",

  billing_failed_title: "That did not go through",
  billing_none_found_title: "Still no subscription found",
  billing_none_found_body:
    "If you have just paid, it can take a moment to reach us. Check again in a minute — and if it still says this, the payment did not complete.",

  billing_agent_number: "Agent #{id}",
  // "Cancelled" would be a lie while it is still live and still paid for.
  billing_live_until: "Live until {date} — then paused",
  billing_renews: "{amount}/mo · renews {date}",
  billing_cancel: "Cancel",
  billing_date_unknown: "unknown",

  billing_paper_default:
    "Every agent runs on paper by default — same universe, same council, same decision record. Going live costs {amount}/month per agent and is started from the agent's own page.",
  billing_live_price: "Live is {amount}/month per agent. Start it from the agent's page.",
  billing_recheck: "I've paid — check again",
  billing_checking: "Checking…",
  billing_ending_title: "Ending at the end of the period",
  billing_ending_body:
    "Those agents keep trading live until then. When the period ends they are paused holding their positions — nothing is sold for you.",
  billing_session_expired: "Session expired. Sign in again.",

  // ── Telegram ───────────────────────────────────────────────────
  tg_section: "TELEGRAM",
  tg_state_connected: "connected",
  tg_state_muted: "muted",
  tg_state_not_connected: "not connected",
  tg_signed_out_note: "Notification settings belong to your account.",
  tg_unavailable_title: "Not available here",
  tg_unavailable_body:
    "This deployment has no Telegram bot configured, so there is nothing to connect to yet.",

  tg_will_send_title: "What you will be sent",
  tg_will_send_1: "— Every trade an agent makes, with what it earned or lost.",
  tg_will_send_2: "— Anything waiting on your decision.",
  tg_will_send_3: "— A drawdown limit being hit, and the agent stopping itself.",
  tg_will_send_4: "— Trading being frozen because prices went unreadable, and it lifting.",

  tg_wont_send_title: "What you will not be sent",
  tg_wont_send_body:
    "Ordinary cycles where the agent looked and did nothing. That is most of them — about three in four — and sending those would bury the messages above. Silence here means the agent is working, not that it is stuck.",

  tg_approving_title: "Approving from Telegram",
  tg_approving_body:
    "Not possible, on purpose. Telegram identifies a chat, not a person — so a reply that could authorise a trade would turn an unlocked phone into trading authority. Proposals are approved in Canopy, behind your login.",

  tg_connected: "Connected",
  tg_connected_as: "Connected · @{username}",
  tg_delivering: "Alerts are being delivered to this chat.",
  tg_muted_body: "Muted. The chat stays connected; nothing is sent.",
  tg_mute: "Mute",
  tg_unmute: "Unmute",
  tg_reconnect: "Reconnect",
  tg_disconnect: "Disconnect",
  tg_opening: "Opening Telegram…",
  tg_connect: "Connect Telegram",
  tg_mute_vs_disconnect:
    "Muting keeps the connection and stops the messages. Disconnecting forgets the chat entirely — reconnecting needs a new link. If messages have stopped arriving and you did not mute them, use Reconnect: it issues a fresh code without losing this one until the new chat is confirmed.",
  tg_connect_help:
    "This opens a chat with the Canopy bot carrying a one-time code. Send the message it pre-fills, then come back and refresh this page — the connection completes in Telegram, so this screen only learns about it on its next look.",
} as const;
