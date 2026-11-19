"use client";

// Every agent the signed-in user owns, valued the way its own page values it.
//
// The loading half of the v1 portfolio (components/portfolioOverview.tsx),
// lifted out so the v2 Portfolio and Your agents screens read the same
// figures: per agent the detail, equity series, live marks and (live books
// only) the wallet read, run through `markHolding`.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  getAgent,
  getAgentFunding,
  getAgentMarks,
  getAllMarkets,
  getEquity,
  getTradePositions,
  listAgents,
  type UniverseAsset,
} from "@/lib/api";
import { CONCURRENCY, pooled } from "@/lib/pool";
import { readPageCache, writePageCache } from "@/lib/pageCache";
import { isLpBook, markHolding, withLiveMarks } from "@/lib/perf";
import type { Holding } from "@/components/portfolioOverview";
import type { Position } from "@/lib/market";

export type { Holding };

export interface HoldingsData {
  holdings: Holding[];
  /** The user's own trades (Trade screen), open and closed. Empty without an account. */
  ownOpen: Position[];
  ownClosed: Position[];
}

export type HoldingsState =
  | { phase: "loading" }
  | { phase: "signed-out" }
  | { phase: "error"; message: string }
  | ({ phase: "ready" } & HoldingsData);

const CACHE_KEY = "portfolio:v2";

export function useHoldings(): { state: HoldingsState; reload: () => void } {
  const { ready, authenticated, getAccessToken, user } = usePrivy();
  const tokenRef = useRef(getAccessToken);
  tokenRef.current = getAccessToken;
  const userId = user?.id ?? null;

  const [state, setState] = useState<HoldingsState>(() => {
    const cached = readPageCache<HoldingsData>(userId, CACHE_KEY);
    return cached ? { phase: "ready", ...cached } : { phase: "loading" };
  });

  const load = useCallback(async () => {
    if (!ready) return;
    if (!authenticated) {
      setState({ phase: "signed-out" });
      return;
    }
    try {
      const token = await tokenRef.current();
      if (!token) {
        setState({ phase: "signed-out" });
        return;
      }
      const [{ agents }, universe, ownOpen, ownClosed] = await Promise.all([
        listAgents(token),
        getAllMarkets(token).catch(() => [] as UniverseAsset[]),
        getTradePositions(token, "open").then((r) => r.positions).catch(() => [] as Position[]),
        getTradePositions(token, "closed").then((r) => r.positions).catch(() => [] as Position[]),
      ]);

      const holdings = await pooled(agents, CONCURRENCY, async (agent): Promise<Holding> => {
        const [detail, equity, marks, funding] = await Promise.allSettled([
          getAgent(token, agent.id),
          getEquity(token, agent.id),
          getAgentMarks(token, agent.id),
          agent.is_paper ? Promise.resolve(null) : getAgentFunding(token, agent.id),
        ]);
        const d = detail.status === "fulfilled" ? detail.value : null;
        const positions = d?.positions ?? [];
        const series = equity.status === "fulfilled" ? equity.value : null;
        const markMap = new Map<string, number>(
          marks.status === "fulfilled" ? marks.value.marks.map((m) => [m.mint, m.priceUsd] as [string, number]) : [],
        );
        const priced = withLiveMarks(universe, positions, markMap);
        return {
          agent,
          positions,
          series,
          universe: priced,
          mark: markHolding({
            series,
            positions,
            universe: priced,
            isLp: isLpBook(agent, positions),
            liveBook: !agent.is_paper && d?.book === "live",
            unit: d?.unit ?? "USD",
            funding: funding.status === "fulfilled" ? funding.value : null,
            solUsd: d?.solUsd ?? null,
          }),
        };
      });

      const data: HoldingsData = { holdings, ownOpen, ownClosed };
      writePageCache(userId, CACHE_KEY, data);
      setState({ phase: "ready", ...data });
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [ready, authenticated, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: () => void load() };
}
