import { notFound } from "next/navigation";
import { TopNav } from "@/components/nav";
import { AgentsPreview } from "./preview";

/**
 * DEVELOPMENT ONLY. The real /agents sits behind a Privy session and a live
 * backend, which makes it impossible to look at in a headless browser. This
 * route draws the same view with fixture rows under the real top nav, so the
 * page can be checked against DESIGN_PRINCIPLES.md without an account.
 *
 * 404s in production: the fixtures are invented numbers, and the product's
 * rule is that invented numbers never reach a real user.
 */
export default function AgentsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1440px] bg-bg">
      <TopNav />
      <main>
        <AgentsPreview />
      </main>
    </div>
  );
}
