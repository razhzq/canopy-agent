// Page banners and browser-tab titles for the top-level routes.
//
// `page_title_*` are <title> strings and end in "· Canopy" — the brand is a
// name, so it stays in Latin script in both languages.

export const enPages = {
  // The document title every route inherits unless it sets its own.
  page_title_root: "Canopy Agent Stack",
  page_desc_root:
    "Deploy a strategy as your own agent. You keep custody. You set every limit.",

  page_title_settings: "Settings · Canopy",
  page_title_wallet_audit: "Wallet audit · Canopy",
  page_title_activity: "Activity · Canopy",
  page_title_portfolio: "Portfolio · Canopy",
  page_title_notifications: "Notifications · Canopy",
  page_title_agents: "Agents · Canopy",
  page_title_workspace: "My agents · Canopy",

  // ── Section eyebrows ───────────────────────────────────────────
  page_eyebrow_portfolio: "Portfolio",
  page_eyebrow_account: "Account",

  // ── Settings ───────────────────────────────────────────────────
  settings_title: "Settings",
  settings_body: "What your plan allows, and how Canopy reaches you about your agents.",

  // ── Activity ───────────────────────────────────────────────────
  activity_page_title: "Activity",
  activity_page_body:
    "Every cycle your agents have run — including the ones where they looked and did nothing.",

  // ── My agents ──────────────────────────────────────────────────
  workspace_page_title: "My agents",
  workspace_page_body:
    "Everything you have deployed — what it holds, how it is doing, and which one wants you.",

  // ── Notifications ──────────────────────────────────────────────
  notifications_page_title: "Notifications",
  notifications_page_body: "What your agents did, and what they need from you.",
} as const;
