// The backend seam.
//
// `lib/data.ts` was always designed as the single place the screens get their
// figures from, so wiring a real backend means replacing that module rather
// than touching sixteen pages. This file is the replacement: one typed function
// per endpoint on canopy-be's /api/agents surface.
//
// AUTH: every agent route requires a verified Privy access token in an
// Authorization header. It does NOT accept a privyId in the query string — that
// is canopy-be's legacy pattern and the agent routes deliberately do not have
// it. Callers pass the token they already hold from the Privy client.

const BASE = process.env.NEXT_PUBLIC_CANOPY_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    // These screens show money. A stale cached balance is worse than a spinner.
    cache: "no-store",
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* non-JSON error body; the status text will do */
    }
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as T;
}

/* ------------------------------------------------------------ marketplace -- */

export interface StrategyRow {
  id: number;
  name: string;
  strategy_class: string;
  /**
   * Bar size the technical rules are measured on. Absent on strategies
   * authored before timeframes existed, which were all daily — so a reader
   * must default it rather than treat it as unknown.
   */
  timeframe?: "1d" | "1h" | "30m" | "15m" | "5m" | null;
  status: "draft" | "verifying" | "published" | "delisted" | "superseded";
  fee_pct: string;
  author: string;
  deployments: string;
  aum_usd: string;
  published_at: string | null;
  verification_started_at: string | null;
  /** Set when this strategy was created by editing a verifying one. */
  forked_from_id?: number | null;
  /** Realised only. Open positions are not marked into a listed record. */
  realized_pnl_usd: string;
  mandate_capital_usd: string;
  closed_positions: string;
  winning_positions: string;
  /** True while no agent under this strategy has ever traded real funds. */
  all_paper: boolean;
  /** Authored by the signed-in user. Decides the row's action, not its visibility. */
  is_mine: boolean;
  /** Live exposure right now. */
  open_positions: string;
  /** Positions opened in the trailing 30 days. */
  trades_30d: string;
  /** Realised in the trailing 30 days only — old wins stop advertising themselves. */
  realized_30d_usd: string;
  /**
   * The record agent's equity readings, oldest last. Real: taken from the desk
   * decision rows, not generated from the row id.
   */
  spark: string[] | null;

  /* ---- present only on `getStrategy`, which selects s.* --------------------
   *
   * The marketplace list endpoint selects a narrow column set and an aggregate
   * `spark`, so none of these arrive there. They are optional for that reason,
   * NOT because the backend sometimes omits them on the detail route. */

  /** The rules the SME evaluates. The recipe — withheld from the public page. */
  rules?: DetectionRule[];
  /** What the strategy may trade. Empty means the whole class. */
  universe?: UniverseSelection[];
  exits?: ExitRules | null;
  safety_floor?: Record<string, unknown> | null;
  /** Seconds between cycles. Copied on fork; never editable. */
  tick_interval_sec?: number;
  /**
   * How the strategy accumulates. Null means one entry per asset.
   *
   * Arrives on the DETAIL route only, which selects s.* — and it is recipe, not
   * record: the marketplace and the public strategy page deliberately show
   * neither rules nor thresholds, and a plan describes the strategy's shape as
   * plainly as a rule does.
   */
  add_plan?: AddPlan | null;
  created_at?: string;
}

/**
 * A usable number from the wire, or null.
 *
 * Fields added to the API arrive as `undefined` from an older build, not null —
 * so `x === null` misses them and the value flows into arithmetic as NaN. That
 * renders as "$NaN" or "+NaN%", which is worse than a crash because it looks
 * like a figure. Every optional number off the wire goes through here.
 */
export function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Realised return against mandate capital, or null when nothing has closed. */
export function realizedReturnPct(s: StrategyRow): number | null {
  const capital = num(s.mandate_capital_usd);
  const pnl = num(s.realized_pnl_usd);
  if (!capital || pnl === null || num(s.closed_positions) === 0) return null;
  return (pnl / capital) * 100;
}

/**
 * Realised return over the trailing 30 days, against mandate capital.
 *
 * Null when nothing closed in the window — distinct from 0%, which would claim
 * it traded and broke even.
 */
export function return30dPct(s: StrategyRow): number | null {
  const capital = num(s.mandate_capital_usd);
  const pnl = num(s.realized_30d_usd);
  if (!capital || pnl === null || pnl === 0) return null;
  return (pnl / capital) * 100;
}

/** Hit rate across closed positions, or null before there are any. */
export function hitRatePct(s: StrategyRow): number | null {
  const closed = num(s.closed_positions);
  const won = num(s.winning_positions);
  if (!closed || won === null) return null;
  return (won / closed) * 100;
}

export const listStrategies = (token: string) =>
  request<{ strategies: StrategyRow[] }>("/agents/strategies", token);

export const getStrategy = (token: string, id: number) =>
  request<{ strategy: StrategyRow; verification: VerificationStatus; isMine: boolean }>(
    `/agents/strategies/${id}`,
    token,
  );

/* ---------------------------------------------------------- verification -- */

export interface PublishCheck {
  key: string;
  name: string;
  value: string;
  passed: boolean;
}

export interface VerificationStatus {
  strategyId: number;
  status: string;
  startedAt: string | null;
  day: number;
  totalDays: number;
  checks: PublishCheck[];
  stats: {
    paperReturnPct: number;
    maxDrawdownPct: number;
    proposed: number;
    blocked: number;
    wouldFill: number;
  };
  publishable: boolean;
  remaining: string[];
}

/** A rule the SME evaluates. `key` must match a fact the SME actually gathers. */
export interface DetectionRule {
  key: string;
  op: "gte" | "lte" | "eq";
  value: number;
}

/**
 * One asset an author may pick, as the backend resolved it.
 *
 * No mint. The picker chooses intent — "Apple, via Backed" — and the address is
 * resolved fresh server-side at every boot, so a stored address can never start
 * pointing somewhere else.
 */
export interface UniverseAsset {
  underlying: string;
  issuer: string;
  symbol: string;
  assetClass: "equity" | "etf" | "commodity";
  calendar: string;
  hasFilings: boolean;
  /** Jupiter mark. Null when the pool could not be priced. */
  priceUsd: number | null;
  /** Pool depth, not traded volume — nothing here measures volume. */
  liquidityUsd: number | null;
  /** Daily close-to-close from research, NOT a rolling 24 hours. */
  changePct: number | null;
}

/**
 * When the agent closes. Percentages are MAGNITUDES: stopLossPct 20 means close
 * 20% down. A signed convention would eventually be read the wrong way round,
 * and backwards inverts a stop into a target.
 */
export interface ExitRules {
  takeProfitPct: number;
  stopLossPct: number;
  /** Zero or absent means never on time alone. */
  maxHoldDays?: number;
}

/** What a strategy may trade. An empty array means the whole class — "Auto". */
export interface UniverseSelection {
  underlying: string;
  issuer?: string;
}

/**
 * The assets a strategy of this class could trade right now.
 *
 * This is the resolved universe, not the seed list: an asset that failed
 * registry/research/chain agreement is absent here rather than selectable and
 * then permanently silent.
 */
export const getUniverse = (token: string, strategyClass = "rwa") =>
  request<{ assets: UniverseAsset[]; note?: string }>(
    `/agents/universe?class=${encodeURIComponent(strategyClass)}`,
    token,
  );

/**
 * A strategy draft composed from a sentence.
 *
 * The model selects; the backend decides. It cannot return an asset that failed
 * universe resolution, a rule the SME does not gather, an inverted comparator,
 * or a value outside the builder's own ranges — so a draft is always something
 * the manual path could also have produced.
 */
export interface ComposedDraft {
  strategyClass: string;
  universe: UniverseSelection[];
  rules: DetectionRule[];
  exits: ExitRules;
  /** Bar size the rules are measured on. Always concrete. */
  timeframe?: "1d" | "1h" | "30m" | "15m" | "5m";
  /** Set only when the description asked to buy repeatedly. */
  addPlan?: AddPlan;
  /** One sentence on how the request was read. */
  reading: string;
}

export const composeAgent = (token: string, prompt: string) =>
  request<{ draft: ComposedDraft | null; notes: string[] }>("/agents/compose", token, {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });

/**
 * How a strategy accumulates. Mirrors the backend contract — the same shape is
 * validated there by resolveAddPlan, which is the authority. Absent means one
 * entry per asset.
 */
export type AddTrigger =
  | { kind: "schedule"; everySec: number }
  | { kind: "drawdown"; pct: number }
  | { kind: "gain"; pct: number }
  // Re-runs the strategy's own entry rules before each add. The only condition
  // that notices the situation changing while the price holds up.
  | { kind: "rules" };

export type AddSizing =
  | { kind: "fixedUsd"; usd: number }
  | { kind: "pctOfCapital"; pct: number }
  | { kind: "ladder"; baseUsd: number; factor: number };

export interface AddPlan {
  mode: "all" | "any";
  triggers: AddTrigger[];
  sizing: AddSizing;
  maxAdds?: number;
  maxTotalUsd?: number;
  minSpacingSec?: number;
}

export const createStrategy = (
  token: string,
  body: {
    name: string;
    strategyClass: string;
    rules: DetectionRule[];
    safetyFloor?: Record<string, unknown>;
    feePct?: number;
    /** Empty or omitted means every asset in the class. */
    universe?: UniverseSelection[];
    /** Omitted falls back to the platform defaults for the agent's posture. */
    exits?: ExitRules;
    /** Seconds between cycles. 300–86400; refused outside that, not clamped. */
    tickIntervalSec?: number;
    /** Bar size the technical rules are measured on. Omitted means daily. */
    timeframe?: "1d" | "1h" | "30m" | "15m" | "5m";
    /** Accumulation. Omitted means one entry per asset. */
    addPlan?: AddPlan | null;
  },
) =>
  // `warnings` are plans that are legal but probably not what the author meant —
  // an add deeper than the stop, an unbounded ladder. They are not errors and
  // must be shown rather than swallowed: the whole point is that the combination
  // is individually sensible, so nothing else will reveal it.
  request<{ strategy: StrategyRow; notes?: string[]; warnings?: string[] }>(
    "/agents/strategies",
    token,
    { method: "POST", body: JSON.stringify(body) },
  );

export const getVerification = (token: string, strategyId: number) =>
  request<{ verification: VerificationStatus }>(
    `/agents/strategies/${strategyId}/verification`,
    token,
  );

/**
 * Starts the paper run and returns the agent that will run it — the caller
 * navigates there. A paper run the creator cannot find is not much of one.
 */
export const startPaperRun = (token: string, strategyId: number) =>
  request<{ agentId: number; verification: VerificationStatus }>(
    `/agents/strategies/${strategyId}/verify`,
    token,
    { method: "POST" },
  );

/**
 * Publishing can legitimately fail with 409 when the window is not complete.
 * That is a normal outcome to render, not an error to swallow — the caller
 * shows `remaining` back to the creator.
 */
export const publishStrategy = (token: string, strategyId: number) =>
  request<{ verification: VerificationStatus }>(
    `/agents/strategies/${strategyId}/publish`,
    token,
    { method: "POST" },
  );

/** Editing a verifying strategy forks it and restarts the clock. */
export const forkStrategy = (
  token: string,
  strategyId: number,
  edits: { rules?: unknown; safetyFloor?: unknown; name?: string },
) =>
  request<{ newStrategyId: number; verification: VerificationStatus }>(
    `/agents/strategies/${strategyId}/fork`,
    token,
    { method: "POST", body: JSON.stringify(edits) },
  );

/* --------------------------------------------------------------- creator -- */

export const getCreatorDashboard = (token: string) =>
  request<{
    strategies: StrategyRow[];
    counts: { live: number; verifying: number; delisted: number; superseded: number };
  }>("/agents/creator", token);

/* ------------------------------------------------------------- deployment -- */

/**
 * The mandate an agent was deployed under. Stored as JSONB and returned whole.
 *
 * Every field is optional: it is a document written at deploy time, not a
 * schema, and older agents were deployed before some of the keys existed.
 */
export interface AgentMandate {
  capitalUsd?: number;
  riskPosture?: string;
  horizon?: string;
  autonomy?: string;
  tickIntervalSec?: number;
  expiresAt?: string | null;
  constraints?: {
    /** Ceiling on one position, as a percentage of mandate capital. */
    maxPositionPct?: number;
    /** The breaker: past this fall from the high-water mark the agent liquidates. */
    maxDrawdownPct?: number;
    maxTradesPerTick?: number;
    allow?: string[];
    deny?: string[];
    complianceProfile?: string;
  };
}

/**
 * A deployed agent, as `GET /agents` returns it.
 *
 * The handler selects `a.*`, so every column of trading_agents is on the wire.
 * The fields below the original block were always arriving and simply were not
 * typed — `created_at` in particular is the only deploy timestamp there is.
 */
export interface AgentRow {
  id: number;
  strategy_id: number;
  strategy_name: string;
  strategy_class: string;
  /** `liquidating` is winding down after a drawdown breach — still ticking, but only to close. */
  /**
   * `deleted` is a SOFT delete: hidden from the agent list and never
   * scheduled, but every decision row, fill and position is kept. It arrives
   * here only via a direct link, since the list filters it out.
   */
  status: "draft" | "active" | "paused" | "stopped" | "liquidating" | "deleted";
  capital_usd: string;
  autonomy: "propose_only" | "execute_with_caps";
  is_paper: boolean;
  high_water_mark_usd: string | null;
  next_tick_at: string | null;
  last_tick_at: string | null;
  /**
   * When the mandate runs out. No agent runs forever unattended, and a wallet
   * delegation is scoped to this same clock. Only the detail route returns it.
   */
  expires_at?: string;
  /** Deploy time. There is no separate started_at — this is it. */
  created_at: string;
  updated_at?: string;
  /** Why it stopped ticking. Written by the breaker, not by a human pause. */
  paused_reason?: string | null;
  /** Opaque provider ref. The wallet ADDRESS only comes back from `getAgent`. */
  wallet_ref?: string | null;
  mandate?: AgentMandate;
  /** Unsettled messages needing a human. Drives the rail count. */
  needs_you?: string;
}

/** One turn in an agent's thread. */
export interface AgentMessage {
  id: string;
  role: "user" | "agent";
  kind: "message" | "event" | "proposal";
  body: string;
  payload: Record<string, unknown>;
  run_id: string | null;
  requires_action: boolean;
  acted_at: string | null;
  created_at: string;
}

export const getMessages = (token: string, agentId: number, limit = 100) =>
  request<{ messages: AgentMessage[] }>(
    `/agents/${agentId}/messages?limit=${limit}`,
    token,
  );

/** What the agent is doing right now. Real pipeline boundaries, not a timer. */
export type TurnStage = "reading" | "drafting" | "searching";

/**
 * Sends a message and reports progress as the turn runs.
 *
 * One message costs two to five sequential model calls, so the wait is long
 * enough that silence reads as breakage. This streams the stage boundaries as
 * they happen and yields the finished messages at the end.
 *
 * `fetch` with a reader rather than `EventSource`, for two reasons that both
 * rule EventSource out: it cannot POST, and it cannot send an Authorization
 * header. Every route on this surface requires a bearer token.
 */
export async function sendMessageStreaming(
  token: string,
  agentId: number,
  body: string,
  onStage: (stage: TurnStage) => void,
  /** Called with each chunk of the answer as the model produces it. */
  onDelta?: (text: string) => void,
): Promise<AgentMessage[]> {
  const res = await fetch(`${BASE}/api/agents/${agentId}/messages?stream=1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ body }),
    cache: "no-store",
  });

  if (!res.ok || !res.body) {
    let message = res.statusText;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) message = j.error;
    } catch {
      /* non-JSON body; the status text will do */
    }
    throw new ApiError(res.status, message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let messages: AgentMessage[] = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Frames are separated by a blank line. The LAST fragment is kept back
    // rather than parsed: a frame split across two network reads would
    // otherwise be dropped as malformed JSON, silently losing the messages
    // event and leaving the thread looking like nothing happened.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      let event: {
        type?: string;
        stage?: TurnStage;
        text?: string;
        messages?: AgentMessage[];
        message?: string;
      };
      try {
        event = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      if (event.type === "stage" && event.stage) onStage(event.stage);
      else if (event.type === "delta" && typeof event.text === "string") onDelta?.(event.text);
      else if (event.type === "messages" && event.messages) messages = event.messages;
      else if (event.type === "error") throw new Error(event.message ?? "The agent stopped early.");
    }
  }

  return messages;
}

export const sendMessage = (token: string, agentId: number, body: string) =>
  request<{ messages: AgentMessage[] }>(`/agents/${agentId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ body }),
  });

/** One field an agent proposes to change, ready to render as a diff. */
export interface ProposedChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

/**
 * Applies a proposed change. Forks the strategy exactly as editing by hand
 * does, so the record stays append-only — and returns the agent that continues.
 */
export const applyProposal = (token: string, agentId: number, messageId: string) =>
  request<{ newStrategyId: number; newAgentId: number }>(
    `/agents/${agentId}/messages/${messageId}/apply`,
    token,
    { method: "POST" },
  );

/** Settles an actionable message so it drops out of the rail count. */
export const ackMessage = (token: string, agentId: number, messageId: string) =>
  request<{ ok: boolean }>(`/agents/${agentId}/messages/${messageId}/ack`, token, {
    method: "POST",
  });

export const listAgents = (token: string) =>
  request<{ agents: AgentRow[] }>("/agents", token);

/**
 * What the backend recorded about a delegation, after checking it with Privy.
 *
 * `ownerModel` is the field worth reading. It comes back as what Privy says is
 * TRUE of the wallet, not as what the grant asked for — so if it returns
 * `app_owned`, the wallet is custodial and the UI must say so rather than
 * repeat the reassuring copy on the grant screen.
 */
export interface RegisteredWallet {
  address: string;
  ownerModel: "user_delegated" | "app_owned";
  policyIds: string[];
  expiresAt: string;
}

/**
 * Records a delegation the user has just granted in the browser.
 *
 * Called AFTER `addSigners` resolves. The two steps are separate because they
 * happen in different places against different authorities — the grant is the
 * user's own session talking to Privy, and this is Canopy noticing. Nothing
 * here is trusted: the backend re-reads the wallet from Privy and refuses
 * anything that does not match.
 */
export const registerAgentWallet = (
  token: string,
  agentId: number,
  body: {
    walletId: string;
    address: string;
    maxSpendUsd: number;
    expiresAt: string;
  },
) =>
  request<RegisteredWallet>(`/agents/${agentId}/wallet`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const deployAgent = (
  token: string,
  body: {
    strategyId: number;
    capitalUsd: number;
    riskPosture?: string;
    horizon?: string;
    constraints?: Record<string, unknown>;
    tickIntervalSec?: number;
  },
) => request<{ agent: AgentRow }>("/agents", token, {
  method: "POST",
  body: JSON.stringify(body),
});

/* ------------------------------------------------------------- monitoring -- */

export interface AgentDetail {
  agent: AgentRow;
  positions: {
    id: number;
    mint: string;
    symbol: string;
    underlying: string | null;
    qty: string;
    cost_basis_usd: string;
    opened_by_sme: string | null;
    opened_by_signal: string | null;
    opened_at: string;
  }[];
  lastRun: { id: string; tick_seq: string; status: string; skip_reason: string | null } | null;
  wallet: {
    address: string;
    chain: string;
    status: "provisioning" | "active" | "revoked";
    ownerModel: "user_delegated" | "app_owned";
    remainingUsd: number;
    expiresAt: string;
  } | null;
  /**
   * Which book the positions above came from — echoed by the server rather
   * than assumed from what was asked for, so the page can never label a paper
   * book as live because a `book` value was defaulted or rejected.
   */
  book: "paper" | "live";
  /** True once the agent has gone live, meaning there is a paper run to look back at. */
  hasPaperHistory: boolean;
}

/**
 * An agent keeps ONE identity across paper and live. It is not two agents:
 * going live flips the same record, carrying its strategy and decision history
 * across, and leaving the paper lots behind as a settled book.
 *
 * `book` chooses which one to show. Omitted means the agent's current mode.
 */
export const getAgent = (token: string, agentId: number, book?: "paper" | "live") =>
  request<AgentDetail>(
    `/agents/${agentId}${book ? `?book=${book}` : ""}`,
    token,
  );

/**
 * One booked fill. Paper fills are INCLUDED and flagged, not filtered —
 * every agent is paper until a signing rail exists, so excluding them would
 * return an empty history to everyone while appearing to work.
 */
export interface AgentFill {
  id: string;
  side: "buy" | "sell" | "add_liquidity" | "remove_liquidity";
  mint: string;
  symbol: string;
  filled_usd: string;
  qty: string;
  price_usd: string;
  fees_usd: string;
  venue: string;
  is_paper: boolean;
  executed_at: string;
  run_id: string;
  tick_seq: string | null;
  /** Set on sells only — an open position has no realised result. */
  realized_pnl_usd: string | null;
}

/**
 * A page of fills, newest first.
 *
 * The cursor is a (timestamp, id) PAIR because one tick fills several assets in
 * the same instant — on live data three fills sharing an executed_at is the
 * normal shape. A timestamp-only cursor drops the siblings of whichever row
 * ended the page, so a user scrolling past a boundary quietly loses trades.
 * Round-trip both halves; do not reconstruct them.
 */
export interface FillPage {
  fills: AgentFill[];
  nextBefore: string | null;
  nextBeforeId: string | null;
}

/**
 * Adds a market to a running agent, in place.
 *
 * Not a fork and not a chat proposal: the universe is the one part of a running
 * strategy that is not frozen, so the same agent keeps its record and simply
 * screens one more asset. The backend runs a cycle immediately — `ticked` says
 * whether it actually did, which is false for a paused agent.
 */
export const addAgentMarket = (
  token: string,
  agentId: number,
  market: { underlying: string; issuer?: string },
) =>
  request<{ markets: UniverseSelection[]; ticked: boolean; status: string }>(
    `/agents/${agentId}/markets`,
    token,
    { method: "POST", body: JSON.stringify(market) },
  );

export const getAgentFills = (
  token: string,
  agentId: number,
  cursor?: { before: string | null; beforeId: string | null } | null,
) =>
  request<FillPage>(
    `/agents/${agentId}/fills?limit=50` +
      (cursor?.before && cursor.beforeId
        ? `&before=${encodeURIComponent(cursor.before)}&beforeId=${encodeURIComponent(cursor.beforeId)}`
        : ""),
    token,
  );

export interface CycleRow {
  id: string;
  tick_seq: string;
  status: "running" | "ok" | "error" | "skipped";
  skip_reason: string | null;
  started_at: string;
  ended_at: string | null;
  risk_decisions: string;
  blocked: string;
}

export const listCycles = (token: string, agentId: number, limit = 50) =>
  request<{ cycles: CycleRow[] }>(`/agents/${agentId}/cycles?limit=${limit}`, token);

/**
 * The council transcript for one tick — a direct rendering of
 * trading_agent_decisions, one row per seat, in the order they spoke.
 */
export const getCycle = (token: string, agentId: number, runId: string) =>
  request<{
    run: CycleRow;
    decisions: {
      role: "desk" | "analyst" | "risk" | "trader" | "pm";
      seq: number;
      output: Record<string, unknown>;
      adapter_ids: string[];
      created_at: string;
      model: string | null;
      latency_ms: number | null;
      cost_usd: string | null;
    }[];
  }>(`/agents/${agentId}/cycles/${runId}`, token);

/* --------------------------------------------------------------- activity -- */

/**
 * One step the agent took while screening. Emitted by the SME, recorded on the
 * analyst's decision row — see ScreenTrace in @canopy/agent-contracts.
 *
 * `detail` is already-formed prose from the backend. Render it verbatim: the
 * reason an asset was dropped belongs next to the branch that dropped it, not
 * reassembled here from codes.
 */
export interface ScreenStep {
  stage:
    | "universe"
    | "session"
    | "held"
    | "compliance"
    | "fundamentals"
    | "activity"
    | "events"
    | "market"
    | "rules"
    | "selected";
  outcome: "pass" | "drop" | "info";
  detail: string;
  symbol?: string;
  underlying?: string;
  sourceId?: string;
}

export interface ActivityDecision {
  run_id: string;
  role: "desk" | "analyst" | "risk" | "trader" | "pm";
  seq: number;
  output: Record<string, unknown>;
  created_at: string;
  model: string | null;
  latency_ms: number | null;
  cost_usd: string | null;
}

export interface ActivityCycle {
  id: string;
  tick_seq: string;
  status: "running" | "ok" | "error" | "skipped";
  skip_reason: string | null;
  started_at: string;
  ended_at: string | null;
  error: string | null;
  decisions: ActivityDecision[];
}

/** The last few cycles with their full transcript — the agent's activity log. */
export const getActivity = (token: string, agentId: number, limit = 5) =>
  request<{ cycles: ActivityCycle[] }>(
    `/agents/${agentId}/activity?limit=${limit}`,
    token,
  );

/* ----------------------------------------------------------------- equity -- */

/**
 * One point on the equity curve — what the desk saw at the top of that cycle,
 * before the agent acted. `cashUsd` is null on cycles the desk skipped without
 * marking the book (a drawdown breach records equity but not cash).
 */
export interface EquityPoint {
  tickSeq: number;
  at: string;
  equityUsd: number;
  cashUsd: number | null;
  highWaterMarkUsd: number;
}

export interface EquitySeries {
  capitalUsd: number;
  isPaper: boolean;
  realizedPnlUsd: number;
  closedPositions: number;
  winningPositions: number;
  points: EquityPoint[];
}

/**
 * One day of a public record.
 *
 * Aggregated by day and never per trade: a list of individual positions names
 * exactly what an agent trades, which for a focused strategy is the strategy.
 * Performance is public; the recipe is not.
 */
export interface RecordDay {
  day: string;
  realizedUsd: number;
  /** Equity change across the day — realised and unrealised together. */
  returnPct: number;
  trades: number;
  /** Null on days with too few equity readings to measure one. */
  maxDrawdownPct: number | null;
  /** Cycles run that day. Zero means the agent was not alive yet. */
  cycles: number;
}

/**
 * A strategy's public record — the AUTHOR's agent, not the sum of every
 * deployment. Averaging deployers in would move a creator's track record
 * because a stranger deployed badly.
 */
export interface StrategyRecord {
  agentId: number | null;
  capitalUsd: number;
  isPaper?: boolean;
  points: EquityPoint[];
  openPositions: number;
  closedPositions: number;
  winRatePct: number | null;
  daily: RecordDay[];
}

export const getStrategyRecord = (token: string, strategyId: number) =>
  request<StrategyRecord>(`/agents/strategies/${strategyId}/record`, token);

export const getEquity = (token: string, agentId: number) =>
  request<EquitySeries>(`/agents/${agentId}/equity`, token);

/* -------------------------------------------------------------- proposals -- */

export interface ProposalRow {
  id: number;
  symbol: string;
  underlying: string | null;
  side: string;
  approved_size_usd: string;
  stop_loss_pct: string | null;
  take_profit_pct: string | null;
  rationale: string | null;
  confidence: number | null;
  status: "pending" | "approved" | "rejected" | "expired" | "superseded";
  expires_at: string;
  created_at: string;
}

export const listProposals = (token: string, agentId: number, status?: string) =>
  request<{ proposals: ProposalRow[] }>(
    `/agents/${agentId}/proposals${status ? `?status=${status}` : ""}`,
    token,
  );

/**
 * Records the human decision on a parked proposal.
 *
 * Note `executed: false` in the response: approving records intent, it does not
 * move funds. There is no signing rail yet, and a client that rendered
 * "executed" here would be lying about where the money went.
 */
export const decideProposal = (
  token: string,
  agentId: number,
  proposalId: number,
  decision: "approve" | "reject",
) =>
  request<{ proposal: ProposalRow; executed: boolean; note: string }>(
    `/agents/${agentId}/proposals/${proposalId}/${decision}`,
    token,
    { method: "POST" },
  );

/* ----------------------------------------------------------------- control -- */

export const pauseAgent = (token: string, agentId: number) =>
  request<{ status: string }>(`/agents/${agentId}/pause`, token, { method: "POST" });

export const resumeAgent = (token: string, agentId: number) =>
  request<{ status: string }>(`/agents/${agentId}/resume`, token, { method: "POST" });

/**
 * Promotes a paper agent to live. One-way.
 *
 * The agent keeps its identity, strategy and decision history — everything it
 * learned on paper comes across. What does NOT come across is its open
 * positions: those are tokens it never actually bought, so the backend settles
 * the paper book at real marks first and the live book starts flat.
 *
 * Fails with 409 if a paper position cannot be priced, leaving the agent
 * settling rather than live on top of an unfinished book. Requires a granted
 * delegation and a published strategy; the database enforces both.
 */
export const goLive = (token: string, agentId: number) =>
  request<{ isPaper: false; address?: string; alreadyLive?: boolean }>(
    `/agents/${agentId}/live`,
    token,
    { method: "POST" },
  );

/**
 * The kill switch. Halting ticks alone would not be enough — the wallet
 * delegation is the actual authority, so the backend revokes it too, and that
 * revocation works even if the agent runtime is wedged mid-tick.
 */
export const stopAgent = (token: string, agentId: number) =>
  request<{ status: string; walletRevoked: boolean }>(`/agents/${agentId}/stop`, token, {
    method: "POST",
  });

/**
 * Soft-deletes an agent: closes its book, revokes the wallet, hides it from the
 * agent list — and keeps every decision row, fill and position for the record.
 *
 * Closing comes FIRST and the delete only lands once the agent is flat. If a
 * position cannot be priced the call fails with 409 and the agent is left
 * `liquidating` — visible and retried — because hiding exposure the owner can
 * no longer see is the one outcome worth refusing.
 */
export const deleteAgent = (token: string, agentId: number) =>
  request<{ status: string; walletRevoked: boolean }>(`/agents/${agentId}/delete`, token, {
    method: "POST",
  });
