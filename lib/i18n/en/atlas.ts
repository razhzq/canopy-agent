// Atlas: crypto funds benchmarked against a Canopy LP strategy's on-chain record.
//
// Deliberately few words. The page is a dashboard; labels name figures and
// nothing explains them in prose. Product identifiers (Canopy LP, Meteora,
// SOL/USDC) are never translated.

export const enAtlas = {
  atlas_title: "Atlas",
  atlas_filter_aria: "Firm type",
  atlas_period_aria: "Period",
  atlas_type_all: "All",
  atlas_type_hedge: "Hedge",
  atlas_type_venture: "Venture",
  atlas_type_pe: "PE",
  atlas_period_12m: "12M",
  atlas_period_24m: "24M",

  atlas_kpi_canopy: "Canopy LP",
  atlas_kpi_median: "Fund median",
  atlas_kpi_ahead: "Canopy ahead of",
  atlas_kpi_aum: "Reported AUM",
  atlas_kpi_firms: "Firms",

  atlas_chart_title: "Change",
  atlas_chart_meta: "% · funds: AUM · Canopy: net return",
  atlas_chart_empty: "No firm in this view reports a change for this period.",
  atlas_days_live: "{days}d live",

  atlas_lp_title: "Canopy LP",
  atlas_lp_live: "Live",
  atlas_lp_since: "since {date}",
  atlas_lp_in_sol: "{pct} in SOL",
  atlas_lp_pnl: "P&L",
  atlas_lp_opened: "Positions opened",
  atlas_lp_pools: "{n} pools",
  atlas_lp_value: "Value",
  atlas_lp_fees: "Fees earned",
  atlas_lp_positions: "Open positions",
  atlas_lp_days: "Days",
  atlas_lp_wallet: "Wallet",
  atlas_lp_error: "The on-chain record did not load.",
  atlas_lp_retry: "Retry",

  atlas_table_title: "Firms",
  atlas_search: "Search",
  atlas_col_firm: "Firm",
  atlas_col_type: "Type",
  atlas_col_hq: "HQ",
  atlas_col_aum: "AUM",
  atlas_col_vs: "vs Canopy",
  atlas_onchain: "On-chain",
  atlas_no_match: "No firm matches.",
  atlas_page_count: "{from}–{to} of {total}",
  atlas_prev: "Previous page",
  atlas_next: "Next page",

  atlas_by_type: "AUM by type",
  atlas_founded: "Founded",
  atlas_source: "Crypto Fund Research, {edition} · Canopy on Solana",
} as const;
