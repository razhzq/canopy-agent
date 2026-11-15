"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { getTradeAccount, getWatchlist, marketStreamUrl, setWatched } from "./api";
import type { TradeAccount } from "./market";
import type { LoadState } from "./useApi";

/**
 * `useApi` for the public market routes.
 *
 * Signed-out is NOT a phase here: prices, candles and the feed are readable by
 * anyone, so the request goes out with an empty token instead of stopping at a
 * sign-in prompt. A signed-in reader still sends their token, which is what
 * lets the backend personalise later without a second hook.
 */
export function usePublicApi<T>(
  fetcher: (token: string) => Promise<T>,
  deps: unknown[] = [],
  opts: { pollMs?: number } = {},
): LoadState<T> & { reload: () => void } {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [state, setState] = useState<LoadState<T>>({ phase: "loading" });
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const pollMs = opts.pollMs;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const run = async (quiet: boolean) => {
      const seq = ++latest.current;
      if (!quiet) setState({ phase: "loading" });
      try {
        const token = authenticated ? ((await getAccessToken()) ?? "") : "";
        const data = await fetcher(token);
        if (!cancelled && seq === latest.current) setState({ phase: "ready", data });
      } catch (err) {
        // A failed background poll keeps what is on screen.
        if (cancelled || seq !== latest.current || quiet) return;
        const status = (err as { status?: number }).status;
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : String(err),
          status,
        });
      }
    };

    void run(false);
    if (pollMs) timer = setInterval(() => void run(true), pollMs);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, nonce, pollMs, ...deps]);

  return { ...state, reload };
}

/**
 * The live price for one mint, from the SSE stream.
 *
 * Falls back to whatever the caller already has (`initial`) until the first
 * tick, and keeps the last good price through a dropped connection —
 * EventSource reconnects on its own.
 */
export function useLivePrice(mint: string, initial: number | null): { price: number | null; live: boolean } {
  const [tick, setTick] = useState<{ mint: string; price: number } | null>(null);
  const [liveFor, setLiveFor] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    const es = new EventSource(marketStreamUrl(mint));
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data) as { priceUsd?: number };
        if (typeof d.priceUsd === "number" && Number.isFinite(d.priceUsd)) {
          setTick({ mint, price: d.priceUsd });
          setLiveFor(mint);
        }
      } catch {
        /* a malformed frame is skipped, not fatal */
      }
    };
    es.onerror = () => setLiveFor(null);
    return () => es.close();
  }, [mint]);

  const price = tick && tick.mint === mint ? tick.price : initial;
  return { price, live: liveFor === mint };
}

/**
 * The personal trading account, shared by the Trade panel and the Feed.
 *
 * `null` data while signed out: the screens still render, and the buy flow is
 * what asks the reader to sign in.
 */
export function useTradeAccount(): {
  account: TradeAccount | null;
  loading: boolean;
  reload: () => void;
} {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [account, setAccount] = useState<TradeAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setAccount(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const a = await getTradeAccount(token);
        if (!cancelled) setAccount(a);
      } catch {
        if (!cancelled) setAccount(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, nonce]);

  return { account, loading, reload };
}

/** The watchlist as a set of mints, with an optimistic toggle. */
export function useWatchlist(): {
  mints: Set<string>;
  toggle: (mint: string) => Promise<void>;
  signedIn: boolean;
  version: number;
} {
  const { ready, authenticated, getAccessToken, login } = usePrivy();
  const [mints, setMints] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const w = await getWatchlist(token);
        if (!cancelled) setMints(new Set(w.mints));
      } catch {
        /* no watchlist is an empty watchlist */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  const toggle = useCallback(
    async (mint: string) => {
      if (!authenticated) {
        login();
        return;
      }
      const on = !mints.has(mint);
      const next = new Set(mints);
      if (on) next.add(mint);
      else next.delete(mint);
      setMints(next);
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await setWatched(token, mint, on);
        setMints(new Set(res.mints));
        setVersion((v) => v + 1);
      } catch {
        setMints(mints);
      }
    },
    [authenticated, login, mints, getAccessToken],
  );

  return { mints, toggle, signedIn: authenticated, version };
}
