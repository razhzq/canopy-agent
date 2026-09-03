// Step 2 of the builder — writing a strategy in a sentence, reading back the
// rules it compiled to, and setting the budget around them.

export const enLimits = {
  // ── Header ─────────────────────────────────────────────────────
  sl_step: "Step 2 of 2 · Assign",
  sl_title: "Set your limits",
  sl_markets_one: "{symbol}/USDC",
  sl_markets_many: "{count} markets",
  sl_class_crypto: "Crypto",
  sl_class_commodity: "Tokenized commodity",
  sl_class_equity: "Tokenized equity",
  sl_change: "— change",

  // ── Compose ────────────────────────────────────────────────────
  sl_strategy_for: "Strategy · {markets}",
  sl_mode_write: "Write it",
  sl_mode_preset: "Preset",
  sl_reading_it: "Reading it…",
  // The composer is a model and answers in the language it was prompted in, so
  // the sentence a user types decides what comes back. This placeholder is the
  // only nudge, and it is written in the reader's language for that reason.
  sl_compose_placeholder:
    "e.g. buy {symbol} when it is down 4% or more on the day and the pool is deep, take profit at 3%, stop out at 2%",
  sl_compose_placeholder_discovery:
    "e.g. buy when it is down 4% or more on the day and the pool is deep, take profit at 3%, stop out at 2%",
  sl_compose_followup: "Answer, or add anything else it should know…",
  sl_compose_aria: "Describe the rule",
  sl_compiling: "Compiling…",
  sl_send_hint: "⌘⏎ to send",
  sl_compile: "Compile",
  sl_send: "Send",
  sl_sign_in: "Sign in to compile a rule.",
  sl_not_rules: "That could not be turned into rules.",
  sl_measurable:
    "Say it in terms of a condition I can measure — a move on the day, a level, a depth of pool.",
  sl_ready:
    "That is enough to trade on — entry, target, stop and size are all set. Adjust anything below, or carry on to the route.",
  // The composer names the market for itself; this is the frame around it.
  sl_trading_prefix: "Trading {markets}. ",
  sl_unserved_bars_spot:
    "{tf} bars are not served for token pools — the venue cannot build them. Kept at {kept}; {available} are available.",
  sl_unserved_bars_rwa:
    "{tf} bars are not served for this asset class — the venue cannot build them. Kept at {kept}; {available} are available.",

  // ── Rules read-back ────────────────────────────────────────────
  sl_rules_appear:
    "The rules appear here once you compile — every one of them editable before anything runs. Or",
  sl_set_by_hand: "set them by hand",
  sl_read_as: "Read as — edit any rule",
  sl_nothing_runs_one:
    "Nothing runs until you confirm these. Switch a rule off to stop it applying, or rewrite the sentence above and compile again. 1 rule is active.",
  sl_nothing_runs_many:
    "Nothing runs until you confirm these. Switch a rule off to stop it applying, or rewrite the sentence above and compile again. {count} rules are active.",
  sl_window: " Window: {span}.",
  sl_on: "On",
  sl_off: "Off",

  // ── Exits ──────────────────────────────────────────────────────
  sl_take_profit: "Take profit",
  sl_stop_loss: "Stop loss",
  sl_trailing_stop: "Trailing stop",
  sl_breakeven: "Break-even at",
  exit_tp_on: "Closes the position once it is up this much.",
  exit_tp_off: "Off — a winner runs until something else closes it.",
  exit_sl_on: "Closes without asking. A stop you can veto is not a stop.",
  exit_sl_off:
    "Off — nothing closes this on a loss. The drawdown breaker still applies to the book.",
  exit_trail_on:
    "Measured from the highest price since you entered, not from your entry. It only ever moves up.",
  exit_trail_off: "Off — gains are not protected on the way back down.",
  exit_be_on: "Once it has been up this much, it will not be allowed to close at a loss.",
  exit_be_off: "Off — a position that was up can still round-trip into a loss.",
  exit_generic_on: "Closes the position once this is true.",
  exit_generic_off: "Off.",
  sl_slider_aria: "{label} slider",
  sl_value_aria: "{label}, value",
  sl_max_clamp: "Max {value}",
  sl_min_clamp: "Min {value}",

  // ── Scale-out ladder ───────────────────────────────────────────
  sl_steps_title: "Take profit in steps",
  sl_steps_off: "Off — the position closes in one go.",
  sl_steps_on: "Each step sells part of the position once, then the rest keeps running.",
  sl_add_step: "+ Add step",
  sl_sell: "Sell",
  sl_pct_at: "% at",
  sl_pct_gain: "% gain",
  sl_step_size_aria: "Step {n} size in percent",
  sl_step_gain_aria: "Step {n} gain in percent",
  sl_leaves_running: "Leaves {pct}% running, governed by the exits above.",
  sl_sells_everything:
    "These steps sell the whole position. Leave something behind, or use Take profit.",

  // ── Timing ─────────────────────────────────────────────────────
  sl_chart_timeframe: "Chart timeframe",
  sl_not_served: "not served",
  sl_timeframe_help:
    "This changes what your rules mean, not just how often they run. Every rule above relabels, states its window in real time, and moves its threshold with the bar — a trend floor of 3% on daily becomes 0.3% here, because that is the same ask. One exception, and it says so on the chip: change on the day is always 24 hours. Use Min momentum for a change measured on your own bars.",
  sl_cycle: "Cycle",

  // ── Budget ─────────────────────────────────────────────────────
  sl_budget: "Budget for this market",
  sl_position_limit: "Position size limit",
  sl_position_help:
    "Most per trade, per market. Never exceeded. {pct}% of the {book} paper book.",
  sl_trades_per_cycle: "Max trades per cycle",
  sl_unit_trades: "trades",
  sl_trades_help: "Entries per wake-up. The agent never splits an order to get around it.",

  // ── Ranking ────────────────────────────────────────────────────
  sl_how_many: "How many to hold",
  sl_all_of_them: "All of them",
  sl_all_of_them_help: "Buy anything that passes the rules.",
  sl_only_best: "Only the best",
  sl_only_best_help: "Rank what passes, act on the top few.",
  sl_hold_best: "Hold the best",
  sl_of_by: "of {count}, by",
  sl_how_many_aria: "How many to hold",
  sl_rank_by_aria: "Rank by",
  rank_momentum_high: "strongest recent return",
  rank_momentum_low: "weakest recent return",
  rank_rsi_low: "most oversold",
  rank_liquidity_high: "deepest pool",
  rank_vol_low: "calmest",
  sl_ranking_note:
    "Ranking runs after your rules, never instead of them — a market that fails a rule is never ranked back in. Anything left out is named in the cycle log, so a market that never trades is never a mystery.",

  // ── Compliance ─────────────────────────────────────────────────
  sl_compliance: "Compliance screen",
  compliance_none: "None",
  compliance_none_help: "Every asset in the market, screened only by your own rules.",
  compliance_shariah: "Shariah",
  compliance_shariah_help:
    "Excludes conventional finance, leverage over the line, and non-compliant revenue.",
  sl_compliance_note:
    "A screen narrows what the agent may hold. It is applied before the analyst sees anything, so a filtered asset never appears in a cycle.",

  // ── Checklist ──────────────────────────────────────────────────
  sl_ask_reinterpreted:
    "\u201c{phrase}\u201d asks how much something MOVED, and every reading I have measures where it IS. I set the closest one — tell me which you meant and I will set that instead.",
  sl_ask_reint_chip_1: "measure the change over the last 20 bars",
  sl_ask_reint_chip_2: "the level is what I meant, leave it",
  sl_ask_reint_chip_3: "drop that condition",
  sl_ask_unsupported:
    "I could not turn \u201c{phrase}\u201d into anything I measure, so it is not in the strategy. Is there a reading I do have that should stand in its place?",
  sl_ask_unsup_chip_1: "leave it out, the rest is right",
  sl_ask_unsup_chip_2: "what readings do you have that are close?",
  sl_ask_unclear:
    "I could not trace \u201c{phrase}\u201d to anything the agent does. What should it change?",
  sl_clause_honoured: "done",
  sl_clause_adjusted: "adjusted",
  sl_clause_reinterpreted: "read differently",
  sl_clause_unsupported: "not measured",
  sl_clause_unclear: "no effect",
  sl_anyof_title: "Either of these",
  sl_anyof_or: "  ·  or  ·  ",
  sl_setup_title: "First watch for",
  sl_setup_expires:
    "Then the rules above must hold within {bars} bars, or the setup lapses.",
  sl_setup_invalidate: "Cancelled early if: {rules}.",
  sl_composed_remove: "Remove",
  sl_time_limit: "Time limit",
  sl_exit_generic: "That exit",
  // Says what was asked for FIRST. The author is looking for their own number,
  // and a sentence opening with ours reads as the setting they wanted.
  sl_exit_adjusted:
    "{label}: you asked for {asked}%, and {became}% is the closest I can set — so that is what it is now.",
  // Deliberately not worded as a mistake. A rule with no basis in the sentence
  // is usually the engine reaching for the nearest thing it has, which is often
  // right and is always worth seeing.
  sl_rule_unattributed:
    "I set {rule}, and nothing you wrote asks for it directly — check it says what you meant.",

  sl_before_trade: "Before it can trade",
  sl_all_set: "All set",
  sl_still_assumed: "{count} still assumed",
  sl_assumed: "assumed",
  sl_you: "You",
  sl_desk: "Strategy desk",

  req_entry: "Entry condition",
  req_entry_one: "1 rule must be true",
  req_entry_many: "{count} rules must all be true",
  req_entry_none: "nothing would ever trigger a buy",
  req_entry_ask: "What has to be true before it buys?",
  req_entry_chip_1: "when it is down 4% or more on the day",
  req_entry_chip_2: "when RSI is under 30",
  req_entry_chip_3: "only when the pool is deep",

  req_profit: "Take profit",
  req_off: "off",
  req_profit_ask: "Where should it take profit? It is on +{pct}% until you say.",
  req_profit_chip_1: "take profit at 5%",
  req_profit_chip_2: "take profit at 15%",
  req_profit_chip_3: "take profit at 30%",

  req_stop: "Stop loss",
  req_stop_ask: "Where should it stop out? It is on −{pct}% until you say.",
  req_stop_chip_1: "stop out at 3%",
  req_stop_chip_2: "stop out at 8%",
  req_stop_chip_3: "stop out at 15%",

  req_size: "Position size",
  req_size_detail: "{amount} per trade · {count} per cycle",
  req_size_ask: "How much may it put into one trade? It is on {amount} of the {book} paper book.",
  req_size_chip_1: "$500 per trade",
  req_size_chip_2: "$1,000 per trade",
  req_size_chip_3: "$2,500 per trade",

  // ── Presets ────────────────────────────────────────────────────
  // The prompts are sent to the composer verbatim as the author's own words,
  // so they are written in the reader's language — the model answers in kind.
  preset_dip: "Buy the dip",
  preset_dip_prompt:
    "Buy when it is down 4% or more on the day, take profit at 3%, stop out at 2%.",
  preset_calm: "Only when calm",
  preset_calm_prompt:
    "Only trade when volatility is low and nothing abnormal happened this week.",
  preset_deep: "Deep pools only",
  preset_deep_prompt:
    "Only trade when the pool is deep. Take profit steadily and keep a tight stop.",
} as const;
