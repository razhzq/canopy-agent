"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActivityLog } from "@/components/activity";
import { AgentDetailView } from "@/components/agentDetail";
import { AgentChatSheet, ChatButton } from "@/components/agentChatSheet";
import { AgentThread } from "@/components/agentThread";
import { Badge } from "@/components/ui";
import { listAgents, type AgentRow } from "@/lib/api";
import { useApi } from "@/lib/useApi";

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

const TABS: { key: WorkspaceTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "chat", label: "Chat" },
  { key: "cycles", label: "Cycles" },
];

export function Workspace({ agentId, tab }: { agentId: number; tab: WorkspaceTab }) {
  const router = useRouter();
  const [chatOpen, setChatOpen] = useState(false);
  // Only for the compact header the non-overview tabs need. Overview fetches
  // the agent itself, in far more detail than the list row carries.
  const state = useApi<{ agents: AgentRow[] }>((t) => listAgents(t));

  // A `?tab=chat` link opened on a phone becomes the sheet.
  //
  // The link is real — a notification deep-links to it, and so does anything
  // bookmarked before the sheet existed. Without this, one product would have
  // two mobile chat experiences: the sheet from the icon and a full-page thread
  // from a link, which behave differently on dismiss. Runs once on mount and
  // only below `lg`, where the tab is hidden.
  useEffect(() => {
    if (tab !== "chat") return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    setChatOpen(true);
    router.replace(`/workspace/${agentId}?tab=overview`);
  }, [tab, agentId, router]);
  const agent =
    state.phase === "ready" ? (state.data.agents.find((a) => a.id === agentId) ?? null) : null;

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <section className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-grid px-5 py-3 sm:px-8">
        {/* On Overview the name and status are the page's own headline, so the
            bar carries only the back link — repeating them here would give the
            screen two titles. */}
        {tab === "overview" ? (
          <span className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            Agent
          </span>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/workspace"
              className="shrink-0 font-ui text-[12px] text-text-dim transition-colors hover:text-accent"
            >
              ← My agents
            </Link>
            <h1 className="truncate font-mono text-[16px] text-text-primary">
              {agent?.strategy_name ?? `Agent ${agentId}`}
            </h1>
            {agent ? (
              <>
                <Badge tone={agent.status === "active" ? "accent" : "warning"}>
                  {STATUS_WORD[agent.status] ?? agent.status}
                </Badge>
                {agent.is_paper ? <Badge tone="muted">Paper</Badge> : null}
              </>
            ) : null}
          </div>
        )}

        <ChatButton agent={agent} onOpen={() => setChatOpen(true)} />

        <nav
          aria-label="Agent views"
          className="flex shrink-0 items-center gap-0.5 rounded-full border border-grid p-1"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-current={t.key === tab ? "page" : undefined}
              onClick={() => router.push(`/workspace/${agentId}?tab=${t.key}`)}
              // Chat is the sheet below lg — see AgentChatSheet — so its tab
              // is hidden there rather than offering a second door to one room.
              className={`h-7 items-center rounded-full px-4 font-mono text-[11.5px] tracking-[0.04em] transition-colors ${
                t.key === "chat" ? "hidden lg:flex" : "flex"
              } ${
                t.key === tab
                  ? "bg-accent-wash text-accent"
                  : "text-text-dim hover:text-text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </section>

      {tab === "overview" ? (
        <AgentDetailView agentId={agentId} />
      ) : tab === "chat" ? (
        <AgentThread agentId={agentId} agent={agent} />
      ) : (
        <section className="px-8 py-7">
          <ActivityLog agentId={agentId} />
        </section>
      )}
    </div>
  );
}

const STATUS_WORD: Record<string, string> = {
  active: "Running",
  liquidating: "Closing out",
  paused: "Paused",
  stopped: "Stopped",
  draft: "Draft",
};

export function isTab(v: string | null): v is WorkspaceTab {
  return v === "overview" || v === "chat" || v === "cycles";
}
