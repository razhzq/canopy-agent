"use client";

import { MessageSquare, X } from "lucide-react";

import { AgentThread } from "@/components/agentThread";
import { Modal } from "@/components/modal";
import { ICON_BUTTON, ICON_BUTTON_ON, LABEL } from "@/components/kit";
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
      title={t("chat_title", {
        name: agent?.strategy_name ?? t("chat_your_agent"),
      })}
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
          <p className="truncate font-ui text-[14px] font-medium text-text-primary">
            {agent?.strategy_name ?? t("chat_agent_fallback")}
          </p>
          <p className="pt-0.5 font-ui text-[11.5px] text-text-muted">
            {t("chat_subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("chat_close_aria")}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-text-dim transition-colors hover:border-grid-strong hover:text-text-primary"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {/* The thread scrolls; the sheet does not. Without `min-h-0` a flex child
          refuses to shrink below its content and the composer is pushed off the
          bottom of the sheet instead of pinned to it. */}
      <div className="min-h-0 flex-1">
        <AgentThread agentId={agentId} agent={agent} autoFocus />
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
  compact = false,
  active = false,
}: {
  agent: AgentRow | null;
  onOpen: () => void;
  /**
   * The thread is open.
   *
   * Makes this a TOGGLE rather than a one-way opener. The rail is persistent and
   * ignores outside clicks by design, so without a visible off-switch on the
   * control that turned it on, the only way back is hunting for the × inside it.
   * A control that opens something should say when that thing is open.
   */
  active?: boolean;
  /**
   * Icon only, for sitting beside the agent's name.
   *
   * The labelled form belongs in the workspace bar, where it replaced a tab and
   * needs that tab's word to be recognised. Next to a 28px headline the word is
   * noise — the thing it is attached to is already named, in type four times
   * the size.
   */
  compact?: boolean;
}) {
  const waiting = Number(agent?.needs_you ?? 0);
  const t = useT();

  return (
    <button
      type="button"
      onClick={onOpen}
      // The state is in the accessible name too, not only in the fill — the
      // colour change is invisible to a screen reader and `aria-pressed` alone
      // reads as "pressed", which is not what an open panel means to someone
      // who cannot see it.
      title={active ? t("chat_button_close") : t("chat_button_aria")}
      aria-label={
        active
          ? t("chat_button_close")
          : waiting > 0
            ? t("chat_button_aria_waiting", { count: waiting })
            : t("chat_button_aria")
      }
      // NO `lg:hidden`. It carried that because the desktop had a Chat tab and
      // this was the phone's substitute for it. The tab is gone, so the hidden
      // button was the only way in to a panel with no way in.
      //
      // The LABEL comes back at `lg` too. It sits where the tab used to, and a
      // bare icon in the space a word occupied yesterday is a feature people
      // have to rediscover. Below `lg` the icon alone still carries it — the bar
      // is narrow and the accessible name is on the button either way.
      aria-pressed={active}
      data-chat-button=""
      // QUIET AT REST. This was a bordered box beside a 28px headline — rule 6:
      // a control pressed constantly and costing nothing does not draw an
      // outline around itself all day. The target appears on hover as a fill,
      // which says "this area responds" where an outline only says "here is an
      // edge".
      className={`relative ${ICON_BUTTON} ${active ? ICON_BUTTON_ON : ""} ${
        compact ? "" : "w-auto gap-2 px-2.5"
      }`}
    >
      <MessageSquare className="size-4 shrink-0" aria-hidden />
      {compact ? null : (
        <span className="hidden font-ui text-[13px] lg:inline">Chat</span>
      )}
      {waiting > 0 ? (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 font-mono text-[9.5px] leading-none text-bg">
          {waiting > 9 ? "9+" : waiting}
        </span>
      ) : null}
    </button>
  );
}
