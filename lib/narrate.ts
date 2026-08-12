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
  role: Seat;
  output: Record<string, unknown>;
  model?: string | null;
  latency_ms?: number | null;
}

/** One seat at the council table. */
export type Seat = "desk" | "analyst" | "risk" | "trader" | "pm";

/**
 * A narrated line that still knows which seat produced it.
 *
 * `null` is for lines the cycle itself contributes rather than any seat — the
 * failure line below is the only one today. Attributing it to whichever seat
 * happened to speak last would be a small lie in the audit trail.
 */
export interface SeatedLine extends NarratedLine {
  role: Seat | null;
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

/**
 * The same seats, short enough for a gutter.
 *
 * "The Portfolio Manager" is the right name in a section header and four times
 * too wide beside a line of prose, where the seat is an index rather than a
 * title. Both forms name the same thing, so they stay in one file.
 */
export const SEAT_SHORT: Record<string, string> = {
  desk: "Desk",
  analyst: "Analyst",
  risk: "Risk",
  trader: "Trader",
  pm: "PM",
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
 *
 * TWO RULES, learned the hard way:
 *
 * A line that reads the same on every cycle is not narration, it is furniture.
 * The desk opened with "Woke up." on every row it ever wrote — restating the
 * existence of the row it was printed on, five times over in a five-cycle list.
 * If a line cannot differ between two cycles, it does not belong here.
 *
 * And a check that only speaks when it FAILS teaches the reader nothing about
 * the times it held. The drawdown breaker narrated a breach and was otherwise
 * silent, so the log could show the circuit breaker failing and never show it
 * working — which is the direction an owner is actually checking.
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
      const open = num(o.openPositions);
      const realized = num(o.realizedPnlUsd);
      lines.push({
        outcome: "work",
        detail:
          `Equity ${money(o.equityUsd)} · ${money(o.cashUsd)} uninvested · ` +
          `${open === 0 ? "nothing open" : `${plural(open, "position")} open`}` +
          // Only once something has closed. "+$0 realised to date" on a book
          // that has never sold anything is a fact about nothing.
          (realized !== 0 ? ` · ${signed(realized)} realised to date` : ""),
      });
      lines.push(breakerLine(o));

      // An unpriceable position is a real exposure the agent is carrying blind,
      // and this line never once fired: `unmarked` is a list of symbols, and the
      // old guard ran `num()` over it — Number(["PAXG"]) is NaN, which the
      // helper floors to 0, so the condition was permanently false.
      const unmarked = strings(o.unmarked);
      if (unmarked.length > 0) {
        lines.push({
          outcome: "info",
          detail:
            `${unmarked.join(", ")} could not be priced, so the book above is marked ` +
            `without ${unmarked.length === 1 ? "it" : "them"}.`,
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
            ? `${plural(found, "candidate")} survived screening.`
            : "Nothing survived screening this cycle.",
      });

      // Held assets the screen re-tested — the answer to "would you still buy
      // this today", which is what an accumulation plan's `rules` trigger acts
      // on. Counted rather than named: the set holds mints, and a base58
      // address in a sentence is worse than no sentence.
      const held = strings(o.heldStillQualifying).length;
      if (held > 0) {
        lines.push({
          outcome: "info",
          detail: `${plural(held, "held asset")} would still be bought today.`,
        });
      }
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

      // No "asked the model to choose" preamble. It reported the mechanism, not
      // the outcome, and read identically on every cycle that got this far —
      // the proposals below are the thing that happened.
      if (props.length === 0) {
        lines.push({ outcome: "info", detail: "Reviewed the candidates and proposed nothing." });
      }
      for (const p of props as Record<string, unknown>[]) {
        const size = num(p.sizeUsdRequested);
        const confidence = p.confidence === undefined ? null : num(p.confidence);
        lines.push({
          outcome: "pass",
          symbol: str(p.symbol),
          detail:
            `Proposed${size > 0 ? ` ${money(size)}` : ""}` +
            (confidence === null ? "" : ` at ${Math.round(confidence)}% confidence`) +
            ` — ${str(p.rationale) || "no rationale given"}`,
        });
      }
      return lines;
    }
    return lines;
  }

  if (d.role === "risk") {
    const flags = Array.isArray(o.hardFlags) ? o.hardFlags : [];

    // A HardFlag is `{ code, detail, raisedBy }`, not a string.
    //
    // Joining the array directly produced "Risk gate rejected it —
    // [object Object].", which is the worst possible version of this line: the
    // user learns their agent refused to buy something and is told nothing
    // about why, on a screen whose entire purpose is explaining that.
    //
    // `detail` is the field written for exactly this — the contract calls it
    // "human-readable, and it ends up in front of the user". `code` is the
    // fallback because it is still specific ("liquidity_floor" beats nothing),
    // and a plain string is tolerated because rows written before the flag
    // became an object are still in the record and must not render as blanks.
    const flagText = flags
      .map((f) => {
        if (typeof f === "string") return f;
        if (!f || typeof f !== "object") return "";
        const { detail, code } = f as { detail?: unknown; code?: unknown };
        return str(detail) || str(code);
      })
      .filter(Boolean)
      .join(", ")
      // A flag's `detail` is authored as a sentence and usually ends in a full
      // stop, so appending our own gave "…below the $500k floor.."
      .replace(/\.$/, "");

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

    // An add and a fresh entry read identically without this, so a top-up to a
    // position you already hold looked like a second position being opened.
    const add = o.add === true;

    if (o.decision === "reject") {
      lines.push({
        outcome: "drop",
        symbol: str(o.symbol),
        detail: `${add ? "Add rejected" : "Rejected"}${flagText ? ` — ${flagText}` : ""}.`,
      });
      return lines;
    }

    const approvedUsd = num(o.approvedSizeUsd);
    const requestedUsd = o.requestedSizeUsd === undefined ? null : num(o.requestedSizeUsd);
    // Sizing down is the gate's main non-binary action, and an approval
    // recorded only as its approved size cannot be told apart from one that
    // passed at full size. Half a dollar of slack because the cut is computed,
    // not quantised, and a rounding difference is not a decision.
    const sizedDown = requestedUsd !== null && requestedUsd > approvedUsd + 0.5;
    lines.push({
      outcome: "pass",
      symbol: str(o.symbol),
      detail:
        `${add ? "Add approved" : "Approved"} ${money(approvedUsd)}` +
        (sizedDown ? ` — sized down from the ${money(requestedUsd)} asked` : "") +
        (o.stopLossPct ? `. Stop ${pct(o.stopLossPct, 0)}` : "") +
        (o.takeProfitPct ? ` / take profit ${pct(o.takeProfitPct, 0)}` : "") +
        ".",
    });

    // Named only when a screen actually ran. runTick records `safetyScreened`
    // either way precisely so a screen that did not run is distinguishable from
    // one that ran and passed — but for a regulated RWA the safety screen is
    // off by design, so announcing its absence every cycle would be noise.
    // Saying so when it DID run carries the same information without it.
    const profile = str(o.complianceProfile);
    const cleared: string[] = [];
    if (profile && profile !== "none") cleared.push(`the ${profile} policy screen`);
    if (o.safetyScreened === true) cleared.push("the safety screen");
    if (cleared.length > 0) {
      lines.push({ outcome: "info", detail: `Cleared ${cleared.join(" and ")}.` });
    }
    return lines;
  }

  if (d.role === "trader") {
    const add = o.add === true;

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
            `Closed at ${usd(o.priceUsd, 2)} — ${signed(pnl)} realised` +
            feeClause(o) +
            `${o.deduped ? " (already closed — deduped)" : ""}.`,
          source: venue(o.venue),
        });
      }
      return lines;
    }

    if (o.autonomy === "propose_only") {
      lines.push({
        outcome: "info",
        detail: `${plural(num(o.parked), add ? "add" : "plan")} parked for your approval. Nothing executed.`,
      });
    } else if (o.executed === false) {
      lines.push({
        outcome: "drop",
        symbol: str(o.symbol),
        detail: `${add ? "Add" : "Execution"} failed — ${str(o.error)}`,
      });
    } else if (o.filledUsd !== undefined) {
      // "Paper filled …" or "Filled …" — the live case used to open a sentence
      // with a lowercase verb, because the capital lived in the "Paper" prefix
      // that a live fill does not have.
      const verb = add ? "add filled" : "filled";
      lines.push({
        outcome: "pass",
        symbol: str(o.symbol),
        detail:
          `${o.isPaper ? `Paper ${verb}` : `${verb[0].toUpperCase()}${verb.slice(1)}`} ` +
          `${money(o.filledUsd)} at ${usd(o.priceUsd, 2)}` +
          feeClause(o) +
          `${o.deduped ? " (already filled — deduped)" : ""}.`,
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
          `Winding down — closing ${plural(n, "position")}.` +
          (strings(o.unmarked).length > 0
            ? ` ${strings(o.unmarked).length} had no readable price and will be retried.`
            : ""),
      });
      return lines;
    }

    // The adds stage carries `plan` and `due` and no book figures at all, and
    // it used to fall straight through to the mark-the-book line below —
    // rendering "Marked the book: $0 value against $0 cost, +$0 unrealised" on
    // every cycle of every strategy with an accumulation plan. Not a crash and
    // not a blank: a false statement of the book, stated as fact.
    if (o.stage === "adds") {
      if (o.skipped === "trade_budget_exhausted") {
        lines.push({
          outcome: "info",
          symbol: str(o.symbol),
          detail:
            "An add was due, but the cycle's trade budget was already spent. " +
            "It comes round again next cycle.",
        });
        return lines;
      }

      const due = Array.isArray(o.due) ? (o.due as Record<string, unknown>[]) : [];
      if (due.length === 0) {
        lines.push({
          outcome: "info",
          detail: "Accumulation plan checked — nothing due this cycle.",
        });
      }
      for (const a of due) {
        lines.push({
          outcome: "info",
          symbol: str(a.symbol),
          detail: `Add due — ${money(a.sizeUsd)}${str(a.reason) ? `, ${str(a.reason)}` : ""}`,
        });
      }

      // Counted, not named: `suppressedByExit` holds mints.
      const suppressed = strings(o.suppressedByExit).length;
      if (suppressed > 0) {
        lines.push({
          outcome: "drop",
          // Why this rule exists belongs in the code, not in the log. The line
          // states what happened and stops.
          detail:
            `${plural(suppressed, "add")} held back — an exit closed ` +
            `${suppressed === 1 ? "that asset" : "those assets"} this cycle.`,
        });
      }
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
      // Closed NOW. The old line read "queued for the next cycle's risk gate",
      // which was wrong twice over: closeExits runs immediately after this row
      // is written, and an exit passes the gate as a witness rather than being
      // judged by it.
      lines.push({
        outcome: "info",
        detail: `${plural(directives.length, "exit")} triggered — closing ${
          directives.length === 1 ? "it" : "them"
        } this cycle.`,
      });
    }
  }

  return lines;
}

/**
 * The drawdown breaker's verdict, on every cycle rather than only on a breach.
 *
 * `maxDrawdownPct` is read defensively because rows written before it was
 * recorded are still in the log. Without it the line states the distance from
 * the high-water mark and stops — true, but weaker: 2% off reads the same
 * whether the breaker sits at 5% or at 50%.
 */
function breakerLine(o: Record<string, unknown>): NarratedLine {
  const equity = num(o.equityUsd);
  const hwm = num(o.highWaterMarkUsd);
  const off = hwm > 0 ? ((hwm - equity) / hwm) * 100 : 0;
  const limit = o.maxDrawdownPct === undefined ? null : num(o.maxDrawdownPct);

  // The high-water mark is floored at the mandate's capital, so a book that has
  // only ever gained sits exactly on it — which is the first cycle of every
  // agent, and is not a drawdown of 0.0%.
  if (off < 0.05) {
    return { outcome: "pass", detail: `At its high-water mark of ${money(hwm)}.` };
  }
  return {
    outcome: "pass",
    detail:
      `${pct(off)} off its ${money(hwm)} high-water mark` +
      (limit === null ? "." : ` — inside the ${pct(limit, 0)} drawdown breaker.`),
  };
}

/**
 * Narrates a whole cycle, in the order the seats spoke, KEEPING the attribution.
 *
 * It used to flatMap the rows into bare lines, which read correctly and left the
 * owner unable to tell who did any of it — five seats' work presented as one
 * anonymous voice. The role rides along instead, and the log groups on it.
 *
 * Sorted by `seq` rather than trusting arrival order: `seq` is the order runTick
 * actually wrote the rows, and it is what the grouping means. A payload that
 * came back re-ordered would otherwise split one seat's run in two.
 */
export function narrateCycle(cycle: {
  status: string;
  error?: string | null;
  decisions: (NarratableDecision & { seq?: number })[];
}): SeatedLine[] {
  const ordered = [...cycle.decisions].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  const lines: SeatedLine[] = ordered.flatMap((d) =>
    narrateDecision(d).map((line) => ({ ...line, role: d.role })),
  );
  if (cycle.status === "error" && cycle.error) {
    lines.push({ outcome: "drop", detail: `Cycle failed — ${cycle.error}`, role: null });
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

/** The string members of a recorded list, ignoring anything else in it. */
function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * "1 position", "3 positions".
 *
 * Every one of these used to render as "position(s)", which is a form for a
 * form field, not for a sentence someone is meant to read.
 */
function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function money(v: unknown): string {
  return `$${num(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** Money that needs its cents — a unit price, a fee. */
function usd(v: unknown, digits: number): string {
  return `$${num(v).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** Fees are money leaving the book, and were recorded on every fill and shown on none. */
function feeClause(o: Record<string, unknown>): string {
  const fees = num(o.feesUsd);
  return fees > 0 ? `, ${usd(fees, 2)} in fees` : "";
}

function pct(v: unknown, digits = 1): string {
  return `${num(v).toFixed(digits)}%`;
}

function signed(n: number): string {
  const s = `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return n < 0 ? `−${s}` : `+${s}`;
}
