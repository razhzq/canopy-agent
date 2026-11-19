import type { Metadata } from "next";
import { PortfolioScreen } from "@/components/portfolio2/portfolioScreen";
import { getServerT } from "@canopy-agent/shared/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerT())("page_title_portfolio") };
}

/** Canopy v2 Portfolio: balance, figures, charts and agent wallets, one book at a time. */
export default function PortfolioPage() {
  return <PortfolioScreen />;
}
