"use client";

// The landing page, built to DESIGN_PRINCIPLES.md section by section in
// components/landing.
//
// Its own deployment at agent.canopy.finance. Every login and sign-up button
// opens the app (app.canopy.finance), which owns sign-in: the Privy session
// lives on the app's origin, so a login made here would not carry over.
//
// A referral link (`?ref=CODE`) can land here. The app is what records it,
// so the code rides along on the button's link rather than being stored on
// this origin, where the app could never read it.

import { useEffect, useState } from "react";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { TwoWays } from "@/components/landing/TwoWays";
import { Getting } from "@/components/landing/Getting";
import { Mind } from "@/components/landing/Mind";
import { Build } from "@/components/landing/Build";
import { Pricing } from "@/components/landing/Pricing";
import { Marketplace } from "@/components/landing/Marketplace";
import { Footer } from "@/components/landing/Footer";
import { Anywhere } from "@/components/landing/Anywhere";
import { APP_ENTRY, appHref } from "@/lib/appUrl";
import "@/components/landing/landing.css";

const REF_KEY = "canopy.landing.ref";

/** `?ref=` from this visit, or from earlier in this tab (an anchor jump or reload drops it). */
function readRef(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get("ref")?.trim().slice(0, 64) || null;
  try {
    if (fromUrl) sessionStorage.setItem(REF_KEY, fromUrl);
    return fromUrl ?? sessionStorage.getItem(REF_KEY);
  } catch {
    return fromUrl;
  }
}

export default function Landing() {
  const [ref, setRef] = useState<string | null>(null);
  useEffect(() => setRef(readRef()), []);

  const handleLogin = () => {
    window.location.assign(appHref(APP_ENTRY, ref));
  };

  return (
    <main className="lp">
      <Nav onLogin={handleLogin} />
      <Hero onLogin={handleLogin} />
      <TwoWays />
      <Getting />
      <Mind />
      <Build />
      <Marketplace />
      <Anywhere />
      <Pricing onLogin={handleLogin} />
      <Footer onLogin={handleLogin} />
    </main>
  );
}
