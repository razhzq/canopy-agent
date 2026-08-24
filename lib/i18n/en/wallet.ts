// Money in and money out: the agent's wallet bar, the deposit and withdraw
// dialogs, and the funding panel.

export const enWallet = {
  // ── Wallet bar ─────────────────────────────────────────────────
  wallet_none_provisioned: "No wallet provisioned",
  wallet_copy_aria: "Copy wallet address {address}",
  wallet_balance_unknown: "balance —",
  wallet_deposit: "Deposit",
  wallet_agent_wallet: "Agent wallet",
  wallet_esc: "Esc",

  // ── Deposit ────────────────────────────────────────────────────
  deposit_title: "Deposit",
  deposit_your_wallet: "Your wallet · Solana",
  deposit_copy_aria: "Copy your address {address}",
  deposit_click_to_copy: "Click to copy",
  deposit_network_warning:
    "Solana network only. Sending any other chain's assets to this address loses them. This is your personal wallet — funding an agent is done on that agent's page.",

  // ── Withdraw ───────────────────────────────────────────────────
  withdraw_title: "Withdraw",
  withdraw_sent: "Sent",
  withdraw_sent_body: "The transfer was submitted. It settles in a few seconds.",
  withdraw_done: "Done",
  withdraw_not_sent: "Not sent",
  withdraw_not_sent_body:
    "Nothing left your wallet. Check the balance before trying again in case it did land.",
  withdraw_back: "Back",
  withdraw_to_label: "To · Solana address",
  withdraw_to_placeholder: "Paste the destination address",
  withdraw_not_an_address: "Not a Solana address.",
  withdraw_is_this_wallet: "That is this wallet.",
  withdraw_shape_only:
    "Checked for shape only — nobody can tell you whether this address is the one you meant. A transfer cannot be reversed.",
  withdraw_amount_label: "Amount · {asset}",
  withdraw_max: "Max {amount}",
  withdraw_review: "Review",
  withdraw_above_zero: "Enter an amount above zero.",
  withdraw_over_sendable_sol: "More than you can send. {reserve} SOL is held back for fees.",
  withdraw_over_balance: "More than this wallet holds.",
  withdraw_not_valid_amount: "Not a valid amount.",
  withdraw_wallet_not_connected: "that wallet is not connected in this session",

  // ── Confirm step ───────────────────────────────────────────────
  withdraw_sending: "Sending",
  withdraw_to: "To",
  withdraw_rent_warning:
    "This address holds no USDC account yet, so one is opened for it. That costs you about 0.002 SOL in rent, on top of the network fee.",
  withdraw_final:
    "Transfers are final. Once submitted there is no way to reverse this or recover the funds if the address is wrong.",
  withdraw_send: "Send",
  withdraw_sending_busy: "Sending…",

  // ── Funding panel ──────────────────────────────────────────────
  funding_no_wallet_title: "No wallet yet",
  funding_fallback_reading: "Canopy could not read this balance. Checking the network directly…",
  funding_read_failed: "Could not read this wallet's balance.",
  // Two failures, named separately: "Canopy is down" and "Canopy is down AND
  // the network would not answer either" call for different next moves.
  funding_both_failed: "{backend}. Reading the network directly also failed: {chain}",
  funding_direct_title: "Read from the network directly",
  funding_direct_body:
    "Canopy could not reach its RPC, so these figures came from your browser instead. They are real balances — but the fee threshold shown is this app's own copy, so treat a borderline reading as approximate.",
  funding_usdc_available: "available to trade",
  funding_usdc_none: "none — send USDC",
  funding_sol_covers: "covers fees",
  funding_sol_needs: "needs {min} for fees",
  funding_not_ready_title: "Not ready to trade live",
  funding_funded_title: "Funded",
  funding_funded_body: "This wallet has USDC to trade with and SOL for fees.",
  funding_deposit_address: "Deposit address · Solana",
  funding_copy_aria: "Copy deposit address {address}",
  funding_send_usdc: "Send USDC on Solana — the agent trades against it and cannot convert other assets into it.",
  funding_send_sol:
    "Send at least {min} SOL as well. Without it the wallet cannot pay transaction fees, even holding USDC.",
  funding_fees_covered: "Transaction fees are covered by Canopy — this wallet does not need SOL.",
  funding_check_balance: "Check balance",

  // ── Wallet audit (temporary diagnostic) ────────────────────────
  audit_crumb_settings: "Settings",
  audit_crumb_audit: "Wallet audit",
  audit_title: "Wallet audit",
  audit_intro:
    "Read-only. Privy cannot delete an embedded wallet, so this exists to work out which one matters rather than to remove any.",
  audit_none_title: "No agent wallets yet",
  audit_none_body:
    "No agent holds a delegation. All {count} of these are unclaimed — one is your personal login wallet, the rest are spares from the login race.",
  audit_verdict_one: "1 agent wallet · {spares} unclaimed",
  audit_verdict_many: "{count} agent wallets · {spares} unclaimed",
  audit_verdict_body:
    "An agent wallet per agent is BY DESIGN — one agent, one wallet, funded from your personal wallet. Only the unclaimed ones are candidates for noise, and one of those is your personal wallet.",
  audit_privy_heading: "Privy wallets on this account · {count}",
  audit_none_linked: "None linked.",
  audit_row_meta: "idx {index} · {chain} · {client}",
  audit_client_embedded: "embedded",
  audit_badge_agent: "agent {id}",
  audit_badge_yours: "yours · never assignable",
  audit_badge_delegated: "delegated · not registered",
  audit_badge_next: "spare · next agent takes this",
  audit_badge_unclaimed: "unclaimed",
  audit_privy_note:
    "A wallet with an agent badge is that agent's dedicated trading wallet — one agent, one wallet, and it can never be changed. Unclaimed wallets include your personal login wallet (normally index 0) and any spares the login race created.",
  audit_registered_heading: "Registered to agents · {count}",
  audit_none_registered: "No agent has registered a wallet.",
  audit_agent_label: "agent {id}",

  // ── Amount parsing (lib/transfer) ──────────────────────────────
  transfer_not_a_number: "not a number",
  transfer_max_decimals: "at most {decimals} decimal places",
  transfer_amount_above_zero: "enter an amount above zero",
} as const;
