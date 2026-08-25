"use client";

import { useT } from "@/lib/i18n";

/**
 * The empty sparkline — a box of the right size, and a sentence for anyone who
 * cannot see it.
 *
 * Its own file because it is the one thing in the charting layer that reads
 * from the dictionary, and `charts.tsx` is imported by server components (the
 * deploy wizard's histogram and limit rows). A `useT()` in there would drag
 * those across the client boundary to translate three words.
 *
 * `aria-hidden` on the box and a visible-to-readers span inside it: the shape
 * is decoration, the sentence is the information.
 */
export function NoReadings({ width, height }: { width: number; height: number }) {
  const t = useT();
  return (
    <div style={{ width, height }} aria-hidden>
      <span className="sr-only">{t("chart_no_readings")}</span>
    </div>
  );
}
