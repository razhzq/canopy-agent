import type { enPositions } from "../en/positions";

export const zhPositions: Record<keyof typeof enPositions, string> = {
  positions_tab_open: "持仓",
  positions_tab_open_count: "持仓 · {count}",
  positions_tab_history: "历史",

  positions_empty: "没有持仓。在入场条件满足之前，智能体会一直持币观望。",

  positions_col_asset: "标的",
  positions_col_qty: "数量",
  positions_col_cost: "成本",
  positions_at_price: "@ {price}",
  positions_col_value: "市值",
  positions_col_pnl: "盈亏",
  positions_since: "自 {date} 起",
  positions_entries_since: "{count} 笔建仓 · 自 {date} 起",
  positions_not_priced: "无法定价",
  positions_close_aria: "平掉 {symbol} 持仓",
  positions_close_title: "平掉这笔持仓",
  positions_entries: "建仓明细",

  positions_history_empty:
    "还没有任何成交。每个周期仍然记录在下方的动态日志中。",
  positions_col_side: "方向",
  positions_col_realised: "已实现",
  positions_side_buy: "买入",
  positions_side_sell: "卖出",
  positions_badge_paper: "模拟盘",
  positions_fill_cycle: "{date} · 第 {cycle} 周期",
  positions_load_more: "加载更多",
  positions_loading: "加载中…",
  positions_sign_in_more: "登录后才能加载更多。",
  positions_count_one_partial: "已加载 1 笔成交",
  positions_count_many_partial: "已加载 {count} 笔成交",
  positions_count_one_all: "共 1 笔成交 — 已全部显示",
  positions_count_many_all: "共 {count} 笔成交 — 已全部显示",
};
