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
import { FOCUS } from "@/components/kit";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useApi } from "@/lib/useApi";
import { compactAge } from "@/lib/format";
import { useT, type TranslationKey } from "@/lib/i18n";
import {
  applyProposal,
  getNotificationFeed,
  getTelegramStatus,
  linkTelegram,
  markNotificationsRead,
  setTelegramEnabled,
  type NotificationItem,
  type NotificationKind,
} from "@/lib/api";

/** How often the badge re-checks while the panel is closed. */
const POLL_MS = 60_000;

export function NotificationCentre() {
  const { authenticated } = usePrivy();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  // `token`, not `t` — the translator holds that name in this file.
  const feed = useApi((token) => getNotificationFeed(token, 30), [tick]);

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
      if (wrap.current && !wrap.current.contains(e.target as Node))
        setOpen(false);
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
          unread > 0 ? t("nc_aria_unread", { count: unread }) : t("nc_aria")
        }
        className={`relative flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-surface ${
          unread > 0
            ? "text-text-primary"
            : "text-text-muted hover:text-text-secondary"
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
          // Same refetch, named for the other reason to do it: an applied
          // proposal changes the agent, so the row it came from is stale.
          onActed={() => feed.reload()}
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
  onActed,
  onClose,
}: {
  items: NotificationItem[];
  loading: boolean;
  failed: string | null;
  onRead: () => void;
  onActed: () => void;
  onClose: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const t = useT();
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
      aria-label={t("nc_aria")}
      className="absolute right-0 z-40 mt-2 flex max-h-[min(70vh,560px)] w-[min(92vw,380px)] origin-top-right animate-[menu-enter_120ms_ease-out] flex-col overflow-hidden rounded-xl border border-grid bg-panel shadow-[0_20px_44px_-16px_rgba(0,0,0,0.9)]"
    >
      <div className="flex items-center justify-between border-b border-grid px-4 py-3">
        <p className="font-mono text-[11px] tracking-[0.12em] text-text-secondary uppercase">
          {t("nc_title")}
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
          <p className="px-4 py-6 font-ui text-[13px] text-negative">
            {failed}
          </p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center font-ui text-[13px] leading-relaxed text-text-dim">
            {t("nc_empty")}
          </p>
        ) : (
          items.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onNavigate={onClose}
              onActed={onActed}
            />
          ))
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
export function NotificationRow({
  n,
  onNavigate,
  onActed,
}: {
  n: NotificationItem;
  onNavigate: () => void;
  onActed: () => void;
}) {
  const t = useT();
  const kind = KIND[n.kind] ?? FALLBACK_KIND;
  // An approval can be answered here. Everything else is a report of something
  // already done, and a button on those would be a button with nothing to do.
  const approvable =
    n.kind === "proposal" && !!n.messageId && n.agentId !== null;

  const inner = (
    <>
      <span
        className={`mt-1 size-1.5 shrink-0 rounded-full ${kind.dot}`}
        aria-hidden
      />
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span
            className={`font-mono text-[10px] tracking-[0.1em] uppercase ${kind.tone}`}
          >
            {t(kind.labelKey)}
          </span>
          {n.agentName ? (
            <span className="truncate font-mono text-[11px] text-text-dim">
              {n.agentName}
            </span>
          ) : null}
          <span className="ml-auto shrink-0 font-mono text-[10px] text-text-muted">
            {compactAge(n.createdAt, t)}
          </span>
        </div>
        {/* Plain text, stripped server-side. Never markup: this table carries
            token symbols and error strings from outside the product. */}
        <p className="font-ui text-[12.5px] leading-relaxed break-words whitespace-pre-line text-text-secondary">
          {n.text}
        </p>
        {n.undeliverable ? (
          <p className="font-ui text-[11px] text-warning">
            {t("nc_undeliverable")}
          </p>
        ) : null}
        {approvable ? (
          <ApproveBar
            agentId={n.agentId!}
            messageId={n.messageId!}
            onActed={onActed}
          />
        ) : null}
      </div>
    </>
  );

  const shell = `flex gap-3 border-b border-grid px-4 py-3 last:border-b-0 ${
    n.read ? "" : "bg-surface/60"
  }`;

  // A row with its own buttons cannot also BE a link: a tap on Apply would
  // navigate as well as act, and nesting interactive elements inside an anchor
  // is invalid anyway. The approval row carries its own "Why?" link instead.
  if (n.agentId === null || approvable) {
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
 * Apply or decline, without leaving the panel.
 *
 * The decision is small and the diff is already on screen, so sending someone
 * to another page to press one button is the whole cost of the feature. "Why?"
 * stays, because the REASONING is not here — it is in the thread, and that is
 * the one thing worth navigating for.
 *
 * Declining is local. There is no decline endpoint for a thread proposal: the
 * message simply goes unapplied and settles on its own. So this dismisses the
 * bar rather than pretending to have told the agent something.
 */
function ApproveBar({
  agentId,
  messageId,
  onActed,
}: {
  agentId: number;
  messageId: string;
  onActed: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const [state, setState] = useState<
    "idle" | "applying" | "applied" | "dismissed" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const t = useT();

  if (state === "applied") {
    return (
      <p className="pt-1 font-mono text-[11px] text-accent">
        {t("nc_applied")}
      </p>
    );
  }
  if (state === "dismissed") {
    return (
      <p className="pt-1 font-mono text-[11px] text-text-dim">
        {t("nc_dismissed")}
      </p>
    );
  }

  async function apply() {
    setState("applying");
    setMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("nc_session_expired"));
      await applyProposal(token, agentId, messageId);
      setState("applied");
      // The feed's unread count and this row's state both live upstream.
      onActed();
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-1.5 pt-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setState("dismissed")}
          disabled={state === "applying"}
          className={`border border-border px-3 py-1.5 font-ui text-[12px] text-text-secondary transition-colors hover:bg-surface disabled:opacity-40 ${FOCUS}`}
        >
          {t("nc_decline")}
        </button>
        <button
          type="button"
          onClick={() => void apply()}
          disabled={state === "applying"}
          className={`bg-accent px-3.5 py-1.5 font-ui text-[12px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50 ${FOCUS}`}
        >
          {t(state === "applying" ? "nc_applying" : "nc_apply")}
        </button>
        <Link
          href={`/workspace/${agentId}`}
          className={`ml-auto font-ui text-[12px] text-text-secondary underline-offset-4 hover:underline ${FOCUS}`}
        >
          {t("nc_why")}
        </Link>
      </div>
      {state === "error" && message ? (
        <p className="font-ui text-[11px] text-negative">{message}</p>
      ) : null}
    </div>
  );
}

/**
 * Connecting Telegram, in the place where wanting it occurs to you.
 *
 * Deliberately small. The full explanation of what does and does not get sent
 * lives on the settings panel; repeating it here would bury the feed under
 * policy the reader did not open this for.
 */
export function TelegramSection() {
  const { getAccessToken } = usePrivy();
  const t = useT();
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
      <TelegramIcon
        className={linked && enabled ? "text-accent" : "text-text-muted"}
      />
      <div className="min-w-0 flex-1">
        <p className="font-ui text-[12px] text-text-secondary">
          {!linked
            ? t("nc_tg_offer")
            : enabled
              ? username
                ? t("nc_tg_sending_to", { username })
                : t("nc_tg_sending_generic")
              : t("nc_tg_muted")}
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
        {t(
          busy
            ? "nc_tg_busy"
            : !linked
              ? "nc_tg_connect"
              : enabled
                ? "nc_tg_mute"
                : "nc_tg_unmute",
        )}
      </button>
      {/* Mute was the ONLY control here, so a strip that said "Sending to
          @you" while nothing arrived offered no way out at all — not even the
          Disconnect → Connect detour the settings panel had. Shown only when
          linked, because the button beside it already says Connect otherwise.
          Titled rather than labelled at length: this strip sits inside a
          dropdown and a second full-width word would push the status text out
          of its line. */}
      {linked ? (
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy}
          title={t("nc_tg_reconnect_title")}
          className={`shrink-0 border border-border px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:border-accent hover:text-accent disabled:opacity-40 ${FOCUS}`}
        >
          {t("nc_tg_reconnect")}
        </button>
      ) : null}
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
const FALLBACK_KIND = {
  labelKey: "nc_kind_unknown" as TranslationKey,
  tone: "text-text-secondary",
  dot: "bg-text-dim",
};

const KIND: Record<
  NotificationKind,
  { labelKey: TranslationKey; tone: string; dot: string }
> = {
  fill: { labelKey: "nc_kind_fill", tone: "text-accent", dot: "bg-accent" },
  proposal: {
    labelKey: "nc_kind_proposal",
    tone: "text-warning",
    dot: "bg-warning",
  },
  breach: {
    labelKey: "nc_kind_breach",
    tone: "text-negative",
    dot: "bg-negative",
  },
  risk_hold: {
    labelKey: "nc_kind_risk_hold",
    tone: "text-negative",
    dot: "bg-negative",
  },
  state_change: {
    labelKey: "nc_kind_state_change",
    tone: "text-text-secondary",
    dot: "bg-text-dim",
  },
  cycle: {
    labelKey: "nc_kind_cycle",
    tone: "text-text-dim",
    dot: "bg-text-muted",
  },
};

// `ago` moved to lib/format as `compactAge`.

function TelegramIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-4 shrink-0 ${className}`}
      aria-hidden
    >
      <path
        d="M2 7.3 13.4 2.9c.5-.2 1 .2.85.75l-1.95 9.2c-.12.55-.75.75-1.15.35L8.1 10.6l-1.6 1.55c-.3.3-.8.15-.9-.25L4.7 8.6 2.1 7.9c-.45-.12-.45-.45-.1-.6Z"
        fill="currentColor"
      />
    </svg>
  );
}
