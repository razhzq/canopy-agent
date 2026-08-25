// One agent's own page — the mobile sheet (wireframe M03) and the desktop
// workspace share this namespace, because they show the same facts and a
// figure named two ways on two screens is the drift this file exists to stop.

export const enAgent = {
  // ── Mobile hero ────────────────────────────────────────────────
  agent_back_aria: "Back to my agents",
  agent_chat_aria: "Chat with this agent",
  agent_live_pill: "LIVE",
  agent_mode_paper: "PAPER",
  agent_mode_live: "LIVE",
  // The strategy class is a backend enum shown as-is; only the frame is ours.
  agent_subtitle: "{mode} · {class}",
  agent_subtitle_cycle: "{mode} · {class} · CYCLE {cycle}",

  // ── NAV block ──────────────────────────────────────────────────
  agent_nav_label: "Agent NAV",
  agent_nav_label_cycle: "Agent NAV · cycle {cycle}",
  agent_since_deploy: "since deploy",
  agent_curve_pending: "The curve starts at the first settled cycle.",
  agent_cell_return: "Return",
  agent_cell_win_rate: "Win rate",
  agent_cell_max_dd: "Max DD",
  agent_cell_realised: "Realised",

  // ── Live cycle strip ───────────────────────────────────────────
  agent_cycle_running: "running",
  agent_cycle_label: "Cycle {seq} · {status}",
  agent_cycle_in_progress: "in progress",
  agent_phase_scan: "Scan",
  agent_phase_council: "Council",
  agent_phase_execute: "Execute",
  agent_phase_settle: "Settle",

  // ── Positions and markets ──────────────────────────────────────
  agent_open_positions: "Open positions",
  agent_nothing_open: "Nothing open — the agent is in cash.",
  agent_cost: "{amount} cost",
  agent_markets_title: "Markets it may trade",
  agent_add_market: "Add a market",

  // ── Actions ────────────────────────────────────────────────────
  agent_resume: "Resume",
  agent_pause: "Pause",
  agent_add_funds: "Add funds",
  agent_busy: "…",

  // ── Workspace shell ────────────────────────────────────────────
  ws_eyebrow: "Agent",
  ws_back: "← My agents",
  ws_fallback_name: "Agent {id}",
  ws_badge_paper: "Paper",
  ws_views_aria: "Agent views",
  ws_tab_overview: "Overview",
  ws_tab_chat: "Chat",
  ws_tab_cycles: "Cycles",
  // The header's status word. "Running" rather than "Live" — this bar sits
  // above a paper agent as often as a funded one, and "Live" would be read as
  // the other thing it means in this product.
  ws_status_active: "Running",
  ws_status_liquidating: "Closing out",
  ws_status_paused: "Paused",
  ws_status_stopped: "Stopped",
  ws_status_draft: "Draft",

  // ── Route badge ────────────────────────────────────────────────
  route_badge_aria: "{router} on {chain}",
} as const;
