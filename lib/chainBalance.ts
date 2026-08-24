"use client";

// Reading an agent wallet's balances from the chain, in the browser.
//
// THIS IS A FALLBACK, NOT A SECOND SOURCE OF TRUTH.
//
// canopy-be's `/agents/:id/funding` is the real answer, and it is the one to
// prefer whenever it responds: it reads the SAME mint and the SAME lamport floor
// the executor and the tick enforce, so its verdict and the agent's behaviour
// cannot disagree. What is below necessarily hardcodes both, which means a
// backend that changes either would leave this module quietly describing a
// different wallet than the one that trades.
//
// It exists because that endpoint's failure mode is a 503 — it returns one
// rather than reporting an RPC outage as `fundedForLive: false`, which would
// tell someone to send money they have already sent — and a 503 there blocks
// the whole go-live path. Deployed on a datacenter IP against a public RPC, that
// 503 is routine: api.mainnet-beta.solana.com rate-limits and 403s cloud egress
// far more aggressively than it does a residential browser. Which is exactly why
// this fallback tends to succeed where the server failed — it runs on the user's
// own connection.
//
// NO @solana/web3.js. It is not a dependency of this app and pulling one in for
// two JSON-RPC calls would cost far more bundle than the calls are worth.

/** Settlement currency for every agent trade. Mirrors canopy-be's USDC_MINT. */
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** SPL Token program — the owner of every token account we read. */
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Where the browser reads the chain when the backend cannot.
 *
 * NOT the public endpoint by default, any more. api.mainnet-beta.solana.com
 * returns 403 to any request carrying an `Origin` header — a flat refusal of
 * browser traffic, not rate limiting — so every call from here failed, and the
 * panels that depend on it degraded to "unknown" permanently. `/api/solana-rpc`
 * is this app's own server forwarding the same call, which the endpoint
 * accepts.
 *
 * The header above says this fallback "tends to succeed where the server
 * failed", because it runs on the user's own connection. That is true of rate
 * limiting and false of this 403, which keys on the browser rather than on the
 * IP.
 *
 * A deployment with a browser-capable RPC should set
 * NEXT_PUBLIC_SOLANA_RPC_URL; the proxy is then skipped entirely.
 */
export const FALLBACK_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "/api/solana-rpc";

/**
 * The same, absolute.
 *
 * `createSolanaRpc` builds a transport that wants a parseable URL, and a
 * relative path is not one. Resolved against the current origin in the browser
 * and left as-is on the server, where a relative default would be meaningless
 * anyway.
 */
export function rpcUrl(): string {
  if (FALLBACK_RPC_URL.startsWith("/") && typeof window !== "undefined") {
    return new URL(FALLBACK_RPC_URL, window.location.origin).toString();
  }
  return FALLBACK_RPC_URL;
}

export interface ChainFunding {
  usdc: number;
  sol: number;
}

interface RpcResponse<T> {
  result?: T;
  error?: { code: number; message: string };
}

/**
 * One JSON-RPC call, with a deadline.
 *
 * The timeout is not optional politeness: this runs on the error path of a
 * screen the user is already stuck on, and a public RPC that hangs rather than
 * refusing would replace a visible failure with an invisible one.
 */
async function rpc<T>(
  method: string,
  params: unknown[],
  timeoutMs: number,
): Promise<T> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetch(rpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: abort.signal,
      cache: "no-store",
    });
    // A rate-limited public endpoint answers 429 with a JSON-RPC error body, so
    // the status alone is not the whole story — but a non-2xx with no body at
    // all still has to become an error rather than an undefined result.
    const body = (await res.json().catch(() => null)) as RpcResponse<T> | null;
    if (body?.error) throw new Error(body.error.message);
    if (!res.ok) throw new Error(`the network returned ${res.status}`);
    if (!body || body.result === undefined)
      throw new Error("the network returned no result");
    return body.result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * USDC and SOL held by one wallet, read straight from the chain.
 *
 * Both in one pass, so a caller cannot check one and forget the other — which
 * is the mistake the SOL requirement invites, and the reason canopy-be pairs
 * them too.
 */
export async function readChainFunding(
  address: string,
  timeoutMs = 8000,
): Promise<ChainFunding> {
  const [accounts, lamports] = await Promise.all([
    rpc<{ value: TokenAccount[] }>(
      "getTokenAccountsByOwner",
      [address, { programId: TOKEN_PROGRAM }, { encoding: "jsonParsed" }],
      timeoutMs,
    ),
    rpc<{ value: number }>("getBalance", [address], timeoutMs),
  ]);

  let usdc = 0;
  for (const entry of accounts.value ?? []) {
    const info = entry?.account?.data?.parsed?.info;
    if (info?.mint !== USDC_MINT) continue;
    const amount = info.tokenAmount?.uiAmount;
    // A mint can have more than one token account. Summed, not overwritten —
    // taking the last would under-report a wallet holding two.
    if (typeof amount === "number") usdc += amount;
  }

  return { usdc, sol: (lamports.value ?? 0) / LAMPORTS_PER_SOL };
}

interface TokenAccount {
  account?: {
    data?: {
      parsed?: {
        info?: {
          mint?: string;
          tokenAmount?: { uiAmount?: number };
        };
      };
    };
  };
}

/**
 * Why this wallet cannot trade yet, or null when it can.
 *
 * Deliberately the same shape and close to the same wording as the backend's
 * `fundingState`, because the user may see either one depending on which read
 * succeeded, and two different sentences for one condition read as two
 * different problems.
 */
export function fallbackShortfall(f: ChainFunding): string | null {
  // USDC ONLY. The SOL floor this used to mirror was removed from canopy-be on
  // 2026-08-25, and a fallback that still demanded it would re-raise the
  // requirement on exactly the screen where someone decides what to send — a
  // backend RPC outage is routine, and this path is what serves it.
  return f.usdc <= 0
    ? "this wallet holds no USDC — send USDC to fund it (SOL cannot be swapped in)"
    : null;
}
