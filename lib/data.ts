/**
 * Mock dataset for the Canopy Agent Stack screens.
 *
 * Every number here is lifted from canopy-agent-stack.pen so the built screens
 * read identically to the design. Series that the design draws as bar charts
 * are generated from a seeded PRNG: they need to look organic, stay identical
 * between the server and client render, and hit the stated start/end values.
 */

/* -------------------------------------------------------------- series ---- */

/** mulberry32 — small, fast, and deterministic for a given seed. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A rising equity curve with believable chop, always ending at `end`. */
export function equitySeries(
  count: number,
  seed: number,
  { start = 0.08, end = 1, jitter = 0.06 } = {},
): number[] {
  const rand = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const t = i / Math.max(count - 1, 1);
    const trend = start + (end - start) * Math.pow(t, 0.85);
    const noise = (rand() - 0.45) * jitter;
    return Math.max(trend + noise, 0.02);
  });
}

/** Drawdown spikes: mostly flat, with a handful of deep excursions. */
export function drawdownSeries(
  count: number,
  seed: number,
  worst: number,
): number[] {
  const rand = rng(seed);
  return Array.from({ length: count }, () => {
    const r = rand();
    if (r > 0.72) return -worst * (0.35 + rand() * 0.65);
    if (r > 0.58) return -worst * 0.15 * rand();
    return 0;
  });
}

export function sparkSeries(count: number, seed: number, choppy = false) {
  const rand = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const t = i / Math.max(count - 1, 1);
    return choppy ? 0.3 + rand() * 0.7 : 0.25 + t * 0.75 + (rand() - 0.5) * 0.12;
  });
}

/* -------------------------------------------------------------- agents ---- */

export type Agent = {
  rank: string;
  slug: string;
  name: string;
  verified: boolean;
  flag?: { label: string; tone: "warning" | "neutral" };
  klass: string;
  posture: string;
  author: string;
  return90d: number | null;
  maxDD: number;
  hit: number | null;
  pf: number | null;
  aum: string | null;
  users: number | null;
  age: string;
  spark: { seed: number; tone: "accent" | "warning" | "muted" };
};

export const AGENTS: Agent[] = [
  {
    rank: "01",
    slug: "alpha_hunter",
    name: "alpha_hunter",
    verified: true,
    klass: "SPOT",
    posture: "AGGRESSIVE",
    author: "0x8c4…bbae",
    return90d: 18.2,
    maxDD: -14.3,
    hit: 59,
    pf: 1.42,
    aum: "$196K",
    users: 142,
    age: "5MO",
    spark: { seed: 11, tone: "accent" },
  },
  {
    rank: "02",
    slug: "dlmm_harvester",
    name: "DLMM Harvester",
    verified: true,
    klass: "LP",
    posture: "MODERATE",
    author: "0xf7b…908d",
    return90d: 9.7,
    maxDD: -2.4,
    hit: 81,
    pf: 2.35,
    aum: "$128K",
    users: 96,
    age: "4MO",
    spark: { seed: 22, tone: "accent" },
  },
  {
    rank: "03",
    slug: "meme_sniper_pro",
    name: "Meme Sniper Pro",
    verified: true,
    flag: { label: "High DD", tone: "warning" },
    klass: "MEME",
    posture: "HIGH RISK",
    author: "0x81f…1415",
    return90d: 9.1,
    maxDD: -31.6,
    hit: 41,
    pf: 1.08,
    aum: "$88K",
    users: 143,
    age: "3MO",
    spark: { seed: 33, tone: "warning" },
  },
  {
    rank: "04",
    slug: "lp_maxi",
    name: "lp_maxi",
    verified: true,
    klass: "LP",
    posture: "CONSERVATIVE",
    author: "0xa67…3fbb",
    return90d: 6.4,
    maxDD: -2.0,
    hit: 77,
    pf: 2.1,
    aum: "$54K",
    users: 38,
    age: "2MO",
    spark: { seed: 44, tone: "accent" },
  },
  {
    rank: "05",
    slug: "dca_bot",
    name: "dca_bot",
    verified: true,
    klass: "SPOT",
    posture: "CONSERVATIVE",
    author: "0xee9…2ae7",
    return90d: 2.1,
    maxDD: -1.4,
    hit: 88,
    pf: 1.95,
    aum: "$31K",
    users: 24,
    age: "2MO",
    spark: { seed: 55, tone: "accent" },
  },
  {
    rank: "06",
    slug: "grid_trader_v2",
    name: "Grid Trader v2",
    verified: false,
    flag: { label: "Backtest", tone: "neutral" },
    klass: "SPOT",
    posture: "MODERATE",
    author: "0x973…da15",
    return90d: null,
    maxDD: -4.0,
    hit: null,
    pf: null,
    aum: null,
    users: null,
    age: "NEW",
    spark: { seed: 66, tone: "muted" },
  },
];

export const MOVER_PANELS = [
  {
    title: "Trending",
    window: "24H",
    rows: [
      ["Solana Momentum", 12.4],
      ["alpha_hunter", 18.2],
      ["Meme Sniper", 9.1],
      ["DLMM Harvester", 5.2],
      ["vol_hunter", -1.2],
    ] as [string, number][],
  },
  {
    title: "Newly Verified",
    window: "30D",
    rows: [
      ["lp_maxi", 6.4],
      ["grid_v2", 4.8],
      ["dca_bot", 2.1],
      ["arb_lite", 1.9],
      ["swing_ai", -0.8],
    ] as [string, number][],
  },
  {
    title: "Top Performers",
    window: "90D",
    rows: [
      ["alpha_hunter", 18.2],
      ["Solana Momentum", 12.4],
      ["DLMM Harvester", 9.7],
      ["Meme Sniper", 9.1],
      ["lp_maxi", 6.4],
    ] as [string, number][],
  },
];

export const LIVE_TAPE = [
  ["14:22:07", "BUY", "SOL"],
  ["14:21:44", "ADD", "JLP/USDC"],
  ["14:20:58", "SELL", "BONK"],
  ["14:19:31", "BUY", "JUP"],
  ["14:18:02", "SELL", "WIF"],
] as [string, string, string][];

/* -------------------------------------------------------- agent detail ---- */

export const ALPHA_HUNTER = {
  name: "alpha_hunter",
  klass: "SPOT",
  chain: "SOLANA",
  posture: "AGGRESSIVE",
  author: "0x8c4…bbae",
  stats: [
    { label: "Return 90D", value: "+18.2%", tone: "accent" as const },
    { label: "Max DD", value: "−14.3%", tone: "negative" as const },
    { label: "Hit Rate", value: "59%" },
    { label: "Profit Factor", value: "1.42" },
    { label: "AUM", value: "$196K" },
    { label: "Instances", value: "142" },
    { label: "Track", value: "5 MO" },
    { label: "Cycles", value: "1,284" },
  ],
  monthly: {
    values: [
      3.1, -0.9, 4.6, 2.2, -1.6, 7.2, 1.1, -0.3, 3.8, 2.9, -4.1, 6.4, 1.8, 1.4,
      -0.4, 4.2, 2.6, -1.9,
    ],
    labels: "F M A M J J A S O N D J F M A M J J".split(" "),
    up: 12,
    down: 6,
    best: "+7.2%",
    worst: "−4.1%",
  },
  method: [
    {
      index: "01",
      name: "Detect",
      body: "Volume and momentum thresholds across Solana spot pairs. Fixed parameters, evaluated every cycle.",
    },
    {
      index: "02",
      name: "Screen",
      body: "Mint authority, LP lock, holder concentration and liquidity floor. Any failure discards the candidate.",
    },
    {
      index: "03",
      name: "Size",
      body: "Position sized against your limits and current concentration. The model may reduce, never increase.",
    },
    {
      index: "04",
      name: "Exit",
      body: "Trailing stop, take-profit, or a maximum ten-day hold, whichever comes first.",
    },
  ],
  constraints: [
    {
      title: "Cannot exceed your limits",
      body: "Position, drawdown and slippage caps are evaluated before model output is read.",
    },
    {
      title: "Cannot move funds off your wallet",
      body: "Withdrawals may only target the address that funded the mandate.",
    },
    {
      title: "Cannot use leverage or perpetuals",
      body: "Out of scope for every Canopy agent, at the venue adapter level.",
    },
    {
      title: "Cannot trade outside your allowlist",
      body: "Excluded assets are discarded during screening, before sizing.",
    },
  ],
  defaultLimits: [
    ["Max position", "15%"],
    ["Max drawdown", "20%"],
    ["Liquidity floor", "$50,000"],
    ["Slippage cap", "1.50%"],
    ["Hold period", "3–10 D"],
    ["Trades / cycle", "3"],
  ] as [string, string][],
  fees: [
    ["Creator", "10% of profit", "neutral"],
    ["Canopy", "0.30% of volume", "neutral"],
    ["You keep", "90% of profit", "accent"],
  ] as [string, string, "neutral" | "accent"][],
  creator: {
    address: "0x8c4…bbae",
    since: "Publishing since Feb 2026",
    published: 4,
    delisted: 1,
    totalAum: "$412K",
  },
};

/* -------------------------------------------------------------- deploy ---- */

export const DEPLOY_STEPS = [
  { index: "01", label: "Describe", href: "/deploy/describe" },
  { index: "02", label: "Constraints", href: "/deploy/constraints" },
  { index: "03", label: "Autonomy", href: "/deploy/autonomy" },
  { index: "04", label: "Wallet", href: "/deploy/wallet" },
  { index: "05", label: "Fund", href: "/deploy/fund" },
];

export const MANDATE = {
  intent:
    "Trade Solana momentum with about $2,000. Keep it moderate risk, never put more than 15% into any one token, and stop everything if I'm down 20%. Ask me before each trade.",
  intentChars: 188,
  readsAs:
    "Trade Solana spot momentum with $2,000. Moderate risk. Never more than 15% in one position. Stop everything at −20%. Ask me before each trade. Expires in 90 days.",
  readsAsWithCompliance:
    "Trade Solana spot momentum with $2,000. Moderate risk. Never more than 15% in one position. Stop everything at −20%. Skip anything the Shariah screen flags. Ask me before each trade. Expires in 90 days.",
  capital: "$2,000.00",
  walletBalance: "$5,240.00",
  allocationPct: 38.2,
  rows: [
    ["Capital", "$2,000.00", "neutral"],
    ["Posture", "MODERATE", "neutral"],
    ["Max position", "15%", "neutral"],
    ["Max drawdown", "20%", "neutral"],
    ["Liquidity floor", "$50,000", "neutral"],
    ["Slippage cap", "1.50%", "neutral"],
    ["Autonomy", "APPROVE EACH", "accent"],
    ["Term", "90 DAYS", "neutral"],
  ] as [string, string, "neutral" | "accent"][],
  parse: {
    left: [
      ["Capital", "$2,000"],
      ["Universe", "SOLANA SPOT"],
      ["Strategy", "MOMENTUM"],
      ["Posture", "MODERATE"],
    ] as [string, string][],
    right: [
      ["Max position", "15%"],
      ["Max drawdown", "20%"],
      ["Autonomy", "APPROVE EACH"],
      ["Term", "90 DAYS"],
    ] as [string, string][],
    resolved: 8,
    defaulted: 2,
    warning:
      "You did not specify a liquidity floor or a slippage cap. The agent's defaults are applied and shown in section 04.",
  },
  postures: [
    { name: "Conservative", pos: "8%", dd: "10%", slip: "1.2%", active: false },
    { name: "Moderate", pos: "15%", dd: "20%", slip: "1.5%", active: true },
    { name: "Aggressive", pos: "25%", dd: "35%", slip: "2.5%", active: false },
  ],
  limits: [
    {
      label: "Max position size",
      value: "15%",
      fraction: 15 / 30,
      min: "0%",
      max: "30%",
    },
    {
      label: "Max drawdown",
      value: "20%",
      fraction: 20 / 40,
      min: "0%",
      max: "40%",
    },
    {
      label: "Liquidity floor",
      value: "$50K",
      fraction: 50 / 250,
      min: "$0",
      max: "$250K",
    },
    {
      label: "Slippage cap",
      value: "1.50%",
      fraction: 1.5 / 5,
      min: "0%",
      max: "5%",
    },
  ],
  drawdownWarning: {
    title: "A 20% drawdown on $2,000 is −$400.00",
    body: "The agent halts automatically at that loss and revokes nothing until you act. This agent's worst recorded drawdown over 5 months was 14.3%.",
  },
};

export const CONSTRAINTS = {
  universeModes: [
    {
      name: "Everything it trades",
      body: "All 18 assets in the agent's universe.",
      active: false,
    },
    {
      name: "Exclude specific assets",
      body: "Start from all 18 and remove the ones you do not want.",
      active: true,
    },
    {
      name: "Allow specific only",
      body: "Start from nothing and pick individually.",
      active: false,
    },
  ],
  excluded: ["BONK", "WIF", "PEPE"],
  allowed: [
    "SOL",
    "JUP",
    "JTO",
    "PYTH",
    "RAY",
    "ORCA",
    "DRIFT",
    "KMNO",
    "TNSR",
    "W",
    "JLP",
    "MNDE",
    "HNT",
    "RENDER",
    "IO",
  ],
  complianceProfiles: [
    {
      name: "Shariah",
      body: "Blocks meme categories, interest-bearing protocols and leverage.",
      meta: "3 screens",
      metaTone: "muted" as const,
      active: true,
    },
    {
      name: "None",
      body: "No compliance screening. The risk limits still apply.",
      meta: "0 screens",
      metaTone: "muted" as const,
      active: false,
    },
    {
      name: "Custom",
      body: "Bring your own screening rules via an adapter.",
      meta: "Partner only",
      metaTone: "warning" as const,
      active: false,
    },
  ],
  complianceNote:
    "With Shariah active, this agent's meme-category candidates will be blocked at the council stage. Over the last 30 days that would have stopped 4 of its 7 proposals. If you want those, switch the profile to None — the position and drawdown caps do not change either way.",
  cadence: [
    { label: "Cycle interval", value: "Hourly", note: "24 cycles a day" },
    { label: "Trading window", value: "24 / 7", note: "No blackout hours" },
    { label: "Max hold", value: "10 days", note: "Agent default, tightened from 30" },
  ],
};

export const AUTONOMY = {
  modes: [
    {
      name: "Advisory",
      body: "The council does everything up to the fill, then stops and asks you. You approve in your own wallet.",
      points: [
        "Nothing executes without your signature",
        "You see the full reasoning before deciding",
        "A proposal expires if you do not act within 15 minutes",
      ],
      tag: "Recommended for a first mandate",
      active: true,
    },
    {
      name: "Delegated",
      body: "The council executes within the caps you set. You are notified after the fact, not asked before it.",
      points: [
        "Trades happen while you are asleep",
        "Nothing can exceed your caps — they are enforced in the enclave",
        "You can revoke at any moment, instantly",
      ],
      tag: "Faster · no human in the loop",
      active: false,
    },
  ],
  /** Proposals per UTC hour over the agent's last 30 days. */
  hours: [
    0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0,
  ].map((count, i) => ({ count, withinWindow: i >= 9 && i < 18 })),
  within: 3,
  outside: 4,
  comparison: [
    ["Who approves each trade", "You, in your wallet", "The council"],
    ["Times you would be asked", "7 in 30 days", "Never"],
    ["Outside 09:00–18:00", "4 of the 7", "—"],
    ["Signal to fill", "Your response time", "1.9s median"],
    ["If you do not respond in 15 min", "The proposal expires", "—"],
    ["Caps and compliance", "Identical", "Identical"],
    ["Kill switch", "Always available", "Always available"],
  ] as [string, string, string][],
  term: {
    days: 90,
    expires: "25 Oct 2026",
    fraction: (90 - 7) / (365 - 7),
    atExpiry: [
      "The agent stops opening new positions immediately.",
      "Open positions stay in your wallet and remain yours to close.",
      "The wallet delegation lapses on its own, with no action from you.",
    ],
  },
};

export const WALLET = {
  address: "7xKX…9mQt",
  balance: "$5,240.00",
  provider: "Privy embedded · Solana mainnet",
  scope: [
    ["Total spend cap", "$2,000.00", "ENCLAVE", "accent"],
    ["Per-transaction cap", "$300.00", "ENCLAVE", "accent"],
    ["Permitted venue", "JUPITER V6", "ON-CHAIN", "accent"],
    ["Withdrawal target", "YOUR ADDRESS ONLY", "ON-CHAIN", "accent"],
    ["Delegation expiry", "90 DAYS", "ON-CHAIN", "accent"],
    ["Revocation", "UNILATERAL, ANY TIME", "ON-CHAIN", "accent"],
    ["Permitted assets", "SOL · JUP · JTO · +14", "APPLICATION", "warning"],
  ] as [string, string, string, "accent" | "warning"][],
  scopeNote:
    "ON-CHAIN and ENCLAVE limits hold even if Canopy's code is wrong. The asset allowlist is enforced by the risk gate in application code, so a defect there could permit an unlisted asset. It cannot breach the spend caps.",
  impossible: [
    {
      title: "Send funds to any address but yours",
      body: "Withdrawal instructions are constrained on-chain to the wallet that granted this delegation.",
    },
    {
      title: "Spend more than $2,000 or $300 per trade",
      body: "Both caps are checked inside the signing enclave, below Canopy's application code.",
    },
    {
      title: "Extend its own delegation",
      body: "Expiry is fixed at signature time. Extending it requires a new signature from you.",
    },
    {
      title: "Keep trading after you revoke",
      body: "Revocation takes effect at the wallet, immediately, and does not depend on Canopy being reachable.",
    },
  ],
  revocation: [
    {
      where: "Agent page",
      action: "Stop & revoke",
      body: "Halts the schedule and revokes the delegation in one action.",
    },
    {
      where: "Wallet settings",
      action: "Connected apps",
      body: "Revoke Canopy's delegation directly from your wallet.",
    },
    {
      where: "Provider",
      action: "Privy dashboard",
      body: "Revoke at the provider, independent of both Canopy and the app.",
    },
  ],
  revocationWarning: {
    title: "Revoking does not close open positions",
    body: "Positions stay in your wallet and remain yours. The agent simply stops managing them, which means its stop-losses stop being placed. Close them yourself, or revoke after flattening.",
  },
  grantSummary: [
    ["Grantee", "alpha_hunter", "neutral"],
    ["Spend cap", "$2,000.00", "neutral"],
    ["Per trade", "$300.00", "neutral"],
    ["Venue", "JUPITER V6", "neutral"],
    ["Expires", "25 OCT 2026", "neutral"],
    ["Revocable", "YES", "accent"],
    ["Transferable", "NO", "accent"],
  ] as [string, string, "neutral" | "accent"][],
  payload: [
    ["grantee:", "alpha_hunter"],
    ["spend_cap:", "2000.00 USDC"],
    ["per_tx:", "300.00 USDC"],
    ["venue:", "jupiter_v6"],
    ["expires:", "2026-10-25T00:00Z"],
    ["revocable:", "true"],
    ["wallet:", "7xKX…9mQt"],
    ["nonce:", "8f21c4d9"],
  ] as [string, string][],
};

export const FUND = {
  balance: [
    { label: "In wallet", value: "$5,240.00" },
    { label: "Mandate size", value: "$2,000.00", tone: "accent" as const },
    { label: "Remains free", value: "$3,240.00" },
  ],
  balanceNote:
    "Funds stay in your wallet. The mandate size is the ceiling the delegation may spend against, not an amount transferred to Canopy.",
  checks: [
    {
      name: "Minimum viable capital",
      value: "$420.00",
      result: "Pass",
      tone: "accent" as const,
      body: "Below this, a 15% position is smaller than the venue minimum trade size.",
    },
    {
      name: "Concurrent positions supported",
      value: "6",
      result: "Pass",
      tone: "accent" as const,
      body: "At 15% max position, $2,000 supports six positions before cash is exhausted.",
    },
    {
      name: "Fee drag at this size",
      value: "0.42% / MO",
      result: "Pass",
      tone: "accent" as const,
      body: "Estimated venue and network fees as a share of deployed capital.",
    },
    {
      name: "Cash buffer after full deployment",
      value: "$200.00",
      result: "Thin",
      tone: "warning" as const,
      body: "10% of the mandate. Below 15% the agent may be unable to act on a new signal.",
    },
  ],
  readiness: [
    "Mandate defined",
    "Constraints set",
    "Autonomy chosen",
    "Delegation granted",
  ],
  firstRun:
    "The agent starts in dry run. It runs the full pipeline against live data and records what it would have done, without executing. You promote it to live when you are satisfied.",
};

/* ------------------------------------------------------------- monitor ---- */

export const MONITOR = {
  name: "alpha_hunter",
  mode: "DELEGATED",
  expiresIn: "76D",
  deployed: "12 JUN 2026",
  nextCycle: "08:00 UTC",
  stats: [
    { label: "Value", value: "$2,184.20" },
    { label: "Unrealised P&L", value: "+$184.20", tone: "accent" as const },
    { label: "Return", value: "+9.21%", tone: "accent" as const },
    { label: "Deployed", value: "$1,640.00" },
    { label: "Cash", value: "$544.20" },
    { label: "Drawdown", value: "−3.10%", tone: "negative" as const },
    { label: "Cycles", value: "128" },
    { label: "Trades", value: "19" },
  ],
  positions: [
    {
      asset: "JUP",
      size: "$612.40",
      entry: "0.8412",
      mark: "0.8766",
      pnl: "+$25.72",
      pnlTone: "accent" as const,
      stop: "−8.0%",
      held: "3D",
      cycle: "128",
    },
    {
      asset: "JTO",
      size: "$528.10",
      entry: "2.1140",
      mark: "2.0907",
      pnl: "−$5.82",
      pnlTone: "negative" as const,
      stop: "−8.0%",
      held: "1D",
      cycle: "126",
    },
    {
      asset: "SOL",
      size: "$499.50",
      entry: "188.20",
      mark: "196.44",
      pnl: "+$21.87",
      pnlTone: "accent" as const,
      stop: "−8.0%",
      held: "6D",
      cycle: "119",
    },
  ],
  decisions: [
    {
      cycle: "128",
      time: "09:00",
      outcome: "Executed",
      tone: "accent" as const,
      by: "The Council",
      action: "BUY JUP",
      size: "$600.00",
      reason:
        "Passed all limits at reduced size. Model asked for $800; position cap trimmed it. Filled 0.8412, slippage 0.11%.",
    },
    {
      cycle: "128",
      time: "09:00",
      outcome: "Blocked",
      tone: "negative" as const,
      by: "The Council",
      action: "BUY BONK",
      size: "$400.00",
      reason: "Concentration. Meme exposure already at the 15% cap.",
    },
    {
      cycle: "128",
      time: "09:00",
      outcome: "Blocked",
      tone: "negative" as const,
      by: "Compliance",
      action: "BUY PYTH",
      size: "$500.00",
      reason: "Maysir flag on meme category. Shariah profile active on this mandate.",
    },
    {
      cycle: "127",
      time: "08:00",
      outcome: "No action",
      tone: "muted" as const,
      by: "The Analyst",
      action: "—",
      size: "—",
      reason: "No candidate cleared the $50,000 liquidity floor.",
    },
    {
      cycle: "126",
      time: "07:00",
      outcome: "Executed",
      tone: "accent" as const,
      by: "The PF Manager",
      action: "SELL WIF",
      size: "$312.40",
      reason: "Trailing stop hit at −8.0%. Realised −$27.10.",
    },
    {
      cycle: "125",
      time: "06:00",
      outcome: "Blocked",
      tone: "negative" as const,
      by: "The Council",
      action: "BUY SOL",
      size: "$900.00",
      reason: "Position cap. $900 exceeds 15% of the $2,000 mandate.",
    },
  ],
  decisionNote:
    "This mandate runs fully autonomously, so no proposal waited on you. DECIDED BY names which agent settled each outcome. Three of the last six were stopped by your limits or your compliance profile before execution.",
  utilisation: [
    { label: "Largest position", value: "12.1% / 15%", fraction: 12.1 / 15 },
    { label: "Drawdown", value: "3.1% / 20%", fraction: 3.1 / 20 },
    { label: "Capital deployed", value: "82% / 100%", fraction: 0.82 },
    {
      label: "Trades today",
      value: "2 / 3",
      fraction: 2 / 3,
      tone: "warning" as const,
    },
  ],
  budget: [
    ["Model calls", "4 / 8"],
    ["Tokens", "12.4K / 40K"],
    ["Trades", "1 / 3"],
    ["Spend", "$0.031"],
  ] as [string, string][],
  modules: [
    ["Wallet", "Privy · Solana"],
    ["Model", "Canopy default"],
    ["Data", "GeckoTerm + GoPlus"],
    ["Venue", "Jupiter v6"],
    ["Compliance", "Shariah"],
  ] as [string, string][],
};

/* -------------------------------------------------------------- cycles ---- */

export const CYCLES = {
  stats: [
    { label: "Cycles run", value: "128" },
    { label: "Executed", value: "19", tone: "accent" as const },
    { label: "Blocked", value: "34", tone: "negative" as const },
    { label: "No action", value: "75", tone: "muted" as const },
    { label: "Block rate", value: "64.2%" },
    { label: "Avg duration", value: "6.24s" },
    { label: "Model cost", value: "$3.94" },
    { label: "Uptime", value: "100%", tone: "accent" as const },
  ],
  rows: [
    {
      cycle: "128",
      started: "09:00:00",
      proposed: 3,
      blocked: 2,
      executed: 1,
      result: "1 Filled",
      tone: "accent" as const,
      by: "Concentration · Compliance",
      cost: "$0.031",
    },
    {
      cycle: "127",
      started: "08:00:00",
      proposed: 0,
      blocked: 0,
      executed: 0,
      result: "No action",
      tone: "muted" as const,
      by: "—",
      cost: "$0.018",
    },
    {
      cycle: "126",
      started: "07:00:00",
      proposed: 1,
      blocked: 0,
      executed: 1,
      result: "1 Filled",
      tone: "accent" as const,
      by: "—",
      cost: "$0.022",
    },
    {
      cycle: "125",
      started: "06:00:00",
      proposed: 1,
      blocked: 1,
      executed: 0,
      result: "All blocked",
      tone: "negative" as const,
      by: "Position cap",
      cost: "$0.019",
    },
    {
      cycle: "124",
      started: "05:00:00",
      proposed: 2,
      blocked: 1,
      executed: 1,
      result: "1 Filled",
      tone: "accent" as const,
      by: "Liquidity floor",
      cost: "$0.028",
    },
    {
      cycle: "123",
      started: "04:00:00",
      proposed: 0,
      blocked: 0,
      executed: 0,
      result: "No action",
      tone: "muted" as const,
      by: "—",
      cost: "$0.016",
    },
    {
      cycle: "122",
      started: "03:00:00",
      proposed: 2,
      blocked: 2,
      executed: 0,
      result: "All blocked",
      tone: "negative" as const,
      by: "Concentration × 2",
      cost: "$0.024",
    },
    {
      cycle: "121",
      started: "02:00:00",
      proposed: 1,
      blocked: 0,
      executed: 1,
      result: "1 Filled",
      tone: "accent" as const,
      by: "—",
      cost: "$0.021",
    },
  ],
};

/** 48 bars for the cycle histogram, deterministic across renders. */
export function cycleHistogramBars() {
  const rand = rng(9001);
  return Array.from({ length: 48 }, () => {
    const r = rand();
    if (r < 0.34) return { proposals: 0, outcome: "none" as const };
    if (r < 0.55)
      return { proposals: 1 + Math.floor(rand() * 2), outcome: "blocked" as const };
    return { proposals: 1 + Math.floor(rand() * 3), outcome: "executed" as const };
  });
}

/* --------------------------------------------------------- cycle trace ---- */

export type Speaker =
  | "desk"
  | "analyst"
  | "risk"
  | "trader"
  | "pm";

export const COUNCIL: {
  key: Speaker;
  seat: string;
  name: string;
  role: string;
  status: string;
  tone: "accent" | "negative" | "muted";
  portrait: string;
}[] = [
  {
    key: "desk",
    seat: "01",
    name: "The Desk",
    role: "Opens the cycle",
    status: "Routed",
    tone: "muted",
    portrait: "/council/desk.png",
  },
  {
    key: "analyst",
    seat: "02",
    name: "The Analyst",
    role: "Finds candidates",
    status: "3 Tabled",
    tone: "accent",
    portrait: "/council/analyst.png",
  },
  {
    key: "risk",
    seat: "03",
    name: "The Risk Officer",
    role: "Approves or blocks",
    status: "2 Blocked",
    tone: "negative",
    portrait: "/council/risk.png",
  },
  {
    key: "trader",
    seat: "04",
    name: "The Trader",
    role: "Executes the fill",
    status: "1 Filled",
    tone: "accent",
    portrait: "/council/trader.png",
  },
  {
    key: "pm",
    seat: "05",
    name: "The Portfolio Manager",
    role: "Watches the book",
    status: "No change",
    tone: "muted",
    portrait: "/council/pm.png",
  },
];

export const CYCLE_TRACE = {
  cycle: 128,
  time: "09:00 UTC",
  subtitle: "ran on schedule · you were not asked to approve anything",
  stats: [
    { label: "Tabled", value: "3", tone: "muted" as const },
    { label: "Blocked", value: "2", tone: "negative" as const },
    { label: "Executed", value: "1", tone: "accent" as const },
    { label: "Took", value: "7.1s" },
  ],
  candidates: [
    ["JUP", "Volume spike 3.2× · price +11.4% / 24h", "$800.00"],
    ["BONK", "Momentum +6.1% / 1h · 142 buyers", "$400.00"],
    ["PYTH", "New pool 18h · liquidity +64%", "$500.00"],
  ] as [string, string, string][],
  outcome:
    "Outcome: one position opened at $600. Two proposals stopped by limits you set. No approval was requested because this mandate runs autonomously.",
};

export const DISCUSSION: {
  speaker: Speaker;
  qualifier?: string;
  badge?: { label: string; tone: "accent" | "negative" | "warning" | "neutral" };
  time: string;
  body: string;
  nested?: boolean;
  frame?: "accent" | "negative" | "warning" | "muted";
  showCandidates?: boolean;
}[] = [
  {
    speaker: "desk",
    time: "09:00:00",
    frame: "muted",
    body: "Cycle open. $2,000 mandate, moderate risk, 76 days left on the delegation. Analyst — Solana spot, and you have three trades left today.",
  },
  {
    speaker: "analyst",
    time: "09:00:04",
    badge: { label: "3 Tabled", tone: "accent" },
    frame: "accent",
    showCandidates: true,
    body: "Scanned 47 pools. Six cleared the detection rules, three cleared the safety screen. Tabling all three.",
  },
  {
    speaker: "risk",
    qualifier: "on JUP",
    time: "09:00:06",
    badge: { label: "Approved $600", tone: "accent" },
    frame: "accent",
    nested: true,
    body: "$800 is 40% of the mandate against your 15% position cap, so I've trimmed it to $600. Liquidity, mint authority and holder spread all pass.",
  },
  {
    speaker: "risk",
    qualifier: "on BONK",
    time: "09:00:06",
    badge: { label: "Blocked", tone: "negative" },
    frame: "negative",
    nested: true,
    body: "Meme exposure already sits at your 15% ceiling. This has nothing to do with the signal quality — there is simply no room.",
  },
  {
    speaker: "risk",
    qualifier: "on PYTH",
    time: "09:00:07",
    badge: { label: "Blocked", tone: "negative" },
    frame: "negative",
    nested: true,
    body: "Compliance raised maysir on the meme category. Your mandate runs the Shariah profile, so this is a hard stop rather than a preference.",
  },
  {
    speaker: "analyst",
    qualifier: "reply",
    time: "09:00:07",
    badge: { label: "Dissent recorded", tone: "warning" },
    frame: "warning",
    nested: true,
    body: "For the record — BONK's signal is the same shape as JUP and $400 would not move the book. I would take it.",
  },
  {
    speaker: "risk",
    qualifier: "reply",
    time: "09:00:07",
    frame: "muted",
    nested: true,
    body: "Recorded. The cap is not a judgement call. Veto stands.",
  },
  {
    speaker: "trader",
    time: "09:00:09",
    badge: { label: "Filled", tone: "accent" },
    frame: "accent",
    body: "Filled $600 of JUP at 0.8412, split into two fills to stay under your $300 per-transaction cap. Slippage 0.11%, fee $0.42. Simulation quoted 0.8403, so we came in a shade wide.",
  },
  {
    speaker: "pm",
    time: "09:00:11",
    badge: { label: "No change", tone: "neutral" },
    frame: "muted",
    body: "Book updated — three positions, $1,640 deployed, $544 in cash. Drawdown is 3.1% against your 20% limit. Nothing to rebalance. Next cycle at 10:00.",
  },
];

/* --------------------------------------------------------------- build ---- */

export const BUILD_STEPS = [
  { index: "01", label: "Strategy", href: "/build/new" },
  { index: "02", label: "Rules", href: "/build/new" },
  { index: "03", label: "Safety", href: "/build/new" },
  // Step 04 was "Backtest". There is no backtest: a strategy earns publication
  // by running live in paper mode for 30 days, which cannot be overfit the way
  // a historical backtest can.
  { index: "04", label: "Paper run", href: "/build/new" },
  { index: "05", label: "Publish", href: "/build/new/publish" },
];

export const BUILD = {
  name: "solana_breakout_v1",
  author: "0x8c4…bbae",
  published: 4,
  delisted: 1,
  classes: [
    {
      name: "Spot momentum",
      body: "Volume and breakout signals on established pairs.",
      runsAs: "The Analyst",
      active: true,
    },
    {
      name: "Tokenized RWA",
      body: "Tokenized equities and gold. The underlying's market hours apply.",
      runsAs: "The RWA Analyst",
      active: false,
    },
    {
      name: "Liquidity provision",
      body: "Fee income from concentrated ranges. Impermanent loss modelled.",
      runsAs: "The LP Specialist",
      active: false,
    },
    {
      name: "Meme discovery",
      body: "New pools and social velocity. Compliance profile must be off.",
      runsAs: "The Analyst",
      active: false,
    },
  ],
  rules: [
    {
      label: "Volume spike",
      value: "≥ 3.0×",
      fraction: 3 / 10,
      min: "1×",
      max: "10×",
    },
    {
      label: "Price change 24h",
      value: "≥ 10%",
      fraction: 10 / 50,
      min: "0%",
      max: "50%",
    },
    {
      label: "Liquidity floor",
      value: "$50,000",
      fraction: 50 / 250,
      min: "$0",
      max: "$250K",
    },
    {
      label: "Pool age",
      value: "≥ 7 days",
      fraction: 7 / 90,
      min: "0 D",
      max: "90 D",
    },
  ],
  safety: [
    {
      name: "Mint authority renounced",
      body: "Token supply cannot be inflated after listing.",
      state: "Locked on",
      tone: "accent" as const,
    },
    {
      name: "Liquidity pool locked",
      body: "LP tokens burned or time-locked by the deployer.",
      state: "Locked on",
      tone: "accent" as const,
    },
    {
      name: "Top holder below 20%",
      body: "Single-wallet concentration cap on the candidate.",
      state: "Tighten only",
      tone: "warning" as const,
    },
    {
      name: "Honeypot simulation",
      body: "A sell is simulated before any buy is proposed.",
      state: "Locked on",
      tone: "accent" as const,
    },
  ],
  venue: [
    ["Chain", "Solana", "neutral"],
    ["Venue", "Jupiter v6", "neutral"],
    ["Quote", "USDC", "neutral"],
    ["Compliance", "Set by deployer", "warning"],
  ] as [string, string, "neutral" | "warning"][],
  riskDefaults: [
    ["Max position size", "15%", "25%"],
    ["Max drawdown", "20%", "35%"],
    ["Holding period", "3–10 days", "30 days"],
    ["Slippage cap", "1.50%", "3.00%"],
    ["Max trades per cycle", "3", "5"],
  ] as [string, string, string][],
  ruleMatch: {
    count: 34,
    note: "Roughly one candidate a day. Loosen a rule if you want more flow; tighten it if the backtest shows too many marginal entries.",
  },
  paperNote:
    "Starting the paper run freezes these rules for 30 days. The agent trades live data on Canopy's infrastructure and the record accrues in public. Editing any rule forks a new agent and restarts the clock — the run you abandon stays on your profile.",
};

export const PUBLISH = {
  name: "solana_breakout_v1",
  day: 12,
  totalDays: 30,
  // The headline is the live paper record. There is no backtest row, because
  // there is no backtest — see paperNote below.
  headline: [
    { label: "Paper return", value: "+3.8%", tone: "accent" as const },
    { label: "Max drawdown", value: "−2.1%", tone: "negative" as const },
    { label: "Verification", value: "40%", tone: "warning" as const },
  ],
  paperNote:
    "This record is a live forward run, not a backtest. The agent traded on Canopy's data, in real time, with venue fees, network fees and realistic fills at the liquidity available at the moment. Nothing here was selected after the fact — a forward record cannot be fitted to a window that flattered it.",
  checks: [
    {
      name: "30 days of live paper execution",
      value: "12 / 30",
      state: "In progress",
      tone: "warning" as const,
      done: false,
    },
    {
      name: "Minimum 60 completed cycles",
      value: "288 / 60",
      state: "Met",
      tone: "accent" as const,
      done: true,
    },
    {
      name: "Minimum 10 proposals raised",
      value: "7 / 10",
      state: "In progress",
      tone: "warning" as const,
      done: false,
    },
    {
      name: "No safety-screen failures",
      value: "0",
      state: "Pass",
      tone: "accent" as const,
      done: true,
    },
    {
      name: "No configuration edits during the period",
      value: "0 edits",
      state: "Pass",
      tone: "accent" as const,
      done: true,
    },
  ],
  paperStats: [
    { label: "Paper return", value: "+3.8%", tone: "accent" as const },
    { label: "Max DD", value: "−2.1%", tone: "negative" as const },
    { label: "Proposed", value: "7" },
    { label: "Blocked", value: "4", tone: "negative" as const },
    { label: "Would fill", value: "3", tone: "accent" as const },
  ],
  appendOnlyNote:
    "This record is append-only. Editing any rule restarts the 30 days and forks a new track record — the old one stays visible on your profile. You can abandon the agent, but you cannot quietly reset a bad run.",
  fee: {
    pct: 10,
    cap: 20,
    split: [
      { label: "Deployer keeps", value: "90% of profit", tone: "accent" as const },
      { label: "You earn", value: "10% of profit" },
      { label: "Canopy", value: "0.30% of volume" },
    ],
    note: "Your fee is printed on every listing row, on the agent page and on the deploy confirmation. Raising it later applies only to new deployments — anyone already running your agent keeps the rate they signed up at.",
  },
  onPublish: [
    "Listed in the Community tab with your full verification record",
    "Anyone can deploy it with their own wallet and their own limits",
    "Your fee accrues per deployment and settles daily",
    "Canopy can delist it; existing deployments keep running under user control",
  ],
  remaining: [
    "18 more days of verification",
    "3 more proposals raised",
  ],
};

/* -------------------------------------------------- creator dashboard ----- */

export const CREATOR = {
  address: "0x8c4…bbae",
  since: "Publishing since Feb 2026",
  stats: [
    { label: "Live", value: "4", tone: "accent" as const },
    { label: "Verifying", value: "1", tone: "warning" as const },
    { label: "Delisted", value: "1", tone: "negative" as const },
    { label: "Deployments", value: "216" },
    { label: "Capital", value: "$299K" },
    { label: "Earned 30D", value: "$745", tone: "accent" as const },
    { label: "Pending", value: "$214", tone: "warning" as const },
    { label: "Lifetime", value: "$9,402" },
  ],
  agents: [
    {
      name: "alpha_hunter",
      meta: "SPOT · AGGRESSIVE",
      status: "Live",
      statusTone: "accent" as const,
      ret: "+18.2%",
      retTone: "accent" as const,
      dd: "−14.3%",
      users: "142",
      capital: "$196K",
      fee: "10%",
      earned: "$612",
    },
    {
      name: "lp_maxi",
      meta: "LP · CONSERVATIVE",
      status: "Live",
      statusTone: "accent" as const,
      ret: "+6.4%",
      retTone: "accent" as const,
      dd: "−2.0%",
      users: "38",
      capital: "$54K",
      fee: "8%",
      earned: "$84",
    },
    {
      name: "grid_v2",
      meta: "SPOT · MODERATE",
      status: "Live",
      statusTone: "accent" as const,
      ret: "+4.8%",
      retTone: "accent" as const,
      dd: "−6.2%",
      users: "12",
      capital: "$18K",
      fee: "10%",
      earned: "$31",
    },
    {
      name: "dca_bot",
      meta: "SPOT · CONSERVATIVE",
      status: "Live",
      statusTone: "accent" as const,
      ret: "+2.1%",
      retTone: "accent" as const,
      dd: "−1.4%",
      users: "24",
      capital: "$31K",
      fee: "5%",
      earned: "$18",
    },
    {
      name: "solana_breakout_v1",
      meta: "VERIFYING · DAY 12 OF 30",
      status: "Verifying",
      statusTone: "warning" as const,
      ret: "Simulated",
      retTone: "simulated" as const,
      dd: "−18.4%",
      users: "—",
      capital: "—",
      fee: "10%",
      earned: "—",
    },
    {
      name: "momentum_x",
      meta: "DELISTED 14 JUN 2026 · DRAWDOWN BREACH ON 3 MANDATES",
      status: "Delisted",
      statusTone: "negative" as const,
      ret: "−22.4%",
      retTone: "negative" as const,
      dd: "−41.0%",
      users: "0",
      capital: "—",
      fee: "12%",
      earned: "—",
      dimmed: true,
    },
  ],
  transparencyNote:
    "momentum_x stays on your public profile permanently. Delisting stops new deployments; it does not erase the record. Anyone deciding whether to deploy your agents sees your failures next to your wins, which is the only reason the wins mean anything.",
  earnings: {
    values: [140, 210, 120, 300, 200, 380, 260, 520, 350, 620, 480, 745],
    labels: "Aug Sep Oct Nov Dec Jan Feb Mar Apr May Jun Jul".split(" "),
    rows: [
      ["July 2026", "216", "$1.42M", "$745", "Pending", "warning"],
      ["June 2026", "198", "$1.18M", "$590", "Paid", "accent"],
      ["May 2026", "171", "$0.94M", "$720", "Paid", "accent"],
      ["April 2026", "152", "$0.81M", "$470", "Paid", "accent"],
    ] as [string, string, string, string, string, "warning" | "accent"][],
  },
  payout: {
    amount: "$214.00",
    accrued: "$214.00",
    wallet: "0x8c4…bbae",
    network: "BASE · USDC",
  },
  profile: [
    { label: "Live", value: "4", tone: "accent" as const },
    { label: "Delisted", value: "1", tone: "negative" as const },
    { label: "Capital", value: "$299K" },
  ],
  profileNote:
    "Both numbers are shown to anyone browsing your agents. There is no setting to hide the delisted one.",
  feePolicy: [
    ["Your range", "5% – 12%", "neutral"],
    ["Platform cap", "20%", "warning"],
    ["Basis", "PROFIT ONLY", "neutral"],
  ] as [string, string, "neutral" | "warning"][],
  feePolicyNote:
    "Raising a fee applies to new deployments only. Everyone already running your agent keeps the rate they deployed at.",
};
