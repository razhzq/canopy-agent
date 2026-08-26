// The book — what an agent owns now, and every fill behind it.

export const enPositions = {
  positions_tab_open: "Open",
  positions_tab_open_count: "Open · {count}",
  positions_tab_history: "History",

  positions_empty:
    "Nothing open. The agent is in cash until its entry rule is met.",

  // ── Open table ─────────────────────────────────────────────────
  positions_col_asset: "Asset",
  positions_col_qty: "Qty",
  positions_col_cost: "Cost",
  positions_at_price: "@ {price}",
  positions_col_value: "Value",
  positions_col_pnl: "P&L",
  positions_since: "since {date}",
  positions_entries_since: "{count} entries · since {date}",
  // Never "$0.00" — a position we could not price is unknown, not flat.
  positions_not_priced: "not priced",
  positions_close_aria: "Close the {symbol} position",
  positions_close_title: "Close this position",
  positions_entries: "Entries",

  // ── History ────────────────────────────────────────────────────
  positions_history_empty:
    "Nothing filled yet. Every cycle is still recorded in the activity log below.",
  positions_col_side: "Side",
  positions_col_realised: "Realised",
  positions_side_buy: "Buy",
  positions_side_sell: "Sell",
  positions_badge_paper: "Paper",
  positions_fill_cycle: "{date} · cycle {cycle}",
  positions_load_more: "Load more",
  positions_loading: "Loading…",
  positions_sign_in_more: "Sign in to load more.",
  positions_count_one_partial: "1 trade so far",
  positions_count_many_partial: "{count} trades so far",
  positions_count_one_all: "1 trade — all of it",
  positions_count_many_all: "{count} trades — all of them",
} as const;
