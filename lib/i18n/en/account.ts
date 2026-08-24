// The invite gate and the username modal — the two dialogs that stand between
// a Privy session and the product.

export const enAccount = {
  // ── Invite gate ────────────────────────────────────────────────
  gate_eyebrow: "Closed access",
  gate_unreachable_title: "Cannot confirm access",
  gate_unreachable_body:
    "We could not reach Canopy to check your access. This is not a decision about your account — the check simply did not complete.",
  gate_locked_title: "You need an invite code",
  gate_locked_body:
    "Canopy Agent is in closed access. Your account is signed in — it just is not on the list yet. Enter the code you were sent to open the stack.",
  gate_code_label: "Invite code",
  // The placeholder shows the SHAPE of a code, which is the same in every
  // language — the prefix is a literal the backend issues.
  gate_code_placeholder: "CANOPY-XXXX-XXXX",
  gate_checking: "Checking…",
  gate_unlock: "Unlock access",
  gate_sign_out: "Sign out",
  gate_session_expired: "Your session expired. Sign in again.",
  gate_code_rejected: "That code did not unlock access.",

  // ── Username ───────────────────────────────────────────────────
  username_title: "Choose a username",
  username_body:
    "It replaces your email everywhere in Canopy, and it is how other people will find you.",
  username_placeholder: "yourname",
  username_available: "@{name} is available.",
  username_checking: "Checking…",
  username_min_length: "At least 3 characters.",
  username_charset: "Letters, numbers and underscores.",
  username_taken: "That name is taken.",
  username_later: "Later",
  username_claim: "Claim",
  username_saving: "Saving…",
  username_note: "Usernames are unique across Canopy and shared with the exchange.",
} as const;
