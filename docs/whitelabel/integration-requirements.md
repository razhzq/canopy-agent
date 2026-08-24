# Integration Requirements — Canopy Agent Stack on Your DEX

**Audience:** the partner's engineering team
**Companion to:** `partner-brief.md` (commercial)
**Version:** 2026-08-24

This is the technical annex. It lists everything we need from you to point the
agent stack at your markets, in the order we need it, with the shape we need it
in and what breaks if it is missing.

**The short version:** paper trading needs three things from you — a market
list, a price feed, and OHLCV bars. Live trading needs four more — a quote/route
API, an execution path, an RPC endpoint, and your fee and size rules. Everything
else on this list is brand, identity and billing plumbing that is quick by
comparison.

---

## 0. Integration surfaces at a glance

| # | Surface | Needed for | Effort if you already have it | If you don't |
|---|---|---|---|---|
| A | Market / listing feed | Paper + live | Low | We index it — scope item |
| B | Price & liquidity marks | Paper + live | Low | Blocking |
| C | Historical OHLCV bars | Paper + live | Low | We index it — scope item |
| D | Quote / routing API | **Live only** | Medium | Blocking for live |
| E | Execution & fill confirmation | **Live only** | Medium–High | Blocking for live |
| F | Chain access (RPC) | **Live only** | Low | Blocking for live |
| G | Fee schedule & size rules | **Live only** | Low | Blocking for live |
| H | Identity / sign-in | Launch | Medium | We run standalone accounts |
| I | Agent wallet provisioning | **Live only** | Low (we handle) | — |
| J | Payment provider | Launch | Low | Blocking for revenue |
| K | Brand, domain, TLS | Launch | Low | Blocking |
| L | Ops contacts, limits, testnet | Launch | Low | Painful |

Surfaces A, B and C alone get your team running agents on your real markets in
paper. That is deliberately the staging milestone in the delivery plan — you see
the product working on your own listings before any execution work starts.

---

## A. Market / listing feed

This is the asset list swap. It is the single most important input, because it
defines what every agent on your platform is allowed to look at.

### A.1 What we need per market

| Field | Required | Notes |
|---|---|---|
| `chain` | **Yes** | Which chain it settles on. Load-bearing — see A.3 |
| `address` / `mint` | **Yes** | The on-chain identity of the asset. This IS the identity, not the symbol |
| `symbol` | **Yes** | Ticker |
| `name` | **Yes** | Full name. See A.4 — this is not cosmetic |
| `decimals` | **Yes** | Token decimals |
| `venue` / `router` | **Yes** | Which of your venues fills it, if you run more than one |
| `assetClass` | **Yes** | `token`, `equity`, `etf`, `commodity` — drives which screens apply |
| `calendar` | **Yes** | `crypto` (24/7) or a market calendar. The Desk refuses to open a cycle on a closed market |
| `priceUsd` | **Yes** | Current mark. Null is acceptable and means "could not be priced" |
| `liquidityUsd` | **Yes** | Pool depth or book depth — **not** traded volume. Used for sizing and for rug screening |
| `changePct` | Preferred | Daily close-to-close. Not a rolling 24h — say which you are sending |
| `iconUrl` | Preferred | Logo. Absent falls back to a generated mark |
| `tier` | Preferred | Your listing quality classification — see A.5 |
| `poolAddress` | Preferred | For AMM markets |
| `aliases` | Optional | Alternative tickers, for search |
| `refreshedAt` | **Yes** | When this row was last recomputed. We will not trade on a stale universe |

For tokenised real-world assets, we additionally need `underlying` (the ticker
the wrapper tracks) and `issuer` (who wrapped it), because an RWA pick is
*intent* — "gold, from this issuer" — and the address is resolved fresh from
that intent at every boot. That is what stops a stored pick from silently
pointing at a different contract later.

### A.2 Delivery

- **Transport:** HTTPS `GET`, JSON. A signed URL or a bearer key is fine.
- **Auth:** tell us the scheme. Server-to-server only — this is never called
  from a browser.
- **Shape:** one array, or paginated with a cursor. Tell us the expected row
  count so we can size the sweep.
- **Refresh cadence:** how often does this change, and how often may we poll?
  We resolve the universe at boot and cache it briefly. A push/webhook on
  listing changes is nice, not required.
- **Rate limit:** the number, in requests per minute, and what you return when
  we exceed it.
- **Staging:** a testnet or sandbox instance of the same feed. See L.

### A.3 Chain is not optional

If you list the same asset on more than one chain — a wrapped ETH on one and a
native ETH on another — the chain is the **only** thing that distinguishes them.
We key every asset on `(chain, address)` end to end. A row that omits the chain
is ambiguous to the executor in exactly the way it is to a person reading two
identical lines, and we will reject the feed rather than guess.

Execution dispatches on the chain alone. An unrecognised chain refuses the fill;
it never falls through to a default.

### A.4 Duplicate symbols are normal and must be survivable

Our current universe holds three tokens called CAT and two each of DOG, GOLD and
WOJAK. Keying on the address makes that harmless to the engine and does nothing
at all for a person reading two identical rows in the picker. That is why `name`
is required rather than nice-to-have.

### A.5 Listing tier

If you classify your listings by how much is known about them — verified issuer,
listed, permissionless pool — send it. The Analyst uses it as a rug-check input
and the picker shows it to the user. If you have no such classification we will
either derive one or the screen is dropped; both are fine, but we should agree
which before launch rather than discover it in staging.

---

## B. Price and liquidity marks

Marks are read at least twice per cycle: once when the Analyst screens the
universe, and once when the Portfolio Manager marks the book to decide what to
close. Unrealised P&L is computed from live marks, never inferred from the
equity curve.

**We need:**

- A price per market, in USD or in your quote asset with a conversion we can
  reach.
- Depth or liquidity per market.
- A batch endpoint: give us fifty addresses, get fifty marks. Fifty round trips
  per cycle per agent does not scale and will hit your rate limit.
- An explicit staleness signal — a timestamp per mark, or a documented max age.
  A mark with no age is a mark we have to treat as untrustworthy.
- Behaviour when a market cannot be priced. Null is a fine answer. A silently
  stale last-known price is not, and we will treat it as an incident.

If your feed in section A already carries `priceUsd` and `liquidityUsd` at a
sufficient refresh rate, this is the same endpoint and there is nothing extra to
build.

---

## C. Historical OHLCV bars

The Analyst's technical rules — momentum, RSI, ATR, Bollinger bandwidth, moving
averages — are measured on bars, and a strategy declares which timeframe it runs
on.

**We need:**

- **Timeframes:** `5m`, `15m`, `30m`, `1h`, `1d`. If you can only serve some,
  tell us which and we will restrict what strategy authors can select on your
  platform rather than let them build something that cannot run.
- **Depth:** at least **200 bars** per market per timeframe. Indicators need a
  warm-up window; our readout quotes "120 bars" as the typical working set and
  the longer lookbacks need more. Fewer than the warm-up and the asset is simply
  dropped from screening with a reason, which is correct but not what you want
  to happen to your whole listing set.
- **Fields:** open, high, low, close, volume, and the bar's open timestamp.
- **Batch:** one request, many markets, or at minimum a high enough rate limit
  to sweep the universe within one cycle.

**If you do not have a candle API,** this is the most common gap and it is
solvable: we index your fills into bars ourselves. It is a scoped line item in
the setup fee and it adds indexing to the backend VM's job, which affects the
maintenance figure. Flag it early — it is the single item most likely to move
the quote.

---

## D. Quote / routing API — live only

Before any trade, the Risk Officer sizes it and the Trader needs to know what
the market will actually give back.

**We need a quote call taking:**

- input asset, output asset
- amount in (or amount out, if you support exact-out)
- slippage tolerance in basis points

**And returning:**

- expected amount out
- effective price
- price impact
- the route taken, if you aggregate
- fees applied
- a validity window or quote id, if the quote is binding

A quote is the price/depth pair, not a published fee schedule. Both matter and
they are different things — see G.

---

## E. Execution and fill confirmation — live only

The part that actually moves money. Two shapes work, and we need to know which
one you are.

### E.1 Shape 1 — unsigned transaction

You return a serialised, unsigned transaction; we sign it with the agent's
wallet and submit. This is the AMM/aggregator model.

**We need:** the build-transaction endpoint, the serialisation format, which
accounts or approvals must exist beforehand, and who pays gas.

### E.2 Shape 2 — order placement

You expose an order API and hold the book. This is the CLOB model.

**We need:** place, cancel, and query-status endpoints; the order types you
support (market, limit, IOC, FOK); how the agent authenticates as an account;
and how funds are held — does the agent wallet need a deposit into a venue
account, or does it trade from its own balance? The answer changes the funding
step of the deploy wizard.

### E.3 Required either way

- **Idempotency.** A client-supplied key, honoured. If we retry a submission
  after a timeout we must not double-fill. This is non-negotiable and it is the
  first thing we test in staging.
- **Fill confirmation** carrying: filled quantity, average price, fees paid,
  venue, execution timestamp, and a venue-side id. All of it is written into the
  audit trail and shown to the user, so anything you cannot report is a gap on
  the record.
- **Partial fills.** Tell us how they are reported and how a remainder is
  handled.
- **Failure semantics.** Which errors are retryable and which are terminal. An
  ambiguous timeout is the dangerous case: we need a way to ask "did this
  actually land?" and get a definitive answer.
- **Close/exit path.** Users close positions manually and the drawdown breaker
  liquidates automatically. Both go through the same path, and the breaker's
  path must work when the market is thin — that is when it fires.

---

## F. Chain access — live only

- **RPC endpoint** for each chain you settle on, with enough throughput for
  balance reads and transaction submission across all live agents.
- **It must accept datacenter egress.** Public endpoints frequently do not.
  Our own build carries a fallback path and a server-side proxy specifically
  because a public Solana endpoint returns `403` to anything carrying an
  `Origin` header and rate-limits cloud IPs far harder than residential ones.
  Assume we will need a paid or dedicated endpoint and budget for it — it is a
  small line, but it is a real one.
- **Quote/collateral token:** the address and decimals of the token agents fund
  and settle in. We do not hardcode "which USDC" — the backend reports it,
  because that question has wrong answers.
- **Gas token floor:** the minimum native balance an agent wallet must hold to
  transact. We enforce it before allowing an agent to go live, and the funding
  screen tells the user the shortfall in the same sentence the scheduler would
  pause with.
- **Account/ATA creation:** whether receiving a new asset costs rent or a
  creation transaction, and how much.

---

## G. Fee schedule and size rules — live only

| Item | Why we need it |
|---|---|
| Taker fee, per market or flat | Quoted to the user before deploy, and shown on every fill |
| Maker fee, if a CLOB | Same |
| Minimum order size | The Risk Officer refuses a plan below it rather than submitting a doomed order |
| Tick size / lot size | Sizing is rounded to your rules, not ours |
| Maximum order size or per-market caps | Position sizing respects them |
| Any fee tiering by volume or account | Affects the mark shown on the record |

If a venue publishes no flat schedule, say so and we will show nothing rather
than invent a number with a percent sign on it. An invented fee on an audit
trail is worse than a blank.

---

## H. Identity and sign-in

Three options, cheapest first:

1. **Standalone accounts.** We run sign-in ourselves. Zero work for you, but
   your user signs in twice and the products feel like two products. We do not
   recommend it beyond a pilot.
2. **Your existing auth.** We verify your tokens. **We need:** the issuer, the
   JWKS URL, which claim carries the stable user id, token lifetime, and
   whether you can mint a token scoped to the agent product. This is the usual
   answer and it is what makes a user signed in on your exchange the same user
   here, owning the same agents.
3. **Shared embedded-wallet provider.** If you already use one, we point at the
   same app id and identity is single across both products by construction.

Whichever it is, we need to agree the mapping from your user id to an agent
account **before** anyone deploys an agent, because it is the join key for every
agent, position and subscription afterwards. Changing it later is a migration,
not a config edit.

---

## I. Agent wallet provisioning — live only

We handle this and it is listed so you know what will exist in your ecosystem.

Each agent gets its own wallet. The signing key never leaves the backend
enclave and is bound to a policy the wallet provider enforces, so the agent's
authority is capped independently of our code being correct. The user grants
that signer explicitly, scoped to the mandate's expiry — when the mandate
lapses, the authority lapses with it. A grant naming the wrong signer registers
nothing rather than falling back to custody.

**What we need from you:** confirmation that your chain is supported by the
wallet provider you want used, and whether you want agent wallets under your
own wallet infrastructure or ours. If yours, we need the provisioning and
policy APIs and this becomes a scoped integration.

---

## J. Payment provider

The subscription revenue lands in **your** account, so the provider account is
yours.

**We need:**

- Which provider, and an account we can configure against
- Whether you are collecting card, crypto, or both
- Currencies
- A webhook we can receive, or confirmation we may poll — note that a
  subscription only exists after a human finishes paying on the provider's own
  page, so the return-from-checkout moment needs an explicit re-check rather
  than a hopeful reload
- Your tax and invoicing requirements

---

## K. Brand, domain, TLS

- Logo in SVG, light and dark variants
- Palette — or let us derive one; the theme is a single token file
- Typefaces and their licences
- The subdomain, plus DNS control or a CNAME target
- TLS handled by us unless you require your own certificate
- Any legal copy you need carried: terms, risk disclosure, jurisdiction notices

---

## L. Operations

- **Environments:** a testnet or sandbox for every surface above. Integrating
  execution against production first is not something we will do.
- **Rate limits:** the actual numbers, per surface, and what you return when we
  cross them.
- **Status and incidents:** a status page or a channel, and who to contact at
  3am. Also: what you expect from *us* when the agent platform is degraded.
- **Change notice:** how much warning we get before a breaking API change or a
  delisting. A delisted market with open agent positions needs a defined
  handling path, and it should be defined before it happens.
- **Contacts:** one engineering, one commercial, on both sides.

---

## The realistic critical path

Ranked by how often each one is what actually delays a launch:

1. **OHLCV bars (C).** Most DEXs do not have a candle API. Answer this first.
2. **Execution idempotency and definitive fill status (E.3).** Not hard, but
   frequently absent, and it is the one gap we will not launch live without.
3. **Identity mapping (H).** Cheap to build, expensive to change afterwards.
4. **Chain-qualified market identity (A.3).** If your feed is symbol-keyed
   rather than address-keyed, that is a change on your side.
5. **A usable RPC endpoint (F).** Small line item, routinely forgotten.

Send us A, B and C and we can have your markets in a paper-trading staging
environment quickly. Everything else can proceed in parallel from there.
