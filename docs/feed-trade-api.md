# Feed + Trade: API contract (staging)

Shared contract between canopy-be (`staging`) and canopy-agent (`staging`).
All paths are under `/api`. Auth: `Authorization: Bearer <Privy token>`,
`requireInvitedUser` unless marked **public**. Solana only. Money in USD numbers,
prices in USD numbers, percents as numbers where `6` means 6%.

## Shared types

```ts
type TokenList = "crypto" | "trending" | "held" | "new" | "stocks";

interface TokenRow {
  mint: string; symbol: string; name: string; icon: string | null;
  priceUsd: number | null; change1hPct: number | null; change24hPct: number | null;
  marketCapUsd: number | null; volume24hUsd: number | null; liquidityUsd: number | null;
  holderCount: number | null; category: string | null;   // TOKEN_CATEGORIES value or "stock"
  createdAt: string | null;                               // pool created-at, ISO
}

interface SafetyCheck { key: "mint" | "freeze" | "lp" | "top10" | "dev";
  label: string; value: string; status: "ok" | "warn" | "bad" | "unknown"; }
interface Safety { score: number; checks: SafetyCheck[]; checkedAt: string | null; }
// score = sum(ok 20, warn 10, bad/unknown 0). top10: >35 bad, >25 warn. dev: >5 bad, >2 warn.
// Majors / stocks with deep liquidity: lp = ok "Deep · $X".

interface Candle { t: number; o: number; h: number; l: number; c: number; v: number } // t = unix seconds

type ExitPlanKey = "steady" | "swing" | "runner" | "flip" | "moon" | "manual";
interface ExitPlan {
  key: ExitPlanKey;
  takeProfitPct?: number;                        // single target
  scaleOut?: { atPct: number; fraction: number }[]; // ladder, fraction of remaining
  stopLossPct: number;
  breakevenAfterPct?: number; trailingStopPct?: number; maxHoldMinutes?: number;
}
// Presets (BE is source of truth, FE mirrors labels):
// steady: tp 6, sl 3            swing: scaleOut [5→.5, 10→1], sl 4, breakeven 5
// runner: scaleOut [30→.5, 80→1], sl 20, breakeven 30, maxHold 360
// flip: tp 15, sl 8, maxHold 60  moon: scaleOut [100→.5], trailing 25, sl 30
// Default plan: majors/stocks → steady, everything else → runner.

interface Position {
  id: string; mint: string; symbol: string; icon: string | null;
  entryPriceUsd: number; qty: number; costUsd: number; valueUsd: number; pnlUsd: number; pnlPct: number;
  takeProfitPriceUsd: number | null; stopPriceUsd: number | null;
  exitPlan: ExitPlan | null; source: string;     // "Manual" | "Copilot · Swing" | agent name
  status: "open" | "closed"; openedAt: string; closedAt: string | null;
}
```

## Market data

| Method | Path | Returns |
|---|---|---|
| GET **public** | `/market/tokens?list=TokenList&limit=50` | `{ tokens: TokenRow[] }` |
| GET **public** | `/market/search?q=` | `{ tokens: TokenRow[] }` (symbol, name or exact mint) |
| GET **public** | `/market/token/:mint` | `{ token: TokenRow, safety: Safety, top10Pct: number\|null, devPct: number\|null }` |
| GET **public** | `/market/token/:mint/candles?tf=1m\|5m\|15m\|1h&bars=200` | `{ candles: Candle[] }` |
| GET **public** | `/market/token/:mint/trades?limit=50` | `{ trades: { ts: number; side: "buy"\|"sell"; valueUsd: number; priceUsd: number; wallet: string }[], available: boolean }` |
| GET **public** | `/market/token/:mint/holders` | `{ holders: { rank: number; wallet: string; sharePct: number; note: string\|null }[], available: boolean }` |
| GET **public** | `/market/token/:mint/stream` | SSE, `data: {"priceUsd":n,"ts":n}` about every 1s |
| GET | `/market/watchlist` | `{ mints: string[], tokens: TokenRow[] }` |
| PUT | `/market/watchlist/:mint` / DELETE same | `{ mints: string[] }` |

`available: false` means the data source is not configured (no key); FE shows an
empty state that says so instead of an error.

## Trading account and execution

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/trade/account` | | `{ ready: boolean; agentId: string\|null; walletAddress: string\|null; usdcBalance: number; solBalance: number; credits: number }` |
| POST | `/trade/account` | `{ walletAddress }` (the user's Privy embedded Solana wallet, already delegated client-side) | same as GET |
| POST | `/trade/quote` | `{ mint, side: "buy"\|"sell", usd?: number, fraction?: number, slippageBps?: number }` | `{ inAmount, outAmount, priceImpactPct, feeUsd, slippageBps, route: string, expiresAt }` |
| POST | `/trade/buy` | `{ mint, usd, exitPlan: ExitPlan, source: string, slippageBps?: number }` | `{ position: Position, signature: string }` |
| POST | `/trade/sell` | `{ mint, fraction }` (0 < fraction <= 1) | `{ soldUsd, pnlUsd, signature }` |
| GET | `/trade/positions?status=open\|closed` | | `{ positions: Position[] }` |
| PATCH | `/trade/positions/:id` | `{ exitPlan }` | `{ position }` |

Rules enforced server-side on `/trade/buy`:
- safety score < 50 → `422 { error: "safety_failed", safety }`
- usd < 5 or > USDC balance → `422 { error: "amount_invalid" | "insufficient_balance" }`
- no account → `409 { error: "account_required" }`

Buys are USDC → token via Jupiter (platform fee applies), executed by the user's
personal agent (kind `personal`) through its delegated wallet. Exits run in the
30s exit sweep using the position's `exit_plan`.

## Feed

| Method | Path | Returns |
|---|---|---|
| GET **public** | `/feed/ideas?cat=all\|trending\|opportunities\|moves\|new` | `{ ideas: Idea[], counts: Record<cat, number>, updatedAt }` |
| POST | `/feed/ideas/:id/pass` | `{ ok: true }` |

```ts
interface Idea {
  id: string; cat: "trending" | "opportunities" | "moves" | "new";
  token: TokenRow; safety: Safety;
  headline: string;              // templated from numbers, no LLM
  insight: string;               // "Why this token", templated
  ageLabel: string;              // "3m ago", "#1 trending", "12m old"
  levels: { priceUsd: number; label: string }[];  // "Support", "7-day high"
  flow: { label: string; buys: number; sells: number; buyPct: number }; // txn counts, last hour
  plan: ExitPlanKey; planOptions: ExitPlanKey[];
  highRisk: boolean;             // new tokens
  createdAt: string;
}
```

## Copilot

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/copilot/setup` | `{ mint, plan?: ExitPlanKey }` | `{ verdict: "now"\|"wait"\|"skip", title, reason, entryPriceUsd, targetPriceUsd, stopPriceUsd, exitPlan, validForSec, creditsLeft, why: { analyst, risk, route } }` |

Costs 2 credits (`deductCredits`); `402 { error: "insufficient_credits" }` when short.
`plan` change on an open setup: send `rerun: true` with the same mint within
`validForSec` and no credit is charged.
Verdict: safety < 60 → skip; 1h change > 3% → wait (entry 2% below for majors,
6% for others); else now. `reason` is templated; `why.analyst` may use the LLM.
