import type { Metadata } from "next";
import { CreatorEarnings } from "@/components/creatorEarnings";
import { getServerT } from "@canopy-agent/shared/i18n/server";
import { requireFeature } from "@canopy-agent/shared/tenant/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerT())("page_title_earnings") };
}

export default async function EarningsPage() {
  await requireFeature("earnings");
  return (
    <main>
      <CreatorEarnings />
    </main>
  );
}
