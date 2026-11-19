import type { Metadata } from "next";
import { AskScreen } from "@/components/ask/askScreen";

export const metadata: Metadata = { title: "Ask" };

/** Canopy v2 home: describe a trade in a sentence. */
export default function AskPage() {
  return <AskScreen />;
}
