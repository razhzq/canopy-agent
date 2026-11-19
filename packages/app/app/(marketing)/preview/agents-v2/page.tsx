"use client";

import { notFound } from "next/navigation";
import { TopNav } from "@/components/nav";
import { AgentsScreen } from "@/components/portfolio2/agentsScreen";
import { HOLDINGS } from "../portfolio/preview";

/** Dev only: v2 Your agents over the v1 preview's fixture agents. */
export default function AgentsV2Preview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1440px] bg-bg">
      <TopNav />
      <AgentsScreen preview={HOLDINGS} />
    </div>
  );
}
