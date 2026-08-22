import type { Metadata } from "next";
import { PortfolioOverview } from "@/components/portfolioOverview";

export const metadata: Metadata = {
  title: "Portfolio · Canopy",
};

/**
 * The portfolio overview.
 *
 * This route was a redirect to /workspace for as long as there was nothing here
 * that /workspace did not already do better. There is now: an aggregate equity
 * curve, where the capital sits, what the open book carries, and what settled
 * recently — portfolio questions, none of which a list of agents answers.
 *
 * /workspace keeps the operational view: what each agent is doing and which one
 * wants you. Two pages over the same agents, which is only worth it because the
 * questions genuinely differ — see the note on PortfolioOverview.
 */
export default function PortfolioPage() {
  return (
    <main>
      <PortfolioOverview />
    </main>
  );
}
