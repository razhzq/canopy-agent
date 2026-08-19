"use client";

// The notification centre: what the agents have done, and where Telegram is
// connected.
//
// ONE LIST, TWO DELIVERIES.
//
// This reads the same `notification_outbox` the Telegram worker sends from,
// rather than a feed of its own. That is the whole design: a panel built from a
// separate source would drift from the phone, and "my Telegram said something
// different" is the kind of doubt a trading product does not recover from.
//
// It also means the centre works for someone who has never linked a chat —
// `notify()` enqueues unconditionally, so the history is complete either way,
// and Telegram becomes what it should be: a way to be told while you are away,
// not the only place the news exists.
//
// WHY CONNECTING TELEGRAM LIVES IN HERE.
//
// The moment someone wants alerts on their phone is the moment they are looking
// at the alerts. Putting the connection on a settings page meant discovering the
// feature, leaving the page you were reading, and coming back — and the bell in
// the agent header was a link to that page rather than anything you could act
// on where you stood.
//
// UNREAD IS BOUNDED BY WHAT WAS RENDERED.
//
// Opening the panel marks read only up to the newest row actually on screen. A
// notification that lands while the panel is open is not marked read, because
// nobody read it.

import Link from "next/link";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useApi } from "@/lib/useApi";
import {
  getNotificationFeed,
  getTelegramStatus,
  linkTelegram,
  markNotificationsRead,
  setTelegramEnabled,
  type NotificationItem,
  type NotificationKind,
} from "@/lib/api";

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/** How often the badge re-checks while the panel is closed. */
const POLL_MS = 60_000;

export function NotificationCentre() {
  const { authenticated } = usePrivy();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  const feed = useApi((t) => getNotificationFeed(t, 30), [tick]);

  // A slow poll, and only while closed. An open panel is already being read;
  // refetching under the cursor would reorder rows mid-glance.
  useEffect(() => {
    if (open || !authenticated) return;
    const id = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => clearInterval(id);
  }, [open, authenticated]);

  // Click-away and Escape. Pointerdown rather than click so a drag that ends
  // outside does not count as dismissing.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const unread = feed.phase === "ready" ? feed.data.unread : 0;
  const items = feed.phase === "ready" ? feed.data.items : [];

  if (!authenticated) return null;

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        className={`relative flex size-9 items-center justify-center rounded-md transition-colors hover:bg-surface ${
          unread > 0 ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
        } ${FOCUS}`}
      >
        <Bell className="size-[18px]" aria-hidden />
        {unread > 0 ? (
          // A count, not a dot: "something happened" and "eleven things
          // happened" deserve different urgency, and the number is free.
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] leading-none text-bg">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <Panel
          items={items}
          loading={feed.phase === "loading"}
          failed={feed.phase === "error" ? feed.message : null}
          onRead={() => feed.reload()}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function Panel({
  items,
  loading,
  failed,
  onRead,
  onClose,
}: {
  items: NotificationItem[];
  loading: boolean;
  failed: string | null;
  onRead: () => void;
  onClose: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const marked = useRef(false);

  // Marked once, on open, bounded by the newest row RENDERED. Anything that
  // arrives after this stays unread, because nobody has seen it.
  useEffect(() => {
    if (marked.current || items.length === 0) return;
    const newest = items[0];
    if (items.every((i) => i.read)) return;
    marked.current = true;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        await markNotificationsRead(token, newest.id);
        onRead();
      } catch {
        // A badge that stays lit is a far smaller problem than an error toast
        // over a panel the user opened to read something else.
      }
    })();
  }, [items, getAccessToken, onRead]);

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 z-40 mt-2 flex max-h-[min(70vh,560px)] w-[min(92vw,380px)] origin-top-right animate-[menu-enter_120ms_ease-out] flex-col overflow-hidden rounded-md border border-grid-strong bg-panel shadow-[0_20px_44px_-16px_rgba(0,0,0,0.9)]"
    >
      <div className="flex items-center justify-between border-b border-grid px-4 py-3">
        <p className="font-mono text-[11px] tracking-[0.12em] text-text-secondary uppercase">
          Notifications
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-4" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-surface" />
            ))}
          </div>
        ) : failed ? (
          <p className="px-4 py-6 font-ui text-[13px] text-negative">{failed}</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center font-ui text-[13px] leading-relaxed text-text-dim">
            Nothing yet. Your agents will report here when they trade, when
            something needs you, and when a limit is breached — a quiet feed
            means they looked and found nothing worth doing.
          </p>
        ) : (
          items.map((n) => <Row key={n.id} n={n} onNavigate={onClose} />)
        )}
      </div>

      <TelegramSection />
    </div>
  );
}

/**
 * One notification, and a way to act on it.
 *
 * A notification names something an agent did — a fill with its reason, a stop
 * that triggered, a breach — and the next thing anyone wants is to LOOK at that
 * agent. Without a link the panel is a dead end that describes work you then
 * have to go find by hand.
 *
 * Account-level rows have no `agentId` and stay inert rather than linking
 * somewhere arbitrary. Rendered as an <article> in that case, so the whole row
 * does not advertise itself as pressable.
 */
function Row({ n, onNavigate }: { n: NotificationItem; onNavigate: () => void }) {
  const kind = KIND[n.kind] ?? FALLBACK_KIND;

  const inner = (
    <>
      <span className={`mt-1 size-1.5 shrink-0 rounded-full ${kind.dot}`} aria-hidden />
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className={`font-mono text-[10px] tracking-[0.1em] uppercase ${kind.tone}`}>
            {kind.label}
          </span>
          {n.agentName ? (
            <span className="truncate font-mono text-[11px] text-text-dim">{n.agentName}</span>
          ) : null}
          <span className="ml-auto shrink-0 font-mono text-[10px] text-text-muted">
            {ago(n.createdAt)}
          </span>
        </div>
        {/* Plain text, stripped server-side. Never markup: this table carries
            token symbols and error strings from outside the product. */}
        <p className="font-ui text-[12.5px] leading-relaxed break-words whitespace-pre-line text-text-secondary">
          {n.text}
        </p>
        {n.undeliverable ? (
          <p className="font-ui text-[11px] text-warning">
            Couldn&apos;t reach your Telegram — you&apos;re seeing this here instead.
          </p>
        ) : null}
      </div>
    </>
  );

  const shell = `flex gap-3 border-b border-grid px-4 py-3 last:border-b-0 ${
    n.read ? "" : "bg-surface/60"
  }`;

  if (n.agentId === null) {
    return <article className={shell}>{inner}</article>;
  }

  return (
    <Link
      href={`/workspace/${n.agentId}`}
      // Closed on navigate: the panel is absolutely positioned and would
      // otherwise hang over the page it just sent you to.
      onClick={onNavigate}
      className={`${shell} text-left transition-colors hover:bg-surface ${FOCUS}`}
    >
      {inner}
    </Link>
  );
}

/**
 * Connecting Telegram, in the place where wanting it occurs to you.
 *
 * Deliberately small. The full explanation of what does and does not get sent
 * lives on the settings panel; repeating it here would bury the feed under
 * policy the reader did not open this for.
 */
function TelegramSection() {
  const { getAccessToken } = usePrivy();
  const status = useApi(getTelegramStatus, []);
  const [busy, setBusy] = useState(false);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const { url } = await linkTelegram(token);
      // A new tab: the link is finished inside Telegram, and navigating this
      // one away would lose the panel the user was reading.
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }, [getAccessToken]);

  const toggle = useCallback(async () => {
    if (status.phase !== "ready") return;
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      await setTelegramEnabled(token, !status.data.enabled);
      status.reload();
    } finally {
      setBusy(false);
    }
  }, [getAccessToken, status]);

  // Nothing at all when the deployment has no bot: an offer that cannot be
  // fulfilled is worse than no offer.
  if (status.phase !== "ready" || !status.data.configured) return null;

  const { linked, enabled, username } = status.data;

  return (
    <div className="flex items-center gap-3 border-t border-grid bg-surface/40 px-4 py-3">
      <TelegramIcon className={linked && enabled ? "text-accent" : "text-text-muted"} />
      <div className="min-w-0 flex-1">
        <p className="font-ui text-[12px] text-text-secondary">
          {!linked
            ? "Get these on Telegram"
            : enabled
              ? `Sending to ${username ? `@${username}` : "your Telegram"}`
              : "Telegram muted"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void (linked ? toggle() : connect())}
        disabled={busy}
        className={`shrink-0 border px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] uppercase transition-colors disabled:opacity-40 ${
          linked
            ? "border-border text-text-dim hover:border-accent hover:text-accent"
            : "border-accent text-accent hover:bg-accent hover:text-bg"
        } ${FOCUS}`}
      >
        {busy ? "…" : !linked ? "Connect" : enabled ? "Mute" : "Unmute"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------- bits -- */

/**
 * A kind we do not recognise still renders.
 *
 * `kind` is constrained by a CHECK in the database, so today this is
 * unreachable — but the constraint is the place new kinds get added, and a
 * client that indexes this map blindly would crash the whole panel on the first
 * deploy where the backend knows one more word than it does.
 */
const FALLBACK_KIND = { label: "Update", tone: "text-text-secondary", dot: "bg-text-dim" };

const KIND: Record<NotificationKind, { label: string; tone: string; dot: string }> = {
  fill: { label: "Trade", tone: "text-accent", dot: "bg-accent" },
  proposal: { label: "Needs you", tone: "text-warning", dot: "bg-warning" },
  breach: { label: "Breach", tone: "text-negative", dot: "bg-negative" },
  risk_hold: { label: "Risk hold", tone: "text-negative", dot: "bg-negative" },
  state_change: { label: "Status", tone: "text-text-secondary", dot: "bg-text-dim" },
  cycle: { label: "Cycle", tone: "text-text-dim", dot: "bg-text-muted" },
};

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}

function TelegramIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-4 shrink-0 ${className}`} aria-hidden>
      <path
        d="M2 7.3 13.4 2.9c.5-.2 1 .2.85.75l-1.95 9.2c-.12.55-.75.75-1.15.35L8.1 10.6l-1.6 1.55c-.3.3-.8.15-.9-.25L4.7 8.6 2.1 7.9c-.45-.12-.45-.45-.1-.6Z"
        fill="currentColor"
      />
    </svg>
  );
}
