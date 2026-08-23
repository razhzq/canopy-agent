"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EquityCurve } from "@/components/charts";
import { EmptyState, ErrorState, SignedOutState } from "@/components/states";
import { SkeletonCards } from "@/components/skeleton";
import { CapabilityNotices } from "@/components/capabilityNotice";
import { Badge } from "@/components/ui";
import { ModelBadge } from "@/components/modelBadge";
import { HomeFeed } from "@/components/homeFeed";
import { listStrategies, num, return30dPct, type StrategyRow } from "@/lib/api";
import { useApi } from "@/lib/useApi";

/**
 * The agent marketplace — wireframe 1a.
 *
 * One grid of identical cards, twelve to a page. It replaced an eleven-column
 * table that read as a spreadsheet of strategies rather than a shelf of agents
 * somebody might deploy.
 *
 * TRACK RECORD ONLY
 *
 * Nothing here exposes how an agent decides — no rules, no universe, no
 * thresholds. That is the wireframe's rule and it is the right one: a
 * marketplace where the strategy is visible is one where the strategy is
 * copyable, and nobody would list a good one.
 *
 * Every figure is measured, and the ones that cannot be are absent rather than
 * invented. The sparkline is the record agent's own equity readings; an earlier
 * version drew it from a hash of the row id, which looked exactly as convincing
 * and meant nothing.
 */

/**
 * No "delisted" tab, because no delisted strategy reaches this page: the list
 * endpoint returns published, verifying, and drafts with a running agent. A tab
 * of strategies nobody can deploy — the deploy path refuses a delisted one — is
 * a shelf of dead ends, and delisting is precisely the act of taking a listing
 * down.
 *
 * A TAB IS A PREDICATE, NOT A STATUS.
 *
 * It used to compare `r.status === tab`, which silently assumed one tab meant
 * exactly one status. Paper is two: a `draft` with an agent running on it and a
 * `verifying` one are both paper records that cannot be deployed, and the
 * difference between them — whether the author entered it for a listing — is
 * not something a browser can act on. Splitting them into two tabs would ask
 * the reader to care about our lifecycle; matching on status alone would have
 * hidden every draft behind "All" with no tab counting it.
 */
type Tab = "all" | "published" | "paper";
type Sort = "return" | "newest" | "capital" | "users";

const TABS: { key: Tab; label: string; admits: (r: StrategyRow) => boolean }[] = [
  { key: "all", label: "All", admits: () => true },
  { key: "published", label: "Listed", admits: (r) => r.status === "published" },
  {
    key: "paper",
    label: "Paper",
    admits: (r) => r.status === "verifying" || r.status === "draft",
  },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "return", label: "Return" },
  { key: "newest", label: "Newest" },
  { key: "capital", label: "Capital" },
  { key: "users", label: "Users" },
];

const PER_PAGE = 12;

export function Marketplace() {
  const state = useApi<{ strategies: StrategyRow[] }>((token) => listStrategies(token));
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("return");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const rows = state.phase === "ready" ? state.data.strategies : null;

  const visible = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    const admits = TABS.find((t) => t.key === tab)?.admits ?? (() => true);
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
            : // `created_at` last: a draft has neither of the other two, and
              // without it every draft dates to the epoch and sorts below
              // everything under "Newest" — the opposite of the truth.
              new Date(
                r.published_at ?? r.verification_started_at ?? r.created_at ?? 0,
              ).getTime();
    return [...filtered].sort((a, b) => by(b) - by(a));
  }, [rows, tab, sort, query]);

  // Most-deployed carries the HOT mark. Defined rather than decorative: a badge
  // nobody can explain is a badge nobody should trust.
  const hottest = useMemo(() => {
    if (!rows) return null;
    const ranked = [...rows].sort((a, b) => Number(b.deployments) - Number(a.deployments));
    return Number(ranked[0]?.deployments ?? 0) > 0 ? ranked[0].id : null;
  }, [rows]);

  const pages = Math.max(Math.ceil(visible.length / PER_PAGE), 1);
  const current = Math.min(page, pages - 1);
  const slice = visible.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  /*
   * EVERY AGENT GETS THE SAME CARD.
   *
   * Wireframe 1a promoted the first three into richer cards over a denser
   * grid, and it was dropped because the promotion was never real. `featured`
   * was `slice.slice(0, 3)` — whichever agents happened to lead the current
   * sort — so changing the sort dropdown handed the richer card to three
   * different agents, and because `slice` is already paginated it re-promoted
   * the top of every page. An agent was drawn one way or the other according
   * to where the pagination boundary fell.
   *
   * Hierarchy has to be earned by a criterion the reader can act on. Position
   * in the current sort is not one, and nothing on screen claimed it was — so
   * the difference read as inconsistency rather than as ranking. The one
   * genuinely defined distinction, most-deployed, survives as the HOT badge.
   */

  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };

  return (
    <>
      {/* Below lg this route is wireframe M01 — the home screen. Explore IS the
          home: you open the app to see what is worth deploying, which is why
          the performers strip leads. Your own agents are on the profile, where
          the wireframe puts them.

          Fed the same `listStrategies` response the grid below uses, so the two
          cannot disagree and the page still costs one request. */}
      <HomeFeed strategies={rows ?? []} />

      <div className="hidden lg:block">
      {/* Above the fold and above the heading: it answers a question the reader
          asked weeks ago and has probably stopped expecting an answer to. It
          renders nothing at all when there is nothing to say. */}
      <CapabilityNotices />

      <section className="border-b border-grid px-5 sm:px-8 pt-7 pb-6">
        <h1 className="font-mono text-[34px] leading-none text-text-primary">Agents</h1>
        <p className="max-w-[70ch] pt-2.5 font-ui text-[14px] text-text-secondary">
          Every strategy with a live record — published, and still on paper. Deploy a listed one
          as your own agent: you keep custody, you set every limit.
        </p>
        <StatRail rows={rows} />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-x-6 border-b border-grid px-5 sm:px-8">
        <div className="flex flex-wrap items-center">
          {TABS.map((t) => {
            const active = t.key === tab;
            const n = rows?.filter(t.admits).length;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => reset(() => setTab(t.key))}
                aria-pressed={active}
                className={`flex items-center gap-2 border-b-2 px-5 py-4 font-mono text-[12px] tracking-[0.1em] uppercase transition-colors ${
                  active
                    ? "border-accent text-text-primary"
                    : "border-transparent text-text-dim hover:text-text-secondary"
                }`}
              >
                {t.label}
                <span className={active ? "text-accent" : "text-text-muted"}>{n ?? "—"}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-5 py-2.5">
          <input
            value={query}
            onChange={(e) => reset(() => setQuery(e.target.value))}
            placeholder="Search agents…"
            spellCheck={false}
            aria-label="Search agents"
            className="h-9 w-[190px] border-b border-grid-strong bg-transparent font-mono text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent"
          />
          <label className="flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
            Sort
            <select
              value={sort}
              onChange={(e) => reset(() => setSort(e.target.value as Sort))}
              className="border-b border-grid-strong bg-transparent py-1 font-mono text-[11px] text-text-primary outline-none focus:border-accent"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key} className="bg-bg">
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="px-5 sm:px-8 py-7">
        {state.phase === "loading" ? (
          <SkeletonCards label="Loading marketplace" />
        ) : state.phase === "signed-out" ? (
          <SignedOutState />
        ) : state.phase === "error" ? (
          <ErrorState message={state.message} onRetry={state.reload} />
        ) : rows!.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            body="Every strategy with a live record appears here — published, and still on paper. Nothing has started one yet."
            action={{ label: "Build an agent", href: "/build/new" }}
          />
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border border-grid bg-panel px-5 sm:px-8 py-12 text-center">
            <p className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
              Nothing matches
            </p>
            <p className="max-w-[44ch] font-ui text-[13px] leading-relaxed text-text-secondary">
              {rows!.length} {rows!.length === 1 ? "agent" : "agents"} in total. Clear the filter
              to see them.
            </p>
            <button
              type="button"
              onClick={() =>
                reset(() => {
                  setTab("all");
                  setQuery("");
                })
              }
              className="font-mono text-[10.5px] tracking-[0.1em] text-accent uppercase transition-colors hover:text-text-primary"
            >
              Show all
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {slice.map((r) => (
                <AgentCard key={r.id} row={r} hot={r.id === hottest} />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-3">
              <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                Showing {current * PER_PAGE + 1}–{current * PER_PAGE + slice.length} of{" "}
                {visible.length}
              </p>
              {pages > 1 ? (
                <div className="flex items-center gap-1">
                  <PageButton disabled={current === 0} onClick={() => setPage(current - 1)}>
                    ← Previous
                  </PageButton>
                  {Array.from({ length: pages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPage(i)}
                      className={`h-8 min-w-8 px-2 font-mono text-[11px] transition-colors ${
                        i === current
                          ? "border border-accent text-accent"
                          : "text-text-dim hover:text-text-primary"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <PageButton disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                    Next →
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
  const ret = return30dPct(r);
  const points = (r.spark ?? []).map(Number).filter(Number.isFinite);
  const capital = Number(r.mandate_capital_usd);

  return (
    <Link
      href={`/agents/${r.id}`}
      className="group flex flex-col border border-grid p-5 transition-colors hover:border-grid-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-[15px] text-text-primary group-hover:text-accent">
            {r.name}
          </span>
          {hot ? (
            <Badge tone="warning">Hot</Badge>
          ) : isNew(r) ? (
            <Badge tone="accent">New</Badge>
          ) : null}
          {/* Beside the name, where the reader is already looking to tell one
              card from another. `min-w-0` on the wrapper means the NAME is what
              gives way when the card is narrow — the pill is shrink-0, so it
              survives the truncation that a 15-character agent name causes. */}
          <ModelBadge />
        </span>
        {r.is_mine ? <Badge tone="muted">Yours</Badge> : null}
      </div>

      <p className="truncate pt-1.5 font-mono text-[10.5px] tracking-[0.06em] text-text-dim uppercase">
        {r.strategy_class} · {recordDays(r)} days
      </p>

      <div className="py-4">
        {points.length > 1 ? (
          <EquityCurve values={points} baseline={capital || undefined} height={56} hoverAnimate />
        ) : (
          // No curve rather than a flat line pretending to be one.
          <div className="flex h-[56px] items-center font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
            Not enough cycles yet
          </div>
        )}
      </div>

      {/* Two-up until the cards go three-across.
          The four metrics used to sit in one row of four because this card was
          full width below lg; it is two-up from sm now, which leaves each
          column about 63px — narrow enough that "Return 30d" and "Trades 30d"
          both truncate to an ellipsis. A 2x2 block holds the same four figures
          without abbreviating any of their labels. */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 border-t border-grid pt-3.5 lg:grid-cols-4">
        <Metric
          label="Return 30d"
          value={ret === null ? "—" : signedPct(ret)}
          tone={ret === null ? "neutral" : ret >= 0 ? "accent" : "negative"}
        />
        <Metric label="Capital" value={money(Number(r.aum_usd))} />
        {/* `?? "—"` rather than `?? "0"`: these are list-only aggregates, so on
            this page they are always present, and if one ever is not, "0" would
            be a claim about the agent where "—" is an admission about the data. */}
        <Metric label="Trades 30d" value={r.trades_30d ?? "—"} />
        <Metric label="Open now" value={r.open_positions ?? "—"} />
      </div>

      <div className="flex items-center justify-between gap-3 pt-3.5">
        <StatusBadge row={r} />
        <span className="font-mono text-[9.5px] tracking-[0.1em] text-text-muted uppercase">
          non-custodial
        </span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------- pieces -- */

/**
 * The four figures above the shelf, each a SUM over every strategy on screen.
 *
 * Every one of them shares a name with a per-strategy figure on the cards
 * below — capital, trades, positions — so each carries what it was counted
 * over. Without that, "Capital deployed $120k" sitting above a card reading
 * "Capital $10k" looks like one of the two being wrong, when they are a market
 * total and one agent's mandate.
 *
 * The rail follows the FILTER, not the whole market: these are sums over the
 * rows actually listed, so switching to Paper re-totals rather than continuing
 * to describe everything. That is why the note says "listed" rather than
 * naming the market.
 */
function StatRail({ rows }: { rows: StrategyRow[] | null }) {
  const listed = rows?.filter((r) => r.status === "published").length ?? 0;
  const n = rows?.length ?? 0;
  const over = `across ${n} ${n === 1 ? "agent" : "agents"} listed`;

  // `num()` rather than `Number()`, because these aggregates are optional on
  // StrategyRow — they exist on the list route and not the detail one. A bare
  // Number(undefined) is NaN, and one NaN poisons the whole sum into "$NaN",
  // which is exactly how the strategy page's capital broke.
  const sum = (pick: (r: StrategyRow) => string | undefined): number =>
    rows?.reduce((s, r) => s + (num(pick(r)) ?? 0), 0) ?? 0;

  const capital = sum((r) => r.aum_usd);
  const trades = sum((r) => r.trades_30d);
  const open = sum((r) => r.open_positions);

  // Nothing on this shelf is funded until a strategy goes live, and "Capital
  // deployed" claims real money is at work. Same correction the My Agents band
  // needed. `all_paper` is the backend's own per-strategy flag.
  //
  // `=== true`, so an ABSENT flag falls back to the neutral label rather than
  // claiming paper. Getting it wrong that way understates what is at stake;
  // the other way round only costs a word.
  const allPaper = n > 0 && (rows ?? []).every((r) => r.all_paper === true);

  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4 pt-6">
      <Metric
        label="Listed agents"
        value={String(listed)}
        note={n === listed ? undefined : `of ${n} with a record`}
        big
      />
      <Metric
        label={allPaper ? "Paper capital" : "Capital deployed"}
        value={money(capital)}
        note={over}
        big
      />
      <Metric
        label="Trades · 30d"
        value={trades.toLocaleString("en-US")}
        note={over}
        big
      />
      <Metric label="Positions open" value={String(open)} note={over} big />
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  tone = "neutral",
  big = false,
}: {
  label: string;
  value: string;
  /**
   * What the number is counted over.
   *
   * Only the rail passes it. A rail figure is a SUM across every strategy on
   * screen while the identically-named figure on each card below is that one
   * strategy's — the same trap the My Agents band had, where "$60k" sat one
   * click above "$10,000" and both were labelled capital.
   */
  note?: string;
  tone?: "accent" | "negative" | "neutral";
  big?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="truncate font-mono text-[9.5px] tracking-[0.12em] text-text-dim uppercase">
        {label}
      </p>
      <p
        className={`tnum font-mono leading-none whitespace-nowrap ${
          big ? "text-[20px]" : "text-[13px]"
        } ${
          tone === "accent"
            ? "text-accent"
            : tone === "negative"
              ? "text-negative"
              : "text-text-primary"
        }`}
      >
        {value}
      </p>
      {note ? (
        <p className="truncate font-ui text-[11px] text-text-dim">{note}</p>
      ) : null}
    </div>
  );
}

function StatusBadge({ row: r }: { row: StrategyRow }) {
  if (r.status === "published") return <Badge tone="accent">Listed</Badge>;
  // Unreachable while the list endpoint excludes delisted, and kept anyway: the
  // fallback below says "Paper", so dropping this would label a delisted
  // strategy as a live paper record if one ever arrived. A branch that cannot
  // fire costs a line; a badge that lies costs trust.
  if (r.status === "delisted") return <Badge tone="warning">Delisted</Badge>;
  // Draft and verifying alike. Both are trading on paper and neither can be
  // deployed, so one badge tells the reader the one thing that is true of both
  // — and "Paper" rather than "Paper run" because it is also what the agent
  // itself is labelled everywhere else in the product.
  return <Badge tone="muted">Paper</Badge>;
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
      className="h-8 px-3 font-mono text-[10.5px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ helpers -- */

/**
 * How long it has been running a record, published or not.
 *
 * `created_at` is the fallback because a DRAFT has no other date, and returning
 * 0 for one made every draft permanently "NEW" — a badge that never expires is
 * not a fact about the strategy, it is noise on every row.
 */
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
