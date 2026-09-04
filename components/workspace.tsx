"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActivityLog } from "@/components/activity";
import { AgentDetailView } from "@/components/agentDetail";
import { AgentChatSheet, ChatButton } from "@/components/agentChatSheet";
import { AgentChatRail } from "@/components/agentChatRail";
import { useIsMobile } from "@/lib/useIsMobile";
import { AgentThread } from "@/components/agentThread";
import { listAgents, type AgentRow } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useT, type TranslationKey } from "@/lib/i18n";
import { StatusLine } from "@/components/kit";

/**
 * One agent, open.
 *
 * WHAT CHANGED, AND WHY THE RAIL WENT
 *
 * This used to be a rail of agents beside one agent's thread. The rail was a
 * list rendered as navigation: fine for switching, useless for the question an
 * owner actually opens the product with — what is all of my capital doing. That
 * question now has its own page (wireframe 1j, `MyAgents`), so the rail is
 * redundant and the agent gets the full width.
 *
 * Overview is wireframe 1k and is the landing tab. The other three predate it
 * and stay: chat-first interfaces fail once the transcript is the only place
 * state lives — you end up reading prose to answer questions a table answers
 * better. Chat carries intent; Performance and Cycles stay structured.
 */

/**
 * Performance is gone as a tab. It held nothing but the equity curve, and
 * Overview already loads that series for its Return · 30d cell — so the curve
 * now sits at the top of Overview and the tab it used to justify is one click
 * of navigation that answered a question the page it came from should have.
 *
 * Old `?tab=performance` links land on Overview: `isTab` no longer recognises
 * it and `WorkspaceShell` falls back — which is where the curve went.
 */
export type WorkspaceTab = "overview" | "chat" | "cycles";

/**
 * CHAT IS NOT A TAB ANY MORE.
 *
 * It is a panel over whatever you are looking at — the sheet on a phone, the
 * docked rail on a desktop. The type keeps "chat" because links to it exist and
 * must keep working; the effect below turns one into the panel.
 *
 * The argument is the one `agentChatSheet.tsx` already made and then exempted
 * the desktop from: everything you say to this agent is about something on the
 * page, and a tab takes the page away to talk about it.
 */
const TABS: { key: WorkspaceTab; labelKey: TranslationKey }[] = [
  { key: "overview", labelKey: "ws_tab_overview" },
  { key: "cycles", labelKey: "ws_tab_cycles" },
];

/**
 * A tab link that keeps everything else in the query.
 *
 * This used to be `?tab=${key}` built from nothing, which silently deleted any
 * other parameter the URL was carrying. That is what killed the builder's
 * funding hand-off: it arrived as `?tab=cycles&fund=model`, and the first tab
 * click rebuilt the query without `fund`, so the page that knows how to read it
 * never saw it. `?checkout=` on the same page has the identical exposure.
 *
 * Rebuilding from the live URL rather than from a remembered value because the
 * flags here are one-shot — the receiving effects strip them once handled, and
 * a stale copy would resurrect a dialog the owner already dismissed.
 */
function tabHref(agentId: number, key: string): string {
  const params =
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  params.set("tab", key);
  return `/workspace/${agentId}?${params.toString()}`;
}

export function Workspace({
  agentId,
  tab,
}: {
  agentId: number;
  tab: WorkspaceTab;
}) {
  const router = useRouter();
  const t = useT();
  const [chatOpen, setChatOpen] = useState(false);
  /**
   * ONE OWNER FOR THE THREAD, at both widths.
   *
   * `chatOpen` lived here already and nothing rendered from it — the sheet was
   * owned by `agentDetailMobile`, so the `?tab=chat` deep link set a flag no
   * component read and the link opened nothing. Mounting the panel here fixes
   * that and gives the two presentations one switch.
   *
   * It also has to live above the tab bar rather than inside a view: a thread
   * that closed itself because you looked at Cycles would be unusable for the
   * thing people actually do, which is ask about what they are looking at and
   * then go look at something else.
   */
  const mobile = useIsMobile();
  // Only for the compact header the non-overview tabs need. Overview fetches
  // the agent itself, in far more detail than the list row carries.
  const state = useApi<{ agents: AgentRow[] }>((token) => listAgents(token));

  // A `?tab=chat` link becomes the panel, at EVERY width now.
  //
  // The link is real — a notification deep-links to it, and so does anything
  // bookmarked from when chat was a page. This used to run only below `lg`,
  // because above it the tab still existed. It does not, so the guard would now
  // strand a desktop visitor on a tab with nothing behind it.
  //
  // Lands them on Overview with the thread open, which is the same place the
  // chat button goes — one destination for chat, however you arrive.
  useEffect(() => {
    if (tab !== "chat") return;
    setChatOpen(true);
    router.replace(tabHref(agentId, "overview"));
  }, [tab, agentId, router]);
  const agent =
    state.phase === "ready"
      ? (state.data.agents.find((a) => a.id === agentId) ?? null)
      : null;

  return (
    // A ROW: the page, then the thread docked beside it. The rail is a column
    // that animates its width, so opening it pushes the page over once rather
    // than covering the page's own right-hand rail — which is what a fixed
    // overlay did on any screen wider than the 1440px frame.
    <div className="flex items-start">
      <div className="min-h-[calc(100vh-64px)] min-w-0 flex-1">
      <section className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-grid px-5 py-3 sm:px-8">
        {/* On Overview the name and status are the page's own headline, so the
            bar carries only the back link — repeating them here would give the
            screen two titles. */}
        {tab === "overview" ? (
          <span className="font-ui text-[12.5px] text-text-muted">
            {t("ws_eyebrow")}
          </span>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            {/* Back out of an agent lands on the portfolio now — /workspace is
                a redirect to it, and a back link that takes a hop is a back
                link that flashes a page nobody asked for. */}
            <Link
              href="/portfolio"
              className="shrink-0 font-ui text-[13px] text-text-secondary transition-colors hover:text-text-primary"
            >
              {t("ws_back")}
            </Link>
            <h1 className="truncate font-ui text-[15px] font-medium text-text-primary">
              {agent?.strategy_name ?? t("ws_fallback_name", { id: agentId })}
            </h1>
            {agent ? (
              <>
                <StatusLine tone={agent.status === "active" ? "good" : "pending"}>
                  {STATUS_WORD_KEY[agent.status]
                    ? t(STATUS_WORD_KEY[agent.status])
                    : agent.status}
                </StatusLine>
                {agent.is_paper ? (
                  <span className="inline-flex h-[22px] items-center rounded-full border border-border px-2.5 font-ui text-[11.5px] font-medium text-text-secondary">
                    {t("ws_badge_paper")}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
        )}

        {/* Not on Overview, for the same reason the name is not: that page's own
            header carries both. Two chat buttons on one screen is the "two doors
            to one room" this merge was meant to remove. */}
        {tab === "overview" ? null : (
          <ChatButton
            agent={agent}
            active={chatOpen}
            onOpen={() => setChatOpen((o) => !o)}
          />
        )}

        <nav
          aria-label={t("ws_views_aria")}
          className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface p-1"
        >
          {/* `entry`, not `t` — the translator owns that name here. */}
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              aria-current={entry.key === tab ? "page" : undefined}
              onClick={() => router.push(tabHref(agentId, entry.key))}
              // Chat is the sheet below lg — see AgentChatSheet — so its tab
              // is hidden there rather than offering a second door to one room.
              className={`h-8 items-center rounded-full px-4 font-ui text-[13px] font-medium transition-colors ${
                entry.key === "chat" ? "hidden lg:flex" : "flex"
              } ${
                entry.key === tab
                  ? "bg-surface-2 text-text-primary"
                  : "text-text-dim hover:text-text-primary"
              }`}
            >
              {t(entry.labelKey)}
            </button>
          ))}
        </nav>
      </section>

      {tab === "cycles" ? (
        <section className="px-8 py-7">
          <ActivityLog agentId={agentId} />
        </section>
      ) : (
        // Overview, and anything unrecognised. `tab=chat` is redirected by the
        // effect above, but it renders for one frame before that lands — and
        // the page under the thread is the right thing to show in that frame.
        <AgentDetailView
          agentId={agentId}
          onOpenChat={() => setChatOpen(true)}
        />
      )}
      </div>

      {mobile ? (
        chatOpen ? (
          <AgentChatSheet
            agentId={agentId}
            agent={agent}
            onClose={() => setChatOpen(false)}
          />
        ) : null
      ) : (
        // Always mounted on a desktop: the rail animates its own width closed
        // after `open` turns false, which it cannot do once unmounted.
        <AgentChatRail
          agentId={agentId}
          agent={agent}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}

const STATUS_WORD_KEY: Record<string, TranslationKey> = {
  active: "ws_status_active",
  liquidating: "ws_status_liquidating",
  paused: "ws_status_paused",
  stopped: "ws_status_stopped",
  draft: "ws_status_draft",
};

export function isTab(v: string | null): v is WorkspaceTab {
  return v === "overview" || v === "chat" || v === "cycles";
}
