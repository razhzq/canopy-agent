"use client";

import { useSearchParams } from "next/navigation";
import { isTab, Workspace } from "@/components/workspace";

/**
 * Reads the active tab from the query string.
 *
 * Split out so the pages stay server components: useSearchParams forces a
 * Suspense boundary, and keeping it in one small client component means the
 * two routes do not each need their own.
 *
 * The tab lives in the URL rather than in state so a view is linkable — "look
 * at cycle 4 on this agent" should be something you can send someone.
 */
export function WorkspaceShell({ agentId }: { agentId: number }) {
  const params = useSearchParams();
  const raw = params.get("tab");
  // Overview (wireframe 1k) is the landing view: the first question about an
  // agent is what it is doing, not what it last said.
  return <Workspace agentId={agentId} tab={isTab(raw) ? raw : "overview"} />;
}
