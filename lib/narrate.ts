// Turning council decision rows into prose, in whichever language the reader
// picked.
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
import { tokenPrice } from "./format";
import type { TranslationKey } from "./i18n/en";
import type { Translate } from "./i18n/translate";

/*
 * WHY `t` IS AN ARGUMENT AND NOT A HOOK.
 *
 * This file is a pure function over decision rows, called from the activity
 * log, the cycle transcript and the mobile agent sheet. Reaching for `useT()`
 * here would make the narrator a React concern and stop it being callable from
 * anywhere that is not a component. Every entry point takes the translator
 * instead, and the callers — all of which are already components — hand theirs
 * down.
 *
 * WHAT STAYS IN ENGLISH.
 *
 * A hard flag's `detail`, a proposal's `rationale`, an execution `error` and
 * each screening step's `detail` are authored by the backend and arrive as
 * finished sentences. They are quoted into the translated frame verbatim,
 * because the alternative is inventing content for an audit trail.
 */

export interface NarratedLine {
  outcome: "pass" | "drop" | "info" | "work";
  detail: string;
  symbol?: string;
  source?: string;
  /**
   * A supporting note rather than a decision — the agent showing its work.
   *
   * Set on the per-ticker screening steps: the rug-check note ("verified tier
   * has a known issuer…") and the indicator readout ("120 bars · RSI 32…"),
   * whose outcome is `info`. Their sibling pass/drop step is the actual verdict
   * and is never marked.
   *
   * This changes nothing about the record. The activity log — a narrative
   * replay — folds these behind an expander so a screen of forty steps does not
   * bury the three decisions that came out of it. The cycle transcript, which
   * is forensics, ignores the flag and shows every line. Progressive disclosure,
   * not omission: the note is one caret away, and still in the raw JSON beneath.
   */
  secondary?: boolean;
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

/**
 * Adapter ids are internal; these are what they mean to an owner.
 *
 * Keys rather than words, because the map is module-level and the words are
 * per-reader. `sourceLabel` below resolves one.
 */
export const SOURCE_LABEL_KEY: Record<string, TranslationKey> = {
  "wintel.rwa": "source_wintel",
  "canopy.onchain": "source_onchain",
  "canopy.compliance": "source_policy",
  "canopy.paper": "source_paper",
};

/** An adapter id in the reader's language, or the raw id if we have no name. */
export function sourceLabel(id: string, t: Translate): string {
  const key = SOURCE_LABEL_KEY[id];
  return key ? t(key) : id;
}

export const SEAT_LABEL_KEY: Record<string, TranslationKey> = {
  desk: "seat_desk",
  analyst: "seat_analyst",
  risk: "seat_risk",
  trader: "seat_trader",
  pm: "seat_pm",
};

/**
 * The same seats, short enough for a gutter.
 *
 * "The Portfolio Manager" is the right name in a section header and four times
 * too wide beside a line of prose, where the seat is an index rather than a
 * title. Both forms name the same thing, so they stay in one file.
 */
export const SEAT_SHORT_KEY: Record<string, TranslationKey> = {
  desk: "seat_short_desk",
  analyst: "seat_short_analyst",
  risk: "seat_short_risk",
  trader: "seat_short_trader",
  pm: "seat_short_pm",
};

/** What each seat is for, in one line. */
export const SEAT_PURPOSE_KEY: Record<string, TranslationKey> = {
  desk: "seat_purpose_desk",
  analyst: "seat_purpose_analyst",
  risk: "seat_purpose_risk",
  trader: "seat_purpose_trader",
  pm: "seat_purpose_pm",
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
export function narrateDecision(d: NarratableDecision, t: Translate): NarratedLine[] {
  const lines: NarratedLine[] = [];
  const o = d.output ?? {};

  if (d.role === "desk") {
    if (o.skipped === "not_active") {
      lines.push({
        outcome: "drop",
        detail: t("narrate_desk_not_active", { status: str(o.status) }),
      });
    } else if (o.skipped === "expired") {
      lines.push({ outcome: "drop", detail: t("narrate_desk_expired") });
    } else if (o.skipped === "drawdown_breach") {
      lines.push({
        outcome: "drop",
        // `reason` is the backend's own sentence when it wrote one.
        detail: t("narrate_desk_drawdown", {
          reason: str(o.reason) || t("narrate_desk_drawdown_reason"),
        }),
      });
    } else if (o.opened) {
      const open = num(o.openPositions);
      const realized = num(o.realizedPnlUsd);
      lines.push({
        outcome: "work",
        detail: t("narrate_desk_book", {
          equity: money(o.equityUsd),
          cash: money(o.cashUsd),
          open:
            open === 0
              ? t("narrate_open_none")
              : open === 1
                ? t("narrate_open_one")
                : t("narrate_open_many", { count: open }),
          // Only once something has closed. "+$0 realised to date" on a book
          // that has never sold anything is a fact about nothing.
          realised:
            realized !== 0 ? t("narrate_desk_realised", { amount: signed(realized) }) : "",
        }),
      });
      lines.push(breakerLine(o, t));

      // An unpriceable position is a real exposure the agent is carrying blind,
      // and this line never once fired: `unmarked` is a list of symbols, and the
      // old guard ran `num()` over it — Number(["PAXG"]) is NaN, which the
      // helper floors to 0, so the condition was permanently false.
      const unmarked = strings(o.unmarked);
      if (unmarked.length > 0) {
        lines.push({
          outcome: "info",
          detail: t(
            unmarked.length === 1 ? "narrate_desk_unmarked_one" : "narrate_desk_unmarked_many",
            { symbols: unmarked.join("、") },
          ),
        });
      }
    }
    return lines;
  }

  if (d.role === "analyst") {
    if (o.skipped === "market_closed") {
      lines.push({ outcome: "drop", detail: t("narrate_analyst_market_closed") });
      return lines;
    }
    if (o.skipped === "budget_exhausted") {
      lines.push({ outcome: "drop", detail: t("narrate_analyst_no_budget") });
      return lines;
    }

    if (o.stage === "screen") {
      for (const s of steps(o.steps)) {
        lines.push({
          outcome: s.outcome,
          detail: s.detail,
          symbol: s.symbol,
          // `s.detail` above is the backend's own sentence and passes through
          // untouched; only the attribution beside it is ours to name.
          source: s.sourceId ? sourceLabel(s.sourceId, t) : undefined,
          // The info steps are the agent showing its work — the rug-check note
          // and the indicator readout. The pass/drop step for the same ticker is
          // the verdict. Marking the former is what lets the log fold the noise
          // without ever folding a decision.
          secondary: s.outcome === "info",
        });
      }
      const found = Array.isArray(o.candidates) ? o.candidates.length : 0;
      lines.push({
        outcome: found > 0 ? "pass" : "info",
        detail:
          found === 0
            ? t("narrate_analyst_none_survived")
            : found === 1
              ? t("narrate_analyst_survived_one")
              : t("narrate_analyst_survived_many", { count: found }),
      });

      // Held assets the screen re-tested — the answer to "would you still buy
      // this today", which is what an accumulation plan's `rules` trigger acts
      // on. Counted rather than named: the set holds mints, and a base58
      // address in a sentence is worse than no sentence.
      const held = strings(o.heldStillQualifying).length;
      if (held > 0) {
        lines.push({
          outcome: "info",
          detail:
            held === 1
              ? t("narrate_analyst_held_one")
              : t("narrate_analyst_held_many", { count: held }),
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
          detail: t("narrate_analyst_model_error", { error: str(o.modelError) }),
        });
        return lines;
      }

      // No "asked the model to choose" preamble. It reported the mechanism, not
      // the outcome, and read identically on every cycle that got this far —
      // the proposals below are the thing that happened.
      if (props.length === 0) {
        lines.push({ outcome: "info", detail: t("narrate_analyst_proposed_nothing") });
      }
      for (const p of props as Record<string, unknown>[]) {
        const size = num(p.sizeUsdRequested);
        const confidence = p.confidence === undefined ? null : num(p.confidence);
        // Four whole sentences rather than a stem with two optional clauses:
        // the size and the confidence sit in different places in the two
        // languages, and there is no ordering of fragments that is a sentence
        // in both. `rationale` is the model's own words and is not translated.
        const rationale = str(p.rationale) || t("narrate_no_rationale");
        lines.push({
          outcome: "pass",
          symbol: str(p.symbol),
          detail:
            size > 0 && confidence !== null
              ? t("narrate_analyst_proposal_size_confidence", {
                  size: money(size),
                  confidence: Math.round(confidence),
                  rationale,
                })
              : size > 0
                ? t("narrate_analyst_proposal_size", { size: money(size), rationale })
                : confidence !== null
                  ? t("narrate_analyst_proposal_confidence", {
                      confidence: Math.round(confidence),
                      rationale,
                    })
                  : t("narrate_analyst_proposal", { rationale }),
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
      .join("、")
      // A flag's `detail` is authored as a sentence and usually ends in a full
      // stop, so appending our own gave "…below the $500k floor.."
      .replace(/\.$/, "");

    if (o.exit === true) {
      // An exit passes the gate as a witness, never as a gatekeeper — a stop
      // a compliance flag could veto is not a stop.
      lines.push({
        outcome: "work",
        symbol: str(o.symbol),
        // `reasoning` is the gate's own sentence, trimmed of a trailing note
        // the record appends. Passed through as written.
        detail: t("narrate_risk_exit_approved", {
          reasoning: str(o.reasoning).split(" Closes are recorded")[0],
        }),
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
        detail: flagText
          ? t(add ? "narrate_risk_add_rejected_why" : "narrate_risk_rejected_why", {
              flags: flagText,
            })
          : t(add ? "narrate_risk_add_rejected" : "narrate_risk_rejected"),
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
    // A stem plus up to three appositives. Each clause is a complete aside in
    // both languages and carries its own punctuation, so the assembly holds —
    // unlike a sentence built from bare nouns and verbs, which does not.
    lines.push({
      outcome: "pass",
      symbol: str(o.symbol),
      detail:
        t(add ? "narrate_risk_add_approved" : "narrate_risk_approved", {
          size: money(approvedUsd),
        }) +
        (sizedDown
          ? t("narrate_risk_sized_down", { requested: money(requestedUsd) })
          : "") +
        (o.stopLossPct ? t("narrate_risk_stop", { stop: pct(o.stopLossPct, 0) }) : "") +
        (o.takeProfitPct
          ? t("narrate_risk_take_profit", { tp: pct(o.takeProfitPct, 0) })
          : "") +
        t("narrate_risk_end"),
    });

    // Named only when a screen actually ran. runTick records `safetyScreened`
    // either way precisely so a screen that did not run is distinguishable from
    // one that ran and passed — but for a regulated RWA the safety screen is
    // off by design, so announcing its absence every cycle would be noise.
    // Saying so when it DID run carries the same information without it.
    const profile = str(o.complianceProfile);
    const cleared: string[] = [];
    if (profile && profile !== "none") {
      cleared.push(t("narrate_risk_policy_screen", { profile }));
    }
    if (o.safetyScreened === true) cleared.push(t("narrate_risk_safety_screen"));
    if (cleared.length > 0) {
      lines.push({
        outcome: "info",
        detail: t("narrate_risk_cleared", { checks: cleared.join(t("narrate_risk_and")) }),
      });
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
          detail: t("narrate_trader_exit_parked"),
        });
      } else if (o.executed === false) {
        lines.push({
          outcome: "drop",
          symbol: str(o.symbol),
          detail: t("narrate_trader_close_failed", { error: str(o.error) }),
        });
      } else {
        const pnl = num(o.realizedPnlUsd);
        lines.push({
          outcome: pnl >= 0 ? "pass" : "drop",
          symbol: str(o.symbol),
          // The optional clauses go IN as values, so the full stop stays inside
          // the template — English ends a sentence with "." and Chinese with
          // "。", and neither can be appended afterwards.
          detail: t("narrate_trader_closed", {
            price: tokenPrice(num(o.priceUsd)).display,
            pnl: signed(pnl),
            fees: feeClause(o, t),
            dedupe: o.deduped ? t("narrate_dedupe_closed") : "",
          }),
          source: venue(o.venue, t),
        });
      }
      return lines;
    }

    if (o.autonomy === "propose_only") {
      const parked = num(o.parked);
      lines.push({
        outcome: "info",
        detail: add
          ? parked === 1
            ? t("narrate_trader_parked_add_one")
            : t("narrate_trader_parked_add_many", { count: parked })
          : parked === 1
            ? t("narrate_trader_parked_plan_one")
            : t("narrate_trader_parked_plan_many", { count: parked }),
      });
    } else if (o.executed === false) {
      lines.push({
        outcome: "drop",
        symbol: str(o.symbol),
        detail: t(add ? "narrate_trader_add_failed" : "narrate_trader_exec_failed", {
          error: str(o.error),
        }),
      });
    } else if (o.filledUsd !== undefined) {
      // Four whole templates rather than one built from a verb phrase. The
      // English used to capitalise the first letter of a computed verb, which
      // is a rule about the Latin alphabet and nothing else.
      const key = o.isPaper
        ? add
          ? "narrate_trader_paper_add_filled"
          : "narrate_trader_paper_filled"
        : add
          ? "narrate_trader_add_filled"
          : "narrate_trader_filled";
      lines.push({
        outcome: "pass",
        symbol: str(o.symbol),
        detail: t(key, {
          size: money(o.filledUsd),
          price: tokenPrice(num(o.priceUsd)).display,
          fees: feeClause(o, t),
          dedupe: o.deduped ? t("narrate_dedupe_filled") : "",
        }),
        source: venue(o.venue, t),
      });
    }
    return lines;
  }

  if (d.role === "pm") {
    if (o.liquidating === true) {
      const n = Array.isArray(o.directives) ? o.directives.length : 0;
      const positions =
        n === 1 ? t("narrate_positions_one") : t("narrate_positions_many", { count: n });
      const unpriceable = strings(o.unmarked).length;
      lines.push({
        outcome: "drop",
        detail:
          unpriceable > 0
            ? t("narrate_pm_winding_down_unmarked", { positions, count: unpriceable })
            : t("narrate_pm_winding_down", { positions }),
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
          detail: t("narrate_pm_add_budget_spent"),
        });
        return lines;
      }

      const due = Array.isArray(o.due) ? (o.due as Record<string, unknown>[]) : [];
      if (due.length === 0) {
        lines.push({ outcome: "info", detail: t("narrate_pm_nothing_due") });
      }
      for (const a of due) {
        lines.push({
          outcome: "info",
          symbol: str(a.symbol),
          // `reason` is the plan's own trigger text, written server-side.
          detail: str(a.reason)
            ? t("narrate_pm_add_due_reason", {
                size: money(a.sizeUsd),
                reason: str(a.reason),
              })
            : t("narrate_pm_add_due", { size: money(a.sizeUsd) }),
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
            suppressed === 1
              ? t("narrate_pm_suppressed_one")
              : t("narrate_pm_suppressed_many", { count: suppressed }),
        });
      }
      return lines;
    }

    lines.push({
      outcome: "work",
      detail: t("narrate_pm_marked", {
        value: money(o.marketValueUsd),
        cost: money(o.costBasisUsd),
        unrealised: signed(num(o.unrealizedPnlUsd)),
      }),
    });
    const directives = Array.isArray(o.directives) ? o.directives : [];
    if (directives.length > 0) {
      // Closed NOW. The old line read "queued for the next cycle's risk gate",
      // which was wrong twice over: closeExits runs immediately after this row
      // is written, and an exit passes the gate as a witness rather than being
      // judged by it.
      lines.push({
        outcome: "info",
        detail:
          directives.length === 1
            ? t("narrate_pm_exits_one")
            : t("narrate_pm_exits_many", { count: directives.length }),
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
function breakerLine(o: Record<string, unknown>, t: Translate): NarratedLine {
  const equity = num(o.equityUsd);
  const hwm = num(o.highWaterMarkUsd);
  const off = hwm > 0 ? ((hwm - equity) / hwm) * 100 : 0;
  const limit = o.maxDrawdownPct === undefined ? null : num(o.maxDrawdownPct);

  // The high-water mark is floored at the mandate's capital, so a book that has
  // only ever gained sits exactly on it — which is the first cycle of every
  // agent, and is not a drawdown of 0.0%.
  if (off < 0.05) {
    return { outcome: "pass", detail: t("narrate_breaker_at_hwm", { hwm: money(hwm) }) };
  }
  return {
    outcome: "pass",
    detail:
      limit === null
        ? t("narrate_breaker_off", { pct: pct(off), hwm: money(hwm) })
        : t("narrate_breaker_off_limit", {
            pct: pct(off),
            hwm: money(hwm),
            limit: pct(limit, 0),
          }),
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
export function narrateCycle(
  cycle: {
    status: string;
    error?: string | null;
    decisions: (NarratableDecision & { seq?: number })[];
  },
  t: Translate,
): SeatedLine[] {
  const ordered = [...cycle.decisions].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  const lines: SeatedLine[] = ordered.flatMap((d) =>
    narrateDecision(d, t).map((line) => ({ ...line, role: d.role })),
  );
  if (cycle.status === "error" && cycle.error) {
    // `cycle.error` is the runtime's own message — quoted, never rewritten.
    lines.push({
      outcome: "drop",
      detail: t("narrate_cycle_failed", { error: cycle.error }),
      role: null,
    });
  }
  return lines;
}

/* ---------------------------------------------------------------- helpers -- */

/** Adapter id -> the name an owner recognises. */
function venue(v: unknown, t: Translate): string | undefined {
  const id = str(v);
  return id ? sourceLabel(id, t) : undefined;
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
function feeClause(o: Record<string, unknown>, t: Translate): string {
  const fees = num(o.feesUsd);
  return fees > 0 ? t("narrate_fee_clause", { fees: usd(fees, 2) }) : "";
}

function pct(v: unknown, digits = 1): string {
  return `${num(v).toFixed(digits)}%`;
}

function signed(n: number): string {
  const s = `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return n < 0 ? `−${s}` : `+${s}`;
}
