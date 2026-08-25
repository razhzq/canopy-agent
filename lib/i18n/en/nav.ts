// The top bar, the account menu, and the invite-code section inside it.

export const enNav = {
  // ── Top bar ────────────────────────────────────────────────────
  nav_my_agents: "My agents",
  nav_explore: "Explore",
  nav_activity: "Activity",
  nav_create_agent: "Create agent",
  nav_home_aria: "Canopy — home",
  nav_primary_aria: "Primary",
  nav_sign_in: "Sign in",

  // ── Bottom tab bar (below lg) ──────────────────────────────────
  tabs_sections_aria: "Sections",
  tabs_home: "Home",
  tabs_activity: "Activity",
  tabs_alerts: "Alerts",
  tabs_profile: "Profile",

  // ── Account menu ───────────────────────────────────────────────
  account_menu_aria: "Account",
  account_aria: "Account: {name}",
  account_fallback: "Account",
  account_signed_in_via: "Signed in · {method}",
  account_method_email: "Email",
  account_method_wallet: "Wallet",
  account_set_username: "+ Set a username",
  account_address_copied: "Address copied to clipboard",
  account_wallet_canopy: "Canopy wallet",
  account_your_wallet: "Your wallet",
  account_your_wallets: "Your wallets",
  account_copy_wallet_aria: "Copy {label} address {address}",
  // Two forms rather than a `{count} wallet(s)` fragment: the singular drops
  // "each", and English and Chinese break the sentence in different places.
  account_agent_wallets_one: "1 agent wallet — on its own agent's page.",
  account_agent_wallets_many:
    "{count} agent wallets — each on its own agent's page.",
  account_balance: "Balance",
  account_balance_failed: "Couldn't load",
  account_deposit: "Deposit",
  account_withdraw: "Withdraw",
  account_no_details: "No linked account details.",
  account_group_account: "Account",
  account_group_settings: "Settings",
  account_row_portfolio: "Portfolio",
  // Suffix is load-bearing: a bare figure beside "Portfolio" reads as what the
  // portfolio is worth, which is a different number.
  account_row_deployed: "{amount} deployed",
  account_row_my_agents: "My agents",
  account_row_settings: "Plan & notifications",
  account_sign_out: "Sign out",

  // ── Invite code ────────────────────────────────────────────────
  invite_your_code: "Your invite code",
  invite_remaining: "{remaining} of {max} left",
  invite_copy_code_aria: "Copy your invite code {code}",
  invite_copy_link: "Copy invite link",
  invite_copy_link_aria: "Copy your invite link",
  invite_note_disabled: "This code has been disabled.",
  invite_note_exhausted: "You've used every invite on this code.",
  invite_note_gated: "Share it with someone you want inside the closed access.",
  invite_note_open:
    "Access is open right now, so this isn't needed to get in — it just records who you brought.",
  invite_joined_one: "1 person has joined on it.",
  invite_joined_many: "{count} people have joined on it.",
  invite_joined_one_named: "1 person has joined on it — {names}.",
  invite_joined_many_named: "{count} people have joined on it — {names}.",
} as const;
