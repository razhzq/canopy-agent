import type { enActivity } from "../en/activity";

export const zhActivity: Record<keyof typeof enActivity, string> = {
  activity_empty_title: "暂无记录",
  activity_empty_body:
    "第一个周期正在启动，一两分钟内会显示在这里 — 无论智能体是否找到可买入的标的，它都会运行。之后它每小时唤醒一次。",
  activity_checking: "每 15 秒检查一次",
  activity_signed_out_note: "登录后可查看该智能体。",

  activity_reveal_progress: "{shown} / {total}",
  activity_still_running: "仍在运行",
  activity_hide_notes: "收起筛选记录",
  activity_notes_one: "1 条筛选记录",
  activity_notes_many: "{count} 条筛选记录",

  activity_status_running: "运行中",
  activity_status_ok: "已完成",
  activity_status_error: "失败",
  activity_status_skipped: "已跳过",

  activity_headline_running: "正在运行…",
  activity_headline_failed: "周期执行失败",
  activity_headline_skipped: "已跳过",
  activity_headline_closed_and_opened: "平仓 {closed} 笔，开仓 {opened} 笔",
  activity_headline_closed_one: "平仓 1 笔",
  activity_headline_closed_many: "平仓 {count} 笔",
  activity_headline_fills_one: "成交 1 笔",
  activity_headline_fills_many: "成交 {count} 笔",
  activity_headline_approved: "{count} 项通过风控闸门",
  activity_headline_blocked: "{count} 项被风控闸门拦截",
  activity_headline_nothing: "已筛选标的池，未提出任何方案",

  feed_empty_title: "暂无记录",
  feed_empty_no_agents:
    "部署一个智能体后，它运行的每个周期都会显示在这里 — 包括那些它决定什么都不做的周期。",
  feed_empty_no_cycles:
    "您的智能体还没有完成过任何周期。它们唤醒后，第一个周期就会出现在这里。",
  feed_empty_action: "创建智能体",
  feed_filter_all: "全部",
  feed_filter_traded: "有成交",
  feed_filter_quiet: "无成交",
  feed_none_traded: "此区间内没有产生成交的周期。",
  feed_all_traded: "此区间内的每个周期都产生了成交。",
  feed_badge_paper: "模拟盘",
  feed_footer_one:
    "显示 {shown} / {total} · 来自您拥有的 1 个智能体，各取最近 {per} 个周期",
  feed_footer_many:
    "显示 {shown} / {total} · 来自您拥有的 {agents} 个智能体，各取最近 {per} 个周期",
  feed_footer_partial_one: " · 有 1 个智能体的记录未能加载",
  feed_footer_partial_many: " · 有 {count} 个智能体的记录未能加载",

  skip_market_closed: "市场休市",
  skip_no_candidates: "没有标的通过筛选",
  skip_budget_exhausted: "模型额度已用尽",
  skip_model_balance_exhausted: "模型额度已用尽",
  skip_model_unfunded: "等待入金",
  skip_model_unavailable: "模型不可用",
  skip_paused: "智能体已暂停",
  skip_expired: "授权已到期",
  skip_not_active: "智能体未处于运行状态",
};
