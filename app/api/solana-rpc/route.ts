import { NextResponse } from "next/server";

/**
 * Solana JSON-RPC, forwarded from the server.
 *
 * WHY THIS EXISTS: api.mainnet-beta.solana.com returns 403 to any request
 * carrying an `Origin` header. Not rate limiting — a flat refusal of browser
 * traffic. The same call succeeds from a server, which is what this is.
 *
 * That refusal is invisible from the inside: the browser sees a failed fetch,
 * and a balance panel that treats a failure as "nothing there" reports an empty
 * wallet to someone whose funds are sitting in it. chainBalance.ts was written
 * on the assumption that the browser path was the RELIABLE one — it is the
 * reverse, on this endpoint.
 *
 * A deployment with a browser-capable RPC (Helius, Triton, QuickNode) should
 * set NEXT_PUBLIC_SOLANA_RPC_URL and the client will skip this entirely.
 */

/** The upstream. Server-side only, so it may hold a keyed URL. */
const UPSTREAM =
  process.env.SOLANA_RPC_URL ??
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

/**
 * What this proxy will forward.
 *
 * An open JSON-RPC proxy is an open relay: anyone could point it at any method,
 * and it would spend our upstream's quota doing it. So the list is the reads
 * the balance panels make, plus what Privy's send hook needs once it is handed
 * this endpoint as the app's Solana RPC: broadcast a signed transaction,
 * simulate it, and poll its status. None of those spend anything of ours —
 * a broadcast is a signed payload anyone could relay to any node — and
 * without them a withdrawal cannot leave the browser.
 */
const ALLOWED = new Set([
  // reads
  "getBalance",
  "getTokenAccountsByOwner",
  "getAccountInfo",
  "getLatestBlockhash",
  "getMultipleAccounts",
  "getMinimumBalanceForRentExemption",
  // the send path
  "sendTransaction",
  "simulateTransaction",
  "getSignatureStatuses",
  "getFeeForMessage",
  "getRecentPrioritizationFees",
  "getSlot",
  "getBlockHeight",
  "getTransaction",
  "getEpochInfo",
  "getVersion",
  "getHealth",
]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "expected a JSON-RPC body" }, { status: 400 });
  }

  // Batches are a list; Kit sends single calls, but accepting both keeps this
  // from being the reason a future caller has to work around it.
  const calls = Array.isArray(body) ? body : [body];
  for (const call of calls) {
    const method = (call as { method?: unknown } | null)?.method;
    if (typeof method !== "string" || !ALLOWED.has(method)) {
      return NextResponse.json(
        { error: `method not permitted through this proxy: ${String(method)}` },
        { status: 403 },
      );
    }
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      // The caller has its own deadline; this one stops a hung upstream from
      // holding a server function open until the platform kills it.
      signal: AbortSignal.timeout(10_000),
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upstream unreachable" },
      { status: 502 },
    );
  }
}
