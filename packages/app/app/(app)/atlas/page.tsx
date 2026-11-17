import type { Metadata } from "next";
import { AtlasDashboard } from "@/components/atlas";
import { getServerT } from "@canopy-agent/shared/i18n/server";
import { requireFeature } from "@canopy-agent/shared/tenant/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerT())("page_title_atlas") };
}

/**
 * Atlas: crypto funds benchmarked against a Canopy LP strategy's on-chain
 * record. The design reference is canopyatlas.pen.
 */
export default async function AtlasPage() {
  await requireFeature("atlas");
  return (
    <main>
      <AtlasDashboard />
    </main>
  );
}
