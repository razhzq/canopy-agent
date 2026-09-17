import type { Metadata } from "next";
import { AtlasDashboard } from "@/components/atlas";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerT())("page_title_atlas") };
}

/**
 * Atlas: crypto funds benchmarked against a Canopy LP strategy's on-chain
 * record. The design reference is canopyatlas.pen.
 */
export default function AtlasPage() {
  return (
    <main>
      <AtlasDashboard />
    </main>
  );
}
