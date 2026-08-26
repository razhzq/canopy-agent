"use client";

import { useCallback, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import {
  NotificationRow,
  TelegramSection,
  useSeenRows,
} from "@/components/notificationCentre";
import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonRows } from "@/components/skeleton";
import {
  getNotificationFeed,
  markNotificationsRead,
  type NotificationItem,
  type NotificationKind,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useT, type TranslationKey } from "@/lib/i18n";

/**
 * The notification centre, as a page.
 *
 * The dropdown in the top bar is a desktop affordance: it hangs off a bell a
 * thumb never reaches, and it is capped at a panel's height. On a phone this is
 * a destination — the wireframe gives it a tab — so it gets a route, and the
 * approvals in it get room to carry their diff and their buttons.
 *
 * SAME ROWS, SAME FEED. `NotificationRow` is the dropdown's row, exported
 * rather than reimplemented, so an approval looks and behaves identically
 * wherever you meet it.
 */

const FILTERS = [
  { key: "all", labelKey: "nc_filter_all" as TranslationKey, kinds: null },
  {
    key: "needs",
    labelKey: "nc_filter_needs" as TranslationKey,
    kinds: ["proposal"],
  },
  {
    key: "trades",
    labelKey: "nc_filter_trades" as TranslationKey,
    kinds: ["fill"],
  },
  {
    key: "risk",
    labelKey: "nc_filter_risk" as TranslationKey,
    kinds: ["breach", "risk_hold"],
  },
] as const;

export function NotificationsPage() {
  const t = useT();
  const { getAccessToken } = usePrivy();
  const feed = useApi((token) => getNotificationFeed(token, 60));
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  /**
   * READING IS WHAT MARKS THEM READ.
   *
   * This page marked nothing at all: a visitor could scroll the whole history
   * and the bell would still claim every row was new, because the only thing
   * that ever cleared the count was opening the dropdown. Same rule as the
   * dropdown now — a row is read once it has been on screen long enough to
   * have been read, and rows further down the page stay unread until the
   * reader actually gets to them.
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
          // A count that stays lit beats an error over what they came to read.
        }
      })();
    },
    [getAccessToken],
  );
  const rowRef = useSeenRows(onSeen);

  const items: NotificationItem[] =
    feed.phase === "ready" ? feed.data.items : [];
  // Against the server's own count, so nothing is subtracted twice.
  const pending = items.filter((i) => !i.read && readHere.has(i.id)).length;
  const unread = Math.max(
    0,
    (feed.phase === "ready" ? feed.data.unread : 0) - pending,
  );
  const needs = items.filter((n) => n.kind === "proposal").length;

  const shown = useMemo(() => {
    const spec = FILTERS.find((f) => f.key === filter);
    if (!spec?.kinds) return items;
    const kinds = new Set<NotificationKind>(
      spec.kinds as readonly NotificationKind[],
    );
    return items.filter((n) => kinds.has(n.kind));
  }, [items, filter]);

  if (feed.phase === "loading")
    return (
      <SkeletonRows
        labelKey="loading_notifications"
        cols="minmax(0,1fr) 60px"
      />
    );
  if (feed.phase === "signed-out") return <SignedOutState />;
  if (feed.phase === "error")
    return <ErrorState message={feed.message} onRetry={feed.reload} />;

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto border-b border-grid px-5 py-3 sm:px-8">
        {FILTERS.map((f) => {
          const on = filter === f.key;
          const count = f.key === "needs" ? needs : 0;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={on}
              className={`flex shrink-0 items-center gap-1.5 rounded-[9px] border px-3.5 py-1.5 font-ui text-[13px] transition-colors ${
                on
                  ? "border-border bg-surface-2 font-semibold text-text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {t(f.labelKey)}
              {count > 0 ? (
                <span className="font-mono text-[10px] font-bold text-warning">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="px-5 py-12 text-center font-ui text-[13px] leading-relaxed text-text-dim sm:px-8">
          {t(items.length === 0 ? "nc_empty_page" : "nc_empty_filter")}
        </p>
      ) : (
        <div>
          {shown.map((n) => {
            const read = n.read || readHere.has(n.id);
            return (
              <NotificationRow
                key={n.id}
                n={read === n.read ? n : { ...n, read }}
                seenRef={read ? undefined : rowRef(n.id)}
                onNavigate={() => undefined}
                onActed={() => feed.reload()}
              />
            );
          })}
        </div>
      )}

      {unread > 0 ? (
        <p className="px-5 pt-4 font-mono text-[9.5px] tracking-[0.08em] text-text-dim uppercase sm:px-8">
          {t("nc_unread", { count: unread })}
        </p>
      ) : null}

      <TelegramSection />
    </div>
  );
}
