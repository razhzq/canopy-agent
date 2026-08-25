// The public landing page at `/`.
//
// This is marketing copy, and it is translated as marketing copy rather than
// word for word: the Chinese keeps each claim exactly as strong and exactly as
// hedged as the English — "illustrative wireframe data" stays illustrative —
// but says it the way it would be written in Chinese, not the way it would be
// mechanically converted from English.

export const enLanding = {
  page_title_landing: "Canopy — agents that trade your strategy",
  page_desc_landing:
    "Deploy a strategy as your own agent. You keep custody. You set every limit.",

  // ── Nav / footer ───────────────────────────────────────────────
  ld_nav_marketplace: "Marketplace",
  ld_nav_build: "Build",
  ld_nav_record: "Track record",
  ld_nav_pricing: "Pricing",
  ld_nav_venues: "Venues",
  ld_nav_models: "Models",
  ld_nav_cta: "Launch app",

  // ── Hero ───────────────────────────────────────────────────────
  ld_hero_eyebrow: "Tokenized markets · open 24/7",
  ld_hero_h1_a: "A market of trading agents that ",
  ld_hero_h1_mint: "never sleep.",
  ld_hero_lede:
    "Build an agent on tokenized stocks, gold and hundreds of Solana tokens in two minutes. It trades the 24/7 market for you — no closing bell, non-custodial, best price on every trade.",
  ld_hero_cta: "Build your first agent",
  ld_hero_browse: "Browse the marketplace",
  ld_trust_noncustodial: "Non-custodial",
  ld_trust_paper: "Paper test free & unlimited",
  ld_trust_routing: "Routed for best price",

  ld_win_tab: "canopy / marketplace · live",
  ld_demo_agent: "AAPLx Dip Catcher",
  ld_demo_sub: "AAPLx/USDC · routed via Jupiter · 94 days live",
  ld_demo_hot: "Hot",
  ld_metric_return_30d: "Return · 30d",
  ld_metric_win_rate: "Win rate",
  ld_metric_capital: "Capital",
  ld_watching_now: "Watching now",
  ld_live: "Live",
  ld_watch_cond_a: "AAPLx drops ",
  ld_watch_cond_mint: "4%+",
  ld_watch_cond_b: " in a session",
  ld_scale_zero: "0%",
  ld_scale_now: "−{pct}% now",
  ld_scale_fires: "−4.0% fires",
  ld_checked: "checked {ago}s ago · next check in {next}s",

  // ── Statement + stats ──────────────────────────────────────────
  ld_stmt_eyebrow: "The backbone of a 24/7 market",
  ld_stmt_title_a: "One marketplace. ",
  ld_stmt_title_mint: "Always open.",
  ld_stat_live_agents: "Live agents",
  ld_stat_capital: "Capital deployed",
  ld_stat_trades: "Trades · 30d",
  ld_stat_positions: "Positions open",

  // ── Bento ──────────────────────────────────────────────────────
  ld_why_eyebrow: "What you're actually getting",
  ld_why_title_a: "You write the rule. It does ",
  ld_why_title_mint: "the waiting.",
  ld_bento_telemetry_k: "Live telemetry",
  ld_bento_telemetry_h:
    "It watches the market tick by tick — and only acts when your rule fires.",
  ld_bento_telemetry_p:
    "Median 3.2s between checks, 24/7. Every check is recorded, whether it trades or not.",
  ld_bento_telemetry_cond: "AAPLx drops 4%+ in a session",
  ld_bento_alwayson_k: "Always on",
  ld_bento_alwayson_h: "Real markets, no closing bell.",
  ld_bento_alwayson_p:
    "Tokenized equities, an index, gold — and the Solana spot market. All trading around the clock, on-chain.",
  ld_bento_keys_k: "Your keys",
  ld_bento_keys_h: "Non-custodial.",
  ld_bento_keys_p: "Canopy never holds your funds.",
  ld_bento_proof_k: "The proof only",
  ld_bento_proof_h: "Public record, private strategy.",
  ld_bento_proof_p: "Performance is public. The recipe is not.",
  ld_bento_exec_k: "Best execution",
  ld_bento_exec_h: "Best price on every trade.",
  ld_bento_exec_p:
    "Auto routes across every live venue and picks up new ones as they integrate — checked per trade.",
  ld_bento_exec_fee: "low venue fee",

  // ── Models ─────────────────────────────────────────────────────
  // The model an agent reasons with: the Canopy-hosted default, or any model
  // bought through the Pod marketplace. Model names (cQWEN3, DeepSeek-V3, …) are
  // product identifiers and stay as they are in every language.
  ld_models_eyebrow: "The mind behind the agent · new",
  ld_models_title_a: "Choose the model your agent ",
  ld_models_title_mint: "thinks with.",
  ld_models_sub:
    "Every agent reasons with a large language model — screening the universe, weighing candidates, writing its own rationale. Run the one Canopy hosts for free, or bring any model from an open marketplace and pay per agent, with a price ceiling you set.",
  ld_models_canopy_sub: "Canopy-hosted Qwen3-14B",
  ld_models_canopy_tag: "Included",
  ld_models_canopy_body:
    "The default every agent has always run. Canopy hosts the weights and absorbs the cost — nothing to fund, nothing to meter. Your prompts never leave Canopy's own inference.",
  ld_models_canopy_1: "Free on every agent, paper or live",
  ld_models_canopy_2: "Runs on Canopy's own inference — private prompts",
  ld_models_canopy_3: "Tuned for the five-seat council loop",
  ld_models_canopy_price: "$0 — included, no balance to keep topped up",
  ld_models_byo_h: "Bring your own model",
  ld_models_byo_sub: "500+ models via the Pod marketplace",
  ld_models_byo_tag: "Marketplace",
  ld_models_byo_body:
    "Pin your agent to any frontier or open model. Each call routes to the cheapest provider willing to serve it, paid in USDC by that agent — never more than the per-million ceiling you agree up front.",
  ld_models_byo_more: "+500 more",
  ld_models_byo_1: "You set a max price per million tokens — a rise is refused, not absorbed",
  ld_models_byo_2: "Funded per agent in USDC, topped up on its own page",
  ld_models_byo_price: "Estimated cost shown per day at your chosen cadence — nothing charged until it's live",

  // ── Build stepper ──────────────────────────────────────────────
  ld_build_eyebrow: "The build",
  ld_build_title_a: "Four screens. Then it ",
  ld_build_title_mint: "runs itself.",
  ld_build_sub:
    "No code, no back-testing homework. Pick a market, decide how it routes, prove it on live data for free, and hit go. Most people are paper-testing inside a minute.",
  ld_draft: "draft · autosaved",
  ld_step1_h: "Assign",
  ld_step1_p:
    "Pick one market or several. Fourteen tokenized stocks and commodities, or hundreds of Solana tokens — all open 24/7.",
  ld_step2_h: "Route",
  ld_step2_p: "Let Auto shop every venue per trade, or pin it to one DEX and leave it there.",
  ld_step2_tag: "Auto",
  ld_step3_h: "Paper test",
  ld_step3_p: "Your exact rules against live venue prices. No money down, no clock, no limit.",
  ld_step3_tag_a: "Free",
  ld_step3_tag_b: "unlimited",
  ld_step4_h: "Go live",
  ld_step4_p:
    "Everything's still editable. Confirm, and it trades while you get on with your day.",
  ld_step4_tag: "$10 first month",

  // ── Thesis ─────────────────────────────────────────────────────
  ld_thesis_eyebrow: "The proof, not the recipe",
  ld_thesis_q_a: "Performance is ",
  ld_thesis_q_public: "public.",
  ld_thesis_q_b: "The strategy stays ",
  ld_thesis_q_yours: "yours.",
  ld_thesis_sub:
    "Every agent publishes a live track record — return, win rate, drawdown, uptime. Entry logic and limits never leave the owner. Nothing to copy, and nothing of yours to be copied.",
  ld_thesis_cta: "See the leaderboard",
  ld_record_public_info: "Public information",
  ld_record_live_94d: "Live · 94d",
  ld_record_max_dd: "Max drawdown",
  ld_record_uptime: "Uptime",
  ld_locked_t: "Strategy rules & limits — private",
  ld_locked_s: "Entry logic, sizing and stops stay with the owner.",

  // ── Assets ─────────────────────────────────────────────────────
  ld_assets_eyebrow: "What you can trade",
  ld_assets_title_a: "Wall Street's assets, ",
  ld_assets_title_mint: "on crypto's clock.",
  ld_assets_sub:
    "Apple, gold and the S&P, tokenized on-chain — beside the Solana tokens they trade alongside. Your agent doesn't wait for New York to ring the bell.",
  ld_cls_equities: "Equities",
  ld_cls_equities_h: "Single stocks",
  ld_cls_indices: "Indices",
  ld_cls_indices_h: "The whole tape",
  ld_cls_commodities: "Commodities",
  ld_cls_commodities_h: "Hard assets",
  ld_cls_commodities_p: "tokenized gold",
  ld_cls_majors: "Majors",
  ld_cls_majors_h: "Blue-chip crypto",
  ld_cls_tail: "Long tail",
  ld_cls_tail_h: "The rest of Solana",
  ld_cls_tail_p: "and hundreds more",

  // ── Marketplace ────────────────────────────────────────────────
  ld_mkt_eyebrow: "The marketplace · 146 listed agents",
  ld_mkt_title_a: "Track records, ranked. ",
  ld_mkt_title_mint: "Nothing else.",
  ld_mkt_sub:
    "Browse live agents by return, capital and age. Everything you see is performance — never a strategy.",
  // The sample agents' badges. Their names are translated in
  // components/canopyLanding/data.ts, beside the rows they belong to.
  ld_flag_hot: "Hot",
  ld_flag_new: "New",
  ld_flag_paper: "Paper",
  ld_agent_market: "{pair} · {days}d",
  ld_col_return_30d: "Return 30d",
  ld_col_capital: "Capital",
  ld_col_trades: "Trades",

  // ── App / anywhere ─────────────────────────────────────────────
  // The iPhone section. The word "mobile" is deliberately absent — the
  // device in the image carries that meaning, and "Anywhere" says the rest.
  ld_app_eyebrow: "iOS · TestFlight",
  ld_app_title_a: "Everything Canopy. ",
  ld_app_title_mint: "Anywhere.",
  ld_app_sub: "Your agents, your positions and the 24/7 market — in a native app for iPhone.",
  ld_app_1_h: "Trade instantly",
  ld_app_1_p: "Buy and sell tokenized markets right from the app.",
  ld_app_2_h: "Every agent, live",
  ld_app_2_p: "Track records and activity update the moment they change.",
  ld_app_3_h: "Approve in a tap",
  ld_app_3_p: "Confirm or pause an agent the instant it proposes a trade.",

  // ── Routing ────────────────────────────────────────────────────
  ld_route_eyebrow: "Routing & custody",
  ld_route_title_a: "Every order shops ",
  ld_route_title_mint: "the whole market.",
  ld_route_sub:
    "Auto compares live venues on every single trade and takes the best fill — adding new ones as they come online. Your keys, your funds; Canopy never touches them.",
  ld_venue_auto: "Auto routing",
  ld_venue_auto_k: "Recommended · checked per trade",
  ld_venue_default: "DEFAULT",
  ld_venue_aggregator: "Aggregator",
  ld_venue_native: "Native venue",
  ld_venue_rwa_dex: "RWA DEX",
  ld_venue_clob_dex: "CLOB DEX",
  ld_venue_spot_perps: "Spot & perps",
  ld_venue_depth: "{amount} depth",
  ld_venue_integrating: "integrating",
  ld_venue_live: "● LIVE",
  ld_venue_soon: "SOON",

  // ── Pricing ────────────────────────────────────────────────────
  ld_pricing_eyebrow: "Pricing",
  ld_pricing_title_a: "Test for free. ",
  ld_pricing_title_mint: "Pay only when it's live.",
  ld_pricing_sub: "Paper agents are always free. You're billed per live agent — nothing more.",
  ld_plan_paper: "Paper",
  ld_plan_paper_note: "Unlimited, forever.",
  ld_plan_paper_1: "One free agent slot to start",
  ld_plan_paper_2: "Full paper testing on live venue data",
  ld_plan_paper_3: "No capital at risk, no time limit",
  ld_plan_paper_4: "Publish a paper track record",
  ld_plan_paper_cta: "Start building",
  ld_plan_live: "Live",
  ld_plan_live_amt: "$20",
  ld_plan_live_per: " /mo per agent",
  ld_plan_live_note: "$10 for the first month.",
  ld_plan_live_1: "Room for up to 5 agents — the unlock is permanent",
  ld_plan_live_2: "Non-custodial execution, 24/7",
  ld_plan_live_3: "Best-price routing across every live venue",
  ld_plan_live_4: "Append-only activity log — every check recorded",
  ld_plan_live_cta: "Take an agent live",

  // ── Final CTA + footer ─────────────────────────────────────────
  ld_final_h: "The market's already open.",
  ld_final_p:
    "Most agents are paper-testing in under a minute. Build yours, prove it, and let it trade while you sleep.",
  ld_foot_fine:
    "Canopy is non-custodial trading infrastructure for tokenized real-world assets and Solana spot markets. Agents execute against live venues routed for best price; strategy performance shown is illustrative wireframe data. Trading tokenized assets involves risk — paper test before you go live.",
} as const;
