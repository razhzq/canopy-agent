import { notFound } from "next/navigation";
import { AgentMonitor } from "@/components/portfolio";

/**
 * The route segment is the agent's id. The design called it `slug`; keeping the
 * segment name avoids churning every link, but the value is numeric because
 * that is what identifies an agent in the database.
 */
export default async function AgentMonitorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agentId = Number(slug);
  if (!Number.isInteger(agentId)) notFound();

  return (
    <main>
      <AgentMonitor agentId={agentId} />
    </main>
  );
}
