import { notFound } from "next/navigation";
import { TopNav } from "@/components/nav";
import { PortfolioPreview } from "./preview";

/**
 * DEVELOPMENT ONLY — see preview/agents. The real /portfolio needs a session
 * and three requests per agent; this draws the same view from fixtures.
 */
export default function PortfolioPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1440px] bg-bg">
      <TopNav />
      <main>
        <PortfolioPreview />
      </main>
    </div>
  );
}
