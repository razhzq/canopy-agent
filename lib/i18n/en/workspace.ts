// "My agents" (wireframe 1j) — the summary band, the self-stopped alert, and
// the table of everything you own.

export const enWorkspace = {
  my_empty_title: "No agents yet",
  my_empty_body:
    "Build one and it starts on live data in paper mode — free, with no time limit and nothing funded.",
  my_empty_action: "Create agent",

  // ── Band ───────────────────────────────────────────────────────
  my_band_paper_capital: "Paper capital",
  my_band_capital_deployed: "Capital deployed",
  // The band TOTALS where a row does not, so the note carries the difference
  // the figure cannot: six agents at $10,000 read "$60k" here and "$10,000"
  // one click later, and both are right.
  my_band_across_one: "across 1 agent",
  my_band_across_many: "across {count} agents",
  my_band_pnl: "P&L · since deploy",
  my_band_no_readings: "no readings yet",
  my_band_live: "Live",
  my_band_paper: "Paper",
  my_band_needs_you: "Needs you",
  my_band_unanswered: "unanswered",
  my_band_nothing_waiting: "nothing waiting",

  // ── Self-stopped alert ─────────────────────────────────────────
  // One sentence: the agent's name, when it stopped and why all sit in
  // different places in the two languages.
  my_stopped_itself: "{name} stopped itself — {when}, {reason}. Review the limits or resume.",
  my_review: "Review",

  // ── Breaker reasons ────────────────────────────────────────────
  reason_max_drawdown: "it breached its drawdown limit",
  reason_wallet_revoked: "its wallet delegation was revoked",
  reason_wallet_expired: "its wallet delegation expired",
  reason_mandate_expired: "its mandate expired",
  reason_insufficient_funds: "it ran out of funds",

  // ── Table ──────────────────────────────────────────────────────
  my_col_agent: "Agent",
  my_col_wallet: "Wallet",
  my_col_status: "Status",
  my_col_capital: "Capital",
  my_col_return: "Return",
  my_col_last_ran: "Last ran",
  my_row_paper_suffix: " · paper",
  my_row_copied: "copied",
  my_row_unfunded: "unfunded",
  my_retry: "Retry",
  my_retry_title: "The equity reading did not load. Its own page has the figure.",
  my_no_data: "no data",
  my_no_data_title: "No cycle has recorded an equity reading yet.",
  my_resume: "Resume",
  my_pause: "Pause",
  my_busy: "…",
  my_edit_limits: "Edit limits",
  my_detail: "Detail",
  my_footnote:
    "Your agent's rules are yours to change — take profit, stop loss, what it trades, any of it — and the change applies to the agent you are already running, from its next cycle. That happens in the agent's chat, which is where “edit limits” goes.",

  // ── Agent status ───────────────────────────────────────────────
  agent_status_active: "Live",
  agent_status_paused: "Paused",
  agent_status_liquidating: "Closing out",
  agent_status_stopped: "Stopped",
  agent_status_draft: "Draft",
} as const;
