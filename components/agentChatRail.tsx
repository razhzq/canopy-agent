"use client";

// The agent's thread, docked beside the page it is about.
//
// WHY A RAIL AND NOT THE CHAT TAB.
//
// `agentChatSheet.tsx` already argued that a full-page thread is wrong on a
// phone — "I can see something odd in the positions, let me ask about it" costs
// you the thing you were looking at. On a desktop the thread sits BESIDE the
// page it is about, not in place of it.
//
// WHY A RAIL AND NOT A MODAL.
//
// A modal dims the page, traps focus, and treats a click outside as a
// dismissal. Every one of those is backwards for chat about the page you are
// on: you want to scroll to the position while typing about it, and clicking
// the page is the thing you are MEANT to do. So this has no scrim, does not
// trap focus, and ignores outside clicks. Escape and the × close it.
//
// WHY IT DOCKS RATHER THAN OVERLAYS.
//
// It used to be fixed to the viewport's right edge. The page is a 1440px frame
// centred in the window, so on any wider screen the rail landed on top of the
// page's own right-hand column and clipped the strategy and universe panels —
// the things you open the thread to ask about. Docked as a column, the page
// reflows once on open and everything stays readable. The reflow is one
// resize of the equity chart, which is cheaper than hiding it.
//
// THE SMALL THINGS THAT MAKE IT FEEL LIKE A DRAWER.
//
// - It slides in on the shared easing and slides OUT on close, rather than
//   vanishing. A panel that disappears in one frame reads as a crash.
// - Opening hands focus to the composer, so the first keystroke is the
//   message. Closing hands focus back to the button that opened it, so a
//   keyboard reader is not dropped at the top of the page.
// - The header says what the agent is doing right now, and how many things are
//   waiting on you — the two facts that decide whether to scroll or to type.

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AgentThread } from "@/components/agentThread";
import { StatusLine } from "@/components/kit";
import { useT } from "@/lib/i18n";
import type { AgentRow } from "@/lib/api";
import type { TranslationKey } from "@/lib/i18n";

/** The same words the workspace bar uses for the agent's state. */
const STATUS_KEY: Record<string, TranslationKey> = {
  active: "ad_status_running",
  liquidating: "ws_status_liquidating",
  paused: "ws_status_paused",
  stopped: "ws_status_stopped",
  draft: "ws_status_draft",
};

const EXIT_MS = 300; // matches the width transition, so the column is fully closed before it unmounts

export function AgentChatRail({
  agentId,
  agent,
  open,
  onClose,
}: {
  agentId: number;
  agent: AgentRow | null;
  /** Kept mounted for one exit animation after this turns false. */
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  // Mounted while open, and for EXIT_MS after — long enough to slide out.
  const [shown, setShown] = useState(open);
  const [leaving, setLeaving] = useState(false);
  // Painted once at zero width before growing, so the width transition has a
  // frame to start from. Without this the column appears at full width.
  const [grown, setGrown] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      // Remember what opened us, so closing can hand focus back to it.
      opener.current = document.activeElement as HTMLElement | null;
      setLeaving(false);
      setShown(true);
      const raf = requestAnimationFrame(() => setGrown(true));
      return () => cancelAnimationFrame(raf);
    }
    if (!shown) return;
    setLeaving(true);
    setGrown(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setTimeout(
      () => {
        setShown(false);
        setLeaving(false);
        // Back to the button, if it is still there. Never to the body.
        const target =
          opener.current && document.contains(opener.current)
            ? opener.current
            : (document.querySelector<HTMLElement>("[data-chat-button]") ?? null);
        target?.focus();
      },
      reduce ? 0 : EXIT_MS,
    );
    return () => clearTimeout(id);
    // `shown` is intentionally read, not depended on: this runs on the open
    // edge only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape closes, and nothing else here captures the keyboard. The page keeps
  // its own shortcuts because the page is still live underneath.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!shown) return null;

  const waiting = Number(agent?.needs_you ?? 0);
  const running = agent?.status === "active";

  return (
    <aside
      // `dialog` WITHOUT `aria-modal`: a dismissible surface, and explicitly
      // not one that tells a screen reader the rest of the page is inert.
      role="dialog"
      aria-label={t("chat_title", { name: agent?.strategy_name ?? t("chat_your_agent") })}
      data-state={grown && !leaving ? "open" : "closed"}
      // The column animates its WIDTH from zero; the panel inside keeps a fixed
      // width so its contents never squash mid-slide. Sticky under the nav, so
      // the thread stays put while the page behind it scrolls.
      className="sticky top-16 z-30 h-[calc(100vh-64px)] shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none data-[state=closed]:w-0 data-[state=open]:w-[400px]"
    >
      <div
        className="flex h-full w-[400px] flex-col border-l border-border bg-bg data-[state=closed]:animate-[rail-exit_200ms_cubic-bezier(0.2,0.8,0.2,1)_forwards] data-[state=open]:animate-[rail-enter_260ms_cubic-bezier(0.2,0.8,0.2,1)]"
        data-state={leaving ? "closed" : "open"}
      >
      <div className="flex shrink-0 items-center gap-3 border-b border-grid px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-ui text-[14px] font-medium text-text-primary">
            {agent?.strategy_name ?? t("chat_agent_fallback")}
          </p>
          <div className="flex items-center gap-3 pt-0.5">
            {agent ? (
              <StatusLine tone={running ? "good" : "pending"} live={running}>
                {STATUS_KEY[agent.status] ? t(STATUS_KEY[agent.status]) : agent.status}
              </StatusLine>
            ) : (
              <span className="font-ui text-[11.5px] text-text-muted">{t("chat_subtitle")}</span>
            )}
            {waiting > 0 ? (
              <span className="inline-flex h-[20px] items-center rounded-full border border-warning/45 px-2 font-ui text-[11px] font-medium text-warning">
                {t("chat_waiting_count", { count: waiting })}
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("chat_close_aria")}
          title="Esc"
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-text-dim transition-colors hover:border-grid-strong hover:text-text-primary"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {/* The thread owns its own scroll box and pins the composer to the foot;
          this only has to give it the height. */}
      <div className="min-h-0 flex-1">
        <AgentThread agentId={agentId} agent={agent} autoFocus={open} />
      </div>
      </div>
    </aside>
  );
}
