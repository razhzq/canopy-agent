"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { getCopyLpLog, type ActivityCycle, type ActivityPage } from "@/lib/api";
import { groupOf, logEntries, type LogEntry, type LogGroup, type LogKind } from "@/lib/copyLpLog";
import { useApi } from "@/lib/useApi";
import { useLocale, dateLocale, type Locale, type Translate, type TranslationKey } from "@/lib/i18n";
import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonLog } from "@/components/skeleton";
import { BODY, QUIET, SEGMENT_ITEM, SEGMENT_OFF, SEGMENT_ON, SEGMENT_TRACK, TxLink } from "@/components/kit";

/**
 * A copy LP agent's activity: one line per thing the mirror did.
 *
 * Replaces the cycle cards for these agents. A copy agent has no desk, no
 * screen and no model — it reads the leader's book and takes a share — so the
 * seats, the replay and the per-run status describe machinery it does not
 * have. What an owner wants is the list: what the leader did, what the copy
 * did about it, and what it cost or made.
 *
 * Polls of the leader that changed nothing are dropped server-side (`log=1`),
 * so a page is events, and "Load older" pages back by tick_seq.
 */

const PAGE = 30;
const POLL_MS = 30_000;

type Filter = "all" | Exclude<LogGroup, "other">;

const KIND_KEY: Record<LogKind, TranslationKey> = {
  opened: "clplog_kind_opened",
  added: "clplog_kind_added",
  reduced: "clplog_kind_reduced",
  reranged: "clplog_kind_reranged",
  closed: "clplog_kind_closed",
  take_profit: "clplog_kind_take_profit",
  stop_loss: "clplog_kind_stop_loss",
  skipped: "clplog_kind_skipped",
  error: "clplog_kind_error",
  started: "clplog_kind_started",
  note: "clplog_kind_note",
};

export function CopyLpLog({
  agentId,
  book,
  unit = "USD",
}: {
  agentId: number;
  book?: "paper" | "live";
  /** The book's unit. A SOL book shows each amount in SOL at its run's own rate. */
  unit?: "USD" | "SOL";
}) {
  const { t, locale } = useLocale();
  const { getAccessToken } = usePrivy();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");

  // The newest page, refreshed on a timer. Older pages are held separately so
  // a refresh never throws away what the reader paged back to.
  const head = useApi((token) => getCopyLpLog(token, agentId, { limit: PAGE, book }), [agentId, book, tick]);
  const lastHead = useRef<ActivityPage | null>(null);
  if (head.phase === "ready") lastHead.current = head.data;
  const headPage = head.phase === "ready" ? head.data : lastHead.current;

  const [older, setOlder] = useState<ActivityCycle[]>([]);
  const [olderPools, setOlderPools] = useState<Record<string, string>>({});
  const [exhausted, setExhausted] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);

  // A different agent or book is a different log.
  useEffect(() => {
    setOlder([]);
    setOlderPools({});
    setExhausted(false);
    setFilter("all");
  }, [agentId, book]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => clearInterval(id);
  }, []);

  const cycles = useMemo(() => {
    const seen = new Set<string>();
    return [...(headPage?.cycles ?? []), ...older].filter((c) =>
      seen.has(c.id) ? false : (seen.add(c.id), true),
    );
  }, [headPage, older]);

  const money = useMemo(() => amountFormat(unit), [unit]);
  const entries = useMemo(
    () =>
      logEntries(cycles, t, { strategyClass: headPage?.strategy_class, pools: { ...olderPools, ...headPage?.pools } }, (usd, rate) =>
        money(usd, rate).primary,
      ),
    [cycles, t, headPage, olderPools, money],
  );

  const counts = useMemo(() => {
    const c = { all: entries.length, trades: 0, skipped: 0, errors: 0 };
    for (const e of entries) {
      const g = groupOf(e.kind);
      if (g !== "other") c[g]++;
    }
    return c;
  }, [entries]);

  const shown = filter === "all" ? entries : entries.filter((e) => groupOf(e.kind) === filter);
  const days = useMemo(() => byDay(shown, locale, t), [shown, locale, t]);

  // Whether there could be more: the head page came back full, or the last
  // older page did.
  const canLoadOlder = !exhausted && (headPage?.cycles.length ?? 0) >= PAGE;

  async function loadOlder() {
    const oldest = cycles.reduce<string | null>(
      (min, c) => (min === null || Number(c.tick_seq) < Number(min) ? c.tick_seq : min),
      null,
    );
    if (!oldest) return;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const page = await getCopyLpLog(token, agentId, { limit: PAGE, before: oldest, book });
      setOlder((prev) => [...prev, ...page.cycles]);
      setOlderPools((prev) => ({ ...prev, ...page.pools }));
      if (page.cycles.length < PAGE) setExhausted(true);
    } catch (err) {
      setOlderError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingOlder(false);
    }
  }

  if (head.phase === "loading" && lastHead.current === null) return <SkeletonLog labelKey="loading_activity" />;
  if (head.phase === "signed-out") return <SignedOutState note={t("activity_signed_out_note")} />;
  if (head.phase === "error" && lastHead.current === null)
    return <ErrorState message={head.message} onRetry={head.reload} />;

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-grid bg-panel px-5 py-12 text-center sm:px-8">
        <p className="font-ui text-[14px] font-medium text-text-primary">{t("clplog_empty_title")}</p>
        <p className={`max-w-[48ch] ${BODY}`}>{t("clplog_empty_body")}</p>
      </div>
    );
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("clplog_filter_all"), count: counts.all },
    { key: "trades", label: t("clplog_filter_trades"), count: counts.trades },
    { key: "skipped", label: t("clplog_filter_skipped"), count: counts.skipped },
    { key: "errors", label: t("clplog_filter_errors"), count: counts.errors },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className={BODY}>{t("clplog_subtitle")}</p>
        <div role="group" aria-label={t("clplog_filter_aria")} className={SEGMENT_TRACK}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`${SEGMENT_ITEM} h-7 gap-1.5 px-3 text-[12px] ${filter === f.key ? SEGMENT_ON : SEGMENT_OFF}`}
            >
              {f.label}
              <span className="tnum font-mono text-[10.5px] text-text-dim">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className={`py-8 text-center ${BODY}`}>{t("clplog_filter_empty")}</p>
      ) : (
        <div>
          {/* Column heads, desktop only: on a phone each row stacks and names itself. */}
          <div className="hidden grid-cols-[64px_112px_120px_minmax(0,1fr)_150px_16px] gap-5 border-b border-grid pb-2.5 md:grid">
            {[
              t("clplog_col_time"),
              t("clplog_col_event"),
              t("clplog_col_pool"),
              t("clplog_col_details"),
            ].map((h) => (
              <span key={h} className="font-ui text-[11.5px] text-text-muted">
                {h}
              </span>
            ))}
            <span className="text-right font-ui text-[11.5px] text-text-muted">{t("clplog_col_amount")}</span>
            <span />
          </div>

          {days.map((day) => (
            <section key={day.key}>
              <h4 className="pt-5 pb-2 font-ui text-[12.5px] font-medium text-text-primary">{day.label}</h4>
              <ol>
                {day.entries.map((e) => (
                  <Row key={e.key} entry={e} money={money} locale={locale} t={t} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {canLoadOlder ? (
        <div className="flex flex-col items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => void loadOlder()}
            disabled={loadingOlder}
            className="h-8 rounded-full border border-grid px-4 font-ui text-[12.5px] font-medium text-text-primary transition-colors hover:bg-panel disabled:opacity-50"
          >
            {loadingOlder ? t("clplog_loading_older") : t("clplog_load_older")}
          </button>
          {olderError ? <p className="font-ui text-[12px] text-negative">{olderError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function Row({
  entry: e,
  money,
  locale,
  t,
}: {
  entry: LogEntry;
  money: ReturnType<typeof amountFormat>;
  locale: Locale;
  t: Translate;
}) {
  const time = new Date(e.at).toLocaleTimeString(dateLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const amount = e.amount ? money(e.amount.usd, e.usdPerSol, e.amount.role === "pnl") : null;
  const tone =
    e.amount?.role === "pnl"
      ? e.amount.usd >= 0
        ? "text-accent"
        : "text-negative"
      : "text-text-primary";
  const quiet = e.kind === "skipped" || e.kind === "started";

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-grid py-3.5 md:grid-cols-[64px_112px_120px_minmax(0,1fr)_150px_16px] md:items-center md:gap-5">
      <span className="tnum font-mono text-[12px] text-text-dim">{time}</span>
      <span className={`font-ui text-[13px] font-medium ${quiet ? "text-text-secondary" : "text-text-primary"}`}>
        {t(KIND_KEY[e.kind])}
      </span>
      <span
        className={`col-start-3 row-start-1 text-right font-mono text-[12.5px] md:col-auto md:row-auto md:text-left ${
          e.pool ? "text-text-primary" : "text-text-dim"
        }`}
      >
        {e.pool ?? "—"}
      </span>
      <div className="col-span-3 space-y-1 md:col-span-1">
        <p
          className={`font-ui text-[13px] leading-relaxed ${
            e.kind === "error" ? "text-negative" : "text-text-secondary"
          }`}
        >
          {e.detail}
        </p>
        {/* SEVERAL TRANSACTIONS, EACH ONE NAMED. An open that bought its
            tokens first is two or three transactions, a rerange four or more;
            the arrow on the right can only point at one of them. On a phone,
            where that column is hidden, even a single one is listed here. */}
        {e.txSignatures.length > 0 ? (
          <p
            className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${
              e.txSignatures.length === 1 ? "md:hidden" : ""
            }`}
          >
            <span className="font-ui text-[11px] text-text-dim">
              {e.txSignatures.length === 1
                ? t("clplog_tx_one")
                : t("clplog_tx_many", { count: e.txSignatures.length })}
            </span>
            {e.txSignatures.map((sig) => (
              <TxLink key={sig} signature={sig} label={`${sig.slice(0, 4)}…${sig.slice(-4)}`} size="caption" />
            ))}
          </p>
        ) : null}
      </div>
      <div className="col-span-3 flex items-baseline gap-2 md:col-span-1 md:flex-col md:items-end md:gap-0.5">
        {amount ? (
          <>
            <span className={`tnum font-mono text-[13px] ${tone}`}>
              {e.amount?.role === "in" ? t("clplog_amount_in", { amount: amount.primary }) : amount.primary}
            </span>
            {amount.secondary || e.feesUsd ? (
              <span className="tnum font-mono text-[11px] text-text-dim">
                {[amount.secondary, e.feesUsd ? t("clplog_fees", { fees: usdText(e.feesUsd) }) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : null}
          </>
        ) : (
          <span className="font-mono text-[13px] text-text-dim md:text-right">—</span>
        )}
      </div>
      <span className="hidden md:block">
        {e.txSignatures.length === 1 ? (
          <a
            href={`https://solscan.io/tx/${e.txSignatures[0]}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("clplog_view_tx")}
            className={QUIET}
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </a>
        ) : null}
      </span>
    </li>
  );
}

/* ---------------------------------------------------------------- helpers -- */

function usdText(n: number): string {
  const a = Math.abs(n);
  return `$${a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function solText(n: number): string {
  const a = Math.abs(n);
  return `${a.toLocaleString("en-US", { maximumFractionDigits: a < 1 ? 4 : 3 })} SOL`;
}

/**
 * How an amount reads in this book. A SOL book shows SOL first, converted at
 * the rate recorded on the run it happened in, with the dollars beneath; with
 * no recorded rate it shows the dollars that were recorded rather than divide
 * by a rate from some other moment.
 */
function amountFormat(unit: "USD" | "SOL") {
  return (usd: number, usdPerSol: number | null, signed = false): { primary: string; secondary: string | null } => {
    const sign = (s: string) => (!signed ? s : usd < 0 ? `−${s}` : `+${s}`);
    if (unit === "SOL" && usdPerSol && usdPerSol > 0) {
      return { primary: sign(solText(usd / usdPerSol)), secondary: sign(usdText(usd)) };
    }
    return { primary: sign(usdText(usd)), secondary: null };
  };
}

/** Entries grouped by local calendar day, newest day first. */
function byDay(entries: LogEntry[], locale: Locale, t: Translate) {
  const loc = dateLocale(locale);
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const groups: { key: string; label: string; entries: LogEntry[] }[] = [];
  for (const e of entries) {
    const d = new Date(e.at);
    const key = dayKey(d);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      const date = d.toLocaleDateString(loc, { month: "short", day: "numeric" });
      const label =
        key === dayKey(today)
          ? t("clplog_day_today", { date })
          : key === dayKey(yesterday)
            ? t("clplog_day_yesterday", { date })
            : date;
      g = { key, label, entries: [] };
      groups.push(g);
    }
    g.entries.push(e);
  }
  return groups;
}
