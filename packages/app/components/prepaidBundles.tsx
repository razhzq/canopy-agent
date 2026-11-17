"use client";

// The prepaid tiers, above the amount field they fill in.
//
// A tier is a SHORTCUT, NOT A MODE. Pressing one writes its price into the
// amount input and nothing else — the field stays editable, no tier is
// "selected" in a way that changes what happens on send, and an owner who types
// their own number is on exactly the same path. That is why these are buttons
// rather than radios: choosing a plan implies a commitment the product does not
// actually make.

import { Bundle, tokensLabel } from "@/lib/modelBundles";
import { LABEL, SURFACE, NUM } from "@/components/kit";

export function PrepaidBundles({
  bundles,
  priceInPerM,
  priceOutPerM,
  /** The amount currently in the field, so a matching tier can read as chosen. */
  current,
  onPick,
}: {
  bundles: Bundle[];
  priceInPerM: number;
  priceOutPerM: number;
  current: string;
  onPick: (usdc: number) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={LABEL}>Prepaid bundle</span>
        {/* The rate, stated once, beside the thing it prices. It was previously
            a sentence below the top-up button — after the decision rather than
            before it. */}
        <span className="font-ui text-[11.5px] text-text-dim">
          <span className={NUM}>${priceInPerM}</span> in ·{" "}
          <span className={NUM}>${priceOutPerM}</span> out / M
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {bundles.map((b) => {
          // Matched on the number, not on which button was last pressed. A tier
          // the owner typed by hand should read the same as one they clicked,
          // and clearing the field should deselect all three.
          const active = current.trim() !== "" && Number(current) === b.usdc;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onPick(b.usdc)}
              aria-pressed={active}
              className={`${SURFACE} px-3 py-2.5 text-left transition-colors ${
                active
                  ? "border-accent bg-accent-wash"
                  : "hover:border-text-dim"
              }`}
            >
              <span
                className={`block font-mono text-[9px] tracking-[0.1em] uppercase ${
                  active ? "text-accent" : "text-text-dim"
                }`}
              >
                {b.label}
              </span>
              <span
                className={`mt-1.5 block tnum font-mono text-[15px] leading-none ${
                  active ? "text-accent" : "text-text-primary"
                }`}
              >
                ${b.usdc}
              </span>
              <span className="mt-1 block font-ui text-[11px] text-text-dim">
                {tokensLabel(b.totalM)} tokens
              </span>
            </button>
          );
        })}
      </div>

      {/* The floor, said once. It is the reason the smallest tier is the size it
          is, and without it "Starter" looks like an arbitrary price point. */}
      <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">
        Each bundle is split evenly between input and output — the smallest buys{" "}
        <span className={NUM}>10M</span> of each. Token counts are a floor: they
        are priced at the most this agent will pay per million, so a cheaper
        fill buys more.
      </p>
    </div>
  );
}
