import type { Metadata } from "next";
import { AgentsScreen } from "@/components/portfolio2/agentsScreen";

export const metadata: Metadata = { title: "Your agents" };

/** Every agent, what it is doing and what it has made; Portfolio's "Manage agents". */
export default function AgentsPage() {
  return <AgentsScreen />;
}
