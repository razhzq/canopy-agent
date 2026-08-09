"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { EmptyState, ErrorState, SignedOutState } from "@/components/states";
import { SkeletonRows } from "@/components/skeleton";
import {
  getAgent,
  getEquity,
  listAgents,
  pauseAgent,
  resumeAgent,
  type AgentDetail,
  type AgentRow,
  type EquitySeries,
} from "@/lib/api";

/**
 * "My agents" — wireframe 1j.
 *
 * A table of everything you own, with the five figures across the top and one
 * inline alert for the agent that stopped itself. It replaces the rail-and-
 * thread workspace as the landing page: the rail was a list of agents rendered
 * as navigation, which is fine for switching but useless for the question this
 * page exists to answer — what is all of my capital doing right now.
 *
 * WHAT THE LIST ENDPOINT CANNOT ANSWER
 *
 * `GET /agents` selects a.* from trading_agents, so status, capital, cadence,
 * pause reason and deploy time are all one request. Return and wallet ADDRESS
 * are not on that row — equity lives in the desk's decision rows and the
 * address in trading_agent_wallets — so each agent gets a `getEquity` and a
 * `getAgent` alongside. That is a fan-out, which is only acceptable because an
 * owner has a handful of agents; past FANOUT_CAP the extra rows load without
 * their return and wallet rather than firing eighty requests.
 *
 * TWO CELLS OF THE WIREFRAME ARE NOT PORTED AS DRAWN
 *
 * "AGENT SLOTS 3 / 5" has nothing behind it — POST /agents does no count check
 * and there is no plan, seat or quota anywhere in the agent stack. Inventing a
 * denominator would put a limit on screen that does not exist and that nobody
 * would enforce. That cell shows NEEDS YOU instead, which is real and is the
 * thing you would actually act on.
 */

/** Past this many agents the per-agent detail fetches are skipped. */
const FANOUT_CAP = 12;

interface Enriched {
  agent: AgentRow;
  /** Null until the fan-out lands, or when the agent has no wallet at all. */
  wallet: AgentDetail["wallet"];
  equity: EquitySeries | null;
}

export function MyAgents() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "signed-out" }
    | { phase: "error"; message: string }
    | { phase: "ready"; rows: Enriched[] }
  >({ phase: "loading" });

  const load = useCallback(async () => {
    if (!ready) return;
    if (!authenticated) {
      setState({ phase: "signed-out" });
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        setState({ phase: "signed-out" });
        return;
      }
      const { agents } = await listAgents(token);

      // Settled, not all: one agent whose equity 500s must not blank the whole
      // page. A row with a missing figure still shows its status and capital.
      const enriched = await Promise.all(
        agents.map(async (agent, i): Promise<Enriched> => {
          if (i >= FANOUT_CAP) return { agent, wallet: null, equity: null };
          const [detail, equity] = await Promise.allSettled([
            getAgent(token, agent.id),
            getEquity(token, agent.id),
          ]);
          return {
            agent,
            wallet: detail.status === "fulfilled" ? detail.value.wallet : null,
            equity: equity.status === "fulfilled" ? equity.value : null,
          };
        }),
      );
      setState({ phase: "ready", rows: enriched });
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [ready, authenticated, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Band plus rows, because that is what lands: the five summary cells are
  // computed from the same fetch as the list.
  if (state.phase === "loading")
    return (
      <SkeletonRows
        label="Loading your agents"
        band={5}
        cols="minmax(0,1.6fr) 140px 110px 110px 100px 110px minmax(0,240px)"
      />
    );
  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "error")
    return <ErrorState message={state.message} onRetry={() => void load()} />;

  const { rows } = state;

  if (rows.length === 0) {
    return (
      <div className="px-8 py-8">
        <EmptyState
          title="No agents yet"
          body="Build one and it starts on live data in paper mode — free, with no time limit and nothing funded."
          action={{ label: "Create agent", href: "/build/new" }}
        />
      </div>
    );
  }

  /* ---------------------------------------------------------------- band -- */

  const deployed = rows
    .filter((r) => r.agent.status !== "stopped")
    .reduce((s, r) => s + (Number(r.agent.capital_usd) || 0), 0);

  const pnl30d = sum30d(rows);

  const live = rows.filter((r) => !r.agent.is_paper && r.agent.status === "active").length;
  const paper = rows.filter((r) => r.agent.is_paper && r.agent.status === "active").length;
  const needsYou = rows.reduce((s, r) => s + (Number(r.agent.needs_you) || 0), 0);

  // Only the breaker writes paused_reason. A human pause leaves it null, and
  // "you paused this agent" is not news worth a red band.
  const stoppedItself = rows.filter(
    (r) =>
      (r.agent.status === "paused" || r.agent.status === "liquidating") && r.agent.paused_reason,
  );

  return (
    <div>
      <div className="grid grid-cols-2 border-b border-grid sm:grid-cols-3 lg:grid-cols-5">
        <Cell label="Capital deployed" value={money(deployed)} />
        <Cell
          label="P&L · 30d"
          value={pnl30d === null ? "—" : signed(pnl30d)}
          tone={pnl30d === null ? undefined : pnl30d >= 0 ? "accent" : "negative"}
          note={pnl30d === null ? "no readings yet" : undefined}
        />
        <Cell label="Live" value={String(live)} />
        <Cell label="Paper" value={String(paper)} />
        <Cell
          label="Needs you"
          value={String(needsYou)}
          tone={needsYou > 0 ? "accent" : undefined}
          note={needsYou > 0 ? "unanswered" : "nothing waiting"}
        />
      </div>

      {stoppedItself.map((r) => (
        <div
          key={r.agent.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-grid bg-negative/10 px-8 py-3.5"
        >
          <span className="size-2 shrink-0 bg-negative" />
          <p className="min-w-0 flex-1 font-ui text-[13.5px] text-text-secondary">
            <span className="font-mono text-[13px] text-text-primary">
              {r.agent.strategy_name}
            </span>{" "}
            stopped itself — {when(r.agent.last_tick_at)},{" "}
            {humanReason(r.agent.paused_reason!)}. Review the limits or resume.
          </p>
          <Link
            href={`/workspace/${r.agent.id}`}
            className="shrink-0 border border-border px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] text-text-primary uppercase transition-colors hover:border-accent hover:text-accent"
          >
            Review
          </Link>
        </div>
      ))}

      {/* --------------------------------------------------------- table -- */}

      <div className="grid grid-cols-[minmax(0,1.6fr)_140px_110px_110px_100px_110px_minmax(0,240px)] gap-x-4 border-b border-grid px-8 py-3 font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase max-lg:hidden">
        <span>Agent</span>
        <span>Wallet</span>
        <span>Status</span>
        <span className="text-right">Capital</span>
        <span className="text-right">Return</span>
        <span className="text-right">Last ran</span>
        <span />
      </div>

      {rows.map((r) => (
        <Row key={r.agent.id} row={r} onChanged={() => void load()} />
      ))}

      <p className="px-8 py-5 font-ui text-[12.5px] leading-relaxed text-text-dim">
        A running agent&apos;s rules are frozen — editing them forks the strategy into a fresh
        paper run rather than changing what is live underneath you. That happens in the
        agent&apos;s chat, which is where &ldquo;edit limits&rdquo; goes.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------- row -- */

function Row({ row, onChanged }: { row: Enriched; onChanged: () => void }) {
  const { agent, wallet, equity } = row;
  const { getAccessToken } = usePrivy();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paused = agent.status === "paused";
  const canToggle = paused || agent.status === "active";

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("not signed in");
      await (paused ? resumeAgent(token, agent.id) : pauseAgent(token, agent.id));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const ret = returnPct(equity);

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 border-b border-grid px-8 py-4 lg:grid-cols-[minmax(0,1.6fr)_140px_110px_110px_100px_110px_minmax(0,240px)] lg:items-center">
      <div className="min-w-0">
        <Link
          href={`/workspace/${agent.id}`}
          className="block truncate font-mono text-[14px] text-text-primary transition-colors hover:text-accent"
        >
          {agent.strategy_name}
        </Link>
        <p className="truncate font-ui text-[11.5px] text-text-dim">
          {agent.strategy_class} · {agent.autonomy.replace(/_/g, " ")}
          {agent.is_paper ? " · paper" : ""}
        </p>
      </div>

      {/* No wallet is the CORRECT state for a paper agent — nothing is funded
          and nothing can be signed. It is not a loading failure. */}
      {wallet ? (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(wallet.address)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              })
              .catch(() => {
                /* clipboard blocked — the address is still on screen */
              });
          }}
          className="truncate text-left font-mono text-[11.5px] text-text-secondary transition-colors hover:text-accent"
        >
          {copied ? "copied" : `${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)} ⧉`}
        </button>
      ) : (
        <span className="font-mono text-[11.5px] text-text-muted">
          {agent.is_paper ? "unfunded" : "—"}
        </span>
      )}

      <span>
        <span
          className={`inline-block px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] uppercase ${
            agent.status === "active"
              ? "bg-accent text-bg"
              : agent.status === "paused"
                ? "border border-negative text-negative"
                : agent.status === "liquidating"
                  ? "border border-negative text-negative"
                  : "border border-grid-strong text-text-muted"
          }`}
        >
          {STATUS_LABEL[agent.status] ?? agent.status}
        </span>
      </span>

      <span className="tnum font-mono text-[14px] text-text-primary lg:text-right">
        {money(Number(agent.capital_usd) || 0)}
      </span>

      <span
        className={`tnum font-mono text-[14px] lg:text-right ${
          ret === null ? "text-text-muted" : ret >= 0 ? "text-accent" : "text-negative"
        }`}
      >
        {ret === null ? "—" : signedPct(ret)}
      </span>

      <span className="font-ui text-[11.5px] text-text-dim lg:text-right">
        {when(agent.last_tick_at)}
      </span>

      <span className="flex flex-wrap items-center gap-2 lg:justify-end">
        {canToggle ? (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className="border border-border px-2.5 py-1.5 font-mono text-[10.5px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {busy ? "…" : paused ? "Resume" : "Pause"}
          </button>
        ) : null}
        <Link
          href={`/workspace/${agent.id}?tab=chat`}
          className="border border-border px-2.5 py-1.5 font-mono text-[10.5px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:border-accent hover:text-accent"
        >
          Edit limits
        </Link>
        <Link
          href={`/workspace/${agent.id}`}
          className="px-1 font-mono text-[10.5px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-accent"
        >
          Detail
        </Link>
        {error ? (
          <span className="w-full font-mono text-[10px] tracking-[0.06em] text-negative uppercase">
            {error}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------- pieces -- */

function Cell({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "accent" | "negative";
}) {
  return (
    <div className="border-r border-grid px-6 py-4 last:border-r-0">
      <p className="font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase">{label}</p>
      <p
        className={`tnum pt-1.5 font-mono text-[26px] leading-none ${
          tone === "accent"
            ? "text-accent"
            : tone === "negative"
              ? "text-negative"
              : "text-text-primary"
        }`}
      >
        {value}
      </p>
      {note ? <p className="pt-1.5 font-ui text-[11px] text-text-dim">{note}</p> : null}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  active: "Live",
  paused: "Paused",
  liquidating: "Closing out",
  stopped: "Stopped",
  draft: "Draft",
};

/* ---------------------------------------------------------------- figures -- */

/**
 * Return against the capital the agent was deployed with.
 *
 * Equity, not realised PnL: the last reading already carries the open book, and
 * an owner asking "how is it doing" means everything, not just what closed.
 */
function returnPct(equity: EquitySeries | null): number | null {
  if (!equity || equity.points.length === 0 || !equity.capitalUsd) return null;
  const last = equity.points[equity.points.length - 1].equityUsd;
  return ((last - equity.capitalUsd) / equity.capitalUsd) * 100;
}

/**
 * P&L across the trailing 30 days, summed over every agent with readings.
 *
 * The baseline is the last reading at or before the cutoff — what the book was
 * worth 30 days ago. An agent younger than the window has no such reading, so
 * its own first point is the baseline, which is its starting capital. Agents
 * with no readings at all contribute nothing rather than a zero.
 */
function sum30d(rows: Enriched[]): number | null {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let total = 0;
  let any = false;

  for (const { equity } of rows) {
    const points = equity?.points ?? [];
    if (points.length === 0) continue;
    const before = [...points].reverse().find((p) => new Date(p.at).getTime() <= cutoff);
    const base = before ?? points[0];
    total += points[points.length - 1].equityUsd - base.equityUsd;
    any = true;
  }
  return any ? total : null;
}

/** Breaker codes are snake_case state names. This is what they mean to an owner. */
function humanReason(reason: string): string {
  const known: Record<string, string> = {
    max_drawdown_breached: "it breached its drawdown limit",
    drawdown_breach: "it breached its drawdown limit",
    wallet_revoked: "its wallet delegation was revoked",
    wallet_expired: "its wallet delegation expired",
    mandate_expired: "its mandate expired",
    insufficient_funds: "it ran out of funds",
  };
  return known[reason] ?? reason.replace(/_/g, " ");
}

function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function signed(n: number): string {
  const s = `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return n < 0 ? `−${s}` : `+${s}`;
}

function signedPct(n: number): string {
  return `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(1)}%`;
}

function when(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}
