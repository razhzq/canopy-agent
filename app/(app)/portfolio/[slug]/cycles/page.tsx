import { notFound } from "next/navigation";
import { CyclesHeader } from "@/components/cyclesHeader";
import { CycleList } from "@/components/portfolio";

export default async function CyclesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agentId = Number(slug);
  if (!Number.isInteger(agentId)) notFound();

  return (
    <main>
      <CyclesHeader agentId={agentId} />

      <section className="px-8 py-8">
        <CycleList agentId={agentId} />
      </section>
    </main>
  );
}
