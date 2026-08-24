"use client";

import { MessageSquare, X } from "lucide-react";

import { AgentThread } from "@/components/agentThread";
import { Modal } from "@/components/modal";
import type { AgentRow } from "@/lib/api";
import { useT } from "@/lib/i18n";

/**
 * The agent's thread, as a sheet.
 *
 * WHY A SHEET AND NOT THE CHAT TAB, ON A PHONE.
 *
 * The tab is fine on a desktop, where the thread sits beside the page it is
 * about. On a phone the tab REPLACES the page — so the usual move, "I can see
 * something odd in the positions, let me ask about it", costs you the thing you
 * were looking at, and you come back to the top of a long page. A sheet keeps
 * the page underneath and hands it back on dismiss.
 *
 * `headless`, because the thread brings its own header and a second bar of
 * chrome above a conversation is wasted height on the surface with the least of
 * it. The grab handle and the close control are the sheet's own.
 */
export function AgentChatSheet({
  agentId,
  agent,
  onClose,
}: {
  agentId: number;
  agent: AgentRow | null;
  onClose: () => void;
}) {
  const t = useT();

  return (
    <Modal
      title={t("chat_title", { name: agent?.strategy_name ?? t("chat_your_agent") })}
      variant="sheet"
      headless
      onClose={onClose}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-grid px-4 py-3">
        {/* The grab handle. Decorative — dismissal is the × and the backdrop,
            both of which are real controls; a drag gesture nobody can find with
            a keyboard would not be. */}
        <span
          className="absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-full bg-grid-strong sm:hidden"
          aria-hidden
        />
        <div className="min-w-0 flex-1 pt-1.5 sm:pt-0">
          <p className="truncate font-mono text-[13.5px] text-text-primary">
            {agent?.strategy_name ?? t("chat_agent_fallback")}
          </p>
          <p className="pt-0.5 font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase">
            {t("chat_subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("chat_close_aria")}
          className="-mr-1 flex size-8 shrink-0 items-center justify-center text-text-dim transition-colors hover:text-text-primary"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {/* The thread scrolls; the sheet does not. Without `min-h-0` a flex child
          refuses to shrink below its content and the composer is pushed off the
          bottom of the sheet instead of pinned to it. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AgentThread agentId={agentId} agent={agent} />
      </div>
    </Modal>
  );
}

/**
 * The trigger, beside the agent's name.
 *
 * Badged with `needs_you` — the count of thread messages waiting on a human.
 * An agent that has asked for something and is waiting is the one state worth
 * interrupting for, and an unbadged icon would hide it behind a tap.
 */
export function ChatButton({
  agent,
  onOpen,
}: {
  agent: AgentRow | null;
  onOpen: () => void;
}) {
  const waiting = Number(agent?.needs_you ?? 0);
  const t = useT();

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={
        waiting > 0
          ? t("chat_button_aria_waiting", { count: waiting })
          : t("chat_button_aria")
      }
      className="relative flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-text-primary transition-colors hover:border-accent hover:text-accent lg:hidden"
    >
      <MessageSquare className="size-4" aria-hidden />
      {waiting > 0 ? (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 font-mono text-[9px] leading-none text-bg">
          {waiting > 9 ? "9+" : waiting}
        </span>
      ) : null}
    </button>
  );
}
