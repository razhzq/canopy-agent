import { usd } from "@/lib/format";
import type { AgentRow } from "@/lib/api";

/** A signed dollar amount or percent, green up and red down; a dash when unknown. */
export function Signed({ usd: dollars, pct, digits = 2 }: { usd?: number | null; pct?: number | null; digits?: number }) {
  const v = dollars !== undefined ? dollars : pct;
  if (v == null || !Number.isFinite(v)) return <span className="tnum font-mono text-text-muted">—</span>;
  const tone = v > 0 ? "text-positive" : v < 0 ? "text-negative" : "text-text-primary";
  const text = dollars !== undefined ? usd(v, { sign: true }) : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
  return <span className={`tnum font-mono ${tone}`}>{text}</span>;
}

/** What an agent is doing, in words: no dot indicators. */
export function agentStatus(a: Pick<AgentRow, "status" | "is_paper" | "needs_you">): string {
  const needs = Number(a.needs_you ?? 0);
  if (needs > 0) return needs === 1 ? "Needs you" : `Needs you · ${needs}`;
  const base =
    a.status === "active" ? "Running" : a.status === "paused" ? "Paused" : a.status === "liquidating" ? "Closing positions" : a.status === "stopped" ? "Stopped" : "Draft";
  return a.is_paper ? `${base} · Paper` : base;
}
