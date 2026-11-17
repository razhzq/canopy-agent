import { notFound } from "next/navigation";
import { TopNav } from "@/components/nav";
import { AtlasPreview } from "./preview";

/**
 * DEVELOPMENT ONLY — see preview/agents. The real /atlas needs a session and
 * canopy-be; this draws the same view with a fixture LP record.
 */
export default function AtlasPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1440px] bg-bg">
      <TopNav />
      <main>
        <AtlasPreview />
      </main>
    </div>
  );
}
