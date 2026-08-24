import type { enMarketplace } from "../en/marketplace";

export const zhMarketplace: Record<keyof typeof enMarketplace, string> = {
  market_title: "智能体",
  market_intro:
    "所有拥有实盘记录的策略 — 已上架的，以及仍在模拟盘的。把已上架的策略部署为您自己的智能体：资产始终由您托管，每项限额由您设定。",

  market_tab_all: "全部",
  market_tab_listed: "已上架",
  market_tab_paper: "模拟盘",
  market_sort: "排序",
  market_sort_return: "收益率",
  market_sort_newest: "最新",
  market_sort_capital: "资金规模",
  market_sort_users: "使用人数",
  market_search_placeholder: "搜索智能体…",
  market_search_aria: "搜索智能体",

  market_rail_listed: "已上架智能体",
  market_rail_listed_note: "共 {total} 个有记录",
  market_rail_paper_capital: "模拟盘资金",
  market_rail_capital_deployed: "已部署资金",
  market_rail_trades_30d: "成交 · 30 日",
  market_rail_positions_open: "持仓中",
  market_rail_over_one: "统计自 1 个已列出的智能体",
  market_rail_over_many: "统计自 {count} 个已列出的智能体",

  market_empty_title: "这里还没有内容",
  market_empty_body:
    "所有拥有实盘记录的策略都会出现在这里 — 已上架的，以及仍在模拟盘的。目前还没有任何策略开始运行。",
  market_empty_action: "创建智能体",
  market_nomatch_title: "没有匹配结果",
  market_nomatch_one: "总共 1 个智能体。清除筛选条件即可查看。",
  market_nomatch_many: "总共 {count} 个智能体。清除筛选条件即可查看。",
  market_show_all: "显示全部",

  market_badge_hot: "热门",
  market_badge_new: "新上线",
  market_badge_yours: "我的",
  market_badge_listed: "已上架",
  market_badge_delisted: "已下架",
  market_badge_paper: "模拟盘",
  market_card_class_days: "{class} · {days} 天记录",
  market_card_no_curve: "周期数量尚不足以绘制曲线",
  market_metric_return_30d: "30 日收益",
  market_metric_capital: "资金规模",
  market_metric_trades_30d: "30 日成交",
  market_metric_open_now: "当前持仓",
  market_non_custodial: "非托管",

  market_showing: "显示第 {from}–{to} 个，共 {total} 个",
  market_previous: "← 上一页",
  market_next: "下一页 →",
};
