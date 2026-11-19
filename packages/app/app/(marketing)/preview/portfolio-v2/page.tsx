"use client";

import { notFound } from "next/navigation";
import { TopNav } from "@/components/nav";
import { PortfolioScreen } from "@/components/portfolio2/portfolioScreen";
import { HOLDINGS } from "../portfolio/preview";

/** Dev only: the v2 Portfolio over the v1 preview's fixture agents. */
export default function PortfolioV2Preview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1440px] bg-bg">
      <TopNav />
      <PortfolioScreen preview={{ holdings: HOLDINGS, ownOpen: [], ownClosed: [], freeUsd: 1840.25 }} />
    </div>
  );
}
