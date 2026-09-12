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
  rule_marketCapUsd: "Min market cap",
  rule_marketCapUsd_help:
    "What the token is worth — circulating supply at the current price. NOT the same as the liquidity floor: a million-dollar token can sit on a fifty-thousand-dollar pool. Set it as the WATCH condition of a two-stage entry for \"once it reaches a million, look for the dip\". Tokens only — a tokenized stock carries no market cap and will never satisfy it.",
  rule_marketCapUsdMax: "Max market cap",
  rule_marketCapUsdMax_help:
    "The other end of the same figure — nothing bigger than this. Set both to hunt inside a size band. Tokens only.",
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
  rule_rsi14Min: "Min RSI",
  rule_rsi14Min_help:
    "The same reading, the other way round: it must be AT LEAST this. Above 50 buys strength instead of weakness — and as a sell signal, 70 is 'close it once the move is stretched'.",
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
  rule_bollingerBandwidthPctMin: "Min Bollinger bandwidth",
  rule_bollingerBandwidthPctMin_help:
    "Requires the bands to be at least this WIDE. It is the rule a band-to-band strategy needs: selling at the middle band wins one standard deviation, which is a quarter of this figure — so 4% bandwidth is a 1% trade, and a 10% stop would be six times the reward. Set this above roughly three times your stop for the two to be matched.",
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
  tf_5m_detail: "A month of history. Enough context for a swing inside a day.",
  tf_1m: "1 min",
  tf_1m_detail: "Two hours of history. Crypto only — no RWA feed builds minute bars.",

  // ── Cadences ───────────────────────────────────────────────────
  cad_1m: "1 min",
  cad_1m_detail: "The fastest the scheduler runs. Best paired with a ranked screen.",
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
  bs_minutes: "{n}m",
  bs_time_limit_mins: "Time limit (minutes)",
  bs_time_limit_mins_help:
    "Close regardless of price after this many minutes. Set with the day limit, the earlier one wins.",
  bs_exits_note:
    "Exits are evaluated every cycle, before the agent looks for anything new — including on cycles where it finds nothing to buy. A position whose price cannot be read is never closed on a guess.",
  bs_basket_title: "Whole-book exit",
  bs_basket_body:
    "Close every open position at once when the book as a whole reaches a level — not each position on its own terms.",
  bs_basket_on: "On",
  bs_basket_off: "Off",
  bs_basket_take: "Book target",
  bs_basket_take_help:
    "Close everything when the open book is up this much overall, whatever the individual positions are doing.",
  bs_basket_stop: "Book stop",
  bs_basket_stop_help: "Close everything when the open book is down this much overall.",
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
  acc_perlot_note:
    "Each entry now judges its own take profit and stop loss. The rung bought cheapest can sell on its own bounce while the others stay open.",
  acc_perlot_title: "Grid — exit each entry separately",
  acc_perlot_body:
    "Off means every buy blends into one average position. On means each buy exits on its own take profit and stop loss — this is what makes it a grid.",
  acc_perlot_on: "Per entry",
  acc_perlot_off: "Blended",
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
  rule_launchAgeMinutes: "Min minutes since launch",
  rule_launchAgeMinutes_help:
    "Skip the first minutes after a pool opens, when the price is pure noise and the rug is still possible.",
  rule_launchAgeMinutesMax: "Max minutes since launch",
  rule_launchAgeMinutesMax_help:
    "Only tokens younger than this. Read from the chain the moment the pool was created.",
  rule_changeSinceLaunchPct: "Min change since launch",
  rule_changeSinceLaunchPct_help:
    "Price against the first price recorded after the pool opened. Needs no chart history.",
  rule_changeSinceLaunchPctMax: "Max change since launch",
  rule_changeSinceLaunchPctMax_help:
    "Leave out tokens that have already run too far from their launch price.",
  rule_drawdownFromLaunchHighPct: "Min dip from launch high",
  rule_drawdownFromLaunchHighPct_help:
    "How far price has fallen from the highest point since launch. The launch-era version of the 60-bar high.",
  rule_liquidityGrowthPct: "Min liquidity growth",
  rule_liquidityGrowthPct_help:
    "Pool liquidity now against what it opened with. Negative means liquidity is leaving.",
  rule_volume5mUsd: "Min 5-minute volume",
  rule_volume5mUsd_help:
    "Dollar value traded in the last five minutes, refreshed live.",
  rule_buySellRatio5m: "Min 5-minute buys per sell",
  rule_buySellRatio5m_help:
    "Buys divided by sells over the last five minutes. 1 is balanced; above 1 more buyers than sellers.",
  rule_holderCount: "Min holders",
  rule_holderCount_help:
    "Wallets holding the token, refreshed live.",
  rule_top10HolderPct: "Max top-10 holder share",
  rule_top10HolderPct_help:
    "Share of supply in the ten largest wallets. Lower is better spread.",
  rule_creatorHoldingPct: "Max creator holding",
  rule_creatorHoldingPct_help:
    "Share of supply the wallet that created the pool still has.",
  rule_sellImpactPct: "Max cost to sell $100",
  rule_sellImpactPct_help:
    "What a $100 round trip loses to the pool right now. The tighter this is, the easier it is to get out.",
  acc_from_heading: "Measured from",
  acc_from_help:
    "The average falls with every buy, so rungs measured from it crowd together on the way down. Measured from the last fill, each rung sits the same distance below the previous buy — which is what a grid is.",
  acc_from_average: "My average",
  acc_from_last: "The last fill",
  acc_growth: "Widen each rung",
  acc_growth_help:
    "Multiplies the gap for every rung taken. 1.5× on a 5% rung is 5%, then 7.5%, then 11.25% — progressive spacing, deeper as it falls.",
  acc_growth_even: "Even spacing",
  acc_growth_display: "{factor}× each rung",
  acc_depth: "No deeper than",
  acc_depth_help:
    "The ladder's floor, measured below your first entry. A grid drawn to cover a 33% fall stops adding once price is more than 33% under where you started, however many rungs remain.",
  acc_depth_display: "{pct}% under the first entry",
  acc_depth_off: "No floor",
  plan_from_last: " from the last fill",
  plan_widening: ", each rung {factor}× wider",
  plan_depth: "no deeper than {pct}%",
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
  rule_bollingerPctBMin: "Min Bollinger %B",
  rule_bollingerPctBMin_help:
    "Where price sits in its 20-bar Bollinger channel: 0 is the lower band, 100 the upper. A floor near 100 asks for a close at or above the upper band — a breakout.",
  rule_priceVsSma5Pct: "Max price above MA5",
  rule_priceVsSma5Pct_help:
    "Price against its 5-bar simple average, in percent. 0 or below asks for a pullback to the average; a small positive number allows a touch above it.",
  rule_priceVsSma10Pct: "Max price above MA10",
  rule_priceVsSma10Pct_help:
    "Price against its 10-bar simple average, in percent. 0 or below asks for a pullback to the average.",
  rule_priceVsEma20Pct: "Max price above EMA20",
  rule_priceVsEma20Pct_help:
    "Price against its 20-bar exponential average, in percent. 0 or below asks for a pullback to the average.",
  rule_priceVsEma50Pct: "Max price above EMA50",
  rule_priceVsEma50Pct_help:
    "Price against its 50-bar exponential average, in percent. 0 or below asks for a pullback to the average.",
  rule_aboveLow60dPct: "Max above 60-bar low",
  rule_aboveLow60dPct_help:
    "How far price has risen off its lowest close in 60 bars. A small number admits only assets still near their floor.",
  rule_smaCrossUpBars: "Golden cross within",
  rule_smaCrossUpBars_help:
    "The 20-bar average crossed above the 50-bar average this many bars ago or fewer. An event, so the window is short.",
  rule_smaCrossDownBars: "Death cross within",
  rule_smaCrossDownBars_help:
    "The 20-bar average crossed below the 50-bar average this many bars ago or fewer.",
  rule_macdCrossUpBars: "MACD crossed up within",
  rule_macdCrossUpBars_help:
    "The MACD line crossed above its signal line this many bars ago or fewer.",
  rule_macdCrossDownBars: "MACD crossed down within",
  rule_macdCrossDownBars_help:
    "The MACD line crossed below its signal line this many bars ago or fewer.",
  rule_volumeRatio: "Min volume vs 20-bar average",
  rule_volumeRatio_help:
    "Volume on the last bar as a multiple of its own 20-bar average. 1 is an ordinary bar, 2 is double. This is how you ask for volume to confirm a move.",
  rule_buyPressurePct: "Min buying pressure",
  rule_buyPressurePct_help:
    "Share of volume on rising bars over the last 14, in percent. Above 50 means buyers have had the upper hand.",
  rule_adx: "Min trend strength (ADX 14)",
  rule_adx_help:
    "Whether there is a trend at all, whichever way. Under 20 is chop; over 25 is a trending market. Tokens only — it needs each bar's high and low.",
  rule_stochasticK: "Max Stochastic %K (14)",
  rule_stochasticK_help:
    "Where the close sits in the last 14 bars' range: 0 at the low, 100 at the high. A ceiling keeps you out of the top of the range. Tokens only.",
  rule_stochasticKMin: "Min Stochastic %K (14)",
  rule_stochasticKMin_help:
    "Where the close sits in the last 14 bars' range. A floor asks for strength — a close near the top of its range. Tokens only.",
  rule_cci: "Max CCI (20)",
  rule_cci_help:
    "Commodity Channel Index over 20 bars. Above +100 is stretched high; a ceiling avoids buying the stretch. Tokens only.",
  rule_mfi: "Max Money Flow Index (14)",
  rule_mfi_help:
    "RSI weighted by volume, over 14 bars. Above 80 is heavily bought. Tokens only.",
  rule_vwapDistPct: "Max distance above VWAP",
  rule_vwapDistPct_help:
    "Price against the 20-bar volume-weighted average price, in percent. 0 or below asks for a price at or under where most volume traded. Tokens only.",
  rule_barVolumeUsd: "Min volume on the last bar",
  rule_barVolumeUsd_help:
    "Dollar value traded on the last bar of your bar size. \"At least $500 per 15-minute candle\" is this rule at 500 on 15-minute bars.",
  rule_avgBarVolumeUsd: "Min average volume per bar",
  rule_avgBarVolumeUsd_help:
    "Average dollar value traded per bar over the last 20 bars. Asks for consistent trading rather than one busy candle.",
  rule_priceUsd: "Min price",
  rule_priceUsd_help:
    "A price floor in dollars. \"Only above $2\" or, as the watch of a two-stage entry, \"once it reaches $1\". A level, not a change.",
  rule_priceUsdMax: "Max price",
  rule_priceUsdMax_help:
    "A price ceiling in dollars. \"Buy under $180\", or as a signal exit, a hard stop at a price. A level, not a change.",
  plan_and: " and ",
  plan_every_days: "{n} days",
  plan_every_hours: "{n} hours",
  plan_every_minutes: "{n} min",
} as const;
