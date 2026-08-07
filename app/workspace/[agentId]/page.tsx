import { Suspense } from "react";
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
      <Suspense fallback={null}>
        <WorkspaceShell agentId={id} />
      </Suspense>
    </main>
  );
}
