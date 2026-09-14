# Strategy coverage: where the composer says no, and what to do about it

Written 13 Sep 2026 after "buy the dip" was refused on a perp agent.

## The immediate failure

The catalogue has always had a day-change rule (`changePct`, "down 4% or more
on the day" is `changePct ≤ −4`). The refusal came from the plumbing, not the
vocabulary:

1. The compose prompt listed tokenized assets and spot tokens and told the
   model it may only name assets from that list. The builder prefixes every
   sentence with "Trading SOL-PERP.", and SOL-PERP was on no list. The model
   was asked about a market it had been told it could not trade.
2. Even a correctly composed rule would have failed at tick time: the perps
   specialist served no `changePct` fact, and a rule with no fact rejects
   every candidate.

Both are fixed on the backend: perp markets named in a sentence are listed in
the prompt as perpetual futures screened on the underlying's bars, and the
venue's 24h change is served as `changePct` on perps.

## What the composer can express today

Fifty-nine rule keys, each a threshold with one fixed comparator:

| Family | Keys | Data behind it |
|---|---|---|
| Price change | changePct (24h), momentum20dPct (20 bars), changeSinceLaunchPct | universe row, candles |
| Price level | priceUsd / priceUsdMax | live mark |
| Momentum / oscillators | rsi14 (+Min), stochasticK (+Min), cci, mfi, macdHistPct, macdCrossUp/DownBars, adx | 120 candles at the strategy's bar size |
| Moving averages | smaSpreadPct (20/50), smaCrossUp/DownBars, priceVsSma5/10Pct, priceVsEma20/50Pct, vwapDistPct | candles |
| Volatility / bands | atrPct, bollingerPctB (+Min), bollingerBandwidthPct (+Min), dailyVolPct, supertrend (state + flips) | candles |
| Range position | belowHigh60dPct, aboveLow60dPct | candles |
| Volume | volumeRatio, barVolumeUsd, avgBarVolumeUsd, volume5mUsd, buySellRatio5m, buyPressurePct | candles, DexScreener |
| Liquidity / size | liquidityUsd, marketCapUsd (+Max), sellImpactPct | universe row, Jupiter quote |
| Launch / holders | launchAgeMinutes (+Max), drawdownFromLaunchHighPct, liquidityGrowthPct, holderCount, top10HolderPct, creatorHoldingPct | DexScreener, RPC |
| Perp-only | borrowAprPct, utilizationPct, fundingRateHourlyPct (+Min), openInterestImbalancePct | venue custody accounts |
| Fundamentals (RWA) | netMarginPct, maxEventScore | Wintel |

Plus: either/or groups, a two-stage setup (arm then trigger), ranking
(best N by a key), an add plan (DCA / ladder / on drawdown), exits (take
profit, stop, trailing, break-even, scale-out, time limit, indicator exits).

Data behind it: 120 candles per market at 1m–1d from CoinGecko or Birdeye,
Jupiter marks, DexScreener pair stats, Wintel for tokenized assets, the venue
custody accounts for perps.

## What people ask for that it cannot say

These are the shapes a trader reaching for MQL5 or Pine would write in the
first hour, and what stops each one today.

| Request | Why it fails today | What closes it |
|---|---|---|
| "RSI 7 below 25", "50 and 200 MA cross", "Bollinger 10, 1.5σ" | Every indicator has a fixed period. RSI is 14, the MA pair is 20/50, Bollinger is 20/2. | Parameterised keys: `rsi(7)`, `smaCross(50,200)`. The reading battery already computes from bars; only the key grammar and the catalogue are fixed. |
| "down 10% in the last 4 hours", "up 3% since yesterday's close" | Change is 24h or 20 bars, no other window. | `changePct(window)` computed from candles at any bar size; needs the candle store to hold more than 120 bars for long windows. |
| "when the 1h RSI is under 30 but the daily trend is up" | One timeframe per strategy. | Multi-timeframe facts: a second candle series per market, keyed by timeframe in the fact name. Biggest engine change on this list. |
| "price crosses above the 20 EMA", "breaks yesterday's high", "new 7-day high" | Crosses exist only for 20/50 SMA and MACD; no breakout keys. | Generic cross and breakout keys over any series: `crossAbove(price, ema20)`, `breaksHighBars(n)`. |
| "a bullish engulfing on the 15m", "hammer at support" | No candle-pattern readings. | A small pattern library over OHLC (engulfing, pin bar, doji, inside bar). Cheap; the bars are already there. |
| "volume 3× the 20-bar average AND price up" | Exists (volumeRatio) but only as a single condition; no "and price up on the same bar". | Same-bar conjunctions are already ANDed; what is missing is a bar-change key (`barChangePct`). |
| "SOL is outperforming BTC", "when BTC is above its 200 MA" | No cross-asset facts. | Reference-asset facts: BTC and SOL bars are already fetched for perps; expose `btcTrend`, `relativeStrengthVsBtc`. |
| "only between 9am and 4pm New York", "not on weekends" | No time facts. | Session keys: hour of day, day of week, in the strategy's timezone. Trivial. |
| "when funding goes negative", "OI rising while price flat" | Now partly there for perps; no OI change over time. | Store OI and funding per tick so a change key can be computed. |
| "sell half at +10%, the rest at +25%" | Exists (scale-out). | Nothing; the composer sometimes misses the phrasing. |
| "grid between $100 and $140, 10 levels" | Not a rule; a different execution model. | A grid / DCA execution primitive. Listed by the gap study as the most-requested thing. |
| "trail the stop by 2× ATR" | Trailing is a fixed percent. | ATR-multiple trailing stop; ATR is already read. |
| "a mean-reversion pair, long SOL short ETH" | Two markets, one book, opposite sides. | Out of scope for the rule model; a basket strategy type. |

## Where the demand data is

Every refusal is already recorded: `agent_unsupported_requests` in canopy-be
(phrase, normalised phrase, strategy class, time). That table is the
priority list. Before building anything on the table above, pull the last 90
days grouped by normalised phrase and count. The ranking of what people
actually typed beats any guess in this document.

## What the demand ledger says (90 days to 13 Sep 2026)

Thirty-nine distinct refused phrases, ~75 refusals. Grouped:

| Group | Refusals | Examples | Verdict |
|---|---|---|---|
| Grid / DCA execution | ~30 | "grid strategy", "allocation per level scales with spacing", "cumulative range covered", "weighted average entry price", "grid levels with progressive spacing", "close all orders with overall profit 10%", "buy $500 every 1 hour" | Not a rule; a different execution model. The single largest ask, and the gap study said the same. |
| Things the catalogue already has, refused anyway | ~14 | "minimum average volume $500 per 15-min candle" (avgBarVolumeUsd), "volume more than $1M in a 15-min candle" (barVolumeUsd), "price reaches MA5 or MA10" (priceVsSma5/10), "price closes above top BB" (bollingerPctBMin), "sell when TP 5%", "stop at 3%", "trailing stop 5%", "supertrend", "market cap at entry $1M" (marketCapUsd), "50% drawdown of position" (stop 50%), "buy $500 every hour" (add plan on a schedule) | False refusals. The model did not map a phrasing the catalogue supports. The cheapest and highest-yield fix on this list. |
| Volatility and bar change | ~7 | "volatility increase by 1%", "volatility up 1%", "price go up 1%" | Missing keys: change in ATR / bandwidth over N bars, and change on the current bar. Small. |
| Fixed periods and timeframes | ~4 | "1h 200 EMA", "price stays above the 1h 200 EMA", "middle Bollinger band" (SMA 20), "short timeframe play 5m and 15m" | Parameterised periods and multi-timeframe. |
| Asset names not recognised | 3 | "wbtc", "cbbtc", "500" | Pre-dates the fix that lists both universes; should not recur. |
| Out of scope for a rule | 3 | "founder post about good news", "high frequency trade setup", "turn off my stop loss" (refused on purpose) | News/social data does not exist here; the stop is mandatory by design. |

Two things the ledger changes about the plan below. False refusals are a
much bigger share than expected — roughly a fifth of everything typed, on
rules that exist — so prompt and alias work comes before any new key. And
grid/DCA is not one item among nine; it is the largest single gap and
should be scoped as a strategy type of its own, not waited on.

## The harness and the false refusals (done 13 Sep 2026)

Steps 1 and 2 below shipped together in canopy-be.

**Corpus.** `packages/agent-stack/src/coverageCorpus.ts` — 138 sentences:
the 35 ledger phrases plus MQL5, Pine and Pionex-style shapes, each with an
expectation (keys, exits, add plan, setup, ranking) or `refusalOk` with the
gap it waits on. `rescue: true` marks the sentences the deterministic layer
must compose from a verbatim refusal; a unit test pins every one.

**Harness.** `npm run coverage:compose` in `packages/canopy-be`. Same prompt,
same validator, same self-hosted model as the compose route, no database.
`--dry` skips the model and measures the rescue layer alone; `--only ledger`,
`--grep`, `--out file.json`. Exit code 1 on any false refusal, so it can gate
a deploy.

**What changed in the composer.** All of it lives in `compose.ts` and none
of it invents a number: every value is read out of the user's own words.

- Aliases can read a level from the phrase (`dollarsIn`): "$500 per
  15-min candle" → avgBarVolumeUsd 500, "$1M in a 15-min candle" →
  barVolumeUsd 1000000, "market cap at entry $1M" → marketCapUsd (or the
  ceiling on "under"), "down 5%" with no window → changePct −5 with the
  24-hour reading stated. No number, no rule.
- An alias can name alternatives: "MA5 or MA10" is an either/or group of
  priceVsSma5Pct / priceVsSma10Pct, not a refusal about 20/50 periods.
- Supertrend: bare is the bullish state, "flips up" the event.
- A refused exit with a number lands in exits (`recoverExit`): "sell when
  TP 5%", "stop at 3%", "trailing stop 5%", "50% drawdown of the position".
  Never over a figure the model set; "turn off my stop loss" stays refused.
- A refused sell condition becomes an exit signal (`recoverExitSignal`):
  "sell when RSI goes above 70" → exitWhen rsi14Min 70.
- A whole-book sentence answered with a per-position take-profit is moved
  to the basket, and the per-position figure reset.
- A model rule whose period the sentence names differently is dropped and
  refused with the periods note — "the 1h 200 EMA" no longer becomes the
  20 EMA on screen. "200 EMA" and "EMA 200" both read as 200.
- Half-refusals — the rule set and its own words listed as unsupported —
  are dropped silently instead of writing a phantom to the ledger.
- The prompt carries the exit, volume-per-candle and exit-signal phrasings
  as worked examples.

**Measured** (Qwen3-14B, temperature 0.2, so ±1–2 sentences run to run).

| Run | Expressible | As asked | False refusals | Mismatches |
|---|---|---|---|---|
| Rescue layer only (`--dry`, every phrase refused verbatim) | 105 | 47 (44.8%) | 46 | 12 |
| Ledger subset, real model | 20 | 18 (90.0%) | 0 | 2 |
| Full corpus, real model, first run | 106 | 91 (85.8%) | 7 (6.6%) | 7 |
| Full corpus after exit-signal + half-refusal fixes | 106 | 97 (91.5%) | 2 (1.9%) | 6 |

The two remaining false refusals were half-refusals ("buy new launches"
beside changeSinceLaunchPct; "only if I can sell $1,000 with under 2%
impact" beside sellImpactPct) and are fixed; both re-run clean.

**Still open from the runs.** Model choices the validator cannot yet
correct, in the order the harness surfaces them:

- Wrong twin of a floor/ceiling pair: "bandwidth over 10%" → the ceiling
  key; "within 5% of the 60-day low" → the high-side key. Needs a direction
  check on the stated words, like the period check.
- The two-stage setup is skipped when the sentence says "then".
- Substitutions on known gaps that the reading does not flag: "middle
  Bollinger band" → the upper band; "volatility up 1%" → an ATR ceiling;
  "a whale wallet buys" → buy/sell ratio. The catalogue keys are real but
  the sentence asked for something else. These are the case for step 4
  (volatility change) and step 5 (middle band as SMA 20), and for a
  refusal when a launch-flow key is used for a wallet sentence.
- "fast average above slow average" is read as the cross, not the state.

## The grid (shipped 14 Sep 2026)

Cyclic, user prices first with an auto range, inside Spot — the three
decisions from the checkpoint.

**Backend (canopy-be).** `GridPlan` on the strategy (`grid` column,
CANOPY_109): one market, a manual or auto range, 2–200 levels, equal-dollar
or equal-percent spacing, an amount a level (flat or scaled with spacing), a
whole-ladder take-profit on the weighted average entry, a stop below the
range, an optional stop above. The tick runs the grid after the drawdown
breaker and ends there: no screen, no council, no per-position exits. Level
i buys when the mark is at or below its price and holds nothing; its lot
sells one level up and the level re-arms. Seeding is the same rule: on the
first tick every level above the mark buys at the mark. Several levels can
fill in one tick (paced at 20). A lot's level rides its signal key. The
composer reads a grid sentence into the block (`readGridPlan`), asks for a
range or a market when one is missing, and drops a range the model invented.

**Frontend (this repo).** A Rules / Grid switch at the top of step 02 on a
single spot token; a grid card (range, levels, spacing, per level,
allocation, take-profit, range stop, cycle) that states what the narrowest
level earns a cycle and what the ladder holds fully filled; a composed grid
sentence flips the switch and fills the card; the review shows the ladder in
one line; the agent page (desktop and mobile) draws the ladder — held levels
with their sell price, empty levels with their buy price, the mark among
them; the edit page edits the ladder in place.

**Not yet.** Resting limit orders (fills are at the mark each cycle, which
the card says); a grid on a perp market; Bollinger-derived spacing.

## The plan, in order

1. **A coverage harness (2 days) — done.** The thirty-nine phrases above are the
   seed corpus, plus ~100 more in the shapes MQL5 / Pine users write. Run
   through the composer with the real model on every deploy; report refusal
   rate and the refused list. This is the number to move.
2. **Kill the false refusals (2 days) — done.** Aliases and evidence regexes for
   the phrasings above (volume per candle with a timeframe named, "reaches
   MA n", "closes above the top band", TP/SL/trailing stated as "sell when",
   market cap "at entry", "buy $X every hour" → schedule add plan), worked
   examples in the prompt for each, and the harness to prove it. Expected
   to remove a fifth of all refusals without a new key.
3. **Grid / DCA as a strategy type (1–2 weeks) — shipped 14 Sep 2026, see below.** Levels between two prices,
   fixed or progressive spacing, allocation per level, weighted average
   entry, basket take-profit on the whole ladder, "cumulative range covered"
   as the stop. A different executor, not a rule; the composer routes a grid
   sentence to it. The largest ask in the ledger.
4. **Volatility-change and bar-change keys (1 day) — shipped 14 Sep 2026:** barChangePct / barChangePctMin (the last closed bar's move) and volatilityChangePct / volatilityChangePctMax (ATR now against five bars ago). "Price went up 1%" with no window is the last bar; "volatility up 20%" is the ATR change. ATR / bandwidth change
   over N bars, current-bar change.
5. **Parameterised indicators (3 days) — shipped 14 Sep 2026.** The rule carries `period` (RSI, ATR, ADX, CCI, MFI, stochastic, Bollinger, the MA-distance keys, VWAP, volatility change), `periods` [fast, slow] on the MA pair keys, and `deviations` on Bollinger; the key stays the family and the battery emits the parameterised reading beside the default. The builder chip has a period box; the composer sets a period the sentence names instead of refusing it. Period on RSI, MA pairs, Bollinger,
   ATR; middle band as SMA 20. The battery computes from bars already; the
   change is the key grammar, the catalogue and the builder's chips.
6. **Windows and breakouts (2 days).** Change over any window, new high /
   low over N bars, cross-above / below over any two series.
7. **Session and calendar facts (half a day).** Hour, weekday, timezone.
8. **Candle patterns (2 days).** Engulfing, pin bar, doji, inside bar.
9. **Cross-asset facts (2 days).** BTC / SOL trend and relative strength.
10. **Multi-timeframe (1 week).** A second series per market, facts keyed by
    timeframe, "on the 1h" in the composer.
11. **Perp state history (1 day).** OI, funding, borrow per tick so change
    keys exist.

Data: nothing above needs a new paid provider. Items 2, 4–9 run on the
candles already stored; item 10 needs more candle storage from the same
sources; item 11 is our own reads. News and social signals ("founder post
about good news") are the one category with no data source at all and are
deliberately not on this list.

## What is not the problem

The catalogue is not small. Fifty-nine keys with groups, setups, ranking,
adds and eight exit kinds cover more than most retail bots offer. The
refusals come from three places, in this order: fixed periods and windows,
sentences the model maps wrongly, and gaps in what a given market can
answer. The harness in step 1 will say which of the three dominates; the
order above is my expectation, not a measurement.
