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
  // SHORT, AND NO LONGER WRONG.
  //
  // This used to run four lines and end on "everything must come from one
  // category" — a restriction that stopped being true when MultiSme shipped and
  // the tick started running a specialist per class. It was telling people they
  // could not do something the product does. The trading-hours paragraph went
  // with it: true, and not a fact anybody needs while deciding what to pick.
  mk_intro:
    "Pick one or several. The agent checks each one against your rules every cycle and buys whichever qualify.",
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
  am_hints: "↑↓ navigate · ← → page · ⏎ pick · esc close",

  // ── Discovery: filters that choose the markets ─────────────────
  //
  // A second way to answer step 1. The table above says WHICH markets; this
  // says WHAT KIND, and the agent re-runs it every cycle.
  //
  // Metric names are deliberately literal about what is measured. "Market cap"
  // is circulating, not fully diluted, because DexScreener serves both and
  // labelling one as the other is the kind of quiet inaccuracy somebody sizes a
  // position on. "Pair age" is the pool's age, not the token's.
  dsc_title: "Or let it find its own",
  dsc_intro:
    "Describe the kind of token instead of naming one. The agent re-runs these filters every cycle and buys what fits. Markets you picked by hand are traded too.",
  dsc_remove: "Remove screen",

  dsc_group_size: "Size and depth",
  dsc_group_activity: "Activity",
  dsc_group_age: "Age",
  dsc_group_quality: "Leave out",
  dsc_group_safety: "Rug checks",

  dsc_marketCapUsd: "Market cap",
  dsc_marketCapUsd_note: "Based on circulating supply.",
  dsc_fdvUsd: "Fully diluted value",
  dsc_liquidityUsd: "Pool depth",
  dsc_liquidityUsd_note: "How much is sitting in the pool to trade against.",
  dsc_volume24hUsd: "24h volume",
  dsc_volume24hUsd_note: "From the token's biggest pool.",
  dsc_volume1hUsd: "1h volume",
  dsc_volumeToLiquidity: "Volume against depth",
  dsc_volumeToLiquidity_note: "$200k is thin in a $2M pool and frantic in a $50k one.",
  dsc_pairAgeHours: "Pair age",
  dsc_pairAgeHours_note: "How long this token has been trading.",
  dsc_change5mPct: "5m move",
  dsc_change1hPct: "1h move",
  dsc_change6hPct: "6h move",
  dsc_change24hPct: "24h move",
  dsc_txns24h: "24h trades",
  dsc_buySellRatio24h: "Buys per sell",
  dsc_buySellRatio24h_note: "Above 1 means more buys than sells.",

  dsc_min: "At least",
  dsc_max: "At most",
  dsc_any: "Any",
  dsc_unit_hours: "hours",
  dsc_unit_days: "days",

  dsc_tier: "How checked it is",
  dsc_tier_verified: "Verified",
  dsc_tier_verified_note: "Jupiter confirmed it's the real token, not a copycat.",
  dsc_tier_listed: "Listed",
  dsc_tier_listed_note: "Has a CoinGecko listing.",
  dsc_tier_pool: "Anything tradable",
  dsc_tier_pool_note: "Nobody has checked it.",
  // Sits beside the tier control, not under a hazard heading. The consequence
  // is specific and worth reading; a warning tone would make it noise.
  dsc_tier_live_note:
    "With real money your agent only buys at this level or above. Most new or small tokens sit below Verified.",

  dsc_exclude_stablecoins: "Stablecoins",
  dsc_exclude_solDerivatives: "Tokens that just track SOL",
  dsc_exclude_rwaImpersonators: "Copycats of real stocks",
  dsc_exclude_withoutPool: "Tokens with no price history",
  dsc_exclude_withoutPool_note:
    "Your rules in the next step read past prices. Without any, nothing can trigger.",
  dsc_exclude_note: "These are left out unless you untick them.",

  dsc_safety_note: "Only run on tokens that already match everything above.",
  dsc_safety_mint: "Nobody can create more of it",
  dsc_safety_freeze: "Nobody can freeze your tokens",
  dsc_safety_lp: "The liquidity cannot be pulled",
  dsc_safety_holder: "Biggest holder owns no more than",

  dsc_cap: "Look at up to",
  dsc_cap_unit: "tokens each cycle",
  dsc_cap_note:
    "Your agent reads recent prices for each one every cycle, so this is a real cost. The next step decides how many it actually buys.",

  dsc_matching: "Checking…",
  dsc_match_one: "1 token matches right now",
  dsc_match_many: "{count} tokens match right now",
  dsc_match_none: "Nothing matches right now",
  dsc_match_of: "of {swept} tokens",
  dsc_match_failed: "Could not check this screen — {message}",
  // Said plainly rather than folded into the count: the preview cannot run rug
  // checks (one network call per token), so the agent will hold fewer.
  dsc_safety_pending:
    "Rug checks only run when the agent does, so it will buy from fewer than this.",
  dsc_sample_show: "Show what matched",
  dsc_sample_hide: "Hide",
  dsc_near_misses: "Just missed",
  dsc_stale_note: "Token data refreshes hourly. Your agent re-checks every cycle.",

  dsc_needs_ranking:
    "This can match hundreds of tokens. The next step decides which few your agent actually buys.",

  // ── Pagination ─────────────────────────────────────────────────
  //
  // The list outgrew the page when the universe's liquidity floor came off:
  // "All" went from a few hundred rows to thousands, which buried the discovery
  // section sitting under the table.
  mk_page_range: "{from}–{to} of {total}",
  mk_page_prev: "← Prev",
  mk_page_next: "Next →",
  mk_hint_page: "← → page",

  // ── The two halves of step 1 ───────────────────────────────────
  //
  // A VIEW SWITCH, NOT A MODE SWITCH, and the labels have to carry that: both
  // can hold something at once, and a strategy may pin markets AND screen for
  // more. "Pick markets" rather than "Assets" because the verb is what
  // distinguishes it from the other tab, where the agent does the picking.
  mk_tab_pick: "Pick markets",
  mk_tab_discovery: "Discovery",
} as const;
