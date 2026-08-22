"use client";

// What the account is worth, for screens that are not the portfolio.
//
// The home feed leads with the balance, but its LIST is the marketplace — so it
// has no reason to load the user's agents beyond that one figure. This does the
// smallest fan-out that produces a real number: the agent list, then each
// agent's equity readings. No positions and no universe, because the live mark
// those buy is a portfolio-page concern and this is a headline.
//
// Cached at module scope with a short TTL so moving between home and portfolio
// does not refetch on every navigation. The portfolio does its own, fuller load
// — that page needs the live mark — and the two agree because both measure
// equity as deployed capital plus movement since deploy.

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { getEquity, listAgents, type EquitySeries } from "@/lib/api";
import { CONCURRENCY, pooled } from "@/lib/pool";

export interface AccountBalance {
  /** Deployed capital plus movement since deploy, across live agents. */
  equityUsd: number;
  /** Movement over the trailing 24h. Null when nothing was recorded before it. */
  moved24hUsd: number | null;
  agents: number;
  loaded: boolean;
}

const EMPTY: AccountBalance = { equityUsd: 0, moved24hUsd: null, agents: 0, loaded: false };
const TTL_MS = 60_000;

let cache: AccountBalance = EMPTY;
let cachedAt = 0;
let cachedFor: string | null = null;
let inFlight: Promise<void> | null = null;
const subscribers = new Set<() => void>();

export function useAccountBalance(): AccountBalance {
  const { authenticated, user, getAccessToken } = usePrivy();
  const privyId = user?.id ?? null;
  const [, bump] = useState(0);

  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);

  useEffect(() => {
    if (!authenticated || !privyId) return;
    if (cachedFor !== privyId) {
      cachedFor = privyId;
      cache = EMPTY;
      cachedAt = 0;
      inFlight = null;
    }
    if (inFlight || (cache.loaded && Date.now() - cachedAt < TTL_MS)) return;

    inFlight = (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const { agents } = await listAgents(token);
        const counted = agents.filter((a) => a.status !== "stopped" && a.status !== "draft");

        const series = await pooled(counted, CONCURRENCY, async (a) => {
          try {
            return await getEquity(token, a.id);
          } catch {
            return null;
          }
        });

        let equityUsd = 0;
        let moved = 0;
        let anyMoved = false;
        const cutoff = Date.now() - 86_400_000;

        counted.forEach((agent, i) => {
          const s: EquitySeries | null = series[i];
          const points = s?.points ?? [];
          const capital = Number(agent.capital_usd) || 0;
          if (points.length === 0) {
            // Deployed but never ticked: it holds its mandate and nothing more.
            equityUsd += capital;
            return;
          }
          const base = s?.capitalUsd || points[0].equityUsd;
          equityUsd += capital + (points[points.length - 1].equityUsd - base);

          // Against the last reading at or before the cutoff, not the first
          // inside the window — agents tick at different cadences.
          let ref: number | null = null;
          for (const p of points) {
            if (new Date(p.at).getTime() <= cutoff) ref = p.equityUsd;
            else break;
          }
          if (ref !== null) {
            moved += points[points.length - 1].equityUsd - ref;
            anyMoved = true;
          }
        });

        cache = {
          equityUsd,
          moved24hUsd: anyMoved ? moved : null,
          agents: counted.length,
          loaded: true,
        };
        cachedAt = Date.now();
        for (const fn of subscribers) fn();
      } catch {
        // Leaves `loaded` false, so the headline shows a dash rather than a
        // zero. An account with money in it must never render as empty.
      } finally {
        inFlight = null;
      }
    })();
  }, [authenticated, privyId, getAccessToken]);

  return cache;
}
