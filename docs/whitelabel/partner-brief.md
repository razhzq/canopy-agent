# Canopy Agent Stack — Whitelabel Partner Brief

**For:** prospective DEX partners
**Status:** commercial draft — figures marked `[TBD]` are set per deal
**Version:** 2026-08-24

---

## 1. The offer in one paragraph

Your users can already swap on your DEX. They cannot yet **hire something that
trades for them.** The Canopy Agent Stack is a production trading-agent product
— marketplace, deploy wizard, per-agent wallet with hard caps, a five-seat
reasoning council that writes an audit trail every cycle, and a monitoring
surface — that we run under **your brand, on your markets, on your domain.** You
do not build it, you do not staff it, and you do not run the GPUs. You set the
subscription price your users pay and you keep the revenue. We charge a one-time
setup fee and a monthly maintenance fee.

Time from signed contract to your users deploying agents: **[TBD — target 4–6
weeks].**

---

## 2. What your users get

### 2.1 A marketplace of strategies

An Explore surface where published strategies are listed with their real record
— realised return, 30-day return, hit rate, drawdown — not a backtest slide.
Anyone can fork a listed strategy into their own agent in one action. Authors
publish; the platform gates publication behind a verification check and a
completed paper run, so nothing reaches your marketplace on a claim alone.

### 2.2 A deploy wizard that ends in a funded, constrained agent

Five steps, each one a decision the user actually has to make:

| Step | What the user settles |
|---|---|
| **Describe** | Plain-language prompt → a drafted strategy. Or pick a market list by hand. |
| **Constraints** | Max position size, max drawdown breaker, trades per cycle, allow/deny lists, compliance screen |
| **Autonomy** | `propose_only` (agent asks, human approves) or `execute_with_caps` (agent trades inside the caps) |
| **Wallet** | A dedicated agent wallet is provisioned; the user grants a scoped, policy-enforced signer |
| **Fund** | Deposit. QR, address, or transfer from the user's personal wallet |

The mandate carries an **expiry**. No agent runs forever unattended, and the
wallet delegation is scoped to the same clock — when the mandate lapses, the
signing authority lapses with it.

### 2.3 Reasoning your users can read

Every cycle, five seats speak in order and each one writes a row before the
agent acts:

| Seat | Job |
|---|---|
| **The Desk** | Opens the cycle and checks the agent is fit to run |
| **The Analyst** | Screens the universe, then reasons over what survived |
| **The Risk Officer** | The gate — sizes or refuses every plan |
| **The Trader** | Executes what the gate approved |
| **The Portfolio Manager** | Marks the book and decides what to close |

Those rows *are* the audit trail. The product renders them two ways — a
narrative activity log on the agent page, and a forensic cycle transcript with
the raw JSON underneath. Nothing is interpreted or editorialised; every line
restates one field the engine recorded. When a user asks "why did it sell my
position at 11:04," there is a page that answers, with the model, the latency
and the cost of each seat's turn on it.

This is the single hardest thing to build in this category and it is the reason
the product survives contact with a sceptical user.

### 2.4 Risk that is enforced, not advertised

- **Position ceiling** — most the agent may put into any one position
- **Drawdown breaker** — past a set fall from the high-water mark the agent stops
  opening and liquidates; the status changes to `liquidating` and the reason is
  written by the breaker, not by a human
- **Exit rules** — take-profit, stop-loss, trailing stop, breakeven-after,
  laddered scale-outs, max hold days
- **Paper book vs live book** — strictly separated everywhere: equity curve,
  cycles, fills. A paper cycle never appears inside a live record
- **Compliance screens** — a Shariah screen ships today; others are a rules
  addition, not an architecture change
- **Signing policy** — the agent's key never leaves the backend enclave and is
  bound to a policy the wallet provider enforces. A grant naming the wrong
  signer registers nothing. It fails closed

### 2.5 Monitoring, notifications, and a chat with the agent

Equity curve and drawdown, open positions marked live, fill history, a cycles
index, per-cycle transcripts, and an activity feed. Users can message their agent
in a thread; the agent can propose a change to its own mandate, which the user
applies or declines. Alerts in-app and over Telegram.

### 2.6 Shipped in English and Simplified Chinese

Full translation coverage including the narrated audit trail, with CJK font
fallbacks handled. Additional languages are a locale file, quoted separately.

---

## 3. What we swap for you

| Layer | Whitelabel treatment |
|---|---|
| **Markets / asset list** | Replaced with **your** listed markets. The universe is resolved server-side against your venue at every boot, so a stored pick can never drift to a different address |
| **Venue routing** | Your DEX becomes the fill venue for your chain. Multi-chain universes route per-asset; unknown chains refuse rather than guessing |
| **Brand** | Colours, type, logo, accent, login modal. Design tokens are declared in one place — a rebrand is a token file, not a sweep through sixteen pages |
| **Domain** | `agents.yourdex.com` or a path on your existing app |
| **Identity** | Your existing user accounts. One sign-in across your DEX and the agent product — a user already signed in on your exchange is the same user here, owning the same agents |
| **Fee schedule** | Your taker fee is what the agent quotes and what the record shows |
| **Copy & tone** | Product copy is centralised and editable, not scattered across components |

---

## 4. What you control — the three commercial levers

### 4.1 Lever 1 — the agent stack itself

Delivered whole. Marketplace, builder, deploy wizard, wallets, execution,
monitoring, notifications, admin. You are not receiving a demo to finish.

### 4.2 Lever 2 — the subscription model, priced by you

The billing layer is already built and already generalised: plans, per-user
entitlement, per-agent live subscriptions, hosted checkout, cancellation, and a
provider re-check for the moment after a user pays.

The shape we run today, as an example you are free to discard:

- **Paper agents** — free, and *earned* rather than sold. Every user gets a
  baseline allowance, plus one more for each person they invite. This is the
  growth loop: the way out of "no slots left" costs the user nothing and costs
  you a referral you wanted anyway.
- **Live agents** — a monthly subscription **per agent**, not per account. A
  user with three live agents pays three times. Upgrade pressure scales with
  the value they are getting.

**You set:** the plan names, the tiers, what each tier grants, the price, the
currency, the free allowance, the referral reward, and whether live is sold per
agent or per seat. You keep the subscription revenue. Changes take effect
without a code deploy.

> **Why per-agent, from our own numbers:** it removes the pricing-tier
> conversation entirely. There is no plan picker to design, no comparison table,
> and no user staring at four columns deciding which one they are. There is one
> thing to buy and its price is on the button.

### 4.3 Lever 3 — model selection, with your margin on top

Agents reason on managed GPU inference that we operate. Model access is metered
at our cost, and the admin portal lets you **set your own margin or upsell on
top of that cost, per model.**

That turns model choice into a product surface instead of a line item:

- A fast, cheap model on the entry tier
- A stronger model as a paid upgrade, at whatever multiple of cost you choose
- A premium model reserved for your highest tier or your market-maker accounts

The engine already records the model, latency and cost on every seat's decision
row, so per-model economics are measurable from day one rather than estimated.

> **Note:** the current build runs one model across all five seats. Per-agent
> model selection is a wiring point already scoped in the codebase, delivered as
> part of the whitelabel engagement together with the admin controls.

---

## 5. What runs where

```
   Your users
        │
        ▼
┌───────────────────────┐
│  Agent frontend       │   your brand, your domain
│  (edge-deployed)      │   negligible marginal cost
└───────────┬───────────┘
            │  authenticated API
            ▼
┌───────────────────────┐         ┌──────────────────────┐
│  Backend VM           │────────▶│  GPU inference server │
│  scheduler, council   │         │  the reasoning council│
│  runner, execution,   │         │  Cost line 1          │
│  billing, audit store │         └──────────────────────┘
│  Cost line 2          │
└───────────┬───────────┘
            │  fills
            ▼
      Your DEX / venue
```

**Two infrastructure cost lines, both operated by us:**

1. **GPU inference server** — where the council actually reasons. Scales with
   the number of live agents and their cycle frequency (cycles run anywhere from
   every 5 minutes to daily, set per agent).
2. **Backend VM** — the scheduler, the tick runner, execution, wallet
   orchestration, billing, and the audit store.

Under the managed arrangement you receive **one invoice.** You do not open cloud
accounts, you do not hold GPU capacity, and you do not get paged at 3am. Both
lines are passed through at cost plus a stated margin inside the maintenance
fee, so the arithmetic is visible to you rather than buried.

---

## 6. Commercials

### 6.1 Setup fee — one time

| Item | Fee |
|---|---|
| Whitelabel build: brand, domain, identity integration | `[TBD]` |
| Market/universe integration against your venue | `[TBD]` |
| Venue routing + fee schedule integration | `[TBD]` |
| Billing configuration + payment provider connection | `[TBD]` |
| Admin portal provisioning (subscription + model margin controls) | `[TBD]` |
| Production deployment, load validation, handover | `[TBD]` |
| **Total setup** | **`from $[TBD]`** |

### 6.2 Maintenance fee — monthly

| Item | Fee |
|---|---|
| GPU inference server (cost + margin, scales with live agents) | `[TBD]/mo` |
| Backend VM (cost + margin) | `[TBD]/mo` |
| Platform maintenance: updates, security patches, monitoring, on-call | `[TBD]/mo` |
| Support: `[TBD]` response SLA, `[TBD]` named contacts | `[TBD]/mo` |
| **Total maintenance** | **`from $[TBD]/mo`** |

Inference scales with usage. The base tier covers up to `[TBD]` concurrently
live agents; beyond that it steps in blocks of `[TBD]` at `[TBD]` each. You see
the utilisation in the admin portal before the invoice, never after.

### 6.3 What you earn

| Revenue line | Who sets the price | Who keeps it |
|---|---|---|
| Agent subscriptions | **You** | **You — 100%** |
| Model upgrade margin | **You** | **You — 100%** |
| Trading fees on agent flow | You (existing schedule) | **You — 100%** |

We take no revenue share, no percentage of your subscriptions, and no cut of
your trading fees. Our income is the setup fee and the maintenance fee, and it
is fixed and predictable for both sides.

### 6.4 Not included

Optional, quoted separately: additional languages beyond EN/ZH, new compliance
screens, custom strategy classes, non-EVM/non-Solana chain integrations,
white-glove user support delivered by us rather than your team, and a native
mobile shell.

---

## 7. Why agent flow is worth more than swap flow

- **It is recurring.** A swap is one event. An agent ticks on a schedule and
  keeps trading while the user sleeps.
- **It is sticky.** A user with a funded agent, a running record and an audit
  history does not migrate to another venue over a basis point.
- **It carries a subscription.** You add a software revenue line to a
  transaction-fee business — the multiple the market pays for those is not the
  same.
- **It brings its own referral loop.** The free-tier mechanic is invite-driven
  by construction.
- **It is a differentiator with a real moat.** The audit trail and the risk
  enforcement are the parts competitors cannot fake in a sprint, and they are
  already built.

---

## 8. Delivery

| Phase | Duration | What happens |
|---|---|---|
| **1. Scope** | `[TBD]` | Market list, brand assets, identity integration, billing provider, subscription design |
| **2. Integrate** | `[TBD]` | Universe swap, venue routing, brand tokens, domain, auth |
| **3. Staging** | `[TBD]` | Full stack live on paper trading; your team runs agents end to end |
| **4. Launch** | `[TBD]` | Live enabled, subscriptions on, admin portal handover, monitoring in place |

Paper trading works before live is switched on, so your team validates the
product against your real markets without a dollar at risk.

---

## 9. What we need from you

1. Your market/listing feed, or API access to it — the asset list swap, and the
   single most important input. The exact per-market fields, delivery shape and
   refresh expectations are in the technical annex, `integration-requirements.md`
2. Brand assets: logo, palette, type
3. The subdomain
4. Identity integration details — how your users sign in today
5. A payment provider account for subscription collection (yours, so the revenue
   lands with you)
6. One technical contact and one commercial contact

> **For your engineers:** `integration-requirements.md` is the full technical
> annex — twelve integration surfaces, what each one is needed for, and the
> realistic critical path. The short version: a market list, a price feed and
> OHLCV bars are enough to get your markets running in paper. Live trading adds
> a quote API, an execution path with idempotent submission and definitive fill
> status, chain RPC access, and your fee and size rules.

---

## 10. Common questions

**Is this our product or yours?**
It runs as yours. Your brand, your domain, your users, your subscription
revenue. We are the vendor operating it, and that relationship is not surfaced
to your users unless you want it to be.

**What if we want to bring it in-house later?**
Source and infrastructure handover terms are negotiable at contract time. Say so
early and we structure for it rather than around it.

**Can our users lose money?**
Yes — it is trading. Which is exactly why the caps, the drawdown breaker, the
scoped wallet delegation, the mandate expiry and the readable audit trail exist,
and why paper trading is the default before anything goes live. The product is
built so that when a user asks what happened, there is an answer on a page.

**What happens if the GPU server goes down?**
Cycles queue rather than fire on stale reasoning; no agent trades on a failed
council turn. Positions and their exit rules are unaffected — protective exits do
not depend on the inference layer.

**Can we run our own models?**
Yes, at additional integration scope. Most partners find the margin control on
managed inference gets them the economics they wanted without the operational
burden.

---

**Next step:** a 45-minute walkthrough on live agents, then a scoped quote with
`[TBD]` replaced by numbers.

`[contact — name, email]`
