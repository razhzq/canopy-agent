"use client";

// The agent's thread, docked beside the page it is about.
//
// WHY A RAIL AND NOT THE CHAT TAB.
//
// `agentChatSheet.tsx` already argued that a full-page thread is wrong on a
// phone — "I can see something odd in the positions, let me ask about it" costs
// you the thing you were looking at. It concluded the tab was "fine on a
// desktop, where the thread sits beside the page it is about". It does not sit
// beside it. It replaces it, at every width. The reasoning was right and the
// exemption was not.
//
// WHY A RAIL AND NOT A MODAL.
//
// A modal dims the page, traps focus, and treats a click outside as a
// dismissal. Every one of those is backwards for chat about the page you are
// on: you want to scroll to the position while typing about it, and clicking
// the page is the thing you are MEANT to do. So this has no scrim, does not
// trap focus, and ignores outside clicks. Escape and the × close it, because
// those are unambiguous.
//
// WHY IT OVERLAYS RATHER THAN PUSHES.
//
// Pushing the content would re-lay-out the equity chart and every table on each
// open and close. That jank costs more than the strip of rail it covers, and the
// rail is dismissed with one key.
//
// It is also DELIBERATELY NOT PORTALLED to the body the way Modal is: it is
// part of the workspace, not a layer over the whole app, and leaving it in the
// tree keeps its state alive across tab switches.

import { useEffect } from "react";
import { X } from "lucide-react";
import { AgentThread } from "@/components/agentThread";
import type { AgentRow } from "@/lib/api";
import { LABEL } from "@/components/kit";

export function AgentChatRail({
  agentId,
  agent,
  onClose,
}: {
  agentId: number;
  agent: AgentRow | null;
  onClose: () => void;
}) {
  // Escape closes, and nothing else here captures the keyboard. The page keeps
  // its own shortcuts because the page is still live underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      // `dialog` WITHOUT `aria-modal`: it is a dialog in the sense that it is a
      // dismissible surface, and explicitly not one in the sense that would tell
      // a screen reader the rest of the page is inert. It is not.
      role="dialog"
      aria-label={`Chat with ${agent?.strategy_name ?? "your agent"}`}
      className="fixed top-16 right-0 bottom-0 z-30 flex w-[400px] animate-[rail-enter_180ms_cubic-bezier(0.32,0.72,0,1)] flex-col border-l border-grid bg-panel shadow-[-24px_0_48px_-24px_rgba(0,0,0,0.55)]"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-grid px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[13.5px] text-text-primary">
            {agent?.strategy_name ?? "Your agent"}
          </p>
          <p className={`pt-0.5 ${LABEL}`}>Proposes · you decide</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="-mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-text-dim transition-colors hover:bg-surface hover:text-text-primary"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {/* The thread scrolls; the rail does not. Without `min-h-0` a flex child
          refuses to shrink below its content and the composer is pushed off the
          bottom instead of pinned to it. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AgentThread agentId={agentId} agent={agent} />
      </div>
    </aside>
  );
}
