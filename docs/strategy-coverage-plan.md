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

## The plan, in order

1. **A coverage harness (2 days).** A corpus of ~150 real strategy sentences,
   drawn from the demand ledger and from how MQL5 / Pine users describe
   strategies, run through the composer with the real model on every deploy.
   Output: refusal rate, the list of refused phrases, and any drift. This is
   the number to move; without it every fix is anecdotal.
2. **Parameterised indicators (3 days).** Period on RSI, SMA/EMA pairs,
   Bollinger, ATR, ADX, Stochastic. The battery computes from bars already;
   the change is the key grammar (`rsi14` becomes `rsi` with a `period`),
   the composer's catalogue and prompt, and the builder's chips. This alone
   removes the largest class of refusal.
3. **Windows and breakouts (2 days).** `changePct` over any window,
   bar-change, new-high / new-low over N bars, generic cross-above /
   cross-below over any two series. Needs the candle store to keep more bars
   than 120 for long windows at small bar sizes.
4. **Session and calendar facts (half a day).** Hour, weekday, timezone.
5. **Candle patterns (2 days).** Engulfing, pin bar, doji, inside bar, from
   OHLC. Composer aliases for the common names.
6. **Cross-asset facts (2 days).** BTC and SOL trend and relative strength
   for every token; the bars are already fetched for perps.
7. **Multi-timeframe (1 week).** A second series per market, facts keyed by
   timeframe, the composer able to say "on the daily". The biggest change
   and the one that makes the "1h entry, daily trend" strategy possible.
8. **Perp state history (1 day).** Persist OI, funding and borrow per tick so
   change keys exist for them.
9. **Grid / DCA execution (1 week).** Not a rule; a strategy type. Highest
   demand per the gap study.

Data: nothing above needs a new paid provider. Items 2–6 run on the candles
already stored; item 7 needs more candle storage (the same sources, more
rows); item 8 is our own reads. The one provider gap worth research is order
book depth for spot on an order-book venue, which no rule needs yet.

## What is not the problem

The catalogue is not small. Fifty-nine keys with groups, setups, ranking,
adds and eight exit kinds cover more than most retail bots offer. The
refusals come from three places, in this order: fixed periods and windows,
sentences the model maps wrongly, and gaps in what a given market can
answer. The harness in step 1 will say which of the three dominates; the
order above is my expectation, not a measurement.
