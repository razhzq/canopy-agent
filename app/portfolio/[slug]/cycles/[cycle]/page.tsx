import { notFound } from "next/navigation";
import { CycleTrace } from "@/components/portfolio";

export default async function CycleTracePage({
  params,
}: {
  params: Promise<{ slug: string; cycle: string }>;
}) {
  const { slug, cycle } = await params;
  const agentId = Number(slug);
  if (!Number.isInteger(agentId) || !cycle) notFound();

  return (
    <main>
      <CycleTrace agentId={agentId} runId={cycle} />
    </main>
  );
}
