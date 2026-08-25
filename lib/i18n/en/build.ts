// Creating an agent: the naming step, the two builder steps, the review, and
// the wizard chrome shared with the deploy flow.

export const enBuild = {
  // ── Wizard chrome ──────────────────────────────────────────────
  wiz_proceed: "Proceed",
  wiz_step_of: "Step {step} of {total}",
  wiz_mandate: "Mandate",
  wiz_draft: "Draft",
  wiz_reads_as: "Reads as",

  // ── Naming (desktop modal) ─────────────────────────────────────
  name_eyebrow: "New agent",
  name_title: "Name your agent",
  name_body:
    "This travels with the record. Anyone comparing your strategy sees it, so make it something you would put your name next to.",
  name_placeholder: "e.g. steady gold accumulation",
  name_aria: "Agent name",
  name_required: "Give it a name to continue.",
  name_too_long: "{length} characters — the limit is {max}.",
  name_rename_later: "You can rename it any time before publishing.",
  name_continue: "Continue",

  // ── Naming (mobile) ────────────────────────────────────────────
  name_m_title: "Create agent",
  name_m_hint:
    "You can rename it later. Everything else is set in the next two steps.",
  name_m_body:
    "Asked first because it is the one field that outlives the draft — it travels with the published record and with every deployment of it.",
  name_m_suggestions: "Or start from one of these",

  // ── Mobile frame ───────────────────────────────────────────────
  build_back_aria: "Back",
  build_working: "Working…",
  build_rename_aria: "Rename",

  // ── Builder steps ──────────────────────────────────────────────
  build_step_market: "Market",
  build_step_limits: "Limits",
  build_step_model: "Model",
  build_title: "Create agent",
  build_new_draft: "New agent · Draft ·",
  build_name_aria: "Agent name",
  build_untitled: "untitled agent",
  build_steps_aria: "Builder steps",
  build_so_far: "Your agent so far",
  build_trail_market: "Market",
  build_trail_this_step: "this step",
  build_trail_next: "next",
  build_trail_markets: "{count} markets",
  build_trail_strategy: "Strategy & budget",
  build_trail_rule_one: "1 rule",
  build_trail_rule_many: "{count} rules",
  build_trail_rule_one_here: "1 rule · this step",
  build_trail_rule_many_here: "{count} rules · this step",
  build_trail_paper: "Paper run",
  build_trail_paper_value: "free, no time limit",
  build_trail_publish: "Publish",
  build_trail_publish_value: "whenever you like",
  build_row_position_cap: "Position cap",
  build_row_per_cycle: "Per cycle",
  build_row_trades: "{count} trades",
  build_row_exits: "Exits",
  build_row_exits_value: "+{tp}% / −{sl}%",
  build_row_paper_book: "Paper book",
  build_row_routes_via: "Routes via",
  build_row_reasons_with: "Reasons with",

  // ── Proceed panel ──────────────────────────────────────────────
  build_check_plan: "Check the accumulation plan",
  build_draft_saved:
    "The strategy is saved as a draft. Starting the paper run freezes it, so this is the last point you can change these.",
  build_start_anyway: "Start anyway",
  build_go_back_edit: "Go back and edit",
  build_continue_limits: "Continue to limits",
  build_pick_market_first: "Pick a market first",
  build_sign_in_to_start: "Sign in to start",
  build_starting: "Starting…",
  build_run_paper: "Run paper test",
  build_turn_on_rule: "Turn on at least one rule",
  build_back_to: "Back to {step}",
  build_paper_note:
    "Paper runs are free and have no time limit. Nothing is funded, and you publish whenever the record convinces you.",
  build_pick_market_error: "pick a market first",

  // ── Mobile CTAs ────────────────────────────────────────────────
  build_cta_limits: "Set the limits",
  build_cta_limits_hint: "An agent may only ever trade what you pick here.",
  build_cta_model: "Choose the model",
  build_cta_model_hint:
    "Every chip above is a rule the specialist actually evaluates.",
  build_cta_review: "Review",
  build_cta_review_hint:
    "Every chip above is a rule the specialist actually evaluates. Nothing is created until the next screen.",

  // ── Review ─────────────────────────────────────────────────────
  review_title: "Review",
  review_body:
    "This is the mandate it runs under. It cannot widen any of it — only you can.",
  review_start_anyway: "Start anyway",
  review_create: "Create and start on paper",
  review_warnings: "Worth reading first",
  review_note:
    "It starts on paper against live prices — real data, no money. Promote it when its record convinces you.",
  review_row_markets: "Markets",
  review_row_rules: "Rules",
  review_row_rules_value: "{count} active",
  review_row_measured_on: "Measured on",
  review_row_cycle: "Cycle",
  review_cadence_default: "1 hour (default)",
  review_cadence_seconds: "{n}s",
  review_row_max_position: "Max per position",
  review_row_trades_per_cycle: "Trades per cycle",
  review_row_take_profit: "Take profit",
  review_row_stop_loss: "Stop loss",
  review_row_compliance: "Compliance",
  review_compliance_shariah: "Shariah",
  review_compliance_none: "None",
  review_row_routing: "Routing",
  review_row_model: "Model",
  review_row_model_budget: "Model budget",
  review_row_model_budget_value: "{amount} to fund after creating",

  // ── Build lifecycle bar ────────────────────────────────────────
  stage_draft: "Draft · configure",
  stage_paper: "Paper run",
  stage_published: "Published",

  // ── Deploy wizard steps ────────────────────────────────────────
  deploy_step_describe: "Describe",
  deploy_step_constraints: "Constraints",
  deploy_step_autonomy: "Autonomy",
  deploy_step_wallet: "Wallet",
  deploy_step_fund: "Fund",

  // ── Venue description ──────────────────────────────────────────
  // The venue names themselves are brands and stay as they are.
  venues_best_of: "Best of {venues}",
} as const;
