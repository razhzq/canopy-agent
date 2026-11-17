import { Suspense } from "react";
import { SkeletonAgentDetail } from "@/components/skeleton";
import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/workspaceShell";

export default async function WorkspaceAgentPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const id = Number(agentId);
  if (!Number.isInteger(id)) notFound();

  return (
    <main>
      <Suspense fallback={<SkeletonAgentDetail labelKey="loading_agent" />}>
        <WorkspaceShell agentId={id} />
      </Suspense>
    </main>
  );
}
