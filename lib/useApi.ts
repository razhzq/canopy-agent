"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";

export type LoadState<T> =
  | { phase: "loading" }
  | { phase: "signed-out" }
  | { phase: "error"; message: string; status?: number }
  | { phase: "ready"; data: T };

/**
 * Fetches from the agent API with the signed-in user's Privy access token.
 *
 * The token is fetched per call rather than held in state: Privy rotates it,
 * and a cached token is the kind of thing that works all through development
 * and then 401s an hour into a real session.
 *
 * `signed-out` is a distinct phase, not an error. Being logged out is an
 * ordinary state of the page and deserves a sign-in prompt, not a red box.
 */
export function useApi<T>(
  fetcher: (token: string) => Promise<T>,
  deps: unknown[] = [],
  /**
   * Data already to hand — from a client-side cache — to render on the first
   * frame instead of a skeleton.
   *
   * The request still goes out and still replaces this when it lands, so the
   * seed is a head start rather than a substitute. Only pass something the
   * caller can produce SYNCHRONOUSLY: awaiting a cache costs the same frame of
   * loading state that seeding it exists to avoid.
   */
  initialData?: T,
): LoadState<T> & { reload: () => void } {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [state, setState] = useState<LoadState<T>>(
    initialData === undefined ? { phase: "loading" } : { phase: "ready", data: initialData },
  );
  const [nonce, setNonce] = useState(0);
  /**
   * Whether a refetch may run behind what is already on screen.
   *
   * True only for seeded callers, and fixed for the life of the hook. Every
   * other caller keeps the old behaviour — a re-run blanks to a skeleton —
   * which is what a call keyed to something like an agent id NEEDS: showing the
   * previous agent's figures under a new agent's heading while its request is
   * in flight is worse than showing nothing.
   */
  const revalidateQuietly = useRef(initialData !== undefined);

  // Guards against a resolved request from a previous render writing over a
  // newer one — the classic out-of-order fetch bug.
  const latest = useRef(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!ready) {
      if (!revalidateQuietly.current) setState({ phase: "loading" });
      return;
    }
    if (!authenticated) {
      setState({ phase: "signed-out" });
      return;
    }

    const seq = ++latest.current;
    let cancelled = false;
    if (!revalidateQuietly.current) setState({ phase: "loading" });

    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          if (!cancelled && seq === latest.current) setState({ phase: "signed-out" });
          return;
        }
        const data = await fetcher(token);
        if (!cancelled && seq === latest.current) setState({ phase: "ready", data });
      } catch (err) {
        if (cancelled || seq !== latest.current) return;
        // A 401 here means the session lapsed rather than that something broke.
        if (err instanceof ApiError && err.status === 401) {
          setState({ phase: "signed-out" });
          return;
        }
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : String(err),
          status: err instanceof ApiError ? err.status : undefined,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, nonce, ...deps]);

  return { ...state, reload };
}
