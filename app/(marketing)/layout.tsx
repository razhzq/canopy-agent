import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import { getServerT } from "@/lib/i18n/server";

/**
 * The landing routes, without the application chrome.
 *
 * FONTS ARE LOADED HERE RATHER THAN IN THE ROOT LAYOUT.
 *
 * `landing.css` asks for Inter Tight and JetBrains Mono, which the app itself
 * does not use — it runs on Inter and IBM Plex Mono. Loading them globally
 * would put two extra webfonts on every signed-in page to serve two pages
 * nobody signed in ever sees.
 *
 * The stylesheet falls back to system fonts without them, and a landing page
 * rendered in the wrong typeface is a landing page that has lost the thing it
 * was designed around — so they load, scoped to this branch of the tree.
 */
const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return {
    title: t("page_title_landing"),
    description: t("page_desc_landing"),
  };
}

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${interTight.variable} ${jetbrains.variable}`}>{children}</div>;
}
