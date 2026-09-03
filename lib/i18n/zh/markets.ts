import type { enMarkets } from "../en/markets";

export const zhMarkets: Record<keyof typeof enMarkets, string> = {
  am_new: "无历史数据",
  am_new_help:
    "Jupiter 能为该代币定价并成交，但尚未解析到对应的流动性池——因此在下次扫描找到之前，指标规则无法计算。仍然可以添加。",
  mk_class_all: "全部",
  mk_class_stocks: "代币化股票",
  mk_class_commodity: "大宗商品",
  mk_class_token: "加密资产",
  mk_venue: "交易场所",
  mk_venue_all: "全部",
  mk_venue_clob: "订单簿 DEX",

  mk_step: "第 1 步，共 2 步 · 设定",
  mk_title: "选择要交易的市场",
  mk_intro:
    "可以选一个，也可以选多个。智能体每个周期都会用你的规则检查每一个，买入符合条件的标的。",
  mk_search_placeholder: "搜索市场…  /",
  mk_search_aria: "搜索市场",
  mk_count_one: "1 个市场",
  mk_count_many: "{count} 个市场",

  mk_resolving: "正在解析可交易的市场…",
  mk_signed_out: "登录后可查看哪些市场可以交易。",
  mk_load_failed: "无法加载市场 — {message}",
  mk_none_tradable: "当前没有可交易的市场。",
  mk_no_query_match: "没有与“{query}”匹配的结果。",
  mk_no_filter_match: "没有符合这些筛选条件的市场。",

  mk_col_market: "市场",
  mk_col_price: "价格",
  mk_col_24h: "24 小时",
  mk_col_depth: "池子深度",

  mk_hint_navigate: "↑↓ 移动",
  mk_hint_toggle: "⏎ 添加或移除",
  mk_hint_search: "/ 搜索",
  mk_pick_a_market: "请选择一个市场",
  mk_continue: "继续",

  am_title: "添加市场",
  am_subtitle: "{agent} · 正在筛选 {count}",
  am_search_placeholder: "搜索市场…",
  am_sign_in: "登录后才能修改该智能体。",
  am_added: "已添加",
  am_add: "添加",
  am_remove: "移除",
  am_removing: "…",
  am_add_aria: "添加 {symbol}",
  am_remove_aria: "停止交易 {symbol}",
  am_remove_title: "移除该市场。已经持有的仓位会保留。",
  am_request: "申请添加",
  am_sending: "提交中…",
  am_none_in_scope_query: "{scope}中没有与“{query}”匹配的结果。",
  am_agent_trades_none: "该智能体不交易{scope}。",
  am_none_on_venue: "这里没有在 {venue} 上撮合的标的。",
  am_scope_on_venue: "{venue} 上的{scope}",
  am_only_market_aria: "{symbol} 是该智能体唯一交易的市场，无法移除",
  am_picked: "已选中",
  am_same_rules: "{market} — 与 {agent} 使用相同的规则和限额。",
  am_hints: "↑↓ 移动 · ← → 翻页 · ⏎ 选择 · esc 关闭",

  // ── 发现模式：用筛选条件挑选市场 ────────────────────────────
  //
  // 指标名称刻意写清楚测量的到底是什么：“市值”指流通市值而非完全稀释估值，
  // “交易对存续时间”指池子的存续时间而非代币的年龄。
  dsc_title: "或者让它自己去找",
  dsc_intro:
    "不指定具体标的，而是描述你想要的代币类型。智能体每个周期都会重新筛选，买入符合条件的标的。手动选中的市场同样会交易。",
  dsc_remove: "移除筛选条件",

  dsc_group_size: "规模与深度",
  dsc_group_activity: "活跃度",
  dsc_group_age: "存续时间",
  dsc_group_quality: "排除这些",
  dsc_group_safety: "跑路风险检查",

  dsc_marketCapUsd: "市值",
  dsc_marketCapUsd_note: "按流通量计算。",
  dsc_fdvUsd: "完全稀释估值",
  dsc_liquidityUsd: "池子深度",
  dsc_liquidityUsd_note: "池子里可供交易的资金量。",
  dsc_volume24hUsd: "24 小时成交量",
  dsc_volume24hUsd_note: "来自该代币最大的那个池子。",
  dsc_volume1hUsd: "1 小时成交量",
  dsc_volumeToLiquidity: "成交量与深度之比",
  dsc_volumeToLiquidity_note: "20 万美元在 200 万的池子里很清淡，在 5 万的池子里则相当狂热。",
  dsc_pairAgeHours: "交易对存续时间",
  dsc_pairAgeHours_note: "这个代币已经交易了多久。",
  dsc_change5mPct: "5 分钟涨跌",
  dsc_change1hPct: "1 小时涨跌",
  dsc_change6hPct: "6 小时涨跌",
  dsc_change24hPct: "24 小时涨跌",
  dsc_txns24h: "24 小时成交笔数",
  dsc_buySellRatio24h: "买卖笔数比",
  dsc_buySellRatio24h_note: "大于 1 表示买盘笔数多于卖盘。",

  dsc_min: "不低于",
  dsc_max: "不高于",
  dsc_any: "不限",
  dsc_unit_hours: "小时",
  dsc_unit_days: "天",

  dsc_tier: "核实程度",
  dsc_tier_verified: "已核验",
  dsc_tier_verified_note: "Jupiter 已确认是真币，不是仿冒品。",
  dsc_tier_listed: "已收录",
  dsc_tier_listed_note: "在 CoinGecko 上有收录。",
  dsc_tier_pool: "只要能交易",
  dsc_tier_pool_note: "没有人核实过。",
  dsc_tier_live_note: "用真钱交易时，智能体只买这个等级或更高的。新币和小市值币大多低于“已核验”。",

  dsc_exclude_stablecoins: "稳定币",
  dsc_exclude_solDerivatives: "只是跟着 SOL 走的代币",
  dsc_exclude_rwaImpersonators: "冒充真实股票的代币",
  dsc_exclude_withoutPool: "没有价格历史的代币",
  dsc_exclude_withoutPool_note: "下一步的规则要读历史价格。没有价格历史，任何规则都不会触发。",
  dsc_exclude_note: "默认排除，取消勾选即可保留。",

  dsc_safety_note: "只对已经符合上面全部条件的代币做检查。",
  dsc_safety_mint: "没人能再增发",
  dsc_safety_freeze: "没人能冻结你的代币",
  dsc_safety_lp: "流动性无法被抽走",
  dsc_safety_holder: "最大持有者占比不超过",

  dsc_cap: "每周期最多看",
  dsc_cap_unit: "个代币",
  dsc_cap_note: "每个周期都要为每个代币读一次近期价格，所以这是实打实的成本。真正买入几个由下一步决定。",

  dsc_matching: "正在统计…",
  dsc_match_one: "当前有 1 个代币符合条件",
  dsc_match_many: "当前有 {count} 个代币符合条件",
  dsc_match_none: "当前没有代币符合条件",
  dsc_match_of: "全部 {swept} 个代币中",
  dsc_match_failed: "无法统计该筛选条件 — {message}",
  dsc_safety_pending: "跑路检查要等智能体运行时才做，所以它实际买入的会比这个数字少。",
  dsc_sample_show: "查看符合条件的标的",
  dsc_sample_hide: "收起",
  dsc_near_misses: "差一点符合",
  dsc_stale_note: "代币数据每小时更新一次，智能体每个周期重新筛选一遍。",

  dsc_needs_ranking: "这可能匹配到上百个代币。下一步决定智能体实际买入其中的哪几个。",

  // ── 分页 ───────────────────────────────────────────────────────
  mk_page_range: "第 {from}–{to} 条，共 {total} 条",
  mk_page_prev: "← 上一页",
  mk_page_next: "下一页 →",
  mk_hint_page: "← → 翻页",

  // ── 第一步的两个视图 ───────────────────────────────────────────
  mk_tab_pick: "手动选择",
  mk_tab_discovery: "自动发现",
};
