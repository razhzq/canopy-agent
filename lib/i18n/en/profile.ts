// The mobile profile (wireframe M02) — identity, aggregate equity, and the
// agents you own. The desktop portfolio has its own namespace; these two
// screens show the same figures in different shapes and share no strings.

export const enProfile = {
  profile_edit_aria: "Edit your profile",
  profile_notifications_aria: "Notifications",
  profile_activity_aria: "Activity",
  profile_settings_aria: "Settings",
  profile_your_portfolio: "Your portfolio",
  profile_stat_agent: "Agent",
  profile_stat_agents: "Agents",
  profile_stat_cycles: "Cycles",
  profile_marked_live: "Marked live",
  profile_marked_last_cycle: "Marked at last cycle",
  profile_open_amount: "{amount} open",
  profile_paper: "Paper",
  profile_live: "Live",
  profile_aggregate_equity_one: "Aggregate equity · 1 agent",
  profile_aggregate_equity_many: "Aggregate equity · {count} agents",
  profile_no_readings: "No readings yet — the curve starts at the first settled cycle.",
  profile_capital_note:
    "Capital held at today's total, so funding an agent does not read as a gain.",
  profile_idle_cash: "Idle cash",
  profile_your_agents: "Your agents",
  profile_filter_live: "Live",
  profile_filter_paused: "Paused",
  profile_none_running: "No agents running right now.",
  profile_none_paused: "Nothing paused.",
  profile_deployed: "{amount} deployed",
  profile_deployed_cycle: "{amount} deployed · cycle {cycle}",
  profile_badge_paper: "paper",
  profile_language: "Language",
} as const;
