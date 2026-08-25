"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { headline, STATUS_LABEL_KEY, STATUS_TONE } from "@/components/activity";
import { EmptyState, ErrorState, SignedOutState } from "@/components/states";
import { SkeletonRows } from "@/components/skeleton";
import { Badge } from "@/components/ui";
import { getActivity, listAgents, type ActivityCycle, type AgentRow } from "@/lib/api";
import { CONCURRENCY, pooled } from "@/lib/pool";
import { compactAge } from "@/lib/format";
import { useT, type TranslationKey } from "@/lib/i18n";

/**
 * Everything your agents have done lately, in one column.
 *
 * YOUR AGENTS — NOT A GLOBAL FEED. The wireframe draws a firehose of everyone's
 * activity, which would need an endpoint that does not exist; `GET
 * /agents/:id/activity` is per-agent and scoped to the owner. So this fans out
 * across the agents you own and merges by time. The page says so rather than
 * letting the shape imply a reach it does not have.
 *
 * A cycle here is the SAME cycle the agent's own log shows, summarised by the
 * same `headline`. This is a different ordering of one truth, not a second
 * account of it.
 */

const PER_AGENT = 8;

interface Entry {
  agent: AgentRow;
  cycle: ActivityCycle;
  /** Sort key. `started_at` is written when the tick begins and never moves. */
  at: number;
}

type Filter = "all" | "traded" | "quiet";

export function ActivityFeed() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const t = useT();

  // Held still for the same reason MyAgents does it: `load` is a dependency of
  // the effect that runs it, and Privy hands back a new closure every render.
  const tokenRef = useRef(getAccessToken);
  tokenRef.current = getAccessToken;

  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "signed-out" }
    | { phase: "error"; message: string }
    | { phase: "ready"; entries: Entry[]; agents: number; partial: number }
  >({ phase: "loading" });
  const [filter, setFilter] = useState<Filter>("all");

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
      const { agents } = await listAgents(token);
      // Drafts have never ticked. Asking for their activity is a request that
      // can only come back empty.
      const live = agents.filter((a) => a.status !== "draft");

      const results = await pooled(live, CONCURRENCY, async (agent) => {
        try {
          const { cycles } = await getActivity(token, agent.id, PER_AGENT);
          return cycles.map((cycle) => ({
            agent,
            cycle,
            at: new Date(cycle.started_at).getTime(),
          }));
        } catch {
          // One agent's log failing must not blank the feed. Counted, and said
          // at the bottom — a silently short feed reads as a quiet week.
          return null;
        }
      });

      const entries = results
        .filter((r): r is Entry[] => r !== null)
        .flat()
        .sort((a, b) => b.at - a.at);

      setState({
        phase: "ready",
        entries,
        agents: live.length,
        partial: results.filter((r) => r === null).length,
      });
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [ready, authenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refreshed on the way back into the tab, and on a slow interval. This is a
  // feed; a stale one is the one thing it cannot be.
  useEffect(() => {
    const id = setInterval(() => void load(), 60_000);
    let lastAt = 0;
    const onReturn = () => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastAt < 1000) return;
      lastAt = now;
      void load();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [load]);

  const entries = state.phase === "ready" ? state.entries : [];
  const shown = useMemo(
    () =>
      entries.filter((e) =>
        filter === "all"
          ? true
          : filter === "traded"
            ? traded(e.cycle)
            : !traded(e.cycle),
      ),
    [entries, filter],
  );

  if (state.phase === "loading")
    return <SkeletonRows labelKey="loading_activity" cols="minmax(0,1fr) 90px" />;
  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "error")
    return <ErrorState message={state.message} onRetry={() => void load()} />;

  if (entries.length === 0) {
    return (
      <div className="px-6 py-10 sm:px-8">
        <EmptyState
          title={t("feed_empty_title")}
          body={t(state.agents === 0 ? "feed_empty_no_agents" : "feed_empty_no_cycles")}
          action={
            state.agents === 0
              ? { label: t("feed_empty_action"), href: "/build/new" }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 border-b border-grid px-6 py-3 sm:px-8">
        {(
          [
            ["all", "feed_filter_all"],
            ["traded", "feed_filter_traded"],
            ["quiet", "feed_filter_quiet"],
          ] as [Filter, TranslationKey][]
        ).map(([key, labelKey]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`border px-3 py-1.5 font-mono text-[10.5px] tracking-[0.08em] uppercase transition-colors ${
              filter === key
                ? "border-grid-strong bg-surface-2 text-text-primary"
                : "border-transparent text-text-dim hover:text-text-secondary"
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="px-6 py-10 text-center font-ui text-[13px] text-text-dim sm:px-8">
          {t(filter === "traded" ? "feed_none_traded" : "feed_all_traded")}
        </p>
      ) : (
        <ul>
          {shown.map((e) => (
            <Row key={`${e.agent.id}-${e.cycle.id}`} entry={e} />
          ))}
        </ul>
      )}

      {/* One sentence per case. The English pluralises with an apostrophe
          ("agent's" / "agents'") that has no counterpart in Chinese, so the
          clause is translated whole rather than built from a stem. */}
      <p className="px-6 py-5 font-mono text-[9.5px] tracking-[0.08em] text-text-dim uppercase sm:px-8">
        {t(state.agents === 1 ? "feed_footer_one" : "feed_footer_many", {
          shown: shown.length,
          total: entries.length,
          per: PER_AGENT,
          agents: state.agents,
        })}
        {state.partial > 0
          ? state.partial === 1
            ? t("feed_footer_partial_one")
            : t("feed_footer_partial_many", { count: state.partial })
          : ""}
      </p>
    </div>
  );
}

function Row({ entry }: { entry: Entry }) {
  const { agent, cycle } = entry;
  const t = useT();
  return (
    <li>
      <Link
        href={`/portfolio/${agent.id}/cycles/${cycle.id}`}
        className="flex items-start gap-3 border-b border-grid px-6 py-3.5 transition-colors hover:bg-surface sm:gap-4 sm:px-8"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="truncate font-mono text-[13px] text-text-primary">
              {agent.strategy_name}
            </span>
            <span className="font-mono text-[10px] text-text-dim">#{cycle.tick_seq}</span>
            {agent.is_paper ? (
              <Badge tone="simulated">{t("feed_badge_paper")}</Badge>
            ) : null}
            {cycle.status !== "ok" ? (
              <Badge tone={STATUS_TONE[cycle.status]}>{t(STATUS_LABEL_KEY[cycle.status])}</Badge>
            ) : null}
          </div>
          {/* The same sentence the agent's own log uses for this tick. */}
          <p className="font-ui text-[12.5px] leading-relaxed text-text-secondary">
            {headline(cycle, t)}
          </p>
        </div>
        <span className="shrink-0 pt-0.5 font-mono text-[10px] text-text-muted">
          {compactAge(cycle.started_at, t)}
        </span>
      </Link>
    </li>
  );
}

/** Did anything actually change hands? Drives the Traded / Quiet split. */
function traded(c: ActivityCycle): boolean {
  return c.decisions.some((d) => d.role === "trader" && d.output?.filledUsd !== undefined);
}

// `ago` moved to lib/format as `compactAge`.
