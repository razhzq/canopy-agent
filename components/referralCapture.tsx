"use client";

// Lifts `?ref=` out of the URL on first paint, everywhere.
//
// Mounted in the ROOT layout rather than `(app)`, because a referral link is
// marketing: it lands on the public page, not behind the sign-in. Putting it in
// `(app)/layout.tsx` would mean a link that only worked for people who were
// already signed in — which is exactly the population that does not need one.
//
// Also sends analytics' landing page view — see lib/analytics.ts for why that
// has to happen here and nowhere later.
//
// Renders nothing. It exists because `captureReferral` touches `window` and the
// layouts are server components; this is the smallest possible client boundary
// that lets it run.

import { useEffect } from "react";
import { captureReferral, isValidCodeShape } from "@/lib/referral";
import { landingLocation, pageView, setUserProperties, track } from "@/lib/analytics";

// Module scope, not a ref: Strict Mode mounts twice, and the landing is one
// page view however many times React decides to run the effect.
let landed = false;

export function ReferralCapture() {
  useEffect(() => {
    // Read BEFORE captureReferral, which strips `?ref=` from the address bar.
    // This is the only moment the URL the visitor arrived on still exists.
    const arrivedAt = window.location.href;
    const raw = new URL(arrivedAt).searchParams.get("ref")?.trim().toUpperCase() ?? null;
    const ref = raw && isValidCodeShape(raw) ? raw : null;

    // Once per mount. The code is parked in localStorage and read later by the
    // session call — nothing here needs to re-run on navigation, because a
    // client-side route change cannot introduce a `?ref=` that was not in the
    // URL the browser originally loaded.
    captureReferral();

    if (landed) return;
    landed = true;

    // The landing page view, with the ref translated into campaign parameters
    // so GA attributes the visit. Every later page view is sent by Analytics.
    pageView(landingLocation(arrivedAt, ref));
    if (ref) {
      track("campaign_landing", { ref_code: ref });
      setUserProperties({ ref_code: ref });
    }
  }, []);

  return null;
}
