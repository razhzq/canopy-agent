"use client";

// Loads gtag.js and reports client-side navigations. See lib/analytics.ts.
//
// Renders nothing at all when NEXT_PUBLIC_GA_ID is unset — no script tag, no
// request to Google — so a build without the id is indistinguishable from one
// that never had analytics.
//
// The LANDING page view is not sent here. ReferralCapture sends it, because it
// is the only code that has seen the URL before `?ref=` was stripped from it.
// This component sends one per route change after that.

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { GA_ID, initAnalytics, pageView } from "@/lib/analytics";

export function Analytics() {
  const pathname = usePathname();
  // The path last reported, not a first-render flag: Strict Mode runs this
  // effect twice on mount, and a flag would let the second run through as a
  // duplicate of the landing hit.
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!GA_ID) return;
    initAnalytics();
    // The first path is skipped: the landing hit belongs to ReferralCapture.
    const seen = last.current;
    last.current = pathname;
    if (seen === null || seen === pathname) return;
    pageView(window.location.href);
  }, [pathname]);

  if (!GA_ID) return null;

  // Only the library. Configuration is queued by lib/analytics on the first
  // call, so it is ahead of every event whatever order things mount in.
  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
      strategy="afterInteractive"
    />
  );
}
