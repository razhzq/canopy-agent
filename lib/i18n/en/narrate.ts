// The cycle narrator — what the council's decision rows say in prose.
//
// This is the audit trail read aloud, so the rules from lib/narrate apply to
// the translations too: every line restates ONE field the tick recorded, and
// nothing here interprets or softens it. A Chinese line that hedges where the
// English states plainly is a different audit trail.
//
// WHAT STAYS IN ENGLISH, AND WHY.
//
// Some values interpolated into these lines are authored by the backend, not
// here: a hard flag's `detail`, a model's `rationale`, an execution `error`,
// each screening step's `detail`. They arrive as finished English sentences
// over the wire, and there is nothing on this side that could translate them
// without inventing content. The frame around them is translated; the quoted
// value is passed through verbatim.
//
// `{fees}` and `{dedupe}` are pre-rendered clauses, empty when they do not
// apply — which is why the sentence-ending punctuation lives INSIDE each
// template rather than being appended: Chinese ends a sentence with 。and
// English with a full stop, and neither can be bolted on afterwards.

export const enNarrate = {
  // ── Seats ──────────────────────────────────────────────────────
  seat_desk: "The Desk",
  seat_analyst: "The Analyst",
  seat_risk: "The Risk Officer",
  seat_trader: "The Trader",
  seat_pm: "The Portfolio Manager",

  seat_short_desk: "Desk",
  seat_short_analyst: "Analyst",
  seat_short_risk: "Risk",
  seat_short_trader: "Trader",
  seat_short_pm: "PM",

  seat_purpose_desk: "Opens the cycle and checks the agent is fit to run",
  seat_purpose_analyst: "Screens the universe, then reasons over what survived",
  seat_purpose_risk: "The gate — sizes or refuses every plan",
  seat_purpose_trader: "Executes what the gate approved",
  seat_purpose_pm: "Marks the book and decides what to close",

  // ── Sources ────────────────────────────────────────────────────
  // "Wintel" is a company and stays as it is; the other three are descriptions.
  source_wintel: "Wintel",
  source_onchain: "On-chain",
  source_policy: "Policy",
  source_paper: "Paper",

  // ── Outcome marks (the tick, cross and ring in the gutter) ─────
  outcome_passed: "passed",
  outcome_stopped: "stopped",
  outcome_step: "step",
  outcome_note: "note",

  // ── Shared count fragments ─────────────────────────────────────
  narrate_open_none: "nothing open",
  narrate_open_one: "1 position open",
  narrate_open_many: "{count} positions open",
  narrate_positions_one: "1 position",
  narrate_positions_many: "{count} positions",

  // ── The Desk ───────────────────────────────────────────────────
  narrate_desk_not_active: "Did not run — the agent is {status}.",
  narrate_desk_expired: "Did not run — the mandate reached its time limit.",
  narrate_desk_drawdown: "{reason} Closing every position it can price.",
  narrate_desk_drawdown_reason: "Drawdown breach.",
  narrate_desk_book: "Equity {equity} · {cash} uninvested · {open}{realised}",
  narrate_desk_realised: " · {amount} realised to date",
  narrate_desk_unmarked_one:
    "{symbols} could not be priced, so the book above is marked without it.",
  narrate_desk_unmarked_many:
    "{symbols} could not be priced, so the book above is marked without them.",

  // ── The drawdown breaker, on every cycle ───────────────────────
  narrate_breaker_at_hwm: "At its high-water mark of {hwm}.",
  narrate_breaker_off: "{pct} off its {hwm} high-water mark.",
  narrate_breaker_off_limit:
    "{pct} off its {hwm} high-water mark — inside the {limit} drawdown breaker.",

  // ── The Analyst ────────────────────────────────────────────────
  narrate_analyst_market_closed: "Every market this mandate can touch is shut.",
  narrate_analyst_no_budget: "No model budget left this cycle — nothing reasoned.",
  narrate_analyst_survived_one: "1 candidate survived screening.",
  narrate_analyst_survived_many: "{count} candidates survived screening.",
  narrate_analyst_none_survived: "Nothing survived screening this cycle.",
  narrate_analyst_held_one: "1 held asset would still be bought today.",
  narrate_analyst_held_many: "{count} held assets would still be bought today.",
  narrate_analyst_model_error:
    "Could not reach the model, so nothing was proposed this cycle — {error}",
  narrate_analyst_proposed_nothing: "Reviewed the candidates and proposed nothing.",
  narrate_analyst_proposal: "Proposed — {rationale}",
  narrate_analyst_proposal_size: "Proposed {size} — {rationale}",
  narrate_analyst_proposal_confidence: "Proposed at {confidence}% confidence — {rationale}",
  narrate_analyst_proposal_size_confidence:
    "Proposed {size} at {confidence}% confidence — {rationale}",
  narrate_no_rationale: "no rationale given",
  // What the reasoning prompt could not hold. The engine had to choose, and
  // the line names the control that would have let the author choose instead.
  narrate_analyst_windowed_one:
    "Reasoned over {shown} of {total} candidates — 1 did not fit this cycle's window. Set a ranking on the strategy to decide which ones it weighs.",
  narrate_analyst_windowed_many:
    "Reasoned over {shown} of {total} candidates — {cut} did not fit this cycle's window. Set a ranking on the strategy to decide which ones it weighs.",

  // ── The Risk Officer ───────────────────────────────────────────
  narrate_risk_exit_approved: "Exit approved — {reasoning}",
  narrate_risk_rejected: "Rejected.",
  narrate_risk_rejected_why: "Rejected — {flags}.",
  narrate_risk_add_rejected: "Add rejected.",
  narrate_risk_add_rejected_why: "Add rejected — {flags}.",
  // Built from a stem plus up to three appositive clauses, each of which is a
  // complete aside in both languages and carries its own punctuation.
  narrate_risk_approved: "Approved {size}",
  narrate_risk_add_approved: "Add approved {size}",
  narrate_risk_sized_down: " — sized down from the {requested} asked",
  narrate_risk_stop: ". Stop {stop}",
  narrate_risk_take_profit: " / take profit {tp}",
  narrate_risk_end: ".",
  narrate_risk_cleared: "Cleared {checks}.",
  narrate_risk_policy_screen: "the {profile} policy screen",
  narrate_risk_safety_screen: "the safety screen",
  narrate_risk_and: " and ",

  // ── The Trader ─────────────────────────────────────────────────
  narrate_trader_exit_parked:
    "Exit parked for your approval — the position is still open.",
  narrate_trader_close_failed: "Could not close — {error}",
  narrate_trader_closed: "Closed at {price} — {pnl} realised{fees}{dedupe}.",
  narrate_trader_parked_plan_one: "1 plan parked for your approval. Nothing executed.",
  narrate_trader_parked_plan_many: "{count} plans parked for your approval. Nothing executed.",
  narrate_trader_parked_add_one: "1 add parked for your approval. Nothing executed.",
  narrate_trader_parked_add_many: "{count} adds parked for your approval. Nothing executed.",
  narrate_trader_exec_failed: "Execution failed — {error}",
  narrate_trader_add_failed: "Add failed — {error}",
  narrate_trader_filled: "Filled {size} at {price}{fees}{dedupe}.",
  narrate_trader_paper_filled: "Paper filled {size} at {price}{fees}{dedupe}.",
  narrate_trader_add_filled: "Add filled {size} at {price}{fees}{dedupe}.",
  narrate_trader_paper_add_filled: "Paper add filled {size} at {price}{fees}{dedupe}.",
  narrate_fee_clause: ", {fees} in fees",
  narrate_dedupe_closed: " (already closed — deduped)",
  narrate_dedupe_filled: " (already filled — deduped)",

  // ── The Portfolio Manager ──────────────────────────────────────
  narrate_pm_winding_down: "Winding down — closing {positions}.",
  narrate_pm_winding_down_unmarked:
    "Winding down — closing {positions}. {count} had no readable price and will be retried.",
  narrate_pm_add_budget_spent:
    "An add was due, but the cycle's trade budget was already spent. It comes round again next cycle.",
  narrate_pm_nothing_due: "Accumulation plan checked — nothing due this cycle.",
  narrate_pm_add_due: "Add due — {size}",
  narrate_pm_add_due_reason: "Add due — {size}, {reason}",
  narrate_pm_suppressed_one: "1 add held back — an exit closed that asset this cycle.",
  narrate_pm_suppressed_many:
    "{count} adds held back — an exit closed those assets this cycle.",
  narrate_pm_marked:
    "Marked the book: {value} value against {cost} cost, {unrealised} unrealised.",
  narrate_pm_exits_one: "1 exit triggered — closing it this cycle.",
  narrate_pm_exits_many: "{count} exits triggered — closing them this cycle.",

  // ── The cycle itself ───────────────────────────────────────────
  narrate_cycle_failed: "Cycle failed — {error}",
} as const;
