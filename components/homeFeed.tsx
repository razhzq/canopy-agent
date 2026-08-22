"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, Flame, Plus, ScanLine, SlidersHorizontal, Trees, TrendingUp } from "lucide-react";

import { DepositModal } from "@/components/walletModals";
import { EmptyState } from "@/components/states";
import { returnSinceDeployPct } from "@/lib/perf";
import { usePersonalWallet } from "@/lib/usePersonalWallet";
import type { AgentRow, EquitySeries } from "@/lib/api";

/**
 * The mobile home — wireframe M01.
 *
 * NOT the desktop table at a narrower width. The wireframe puts three things
 * above the list that the table has nowhere to say: what the account is worth,
 * a way to fund it, and which agents are actually working. On a phone those are
 * the whole first screen, and the list is what you scroll to.
 *
 * Measurements are the .pen's: 34px balance with the cents dropped to
 * $text-muted, a 196-wide card strip, 34px chips at radius 10, and 44px agent
 * glyphs at radius 13. They are written out rather than approximated because
 * "close enough" is what made the first attempt look like a different product.
 *
 * IT DOES NOT FETCH. `MyAgents` already fans out one request per agent for the
 * table; a second fan-out for the same rows on the same route would double the
 * page's cost to show the same numbers.
 */

export interface FeedRow {
  agent: AgentRow;
  equity: EquitySeries | null;
}

type Chip = "all" | "live" | "top" | "paused";

const CHIPS: { key: Chip; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "top", label: "Top PnL" },
  { key: "paused", label: "Paused" },
];

export function HomeFeed({ rows }: { rows: FeedRow[] }) {
  const wallet = usePersonalWallet();
  const [depositing, setDepositing] = useState(false);
  const [chip, setChip] = useState<Chip>("all");

  const totals = useMemo(() => {
    const counted = rows.filter((r) => r.agent.status !== "stopped" && r.agent.status !== "draft");
    let deployed = 0;
    let pnl = 0;
    let moved24h = 0;
    let any = false;
    for (const r of counted) {
      deployed += Number(r.agent.capital_usd) || 0;
      const points = r.equity?.points ?? [];
      if (points.length === 0) continue;
      const base = r.equity?.capitalUsd || points[0].equityUsd;
      pnl += points[points.length - 1].equityUsd - base;
      any = true;
      // Measured against the last reading at or before the cutoff, not the
      // first inside it — agents tick at different cadences.
      const cutoff = Date.now() - 86_400_000;
      let ref: number | null = null;
      for (const p of points) {
        if (new Date(p.at).getTime() <= cutoff) ref = p.equityUsd;
        else break;
      }
      if (ref !== null) moved24h += points[points.length - 1].equityUsd - ref;
    }
    return {
      equity: deployed + pnl,
      moved24h: any ? moved24h : null,
      agents: counted.length,
      allPaper: counted.length > 0 && counted.every((r) => r.agent.is_paper),
    };
  }, [rows]);

  const top = useMemo(
    () =>
      [...rows]
        .filter((r) => r.equity && (r.equity.points?.length ?? 0) > 0)
        .sort((a, b) => (returnSinceDeployPct(b.equity) ?? 0) - (returnSinceDeployPct(a.equity) ?? 0))
        .slice(0, 4),
    [rows],
  );

  const shown = useMemo(() => {
    const list =
      chip === "live"
        ? rows.filter((r) => r.agent.status === "active")
        : chip === "paused"
          ? rows.filter((r) => r.agent.status === "paused" || r.agent.status === "liquidating")
          : rows;
    return chip === "top"
      ? [...list].sort(
          (a, b) => (returnSinceDeployPct(b.equity) ?? 0) - (returnSinceDeployPct(a.equity) ?? 0),
        )
      : list;
  }, [rows, chip]);

  const [whole, cents] = splitMoney(totals.equity);

  return (
    <div className="lg:hidden">
      {/* ------------------------------------------------------- header -- */}
      <div className="flex items-center justify-between px-[18px] pt-2.5 pb-1">
        <div className="flex items-center gap-[7px]">
          <Trees className="size-5 text-accent" aria-hidden />
          <span className="font-ui text-[16px] font-semibold tracking-[-0.2px] text-text-primary">
            Canopy
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/notifications" aria-label="Notifications">
            <Bell className="size-[19px] text-text-secondary" aria-hidden />
          </Link>
          <Link href="/agents" aria-label="Explore strategies">
            <ScanLine className="size-[19px] text-text-secondary" aria-hidden />
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------ balance -- */}
      <div className="flex items-center justify-between px-[18px] pt-3.5 pb-[18px]">
        <div className="space-y-[5px]">
          <p className="flex items-end font-mono text-[34px] leading-none font-semibold tracking-[-1.2px]">
            {/* Cents in $text-muted: the figure people read is the dollars, and
                dropping the cents back stops two decimal places competing with
                four significant ones. */}
            <span className="text-text-primary">{whole}</span>
            <span className="text-text-muted">{cents}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <span
              className={`font-mono text-[13px] font-semibold ${
                (totals.moved24h ?? 0) >= 0 ? "text-accent" : "text-negative"
              }`}
            >
              {totals.moved24h === null ? "—" : signed(totals.moved24h)}
            </span>
            <span className="font-mono text-[9.5px] font-semibold tracking-[0.7px] text-text-dim uppercase">
              24H · ACROSS {totals.agents} {totals.agents === 1 ? "AGENT" : "AGENTS"}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDepositing(true)}
          disabled={!wallet}
          className="flex shrink-0 items-center gap-1.5 rounded-[11px] bg-accent px-5 py-[13px] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="size-[15px] text-bg" aria-hidden />
          <span className="font-ui text-[14px] font-semibold text-bg">Fund</span>
        </button>
      </div>

      {/* ---------------------------------------------- top performers -- */}
      {top.length > 0 ? (
        <div className="space-y-[11px] pt-0.5 pb-4">
          <div className="flex items-center gap-[7px] px-[18px]">
            <Flame className="size-[15px] text-warning" aria-hidden />
            <span className="font-mono text-[10.5px] font-semibold tracking-[0.9px] text-text-secondary uppercase">
              Weekly top performers
            </span>
          </div>
          {/* Overflows on purpose — a card clipped at the right edge is what
              says there are more. */}
          <div className="flex gap-2.5 overflow-x-auto px-[18px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {top.map((r) => {
              const pct = returnSinceDeployPct(r.equity) ?? 0;
              return (
                <Link
                  key={r.agent.id}
                  href={`/workspace/${r.agent.id}`}
                  className="w-[196px] shrink-0 space-y-[11px] rounded-[14px] border border-border bg-panel px-3.5 py-[13px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-surface-2">
                      <TrendingUp className="size-[13px] text-accent" aria-hidden />
                    </span>
                    <span className="truncate font-ui text-[13.5px] font-semibold tracking-[-0.2px] text-text-primary">
                      {r.agent.strategy_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[14px] font-semibold ${pct >= 0 ? "text-accent" : "text-negative"}`}>
                      {signedPct(pct)}
                    </span>
                    <span className="font-mono text-[8.5px] font-semibold tracking-[0.6px] text-text-dim uppercase">
                      {r.agent.strategy_class}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* --------------------------------------------------------- tabs -- */}
      <div className="flex border-b border-grid">
        {[
          { label: "Agents", href: null },
          { label: "Explore", href: "/agents" },
          { label: "Activity", href: "/activity" },
        ].map((t) =>
          t.href === null ? (
            <span key={t.label} className="flex flex-1 flex-col items-center gap-[11px]">
              <span className="font-ui text-[14.5px] font-semibold text-text-primary">{t.label}</span>
              <span className="h-0.5 w-full bg-accent" />
            </span>
          ) : (
            <Link key={t.label} href={t.href} className="flex flex-1 flex-col items-center gap-[11px]">
              <span className="font-ui text-[14.5px] font-medium text-text-muted">{t.label}</span>
              <span className="h-0.5 w-full" />
            </Link>
          ),
        )}
      </div>

      {/* -------------------------------------------------------- chips -- */}
      <div className="flex h-[60px] items-center gap-2 overflow-x-auto px-[18px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="flex size-9 h-[34px] w-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface">
          <SlidersHorizontal className="size-[15px] text-text-secondary" aria-hidden />
        </span>
        {CHIPS.map((c) => {
          const on = chip === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setChip(c.key)}
              aria-pressed={on}
              className={`flex h-[34px] shrink-0 items-center rounded-[10px] border px-3.5 font-ui text-[13.5px] transition-colors ${
                on
                  ? "border-border bg-surface-2 font-semibold text-text-primary"
                  : "border-border-soft font-medium text-text-secondary"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------------------- list -- */}
      {shown.length === 0 ? (
        <div className="px-[18px] py-8">
          <EmptyState
            title={rows.length === 0 ? "No agents yet" : "Nothing here"}
            body={
              rows.length === 0
                ? "Build one and it starts on live data in paper mode — free, with no time limit and nothing funded."
                : "No agents match this filter."
            }
            action={rows.length === 0 ? { label: "Create agent", href: "/build/new" } : undefined}
          />
        </div>
      ) : (
        <ul className="px-[18px] pt-0.5">
          {shown.map((r, i) => (
            <AgentFeedRow key={r.agent.id} row={r} first={i === 0} />
          ))}
        </ul>
      )}

      {depositing && wallet ? (
        <DepositModal address={wallet} onClose={() => setDepositing(false)} />
      ) : null}
    </div>
  );
}

function AgentFeedRow({ row, first }: { row: FeedRow; first: boolean }) {
  const { agent, equity } = row;
  const pct = returnSinceDeployPct(equity);
  const points = equity?.points ?? [];
  const cycles = points.length;
  const hit =
    equity && equity.closedPositions > 0
      ? Math.round((equity.winningPositions / equity.closedPositions) * 100)
      : null;
  const value = points.length
    ? (equity?.capitalUsd || points[0].equityUsd) +
      (points[points.length - 1].equityUsd - (equity?.capitalUsd || points[0].equityUsd))
    : Number(agent.capital_usd) || 0;

  return (
    <li className={first ? "" : "border-t border-grid"}>
      <Link href={`/workspace/${agent.id}`} className="flex items-center gap-3 py-[11px]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] border border-border bg-surface-2">
          <TrendingUp className="size-5 text-accent" aria-hidden />
        </span>

        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-ui text-[15px] font-semibold tracking-[-0.2px] text-text-primary">
              {agent.strategy_name}
            </span>
            <span className="shrink-0 rounded border-0 bg-surface-2 px-[5px] py-0.5 font-mono text-[8.5px] font-semibold tracking-[0.6px] text-text-secondary uppercase">
              {agent.is_paper ? "paper" : agent.strategy_class}
            </span>
          </span>
          <span className="block font-mono text-[11.5px] text-text-dim">
            {cycles === 0
              ? "no cycles yet"
              : `${cycles} ${cycles === 1 ? "cycle" : "cycles"}${hit === null ? "" : ` · ${hit}% win`}`}
          </span>
        </span>

        <span className="shrink-0 space-y-1 text-right">
          <span className="block font-mono text-[15px] font-semibold text-text-primary">
            {money(value)}
          </span>
          <span
            className={`block font-mono text-[12.5px] font-semibold ${
              pct === null ? "text-text-dim" : pct >= 0 ? "text-accent" : "text-negative"
            }`}
          >
            {pct === null ? "—" : signedPct(pct)}
          </span>
        </span>
      </Link>
    </li>
  );
}

/* ------------------------------------------------------------- format -- */

/** `$4,281.28` → `["$4,281", ".28"]`, so the cents can be set back. */
function splitMoney(n: number): [string, string] {
  if (!Number.isFinite(n)) return ["—", ""];
  const s = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const [whole, frac] = s.split(".");
  return [`${n < 0 ? "−" : ""}$${whole}`, `.${frac}`];
}

function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function signed(n: number): string {
  const s = `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  return n < 0 ? `−${s}` : `+${s}`;
}

function signedPct(n: number): string {
  return `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(1)}%`;
}
