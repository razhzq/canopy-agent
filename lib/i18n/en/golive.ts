// Paper → live: the three-step dialog and the wallet delegation inside it.
//
// The most consequential screen in the product — the last one before an agent
// spends real money — so the Chinese states the same facts with the same
// bluntness. Nothing here is softened.

export const enGoLive = {
  gl_steps_aria: "Steps to go live",
  gl_step_subscribe: "Subscribe",
  gl_step_subscribe_purpose: "Live execution is billed per agent",
  gl_step_delegate: "Delegate",
  gl_step_delegate_purpose: "Give the agent permission to sign",
  gl_step_golive: "Go live",
  gl_step_golive_purpose: "Promote the agent to real capital",

  gl_eyebrow: "{name} · paper",
  gl_title: "Switch to live",
  gl_title_done: "Trading live",

  gl_checking_title: "Checking this agent's subscription…",
  gl_checking_body: "A moment, so that the next thing you are asked for is the right one.",

  // ── Step 1: subscription ───────────────────────────────────────
  gl_waiting_title: "We haven't seen the payment yet",
  gl_waiting_body:
    "BoomFi tells us about a new subscription within a minute or so, and this dialog will not claim otherwise until it has. Nothing is lost while you wait — the agent is still trading on paper, exactly as it was.",
  gl_sub_title: "Live execution is a subscription",
  gl_sub_body:
    "Running this agent on real capital is {price}, charged for this agent alone. Paper trading stays free, and nothing about this agent changes until the subscription starts.",
  gl_sub_price_unknown: "a monthly subscription",
  gl_sub_price: "{amount}/month",
  gl_checking: "Checking…",
  gl_check_again: "Check again",
  gl_opening: "Opening…",
  gl_subscribe: "Subscribe",
  gl_not_now: "Not now",
  gl_assurance_abandoned:
    "If you closed BoomFi without paying, close this and press Live again to start over. Nothing has been charged.",
  gl_assurance_checkout:
    "You'll pay on BoomFi and come straight back to this agent, where this dialog picks up at the delegation step. It keeps trading on paper in the meantime.",

  // ── Step 2: delegation ─────────────────────────────────────────
  gl_grant_title: "Give this agent permission to sign",
  gl_grant_body:
    "The grant happens in your own wallet, not on Canopy's servers — which is why the wallet stays yours. It is scoped to swaps only, reaches no further than what you deposit in this wallet, and you can revoke it at any time without asking us.",
  gl_grant_assurance:
    "Granting is not a transfer. Nothing leaves your wallet until the agent executes a trade inside this scope.",

  // ── Step 3: promotion ──────────────────────────────────────────
  gl_promote_title: "Promote to real capital",
  gl_promote_body:
    "This agent keeps its rules, its history and everything it learned on paper.",
  gl_promote_body_open_one:
    "This agent keeps its rules, its history and everything it learned on paper — but its 1 open paper position will be settled at real marks first, so the live book starts flat.",
  gl_promote_body_open_many:
    "This agent keeps its rules, its history and everything it learned on paper — but its {count} open paper positions will be settled at real marks first, so the live book starts flat.",
  gl_row_wallet: "Wallet",
  gl_row_scope: "Scope",
  gl_scope_swaps: "Swaps only",
  gl_row_expires: "Delegation ends",
  gl_deposit_assurance:
    "You can deposit before or after this. An empty wallet does not lose anything — the agent simply waits, and says it is waiting, until USDC arrives. Deposit from the wallet bar at the top of this page.",
  gl_confirm_warning:
    "From the next tick this agent trades real money — whatever this wallet holds — and it stops trading on paper. You can pause it at any time. Its paper run is not lost — the book, the cycles and the thread stay readable from the Paper half of the switch — but the agent itself does not go back.",
  gl_settling: "Settling…",
  gl_confirm: "Yes, trade real money",
  gl_back: "Back",
  gl_go_live: "Go live",

  // ── Promoted ───────────────────────────────────────────────────
  gl_promoted_title: "{name} is trading real capital",
  gl_promoted_body:
    "From its next tick, fills are real. The paper book stays where it is and is still readable from the Paper half of the switch — the record it built did not go anywhere.",
  gl_done: "Done",

  // ── Grant delegation button ────────────────────────────────────
  gd_grant: "Grant delegation",
  gd_preparing: "Preparing this agent's wallet…",
  gd_granting: "Approve in your wallet…",
  gd_registering: "Recording…",
  gd_active: "Delegation active",
  gd_active_custodial: "Delegation active — custodial",
  gd_custodial_body:
    "This wallet is owned by Canopy, not by you. Ending the delegation requires Canopy.",
  gd_self_custody_body:
    "You own this wallet. You can end this delegation from your wallet settings at any time, without Canopy.",
  gd_misconfigured:
    "Delegation is not configured on this deployment. Run pnpm provision:privy and set the signer and policy ids.",
  gd_err_not_configured:
    "delegation is not configured — the signer and policy ids are missing",
  gd_err_session: "your session expired — sign in and try again",
  gd_err_no_wallet_id:
    "the grant completed but Privy did not return a wallet id — nothing was registered",
} as const;
