import type { Metadata } from "next";
import { MyAgents } from "@/components/myAgents";
import { PageHeader } from "@/components/pageHeader";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerT())("page_title_workspace") };
}

/** "My agents" — wireframe 1j. The landing page for an owner. */
export default function MyAgentsPage() {
  return (
    <main>
      <PageHeader
        eyebrowKey="page_eyebrow_portfolio"
        titleKey="workspace_page_title"
        bodyKey="workspace_page_body"
      />
      <MyAgents />
    </main>
  );
}
