"use client";

// Reports sign-ins to analytics. Renders nothing.
//
// `isNewUser` is Privy's: new to the PRIVY APP, which canopy-fe shares (see
// lib/privy.ts). A DEX user opening the agent stack for the first time is a
// `login` here, not a `sign_up`. That is the honest reading of "new Canopy
// account"; how many people a campaign admitted to the agent stack is the
// code's redemption count in canopy-be, which is the number to quote.

import { useLogin } from "@privy-io/react-auth";
import { setUser, track } from "@/lib/analytics";
import { readReferral } from "@/lib/referral";

export function AuthEvents() {
  useLogin({
    onComplete: ({ user, isNewUser, wasAlreadyAuthenticated, loginMethod }) => {
      // The pseudonymous DID, on every load — a returning visitor is the same
      // person to GA whether or not they signed in this time.
      setUser(user.id);
      // Already signed in on arrival is a page load, not a sign-in.
      if (wasAlreadyAuthenticated) return;
      track(isNewUser ? "sign_up" : "login", {
        method: loginMethod ?? undefined,
        // Read before the session call clears it. Present only while held.
        ref_code: readReferral() ?? undefined,
      });
    },
  });

  return null;
}
