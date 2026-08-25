import type { enWorkspace } from "../en/workspace";

export const zhWorkspace: Record<keyof typeof enWorkspace, string> = {
  my_empty_title: "还没有智能体",
  my_empty_body:
    "创建一个，它会先在实时行情上以模拟盘运行 — 免费、不限时长，也不需要注资。",
  my_empty_action: "创建智能体",

  my_band_paper_capital: "模拟盘资金",
  my_band_capital_deployed: "已部署资金",
  my_band_across_one: "统计自 1 个智能体",
  my_band_across_many: "统计自 {count} 个智能体",
  my_band_pnl: "盈亏 · 自部署以来",
  my_band_no_readings: "暂无数据",
  my_band_live: "实盘",
  my_band_paper: "模拟盘",
  my_band_needs_you: "待您处理",
  my_band_unanswered: "尚未回复",
  my_band_nothing_waiting: "没有待处理事项",

  my_stopped_itself:
    "{name} 自行停止了 — {when}，{reason}。请检查限额或恢复运行。",
  my_review: "查看",

  reason_max_drawdown: "它触发了回撤上限",
  reason_wallet_revoked: "它的钱包授权已被撤销",
  reason_wallet_expired: "它的钱包授权已过期",
  reason_mandate_expired: "它的授权已到期",
  reason_insufficient_funds: "它的资金已耗尽",
  reason_model_balance_exhausted: "它的模型额度已用尽",

  my_col_agent: "智能体",
  my_col_wallet: "钱包",
  my_col_status: "状态",
  my_col_capital: "资金",
  my_col_return: "收益率",
  my_col_last_ran: "上次运行",
  my_row_paper_suffix: " · 模拟盘",
  my_row_copied: "已复制",
  my_row_unfunded: "未注资",
  my_retry: "重试",
  my_retry_title: "权益数据未能加载。该智能体自己的页面上有这个数字。",
  my_no_data: "暂无数据",
  my_no_data_title: "还没有任何周期记录过权益数据。",
  my_resume: "恢复运行",
  my_pause: "暂停",
  my_busy: "…",
  my_edit_limits: "修改限额",
  my_detail: "详情",
  my_footnote:
    "智能体的规则由您掌控 — 止盈、止损、可交易的标的，全都可以改 — 修改会直接应用到正在运行的智能体，从下一个周期开始生效。这些都在智能体的对话里完成，也就是“修改限额”指向的地方。",

  agent_status_active: "运行中",
  agent_status_paused: "已暂停",
  agent_status_liquidating: "清仓中",
  agent_status_stopped: "已停止",
  agent_status_draft: "草稿",
};
