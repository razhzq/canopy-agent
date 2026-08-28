// The desktop portfolio overview — the aggregate curve, the agent table, and
// the allocation / exposure / settlements rail.

export const enPortfolio = {
  po_empty_title: "Nothing deployed yet",
  po_empty_body:
    "Your portfolio is the sum of your agents. Build one and it starts on live data in paper mode — free, and nothing funded.",
  po_empty_action: "Create agent",

  // ── Header ─────────────────────────────────────────────────────
  po_crumb_portfolio: "Portfolio",
  po_crumb_overview: "Overview",
  po_fallback_title: "Your portfolio",
  po_badge_paper: "Paper",
  po_badge_live: "Live",
  po_meta_agents: "Agents",
  po_meta_cycles: "Cycles settled",
  po_meta_open_book: "Open book",
  po_meta_idle: "Idle",
  po_meta_wallet: "Wallet",
  po_export: "Export CSV",
  po_new_agent: "New agent",

  // ── Curve ──────────────────────────────────────────────────────
  po_curve_label_one: "Aggregate equity · settled per cycle · 1 agent",
  po_curve_label_many: "Aggregate equity · settled per cycle · {count} agents",
  po_curve_against: "{pnl} · {pct} against {capital} deployed",
  po_marked_live: "Marked live",
  po_marked_last: "Marked at last cycle",
  po_readings_one: "{marked} · 1 reading",
  po_readings_many: "{marked} · {count} readings",
  po_curve_note:
    "The dashed rule is capital deployed. Each agent contributes only what it has made, so funding a new one does not read as a gain — which also means the early curve shows today's capital carrying an older P&L, not the balance at the time.",
  po_curve_windowed: " Showing the full history: this window held too few readings.",

  // ── Agent tabs and table ───────────────────────────────────────
  po_tab_live: "live",
  po_tab_paused: "paused",
  po_tab_archived: "archived",
  po_manage: "Manage agents →",
  po_none_live: "No agents running right now.",
  po_none_paused: "Nothing paused.",
  po_none_archived: "Nothing archived.",
  po_col_agent: "Agent",
  po_col_deployed: "Deployed",
  po_col_equity: "Equity",
  po_col_24h: "24h",
  po_col_return: "Return",
  po_col_curve: "Equity curve",
  po_col_status: "Status",
  // The status badge doubles as the pause/resume control — see AgentRowLine.
  po_status_pause: "Pause this agent",
  po_status_resume: "Resume this agent",
  po_status_busy: "…",
  po_status_failed: "Retry",
  // Only the breaker writes a reason; a human pause leaves it null. Resuming an
  // agent that stopped itself is a different act from resuming one you paused.
  po_status_stopped_itself: "Stopped itself: {reason}. Click to resume.",
  po_book_paper: "paper",
  po_book_live: "live",
  po_row_sub: "{class} · {book}",
  po_row_sub_cycle: "{class} · {book} · cycle {cycle}",
  po_deployed_suffix: "{amount} deployed",
  po_no_readings: "no readings",
  // Inline gutter labels on the mobile card, where the figure follows the word.
  po_label_24h: "24h ",
  po_label_return: "return ",

  // ── Rail: allocation ───────────────────────────────────────────
  po_allocation: "Capital allocation",
  po_allocation_note: "{amount} deployed",
  po_idle_label: "idle · unallocated",
  po_idle_tag: "cash",

  // ── Rail: exposure ─────────────────────────────────────────────
  po_exposure: "Open exposure",
  po_exposure_one: "1 position",
  po_exposure_many: "{count} positions",
  po_exposure_empty: "Nothing open. Every agent is in cash.",
  po_fig_open_book: "Open book",
  po_fig_unrealised: "Unrealised",
  po_fig_realised: "Realised",
  po_agents_one: "1 agent",
  po_agents_many: "{count} agents",

  // ── Rail: settlements ──────────────────────────────────────────
  po_settlements: "Recent settlements",
  po_settlements_note: "last cycles",
  po_settlements_empty: "No cycles have settled yet.",
  po_settlement_line: "Cycle {seq} · {when}",
  po_settlement_first: "first",
} as const;
