import type { enHome } from "../en/home";

export const zhHome: Record<keyof typeof enHome, string> = {
  home_balance_window_one: "24 小时 · 共 1 个智能体",
  home_balance_window_many: "24 小时 · 共 {count} 个智能体",
  home_top_performers: "表现最佳",
  home_chip_all: "全部",
  home_chip_top: "收益最高",
  home_chip_new: "最新",
  home_chip_held: "部署最多",
  home_empty_title: "还没有已上架的策略",
  home_empty_body:
    "已上架并拥有实盘记录的策略会显示在这里。创建一个，它会先在实时行情上以模拟盘运行。",
  home_empty_action: "创建智能体",
  home_row_deployed: "{count} 次部署",
  home_row_deployed_win: "{count} 次部署 · 胜率 {pct}%",
  home_badge_paper: "模拟",

  capability_asked_shipped: "您曾提出 {example}。该功能已经上线，现在可以使用了。",
  capability_asked_existing: "您曾提出 {example}。其实智能体本来就支持这项功能。",
  capability_set_up_under: "可在 {key} 中设置。",
  capability_dismiss: "忽略",

  model_badge_title: "由 {label} 推理 — Canopy 自托管的 Qwen3",
};
