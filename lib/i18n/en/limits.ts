// Step 2 of the builder — writing a strategy in a sentence, reading back the
// rules it compiled to, and setting the budget around them.

export const enLimits = {
  // ── Header ─────────────────────────────────────────────────────
  sl_step: "Step 2 of 3 · Limits",
  sl_title: "Set your limits",
  sl_markets_one: "{symbol}/USDC",
  sl_markets_many: "{count} markets",
  sl_class_crypto: "Crypto",
  sl_class_commodity: "Tokenized commodity",
  sl_class_equity: "Tokenized equity",
  sl_change: "— change",

  // ── Compose ────────────────────────────────────────────────────
  sl_strategy_for: "Strategy · {markets}",
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
  sl_stage_reading: "Reading the sentence",
  sl_stage_drafting: "Drafting the rules",
  sl_stage_checking: "Checking what's missing",
  sl_try_one: "Try one:",
  sl_group_rules: "Rules",
  sl_group_exits: "Exits",
  sl_show_off_rules: "Show {count} more rules",
  sl_hide_off_rules: "Hide the rules that are off",
  sl_fine_tune: "Fine-tune the rules",
  sl_rules_on: "{on} of {total} on",
  sl_card_eyebrow: "{symbol} · read as",
  sl_card_eyebrow_plain: "Read as",
  sl_card_position: "Per position",
  sl_card_bars: "Bars",
  sl_card_hand_none: "Nothing on yet. Turn on a rule below, or write a sentence above.",
  sl_card_hand_one: "One rule is on. Open Fine-tune to see it.",
  sl_card_hand_many: "{count} rules are on. Open Fine-tune to see them.",
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
  // ── The sell signal ────────────────────────────────────────────
  // The only exit that asks about the MARKET rather than about the position,
  // so its copy has to carry two things nothing else here does: that the
  // conditions are ANDed, and that they are read on closed bars.
  sl_sell_signal: "Sell signal",
  /** Between two conditions of one signal. They are ANDed, so: "and". */
  sl_sell_join: " and ",
  sl_sell_signal_off:
    "Off — the agent sells on the levels above and nothing else. Add a condition to sell on what the market is doing, like reaching the middle Bollinger band.",
  sl_sell_signal_on:
    "The agent closes the position when this is true, whatever the position is worth. Your stop loss still applies underneath it.",
  sl_add_condition: "+ Add a condition",
  sl_sell_all_hold: "All of these must be true before it sells.",
  sl_sell_on_close:
    "Read once a cycle, on closed bars — it sells on the first bar that CLOSES past the level, not the moment price touches it.",

  sell_band_up: "Price back at the band",
  sell_band_up_help:
    "Where price sits in the 20-bar bands: 0 is the lower band, 50 the middle average, 100 the upper. 50 is the classic mean-reversion exit — buy at the bottom of the range, sell when it returns to the middle.",
  sell_band_down: "Price falls through the band",
  sell_band_down_help:
    "The same scale, downward: sell if price drops to or below the lower band. This is the setup breaking rather than completing — an exit for a trade that went the wrong way without hitting its stop.",
  sell_rsi: "RSI drops to",
  sell_rsi_high: "RSI climbs back to",
  sell_rsi_high_help:
    "The move having gone far enough rather than having failed. 70+ is conventionally overbought — this is the exit for a bounce you bought oversold and want to leave while it is still working.",
  sell_stoch_high: "Stochastic %K climbs back to",
  sell_stoch_high_help:
    "Where the close sits inside the recent high-low range: 0 is the bottom, 100 the top. 80 sells once price has worked back to the top of its own range. Crypto only — it needs a high and a low per bar, which the tokenized-stock feed does not serve.",
  sell_rsi_help:
    "Momentum gone, whatever the price has done. Scale-free: 30 means the same thing on every bar size.",
  sell_macd: "MACD crossed down within",
  sell_macd_help:
    "How many bars ago the MACD line crossed below its signal line. 0 means on the latest bar — the trend rolling over, caught as the event rather than as a level.",
  sell_supertrend: "Supertrend flipped down within",
  sell_supertrend_help:
    "How many bars ago Supertrend turned bearish. 0 means on the latest bar. The trend follower's own exit — it sells on the same signal it would have refused to buy on.",

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
  sl_not_served: "not served",
  sl_timeframe_help:
    "This changes what your rules mean, not just how often they run. Every rule above relabels, states its window in real time, and moves its threshold with the bar — a trend floor of 3% on daily becomes 0.3% here, because that is the same ask. One exception, and it says so on the chip: change on the day is always 24 hours. Use Min momentum for a change measured on your own bars.",
  sl_timeframe: "Timeframe",
  sl_wakes_every: "Wakes every {cadence}",
  sl_cycle_change: "Wake on a different cycle",
  sl_cycle_match: "Match the bars",
  sl_position_info: "The most the agent may put into one market in one trade. Never exceeded, never split to get around.",
  sl_cycle: "Cycle",

  // ── Budget ─────────────────────────────────────────────────────
  sl_budget: "Budget for this market",
  sl_position_limit: "Position size limit",
  sl_trades_per_cycle: "Max trades per cycle",
  sl_unit_trades: "trades",
  sl_trades_help: "Entries per wake-up. The agent never splits an order to get around it.",
  sl_budget_note: "Against a {book} paper book",
  sl_position_consequence: "{pct}% of the book · up to {positions} open at once",
  sl_unit_trade: "trade",
  sl_step_down: "Fewer {label}",
  sl_step_up: "More {label}",

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
    "\u201c{phrase}\u201d asks how much something moved, and my readings measure where it is now. I set the closest one. Which did you mean?",
  sl_ask_reint_chip_1: "measure the change over the last 20 bars",
  sl_ask_reint_chip_2: "the level is what I meant, leave it",
  sl_ask_reint_chip_3: "drop that condition",
  sl_ask_unsupported:
    "I don't have a reading for \u201c{phrase}\u201d, so it isn't in your rules yet. Want something close in its place?",
  sl_ask_unsup_chip_1: "leave it out, the rest is right",
  sl_ask_unsup_chip_2: "what readings do you have that are close?",
  sl_ask_unclear:
    "\u201c{phrase}\u201d didn't turn into a rule. Tell me what it should check, or leave it out.",
  sl_ask_unclear_chip_1: "require at least $50,000 of liquidity in the pool",
  sl_ask_unclear_chip_2: "leave it out, the rest is right",
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
