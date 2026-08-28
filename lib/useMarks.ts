"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { streamMarks } from "./api";

/**
 * Live prices for whatever a page is showing, keyed however that page keys them.
 *
 * ONE IMPLEMENTATION, TWO PAGES. The owner's workspace identifies a position by
 * its mint; a public record identifies one by symbol, because the mints are
 * deliberately withheld there. Those are different keys and the same problem,
 * and writing the transport twice is how one of them quietly stops reconnecting
 * or keeps polling after unmount. The server decides which key it answers in;
 * this only carries them.
 *
 * Returns a map that GROWS. An update carries only what moved, so merging is
 * not an optimisation — replacing would blank every price that happened to hold
 * still on the tick that arrived.
 */
export function useMarks(
  path: string | null,
  /**
   * A one-shot fetch of the same prices, polled slowly behind the stream.
   *
   * A dropped stream reconnects on its own, but a BUFFERED one does not look
   * dropped: the connection stays open, delivers nothing, and the figures
   * quietly stop moving while the page insists it is live. Reconnect logic
   * cannot see that; a second, independent read can.
   *
   * Optional because not every surface has a REST equivalent to fall back to.
   * Without one the stream is the only source, which is worth knowing when the
   * numbers on that page go still.
   */
  fallback?: (token: string) => Promise<{ key: string; priceUsd: number }[]>,
): Map<string, number> {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [marks, setMarks] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!ready || !authenticated || !path) return;

    const abort = new AbortController();
    let live = true;

    const apply = (rows: { key: string; priceUsd: number }[]) => {
      if (!live || rows.length === 0) return;
      setMarks((prev) => {
        const next = new Map(prev);
        for (const r of rows) next.set(r.key, r.priceUsd);
        return next;
      });
    };

    // Reconnects with a ceiling. A backend that is down should not be asked
    // once a second by every open tab.
    let attempt = 0;
    void (async () => {
      while (live && !abort.signal.aborted) {
        try {
          const token = await getAccessToken();
          if (!token || !live) return;
          await streamMarks(token, path, apply, abort.signal);
          // A clean end without an abort means the server closed it. For the
          // reader that is the same as a failure, so it is treated as one.
          attempt = 0;
        } catch {
          if (!live || abort.signal.aborted) return;
        }
        await new Promise((r) => setTimeout(r, Math.min(30_000, 1_000 * 2 ** attempt++)));
      }
    })();

    let poll: ReturnType<typeof setInterval> | null = null;
    if (fallback) {
      const pull = async () => {
        try {
          const token = await getAccessToken();
          if (token && live) apply(await fallback(token));
        } catch {
          // Silent. The previous prices stand — a failed read means "nothing
          // newer", which is what is already on screen.
        }
      };
      void pull();
      poll = setInterval(() => void pull(), 30_000);
    }

    return () => {
      live = false;
      abort.abort();
      if (poll) clearInterval(poll);
      // Deliberately NOT clearing the marks. The prices are still the last
      // truth we had, and blanking them on a book change would drop every row
      // back to the hourly sweep for a moment.
    };
  }, [ready, authenticated, path, getAccessToken, fallback]);

  return marks;
}
