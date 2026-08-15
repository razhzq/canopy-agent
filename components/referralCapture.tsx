"use client";

// Lifts `?ref=` out of the URL on first paint, everywhere.
//
// Mounted in the ROOT layout rather than `(app)`, because a referral link is
// marketing: it lands on the public page, not behind the sign-in. Putting it in
// `(app)/layout.tsx` would mean a link that only worked for people who were
// already signed in — which is exactly the population that does not need one.
//
// Renders nothing. It exists because `captureReferral` touches `window` and the
// layouts are server components; this is the smallest possible client boundary
// that lets it run.

import { useEffect } from "react";
import { captureReferral } from "@/lib/referral";

export function ReferralCapture() {
  useEffect(() => {
    // Once per mount. The code is parked in localStorage and read later by the
    // session call — nothing here needs to re-run on navigation, because a
    // client-side route change cannot introduce a `?ref=` that was not in the
    // URL the browser originally loaded.
    captureReferral();
  }, []);

  return null;
}
