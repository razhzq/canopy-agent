# Perps in the agent builder

Status: agreed 13 Sep 2026. Decisions taken by the founder are marked **[decided]**.
Backend venue module lands first; this document is the contract the frontend
and the rule catalogue in canopy-be both build against.

## What changes, in one paragraph

A perp is a market row, like every other market. Its venue follows from the
row, like every other market. What is new is that a perp market has a side, a
leverage, and a liquidation price, and the strategy has to say when to go long
and when to go short. So step 01 gains a switch that changes which universe the
picker shows, step 02 gains a second rule block and a leverage control when the
picked market is a perp, and the review rail gains four rows. Nothing about
spot changes.

## Step 01 — market

**[decided]** A **Spot / Perps** switch sits above the class chips. It is the
first control on the screen because it changes what the rest of the screen
lists; the chips, the venue filter and the list all re-read from it.

Switching resets the picked market and the discovery spec. The agent name,
model and any step-02 draft carry over. A SOL spot pick is not a SOL-PERP pick,
so the pick is dropped, and the draft records `instrument: "perp"` so a reload
restores the same universe.

In Perps mode:

- Class chips stay. SOL-PERP admits under Token; a Pacifica or Flash equity
  perp will admit under Stocks. The partition rule holds: one class, one
  specialist, and the perps specialist is a fourth one.
- The venue filter lists perp venues only: **Jupiter Perps** now, Pacifica
  later. It is the same second axis the spot picker already draws.
- Discovery is hidden. There is nothing to discover in a universe of three.
- Rows read: symbol `SOL-PERP`, venue, oracle price, 24h volume, max leverage,
  borrow rate for longs, borrow rate for shorts, pool utilization. The three
  borrow and utilization columns are the numbers a perp trader reads before
  entering; a spot row has no equivalent, and pool depth has no meaning here.

### Market row

`UniverseAsset` gains a third kind. Rows of this kind carry the venue's live
parameters so the picker and step 02 can compute liquidation distance without
another request.

```ts
kind: "rwa" | "crypto" | "perp";
venue?: "jupiter" | "kalqix" | "phantx" | "jupiter-perps" | "pacifica";
perp?: {
  underlying: string;            // "SOL"
  maxLeverage: number;           // venue cap, 250 on Jupiter today
  minCollateralUsd: number;      // 10 on Jupiter
  maintenanceMarginPct: number;  // 0.2 on Jupiter (size / 500)
  borrowAprLongPct: number;      // live, from the traded-asset custody curve
  borrowAprShortPct: number;     // live, from the stablecoin custody curve
  utilizationPct: number;        // of the traded-asset pool
  volume24hUsd: number | null;
  collateral: { long: string; short: string }; // "SOL" / "USDC"
};
```

Identity is the namespaced mint `perp:<venue>:<market>` (e.g.
`perp:jupiter:SOL`), the same convention KalqiX rows use. A saved selection
stores `{ kind: "crypto", mint: "perp:jupiter:SOL" }` — the backend's
selection normaliser keeps that shape unchanged, and every backend reader
tells a perp from a token by the prefix (`isPerpMint`). The picker row's
`venue` reads `jupiter-perps`.

## Step 02 — limits

Every control below appears only when the picked market is a perp. The spot
screen is untouched.

### Direction and rules

**[decided]** Both directions from day one. The composer renders two rule
blocks, each with its own enable toggle:

- **Go long when** — this is the existing `rules`, `anyOf` and `setup`. Nothing
  moves, so every saved spot draft still parses.
- **Go short when** — a second composer instance stored under `perp.short`,
  with the same shape and the same catalogue. A disabled block stores nothing.

A rule key means the same thing on both sides; only the operator flips. The
composer's presets (quality, averse, opportunistic) apply per block.

`exitWhen` is per side, because an indicator exit for a long is an entry signal
for a short. Take-profit, stop-loss, trailing and breakeven stay shared: they
are moves against the position, and a move against a short is a rise.

One new control settles what happens when the other side's rules fire while a
position is open. **On opposite signal:** `hold` / `close` / `flip`. Default
`close`. `hold` is legal on Jupiter, where long and short are separate
positions, and yields a hedge; the UI says so under the option. `flip` closes
and opens in one cycle and pays two sets of fees, which the review rail states.

### Leverage

**[decided]** The user picks the leverage. Not a cap Canopy imposes.

- A stepper with presets 1.5×, 2×, 3×, 5×, 10×, 20× and a free field up to the
  row's `maxLeverage`. Default 2×.
- Beside it, one line computed from the venue's maintenance formula:
  “Liquidates at −44% from entry” — recomputed on every change. The tone turns
  amber above 5× and red above 20×. There is no confirmation dialog; the number
  is the warning.
- Above 20× the presets end and the user types. That is the only friction.

Liquidation distance for the line, with `L` leverage, `m` maintenance margin
as a fraction, `f` round-trip fees as a fraction of size:

```
distance = 1/L − m − f
```

On Jupiter `m` is 0.002 and `f` is about 0.0013 plus impact.

### Sizing

The existing max-position field becomes **collateral** on a perp market, with
a second, read-only figure beside it: notional = collateral × leverage. The
sizing base does not change meaning underneath spot users, and collateral is
what the wallet-percent sizing already measures. The field's minimum is the
row's `minCollateralUsd`.

### Exits

Take-profit and stop-loss stay as percentage moves in price. Beside each, the
effect on collateral at the chosen leverage: “−5% price is −10% on collateral
at 2×”. The stop must sit inside the liquidation distance; the composer refuses
a stop that does not, with the distance in the message.

The venue's own keeper stop is always placed as the hard backstop at the
user's stop-loss. Canopy's exit rules are the soft layer that runs on the
cycle. The review rail states both.

### New risk caps

Two, in the existing Risk caps section:

- **Skip entries when borrow rate is above** N% a year. Default 40 for longs,
  which is above the Jupiter SOL target rate and below its ceiling.
- **Keep the stop at least** N× ATR **inside liquidation**. Default 1.5.

### Compliance

**[decided]** Unchanged. The compliance profile is not gated on the instrument;
perps ignore it.

### Cadence

Unchanged. The 1-minute cadence is allowed on perps; the cost floor that ruled
it out on AMM spot does not apply at a 14 bps round trip.

## Review rail

Added rows, all pointing at step 02 except routing:

| Row | Value | Step |
|---|---|---|
| Direction | Long · Short · Long and short | 02 |
| Leverage | 3× · liquidates at −31% | 02 |
| Collateral · Notional | $500 · $1,500 | 02 |
| On opposite signal | Close | 02 |
| Routing | Jupiter Perps | 01 |

Take-profit and stop-loss rows gain the collateral effect in parentheses.

## After creation

- **Funding** says which token the agent needs. In the first cut that is
  **USDC for both sides** — the backend posts USDC as collateral on every
  open and lets Jupiter swap it to the traded token inside the request for a
  long, because accepting native SOL would need the System program on the
  wallet's allow-list — plus a small SOL float for request-account rent.
  Sponsorship covers fees, not rent. The row's `collateral` block still says
  what the venue holds, for the positions table.
- **Delegation.** None new on Solana. Pacifica will need an agent-key grant,
  and `grantClobDelegation` is already that shape.
- **Agent page.** The positions table gains side, leverage, entry, mark,
  liquidation price, borrow paid and PnL after fees. Close-position gains a
  partial size. Unrealised is marked from the venue's position read, never from
  the equity curve.

## Draft and limits model

```ts
// Draft
instrument: "spot" | "perp";   // v2 drafts; a v1 draft reads as "spot"

// Limits
perp?: {
  leverage: number;
  short?: {
    rules: RuleSpec[];
    anyOf?: DetectionRule[][];
    setup?: SetupSpec;
    exitWhen?: ExitRules["exitWhen"];
  };
  longEnabled: boolean;          // false = short-only agent
  onOppositeSignal: "hold" | "close" | "flip";
  maxBorrowAprPct?: number;
  liquidationBufferAtr?: number;
};
```

`rules`, `anyOf`, `setup` and `exits.exitWhen` on `Limits` are the long side.
When `longEnabled` is false they are ignored by the engine but kept in the
draft so re-enabling restores them.

## Backend contract (landed, CANOPY_108)

The strategy create and edit routes accept a top-level `perp` block; the
composer accepts the same block on a raw draft. Shape, from
`@canopy/agent-contracts` `PerpConfig`:

```ts
perp: {
  leverage: number;                 // clamped 1.1–250; clamp is reported as adjusted
  longEnabled: boolean;             // false = short-only; long rules kept, ignored
  short?: {                         // absent = no short side
    rules: DetectionRule[];
    anyOf?: DetectionRule[][];
    setup?: SetupSpec;
    exitWhen?: DetectionRule[];
  };
  onOppositeSignal: "hold" | "close" | "flip";   // default close
  maxBorrowAprPct?: number;         // 0–500
  liquidationBufferAtr?: number;    // 0–10
}
```

The long side is the existing top-level `rules`, `anyOf`, `setup` and
`exits.exitWhen`. A block where neither side can trade is refused by the
edit route and dropped with a note by the composer. The `Limits.perp` draft
model above maps onto this one to one.

Perp-only reading keys in the catalogue, with en labels in the composer:
`borrowAprPct` (≤), `utilizationPct` (≤), `fundingRateHourlyPct` (≤),
`fundingRateHourlyPctMin` (≥), `openInterestImbalancePct` (≤). The builder
catalogue must carry the same five with en + zh strings. They are served by
the perps specialist, which does not exist yet: a rule on one of them rejects
every candidate until it does, so the builder should show them only on a
perp market.

## Out of scope for the first cut

Trailing stops placed at the venue, TWAP entries, cross margin, and any venue
other than Jupiter Perps. All are Pacifica features and arrive with that venue.
