// The mobile home feed (wireframe M01) and the small shared badges that ride
// along beside an agent's name.

export const enHome = {
  home_balance_window_one: "24H · ACROSS 1 AGENT",
  home_balance_window_many: "24H · ACROSS {count} AGENTS",
  home_top_performers: "Top performers",
  home_chip_all: "All",
  home_chip_top: "Top PnL",
  home_chip_new: "New",
  home_chip_held: "Most deployed",
  home_empty_title: "Nothing listed yet",
  home_empty_body:
    "Published strategies show up here with a live record. Build one and it starts on live data in paper mode.",
  home_empty_action: "Create agent",
  home_row_deployed: "{count} deployed",
  home_row_deployed_win: "{count} deployed · {pct}% win",
  home_badge_paper: "paper",

  // ── Capability notices ─────────────────────────────────────────
  // Split into whole sentences per status: the two are genuinely different
  // news — "it works now" after being told it did not is an apology, and
  // "we built it" is not — and neither survives being assembled from clauses.
  capability_asked_shipped: "You asked for {example}. It has been built and you can use it now.",
  capability_asked_existing:
    "You asked for {example}. It turns out the agent could already do this.",
  capability_set_up_under: "Set it up under {key}.",
  capability_dismiss: "Dismiss",

  // ── Model badge ────────────────────────────────────────────────
  model_badge_title: "Reasons with {label} — Canopy-hosted Qwen3",
} as const;
