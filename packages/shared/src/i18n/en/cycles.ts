// The cycle list and the council transcript under /portfolio/[slug]/cycles.

export const enCycles = {
  cycles_empty_title: "No cycles yet",
  cycles_empty_body:
    "Every time the agent wakes up it records a cycle here — including the ones where it decided to do nothing.",
  cycles_judged: "{count} judged",
  cycles_blocked: "{count} blocked",

  // Cycle outcomes, as the badge shows them. The backend's own enum values —
  // translated for the reader, never for the record beneath.
  cycle_status_ok: "ok",
  cycle_status_skipped: "skipped",
  cycle_status_error: "error",
  cycle_status_running: "running",

  // ── Cycle list page ────────────────────────────────────────────
  cycles_page_title: "Cycles",
  cycles_page_body:
    "One row per time the agent woke up — including the cycles where it decided to do nothing, and why.",

  // ── Transcript ─────────────────────────────────────────────────
  cycles_crumb_portfolio: "Portfolio",
  cycles_crumb_agent: "Agent {id}",
  cycles_crumb_cycles: "Cycles",
  cycles_crumb_cycle: "Cycle",
  cycles_crumb_cycle_n: "Cycle #{seq}",
  cycles_trace_title: "What the agent did",
  cycles_trace_body:
    "Each seat in the order it spoke, written before the agent acted rather than reconstructed afterwards. Every line restates something that was recorded — open the record on any seat to see it verbatim.",
  cycles_record: "Record",
  cycles_hide_record: "Hide record",
  cycles_recorded_verbatim: "Recorded verbatim",
  cycles_data_from: "Data from {sources}",
} as const;
