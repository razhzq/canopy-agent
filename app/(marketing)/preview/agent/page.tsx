import { notFound } from "next/navigation";
import { TopNav } from "@/components/nav";
import { AgentPreview } from "./preview";

/**
 * DEVELOPMENT ONLY — see preview/agents. The real /agents/:id needs a session
 * and a record; this draws the same page from fixtures.
 */
export default function AgentPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1440px] bg-bg">
      <TopNav />
      <main>
        <AgentPreview />
      </main>
    </div>
  );
}
