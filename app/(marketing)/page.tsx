"use client";

// The landing page — a live agent window over watching-now telemetry.
//
// Ported from canopy-fe-mono (feat/canopy-landing-variants), where it was the
// "terminal" of two candidate directions; the editorial variant was dropped
// once this one was chosen.
//
// SERVED AT `/`, WHICH USED TO REDIRECT TO /agents.
//
// So a signed-in visitor now lands here rather than in the app. That is
// deliberate — it is the public front door — and "Launch app" carries them
// straight through: the handler below reads the Privy session and skips the
// login prompt for anyone who already has one.

import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { CanopyNav } from "@/components/canopyLanding/CanopyNav";
import { CanopyTicker } from "@/components/canopyLanding/CanopyTicker";
import { HeroTerminal } from "@/components/canopyLanding/HeroTerminal";
import { CanopyBody } from "@/components/canopyLanding/CanopyBody";
import { DEFAULT_ROUTE } from "@/components/routeMemory";
import "@/components/canopyLanding/landing.css";

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
    <main className="cnp dark">
      <div className="grid-tex" />
      <CanopyNav onLogin={handleLogin} />
      {/* Directly under the nav rather than under the hero, where it used to
          sit as the first block of CanopyBody. */}
      <CanopyTicker />
      <HeroTerminal onLogin={handleLogin} />
      <CanopyBody onLogin={handleLogin} />
    </main>
  );
}
