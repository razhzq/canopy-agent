import type { enNotifs } from "../en/notifications";

export const zhNotifs: Record<keyof typeof enNotifs, string> = {
  nc_aria: "通知",
  nc_aria_unread: "通知，{count} 条未读",
  nc_fill_bought: "买入",
  nc_fill_sold: "卖出",
  nc_fill_added: "添加流动性",
  nc_fill_removed: "移除流动性",
  nc_fill_paper: "模拟",
  nc_fill_realised: "已实现",
  nc_tab_all: "全部",
  nc_tab_approvals: "待处理",
  nc_tab_trades: "成交",
  nc_empty_waiting: "没有需要您处理的事项。",
  nc_empty_trades: "暂无成交。",
  nc_mark_all_failed: "未能清除 — 重试",
  nc_mark_all: "全部标为已读",
  nc_marking_all: "正在清除…",
  nc_title: "通知",
  nc_empty:
    "暂无内容。您的智能体在成交时、有事需要您处理时、以及触发限额时都会在这里汇报 — 这里安静，说明它们看过之后没有发现值得做的事。",
  nc_empty_page:
    "暂无内容。您的智能体在成交时、有事需要您处理时、以及触发限额时都会在这里汇报 — 这里安静，说明它们看过之后没有发现值得做的事。",
  nc_empty_filter: "该筛选条件下没有内容。",
  nc_unread: "{count} 条未读",
  nc_undeliverable: "无法送达您的 Telegram — 因此这条消息显示在这里。",

  nc_filter_all: "全部",
  nc_filter_needs: "待处理",
  nc_filter_trades: "成交",
  nc_filter_risk: "风控",

  nc_applied: "已应用 — 从下一个周期起它会遵循新规则。",
  nc_dismissed: "保持原样。",
  nc_decline: "拒绝",
  nc_apply: "应用",
  nc_applying: "应用中…",
  nc_why: "为什么？",
  nc_session_expired: "您的登录状态已过期 — 请重新登录后再试",

  nc_tg_offer: "在 Telegram 上接收这些通知",
  nc_tg_connect: "连接",
  nc_tg_busy: "…",
  nc_tg_reconnect: "重新连接",
  nc_tg_reconnect_title:
    "签发一条新的连接链接。在新链接确认之前，当前聊天仍然可用。",

  nc_kind_fill: "成交",
  nc_kind_proposal: "待处理",
  nc_kind_breach: "触发限额",
  nc_kind_risk_hold: "风控暂停",
  nc_kind_state_change: "状态",
  nc_kind_cycle: "周期",
  nc_kind_unknown: "更新",

  chat_title: "与 {name} 对话",
  chat_your_agent: "您的智能体",
  chat_agent_fallback: "您的智能体",
  chat_subtitle: "它提方案 · 由您决定",
  chat_waiting_count: "{count} 项待处理",
  chat_close_aria: "关闭对话",
  chat_button_aria: "与您的智能体对话",
  chat_button_close: "关闭对话",
  chat_button_aria_waiting: "与您的智能体对话 — {count} 条待您处理",
};

import type { enThread } from "../en/notifications";

export const zhThread: Record<keyof typeof enThread, string> = {
  th_sign_in: "请重新登录。",
  th_answering: "回复中",
  th_latest: "最新",
  th_message_aria: "给这个智能体发消息",
  th_placeholder: "问它点什么，或者告诉它要改什么…",
  th_chars_left: "还可以输入 {count} 个字符",
  th_enter_hint: "Enter 发送 · Shift+Enter 换行",
  th_send_aria: "发送",

  th_stage_reading: "正在阅读您的消息",
  th_stage_drafting: "正在起草修改方案",
  th_stage_searching: "正在查阅它的记录",

  th_applied: "已应用",
  th_declined: "已拒绝",
  th_settled: "已了结",
  th_read_cycle: "查阅了第 {cycles} 周期",
  th_read_cycles: "查阅了周期 {cycles}",
  th_settled_suffix: " · 已了结",
  th_see_cycle: "查看该周期 →",
  th_mark_handled: "标记为已处理",
  th_takes_effect: "从下一个周期起生效。还是同一个智能体，持仓不变。",
  th_leave_it: "保持不变",
  th_apply: "应用",
  th_applying: "应用中…",
};
