import { notFound, redirect } from "next/navigation";

/**
 * Legacy deep link into one agent. The owner's view is wireframe 1k, which
 * lives on the workspace route now; the segment is still called `slug` because
 * older links use it, but the value has always been the numeric agent id.
 */
export default async function AgentMonitorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agentId = Number(slug);
  if (!Number.isInteger(agentId)) notFound();

  redirect(`/workspace/${agentId}`);
}
