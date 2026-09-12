"use client";

// Asking a new account for its username. Required.
//
// WHEN. After the invite gate has opened for a signed-in identity whose
// profile has been read and has no username. Not before the profile is read:
// prompting against an unread profile flashes the question at people who
// answered it months ago. Not over the gate: two dialogs asking two different
// things is the worst first screen a product can have.
//
// UNTIL IT IS ANSWERED. There is no "later": the name goes on every agent
// and its public record, and an account without one is not finished. The
// dialog cannot be dismissed; it closes when the claim succeeds, and the
// username cache it writes is what keeps it closed.

import { usePrivy } from "@privy-io/react-auth";

import { UsernameModal } from "@/components/usernameModal";
import { useUsername } from "@/lib/useUsername";

export function UsernamePrompt() {
  const { ready, authenticated } = usePrivy();
  const { username, loaded } = useUsername();
  if (!ready || !authenticated || !loaded || username !== null) return null;
  return <UsernameModal required />;
}
