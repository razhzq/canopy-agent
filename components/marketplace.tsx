"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { EquityCurve } from "@/components/charts";
import { EmptyState, ErrorState, SignedOutState } from "@/components/states";
import { SkeletonCards } from "@/components/skeleton";
import { CapabilityNotices } from "@/components/capabilityNotice";
import { ModelBadge } from "@/components/modelBadge";
import { HomeFeed } from "@/components/homeFeed";
import { FOCUS } from "@/components/kit";
import { listStrategies, num, return30dPct, type StrategyRow } from "@/lib/api";
import { useApi, type LoadState } from "@/lib/useApi";
import { useT, type TranslationKey } from "@/lib/i18n";

/**
 * The agent marketplace, to DESIGN_PRINCIPLES.md.
 *
 * One page header, one stat rail, one control row, one grid of identical
 * cards. Each card is the principles' marketplace card: name and tags, the
 * record agent's own equity curve, then a mono stat grid. The only colour on
 * the page is the return figure and the curve, which are signals, plus the
 * Hot and Listed tags.
 *
 * TRACK RECORD ONLY
 *
 * Nothing here exposes how an agent decides — no rules, no universe, no
 * thresholds. A marketplace where the strategy is visible is one where the
 * strategy is copyable, and nobody would list a good one.
 *
 * Every figure is measured, and the ones that cannot be are absent rather than
 * invented. The curve is the record agent's own equity readings.
 *
 * `Marketplace` fetches; `MarketplaceView` draws. The split is what lets the
 * dev preview route render the page with fixture rows and no session.
 */

/**
 * A TAB IS A PREDICATE, NOT A STATUS. Paper is two statuses: a `draft` with an
 * agent running on it and a `verifying` one are both paper records that
 * cannot be deployed. No "delisted" tab, because no delisted strategy reaches
 * this page.
 */
type Tab = "all" | "published" | "paper";
type Sort = "return" | "newest" | "capital" | "users";

const TABS: {
  key: Tab;
  labelKey: TranslationKey;
  admits: (r: StrategyRow) => boolean;
}[] = [
  { key: "all", labelKey: "market_tab_all", admits: () => true },
  { key: "published", labelKey: "market_tab_listed", admits: (r) => r.status === "published" },
  {
    key: "paper",
    labelKey: "market_tab_paper",
    admits: (r) => r.status === "verifying" || r.status === "draft",
  },
];

const SORTS: { key: Sort; labelKey: TranslationKey }[] = [
  { key: "return", labelKey: "market_sort_return" },
  { key: "newest", labelKey: "market_sort_newest" },
  { key: "capital", labelKey: "market_sort_capital" },
  { key: "users", labelKey: "market_sort_users" },
];

const PER_PAGE = 12;

export function Marketplace() {
  const state = useApi<{ strategies: StrategyRow[] }>((token) => listStrategies(token));
  return <MarketplaceView state={state} />;
}

export function MarketplaceView({
  state,
}: {
  state: LoadState<{ strategies: StrategyRow[] }> & { reload?: () => void };
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("return");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const rows = state.phase === "ready" ? state.data.strategies : null;

  const visible = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    const admits = TABS.find((entry) => entry.key === tab)?.admits ?? (() => true);
    const filtered = rows.filter(
      (r) =>
        admits(r) &&
        (q === "" ||
          r.name.toLowerCase().includes(q) ||
          r.strategy_class.toLowerCase().includes(q) ||
          r.author.toLowerCase().includes(q)),
    );
    const by = (r: StrategyRow) =>
      sort === "return"
        ? (return30dPct(r) ?? -Infinity)
        : sort === "capital"
          ? Number(r.aum_usd)
          : sort === "users"
            ? Number(r.deployments)
            : // `created_at` last: a draft has neither of the other two.
              new Date(r.published_at ?? r.verification_started_at ?? r.created_at ?? 0).getTime();
    return [...filtered].sort((a, b) => by(b) - by(a));
  }, [rows, tab, sort, query]);

  // Most-deployed carries the Hot tag. Defined rather than decorative.
  const hottest = useMemo(() => {
    if (!rows) return null;
    const ranked = [...rows].sort((a, b) => Number(b.deployments) - Number(a.deployments));
    return Number(ranked[0]?.deployments ?? 0) > 0 ? ranked[0].id : null;
  }, [rows]);

  const pages = Math.max(Math.ceil(visible.length / PER_PAGE), 1);
  const current = Math.min(page, pages - 1);
  const slice = visible.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };

  return (
    <>
      {/* Below lg this route is the home screen: the feed with the performers
          strip, fed the same rows so the two cannot disagree. */}
      <HomeFeed strategies={rows ?? []} />

      <div className="hidden lg:block">
        <CapabilityNotices />

        {/* Header: one claim, one sentence. */}
        <section className="px-5 pt-10 sm:px-8">
          <h1 className="font-ui text-[28px] font-light tracking-[-0.02em] text-text-primary">
            {t("market_title")}
          </h1>
          <p className="pt-1.5 font-ui text-[15px] text-text-secondary">{t("market_sub")}</p>
        </section>

        {/* Stat rail: type, not boxes. Hairlines between the figures. */}
        <section className="px-5 pt-8 sm:px-8">
          <StatRail rows={rows} />
        </section>

        {/* Controls: a segmented pill for the tabs, a search pill, a sort pill. */}
        <section className="flex flex-wrap items-center justify-between gap-4 px-5 pt-7 sm:px-8">
          <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1">
            {TABS.map((entry) => {
              const active = entry.key === tab;
              const n = rows?.filter(entry.admits).length;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => reset(() => setTab(entry.key))}
                  aria-pressed={active}
                  className={`flex h-8 items-center gap-2 rounded-full px-4 font-ui text-[13px] font-medium transition-colors ${FOCUS} ${
                    active ? "bg-surface-2 text-text-primary" : "text-text-dim hover:text-text-primary"
                  }`}
                >
                  {t(entry.labelKey)}
                  <span className={`tnum font-mono text-[12px] ${active ? "text-accent" : "text-text-muted"}`}>
                    {n ?? "—"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex h-10 w-[240px] items-center gap-2.5 rounded-full border border-border bg-surface px-4 transition-colors focus-within:border-grid-strong">
              <Search className="size-[15px] shrink-0 text-text-muted" aria-hidden />
              <input
                value={query}
                onChange={(e) => reset(() => setQuery(e.target.value))}
                placeholder={t("market_search_placeholder")}
                spellCheck={false}
                aria-label={t("market_search_aria")}
                className="min-w-0 flex-1 bg-transparent font-ui text-[13px] text-text-primary outline-none placeholder:text-text-muted"
              />
            </label>
            <label className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface pl-4 pr-3 font-ui text-[13px] text-text-dim">
              {t("market_sort")}
              <select
                value={sort}
                onChange={(e) => reset(() => setSort(e.target.value as Sort))}
                className="bg-transparent font-ui text-[13px] font-medium text-text-primary outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key} className="bg-bg">
                    {t(s.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="px-5 py-7 sm:px-8">
          {state.phase === "loading" ? (
            <SkeletonCards labelKey="loading_marketplace" />
          ) : state.phase === "signed-out" ? (
            <SignedOutState />
          ) : state.phase === "error" ? (
            <ErrorState message={state.message} onRetry={state.reload} />
          ) : rows!.length === 0 ? (
            <EmptyState
              title={t("market_empty_title")}
              body={t("market_empty_body")}
              action={{ label: t("market_empty_action"), href: "/build/new" }}
            />
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-8 py-12 text-center">
              <p className="font-ui text-[15px] font-medium text-text-primary">{t("market_nomatch_title")}</p>
              <p className="max-w-[44ch] font-ui text-[13px] leading-relaxed text-text-secondary">
                {rows!.length === 1 ? t("market_nomatch_one") : t("market_nomatch_many", { count: rows!.length })}
              </p>
              <button
                type="button"
                onClick={() =>
                  reset(() => {
                    setTab("all");
                    setQuery("");
                  })
                }
                className={`mt-1 h-9 rounded-full border border-border px-4 font-ui text-[13px] text-text-primary transition-colors hover:border-grid-strong ${FOCUS}`}
              >
                {t("market_show_all")}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {slice.map((r) => (
                  <AgentCard key={r.id} row={r} hot={r.id === hottest} />
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <p className="font-ui text-[12.5px] text-text-dim">
                  {t("market_showing", {
                    from: current * PER_PAGE + 1,
                    to: current * PER_PAGE + slice.length,
                    total: visible.length,
                  })}
                </p>
                {pages > 1 ? (
                  <div className="flex items-center gap-1.5">
                    <PageButton disabled={current === 0} onClick={() => setPage(current - 1)}>
                      {t("market_previous")}
                    </PageButton>
                    {Array.from({ length: pages }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPage(i)}
                        aria-current={i === current ? "page" : undefined}
                        className={`tnum h-8 min-w-8 rounded-full px-2 font-mono text-[12px] transition-colors ${FOCUS} ${
                          i === current
                            ? "border border-border bg-surface text-text-primary"
                            : "text-text-dim hover:text-text-primary"
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <PageButton disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                      {t("market_next")}
                    </PageButton>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------- cards -- */

function AgentCard({ row: r, hot }: { row: StrategyRow; hot: boolean }) {
  const t = useT();
  const ret = return30dPct(r);
  const points = (r.spark ?? []).map(Number).filter(Number.isFinite);
  const capital = Number(r.mandate_capital_usd);

  return (
    <Link
      href={`/agents/${r.id}`}
      className={`group flex flex-col rounded-2xl border border-border bg-surface p-5 transition-[border-color,transform] duration-200 hover:-translate-y-px hover:border-grid-strong ${FOCUS}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-ui text-[15px] font-semibold tracking-[-0.01em] text-text-primary">
              {r.name}
            </span>
            {hot ? <Tag tone="accent">{t("market_badge_hot")}</Tag> : isNew(r) ? <Tag>{t("market_badge_new")}</Tag> : null}
            {r.is_mine ? <Tag>{t("market_badge_yours")}</Tag> : null}
          </div>
          <p className="truncate pt-1 font-mono text-[11px] text-text-dim">
            {t("market_card_class_days", { class: r.strategy_class, days: recordDays(r) })}
          </p>
        </div>
        <ModelBadge model={r.model} className="shrink-0" />
      </div>

      <div className="pt-4 pb-3">
        {points.length > 1 ? (
          <EquityCurve values={points} baseline={capital || undefined} height={56} hoverAnimate />
        ) : (
          // No curve rather than a flat line pretending to be one.
          <div className="flex h-[56px] items-center font-ui text-[12px] text-text-muted">
            {t("market_card_no_curve")}
          </div>
        )}
      </div>

      {/* Two rows of three: every label at full width. */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-3.5 border-t border-grid pt-3.5">
        <Stat
          label={t("market_metric_return_30d")}
          value={ret === null ? "—" : signedPct(ret)}
          tone={ret === null ? "neutral" : ret >= 0 ? "accent" : "negative"}
        />
        <Stat label={t("market_metric_capital")} value={money(Number(r.aum_usd))} />
        <Stat label={t("market_metric_trades_30d")} value={r.trades_30d ?? "—"} />
        <Stat label={t("market_metric_open_now")} value={r.open_positions ?? "—"} />
        <Stat
          label={t("market_metric_volume_30d")}
          value={r.volume_30d_usd === undefined ? "—" : money(Number(r.volume_30d_usd))}
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-4">
        <Status row={r} />
        <span className="font-ui text-[11.5px] text-text-muted">{t("market_non_custodial")}</span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------- pieces -- */

/** A tag: 11px, sentence case, hairline, full radius. Accent only for Hot. */
function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" }) {
  return (
    <span
      className={`inline-flex h-[20px] shrink-0 items-center rounded-full border px-2 font-ui text-[11px] font-medium leading-none ${
        tone === "accent" ? "border-accent/45 text-accent" : "border-border text-text-secondary"
      }`}
    >
      {children}
    </span>
  );
}

/** Status is a dot and a word. */
function Status({ row: r }: { row: StrategyRow }) {
  const t = useT();
  const live = r.status === "published";
  const label = live
    ? t("market_badge_listed")
    : r.status === "delisted"
      ? t("market_badge_delisted")
      : t("market_badge_paper");
  return (
    <span className={`inline-flex items-center gap-1.5 font-ui text-[12px] font-medium ${live ? "text-accent" : "text-text-secondary"}`}>
      <span className={`size-1.5 rounded-full ${live ? "bg-accent" : "bg-text-muted"}`} aria-hidden />
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "accent" | "negative" | "neutral";
}) {
  return (
    <div className="min-w-0">
      <p className="truncate font-ui text-[11px] text-text-dim">{label}</p>
      <p
        className={`tnum pt-1 font-mono text-[14px] leading-none whitespace-nowrap ${
          tone === "accent" ? "text-accent" : tone === "negative" ? "text-negative" : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * The figures above the shelf, each a SUM over every strategy on screen, and
 * each says what it was counted over so it cannot be mistaken for the
 * per-agent figure of the same name on the cards.
 */
function StatRail({ rows }: { rows: StrategyRow[] | null }) {
  const t = useT();
  const listed = rows?.filter((r) => r.status === "published").length ?? 0;
  const n = rows?.length ?? 0;
  const over = n === 1 ? t("market_rail_over_one") : t("market_rail_over_many", { count: n });

  // `num()` rather than `Number()`: these aggregates are optional, and one
  // NaN poisons the whole sum.
  const sum = (pick: (r: StrategyRow) => string | undefined): number =>
    rows?.reduce((s, r) => s + (num(pick(r)) ?? 0), 0) ?? 0;

  const capital = sum((r) => r.aum_usd);
  const trades = sum((r) => r.trades_30d);
  const open = sum((r) => r.open_positions);
  const volume = sum((r) => r.volume_30d_usd);
  const allPaper = n > 0 && (rows ?? []).every((r) => r.all_paper === true);

  const cells: { label: string; value: string; note?: string }[] = [
    {
      label: t("market_rail_listed"),
      value: String(listed),
      note: n === listed ? undefined : t("market_rail_listed_note", { total: n }),
    },
    {
      label: t(allPaper ? "market_rail_paper_capital" : "market_rail_capital_deployed"),
      value: money(capital),
      note: over,
    },
    { label: t("market_rail_trades_30d"), value: trades.toLocaleString("en-US"), note: over },
    { label: t("market_rail_positions_open"), value: String(open), note: over },
    { label: t("market_rail_volume_30d"), value: money(volume), note: over },
  ];

  return (
    <div className="grid grid-cols-5 divide-x divide-grid border-y border-grid">
      {cells.map((c, i) => (
        <div key={c.label} className={`min-w-0 py-5 ${i === 0 ? "pr-6" : "px-6"}`}>
          <p className="truncate font-ui text-[12px] text-text-dim">{c.label}</p>
          <p className="tnum pt-2 font-mono text-[22px] leading-none tracking-[-0.02em] text-text-primary">
            {c.value}
          </p>
          {c.note ? <p className="truncate pt-1.5 font-ui text-[11.5px] text-text-muted">{c.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

function PageButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-8 rounded-full px-3 font-ui text-[12.5px] text-text-dim transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ helpers -- */

/** How long it has been running a record, published or not. */
function recordDays(r: StrategyRow): number {
  const from = r.verification_started_at ?? r.published_at ?? r.created_at;
  if (!from) return 0;
  return Math.max(Math.floor((Date.now() - new Date(from).getTime()) / 86_400_000), 0);
}

/** Under a fortnight of record. Objective, unlike a curated "featured" flag. */
function isNew(r: StrategyRow): boolean {
  return recordDays(r) < 14;
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function signedPct(n: number): string {
  return `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(1)}%`;
}
