import type { Metadata } from "next";
import { StudioScreen } from "@/components/studio/studioScreen";

export const metadata: Metadata = { title: "Studio" };

/** Canopy v2 Studio: describe a strategy, then check its rules in the builder. */
export default function StudioPage() {
  return <StudioScreen />;
}
