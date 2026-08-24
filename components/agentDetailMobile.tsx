"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Gavel, Pause, Play, Plus, Share2, Star, TrendingUp } from "lucide-react";

import { AddMarketModal } from "@/components/addMarket";
import { RouteBadge, routeOfMint } from "@/components/routeBadge";
import { AssetLogo } from "@/components/ui";
import { usePrivy } from "@privy-io/react-auth";

import { EquityCurve } from "@/components/charts";
import { AgentChatSheet } from "@/components/agentChatSheet";
import { headline } from "@/components/activity";
import {
  getActivity,
  num,
  selectionLabel,
  pauseAgent,
  resumeAgent,
  type ActivityCycle,
  type AgentDetail,
  type AgentRow,
  type EquitySeries,
  type UniverseAsset,
  type UniverseSelection,
} from "@/lib/api";
import { markAgent } from "@/lib/perf";
import { ModelBadge } from "@/components/modelBadge";
import { ModelPanel } from "@/components/modelPanel";
import { usePersonalWallet } from "@/lib/usePersonalWallet";

/**
 * One agent, on a phone — wireframe M03.
 *
 * The desktop page is a two-column workspace with eight sections. This is the
 * five the wireframe keeps: who it is, what it is worth, what it is doing right
 * now, what it holds, and the two things you might do about it.
 *
 * THE PHASE BAR IS DERIVED, NOT DECORATIVE. Scan / Council / Execute / Settle
 * are read off which SEATS have spoken in the newest cycle — the analyst screens
 * the universe, risk and the portfolio manager deliberate, the trader fills,
 * and the cycle closing is the settle. That is the one thing on this screen
 * that needed a request the desktop layout has no use for, which is why this
 * component is mounted by viewport rather than hidden by CSS.
 */

const PHASES = ["Scan", "Council", "Execute", "Settle"] as const;

export function AgentDetailMobile({
  agent,
  detail,
  equity,
  positions,
  assets,
  assetsPending,
  universe,
  onChanged,
}: {
  agent: AgentRow;
  detail: AgentDetail;
  equity: EquitySeries | null;
  positions: AgentDetail["positions"];
  assets: UniverseAsset[];
  assetsPending: boolean;
  /** What the strategy is allowed to trade, not what it currently holds. */
  universe: UniverseSelection[];
  onChanged: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const [range, setRange] = useState<"7D" | "30D" | "ALL">("ALL");
  const [chatOpen, setChatOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cycle, setCycle] = useState<ActivityCycle | null>(null);
  const [adding, setAdding] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const personalWallet = usePersonalWallet();

  // The newest cycle, for the phase bar. One request, one cycle deep.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const { cycles } = await getActivity(token, agent.id, 1);
        if (!cancelled) setCycle(cycles[0] ?? null);
      } catch {
        // The bar simply does not render. It is a status display, not a fact
        // anyone acts on, and an error box above the equity would be louder
        // than what it is reporting.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agent.id, getAccessToken]);

  const mark = useMemo(
    () => markAgent(equity, positions, assets),
    [equity, positions, assets],
  );

  const points = mark?.points ?? [];
  const shown = useMemo(() => {
    if (range === "ALL") return points;
    const ms = range === "7D" ? 7 * 86_400_000 : 30 * 86_400_000;
    const w = points.filter((p) => Date.now() - new Date(p.at).getTime() <= ms);
    return w.length > 1 ? w : points;
  }, [points, range]);

  const reached = phaseIndex(cycle);
  const running = cycle?.status === "running";
  const [whole, cents] = splitMoney(mark?.equityUsd ?? num(agent.capital_usd) ?? 0);
  const paused = agent.status === "paused" || agent.status === "stopped";

  async function toggle() {
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      await (paused ? resumeAgent(token, agent.id) : pauseAgent(token, agent.id));
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-2">
      {/* ---------------------------------------------------------- nav -- */}
      <div className="flex items-center justify-between px-[18px] py-2">
        <Link href="/workspace" aria-label="Back to my agents">
          <ChevronLeft className="size-6 text-text-primary" aria-hidden />
        </Link>
        <div className="flex items-center gap-[18px]">
          <Star className="size-[19px] text-text-secondary" aria-hidden />
          <Share2 className="size-[19px] text-text-secondary" aria-hidden />
        </div>
      </div>

      {/* --------------------------------------------------------- hero -- */}
      <div className="flex items-center gap-[13px] px-[18px] pt-1.5 pb-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[17px] border border-border bg-accent-wash">
          <TrendingUp className="size-6 text-accent" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-[7px]">
            <h1 className="truncate font-ui text-[21px] font-semibold tracking-[-0.5px] text-text-primary">
              {agent.strategy_name}
            </h1>
            {/* Beside the name here too, so the phone and the desktop agree
                about where this fact lives. The name truncates before the pill
                does, which is the right order: the name has a second copy in
                the header bar above, the model has none. */}
            <button
              type="button"
              onClick={() => setModelOpen(true)}
              aria-label={`Model: ${agent.model?.label ?? "cQWEN3"} — open model settings`}
              className="shrink-0 transition-opacity active:opacity-70"
            >
              <ModelBadge model={agent.model} />
            </button>
            {agent.status === "active" ? (
              <span className="flex shrink-0 items-center gap-1.5 rounded-[5px] bg-accent-wash px-1.5 py-[3px]">
                <span className="size-[5px] rounded-full bg-accent" />
                <span className="font-mono text-[8.5px] font-semibold tracking-[0.7px] text-accent">
                  LIVE
                </span>
              </span>
            ) : null}
          </div>
          <p className="truncate font-mono text-[11.5px] text-text-muted">
            {agent.is_paper ? "PAPER" : "LIVE"} · {agent.strategy_class.toUpperCase()}
            {points.length ? ` · CYCLE ${points[points.length - 1].tickSeq}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="Chat with this agent"
          className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface"
        >
          <svg viewBox="0 0 24 24" className="size-[18px] text-text-primary" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {Number(agent.needs_you ?? 0) > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 flex size-[22px] items-center justify-center rounded-full border-2 border-bg bg-warning font-mono text-[11px] font-bold text-bg">
              {Number(agent.needs_you) > 9 ? "9+" : agent.needs_you}
            </span>
          ) : null}
        </button>
      </div>

      {/* --------------------------------------------------------- NAV --- */}
      <div className="border-y border-grid bg-panel">
        <div className="flex items-start justify-between px-[18px] pt-4 pb-2.5">
          <div className="space-y-1.5">
            <p className="font-mono text-[9px] font-semibold tracking-[0.9px] text-text-dim uppercase">
              Agent NAV{points.length ? ` · cycle ${points[points.length - 1].tickSeq}` : ""}
            </p>
            <p className="flex items-end font-mono text-[30px] leading-none font-semibold tracking-[-1px]">
              <span className="text-text-primary">{whole}</span>
              <span className="text-text-muted">{cents}</span>
            </p>
            {mark ? (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className={`font-mono text-[13px] font-semibold ${mark.pnlUsd >= 0 ? "text-accent" : "text-negative"}`}>
                  {signed(mark.pnlUsd)}
                </span>
                <span className={`font-mono text-[13px] font-semibold ${mark.returnPct >= 0 ? "text-accent" : "text-negative"}`}>
                  {signedPct(mark.returnPct)}
                </span>
                <span className="font-mono text-[9px] font-semibold tracking-[0.7px] text-text-dim uppercase">
                  since deploy
                </span>
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-0.5 rounded-[9px] border border-border bg-bg p-[3px]">
            {(["7D", "30D", "ALL"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`rounded-[7px] px-2 py-[5px] font-mono text-[10px] font-semibold tracking-[0.4px] ${
                  range === r ? "bg-surface-2 text-text-primary" : "text-text-muted"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[168px]">
          {shown.length > 1 ? (
            <EquityCurve
              values={shown.map((p) => p.equityUsd)}
              baseline={mark?.deployedCapitalUsd}
              height={168}
            />
          ) : (
            <p className="px-[18px] py-14 text-center font-ui text-[12.5px] text-text-dim">
              The curve starts at the first settled cycle.
            </p>
          )}
        </div>

        {/* Four figures. SHARPE in the wireframe has nothing behind it — no
            risk-free rate and no return series to annualise — so the slot
            carries realised P&L, which the equity payload does report. */}
        <div className="flex border-t border-grid">
          <Cell label="Return" value={mark ? signedPct(mark.returnPct) : "—"} tone={mark && mark.returnPct < 0 ? "negative" : "accent"} first />
          <Cell label="Win rate" value={mark?.hitRatePct === null || !mark ? "—" : `${mark.hitRatePct.toFixed(0)}%`} />
          <Cell label="Max DD" value={mark && mark.maxDrawdownPct > 0 ? `−${mark.maxDrawdownPct.toFixed(1)}%` : "—"} tone={mark && mark.maxDrawdownPct > 0 ? "negative" : "neutral"} />
          <Cell label="Realised" value={mark ? signed(mark.realizedPnlUsd) : "—"} tone={mark && mark.realizedPnlUsd < 0 ? "negative" : "accent"} />
        </div>
      </div>

      {/* -------------------------------------------------- live cycle -- */}
      {cycle ? (
        <div className="space-y-[13px] border-b border-grid px-[18px] pt-[18px] pb-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold tracking-[0.9px] text-text-secondary uppercase">
              Cycle {cycle.tick_seq} · {running ? "running" : cycle.status}
            </span>
            <span className="font-mono text-[10px] font-semibold text-text-dim">
              {running ? "in progress" : ago(cycle.started_at)}
            </span>
          </div>

          <div className="flex gap-1.5">
            {PHASES.map((p, i) => (
              <div key={p} className="flex-1 space-y-2">
                <div
                  className={`h-[3px] rounded-sm ${
                    i < reached ? "bg-accent/60" : i === reached ? "bg-accent" : "bg-grid-strong"
                  }`}
                />
                <p
                  className={`font-ui text-[11.5px] ${
                    i === reached
                      ? "font-semibold text-accent"
                      : i < reached
                        ? "font-medium text-text-secondary"
                        : "font-medium text-text-muted"
                  }`}
                >
                  {p}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2.5 rounded-[11px] border border-border-soft bg-surface px-3 py-2.5">
            <Gavel className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
            <p className="font-ui text-[12.5px] leading-relaxed text-text-secondary">
              {headline(cycle)}
            </p>
          </div>
        </div>
      ) : null}

      {/* ---------------------------------------------------- positions -- */}
      <div className="border-b border-grid pt-[18px]">
        <div className="flex items-center justify-between px-[18px] pb-3">
          <p className="font-ui text-[16px] font-semibold tracking-[-0.2px] text-text-primary">
            Open positions
          </p>
          <span className="font-mono text-[13px] font-semibold text-text-muted">
            {positions.length}
          </span>
        </div>
        {positions.length === 0 ? (
          <p className="px-[18px] pb-4 font-ui text-[12.5px] text-text-dim">
            Nothing open — the agent is in cash.
          </p>
        ) : (
          <ul className="px-[18px] pb-4">
            {positions.map((p, i) => {
              const price = assets.find((a) => a.symbol === p.symbol)?.priceUsd;
              const qty = num(p.qty);
              const cost = num(p.cost_basis_usd) ?? 0;
              const value = num(price) !== null && qty !== null ? num(price)! * qty : cost;
              const pnl = value - cost;
              return (
                <li key={p.symbol} className={`flex items-center gap-2.5 py-3 ${i ? "border-t border-grid" : ""}`}>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block truncate font-mono text-[14px] font-semibold text-text-primary">
                      {p.symbol}
                    </span>
                    <span className="block font-mono text-[11px] text-text-dim">
                      {money(cost)} cost
                    </span>
                  </span>
                  <span className="shrink-0 space-y-1 text-right">
                    <span className={`block font-mono text-[14px] font-semibold ${pnl >= 0 ? "text-accent" : "text-negative"}`}>
                      {signed(pnl)}
                    </span>
                    <span className="block font-mono text-[11.5px] text-text-dim">{money(value)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ------------------------------------------------------ markets -- */}
      <div className="border-b border-grid pt-[18px]">
        <div className="flex items-center justify-between px-[18px] pb-3">
          <p className="font-ui text-[16px] font-semibold tracking-[-0.2px] text-text-primary">
            Markets it may trade
          </p>
          <span className="font-mono text-[13px] font-semibold text-text-muted">
            {universe.length}
          </span>
        </div>

        {/* The mandate, not the book. A market can sit here with nothing open
            against it — that is the agent having looked and declined, which is
            a different fact from not being allowed to look. */}
        <ul className="px-[18px]">
          {universe.map((sel, i) => (
            <li
              key={selectionLabel(sel)}
              className={`flex items-center gap-2.5 py-2.5 ${i ? "border-t border-grid" : ""}`}
            >
              <AssetLogo symbol={selectionLabel(sel)} size={22} />
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-text-primary">
                {selectionLabel(sel)}
              </span>
              {/* Same pair as the pickers — where this one settles and fills.
                  Derived from the selection's own mint rather than hardcoded:
                  a saved KalqiX pick carries a "kalqix:" identity, and showing
                  it as Solana/Jupiter would name the wrong venue on a row the
                  owner chose deliberately. */}
              <RouteBadge
                {...routeOfMint(sel.kind === "crypto" ? sel.mint : undefined)}
                size={15}
              />
            </li>
          ))}
        </ul>

        {/* Attached to the list rather than spaced off it: adding a market is
            the same act as the rows above, not a separate section. */}
        <div className="px-[18px] pt-2 pb-4">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-grid-strong py-3 text-text-secondary transition-colors hover:border-accent hover:text-accent"
          >
            <Plus className="size-4" aria-hidden />
            <span className="font-ui text-[13.5px] font-semibold">Add a market</span>
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------- CTA -- */}
      <div className="flex gap-2.5 px-[18px] pt-[18px] pb-4">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy}
          className="flex h-[52px] shrink-0 items-center gap-[7px] rounded-[14px] border border-border bg-surface px-[18px] disabled:opacity-50"
        >
          {paused ? (
            <Play className="size-4 text-text-primary" aria-hidden />
          ) : (
            <Pause className="size-4 text-text-primary" aria-hidden />
          )}
          <span className="font-ui text-[15px] font-semibold text-text-primary">
            {busy ? "…" : paused ? "Resume" : "Pause"}
          </span>
        </button>
        <Link
          href={`/deploy/fund?agent=${agent.id}`}
          className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-accent"
        >
          <Plus className="size-4 text-bg" aria-hidden />
          <span className="font-ui text-[15px] font-semibold text-bg">Add funds</span>
        </Link>
      </div>

      {chatOpen ? (
        <AgentChatSheet agentId={agent.id} agent={agent} onClose={() => setChatOpen(false)} />
      ) : null}

      {modelOpen ? (
        <ModelPanel
          agentId={agent.id}
          agentWallet={detail.wallet?.address ?? null}
          personalWallet={personalWallet}
          expiresAt={agent.expires_at ?? null}
          onChanged={onChanged}
          onClose={() => setModelOpen(false)}
        />
      ) : null}

      {adding ? (
        <AddMarketModal
          agentId={agent.id}
          agentName={agent.strategy_name}
          assets={assets}
          loading={assetsPending}
          existing={universe}
          // Reloads behind the open dialog, so the list and the modal agree the
          // moment a change lands rather than only after closing.
          onChanged={onChanged}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * How far the newest cycle has got, from which seats have spoken.
 *
 * The seats ARE the phases: the analyst screens, risk and the portfolio manager
 * deliberate, the trader fills. A settled cycle is past all of them. Returns an
 * index into PHASES — the furthest reached, not the count.
 */
function phaseIndex(c: ActivityCycle | null): number {
  if (!c) return 0;
  if (c.status !== "running") return 3;
  const roles = new Set(c.decisions.map((d) => d.role));
  if (roles.has("trader")) return 2;
  if (roles.has("risk") || roles.has("pm")) return 1;
  return 0;
}

function Cell({
  label,
  value,
  tone = "neutral",
  first,
}: {
  label: string;
  value: string;
  tone?: "accent" | "negative" | "neutral";
  first?: boolean;
}) {
  return (
    <div className={`flex-1 space-y-1.5 px-3 pt-[13px] pb-3.5 ${first ? "" : "border-l border-grid"}`}>
      <p className="font-mono text-[8.5px] font-semibold tracking-[0.7px] text-text-dim uppercase">
        {label}
      </p>
      <p
        className={`font-mono text-[14.5px] font-semibold ${
          tone === "accent" ? "text-accent" : tone === "negative" ? "text-negative" : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- format -- */

function splitMoney(n: number): [string, string] {
  if (!Number.isFinite(n)) return ["—", ""];
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [w, f] = s.split(".");
  return [`${n < 0 ? "−" : ""}$${w}`, `.${f}`];
}
function money(n: number): string {
  return Number.isFinite(n) ? `$${Math.round(n).toLocaleString("en-US")}` : "—";
}
function signed(n: number): string {
  const s = `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `−${s}` : `+${s}`;
}
function signedPct(n: number): string {
  return `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(1)}%`;
}
function ago(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}
