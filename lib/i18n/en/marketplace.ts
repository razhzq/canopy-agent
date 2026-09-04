// The agent shelf (wireframe 1a) — tabs, the stat rail, and the cards.

export const enMarketplace = {
  // ── Tabs and sorting ───────────────────────────────────────────
  market_tab_all: "All",
  market_tab_listed: "Listed",
  market_tab_paper: "Paper",
  market_sort: "Sort",
  market_sort_return: "Return",
  market_sort_newest: "Newest",
  market_sort_capital: "Capital",
  market_sort_users: "Users",
  market_search_placeholder: "Search agents…",
  market_search_aria: "Search agents",

  // ── Stat rail ──────────────────────────────────────────────────
  market_rail_listed: "Listed agents",
  market_rail_listed_note: "of {total} with a record",
  market_rail_paper_capital: "Paper capital",
  market_rail_capital_deployed: "Capital deployed",
  market_rail_trades_30d: "Trades · 30d",
  market_rail_positions_open: "Positions open",
  // What a rail sum was counted over — a rail figure is a total across the
  // shelf, and the cards below carry the same words for one agent each.
  market_rail_over_one: "across 1 agent listed",
  market_rail_over_many: "across {count} agents listed",

  // ── Empty and no-match ─────────────────────────────────────────
  market_empty_title: "Nothing here yet",
  market_empty_body:
    "Every strategy with a live record appears here — published, and still on paper. Nothing has started one yet.",
  market_empty_action: "Build an agent",
  market_nomatch_title: "Nothing matches",
  market_nomatch_one: "1 agent in total. Clear the filter to see it.",
  market_nomatch_many: "{count} agents in total. Clear the filter to see them.",
  market_show_all: "Show all",

  // ── Cards ──────────────────────────────────────────────────────
  market_badge_hot: "Hot",
  market_badge_new: "New",
  market_badge_yours: "Yours",
  market_badge_listed: "Listed",
  market_badge_delisted: "Delisted",
  market_badge_paper: "Paper",
  market_card_class_days: "{class} · {days} days",
  market_card_no_curve: "Not enough cycles yet",
  market_metric_return_30d: "Return 30d",
  market_metric_capital: "Capital",
  market_metric_trades_30d: "Trades 30d",
  market_metric_open_now: "Open now",
  market_metric_volume_30d: "Volume · 30d",
  market_rail_volume_30d: "Volume · 30d",
  market_non_custodial: "non-custodial",

  // ── Pagination ─────────────────────────────────────────────────
  market_showing: "Showing {from}–{to} of {total}",
  market_previous: "← Previous",
  market_next: "Next →",
  // ── Page header ────────────────────────────────────────────────
  market_title: "Explore",
  market_sub: "Every agent with a live record. Listed ones can be deployed.",
} as const;
