import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import { ResearchPage } from "@/components/research/ResearchPage";

/**
 * /research — the execution footprint study.
 *
 * Public: it sits in the (marketing) group, so it renders without the
 * signed-in chrome and the invite gate, and never asks for a session.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return {
    title: t("rs_page_title"),
    description: t("rs_page_desc"),
  };
}

export default function Research() {
  return <ResearchPage />;
}
