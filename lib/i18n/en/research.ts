// /research — the execution footprint study. Public, no sign-in.
//
// `{amount}`, `{saved}` and other placeholders are rendered in mono by the
// page (every number is mono; the words around it are not), so keep each
// figure a placeholder rather than writing it into the sentence.

export const enResearch = {
  rs_page_title: "Canopy — Execution footprint",
  rs_page_desc:
    "How a fund can buy $500k of a Solana token without moving the price or showing its hand.",
  rs_nav_chip: "Execution research",

  // ── Hero ───────────────────────────────────────────────────────
  rs_hero_eyebrow: "Buying {amount} of JUP on Solana",
  rs_hero_h1: "Same order.",
  rs_hero_h2: "Different footprint.",
  rs_cmp_label: "Compare Canopy with",
  rs_cmp_big: "One big trade",
  rs_cmp_diy: "Split it yourself",
  rs_view_label: "View",
  rs_view_market: "Market's view",
  rs_view_analyst: "Analyst's view",
  rs_view_mm: "Market maker's view",
  rs_play: "Play",
  rs_playing: "Playing",
  rs_replay: "Replay",
  rs_note_market:
    "What other traders see: nobody is labelled. The big trade and the row of $25k trades still stand out. Canopy's trades sit inside the crowd.",
  rs_note_analyst:
    "What a chain analyst sees when grouping trades by wallet. Normal execution is one wallet doing everything. Canopy looks like 15 separate small traders, each with its own size and rhythm.",
  rs_note_mm:
    "What the firm running one market maker pool sees from its own trades, per wallet. One wallet sending all the flow crosses its limit fast and gets flagged; 15 small wallets stay under it. The 60% share and $40k limit are assumptions.",

  // ── Lanes ──────────────────────────────────────────────────────
  rs_lane_big: "One big trade",
  rs_lane_big_sub: "All $500k in a single swap, from one wallet",
  rs_lane_diy: "Split it yourself",
  rs_lane_diy_sub: "20 × $25k, one every ~2 minutes, from one wallet",
  rs_lane_canopy: "Canopy",
  rs_lane_canopy_sub: "Trades sized like everyone else's, ≤10% of volume, across 15 wallets",
  rs_status_waiting: "Waiting",
  rs_status_noticed: "Noticed ×{n}",
  rs_status_blending: "Blending in",
  rs_status_flagged: "Flagged by market maker",
  rs_status_retail: "Looks like retail",
  rs_stat_bought: "Bought",
  rs_stat_cost: "Extra cost",
  rs_stat_noticed: "Noticed",
  rs_stat_of_trades: "of {n} trades",
  rs_stat_of_one: "of 1 trade",
  rs_stat_wallets: "Wallets",
  rs_stat_fund_owned: "fund-owned",
  rs_stat_time: "Time",
  rs_stat_elapsed: "elapsed",
  rs_unit_min: "{n} min",
  rs_unit_h: "{n} h",
  rs_axis_price: "Price paid vs. fair price",
  rs_axis_trades: "Every trade, by size",
  rs_mm_panel: "Market maker sees, per wallet",
  rs_canvas_label: "{name}: price paid and trade sizes over time",

  rs_verdict_big:
    "On this {order} order, Canopy cost about {saved} less than one big trade, and no trade stood out. The trade-off is time: about {hours} hours instead of a few seconds.",
  rs_verdict_diy:
    "On this {order} order, Canopy cost about {saved} less than splitting it yourself, and no trade stood out. The trade-off is time: about {hours} hours instead of {minutes} minutes.",
  rs_verdict_playing: "Playing.",

  rs_legend_other: "Other traders, real JUP size mix",
  rs_legend_naive: "Fund, normal execution",
  rs_legend_canopy: "Fund, Canopy",
  rs_legend_noticed: "Big enough to get noticed",
  rs_legend_p99: "99% of JUP trades are smaller",

  // ── Wallet pool ────────────────────────────────────────────────
  rs_pool_eyebrow: "Wallet pool",
  rs_pool_h1: "Fifteen wallets, one order.",
  rs_pool_h2: "The market sees small traders.",
  rs_pool_lede:
    "The Wallet Pool Manager picks which of the fund's own wallets sends each trade. Press Play to watch it assign them.",
  rs_flow_custodian: "Fund's custodian",
  rs_flow_custodian_sub: "Holds every key",
  rs_flow_manager: "Wallet Pool Manager",
  rs_flow_manager_sub: "Canopy backend, not on-chain",
  rs_flow_wallets: "15 wallets",
  rs_flow_wallets_sub: "Ordinary Solana accounts",
  rs_flow_jupiter: "Jupiter",
  rs_flow_jupiter_sub: "Best price per trade",
  rs_flow_market: "Solana market",
  rs_flow_market_sub: "Sees 15 small traders",
  rs_wallet_name: "Wallet {n}",
  rs_wallet_trades: "{n} trades",
  rs_wallet_trade_one: "1 trade",
  rs_job_assign: "Assign",
  rs_job_assign_body:
    "Picks a wallet for every trade. Each wallet keeps its own trade size and rhythm, so no two look alike.",
  rs_job_fund: "Fund early",
  rs_job_fund_body:
    "Tops wallets up ahead of time, in varied amounts, from the fund's own accounts. Never through mixers.",
  rs_job_fees: "Pay own fees",
  rs_job_fees_body:
    "Each wallet pays its own transaction fees. One shared fee payer would link every wallet instantly.",
  rs_job_rotate: "Rotate",
  rs_job_rotate_body:
    "Retires wallets after a set volume and brings in fresh ones, so no wallet builds a readable history.",
  rs_job_links: "Check for links",
  rs_job_links_body:
    "Runs the wallet-linking methods analysts use against the fund's own pool, and flags it when it looks too connected.",
  rs_job_record: "Keep the record",
  rs_job_record_body:
    "Every wallet and trade is recorded for the fund's compliance team, custodian and auditors.",
  rs_pool_note_title: "Not a Solana program.",
  rs_pool_note:
    "If every wallet called the same Canopy program, anyone could list them all in one query. The manager runs in Canopy's backend, and on-chain the wallets only receive funds and trade through Jupiter. Wallets can still be linked through how they were funded, so the aim is to delay detection, not to be invisible.",

  // ── Where trades happen ────────────────────────────────────────
  rs_venue_eyebrow: "Where trades happen",
  rs_venue_h1: "Two groups can see your trades.",
  rs_venue_h2: "Everyone on the blockchain, and the firm that filled your order.",
  rs_venue_lede:
    "Jupiter splits each trade across different places to trade. Some are open pools anyone can watch. Others are run by one trading firm that sees exactly which wallet is buying. Canopy keeps the fund's buying small and spread out in both.",
  rs_venue_public: "Public pool",
  rs_venue_public_body:
    "Raydium, Orca, Meteora. Anyone can add money to the pool. After a big buy, the price takes a while to come back.",
  rs_venue_mm: "Market maker pool",
  rs_venue_mm_body:
    "HumidiFi, SolFi, Tessera V. Run by one trading firm that updates the price all the time. It sees every trade and which wallet sent it.",
  rs_venue_mm_fig: "{volume} a day from a {pool} pool",
  rs_venue_mm_fig_sub: "One JUP pool, refilled by its owner all day long",
  rs_venue_book: "Order book",
  rs_venue_book_body:
    "Phoenix, Manifest. Buyers and sellers post their prices, like a stock exchange. Prices come back as people post new orders.",
  rs_venue_rfq: "Private quote",
  rs_venue_rfq_body:
    "Market makers on Jupiter Ultra. One firm offers one price for one trade, away from the public pools. Only that firm sees the order.",
  rs_venue_note_title: "Not proven yet.",
  rs_venue_note:
    "We think market maker pools may give worse prices to a wallet once they notice it buying a lot. We will check this by watching how the price moves in the seconds after each of our trades.",
} as const;
