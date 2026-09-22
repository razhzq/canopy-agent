import type { Metadata } from "next";
import { CreatorEarnings } from "@/components/creatorEarnings";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerT())("page_title_earnings") };
}

export default function EarningsPage() {
  return (
    <main>
      <CreatorEarnings />
    </main>
  );
}
