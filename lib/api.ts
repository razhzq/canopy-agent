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
}

/** Realised return against mandate capital, or null when nothing has closed. */
export function realizedReturnPct(s: StrategyRow): number | null {
  const capital = Number(s.mandate_capital_usd);
  if (!capital || Number(s.closed_positions) === 0) return null;
  return (Number(s.realized_pnl_usd) / capital) * 100;
}

/** Hit rate across closed positions, or null before there are any. */
export function hitRatePct(s: StrategyRow): number | null {
  const closed = Number(s.closed_positions);
  if (!closed) return null;
  return (Number(s.winning_positions) / closed) * 100;
}

export const listStrategies = (token: string) =>
  request<{ strategies: StrategyRow[] }>("/agents/strategies", token);

export const getStrategy = (token: string, id: number) =>
  request<{ strategy: StrategyRow; verification: VerificationStatus }>(
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

export const createStrategy = (
  token: string,
  body: {
    name: string;
    strategyClass: string;
    rules: DetectionRule[];
    safetyFloor?: Record<string, unknown>;
    feePct?: number;
  },
) =>
  request<{ strategy: StrategyRow }>("/agents/strategies", token, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const getVerification = (token: string, strategyId: number) =>
  request<{ verification: VerificationStatus }>(
    `/agents/strategies/${strategyId}/verification`,
    token,
  );

export const startPaperRun = (token: string, strategyId: number) =>
  request<{ verification: VerificationStatus }>(
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

export interface AgentRow {
  id: number;
  strategy_id: number;
  strategy_name: string;
  strategy_class: string;
  status: "draft" | "active" | "paused" | "stopped";
  capital_usd: string;
  autonomy: "propose_only" | "execute_with_caps";
  is_paper: boolean;
  high_water_mark_usd: string | null;
  next_tick_at: string | null;
  last_tick_at: string | null;
}

export const listAgents = (token: string) =>
  request<{ agents: AgentRow[] }>("/agents", token);

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
}

export const getAgent = (token: string, agentId: number) =>
  request<AgentDetail>(`/agents/${agentId}`, token);

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
 * The kill switch. Halting ticks alone would not be enough — the wallet
 * delegation is the actual authority, so the backend revokes it too, and that
 * revocation works even if the agent runtime is wedged mid-tick.
 */
export const stopAgent = (token: string, agentId: number) =>
  request<{ status: string; walletRevoked: boolean }>(`/agents/${agentId}/stop`, token, {
    method: "POST",
  });
