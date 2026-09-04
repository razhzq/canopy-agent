"use client";

// The landing page.
//
// Built to DESIGN_PRINCIPLES.md, section by section, in components/landing.
// The reference it was distilled from is docs/design-ref-public-agents.md.
//
// SERVED AT `/`, WHICH USED TO REDIRECT TO /agents.
//
// A signed-in visitor lands here rather than in the app. That is deliberate —
// it is the public front door — and every login button carries them straight
// through: the handler reads the Privy session and skips the prompt for
// anyone who already has one.

import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
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
import { DEFAULT_ROUTE } from "@/components/routeMemory";
import "@/components/landing/landing.css";

export default function Landing() {
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();

  const handleLogin = () => {
    // Privy has to have booted before `authenticated` means anything; acting on
    // it early sends a signed-in visitor to a login prompt.
    if (!ready) return;
    if (authenticated) {
      router.push(DEFAULT_ROUTE);
      return;
    }
    login();
  };

  return (
    <>
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
    </>
  );
}
