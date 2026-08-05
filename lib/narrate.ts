// Turning council decision rows into English.
//
// The decision rows ARE the audit trail — one per seat per tick, written before
// the agent acted. They are also raw JSON addressed to a machine, and a page
// that prints them asks the reader to parse `{"skipped":"market_closed"}` to
// learn that the market was shut.
//
// This is the single narrator for both surfaces that show them: the activity
// log on the agent page, and the cycle transcript. One implementation on
// purpose — two would drift, and the moment they disagree the audit trail has
// two different stories about the same tick.
//
// Nothing here interprets or editorialises. Every line restates one field that
// runTick recorded; where a field is absent the line is absent. The raw JSON
// stays available underneath, because narration is a reading of the record and
// never a replacement for it.

/** How a line reads: did this help, stop something, or just report? */
export interface NarratedLine {
  outcome: "pass" | "drop" | "info" | "work";
  detail: string;
  symbol?: string;
  source?: string;
}

/** The subset of a decision row the narrator needs. */
export interface NarratableDecision {
  role: "desk" | "analyst" | "risk" | "trader" | "pm";
  output: Record<string, unknown>;
  model?: string | null;
  latency_ms?: number | null;
}

/** One step the SME recorded while screening. */
export interface ScreenStepShape {
  stage: string;
  outcome: "pass" | "drop" | "info";
  detail: string;
  symbol?: string;
  underlying?: string;
  sourceId?: string;
}

/** Adapter ids are internal; these are what they mean to an owner. */
export const SOURCE_LABEL: Record<string, string> = {
  "wintel.rwa": "Wintel",
  "canopy.onchain": "On-chain",
  "canopy.compliance": "Policy",
  "canopy.paper": "Paper",
};

export const SEAT_LABEL: Record<string, string> = {
  desk: "The Desk",
  analyst: "The Analyst",
  risk: "The Risk Officer",
  trader: "The Trader",
  pm: "The Portfolio Manager",
};

/** What each seat is for, in one line. */
export const SEAT_PURPOSE: Record<string, string> = {
  desk: "Opens the cycle and checks the agent is fit to run",
  analyst: "Screens the universe, then reasons over what survived",
  risk: "The gate — sizes or refuses every plan",
  trader: "Executes what the gate approved",
  pm: "Marks the book and decides what to close",
};

/**
 * Narrates ONE decision row.
 *
 * The `output` shapes come from runTick and differ per seat, so this reads them
 * seat by seat rather than trying to be generic. An unrecognised shape yields
 * no lines, and the caller falls back to showing the raw record — better to
 * show the JSON than to invent a sentence about it.
 */
export function narrateDecision(d: NarratableDecision): NarratedLine[] {
  const lines: NarratedLine[] = [];
  const o = d.output ?? {};

  if (d.role === "desk") {
    if (o.skipped === "not_active") {
      lines.push({ outcome: "drop", detail: `Did not run — the agent is ${str(o.status)}.` });
    } else if (o.skipped === "expired") {
      lines.push({ outcome: "drop", detail: "Did not run — the mandate reached its time limit." });
    } else if (o.skipped === "drawdown_breach") {
      lines.push({
        outcome: "drop",
        detail: `${str(o.reason) || "Drawdown breach."} Closing every position it can price.`,
      });
    } else if (o.opened) {
      lines.push({
        outcome: "work",
        detail:
          `Woke up. Book is ${money(o.equityUsd)} equity, ${money(o.cashUsd)} uninvested, ` +
          `${num(o.openPositions)} open ${num(o.openPositions) === 1 ? "position" : "positions"}.`,
      });
      if (num(o.unmarked) > 0) {
        lines.push({
          outcome: "info",
          detail: `${num(o.unmarked)} position(s) had no readable price and were left unmarked.`,
        });
      }
    }
    return lines;
  }

  if (d.role === "analyst") {
    if (o.skipped === "market_closed") {
      lines.push({ outcome: "drop", detail: "Every market this mandate can touch is shut." });
      return lines;
    }
    if (o.skipped === "budget_exhausted") {
      lines.push({ outcome: "drop", detail: "No model budget left this cycle — nothing reasoned." });
      return lines;
    }

    if (o.stage === "screen") {
      for (const s of steps(o.steps)) {
        lines.push({
          outcome: s.outcome,
          detail: s.detail,
          symbol: s.symbol,
          source: SOURCE_LABEL[s.sourceId ?? ""] ?? s.sourceId,
        });
      }
      const found = Array.isArray(o.candidates) ? o.candidates.length : 0;
      lines.push({
        outcome: found > 0 ? "pass" : "info",
        detail:
          found > 0
            ? `${found} candidate${found === 1 ? "" : "s"} survived screening.`
            : "Nothing survived screening this cycle.",
      });
      return lines;
    }

    if (o.stage === "reason") {
      const props = Array.isArray(o.proposals) ? o.proposals : [];

      // An outage reads very differently from an opinion, and conflating them
      // makes a broken agent look like a picky one.
      if (o.modelError) {
        lines.push({
          outcome: "drop",
          detail: `Could not reach the model, so nothing was proposed this cycle — ${str(
            o.modelError,
          )}`,
        });
        return lines;
      }

      lines.push({
        outcome: "work",
        detail: `Asked the model to choose${d.model ? ` (${d.model})` : ""}.`,
        source: d.latency_ms ? `${(d.latency_ms / 1000).toFixed(1)}s` : undefined,
      });
      if (props.length === 0) {
        lines.push({ outcome: "info", detail: "The model looked and proposed nothing." });
      }
      for (const p of props as Record<string, unknown>[]) {
        lines.push({
          outcome: "pass",
          symbol: str(p.symbol),
          detail: `Proposed — ${str(p.rationale) || "no rationale given"}`,
        });
      }
      return lines;
    }
    return lines;
  }

  if (d.role === "risk") {
    const flags = Array.isArray(o.hardFlags) ? o.hardFlags : [];
    if (o.exit === true) {
      // An exit passes the gate as a witness, never as a gatekeeper — a stop
      // a compliance flag could veto is not a stop.
      lines.push({
        outcome: "work",
        symbol: str(o.symbol),
        detail: `Exit approved — ${str(o.reasoning).split(" Closes are recorded")[0]}`,
      });
      return lines;
    }
    lines.push({
      outcome: o.decision === "reject" ? "drop" : "pass",
      symbol: str(o.symbol),
      detail:
        o.decision === "reject"
          ? `Risk gate rejected it${flags.length > 0 ? ` — ${flags.join(", ")}` : ""}.`
          : `Risk gate approved ${money(o.approvedSizeUsd)}` +
            (o.stopLossPct ? `, stop at ${num(o.stopLossPct)}%` : "") +
            ".",
    });
    return lines;
  }

  if (d.role === "trader") {
    if (o.exit === true) {
      if (o.parked) {
        lines.push({
          outcome: "info",
          symbol: str(o.symbol),
          detail: "Exit parked for your approval — the position is still open.",
        });
      } else if (o.executed === false) {
        lines.push({
          outcome: "drop",
          symbol: str(o.symbol),
          detail: `Could not close — ${str(o.error)}`,
        });
      } else {
        const pnl = num(o.realizedPnlUsd);
        lines.push({
          outcome: pnl >= 0 ? "pass" : "drop",
          symbol: str(o.symbol),
          detail:
            `Closed at $${num(o.priceUsd).toFixed(2)} — ` +
            `${signed(pnl)} realised${o.deduped ? " (already closed — deduped)" : ""}.`,
          source: venue(o.venue),
        });
      }
      return lines;
    }
    if (o.autonomy === "propose_only") {
      lines.push({
        outcome: "info",
        detail: `${num(o.parked)} plan(s) parked for your approval. Nothing executed.`,
      });
    } else if (o.executed === false) {
      lines.push({
        outcome: "drop",
        symbol: str(o.symbol),
        detail: `Execution failed — ${str(o.error)}`,
      });
    } else if (o.filledUsd !== undefined) {
      lines.push({
        outcome: "pass",
        symbol: str(o.symbol),
        detail:
          `${o.isPaper ? "Paper " : ""}filled ${money(o.filledUsd)} at ` +
          `$${num(o.priceUsd).toFixed(2)}${o.deduped ? " (already filled — deduped)" : ""}.`,
        source: venue(o.venue),
      });
    }
    return lines;
  }

  if (d.role === "pm") {
    if (o.liquidating === true) {
      const n = Array.isArray(o.directives) ? o.directives.length : 0;
      lines.push({
        outcome: "drop",
        detail:
          `Winding down — closing ${n} position${n === 1 ? "" : "s"}.` +
          (Array.isArray(o.unmarked) && o.unmarked.length > 0
            ? ` ${o.unmarked.length} had no readable price and will be retried.`
            : ""),
      });
      return lines;
    }
    lines.push({
      outcome: "work",
      detail:
        `Marked the book: ${money(o.marketValueUsd)} value against ${money(o.costBasisUsd)} cost, ` +
        `${signed(num(o.unrealizedPnlUsd))} unrealised.`,
    });
    const directives = Array.isArray(o.directives) ? o.directives : [];
    if (directives.length > 0) {
      lines.push({
        outcome: "info",
        detail: `${directives.length} directive(s) queued for the next cycle's risk gate.`,
      });
    }
  }

  return lines;
}

/** Narrates a whole cycle, in the order the seats spoke. */
export function narrateCycle(cycle: {
  status: string;
  error?: string | null;
  decisions: NarratableDecision[];
}): NarratedLine[] {
  const lines = cycle.decisions.flatMap((d) => narrateDecision(d));
  if (cycle.status === "error" && cycle.error) {
    lines.push({ outcome: "drop", detail: `Cycle failed — ${cycle.error}` });
  }
  return lines;
}

/* ---------------------------------------------------------------- helpers -- */

/** Adapter id -> the name an owner recognises. */
function venue(v: unknown): string | undefined {
  const id = str(v);
  return id ? (SOURCE_LABEL[id] ?? id) : undefined;
}

function steps(v: unknown): ScreenStepShape[] {
  return Array.isArray(v) ? (v as ScreenStepShape[]) : [];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v) || 0;
}

function money(v: unknown): string {
  return `$${num(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function signed(n: number): string {
  const s = `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return n < 0 ? `−${s}` : `+${s}`;
}
