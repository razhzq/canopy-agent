// Choosing what an agent may trade: step 1 of the builder, and the add-market
// dialog on a running agent's page. They filter the same universe and share
// every label — two lists of the same chips drift.

export const enMarkets = {
  // ── Filters ────────────────────────────────────────────────────
  am_new: "no history",
  am_new_help:
    "Jupiter prices this token and can fill it, but no pool has been resolved for it yet — so the indicator rules cannot be evaluated until the next sweep finds one. It can still be added.",
  mk_class_all: "All",
  mk_class_stocks: "Tokenized stocks",
  mk_class_commodity: "Commodities",
  mk_class_token: "Crypto",
  mk_venue: "Venue",
  mk_venue_all: "All",
  // "CLOB DEX" names the market STRUCTURE, which is what someone reaches this
  // filter for; the venue's own brand is on every row it returns.
  mk_venue_clob: "CLOB DEX",

  // ── Picker ─────────────────────────────────────────────────────
  mk_step: "Step 1 of 2 · Assign",
  mk_title: "Pick what you're trading",
  mk_intro:
    "Pick one or several — the agent screens every market you choose, on the same rules, and buys whichever qualify. Tokenized stocks and commodities keep their underlying's trading hours even though the token trades around the clock; crypto never closes. Everything must come from one category, because a single specialist screens them all, and that choice decides which rules are available in the next step.",
  mk_search_placeholder: "Search markets…  /",
  mk_search_aria: "Search markets",
  mk_count_one: "1 market",
  mk_count_many: "{count} markets",

  mk_resolving: "Resolving tradable markets…",
  mk_signed_out: "Sign in to see which markets are tradable.",
  mk_load_failed: "Could not load markets — {message}",
  mk_none_tradable: "No market currently resolves as tradable.",
  mk_no_query_match: "Nothing matches “{query}”.",
  mk_no_filter_match: "No market matches these filters.",

  mk_col_market: "Market",
  mk_col_price: "Price",
  mk_col_24h: "24h",
  // Not "volume": nothing here measures traded volume.
  mk_col_depth: "Pool depth",

  mk_hint_navigate: "↑↓ navigate",
  mk_hint_toggle: "⏎ add or remove",
  mk_hint_search: "/ search",
  mk_pick_a_market: "Pick a market",
  mk_continue: "Continue",

  // ── Add-market dialog ──────────────────────────────────────────
  am_title: "Add a market",
  am_subtitle: "{agent} · screening {count}",
  am_search_placeholder: "Search markets…",
  am_sign_in: "Sign in to change this agent.",
  am_added: "Added",
  am_add: "Add",
  am_remove: "Remove",
  am_removing: "…",
  am_add_aria: "Add {symbol}",
  am_remove_aria: "Stop trading {symbol}",
  am_remove_title: "Remove this market. Anything already held stays open.",
  am_request: "Request add",
  am_sending: "Sending…",
  // Empty-state sentences, whole per case: the scope and the query land in
  // different places in the two languages.
  am_none_in_scope_query: "Nothing in {scope} matches “{query}”.",
  am_agent_trades_none: "This agent trades no {scope}.",
  am_none_on_venue: "Nothing here fills on {venue}.",
  // The scope clause, assembled from up to two narrowings. Written as its own
  // template because "crypto on Jupiter" puts the venue after the class in
  // English and before it in Chinese.
  am_scope_on_venue: "{scope} on {venue}",
  am_only_market_aria: "{symbol} is the only market this agent trades and cannot be removed",
  am_picked: "Picked",
  am_same_rules: "{market} — same rules and limits as {agent}.",
  am_hints: "↑↓ navigate · ⏎ pick · esc close",
} as const;
