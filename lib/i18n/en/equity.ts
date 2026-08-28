// The performance panel on an agent's page, and the close-position dialog.

export const enEquity = {
  // ── Equity panel ───────────────────────────────────────────────
  equity_unavailable_title: "Performance unavailable",
  equity_unavailable_body:
    "The equity readings did not load. Everything else on this page is current — reload to try again.",
  equity_no_curve_title: "No curve yet",
  equity_no_curve_body:
    "The curve plots one point per completed cycle. The first appears as soon as the agent has run once.",
  equity_paper_equity: "Paper equity",
  equity_equity: "Equity",
  equity_against_capital: "{pnl} · {pct} against {capital}",
  equity_realised: "Realised",
  equity_unrealised: "Unrealised",
  equity_max_drawdown: "Max drawdown",
  equity_hit_rate: "Hit rate",
  equity_deployed: "Deployed",
  equity_cycle_n: "Cycle {seq}",
  equity_readout_head: "Cycle {seq} · {when}",
  equity_readout_pnl: "{pnl} · {pct}",
  equity_readout_cash: "{amount} cash",

  // ── Close position ─────────────────────────────────────────────
  close_title: "Close {symbol}?",
  close_subtitle: "The whole position, sold at the market now.",
  close_size: "Size",
  close_avg_cost: "Average cost",
  close_price_now: "Price now",
  close_total_value: "Total value",
  close_pnl: "P&L",
  close_not_priced: "not priced",
  close_unpriced_note:
    "This asset has no readable price right now. The sale will be refused rather than filled at a guess — try again in a few minutes.",
  close_note:
    "The agent keeps running and keeps its other positions. It may buy this back later if its entry rule is met again.",
  close_keep: "No, keep it",
  close_confirm: "Yes, close it",
  close_closing: "Closing…",
  close_sign_in: "Sign in to close this position.",
} as const;
