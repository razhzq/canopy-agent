"use client";

// One dialog, two destinations.
//
// An agent needs money in two places and they are not the same money:
//
//   TRADING CAPITAL sits in the agent's own wallet. It buys assets, it is what
//   the equity curve is measured against, and the owner can take it back out.
//
//   MODEL CREDIT is prepaid inference at Pod. It pays for the council's
//   reasoning, and it is SPEND-ONLY — once credited it cannot be withdrawn.
//
// They are related: the agent's wallet is a valid payer for its own model
// credit, so capital can become credit. That is why they belong in one dialog.
//
// WHY A SEGMENTED CONTROL AND NOT ONE FIELD.
//
// The obvious "combination" is a single amount box with a destination picker.
// It was rejected: the same number, typed into the same-looking field, would
// mean either "money I can get back" or "money I can never get back" depending
// on a control above it. One-way and reversible must not share an input. The
// segment switches the whole surface — different copy, different action, no
// shared amount state — so the irreversible side always looks like itself.
//
// Both halves render the SAME components used by their standalone dialogs —
// FundingPanel and ModelTopUpForm — so this is a second door, never a second
// implementation.

import { useState } from "react";
import { Modal } from "@/components/modal";
import { FundingPanel } from "@/components/funding";
import { ModelTopUpForm } from "@/components/modelPanel";
import { SEGMENT_TRACK, SEGMENT_ITEM, SEGMENT_ON, SEGMENT_OFF } from "@/components/kit";

export type FundsTab = "capital" | "model";

export function AddFundsModal({
  agentId,
  agentWallet,
  personalWallet,
  /** Which half opens first — set by whichever control was pressed. */
  initial = "capital",
  onChanged,
  onClose,
}: {
  agentId: number;
  agentWallet: string | null;
  personalWallet: string | null;
  initial?: FundsTab;
  onChanged?: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<FundsTab>(initial);

  return (
    <Modal title="Add funds" onClose={onClose}>
      <div className="space-y-6 px-6 pt-4 pb-6">
        <div role="group" aria-label="What to fund" className={SEGMENT_TRACK}>
          {(
            [
              { key: "capital", label: "Trading capital" },
              { key: "model", label: "Model credit" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 ${SEGMENT_ITEM} ${tab === t.key ? SEGMENT_ON : SEGMENT_OFF}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "capital" ? (
          // The address is handed down so the panel can read the chain itself
          // when canopy-be cannot — see the fallback note in funding.tsx.
          <FundingPanel agentId={agentId} address={agentWallet} />
        ) : (
          <ModelTopUpForm
            agentId={agentId}
            agentWallet={agentWallet}
            personalWallet={personalWallet}
            onDone={() => onChanged?.()}
          />
        )}
      </div>
    </Modal>
  );
}
