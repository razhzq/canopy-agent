// The strategy builder: the rule catalogue, the templates, and the
// accumulation plan.
//
// The rule LABELS and HELP are the product's own vocabulary and are the most
// load-bearing strings in the app — someone sets a threshold from them and an
// agent trades on it. The Chinese keeps the standard indicator names in Latin
// (RSI, MACD, ATR, Bollinger, Supertrend), because that is what a Chinese-
// speaking trader reads on every chart they have ever opened; translating them
// into descriptive phrases would make the rules harder to recognise, not easier.

export const enStrategy = {
  // ── Rule catalogue ─────────────────────────────────────────────
  rule_liquidityUsd: "Liquidity floor",
  rule_liquidityUsd_help: "Pool depth on Solana. Applies to every asset, including gold.",
  rule_dailyVolPct: "Max daily volatility",
  rule_dailyVolPct_help: "Trailing realised volatility of the underlying, from Wintel.",
  rule_maxEventScore: "Max recent event severity",
  rule_maxEventScore_help:
    "Skip anything that has had a serious abnormal-activity event this week.",
  rule_netMarginPct: "Min net margin",
  rule_netMarginPct_help: "From SEC filings. Applies to equities; skipped for commodities.",
  rule_changePct: "Max change on the day",
  rule_changePct_help:
    "Buy only after a fall. −4 means it must already be down 4% or more today.",
  rule_momentum20dPct: "Min momentum",
  rule_momentum20dPct_help:
    "Percent change over the last 20 bars. Above 0 requires it to have risen; negative buys weakness. This is the change rule that follows your timeframe.",
  rule_rsi14: "Max RSI",
  rule_rsi14_help:
    "70+ is conventionally overbought — lower this to avoid buying into a run. Scale-free: 70 means the same thing on every bar size.",
  rule_smaSpreadPct: "Min trend",
  rule_smaSpreadPct_help:
    "Gap between the 20- and 50-bar averages. Above 0 means the short average leads — an uptrend.",
  rule_belowHigh60dPct: "Min below high",
  rule_belowHigh60dPct_help:
    "How far under the 60-bar high it must sit. Above 0 buys pullbacks rather than breakouts.",
  rule_macdHistPct: "Min MACD histogram",
  rule_macdHistPct_help:
    "MACD (12/26/9), measured as a percent of price so one setting works across gold and equities. Above 0 means the crossover has already happened.",
  rule_atrPct: "Max ATR",
  rule_atrPct_help:
    "Average True Range over 14 bars, as a percent of price — how much this token typically moves in a bar, gaps included. Lower admits only calmer tokens.",
  rule_bollingerPctB: "Max Bollinger %B",
  rule_bollingerPctB_help:
    "Where price sits in the 20-bar bands: 0 is the lower band, 50 the average, 100 the upper. Lower this to buy near the bottom of the range.",
  rule_bollingerBandwidthPct: "Max Bollinger bandwidth",
  rule_bollingerBandwidthPct_help:
    "How wide the bands are, as a percent of price. Lower this to trade only when volatility has squeezed.",
  rule_supertrendDistancePct: "Min Supertrend distance",
  rule_supertrendDistancePct_help:
    "How far price sits above the Supertrend band, as a percent. Above 0 means Supertrend is bullish right now, and stays true for the whole trend — set it to 0 for 'only buy while the trend is up'. For the flip itself, use the rule below.",
  rule_supertrendFlipUpBars: "Supertrend flipped up within",
  rule_supertrendFlipUpBars_help:
    "How many bars ago Supertrend turned bullish. 0 means on the latest bar, 3 means within the last three. This is the EVENT — a fresh signal — so most tokens are skipped most of the time, which is the point of a trend follower.",
  rule_supertrendFlipDownBars: "Supertrend flipped down within",
  rule_supertrendFlipDownBars_help:
    "How many bars ago Supertrend turned bearish. Rarely an entry condition — for a strategy that buys weakness deliberately.",

  // ── Rule labelling ─────────────────────────────────────────────
  // "Max RSI (14d)" / "Max RSI (14 × 15m)" — the window is what makes the
  // number mean something, and it changes with the chart.
  rule_window_daily: "{label} ({periods}d)",
  rule_window_bars: "{label} ({periods} × {timeframe})",
  rule_basis_change:
    "Always 24 hours — this one does not follow the strategy timeframe. For a change measured on your bars, use Min momentum below.",
  rule_basis_daily: "Always daily — this one does not follow the strategy timeframe.",
  rule_span_minutes: "≈ {n} min",
  rule_span_hours: "≈ {n}h",
  rule_span_hours_minutes: "≈ {h}h {m}m",
  rule_span_days: "≈ {n} days",
  rule_at_least: "at least",
  rule_at_most: "at most",

  // ── Timeframes ─────────────────────────────────────────────────
  tf_1d: "1 day",
  tf_1d_detail: "The default. ~120 days of history behind every indicator.",
  tf_1h: "1 hour",
  tf_1h_detail: "Two months of history. A 14-period RSI spans two days.",
  tf_30m: "30 min",
  tf_30m_detail:
    "Six weeks of history. Tokenized assets only — token pools are not built at this size.",
  tf_15m: "15 min",
  tf_15m_detail: "A month of history. A 14-period RSI spans about 3½ hours.",
  tf_5m: "5 min",
  tf_5m_detail: "A month of history. The finest the scheduler can act on.",

  // ── Cadences ───────────────────────────────────────────────────
  cad_5m: "5 min",
  cad_5m_detail: "Fastest stops. ~288 model calls a day.",
  cad_15m: "15 min",
  cad_15m_detail: "Reacts within the session. ~96 a day.",
  cad_30m: "30 min",
  cad_30m_detail: "~48 a day.",
  cad_1h: "1 hour",
  cad_1h_detail: "The default. ~24 a day.",
  cad_4h: "4 hours",
  cad_4h_detail: "Quiet. ~6 a day.",
  cad_1d: "1 day",
  cad_1d_detail: "One cycle a day.",

  // ── Templates ──────────────────────────────────────────────────
  tpl_quality: "Quality accumulation",
  tpl_quality_body:
    "Liquid, profitable, calm. Buys what is boring and skips what is moving. The default.",
  tpl_quality_meta: "Most conservative",
  tpl_averse: "Event-averse",
  tpl_averse_body:
    "The same idea, tightened: deeper liquidity, calmer tape, and nothing that has had an abnormal week.",
  tpl_averse_meta: "Fewest trades",
  tpl_opportunistic: "Opportunistic",
  tpl_opportunistic_body:
    "Tolerates volatility and weaker margins to see more candidates. Expect more proposals and more rejections.",
  tpl_opportunistic_meta: "Most active",

  // ── Signal sources ─────────────────────────────────────────────
  src_fundamentals: "Fundamentals",
  src_fundamentals_detail: "Margins, filings, balance sheet",
  src_news: "News & events",
  src_news_detail: "Abnormal activity, filings search",
  src_technical: "Technical",
  src_technical_detail: "RSI, trend, distance from high — daily",
  src_sentiment: "Sentiment",
  src_sentiment_detail: "X and social",
  src_smart_money: "Smart money",
  src_smart_money_detail: "Wallet flow",

  // ── Step 2 sections ────────────────────────────────────────────
  bs_starting_point: "Starting point",
  bs_starting_note: "Each one runs as-is.",
  bs_custom: "Custom",
  bs_template_meta: "· {meta}",
  bs_adjusted: "Adjusted from a template. Pick one above to start over from a known set.",
  bs_entry_rules: "Entry rules",
  bs_entry_note: "What has to be true before it buys.",
  bs_tune: "Tune",
  bs_done: "Done",
  bs_exit_rules: "Exit rules",
  bs_exit_note: "Entry rules alone would buy and never sell.",
  bs_take_profit: "Take profit",
  bs_take_profit_help: "Close when the position is up this much.",
  bs_stop_loss: "Stop loss",
  bs_stop_loss_help:
    "Close when it is down this much. A magnitude — 12 means twelve percent down.",
  bs_time_limit: "Time limit",
  bs_time_limit_help: "Close regardless of price after this long.",
  bs_time_never: "Never",
  bs_days: "{n}d",
  bs_exits_note:
    "Exits are evaluated every cycle, before the agent looks for anything new — including on cycles where it finds nothing to buy. A position whose price cannot be read is never closed on a guess.",
  bs_timeframe: "Chart timeframe",
  bs_timeframe_note: "The bar size every rule above is measured on.",
  bs_timeframe_help:
    "This changes what your rules mean, not just how often they run. RSI 14 is a fortnight of selling on daily bars and about three hours on 15-minute ones — the labels above update to match. Volatility, change on the day and event severity stay daily whatever you pick here.",
  bs_cycle: "Cycle",
  bs_cycle_note: "How often it wakes — not the chart timeframe.",
  bs_cadence_matched: "Matched to your timeframe — one new bar each cycle.",
  bs_cadence_faster:
    "Faster than your timeframe: some cycles re-read a bar that has not changed yet, and pay for a model call to reach the same answer. What it does buy is tighter stops, since exits are checked every cycle.",
  bs_cadence_slower:
    "Slower than your timeframe: the agent will step over bars without ever seeing them. Deliberate if you want to sample a fast chart slowly.",
  bs_sources: "Signal sources",
  bs_sources_note: "What these rules draw on today.",
  bs_sources_help:
    "Dimmed sources are not wired yet. Your rules run on the two that are — nothing here silently does nothing.",

  // ── Accumulation ───────────────────────────────────────────────
  acc_title: "Accumulation",
  acc_note: "Buying more of what it already holds. Off by default.",
  acc_on: "Accumulating",
  acc_off: "One entry per asset",
  acc_off_body:
    "The agent buys once and then manages that position. Turn this on to average in — on a schedule, on dips, or on strength.",
  acc_blend_warning:
    "Your take profit and stop loss now measure the BLEND of everything you have bought, not each entry separately. A position averaged down three times exits as one.",
  acc_when: "When to add",
  acc_schedule: "On a schedule",
  acc_falls: "When it falls",
  acc_rises: "When it rises",
  acc_falls_vol: "When it falls by volatility",
  acc_every: "Every {spacing}",
  acc_measure_bandwidth: "Bollinger bandwidth",
  acc_measure_atr: "ATR",
  acc_falls_by: "Falls by",
  acc_rises_by: "Rises by",
  acc_vol_help:
    "Each rung is this many times the asset's own volatility, re-read every cycle — so the steps widen when it gets choppy and tighten when it calms. Measured from your average cost.",
  acc_vol_help_atr: " ATR is the average true range over 14 bars.",
  acc_vol_help_bandwidth: " Bollinger bandwidth is how wide the 20-period bands are.",
  acc_vol_display: "−{multiple}× {measure}",
  acc_drawdown_help: "Measured from your average cost, not from the last entry.",
  acc_gain_help: "Adding to a winner. Measured from your average cost.",
  acc_guard_heading: "Only while it still qualifies",
  acc_guard_on: "Re-check my rules",
  acc_guard_off: "Add regardless",
  acc_guard_on_body:
    "Before each add, the agent re-runs the entry rules you set. If the asset would no longer be bought today — liquidity gone, bad news, fundamentals turned — it stops adding and holds what it has.",
  acc_guard_off_body:
    "The agent keeps buying on the condition above without re-checking your rules. Your stop loss still protects you if the price falls, but nothing notices if the situation changes while the price holds up.",
  acc_how_much: "How much",
  acc_fixed: "Fixed amount",
  acc_share: "Share of capital",
  acc_ladder: "Growing ladder",
  acc_each_add: "Each add",
  acc_fixed_help: "The same amount every time.",
  acc_share_help: "A share of the capital this agent was given.",
  acc_first_add: "First add",
  acc_first_add_help: "Where the ladder starts.",
  acc_grows_by: "Each add grows by",
  acc_grows_help: "Compounds. A 2x ladder makes the tenth add 512 times the first.",
  acc_where_stops: "Where it stops",
  acc_most_adds: "Most adds",
  acc_most_adds_help: "Per position. The count resets when the position closes.",
  acc_wait_at_least: "Wait at least",
  acc_wait_help: "A floor between adds, whatever the condition above says.",
  acc_hours: "{n}h",
  acc_all_checks:
    "Every add goes through the same checks as a first purchase — position cap, compliance, safety screen. A plan cannot buy past a limit you set elsewhere.",

  // ── Spacings ───────────────────────────────────────────────────
  sp_1h: "1 hour",
  sp_1d: "1 day",
  sp_1w: "1 week",
  sp_1mo: "1 month",

  // ── Plan warnings ──────────────────────────────────────────────
  warn_drawdown_never:
    "Adding at −{pct}% will rarely fire: the {stop}% stop closes the position first.",
  warn_drawdown_tight:
    "Adding at −{pct}% leaves only {gap} points before the {stop}% stop — expect to buy, then be stopped out of the bigger position.",
  warn_vol_crosses:
    "Rungs sit at {multiple}× {measure}, so on anything more volatile than {crossesAt}% the first rung falls past the {stop}% stop and the position closes before it ever adds.",
  warn_gain_never: "Adding at +{pct}% will rarely fire: the {target}% target sells first.",
  warn_ceiling_below_first:
    "A ${ceiling} ceiling is smaller than the ${first} first add, so this plan can never buy.",
  warn_ladder_unbounded: "A doubling ladder with no limit on adds compounds fast. Set a maximum.",

  // ── Plan summary sentence ──────────────────────────────────────
  plan_adds: "Adds {size}",
  plan_size_pct: "{pct}% of capital",
  plan_size_ladder: "{base}, growing {factor}x",
  plan_every: "every {spacing}",
  plan_when_down: "when down {pct}%",
  plan_when_down_vol: "when down {multiple}× its {measure}",
  plan_when_up: "when up {pct}%",
  plan_measure_atr: "ATR",
  plan_measure_bandwidth: "Bollinger bandwidth",
  plan_guarded: "only while the rules still pass",
  plan_max_adds: "max {n}",
  plan_up_to: "up to {amount}",
  plan_or: " or ",
  plan_and: " and ",
  plan_every_days: "{n} days",
  plan_every_hours: "{n} hours",
  plan_every_minutes: "{n} min",
} as const;
