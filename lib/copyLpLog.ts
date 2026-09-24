// A copy LP agent's activity, as a flat log rather than as cycles.
//
// A copy agent has no desk, no screen and no model: it reads the leader's book
// and takes a share of it. The cycle cards the trading agents use — seats,
// a replay, a status per run — describe machinery a copy agent does not have,
// so its activity is one line per thing that happened, newest first.
//
// Built from the same decision rows as the cycle log (the audit trail is not
// reshaped), and kept free of React so the mapping can be read and tested on
// its own.

import type { ActivityCycle, ActivityDecision } from "@/lib/api";
import { narrateDecision, type NarrateContext } from "@/lib/narrate";
import type { Translate } from "@/lib/i18n";

export type LogKind =
  | "opened"
  | "added"
  | "reduced"
  | "reranged"
  | "closed"
  | "take_profit"
  | "stop_loss"
  | "skipped"
  | "error"
  | "started"
  | "note";

/** Which filter a kind falls under. */
export type LogGroup = "trades" | "skipped" | "errors" | "other";

export function groupOf(kind: LogKind): LogGroup {
  if (kind === "skipped") return "skipped";
  if (kind === "error") return "errors";
  if (kind === "started" || kind === "note") return "other";
  return "trades";
}

export interface LogEntry {
  key: string;
  /** When the row was written — the moment the mirror acted. */
  at: string;
  kind: LogKind;
  /** The pair, or null when the row names no pool (a start, an old row). */
  pool: string | null;
  detail: string;
  /**
   * The figure for the Amount column, in dollars as recorded.
   *
   * `in` is money put into a position; `pnl` is profit or loss realised, net of
   * the profit fees taken on it. Null when the event moved no money.
   */
  amount: { usd: number; role: "in" | "pnl" } | null;
  /** Fees behind the figure above, in dollars, when there were any. */
  feesUsd: number | null;
  /**
   * Dollars per SOL AS RECORDED ON THIS RUN, for a SOL book. The amount is
   * shown in SOL at the rate of the moment it happened — never at today's,
   * which would move a closed trade's result with the price.
   */
  usdPerSol: number | null;
  /**
   * Every transaction behind the entry, in the order they landed — the swaps
   * that bought a range's tokens, the deposit, a removal and its sell-backs,
   * both halves of a rerange. A failed action keeps the ones that landed
   * before it failed. Empty on paper and on rows written before they were
   * recorded.
   */
  txSignatures: string[];
}

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function poolName(v: unknown, ctx: NarrateContext): string | null {
  const address = str(v);
  if (!address) return null;
  return ctx.pools?.[address] ?? `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** A close records one `txSignature`; every other action a list. */
function signaturesOf(o: Record<string, unknown>): string[] {
  const list = Array.isArray(o.txSignatures)
    ? o.txSignatures.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  const one = str(o.txSignature);
  return one && !list.includes(one) ? [...list, one] : list;
}

/** "Take profit: this copy is up…" → "This copy is up…" */
function afterPrefix(reason: string, prefix: string): string {
  const rest = reason.slice(prefix.length).trim();
  return rest ? rest[0].toUpperCase() + rest.slice(1) : reason;
}

/**
 * Every log entry on a page of runs, newest first.
 *
 * `money` formats a dollar figure in the book's unit at the run's own rate;
 * it is what puts "0.912 SOL" inside a sentence on a SOL book.
 */
export function logEntries(
  cycles: readonly ActivityCycle[],
  t: Translate,
  ctx: NarrateContext,
  money: (usd: number, usdPerSol: number | null) => string,
): LogEntry[] {
  const out: LogEntry[] = [];

  for (const cycle of cycles) {
    const rows = [...cycle.decisions].sort((a, b) => b.seq - a.seq);
    const pm = rows.find((d) => d.role === "pm")?.output;
    const rate = pm && num(pm.usdPerSol) > 0 ? num(pm.usdPerSol) : null;
    const m = (usd: number) => money(usd, rate);
    let wrote = false;

    for (const d of rows) {
      if (d.role !== "trader") continue;
      const entry = entryFor(d, cycle, t, ctx, m);
      if (entry) {
        out.push({ ...entry, usdPerSol: rate });
        wrote = true;
      }
    }

    // A mirror run that failed before writing any action still happened.
    if (!wrote && cycle.status === "error" && cycle.error) {
      out.push({
        key: `${cycle.id}:error`,
        at: cycle.ended_at ?? cycle.started_at,
        kind: "error",
        pool: null,
        detail: cycle.error,
        amount: null,
        feesUsd: null,
        usdPerSol: rate,
        txSignatures: [],
      });
    }
  }

  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

function entryFor(
  d: ActivityDecision,
  cycle: ActivityCycle,
  t: Translate,
  ctx: NarrateContext,
  money: (usd: number) => string,
): Omit<LogEntry, "usdPerSol"> | null {
  const o = d.output;
  const base = {
    key: `${cycle.id}:${d.seq}`,
    at: d.created_at,
    pool: poolName(o.pool, ctx),
    amount: null,
    feesUsd: null,
    txSignatures: signaturesOf(o),
  };

  // A close from outside the mirror — the owner's Close button, the loss
  // limit — is still something that happened to this book. It keeps the
  // desk's own sentence rather than a second wording of it.
  if (o.copyLp !== true) {
    const line = narrateDecision(d, t, ctx)[0];
    return line ? { ...base, kind: "note", detail: line.detail } : null;
  }

  const action = str(o.action);
  // Profit fees leave with the proceeds, so the figure is what the owner kept.
  const profitFee = num(o.feeUsd);
  const netPnl = num(o.realizedPnlUsd) - profitFee;
  const limit = o.limitedByCash
    ? t("clplog_limit_cash")
    : o.capped
      ? t("clplog_limit_capped")
      : "";

  if (o.executed === false) {
    return { ...base, kind: "error", detail: t("clplog_failed", { error: str(o.error) }) };
  }

  switch (action) {
    case "start": {
      const left = num(o.leftAlone);
      return {
        ...base,
        kind: "started",
        detail:
          left === 0
            ? t("clplog_started_flat")
            : left === 1
              ? t("clplog_started_one")
              : t("clplog_started_many", { count: left }),
      };
    }
    case "skip":
      return {
        ...base,
        kind: "skipped",
        detail: str(o.reason) ? t("clplog_skipped_reason", { reason: str(o.reason) }) : t("clplog_skipped"),
      };
    case "open": {
      const cost = num(o.costUsd);
      return {
        ...base,
        kind: "opened",
        detail: t("clplog_opened", { share: `${num(o.sharePct).toFixed(1)}%` }),
        amount: { usd: num(o.usd), role: "in" },
        feesUsd: cost > 0 ? cost : null,
      };
    }
    case "close": {
      const reason = str(o.reason);
      const kind: LogKind = reason.startsWith("Take profit:")
        ? "take_profit"
        : reason.startsWith("Stop loss:")
          ? "stop_loss"
          : "closed";
      const why =
        kind === "take_profit"
          ? afterPrefix(reason, "Take profit:")
          : kind === "stop_loss"
            ? afterPrefix(reason, "Stop loss:")
            : reason || t("clplog_closed_reason");
      const fees = num(o.feesUsd) + profitFee;
      return {
        ...base,
        kind,
        detail: t("clplog_closed", { reason: why, size: money(num(o.filledUsd)) }),
        amount: { usd: netPnl, role: "pnl" },
        feesUsd: fees > 0 ? fees : null,
      };
    }
    case "rerange":
      return { ...base, kind: "reranged", detail: t("clplog_reranged", { limit }) };
    case "resize": {
      const added = num(o.addedUsd);
      const returned = num(o.returnedUsd);
      if (added > 0) {
        return {
          ...base,
          kind: "added",
          detail: t("clplog_added", { size: money(added), limit }),
          amount: { usd: added, role: "in" },
          feesUsd: num(o.costUsd) > 0 ? num(o.costUsd) : null,
        };
      }
      if (returned > 0) {
        const fees = num(o.costUsd) + profitFee;
        return {
          ...base,
          kind: "reduced",
          detail: t("clplog_reduced", { size: money(returned) }),
          amount: { usd: netPnl, role: "pnl" },
          feesUsd: fees > 0 ? fees : null,
        };
      }
      return null;
    }
    default:
      return null;
  }
}
