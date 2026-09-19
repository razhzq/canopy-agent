// The desktop agent page (wireframe 1k) — the owner's view of one agent: its
// performance, its book, what it is watching for, its strategy rail, and the
// two destructive controls at the bottom.

export const enAgentDetail = {
  ad_signed_out_note: "Sign in to see this agent.",
  ad_sign_in_to_change: "Sign in to change this agent.",
  ad_back: "← My agents",

  // ── Book switch ────────────────────────────────────────────────
  ad_book_aria: "Paper or live book",
  ad_book_paper: "Paper",
  ad_book_live: "Live",
  ad_live_closed: "Real-money trading isn't open yet",
  ad_no_paper_run: "This agent has no paper run",
  ad_promote_hint: "Set this agent up to trade real capital",
  ad_settled_paper_note: "The settled paper run. This agent trades live now.",
  // The hovered reason is a clause; the full stop belongs to the sentence, and
  // Chinese ends one with a different mark.
  ad_hover_reason: "{reason}.",
  ad_stopped_itself: "Stopped itself: {reason}.",

  // ── Status chip ────────────────────────────────────────────────
  ad_status_running: "Running",
  ad_status_closing: "Closing out",

  // ── Section rules ──────────────────────────────────────────────
  ad_sec_performance: "Performance",
  ad_sec_positions: "Positions",
  ad_sec_grid: "Grid",
  ad_grid_range: "Range",
  ad_grid_levels: "Levels",
  ad_grid_per_level: "Per level",
  ad_grid_wap: "Average entry",
  ad_grid_mark: "Mark",
  ad_grid_held: "held · sells at ${price}",
  ad_grid_waiting: "buys at ${price}",
  ad_grid_top: "top of the range",
  ad_grid_auto_pending: "The range is read from the recent high and low on the first cycle; it has not run yet.",
  ad_grid_note: "Each level buys when price reaches it and sells one level up. The whole ladder closes {stop}% below the range{tp}.",
  ad_grid_note_tp: ", or once the lots held are up {tp}% on their average entry",
  ad_grid_levels_held: "{held} of {levels} levels held",
  ad_sec_activity: "Activity",
  // A LABEL, NOT A SENTENCE. This read "Strategy · applies to every market",
  // which made one heading a different shape from every sibling on the page
  // ("Performance", "Positions", "Watching now"). The qualifier it was carrying
  // is a fact about the recipe, so it moved under the heading as body copy —
  // where it also gives the markets section below it an antecedent.
  ad_sec_strategy: "Strategy",
  ad_strategy_applies: "One recipe, applied to every market below.",
  ad_sec_markets: "Markets",
  // "Agent-level" was our word for it, not the reader's.
  ad_sec_setup: "How it runs",

  // ── Watching now ───────────────────────────────────────────────
  ad_checked: "checked {when}",
  ad_starting: "starting",
  ad_next: " · next {when}",
  ad_not_ticking: "not ticking",
  ad_model_unfunded:
    "Waiting for its model balance. {model} is prepaid — fund it and this agent starts on its own, no restart needed.",
  ad_model_generic: "The model",
  // The headline sentence. `who` is a ticker or the generic subject below.

  ad_chip_sell_signal: "Sell signal:",

  // ── Activity ───────────────────────────────────────────────────
  ad_all_cycles: "All cycles →",
  ad_append_only:
    "Append-only. Every check is recorded, whether it traded or not.",
  ad_append_only_skipped:
    "Append-only. Every check is recorded, whether it traded or not — the last cycle did not trade: {reason}.",

  // ── Strategy rail ──────────────────────────────────────────────
  ad_first_wait: "First, wait for",
  ad_then_bars:
    "Then the rules below apply, on a later bar, for up to {bars} bars. Nothing is bought on the bar the setup appears.",
  ad_then_bars_invalidate:
    " The wait is cancelled if the setup breaks down first.",
  ad_then_buy: "Then buy when",
  ad_no_rules: "No rules returned.",
  ad_chip_take_profit: "Take profit:",
  ad_chip_stop_loss: "Stop-loss:",
  ad_chip_chart: "Chart:",
  // The bands inside the strategy card. Entry, exit and the bar size were one
  // undifferentiated pile of chips before.
  ad_group_entry: "Buys when",
  ad_group_exit: "Sells when",
  ad_group_measured: "Measured on",
  ad_group_screen: "Picks markets that are",
  ad_accumulation: "Accumulation",
  ad_accumulation_warning:
    "Take profit and stop-loss measure the blend of every entry, not each one separately.",
  ad_edit_strategy: "Edit strategy",

  // ── Edit strategy dialog ───────────────────────────────────────
  es_title: "Edit strategy",
  es_name: "Name",
  // Said plainly because the two names diverge for a deployer, and the dialog
  // is the only place anyone learns that they do.
  es_name_help:
    "What you call this agent. Yours alone — renaming it here never renames the strategy for anyone else who deployed it. If the strategy is your own, its name follows.",
  es_intro:
    "These are the rules this agent is running right now. Changes apply in place — same agent, same positions, same record — from its next cycle.",
  es_entry: "Entry rules",
  es_exits: "Exits",
  es_accumulation: "Accumulation",
  es_timeframe: "Chart timeframe",
  es_budget: "Budget",
  es_budget_help:
    "How much one buy may be, as a share of what the agent has to trade with, and how many buys one cycle may make. A live agent measures the share against the USDC in its wallet each cycle; a paper agent against its paper book.",
  es_position_limit: "Per position",
  es_position_of_wallet: "About {usd} right now, of the {base} USDC in its wallet plus open positions",
  es_position_of_wallet_unknown: "Of what it holds, USDC plus open positions, read each cycle",
  es_position_of_book: "About {usd} right now, of its {base} equity",
  es_position_of_book_unknown: "Of its current equity, read each cycle",
  es_trades_per_cycle: "Trades per cycle",
  es_trades_help: "Entries per wake-up. The agent never splits an order to get around it.",
  es_unit_trade: "trade",
  es_unit_trades: "trades",
  es_fewer: "Fewer trades per cycle",
  es_more: "More trades per cycle",
  es_entry_help:
    "Every rule switched on must hold before the agent buys. A rule switched off is not evaluated at all — it is not a loosened condition, it is no condition.",
  es_exits_help:
    "How a position closes. Take profit and stop-loss are measured from the entry price; a trailing stop measures from the highest price since. Any of them set to zero is off, and the portfolio drawdown breaker still applies either way.",
  es_accumulation_help:
    "Whether the agent adds to a position it already holds. Setting a plan changes what the exits above measure: they stop describing one entry and start describing the blend of every entry.",
  es_timeframe_note:
    "The bar size the rules above are measured on. Percent thresholds move with it, so a rule keeps meaning what it meant rather than becoming one nothing can reach.",
  es_cadence_note:
    "How often the agent wakes is a separate setting, fixed when it was deployed. Changing the bar size here does not change it.",
  es_exits_unset:
    "This strategy has no exits of its own and is running its risk posture's defaults. Saving writes the values shown here.",
  es_passthrough:
    "{count} rule(s) this editor cannot show are kept exactly as they are.",
  es_no_entry:
    "A strategy with no entry condition buys the first thing it screens. Switch at least one rule on.",
  es_takes_effect: "Applies from the next cycle.",
  es_no_changes: "Nothing changed yet.",
  es_save: "Save changes",
  es_saving: "Saving…",
  es_cancel: "Cancel",
  es_sign_in: "Sign in to change this agent.",

  // ── Edit strategy · Copy LP ────────────────────────────────────
  // A copy agent has no rules, exits or timeframe. Its own dialog, in its own
  // words — see components/editCopyLp.tsx.
  ec_title: "Edit copy",
  ec_intro:
    "Who this agent copies, and how much of them it takes. Changes apply from the next poll; nothing already open is touched.",
  ec_leader_change: "You are changing the leader",
  ec_leader_change_open:
    "From the next poll this agent mirrors the new wallet instead. Positions it already opened from {from} stay open and stop being tracked as copies — close them yourself if you do not want them.",
  ec_leader_change_flat:
    "From the next poll this agent mirrors the new wallet instead of {from}. It holds nothing right now, so there is nothing to unwind.",
  ec_leader_change_ack: "I understand",
  ad_anyof_or: "or",

  // ── Universe ───────────────────────────────────────────────────
  // The four-way heading these came from is gone: one heading, and the
  // pinned-vs-screened distinction it was groping at is said here, in body copy
  // where a distinction belongs.
  ad_markets_screened: "Found by the screen each cycle, not pinned.",
  ad_markets_pinned: "Only these. It adds nothing on its own.",
  ad_no_universe:
    "No universe is pinned, so the agent screens the whole {class} class each cycle.",
  ad_add_market: "+ Add market",
  ad_not_priced: "not priced",
  ad_remove: "Remove",
  ad_removing: "…",
  ad_remove_aria: "Stop trading {label}",
  ad_remove_title: "Stop trading this market. Anything held stays open.",
  ad_of_target: "/ {target}%",

  // ── Agent-level rail ───────────────────────────────────────────
  ad_row_cadence: "Cadence",
  ad_row_deployed: "Deployed",
  ad_row_autonomy: "Autonomy",
  ad_row_position_cap: "Position cap",
  ad_position_cap_value: "≤ {amount} per market",
  // The same cap before there is a book to measure it against. A percent is
  // the cap the owner actually set; the dollar figure is it resolved.
  ad_position_cap_pct: "≤ {pct}% per market",
  ad_row_model: "Reasons with",
  // The caps, moved out of the prose under "Watching now". They are limits on
  // BUYING, which is what the note under them exists to keep saying.
  ad_row_breaker: "Breaker",
  ad_breaker_value: "−{pct}% from peak",
  ad_row_open_at_once: "Open at once",
  ad_row_daily_loss: "Daily loss limit",
  ad_row_cooldown: "Cooldown",
  ad_cooldown_value: "{losses} losses · {minutes} min",
  ad_caps_note: "Caps stop new entries. Exits always run.",
  // The act, not the enum — this row used to print "execute with caps".
  ad_autonomy_caps: "Trades within your caps",
  ad_autonomy_propose: "Asks before every trade",
  ad_row_compliance: "Compliance",
  ad_cadence_days: "{n}d",
  ad_cadence_hours: "{n}h",
  ad_cadence_minutes: "{n} min",

  // ── Controls ───────────────────────────────────────────────────
  ad_resume_agent: "Resume agent",
  ad_pause_agent: "Pause agent",
  ad_close_all: "Close all positions",
  ad_delete_agent: "Delete agent",
  ad_busy: "…",
  ad_flatten_nothing: "Nothing was open to close.",
  ad_flatten_one: "Closed 1 position. The agent is paused.",
  ad_flatten_many: "Closed {count} positions. The agent is paused.",

  // ── Delete dialog ──────────────────────────────────────────────
  ad_delete_title: "Delete this agent?",
  ad_delete_1_empty: "It holds nothing, so there is nothing to sell.",
  ad_delete_1_one:
    "It closes 1 position at the current pool price — {amount} invested. This is a real sale and the result lands in your record.",
  ad_delete_1_many:
    "It closes {count} positions at the current pool price — {amount} invested. This is a real sale and the result lands in your record.",
  ad_delete_2:
    "It revokes its own wallet authority. That cannot be undone here.",
  ad_delete_3:
    "It disappears from your agents. Pausing is the reversible option.",
  ad_delete_4:
    "{name} comes off Explore with it — this is your last agent on it. Anyone already deployed keeps running; nobody new can deploy.",
  ad_delete_kept:
    "Nothing is erased. Every cycle, decision and trade stays on the record, and the strategy keeps whatever track record this agent earned.",
  ad_delete_unpriced:
    "If a position cannot be priced when you confirm, the agent winds down and stays visible instead of being hidden while it still holds something.",
  ad_delete_confirm_with_positions: "Close positions and delete",
  ad_closing: "Closing…",

  // ── Flatten dialog ─────────────────────────────────────────────
  ad_flatten_title: "Close every position?",
  ad_flatten_1_one:
    "It sells 1 position at the current pool price — {amount} invested. Real sales, and the result lands in your record.",
  ad_flatten_1_many:
    "It sells {count} positions at the current pool price — {amount} invested. Real sales, and the result lands in your record.",
  ad_flatten_2:
    "It then pauses. Otherwise it would start buying again on its next cycle.",
  ad_flatten_3:
    "The agent, its strategy and its whole record stay exactly as they are.",
  ad_flatten_resume: "Resume it whenever you want. Nothing here is one-way.",
  ad_flatten_unpriced:
    "A position that cannot be priced right now is left open rather than sold at a guess. The agent keeps trying and stays visible while it settles.",

  // ── Relative time, forward ─────────────────────────────────────
  ad_due_now: "due now",
  ad_in_minutes: "in {count} min",
  ad_in_hours: "in {count}h",
} as const;
