"use client";

import { notFound } from "next/navigation";
import { CopyScreen } from "@/components/copy/copyScreen";
import { ROWS } from "../agents/preview";

/** Dev only: v2 Copy over the Explore preview's fixture strategies. */
export default function CopyV2Preview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="min-h-screen bg-bg">
      <CopyScreen preview={ROWS} />
    </div>
  );
}
