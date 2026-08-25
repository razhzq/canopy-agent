import type { Locale } from "@/lib/i18n";

/**
 * Every word on the five /deploy screens, in both languages.
 *
 * WHY THIS IS NOT IN lib/i18n LIKE EVERYTHING ELSE.
 *
 * The deploy flow is a WIREFRAME. Its numbers are invented — "alpha_hunter",
 * "$2,000.00", "7 in 30 days" — and no route reads or writes any of them; it
 * exists so the shape of a mandate can be reviewed before the backend that
 * would fill it. That makes its copy a design artefact rather than product
 * vocabulary: about 150 strings, none of which any other screen will ever
 * reuse, all of which disappear together the day these pages are wired up.
 *
 * Putting them in the shared dictionary would mean 150 keys nobody can safely
 * delete, indistinguishable from the keys that matter. Keeping the two
 * language bundles side by side keeps the mockup self-contained and legible:
 * one file to read, one file to delete.
 *
 * The dictionary rule still holds where it counts — the wizard chrome these
 * pages share with the real builder (StepBar, Proceed, MandateRail) lives in
 * the build namespace of the shared dictionary, because that chrome is real.
 *
 * The pages are server components and read `getServerLocale()`.
 */

type Tone = "neutral" | "accent";
type MetaTone = "muted" | "warning" | "accent";
/** `[label, value, tone]` — the shape MandateRail takes. */
type MandateRow = [string, string, Tone];
type Pair = [string, string];
/** `[parameter, value, enforcedBy, tone]` — the delegation scope table. */
type ScopeRow = [string, string, string, "accent" | "warning"];
type ComparisonRow = [string, string, string];

const EN = {
  // ── Shared header meta ─────────────────────────────────────────
  agentLabel: "Agent",
  capitalLabel: "Capital",
  classLabel: "Class",
  venueLabel: "Venue",
  modeLabel: "Mode",
  custodyLabel: "Custody",
  delegationLabel: "Delegation",
  statusLabel: "Status",
  back: "Back",

  // ── 01 Describe ────────────────────────────────────────────────
  describe: {
    eyebrow: "New mandate",
    title: "What should this agent do?",
    classValue: "SPOT",
    venueValue: "SOLANA",
    secIntent: "INTENT",
    secIntentNote: "Plain language · Parsed to a mandate",
    charCount: "{used} / 500",
    noJargon: "No trading jargon required",
    presetsLabel: "Presets",
    presets: ["Low-risk SOL momentum", "Meme sniper · tight stops", "LP fees only"],
    parseOutput: "Parse output",
    parseCount: "{resolved} fields resolved · {defaulted} defaulted",
    secCapital: "CAPITAL",
    secCapitalNote: "Wallet balance  {balance} USDC",
    allocation: "Allocation",
    allocationValue: "{pct}% of balance",
    capitalStops: ["500", "1,000", "2,000", "5,240 · MAX"],
    secPosture: "RISK POSTURE",
    secPostureNote: "Derived from your description",
    postureCols: { pos: "Pos", dd: "DD", slip: "Slip" },
    secLimits: "LIMITS",
    secLimitsNote: "Tighten only · Cannot exceed agent design",
    targetAgent: "Target agent",
    targetAgentSub: "Spot · Solana · +18.2% / 90D",
    continue: "Continue to constraints",
    proceedNote: "Nothing signed or funded yet",
  },

  // ── 02 Constraints ─────────────────────────────────────────────
  constraints: {
    eyebrow: "New mandate · Step 02",
    title: "Set the boundaries",
    subtitle:
      "You can narrow what the agent is allowed to touch. You cannot widen it beyond its design.",
    universeLabel: "Universe",
    universeValue: "15 OF 18",
    secUniverse: "ASSET UNIVERSE",
    secUniverseNote: "The agent trades 18 · You have allowed 15",
    excluded: "Excluded by you · {count}",
    addExclusion: "+ Add exclusion",
    allowed: "Allowed · {count}",
    secCompliance: "COMPLIANCE PROFILE",
    secComplianceNote: "Applied before any sizing",
    secCadence: "CADENCE",
    secCadenceNote: "How often it looks",
    continue: "Continue to autonomy",
  },

  // ── 03 Autonomy ────────────────────────────────────────────────
  autonomy: {
    eyebrow: "New mandate · Step 03",
    title: "Should it ask you first?",
    subtitle:
      "The limits are identical either way. This only decides whether a human is in the loop before a fill.",
    modeValue: "ADVISORY",
    secLevel: "AUTONOMY LEVEL",
    secLevelNote: "Changeable later · Takes effect next cycle",
    secChanges: "WHAT ACTUALLY CHANGES",
    secChangesNote: "Measured on this agent's last 30 days",
    byHour: "When it would have asked you · by hour, UTC",
    within: "Within 09:00–18:00",
    outside: "Outside it",
    colAdvisory: "Advisory",
    colDelegated: "Delegated",
    secTerm: "MANDATE TERM",
    secTermNote: "The agent stops by itself",
    days: "{count} Days",
    expires: "Expires {date}",
    scaleMin: "7 DAYS",
    scaleMax: "365 DAYS",
    autoRenewTitle: "Auto-renew is off",
    autoRenewBody:
      "We will not quietly extend your delegation. Renewing needs a new signature from you.",
    off: "Off",
    atExpiry: "At expiry",
    continue: "Continue to wallet",
    proceedNote: "You can switch to delegated later without redeploying",
  },

  // ── 04 Wallet ──────────────────────────────────────────────────
  wallet: {
    eyebrow: "New mandate · Step 04",
    title: "Grant a scoped delegation",
    custodyValue: "YOURS",
    secSource: "SOURCE WALLET",
    ownedByYou: "Owned by you · Not by Canopy",
    balance: "Balance",
    change: "Change",
    keysTitle: "Your keys never leave this wallet",
    keysBody:
      "Canopy cannot sign on your behalf and cannot move funds outside the scope you grant below. Granting a delegation is not a transfer. Nothing leaves this wallet until the agent executes a trade you have authorised.",
    secScope: "DELEGATION SCOPE",
    secScopeNote: "What the agent may do",
    colParameter: "Parameter",
    colValue: "Value",
    colEnforcedBy: "Enforced by",
    secImpossible: "OUTSIDE THE BOUNDARY",
    secImpossibleNote: "Structurally impossible · Not policy",
    secRevocation: "REVOCATION",
    secRevocationNote: "Effective immediately",
    revocationIntro:
      "You can end this delegation at any moment, from three places. None of them require Canopy to be online or to agree.",
    grantSummary: "Grant summary",
    youWillSign: "You will sign",
    youWillSignNote: "Message · Not a transfer",
    payloadTitle: "Canopy Agent Delegation v1",
    humanReadable: "Human readable",
    viewRaw: "View raw payload",
    reviewInWallet: "Review in wallet",
    backToAutonomy: "Back to autonomy",
    proceedNote: "Canopy never receives your keys. No funds move until the agent executes.",
  },

  // ── 05 Fund ────────────────────────────────────────────────────
  fund: {
    eyebrow: "New mandate · Step 05",
    title: "Fund the mandate",
    delegationValue: "GRANTED",
    statusValue: "AWAITING FUNDS",
    secBalance: "BALANCE",
    secBalanceNote: "Wallet 7xKX…9mQt",
    secAdequacy: "CAPITAL ADEQUACY",
    secAdequacyNote: "Computed for this strategy",
    colCheck: "Check",
    colValue: "Value",
    colResult: "Result",
    readiness: "Readiness",
    readinessCount: "4 of 4",
    firstRun: "First run",
    firstRunNote: "Dry run · 7 days",
    startDryRun: "Start dry run",
    noFundsAtRisk: "No funds at risk during dry run",
  },

  // ── The mandate itself ─────────────────────────────────────────
  // Invented figures. They are the same in both languages — a number is a
  // number — so only the words around them differ.
  mandate: {
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
    ] as MandateRow[],
    railRows: [
      ["Capital", "$2,000.00", "neutral"],
      ["Posture", "MODERATE", "neutral"],
      ["Max position", "15%", "neutral"],
      ["Max drawdown", "20%", "neutral"],
      ["Universe", "15 OF 18", "accent"],
      ["Compliance", "SHARIAH", "accent"],
      ["Cadence", "HOURLY", "neutral"],
      ["Max hold", "10 DAYS", "neutral"],
    ] as MandateRow[],
    autonomyRailRows: [
      ["Capital", "$2,000.00", "neutral"],
      ["Posture", "MODERATE", "neutral"],
      ["Max position", "15%", "neutral"],
      ["Max drawdown", "20%", "neutral"],
      ["Universe", "15 OF 18", "neutral"],
      ["Compliance", "SHARIAH", "neutral"],
      ["Autonomy", "ADVISORY", "accent"],
      ["Term", "90 DAYS", "neutral"],
    ] as MandateRow[],
    parse: {
      left: [
        ["Capital", "$2,000"],
        ["Universe", "SOLANA SPOT"],
        ["Strategy", "MOMENTUM"],
        ["Posture", "MODERATE"],
      ] as Pair[],
      right: [
        ["Max position", "15%"],
        ["Max drawdown", "20%"],
        ["Autonomy", "APPROVE EACH"],
        ["Term", "90 DAYS"],
      ] as Pair[],
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
      { label: "Max position size", value: "15%", fraction: 15 / 30, min: "0%", max: "30%" },
      { label: "Max drawdown", value: "20%", fraction: 20 / 40, min: "0%", max: "40%" },
      { label: "Liquidity floor", value: "$50K", fraction: 50 / 250, min: "$0", max: "$250K" },
      { label: "Slippage cap", value: "1.50%", fraction: 1.5 / 5, min: "0%", max: "5%" },
    ],
    drawdownWarning: {
      title: "A 20% drawdown on $2,000 is −$400.00",
      body: "The agent halts automatically at that loss and revokes nothing until you act. This agent's worst recorded drawdown over 5 months was 14.3%.",
    },
  },

  constraintsData: {
    universeModes: [
      { name: "Everything it trades", body: "All 18 assets in the agent's universe.", active: false },
      {
        name: "Exclude specific assets",
        body: "Start from all 18 and remove the ones you do not want.",
        active: true,
      },
      { name: "Allow specific only", body: "Start from nothing and pick individually.", active: false },
    ],
    complianceProfiles: [
      {
        name: "Shariah",
        body: "Blocks meme categories, interest-bearing protocols and leverage.",
        meta: "3 screens",
        metaTone: "muted" as MetaTone,
        active: true,
      },
      {
        name: "None",
        body: "No compliance screening. The risk limits still apply.",
        meta: "0 screens",
        metaTone: "muted" as MetaTone,
        active: false,
      },
      {
        name: "Custom",
        body: "Bring your own screening rules via an adapter.",
        meta: "Partner only",
        metaTone: "warning" as MetaTone,
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
  },

  autonomyData: {
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
    comparison: [
      ["Who approves each trade", "You, in your wallet", "The council"],
      ["Times you would be asked", "7 in 30 days", "Never"],
      ["Outside 09:00–18:00", "4 of the 7", "—"],
      ["Signal to fill", "Your response time", "1.9s median"],
      ["If you do not respond in 15 min", "The proposal expires", "—"],
      ["Caps and compliance", "Identical", "Identical"],
      ["Kill switch", "Always available", "Always available"],
    ] as ComparisonRow[],
    expires: "25 Oct 2026",
    atExpiry: [
      "The agent stops opening new positions immediately.",
      "Open positions stay in your wallet and remain yours to close.",
      "The wallet delegation lapses on its own, with no action from you.",
    ],
  },

  walletData: {
    provider: "Privy embedded · Solana mainnet",
    scope: [
      ["Total spend cap", "$2,000.00", "ENCLAVE", "accent"],
      ["Per-transaction cap", "$300.00", "ENCLAVE", "accent"],
      ["Permitted venue", "JUPITER V6", "ON-CHAIN", "accent"],
      ["Withdrawal target", "YOUR ADDRESS ONLY", "ON-CHAIN", "accent"],
      ["Delegation expiry", "90 DAYS", "ON-CHAIN", "accent"],
      ["Revocation", "UNILATERAL, ANY TIME", "ON-CHAIN", "accent"],
      ["Permitted assets", "SOL · JUP · JTO · +14", "APPLICATION", "warning"],
    ] as ScopeRow[],
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
    ] as MandateRow[],
  },

  fundData: {
    balance: [
      { label: "In wallet", value: "$5,240.00" },
      { label: "Mandate size", value: "$2,000.00", tone: "accent" as Tone },
      { label: "Remains free", value: "$3,240.00" },
    ],
    balanceNote:
      "Funds stay in your wallet. The mandate size is the ceiling the delegation may spend against, not an amount transferred to Canopy.",
    checks: [
      {
        name: "Minimum viable capital",
        value: "$420.00",
        result: "Pass",
        tone: "accent" as MetaTone,
        body: "Below this, a 15% position is smaller than the venue minimum trade size.",
      },
      {
        name: "Concurrent positions supported",
        value: "6",
        result: "Pass",
        tone: "accent" as MetaTone,
        body: "At 15% max position, $2,000 supports six positions before cash is exhausted.",
      },
      {
        name: "Fee drag at this size",
        value: "0.42% / MO",
        result: "Pass",
        tone: "accent" as MetaTone,
        body: "Estimated venue and network fees as a share of deployed capital.",
      },
      {
        name: "Cash buffer after full deployment",
        value: "$200.00",
        result: "Thin",
        tone: "warning" as MetaTone,
        body: "10% of the mandate. Below 15% the agent may be unable to act on a new signal.",
      },
    ],
    readiness: ["Mandate defined", "Constraints set", "Autonomy chosen", "Delegation granted"],
    firstRun:
      "The agent starts in dry run. It runs the full pipeline against live data and records what it would have done, without executing. You promote it to live when you are satisfied.",
  },
};

/**
 * The Chinese bundle, shaped identically. `Copy` below is derived from EN, so
 * a key added to one and not the other fails the typecheck here rather than
 * rendering `undefined` on a page.
 */
type Copy = typeof EN;

const ZH: Copy = {
  agentLabel: "智能体",
  capitalLabel: "资金",
  classLabel: "类别",
  venueLabel: "交易场所",
  modeLabel: "模式",
  custodyLabel: "托管",
  delegationLabel: "授权",
  statusLabel: "状态",
  back: "返回",

  describe: {
    eyebrow: "新建授权",
    title: "这个智能体该做什么？",
    classValue: "现货",
    venueValue: "SOLANA",
    secIntent: "意图",
    secIntentNote: "用大白话描述 · 自动解析成授权",
    charCount: "{used} / 500",
    noJargon: "不需要任何交易术语",
    presetsLabel: "预设",
    presets: ["低风险 SOL 动量", "土狗狙击 · 紧止损", "只赚 LP 手续费"],
    parseOutput: "解析结果",
    parseCount: "已识别 {resolved} 项 · 使用默认值 {defaulted} 项",
    secCapital: "资金",
    secCapitalNote: "钱包余额  {balance} USDC",
    allocation: "配置比例",
    allocationValue: "占余额的 {pct}%",
    capitalStops: ["500", "1,000", "2,000", "5,240 · 全部"],
    secPosture: "风险风格",
    secPostureNote: "根据您的描述推断",
    postureCols: { pos: "单笔", dd: "回撤", slip: "滑点" },
    secLimits: "限额",
    secLimitsNote: "只能收紧 · 不能超出智能体本身的设计",
    targetAgent: "目标智能体",
    targetAgentSub: "现货 · Solana · 90 日 +18.2%",
    continue: "继续设置约束",
    proceedNote: "目前尚未签署，也尚未注资",
  },

  constraints: {
    eyebrow: "新建授权 · 第 02 步",
    title: "划定边界",
    subtitle: "您可以收窄智能体能碰的范围，但无法把它放宽到超出自身设计的程度。",
    universeLabel: "标的池",
    universeValue: "18 选 15",
    secUniverse: "标的池",
    secUniverseNote: "智能体可交易 18 个 · 您已允许 15 个",
    excluded: "您排除的 · {count}",
    addExclusion: "+ 添加排除项",
    allowed: "已允许 · {count}",
    secCompliance: "合规档案",
    secComplianceNote: "在任何定量之前先行应用",
    secCadence: "运行频率",
    secCadenceNote: "它多久看一次",
    continue: "继续设置自主级别",
  },

  autonomy: {
    eyebrow: "新建授权 · 第 03 步",
    title: "成交前要不要先问您？",
    subtitle: "两种模式下的限额完全一样。这里只决定成交之前是否有人参与其中。",
    modeValue: "需确认",
    secLevel: "自主级别",
    secLevelNote: "之后可更改 · 下个周期生效",
    secChanges: "实际会有什么不同",
    secChangesNote: "基于该智能体最近 30 天的数据",
    byHour: "它会在什么时候来问您 · 按小时（UTC）",
    within: "在 09:00–18:00 之内",
    outside: "在此之外",
    colAdvisory: "需确认",
    colDelegated: "已授权",
    secTerm: "授权期限",
    secTermNote: "智能体会自行停止",
    days: "{count} 天",
    expires: "{date} 到期",
    scaleMin: "7 天",
    scaleMax: "365 天",
    autoRenewTitle: "自动续期已关闭",
    autoRenewBody: "我们不会悄悄延长您的授权。续期需要您重新签名一次。",
    off: "关闭",
    atExpiry: "到期时",
    continue: "继续设置钱包",
    proceedNote: "之后无需重新部署即可切换为已授权模式",
  },

  wallet: {
    eyebrow: "新建授权 · 第 04 步",
    title: "授予一份限定范围的委托",
    custodyValue: "由您托管",
    secSource: "来源钱包",
    ownedByYou: "由您持有 · 不属于 Canopy",
    balance: "余额",
    change: "更换",
    keysTitle: "您的私钥永远不会离开这个钱包",
    keysBody:
      "Canopy 无法代替您签名，也无法把资金转出您在下方授予的范围之外。授予委托不等于转账。在智能体执行您已授权的交易之前，这个钱包不会有任何资金流出。",
    secScope: "委托范围",
    secScopeNote: "智能体可以做什么",
    colParameter: "参数",
    colValue: "取值",
    colEnforcedBy: "由谁强制执行",
    secImpossible: "边界之外",
    secImpossibleNote: "结构上不可能 · 而不是靠制度约束",
    secRevocation: "撤销",
    secRevocationNote: "立即生效",
    revocationIntro:
      "您随时可以从三个地方结束这项委托。它们都不需要 Canopy 在线，也不需要 Canopy 同意。",
    grantSummary: "授权摘要",
    youWillSign: "您将签署",
    youWillSignNote: "一条消息 · 不是转账",
    payloadTitle: "Canopy Agent Delegation v1",
    humanReadable: "可读版本",
    viewRaw: "查看原始载荷",
    reviewInWallet: "在钱包中确认",
    backToAutonomy: "返回自主级别",
    proceedNote: "Canopy 永远不会拿到您的私钥。在智能体执行之前不会有任何资金转移。",
  },

  fund: {
    eyebrow: "新建授权 · 第 05 步",
    title: "为授权注资",
    delegationValue: "已授予",
    statusValue: "等待注资",
    secBalance: "余额",
    secBalanceNote: "钱包 7xKX…9mQt",
    secAdequacy: "资金充足度",
    secAdequacyNote: "针对该策略计算",
    colCheck: "检查项",
    colValue: "取值",
    colResult: "结果",
    readiness: "就绪情况",
    readinessCount: "4 / 4",
    firstRun: "首次运行",
    firstRunNote: "空跑 · 7 天",
    startDryRun: "开始空跑",
    noFundsAtRisk: "空跑期间不会有任何资金处于风险中",
  },

  mandate: {
    intent:
      "用大约 $2,000 交易 Solana 动量。风险保持中等，任何单一代币的仓位不要超过 15%，亏损到 20% 就全部停掉。每笔交易前先问我。",
    intentChars: 188,
    readsAs:
      "用 $2,000 交易 Solana 现货动量。中等风险。单笔仓位不超过 15%。亏损 −20% 时全部停止。每笔交易前先询问。90 天后到期。",
    readsAsWithCompliance:
      "用 $2,000 交易 Solana 现货动量。中等风险。单笔仓位不超过 15%。亏损 −20% 时全部停止。跳过伊斯兰教法筛查标记的标的。每笔交易前先询问。90 天后到期。",
    capital: "$2,000.00",
    walletBalance: "$5,240.00",
    allocationPct: 38.2,
    rows: [
      ["资金", "$2,000.00", "neutral"],
      ["风格", "中等", "neutral"],
      ["单笔上限", "15%", "neutral"],
      ["最大回撤", "20%", "neutral"],
      ["最低流动性", "$50,000", "neutral"],
      ["滑点上限", "1.50%", "neutral"],
      ["自主级别", "逐笔确认", "accent"],
      ["期限", "90 天", "neutral"],
    ] as MandateRow[],
    railRows: [
      ["资金", "$2,000.00", "neutral"],
      ["风格", "中等", "neutral"],
      ["单笔上限", "15%", "neutral"],
      ["最大回撤", "20%", "neutral"],
      ["标的池", "18 选 15", "accent"],
      ["合规", "伊斯兰教法", "accent"],
      ["运行频率", "每小时", "neutral"],
      ["最长持有", "10 天", "neutral"],
    ] as MandateRow[],
    autonomyRailRows: [
      ["资金", "$2,000.00", "neutral"],
      ["风格", "中等", "neutral"],
      ["单笔上限", "15%", "neutral"],
      ["最大回撤", "20%", "neutral"],
      ["标的池", "18 选 15", "neutral"],
      ["合规", "伊斯兰教法", "neutral"],
      ["自主级别", "需确认", "accent"],
      ["期限", "90 天", "neutral"],
    ] as MandateRow[],
    parse: {
      left: [
        ["资金", "$2,000"],
        ["标的池", "SOLANA 现货"],
        ["策略", "动量"],
        ["风格", "中等"],
      ] as Pair[],
      right: [
        ["单笔上限", "15%"],
        ["最大回撤", "20%"],
        ["自主级别", "逐笔确认"],
        ["期限", "90 天"],
      ] as Pair[],
      resolved: 8,
      defaulted: 2,
      warning: "您没有指定最低流动性或滑点上限。系统已套用智能体的默认值，并在第 04 节中列出。",
    },
    postures: [
      { name: "保守", pos: "8%", dd: "10%", slip: "1.2%", active: false },
      { name: "中等", pos: "15%", dd: "20%", slip: "1.5%", active: true },
      { name: "激进", pos: "25%", dd: "35%", slip: "2.5%", active: false },
    ],
    limits: [
      { label: "单笔仓位上限", value: "15%", fraction: 15 / 30, min: "0%", max: "30%" },
      { label: "最大回撤", value: "20%", fraction: 20 / 40, min: "0%", max: "40%" },
      { label: "最低流动性", value: "$50K", fraction: 50 / 250, min: "$0", max: "$250K" },
      { label: "滑点上限", value: "1.50%", fraction: 1.5 / 5, min: "0%", max: "5%" },
    ],
    drawdownWarning: {
      title: "$2,000 上 20% 的回撤就是 −$400.00",
      body: "亏到这个幅度智能体会自动停止，并且在您采取行动之前不会撤销任何东西。该智能体 5 个月来记录到的最大回撤是 14.3%。",
    },
  },

  constraintsData: {
    universeModes: [
      { name: "它能交易的全部", body: "该智能体标的池中的全部 18 个资产。", active: false },
      { name: "排除指定资产", body: "从全部 18 个开始，移除您不想要的。", active: true },
      { name: "只允许指定资产", body: "从零开始，逐个挑选。", active: false },
    ],
    complianceProfiles: [
      {
        name: "伊斯兰教法",
        body: "屏蔽土狗类别、带息协议以及杠杆。",
        meta: "3 项筛查",
        metaTone: "muted" as MetaTone,
        active: true,
      },
      {
        name: "无",
        body: "不做合规筛查。风险限额依然生效。",
        meta: "0 项筛查",
        metaTone: "muted" as MetaTone,
        active: false,
      },
      {
        name: "自定义",
        body: "通过适配器接入您自己的筛查规则。",
        meta: "仅限合作方",
        metaTone: "warning" as MetaTone,
        active: false,
      },
    ],
    complianceNote:
      "启用伊斯兰教法筛查后，该智能体的土狗类候选标的会在council评议阶段被拦截。按最近 30 天计算，这会拦掉它 7 个方案中的 4 个。如果您想要那些标的，请把档案切换为「无」— 无论哪种设置，仓位和回撤上限都不会改变。",
    cadence: [
      { label: "周期间隔", value: "每小时", note: "每天 24 个周期" },
      { label: "交易时段", value: "24 / 7", note: "没有静默时段" },
      { label: "最长持有", value: "10 天", note: "智能体默认值，已从 30 天收紧" },
    ],
  },

  autonomyData: {
    modes: [
      {
        name: "需确认",
        body: "council 会完成到成交之前的所有工作，然后停下来问您。由您在自己的钱包里批准。",
        points: [
          "没有您的签名，不会执行任何交易",
          "决定之前您能看到完整的推理过程",
          "如果 15 分钟内没有处理，方案会过期",
        ],
        tag: "首次授权推荐",
        active: true,
      },
      {
        name: "已授权",
        body: "council 会在您设定的上限内直接执行。您会在事后收到通知，而不是事前被询问。",
        points: [
          "您睡觉时交易照样发生",
          "任何交易都不会超出您的上限 — 它们在安全区内强制执行",
          "您随时可以撤销，立即生效",
        ],
        tag: "更快 · 无需人工介入",
        active: false,
      },
    ],
    comparison: [
      ["谁批准每一笔交易", "您，在自己的钱包里", "council"],
      ["您会被询问的次数", "30 天内 7 次", "从不"],
      ["在 09:00–18:00 之外", "7 次中的 4 次", "—"],
      ["从信号到成交", "取决于您的响应速度", "中位 1.9 秒"],
      ["如果 15 分钟内未响应", "方案过期", "—"],
      ["上限与合规", "完全相同", "完全相同"],
      ["紧急停止", "随时可用", "随时可用"],
    ] as ComparisonRow[],
    expires: "2026 年 10 月 25 日",
    atExpiry: [
      "智能体会立即停止开新仓。",
      "已有持仓仍在您的钱包里，仍然由您决定何时平掉。",
      "钱包授权会自行失效，您不需要做任何事。",
    ],
  },

  walletData: {
    provider: "Privy 内嵌钱包 · Solana 主网",
    scope: [
      ["累计支出上限", "$2,000.00", "安全区", "accent"],
      ["单笔交易上限", "$300.00", "安全区", "accent"],
      ["允许的交易场所", "JUPITER V6", "链上", "accent"],
      ["提现目标地址", "仅限您本人的地址", "链上", "accent"],
      ["授权到期", "90 天", "链上", "accent"],
      ["撤销", "单方面，随时", "链上", "accent"],
      ["允许的资产", "SOL · JUP · JTO · 另 14 项", "应用层", "warning"],
    ] as ScopeRow[],
    scopeNote:
      "「链上」和「安全区」这两类限制，即使 Canopy 的代码写错了也依然成立。资产白名单由应用层代码里的风控闸门执行，因此那里的缺陷可能放行一个未列出的资产。但它无法突破支出上限。",
    impossible: [
      {
        title: "把资金转给您以外的任何地址",
        body: "提现指令在链上被限定为只能转回授予这份委托的那个钱包。",
      },
      {
        title: "支出超过 $2,000，或单笔超过 $300",
        body: "这两个上限都在签名安全区内校验，位于 Canopy 应用层代码之下。",
      },
      {
        title: "自行延长授权",
        body: "到期时间在签名时就已固定。延长需要您重新签名一次。",
      },
      {
        title: "在您撤销之后继续交易",
        body: "撤销在钱包层面立即生效，不依赖 Canopy 是否可达。",
      },
    ],
    revocation: [
      {
        where: "智能体页面",
        action: "停止并撤销",
        body: "一次操作即可停止调度并撤销授权。",
      },
      {
        where: "钱包设置",
        action: "已连接的应用",
        body: "直接从您的钱包里撤销 Canopy 的授权。",
      },
      {
        where: "服务提供方",
        action: "Privy 控制台",
        body: "在服务提供方处撤销，独立于 Canopy 和本应用。",
      },
    ],
    revocationWarning: {
      title: "撤销授权并不会平掉已有持仓",
      body: "持仓仍在您的钱包里，仍然属于您。智能体只是不再管理它们，也就意味着它不会再挂止损单。请自行平仓，或者先清仓再撤销。",
    },
    grantSummary: [
      ["被授权方", "alpha_hunter", "neutral"],
      ["支出上限", "$2,000.00", "neutral"],
      ["单笔上限", "$300.00", "neutral"],
      ["交易场所", "JUPITER V6", "neutral"],
      ["到期", "2026 年 10 月 25 日", "neutral"],
      ["可撤销", "是", "accent"],
      ["可转让", "否", "accent"],
    ] as MandateRow[],
  },

  fundData: {
    balance: [
      { label: "钱包内", value: "$5,240.00" },
      { label: "授权额度", value: "$2,000.00", tone: "accent" as Tone },
      { label: "剩余自由资金", value: "$3,240.00" },
    ],
    balanceNote:
      "资金始终留在您的钱包里。授权额度是这份委托最多可以动用的上限，而不是转给 Canopy 的金额。",
    checks: [
      {
        name: "最低可行资金",
        value: "$420.00",
        result: "通过",
        tone: "accent" as MetaTone,
        body: "低于这个数额，15% 的仓位会小于交易场所的最小成交量。",
      },
      {
        name: "可同时持有的仓位数",
        value: "6",
        result: "通过",
        tone: "accent" as MetaTone,
        body: "按单笔最高 15% 计算，$2,000 可以支撑六个仓位，之后现金就用完了。",
      },
      {
        name: "该规模下的手续费拖累",
        value: "0.42% / 月",
        result: "通过",
        tone: "accent" as MetaTone,
        body: "预估的交易场所与网络手续费占已部署资金的比例。",
      },
      {
        name: "满仓后的现金缓冲",
        value: "$200.00",
        result: "偏薄",
        tone: "warning" as MetaTone,
        body: "占授权额度的 10%。低于 15% 时，智能体可能无法对新信号做出反应。",
      },
    ],
    readiness: ["授权已定义", "约束已设定", "自主级别已选择", "委托已授予"],
    firstRun:
      "智能体会先以空跑模式启动。它会用实时数据完整跑一遍流程，记录它本来会做什么，但不实际执行。等您满意之后，再把它切换为实盘。",
  },
};

export function deployCopy(locale: Locale): Copy {
  return locale === "zh" ? ZH : EN;
}

/** `{name}` substitution, the same shape `useT()` uses. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] != null ? String(vars[name]) : `{${name}}`,
  );
}
