import type { enPages } from "../en/pages";

export const zhPages: Record<keyof typeof enPages, string> = {
  page_title_root: "Canopy 智能体平台",
  page_desc_root: "把一套策略部署成您自己的智能体。资产始终由您托管，每一条限额由您设定。",

  page_title_settings: "设置 · Canopy",
  page_title_wallet_audit: "钱包审计 · Canopy",
  page_title_activity: "动态 · Canopy",
  page_title_portfolio: "投资组合 · Canopy",
  page_title_notifications: "通知 · Canopy",
  page_title_agents: "智能体 · Canopy",
  page_title_workspace: "我的智能体 · Canopy",

  page_eyebrow_portfolio: "投资组合",
  page_eyebrow_account: "账户",

  settings_title: "设置",
  settings_body: "您的智能体，以及 Canopy 如何联系您。",

  activity_page_title: "动态",
  activity_page_body: "您的智能体运行过的每一个周期 — 包括那些看过之后什么都没做的周期。",

  workspace_page_title: "我的智能体",
  workspace_page_body: "您已部署的全部智能体 — 各自持有什么、表现如何、哪一个正在等您处理。",

  notifications_page_title: "通知",
  notifications_page_body: "您的智能体做了什么，以及它们需要您做什么。",
};
