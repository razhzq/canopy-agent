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
import { compactAge, tokenPrice, tokenQty, usd } from "@/lib/format";
import { useT, type TranslationKey } from "@/lib/i18n";
import {
  applyProposal,
  getNotificationFeed,
  getTelegramStatus,
  linkTelegram,
  markNotificationsRead,
  setTelegramEnabled,
  type FillPayload,
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
export function useSeenRows(
  onSeen: (ids: string[]) => void,
  /**
   * The scrolling element the rows live in.
   *
   * Used as the observer's root, which the viewport was standing in for. It
   * works either way for "is this visible", but only a real root gives
   * `rootBounds` in the panel's own coordinates — and that is what makes
   * "scrolled off the top" answerable below.
   */
  rootRef?: { current: Element | null },
) {
  const pending = useRef(new Set<string>());
  const dwell = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /**
   * Rows that have been on screen at all, however briefly.
   *
   * The dwell timer answers "did they stop on it". This answers the other way a
   * notification gets read: you scan it as it passes and keep going. Without
   * the distinction, a row that was never reached and a row the reader went
   * PAST are treated identically — and the second one is the common case, so
   * the badge sat unchanged through exactly the gesture that clears a list.
   */
  const grazed = useRef(new Set<string>());
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
          const mark = () => {
            pending.current.add(id);
            if (flush.current) clearTimeout(flush.current);
            flush.current = setTimeout(send, FLUSH_MS);
          };

          if (e.isIntersecting) {
            grazed.current.add(id);
            if (dwell.current.has(id)) continue;
            dwell.current.set(
              id,
              setTimeout(() => {
                dwell.current.delete(id);
                mark();
              }, SEEN_MS),
            );
          } else {
            const timer = dwell.current.get(id);
            if (timer) {
              clearTimeout(timer);
              dwell.current.delete(id);
            }
            // GONE OFF THE TOP IS READ. The reader was shown it and moved
            // beyond it, which is what reading a list of notifications looks
            // like — nobody rests on each line for most of a second.
            //
            // Off the BOTTOM is not: that is a row scrolled away from, either
            // by going back up or because it never came into view in the first
            // place. `grazed` is what separates the two, since a row that was
            // never visible cannot have been passed.
            const above =
              e.rootBounds !== null &&
              e.boundingClientRect.bottom <= e.rootBounds.top + 1;
            if (above && grazed.current.has(id)) mark();
          }
        }
      },
      // A real root, so `rootBounds` describes the panel rather than the window.
      // Null falls back to the viewport, which is what this always used.
      { root: rootRef?.current ?? null, threshold: SEEN_RATIO },
    );
    observer.current = io;
    // Everything that registered during the commit that preceded this effect.
    for (const el of byEl.current.keys()) io.observe(el);

    const dwelling = dwell.current;
    const grazedNow = grazed.current;
    return () => {
      io.disconnect();
      observer.current = null;
      for (const timer of dwelling.values()) clearTimeout(timer);
      dwelling.clear();
      grazedNow.clear();
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
        } catch (err) {
          // Still no toast — a badge that stays lit is a far smaller problem
          // than an error over a panel opened to read something else. But it is
          // no longer INVISIBLE: this had been failing on every scroll since
          // August and left no trace anywhere to say so.
          if (process.env.NODE_ENV !== "production") {
            console.warn("[notifications] could not mark rows read", err);
          }
        }
      })();
    },
    [getAccessToken],
  );

  /**
   * Clear the lot, on purpose.
   *
   * The automatic path marks what was actually looked at, which is the right
   * default and is also, by design, conservative — it will leave rows lit that
   * the reader considers dealt with. This is the other half: an explicit "I am
   * done with these", which needs no inference and cannot be wrong about what
   * someone saw, because they said so.
   *
   * Marks EVERY unread row, not just the page on screen. A button that empties
   * the visible list and leaves the badge at 12 has not done what it says.
   */
  const [clearing, setClearing] = useState(false);
  /**
   * Why the last clear did not happen.
   *
   * IT USED TO BE SWALLOWED, and swallowing it was the bug behind the bug: a
   * button that fails silently is indistinguishable from one that is not wired
   * up, so a broken request looked like a broken button and there was nothing
   * on screen or in the console to say which. "Nothing was lost" was true and
   * beside the point — the reader pressed a thing and it did not do what it
   * says, and that is worth a sentence.
   */
  const [clearFailed, setClearFailed] = useState<string | null>(null);

  const markAll = useCallback(async () => {
    if (clearing) return;
    setClearing(true);
    setClearFailed(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("not signed in");
      await markNotificationsRead(token, { all: true });
      // The server is the count now, so re-read rather than book-keeping it
      // locally — this is the one interaction where the list changing under
      // the cursor is exactly what was asked for.
      feed.reload();
    } catch (err) {
      setClearFailed(err instanceof Error ? err.message : String(err));
      if (process.env.NODE_ENV !== "production") {
        console.warn("[notifications] mark all read failed", err);
      }
    } finally {
      setClearing(false);
    }
  }, [clearing, feed, getAccessToken]);

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
        className={`relative flex size-10 items-center justify-center rounded-full border border-border transition-colors hover:border-grid-strong ${
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
          onMarkAll={unread > 0 ? markAll : undefined}
          clearing={clearing}
          clearFailed={clearFailed}
          waiting={feed.phase === "ready" ? (feed.data.waiting ?? 0) : 0}
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
  onMarkAll,
  clearing,
  clearFailed,
  waiting,
}: {
  items: NotificationItem[];
  readHere: ReadonlySet<string>;
  onSeen: (ids: string[]) => void;
  loading: boolean;
  failed: string | null;
  onActed: () => void;
  onClose: () => void;
  /** Absent when there is nothing unread — the control has nothing to do. */
  onMarkAll?: () => void;
  clearing: boolean;
  /** The last clear's failure, shown beside the control that caused it. */
  clearFailed?: string | null;
  /** Outstanding decisions, for the tab's own count. */
  waiting: number;
}) {
  const t = useT();
  // The list scrolls, not the page. Without this the observer measured against
  // the window and could not tell a row that had gone off the top of the PANEL
  // from one merely above the fold.
  const list = useRef<HTMLDivElement | null>(null);
  const rowRef = useSeenRows(onSeen, list);

  /**
   * Opens on the queue when there IS one.
   *
   * A list sorted by time buries the one thing that is waiting on you under
   * everything that merely happened, and an approval is the only row here that
   * goes stale by being ignored. When nothing is waiting there is nothing to
   * privilege, and the full list is the honest default.
   */
  const [tab, setTab] = useState<FeedTab>(waiting > 0 ? "waiting" : "all");
  const shown = items.filter((n) => inTab(n, tab));

  return (
    <div
      role="dialog"
      aria-label={t("nc_aria")}
      className="absolute right-0 z-40 mt-2.5 flex max-h-[min(70vh,560px)] w-[min(92vw,392px)] origin-top-right animate-[menu-enter_120ms_ease-out] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_20px_44px_-16px_rgba(0,0,0,0.9)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-grid px-4 py-3.5">
        <p className="font-ui text-[14px] font-medium text-text-primary">
          {t("nc_title")}
        </p>
        {/* Quiet, and only while it has something to clear. A permanent
            "mark all read" over an empty list is a control that spends its
            prominence saying no. */}
        {onMarkAll ? (
          <button
            type="button"
            onClick={onMarkAll}
            disabled={clearing}
            title={clearFailed ?? undefined}
            className={`shrink-0 rounded font-ui text-[12px] transition-colors disabled:opacity-50 ${FOCUS} ${
              clearFailed
                ? "text-negative hover:text-negative"
                : "text-text-dim hover:text-text-primary"
            }`}
          >
            {clearing
              ? t("nc_marking_all")
              : clearFailed
                ? t("nc_mark_all_failed")
                : t("nc_mark_all")}
          </button>
        ) : null}
      </div>

      {/* One row of tabs, under the title and above the scroll. Outside the
          scrolling element on purpose: a filter that scrolls away is one the
          reader cannot get back to without scrolling up first. */}
      <div className="flex items-center gap-1 border-b border-grid px-3 py-2">
        {TABS.map((x) => {
          const on = tab === x.key;
          const count = x.key === "waiting" ? waiting : 0;
          return (
            <button
              key={x.key}
              type="button"
              onClick={() => setTab(x.key)}
              aria-pressed={on}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 font-ui text-[12.5px] font-medium transition-colors ${FOCUS} ${
                on
                  ? "bg-surface-2 text-text-primary"
                  : "text-text-dim hover:text-text-primary"
              }`}
            >
              {t(x.labelKey)}
              {/* Only the queue carries a number. "3 fills" is trivia; three
                  decisions nobody has made is the reason to open this. */}
              {count > 0 ? (
                <span
                  className={`tnum font-mono text-[12px] ${on ? "text-accent" : "text-text-secondary"}`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div ref={list} className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-4" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : failed ? (
          <p className="px-4 py-6 font-ui text-[13px] text-negative">
            {failed}
          </p>
        ) : shown.length === 0 ? (
          <p className="px-4 py-8 text-center font-ui text-[13px] leading-relaxed text-text-dim">
            {/* An empty TAB and an empty feed are different facts. "Nothing
                here yet" under a filter reads as "you have no notifications",
                which is wrong and sends people looking for a bug. */}
            {t(
              items.length === 0
                ? "nc_empty"
                : tab === "waiting"
                  ? "nc_empty_waiting"
                  : "nc_empty_trades",
            )}
          </p>
        ) : (
          shown.map((n) => {
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
 * A fill, laid out rather than recounted.
 *
 * THE SAME FACTS THE SENTENCE WAS BUILT FROM. `text` still arrives and is still
 * the authority; it is just written for a chat client, and a chat client has no
 * columns — so it leans on bold and separators that the app strips on the way
 * in, leaving "alpha_hunter bought BONK $100.00 · 1,234 @ $0.000081" as one
 * flat line of prose. Every other number in this product gets a position and a
 * weight. This gives these theirs.
 *
 * Money and price go through the same helpers the positions table uses, so a
 * memecoin at $0.00005835 renders as a price rather than as "$0.00" — and the
 * two surfaces cannot round the same token differently.
 */
function FillBody({ fill }: { fill: FillPayload }) {
  const t = useT();
  const pnl = fill.realizedPnlUsd;
  const pct =
    pnl !== undefined && fill.costBasisUsd && fill.costBasisUsd > 0
      ? (pnl / fill.costBasisUsd) * 100
      : null;

  return (
    <div className="space-y-1">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-[12.5px] text-text-primary">
          {t(SIDE_KEY[fill.side])}
        </span>
        <span className="font-mono text-[12.5px] text-text-primary">
          {fill.symbol}
        </span>
        {/* A paper fill mistaken for a real one is the most alarming way this
            row can be misread, so the tag rides with the symbol rather than
            waiting at the end of a line. */}
        {fill.isPaper ? (
          <span className="font-ui text-[11px] text-text-muted">
            {t("nc_fill_paper")}
          </span>
        ) : null}
      </p>

      <p className="tnum font-mono text-[11.5px] text-text-dim">
        {usd(fill.filledUsd)} · {tokenQty(fill.qty, fill.priceUsd)} @{" "}
        {tokenPrice(fill.priceUsd).display}
      </p>

      {pnl !== undefined ? (
        <p
          className={`tnum font-mono text-[11.5px] ${
            pnl >= 0 ? "text-accent" : "text-negative"
          }`}
        >
          {t("nc_fill_realised")} {usd(pnl, { sign: true })}
          {pct === null
            ? ""
            : ` (${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%)`}
        </p>
      ) : null}

      {fill.reason ? (
        <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">
          {fill.reason}
        </p>
      ) : null}
    </div>
  );
}

/** The verb, in the reader's language rather than the engine's. */
const SIDE_KEY: Record<FillPayload["side"], TranslationKey> = {
  buy: "nc_fill_bought",
  sell: "nc_fill_sold",
  add_liquidity: "nc_fill_added",
  remove_liquidity: "nc_fill_removed",
};

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
    n.kind === "proposal" &&
    !!n.messageId &&
    n.agentId !== null &&
    // An approved proposal keeps its messageId forever, so without this the
    // Apply button outlived the decision it was offering.
    n.actionable !== false;

  const inner = (
    <>
      <span
        className={`mt-1 size-1.5 shrink-0 rounded-full ${kind.dot}`}
        aria-hidden
      />
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span
            className={`font-ui text-[12px] font-medium ${kind.tone}`}
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
        {/* The figures where there are figures, the sentence where there are
            not. See FillBody — `text` is composed for Telegram and reads like
            it when the markup is stripped out of it. */}
        {n.kind === "fill" && n.payload ? (
          <FillBody fill={n.payload} />
        ) : (
          /* Plain text, stripped server-side. Never markup: this table carries
             token symbols and error strings from outside the product. */
          <p className="font-ui text-[12.5px] leading-relaxed break-words whitespace-pre-line text-text-secondary">
            {n.text}
          </p>
        )}
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

  const shell = `flex gap-3 border-b border-grid px-4 py-3.5 last:border-b-0 ${
    n.read ? "" : "bg-surface-2/50"
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
      className={`${shell} text-left transition-colors hover:bg-surface-2 ${FOCUS}`}
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
      <p className="pt-1 font-ui text-[12px] font-medium text-accent">
        {t("nc_applied")}
      </p>
    );
  }
  if (state === "dismissed") {
    return (
      <p className="pt-1 font-ui text-[12px] text-text-dim">
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
          className={`h-8 rounded-full border border-border px-3.5 font-ui text-[12.5px] font-medium text-text-primary transition-colors hover:border-grid-strong disabled:opacity-40 ${FOCUS}`}
        >
          {t("nc_decline")}
        </button>
        <button
          type="button"
          onClick={() => void apply()}
          disabled={state === "applying"}
          className={`h-8 rounded-full bg-white px-4 font-ui text-[12.5px] font-medium text-bg transition-transform hover:-translate-y-px disabled:opacity-50 ${FOCUS}`}
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
    <div className="flex items-center gap-3 border-t border-grid px-4 py-3">
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
        className={`h-8 shrink-0 rounded-full px-3.5 font-ui text-[12px] font-medium transition-colors disabled:opacity-40 ${
          linked
            ? "border border-border text-text-secondary hover:border-grid-strong hover:text-text-primary"
            : "bg-white text-bg hover:-translate-y-px"
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
          className={`h-8 shrink-0 rounded-full border border-border px-3 font-ui text-[12px] text-text-secondary transition-colors hover:border-grid-strong hover:text-text-primary disabled:opacity-40 ${FOCUS}`}
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

/**
 * The two questions a notification list gets asked, and the pile that is
 * neither.
 *
 * APPROVALS IS NOT A KIND, IT IS A STATE. Filtering on `kind === "proposal"`
 * would show every proposal ever made, decided or not — and the point of the
 * tab is the queue, which empties by acting rather than by reading. It filters
 * on `actionable`, which also catches the requires-action messages the safety
 * monitor raises under other kinds.
 *
 * ALL EXISTS BECAUSE SOMETHING HAS TO HOLD THE REST. A drawdown breach is not
 * a trade and not an approval, and it is the most important line in the list.
 * Two tabs alone would have hidden it.
 */
const TABS = [
  { key: "all" as const, labelKey: "nc_tab_all" as TranslationKey },
  { key: "waiting" as const, labelKey: "nc_tab_approvals" as TranslationKey },
  { key: "trades" as const, labelKey: "nc_tab_trades" as TranslationKey },
];

type FeedTab = (typeof TABS)[number]["key"];

function inTab(n: NotificationItem, tab: FeedTab): boolean {
  if (tab === "all") return true;
  if (tab === "waiting") return n.actionable === true;
  return n.kind === "fill";
}

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
