import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
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
      <section className="space-y-3 border-b border-grid px-8 pt-6 pb-6">
        <Breadcrumb parts={["Portfolio", `Agent ${agentId}`, "Cycles"]} />
        <h1 className="font-mono text-[30px] leading-none text-text-primary">Cycles</h1>
        <p className="font-ui text-[14px] text-text-secondary">
          One row per time the agent woke up — including the cycles where it decided to do
          nothing, and why.
        </p>
      </section>

      <section className="px-8 py-8">
        <CycleList agentId={agentId} />
      </section>
    </main>
  );
}
