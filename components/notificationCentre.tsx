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
// UNREAD IS BOUNDED BY WHAT WAS SEEN.
//
// Opening the panel used to mark everything down to the oldest row read, which
// is a claim about rows nobody reached: open the bell, read the top line, close
// it, and a month of history was "read". Now a row is marked when it has been
// ON SCREEN, mostly visible, for long enough to have been read — so the badge
// counts down by what the reader actually got through, and what they scrolled
// past in a hurry stays lit. A notification that lands while the panel is open
// is never in the set, because nobody has seen it yet.

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

/** How much of a row must be showing before it counts as on screen. */
const SEEN_RATIO = 0.75;

/**
 * How long it must stay there.
 *
 * A row that flashes past under a fast scroll was not read, and marking it
 * would quietly eat the notification. Long enough to rule that out, short
 * enough that a reader who stops on a row does not have to wait for it.
 */
const SEEN_MS = 800;

/** Quiet time before the seen rows are sent, so a scroll makes one request. */
const FLUSH_MS = 700;

/**
 * Marks rows read once they have actually been looked at.
 *
 * Returns a ref callback to hang on each UNREAD row. The row is watched, and
 * after {@link SEEN_MS} of being {@link SEEN_RATIO} visible it joins a batch
 * that is flushed on a short debounce — one request per scroll, not one per
 * row. Anything still pending when the panel closes is flushed on unmount:
 * the reader saw it, and the fact that they closed the panel afterwards does
 * not unsee it.
 *
 * No IntersectionObserver (an old browser, a test environment) means no way to
 * tell what was on screen, so nothing is marked. A badge that stays lit is a
 * far better failure than one that clears rows the reader never saw.
 */
export function useSeenRows(onSeen: (ids: string[]) => void) {
  const pending = useRef(new Set<string>());
  const dwell = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const flush = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  /**
   * Every row currently on the page, both ways round.
   *
   * REGISTERED BEFORE THE OBSERVER EXISTS. React runs ref callbacks during
   * commit and effects afterwards, so on the first render every row registers
   * while `observer.current` is still null. An earlier version returned early
   * in that case and therefore watched nothing at all, ever: the panel opened,
   * the reader scrolled, and not one row was marked. So rows go in the
   * registry unconditionally and the observer picks up whatever is already
   * there when it is built.
   *
   * Keyed both ways because a ref callback tears down with `null` and no id —
   * the id→element half is what makes an unmounting row identifiable.
   */
  const byId = useRef(new Map<string, Element>());
  const byEl = useRef(new Map<Element, string>());

  // In a ref so the observer, which is built once, always calls the CURRENT
  // callback rather than the one that existed when the panel opened.
  const sink = useRef(onSeen);
  sink.current = onSeen;

  const send = useCallback(() => {
    if (flush.current) {
      clearTimeout(flush.current);
      flush.current = null;
    }
    if (pending.current.size === 0) return;
    const batch = [...pending.current];
    pending.current.clear();
    sink.current(batch);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = byEl.current.get(e.target);
          if (!id) continue;
          if (e.isIntersecting) {
            if (dwell.current.has(id)) continue;
            dwell.current.set(
              id,
              setTimeout(() => {
                dwell.current.delete(id);
                pending.current.add(id);
                if (flush.current) clearTimeout(flush.current);
                flush.current = setTimeout(send, FLUSH_MS);
              }, SEEN_MS),
            );
          } else {
            // Left before it was read. Not seen, and not marked.
            const timer = dwell.current.get(id);
            if (timer) {
              clearTimeout(timer);
              dwell.current.delete(id);
            }
          }
        }
      },
      { threshold: SEEN_RATIO },
    );
    observer.current = io;
    // Everything that registered during the commit that preceded this effect.
    for (const el of byEl.current.keys()) io.observe(el);

    const dwelling = dwell.current;
    return () => {
      io.disconnect();
      observer.current = null;
      for (const timer of dwelling.values()) clearTimeout(timer);
      dwelling.clear();
      // Whatever was seen but not yet sent still counts.
      send();
    };
  }, [send]);

  /**
   * The ref callback for one row, MEMOISED PER ID.
   *
   * A fresh arrow per render would make React detach and re-attach every row
   * on every render — and each detach clears that row's dwell timer, so a
   * reader who stops on a row while anything upstream re-renders never
   * accumulates the time that marks it read. One stable callback per id, and
   * a render is invisible to the observer.
   */
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());

  const attach = useCallback((el: HTMLElement | null, id: string) => {
    if (el === null) {
      // The row went away — a filter changed, or it is now read.
      const prev = byId.current.get(id);
      if (prev) {
        observer.current?.unobserve(prev);
        byEl.current.delete(prev);
        byId.current.delete(id);
      }
      const timer = dwell.current.get(id);
      if (timer) {
        clearTimeout(timer);
        dwell.current.delete(id);
      }
      return;
    }
    if (byId.current.get(id) === el) return;
    byId.current.set(id, el);
    byEl.current.set(el, id);
    // Null until the effect above runs, which is exactly why the registry
    // exists — the observer will sweep it up when it is built.
    observer.current?.observe(el);
  }, []);

  return useCallback(
    (id: string) => {
      const held = refs.current.get(id);
      if (held) return held;
      const made = (el: HTMLElement | null) => attach(el, id);
      refs.current.set(id, made);
      return made;
    },
    [attach],
  );
}

export function NotificationCentre() {
  const { authenticated, getAccessToken } = usePrivy();
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

  const items = feed.phase === "ready" ? feed.data.items : [];

  /**
   * Rows marked read in this session, counted off the badge locally.
   *
   * NOT a refetch. Reloading the feed to learn a number the client already
   * knows would blank the list under the cursor while someone is reading it —
   * the poll reconciles with the server soon enough, and until then the badge
   * and the rows agree with what was just seen.
   */
  const [readHere, setReadHere] = useState<ReadonlySet<string>>(new Set());

  const onSeen = useCallback(
    (ids: string[]) => {
      setReadHere((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
      void (async () => {
        try {
          const token = await getAccessToken();
          if (!token) return;
          await markNotificationsRead(token, { ids });
        } catch {
          // A badge that stays lit is a far smaller problem than an error
          // toast over a panel the user opened to read something else.
        }
      })();
    },
    [getAccessToken],
  );

  // Counted against what the SERVER still calls unread, so a row cannot be
  // subtracted twice once the poll brings back its read state.
  const pending = items.filter((i) => !i.read && readHere.has(i.id)).length;
  const unread = Math.max(
    0,
    (feed.phase === "ready" ? feed.data.unread : 0) - pending,
  );

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
          readHere={readHere}
          onSeen={onSeen}
          loading={feed.phase === "loading"}
          failed={feed.phase === "error" ? feed.message : null}
          // An applied proposal changes the agent, so the row it came from is
          // stale — that one IS worth a refetch.
          onActed={() => feed.reload()}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function Panel({
  items,
  readHere,
  onSeen,
  loading,
  failed,
  onActed,
  onClose,
}: {
  items: NotificationItem[];
  readHere: ReadonlySet<string>;
  onSeen: (ids: string[]) => void;
  loading: boolean;
  failed: string | null;
  onActed: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const rowRef = useSeenRows(onSeen);

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
          items.map((n) => {
            const read = n.read || readHere.has(n.id);
            return (
              <NotificationRow
                key={n.id}
                n={read === n.read ? n : { ...n, read }}
                // Only what is still unread is worth watching.
                seenRef={read ? undefined : rowRef(n.id)}
                onNavigate={onClose}
                onActed={onActed}
              />
            );
          })
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
  seenRef,
  onNavigate,
  onActed,
}: {
  n: NotificationItem;
  /**
   * Hung on the row so the centre can tell when it was actually on screen.
   * Absent on a row that is already read — there is nothing left to watch for.
   */
  seenRef?: (el: HTMLElement | null) => void;
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
    return (
      <article ref={seenRef} className={shell}>
        {inner}
      </article>
    );
  }

  return (
    <Link
      ref={seenRef}
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
