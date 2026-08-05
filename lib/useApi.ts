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
): LoadState<T> & { reload: () => void } {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [state, setState] = useState<LoadState<T>>({ phase: "loading" });
  const [nonce, setNonce] = useState(0);

  // Guards against a resolved request from a previous render writing over a
  // newer one — the classic out-of-order fetch bug.
  const latest = useRef(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!ready) {
      setState({ phase: "loading" });
      return;
    }
    if (!authenticated) {
      setState({ phase: "signed-out" });
      return;
    }

    const seq = ++latest.current;
    let cancelled = false;
    setState({ phase: "loading" });

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
