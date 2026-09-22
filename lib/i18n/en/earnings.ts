// Creator earnings — what a wallet you own has earned by being copied.
//
// The reader of this screen is usually someone who has never heard of the
// feature: money was set aside for their ADDRESS, not for their account. So
// the copy leads with what happened and why they are owed anything, before it
// asks them to sign anything.

export const enEarnings = {
  ce_title: "Creator earnings",
  ce_intro:
    "When a Canopy agent copies a wallet's liquidity positions and closes one in profit, a share of that profit is set aside for the wallet it copied. If that wallet is yours, this is where you collect it.",
  ce_loading: "Loading your earnings",

  ce_empty_title: "No earnings yet",
  ce_empty_body:
    "Connect a Solana wallet to check whether anything has been set aside for it. Nothing is shared with Canopy by connecting.",

  ce_verified: "Verified",
  ce_available: "Available",
  ce_pending: "Pending",
  ce_lifetime: "Lifetime",
  ce_copiers: "Copiers",
  // Said plainly, because "available is lower than lifetime" is the first
  // question anyone will have, and the honest answer is that pending money is
  // not yet Canopy's to pay.
  ce_pending_note:
    "Available is held by Canopy and can be paid out now. Pending has been charged but is still in the copying agent's wallet, so it is not claimable until Canopy collects it.",

  ce_claim: "Request payout",
  ce_claiming: "Requesting…",
  ce_claim_min: "Payouts start at {min}.",
  ce_claim_open: "A payout of {amount} is {status}.",
  ce_status_requested: "waiting for review",
  ce_status_approved: "approved and being sent",
  ce_status_paying: "being sent",
  ce_status_paid: "paid",
  ce_status_rejected: "declined",
  ce_status_failed: "failed",

  ce_unverified: "Connected, not verified",
  ce_unverified_body:
    "Sign a short message to prove you control the wallet. It moves no funds and approves no transaction.",
  ce_verify: "Verify wallet",
  ce_verifying: "Waiting for signature…",

  ce_connect: "Another wallet",
  ce_connect_body:
    "Earnings belong to the wallet that was copied, which is usually one you hold in Phantom or Backpack rather than a Canopy wallet.",
  ce_connect_action: "Connect a wallet",

  ce_err_no_wallet: "That wallet is no longer connected. Connect it again and retry.",
  ce_err_signed_out: "Your session expired. Sign in again.",
} as const;
