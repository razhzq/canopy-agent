import type { Metadata } from "next";
import { CopyScreen } from "@/components/copy/copyScreen";

export const metadata: Metadata = { title: "Copy" };

/**
 * Canopy v2 Copy: published agents ranked, each copyable onto paper in one
 * sheet. Lives at /agents so every existing link (and /agents/:id, an agent's
 * record) keeps working.
 */
export default function CopyPage() {
  return <CopyScreen />;
}
