// The cycle narrator — what the council's decision rows say in prose.
//
// This is the audit trail read aloud, so the rule from lib/narrate still
// applies to the translations: every line restates ONE field the tick
// recorded, and nothing here INVENTS a fact that is not in the row. What
// changed is who is talking.
//
// EACH SEAT SPEAKS AS ITSELF, IN THE FIRST PERSON.
//
// The activity log used to read like a table dumped to prose — "Rejected —
// {flags}.", "Filled {size} at {price}." — third person, clipped, the same
// register whether the desk woke up fine or an agent just breached its
// drawdown limit. That is not what a trading desk sounds like, and it is not
// what the rest of this product sounds like either: the chat surface already
// answers in the first person ("I do not have a configuration for..."), and a
// log that refers to the same agent as "it" two screens over is a second
// voice for one product.
//
// So "The Desk" says "I woke up with...", "The Risk Officer" says "I
// rejected this...", and so on. The seat label above each line is the speaker
// tag in a transcript — like a name before a line of dialogue — so "I" always
// resolves to whichever seat is attributed, never to the agent as a whole.
//
// STILL NOTHING INVENTED. Personality here means voice — pronoun, contraction,
// a human cadence — not new claims. Every number, symbol and reason in the
// lines below is exactly the field it replaced; only how it is SAID changed.
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
  narrate_desk_not_active: "I didn't run this cycle — I'm {status}.",
  narrate_desk_expired: "I didn't run — my mandate has reached its time limit.",
  narrate_desk_drawdown: "{reason} I'm closing every position I can get a price for.",
  narrate_desk_drawdown_reason: "I've breached my drawdown limit.",
  narrate_desk_book: "I'm carrying {equity} in equity — {cash} of it in cash — with {open}{realised}.",
  narrate_desk_realised: ", plus {amount} realised so far",
  narrate_desk_unmarked_one:
    "I couldn't get a price for {symbols}, so the numbers above don't include it.",
  narrate_desk_unmarked_many:
    "I couldn't get a price for {symbols}, so the numbers above don't include them.",

  // ── The drawdown breaker, on every cycle ───────────────────────
  narrate_breaker_at_hwm: "I'm sitting right at my high-water mark of {hwm}.",
  narrate_breaker_off: "I'm {pct} off my high-water mark of {hwm}.",
  narrate_breaker_off_limit:
    "I'm {pct} off my high-water mark of {hwm} — still inside my {limit} drawdown limit.",

  // ── The Analyst ────────────────────────────────────────────────
  narrate_analyst_market_closed: "Every market I'm allowed to trade is closed right now.",
  narrate_analyst_no_budget: "I'm out of model budget this cycle, so I didn't reason about anything.",
  narrate_analyst_model_balance_empty:
    "My model balance is empty, so I didn't run this cycle. Top it up and I'll pick back up.",
  narrate_analyst_model_unavailable:
    "I couldn't buy time with my model at the price we agreed, so I didn't run.",
  narrate_analyst_model_unfunded:
    "I'm waiting on my model balance to be funded — I'll start on my own the moment it is.",
  narrate_analyst_survived_one: "1 candidate made it through my screen.",
  narrate_analyst_survived_many: "{count} candidates made it through my screen.",
  narrate_analyst_none_survived: "Nothing made it through my screen this cycle.",
  narrate_analyst_held_one: "1 thing I already hold, I'd still buy today.",
  narrate_analyst_held_many: "{count} things I already hold, I'd still buy today.",
  narrate_analyst_model_error:
    "I couldn't reach my model, so I didn't propose anything this cycle — {error}",
  narrate_analyst_proposed_nothing: "I reviewed the candidates and didn't propose anything.",
  narrate_analyst_proposal: "I'm proposing this — {rationale}",
  narrate_analyst_proposal_size: "I'm proposing {size} — {rationale}",
  narrate_analyst_proposal_confidence: "I'm proposing this at {confidence}% confidence — {rationale}",
  narrate_analyst_proposal_size_confidence:
    "I'm proposing {size} at {confidence}% confidence — {rationale}",
  narrate_no_rationale: "no reason given",
  // What the reasoning prompt could not hold. The engine had to choose, and
  // the line names the control that would have let the author choose instead.
  narrate_analyst_windowed_one:
    "I reasoned over {shown} of {total} candidates — 1 didn't fit in this cycle's window. Set a ranking on the strategy to tell me which ones to weigh.",
  narrate_analyst_windowed_many:
    "I reasoned over {shown} of {total} candidates — {cut} didn't fit in this cycle's window. Set a ranking on the strategy to tell me which ones to weigh.",

  // ── The Risk Officer ───────────────────────────────────────────
  narrate_risk_exit_approved: "I approved this exit — {reasoning}",
  narrate_risk_rejected: "I rejected this.",
  narrate_risk_rejected_why: "I rejected this — {flags}.",
  narrate_risk_add_rejected: "I rejected this add.",
  narrate_risk_add_rejected_why: "I rejected this add — {flags}.",
  // Built from a stem plus up to three appositive clauses, each of which is a
  // complete aside in both languages and carries its own punctuation.
  narrate_risk_approved: "I approved {size}",
  narrate_risk_add_approved: "I approved an add of {size}",
  narrate_risk_sized_down: " — I sized it down from the {requested} asked",
  narrate_risk_stop: ". Stop at {stop}",
  narrate_risk_take_profit: " / take profit at {tp}",
  narrate_risk_end: ".",
  narrate_risk_cleared: "It also cleared {checks}.",
  narrate_risk_policy_screen: "the {profile} policy screen",
  narrate_risk_safety_screen: "the safety screen",
  narrate_risk_and: " and ",

  // ── The Trader ─────────────────────────────────────────────────
  narrate_trader_exit_parked:
    "I've parked this exit for your approval — the position is still open.",
  narrate_trader_close_failed: "I couldn't close this — {error}",
  narrate_trader_closed: "I closed it at {price} — {pnl} realised{fees}{dedupe}.",
  narrate_trader_parked_plan_one: "I've parked 1 plan for your approval — nothing executed yet.",
  narrate_trader_parked_plan_many:
    "I've parked {count} plans for your approval — nothing executed yet.",
  narrate_trader_parked_add_one: "I've parked 1 add for your approval — nothing executed yet.",
  narrate_trader_parked_add_many:
    "I've parked {count} adds for your approval — nothing executed yet.",
  narrate_trader_exec_failed: "My execution failed — {error}",
  narrate_trader_add_failed: "My add failed — {error}",
  narrate_trader_filled: "I filled {size} at {price}{fees}{dedupe}.",
  narrate_trader_paper_filled: "I filled {size} on paper at {price}{fees}{dedupe}.",
  narrate_trader_add_filled: "I added {size} at {price}{fees}{dedupe}.",
  narrate_trader_paper_add_filled: "I added {size} on paper at {price}{fees}{dedupe}.",
  narrate_fee_clause: ", {fees} in fees",
  narrate_dedupe_closed: " (I'd already closed this one, so nothing new happened)",
  narrate_dedupe_filled: " (I'd already filled this one, so nothing new happened)",

  // ── The Portfolio Manager ──────────────────────────────────────
  narrate_pm_winding_down: "I'm winding down — closing {positions}.",
  narrate_pm_winding_down_unmarked:
    "I'm winding down — closing {positions}. {count} had no readable price, so I'll retry them.",
  narrate_pm_add_budget_spent:
    "An add was due, but I'd already spent this cycle's trade budget. I'll pick it up again next cycle.",
  narrate_pm_nothing_due: "I checked the accumulation plan — nothing due this cycle.",
  narrate_pm_add_due: "An add of {size} is due",
  narrate_pm_add_due_reason: "An add of {size} is due — {reason}",
  narrate_pm_suppressed_one: "I held back 1 add — an exit closed that asset this cycle.",
  narrate_pm_suppressed_many:
    "I held back {count} adds — an exit closed those assets this cycle.",
  narrate_pm_marked:
    "I marked the book: {value} in value against {cost} in cost, {unrealised} unrealised.",
  narrate_pm_exits_one: "1 exit triggered — I'm closing it this cycle.",
  narrate_pm_exits_many: "{count} exits triggered — I'm closing them this cycle.",

  // ── The cycle itself ───────────────────────────────────────────
  narrate_cycle_failed: "My cycle failed — {error}",
} as const;
