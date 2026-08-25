# Canopy — Agentic stack for DEX trading

**Grant requested: 10,000 USDC**

---

## What is the problem you're trying to solve, and how are you going to solve it?

Everything built for onchain trading so far — charts, aggregators, scanners, AI copilots — assumes the user is present and skilled. It optimises the wrong step. Most people who want exposure to onchain markets are not going to become good traders, and no amount of better tooling changes that. They don't need a faster terminal. They need something competent trading on their behalf, on terms they set, that they can shut off from their phone.

The existing answers are all broken in the same place:

- **AI copilots.** A chat wrapper that suggests a trade you still have to size, route, and execute yourself. It moves the work around; it doesn't do the work.
- **Telegram signal groups and custodial bots.** You hand over keys and hope. No enforced risk ceiling, no record of why anything happened, no recourse.
- **DeFi vaults.** Real capital at work, but the strategy is a black box, the manager can't be evaluated before you deposit, and your exit is at their liquidity's mercy.

Every one of them asks you to trade custody or visibility for automation. That trade is not necessary.

### The solution

Canopy is where you build, fund, and run an autonomous trading agent that **never takes your keys, explains every decision it makes, and eventually pays for itself.**

**1. Custody stays with the user.** Deploying an agent means the user's own Privy session adds Canopy's signer to their embedded Solana wallet, bounded by a policy, a spend cap, and an expiry. Canopy's backend is not a party to that step and could not perform it. Our backend re-reads the delegation from Privy and refuses anything that doesn't match — so registration *records* authority rather than granting it. Revocation is unilateral and instant.

**2. Every tick is an audit trail.** An agent runs a council of five seats — the Desk opens the cycle, the Analyst screens and reasons, the Risk Officer sizes or refuses every plan, the Trader executes only what the gate approved, the Portfolio Manager marks the book. Each seat writes a decision row *before* the agent acts. The owner can read exactly why their capital moved, including the trades that were refused. Not a monthly letter — every cycle, live.

**3. The agent pays for its own thinking.** Inference is sold as prepaid token bundles, priced at an accepted rate ceiling: above that price the agent holds rather than paying more than its owner agreed. This is already how the product works, and it is the foundation of the tokenization milestone below — an agent with a treasury is an agent that keeps running without its owner topping it up.

**4. It runs unattended, so it belongs on a phone.** An agent that only trades while you're watching is a terminal with extra steps. The phone is the natural surface for an agent that doesn't stop: cycle notifications, breach alerts, position view, and a one-tap kill switch that revokes the delegation.

**5. The agent becomes an economic entity.** Each agent can launch a token. Token proceeds and a configured share of realised trading profit accrue to the agent's own treasury. The treasury's first claim is compute; above a threshold it provisions the agent's own machine. An agent that earns, saves, and buys the hardware it runs on is a different object than a script on our servers — and it is the strongest possible answer to "what happens if Canopy goes away."

### How we win

- **Non-custodial is architectural, not a policy.** We cannot move user funds, because the delegation the user grants is scoped, capped, and expiring, and it lives at Privy rather than with us. Competitors who custody can announce a policy; they can't hand you a revoke button that works without them.
- **Accountability compounds.** Every agent, every cycle, produces a signed decision record. Over time that's a performance dataset nobody can fabricate and no competitor can retroactively acquire — and it's what the leaderboard, the fees, and the token valuations all sit on.
- **Distribution exists.** Canopy shares one Privy app with the main DEX, so identity is single across products — an existing trader becomes an agent owner without a new account.
- **Mobile-first is a moat on Solana specifically.** Seeker ships with a dApp store and a hardware wallet. An autonomous agent with a hardware-backed kill switch on a crypto-native phone is a product that cannot be cloned onto a browser tab.

---

## Project Goals & Milestones

### Milestone 1 — Canopy mobile: App Store, Play Store, Seeker dApp Store ($3,000)

Agents run unattended. The phone is where you watch them and where you stop them.

- React Native / Expo client over the existing API surface — portfolio, live positions, cycle transcript, activity feed, notifications.
- Push notifications on the events that matter: position opened, risk gate refusal, drawdown breach, delegation nearing expiry, model balance low.
- **Kill switch from the lock screen.** One tap revokes the Privy delegation. No backend cooperation required.
- Solana Mobile integration on Seeker: Mobile Wallet Adapter and Seed Vault, so the delegation is granted and revoked against hardware-held keys.
- Ship to all three stores: Apple App Store, Google Play, Solana dApp Store.

**Done when:** the app is live and installable in all three stores; a user monitors a running agent, receives a push notification for a real onchain fill, and revokes the agent's delegation from the phone — verified by the agent's next cycle failing to sign.

### Milestone 2 — Agent tokenization and the hardware treasury ($2,500)

Turn an agent from a process we host into an entity that funds itself.

- **Per-agent token**, launched on Solana, with supply and distribution set at publish time by the agent's creator.
- **Agent treasury.** Token proceeds and a configured share of realised trading profit accrue to a treasury that belongs to the agent, not to Canopy.
- **Spend policy, in priority order.** The treasury's first claim is the agent's inference budget — it tops up its own prepaid bundles when the balance runs low, at the same accepted price ceiling the owner set. Surplus above a defined reserve accumulates toward hardware.
- **Hardware ladder.** At the first threshold the agent provisions a dedicated inference node it pays for out of treasury. At the second, it acquires the machine outright. Each procurement is executed from the treasury and recorded, and the machine's identity is bound to the agent so the ownership claim is checkable rather than announced.
- **Public treasury page** on every agent: balance, income by source, what it has bought, what it is saving for, and how many cycles of thinking it can currently afford.

**Done when:** an agent's token is live, its treasury takes in both token proceeds and a share of realised trading profit, it funds a full inference top-up with zero owner contribution, and it crosses the first hardware threshold — with the procurement paid from treasury and visible on the agent's public page.

*Scope note, stated plainly: outright ownership of physical hardware is the end state of this ladder, not something one grant period finishes. What this milestone commits to is the funding path proven end to end and the first machine acquired and bound to the agent.*

### Milestone 3 — Backtesting on real tick data ($2,500)

Today a strategy's only record is its live record. That's honest, but it makes the first step too expensive: nobody should have to risk capital to find out their idea has negative expectancy.

- **Subscribe to a tick-level market data feed** and build the ingestion pipeline that derives clean OHLCV from it — candidates under evaluation include Kaiko, Amberdata, Tardis.dev and Solana-native providers such as Birdeye. Aggregated free candles are unusable here: they hide the gaps, the wicks, and the low-liquidity prints that decide whether a strategy is real.
- **Deterministic replay.** The same five-seat council, the same risk gate, run against history with a point-in-time data view — no lookahead, no survivorship, no silently repaired bars.
- **Costs modelled from the real schedules.** Venue fees come from the published taker schedules already encoded per venue; slippage is modelled from book depth at the replayed timestamp, not assumed.
- **Backtests are labelled forever.** A simulated record carries a simulated stamp everywhere it appears and is never eligible for the live leaderboard. The one rule from day one holds: no live record, no listing.

**Done when:** a builder replays their strategy over at least 12 months of tick-derived OHLCV across Solana and Base markets, receives an equity curve, drawdown, and refusal log identical in shape to the live one, and that run is visibly stamped as simulated in every surface it appears in.

### Milestone 4 — Marketing, user acquisition, and public proof ($2,000)

- **Public demo:** a full recorded path — build an agent, grant the scoped delegation, fund it, watch it open a position on its own, read the council transcript, kill it from the phone.
- **Solana Mobile / Seeker channel:** launch coverage, dApp store listing assets, and a Seeker-specific onboarding path that uses Seed Vault from the first screen.
- **Creator and referral loop:** the referral system and invite gate already in the product, activated with a real incentive for the users who bring the first cohort of agent owners.
- **Localisation:** the product's i18n layer extended to the languages where retail onchain trading is densest, so acquisition isn't gated on English.
- **Content:** a short series on what an agent actually did — real cycles, real refusals, real drawdowns. The decision record is the marketing asset; nobody else can produce it.

**Done when:** the demo is public, the Seeker listing is live, and the acquisition channels have produced the agent-owner cohort the KPI below is measured against.

---

## Primary Key Performance Indicator

**Live capital under agent mandate** — the total capital being actively traded by autonomous Canopy agents under a scoped, unrevoked delegation, tracked weekly.

This is the number that proves the thesis. It cannot be inflated by engagement: it requires a user to grant signing authority against their own wallet, fund it, and *leave it there* while an agent trades unattended. Every incentive we have to fake it is defeated by the fact that the user can revoke in one tap.

**Target:** $100k of live capital under mandate across 100+ running agents by the end of the grant period, with median mandate age > 14 days.

**Secondary:**
- **Mobile monitoring share** — proportion of running agents whose owner opened the mobile app in the last 7 days. The kill switch is only real if people carry it.
- **Revoke rate within 72 hours of funding** — the earliest trust signal we have.
- **Self-funded ratio** — agents whose treasury covered their own inference costs with no owner top-up. This is the tokenization milestone's real scoreboard.
- **Backtest-to-live conversion** — builders who run a backtest and then fund a live agent. Proves Milestone 3 is a funnel and not a toy.

---

## Answers to review questions

### Proof of work, GitHub, team, demo

- **Repository:** `github.com/razhzq/canopy-agent` — 95 commits since 4 August 2026, ~72,000 lines of TypeScript/TSX.
- **What is already built and running:** the agent build wizard (describe → market universe → constraints → autonomy → wallet → fund → publish), the scoped Privy delegation grant and wallet audit surface, the five-seat council transcript and per-cycle activity feed, live positions and per-cycle equity marking, chain-aware venue routing, the prepaid inference bundle economy, notifications including Telegram linking, referral and invite gating, and a full i18n layer.
- **Demo:** *(insert link — recorded walkthrough of delegation → funded agent → onchain fill → council transcript)*
- **Team:** *(insert — names, prior work, Solana track record, who is full-time)*

### Is Canopy Solana-native or multi-chain?

**Solana-native, with a second settlement route rather than a second home.** Identity, custody, delegation, funding, the agent token, and the treasury are all Solana. Execution routes to the venue that can actually fill the market the agent was given: Jupiter and Canopy on Solana, and KalqiX on Base for listings that exist only there. Settlement dispatches on the asset's own chain and **refuses an unknown chain rather than defaulting to Solana** — a deliberate choice, because a wrong-chain default is a way to lose funds quietly. Base is a fill route for specific listings; everything that defines an agent lives on Solana.

### Regulatory thinking: agentic leverage and token baskets

Three distinct surfaces, and we treat them differently.

**Custody.** The core posture is that we never hold user funds, never pool them, and owe no redemption. The user's assets stay in the user's own wallet; our signer is a scoped, capped, expiring delegation the user can revoke without us. There is no fund, no unit, no NAV claim on Canopy, and no exit queue — which is what keeps this outside collective-investment-scheme territory in the jurisdictions that matter to us.

**Leverage.** Agents are spot-only today; leverage is not enabled. When it is, the control is structural rather than a disclaimer: the leverage ceiling is part of the agent's published mandate, the Risk Officer seat refuses any plan that exceeds it before the Trader ever sees it, and the delegation's spend cap bounds the worst case independently of our code being correct. We will gate leveraged agents by jurisdiction rather than ship them globally and apologise later.

**Token baskets.** An agent trading a basket of tokens is not an ETF and we will not let it be marketed as one: there are no creation or redemption units, no tracking promise, no claim on Canopy, and the assets sit in the user's own wallet, not in a wrapper. **Agent tokens are the surface that most needs counsel** — the design intent is a claim on the agent's own treasury and compute economy, not a revenue share in Canopy, and we will take formal legal review and geo-gate before any token launch under Milestone 2. We would rather state that openly here than discover it after issuance.

### How does Canopy compare to Elfa AI?

Different layers of the same stack. Elfa AI is an **information layer** — social and KOL sentiment intelligence over crypto Twitter, delivered as an API and dashboards; its output is a signal a human then has to act on. Canopy is an **execution layer** — it holds a scoped signing authority, sizes a position through a risk gate, routes it to a venue, and writes down why. Elfa tells you what the crowd is saying; Canopy takes the position and shows you the trade it refused to take.

They compose rather than compete: sentiment data of exactly Elfa's shape is a plausible input to the Analyst seat, and we would sooner integrate a feed like it than rebuild one. Nobody in the sentiment-intelligence category holds a delegation or produces a fill, and that is the part that is hard.
