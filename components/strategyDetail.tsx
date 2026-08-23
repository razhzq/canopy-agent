"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EquityCurve } from "@/components/charts";
import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonAgentDetail, SkeletonPanel } from "@/components/skeleton";
import { Badge, Breadcrumb } from "@/components/ui";
import { ModelBadge } from "@/components/modelBadge";
import {
  getStrategy,
  getStrategyRecord,
  num,
  type RecordDay,
  type StrategyRecord,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";

/**
 * A strategy's public page — wireframe 1b.
 *
 * PERFORMANCE IS PUBLIC; THE RECIPE IS NOT.
 *
 * The governing rule, and it costs something real: this page used to list the
 * agent's positions by symbol, which is a pleasant amount of detail and also
 * hands over what it trades. For a focused strategy that IS the strategy, and a
 * marketplace where strategies can be read is one where nobody lists a good
 * one. So the record is published by DAY — return, trades, drawdown — and
 * individual trades never appear.
 *
 * The owner is not restricted here; they simply have somewhere better. Their
 * own agent, with its positions, thread and full transcript, is the workspace.
 */

type Range = "30d" | "90d" | "all";

/**
 * Stable empty series.
 *
 * `?? []` mints a new array every render, which would make the memo below
 * recompute continuously while the record is still loading.
 */
const NO_POINTS: StrategyRecord["points"] = [];

export function StrategyDetail({ strategyId }: { strategyId: number }) {
  const meta = useApi((t) => getStrategy(t, strategyId), [strategyId]);
  const record = useApi<StrategyRecord>((t) => getStrategyRecord(t, strategyId), [strategyId]);
  const [range, setRange] = useState<Range>("30d");

  // Every hook runs before the first early return below. Placing this after
  // them meant the memo existed only once `meta` had loaded, so the hook order
  // changed between renders — which React detects and which corrupts state.
  const ready = record.phase === "ready" ? record.data : null;
  const points = ready?.points ?? NO_POINTS;

  // The curve's window. Cycles run hourly, so a day is roughly 24 readings —
  // approximate on purpose, because the alternative is filtering by timestamp
  // on a series that already arrives ordered and bounded.
  const windowed = useMemo(() => {
    if (range === "all") return points;
    const keep = range === "30d" ? 30 * 24 : 90 * 24;
    return points.slice(Math.max(points.length - keep, 0));
  }, [points, range]);

  const crumbs = (name?: string) => (
    <div className="px-5 sm:px-8 pt-6">
      <Breadcrumb parts={[{ label: "Agents", href: "/agents" }, name ?? "Strategy"]} />
    </div>
  );

  if (meta.phase === "loading") return <>{crumbs()}<SkeletonAgentDetail label="Loading strategy" /></>;
  if (meta.phase === "signed-out") return <>{crumbs()}<SignedOutState /></>;
  if (meta.phase === "error")
    return <>{crumbs()}<ErrorState message={meta.message} onRetry={meta.reload} /></>;

  const { strategy, verification, isMine } = meta.data;
  const live = strategy.status === "published";
  // Both unpublished-with-a-record states. A draft reaches this page for a
  // non-author only when an agent is running on it, so it is a paper record in
  // exactly the sense a verifying one is — and neither can be deployed.
  const onPaper = strategy.status === "verifying" || strategy.status === "draft";
  const days = verification.day;

  // null means the API did not send a daily breakdown at all — an older build.
  // Distinct from an empty array, which genuinely means no trading days. The
  // difference matters: "no days" is a claim about the agent, and making it
  // from a missing field would be the page inventing a fact.
  const daily = Array.isArray(ready?.daily) ? ready.daily : null;
  const capital = ready?.capitalUsd ?? 0;

  const equity = points.length > 0 ? points[points.length - 1].equityUsd : null;
  const ret = equity === null || capital === 0 ? null : ((equity - capital) / capital) * 100;
  const drawdown = maxDrawdownPct(points.map((p) => p.equityUsd));
  const trades30 = (daily ?? [])
    .filter((d) => withinDays(d.day, 30))
    .reduce((s, d) => s + d.trades, 0);
  const perDay = days > 0 ? trades30 / Math.min(days, 30) : 0;

  return (
    <>
      {crumbs(strategy.name)}

      {/* ------------------------------------------------------------ head */}
      <section className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 px-5 sm:px-8 pt-4 pb-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-[28px] leading-none text-text-primary">
              {strategy.name}
            </h1>
            {/* Straight after the name, ahead of the state badges: what it is
                made of, before what it is currently doing. */}
            <ModelBadge />
            {live ? <Badge tone="accent">Listed</Badge> : null}
            {/* Draft and verifying are both paper, and the page says so the
                same way for both. A draft only reaches a non-author at all
                once an agent is running on it, so "Paper" is a statement
                about a real record rather than about an empty shell. */}
            {onPaper ? <Badge tone="muted">Paper</Badge> : null}
            {strategy.status === "delisted" ? <Badge tone="warning">Delisted</Badge> : null}
            {isMine ? <Badge tone="muted">Yours</Badge> : null}
          </div>
          <p className="font-mono text-[10.5px] tracking-[0.06em] text-text-dim uppercase">
            {strategy.strategy_class} · {strategy.fee_pct}% fee · running since{" "}
            {/* A draft has neither of the first two — it has only when it was
                created, which for a draft with an agent on it IS when the
                record started. */}
            {since(
              strategy.verification_started_at ??
                strategy.published_at ??
                strategy.created_at ??
                null,
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {isMine && ready?.agentId ? (
            <Link
              href={`/workspace/${ready.agentId}?tab=chat`}
              className="flex h-11 items-center border border-border px-5 font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase transition-colors hover:border-accent hover:text-accent"
            >
              Open in workspace
            </Link>
          ) : null}
          {live ? (
            <Link
              href={`/deploy/describe?strategy=${strategy.id}`}
              className="flex h-11 items-center border border-accent bg-accent-wash px-6 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
            >
              Deploy this
            </Link>
          ) : (
            <Link
              href="/build/new"
              className="flex h-11 items-center border border-accent bg-accent-wash px-6 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
            >
              + Create your own agent
            </Link>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------- stats */}
      <section className="border-y border-grid px-5 sm:px-8 py-6">
        <div className="flex flex-wrap gap-x-12 gap-y-5">
          <Stat
            label="Return"
            value={ret === null ? "—" : signedPct(ret)}
            tone={ret === null ? "neutral" : ret >= 0 ? "accent" : "negative"}
          />
          {/* The record agent's own capital, off the record endpoint — the same
              figure Return is measured against, so the two cannot disagree.
              This used to read `strategy.aum_usd`, which is an aggregate the
              LIST query computes and the detail route does not select, so it
              arrived undefined and rendered "$NaN".
              Just "Capital", not "Capital deployed": on a paper run nothing is
              deployed, and the head already carries a Paper run badge saying
              so. The plain noun is true of both books. */}
          <Stat label="Capital" value={ready === null ? "—" : money(capital)} />
          <Stat
            label="Max drawdown"
            value={drawdown === 0 ? "—" : `−${drawdown.toFixed(2)}%`}
            tone={drawdown > 0 ? "negative" : "neutral"}
          />
          <Stat label="Trades · 30d" value={String(trades30)} />
        </div>
        {ready ? (
          <p className="pt-4 font-ui text-[12.5px] text-text-dim">
            {ready.openPositions} {ready.openPositions === 1 ? "position" : "positions"} open now
          </p>
        ) : null}
      </section>

      {/* ------------------------------------------------------- open book */}
      {ready?.positions && ready.positions.length > 0 ? (
        <section className="border-t border-grid px-5 py-7 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
            <h2 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
              Open positions
            </h2>
            <span className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
              Live · {ready.positions.length}{" "}
              {ready.positions.length === 1 ? "holding" : "holdings"}
            </span>
          </div>
          {/* Said once, plainly. Quantities without cost basis look like an
              omission unless the reason is on the page. */}
          <p className="pb-4 font-ui text-[12.5px] leading-relaxed text-text-dim">
            What it is holding right now. Entry prices are the author&rsquo;s own execution
            rather than the strategy, so they are not published — a deployer starting today
            gets neither.
          </p>

          <div className="border border-grid">
            <div className="hidden grid-cols-[minmax(0,1fr)_110px_120px_120px] gap-4 border-b border-grid px-4 py-2.5 font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase sm:grid">
              <span>Asset</span>
              <span>Chain</span>
              <span className="text-right">Quantity</span>
              <span className="text-right">Held for</span>
            </div>
            {ready.positions.map((p) => (
              <div
                key={`${p.symbol}-${p.openedAt}`}
                className="grid grid-cols-2 items-center gap-x-4 gap-y-1.5 border-b border-grid px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_110px_120px_120px]"
              >
                <span className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
                  <span className="truncate font-mono text-[13px] text-text-primary">
                    {p.symbol}
                  </span>
                  {/* The underlying is the thing a reader recognises: TSLAx
                      means nothing to someone who knows TSLA. */}
                  {p.underlying ? (
                    <span className="shrink-0 font-mono text-[10px] text-text-dim">
                      {p.underlying}
                    </span>
                  ) : null}
                </span>
                <span className="font-mono text-[11.5px] text-text-dim">{p.venue}</span>
                <span className="tnum text-right font-mono text-[12.5px] text-text-secondary">
                  {qty(p.qty)}
                </span>
                <span className="text-right font-mono text-[11.5px] text-text-dim">
                  {held(p.openedAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ----------------------------------------------------------- curve */}
      <section className="px-5 sm:px-8 py-7">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
          <h2 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
            Equity
          </h2>
          <div className="flex items-center gap-0.5 rounded-full border border-grid p-1">
            {(["30d", "90d", "all"] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`h-7 rounded-full px-3.5 font-mono text-[11px] transition-colors ${
                  range === r ? "bg-accent-wash text-accent" : "text-text-dim hover:text-text-primary"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {record.phase === "loading" ? (
          <SkeletonPanel label="Loading record" />
        ) : record.phase === "error" ? (
          <ErrorState message={record.message} onRetry={record.reload} />
        ) : windowed.length < 2 ? (
          <div className="border border-grid bg-panel px-5 sm:px-8 py-10 text-center">
            <p className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
              Not enough cycles yet
            </p>
            <p className="mx-auto max-w-[46ch] pt-2 font-ui text-[13px] leading-relaxed text-text-secondary">
              A curve appears once this agent has run more than once.
            </p>
          </div>
        ) : (
          <div className="border border-grid p-4">
            <EquityCurve values={windowed.map((p) => p.equityUsd)} baseline={capital} height={200} />
            <div className="flex items-center justify-between pt-3 font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
              <span>Cycle {windowed[0].tickSeq}</span>
              <span className="text-text-muted">dashed line is starting capital</span>
              <span>Cycle {windowed[windowed.length - 1].tickSeq}</span>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------ public information | performance by day */}
      {/* 1fr / 1.6fr, per the wireframe: the facts are a short list and the
          record is a table, so equal columns would leave one half empty and
          crush the other. */}
      <section className="grid gap-8 px-5 sm:px-8 pb-10 lg:grid-cols-[1fr_1.6fr]">
        <div className="min-w-0">
          <h2 className="pb-3.5 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            Public information
          </h2>
          <div>
            <Fact label="Asset class" value={strategy.strategy_class.toUpperCase()} />
            <Fact
              label="Status"
              value={`${live ? "Listed" : onPaper ? "Paper run" : "Delisted"} · ${days} ${
                days === 1 ? "day" : "days"
              }`}
            />
            <Fact label="Trades / day" value={perDay > 0 ? `~${perDay.toFixed(1)}` : "—"} />
            <Fact
              label="Win rate"
              value={
                ready?.winRatePct === null || ready?.winRatePct === undefined
                  ? "—"
                  : `${ready.winRatePct.toFixed(0)}%`
              }
              note={ready ? `${ready.closedPositions} closed` : undefined}
            />
            <Fact label="Custody" value="Non-custodial" />
            <Fact label="Creator fee" value={`${strategy.fee_pct}% of profit`} last />
          </div>

          {/* Inside the column, boxed — it is a term of the listing, not a
              footnote about the page. */}
          <p className="mt-5 border border-grid-strong p-3.5 font-ui text-[12px] leading-relaxed text-text-secondary">
            Strategy rules, entry logic and limits stay private to the owner. Performance is
            public; the recipe is not.
          </p>
        </div>

        <div className="min-w-0">
          <h2 className="pb-3.5 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            Performance by day
          </h2>

          {record.phase === "loading" ? (
            <SkeletonPanel label="Loading record" />
          ) : record.phase === "error" ? (
            <ErrorState message={record.message} onRetry={record.reload} />
          ) : daily === null ? (
            // The API answered without a daily breakdown. Saying so beats
            // claiming the agent has never traded.
            <p className="border border-grid bg-panel px-6 py-8 text-center font-ui text-[13px] leading-relaxed text-text-secondary">
              The daily breakdown is not available from this API build.
            </p>
          ) : daily.length === 0 ? (
            <p className="border border-grid bg-panel px-6 py-8 text-center font-ui text-[13px] text-text-secondary">
              No cycles yet — a day appears here as soon as this agent runs.
            </p>
          ) : (
            <div>
              <div className={`${DAY_COLS} border-b border-grid pb-2.5 font-mono text-[9px] tracking-[0.1em] text-text-dim uppercase`}>
                <span>Day</span>
                <span className="text-right">Return</span>
                <span className="text-right">Trades</span>
                <span className="text-right">Max drawdown</span>
              </div>
              {daily!.slice(0, 30).map((d) => (
                <DayRow key={d.day} day={d} />
              ))}
            </div>
          )}
          <p className="pt-3 font-ui text-[12px] text-text-dim">
            Last 90 days · individual trades are not published.
          </p>
        </div>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------- bits -- */

const DAY_COLS = "grid grid-cols-[1.1fr_.9fr_.9fr_.9fr] items-center gap-x-4";

function DayRow({ day: d }: { day: RecordDay }) {
  const today = dayLabel(d.day) === "Today";
  // A day with a single reading has no change to measure — distinct from a day
  // that moved and came back to zero.
  const measurable = d.cycles >= 2 || d.realizedUsd !== 0;

  return (
    <div
      className={`${DAY_COLS} border-b border-grid py-2.5 last:border-b-0 ${
        today ? "bg-accent-wash" : ""
      }`}
    >
      <span className="flex min-w-0 items-baseline gap-2">
        <span
          className={`truncate font-mono text-[12.5px] ${
            today ? "text-accent" : "text-text-primary"
          }`}
        >
          {dayLabel(d.day)}
        </span>
        {/* Cycles run, so a day it held rather than traded still reads as a
            day it was working. */}
        <span className="shrink-0 font-mono text-[9.5px] tracking-[0.06em] text-text-muted uppercase">
          {d.cycles} {d.cycles === 1 ? "cycle" : "cycles"}
        </span>
      </span>
      <span
        className={`tnum text-right font-mono text-[12.5px] ${
          !measurable
            ? "text-text-dim"
            : d.returnPct > 0
              ? "text-accent"
              : d.returnPct < 0
                ? "text-negative"
                : "text-text-secondary"
        }`}
      >
        {measurable ? signedPct(d.returnPct) : "—"}
      </span>
      <span className="tnum text-right font-mono text-[12.5px] text-text-secondary">
        {d.trades}
      </span>
      <span className="tnum text-right font-mono text-[12.5px] text-text-dim">
        {num(d.maxDrawdownPct) === null ? "—" : `−${num(d.maxDrawdownPct)!.toFixed(2)}%`}
      </span>
    </div>
  );
}

function Fact({
  label,
  value,
  note,
  last = false,
}: {
  label: string;
  value: string;
  note?: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-4 py-2.5 ${
        last ? "" : "border-b border-grid"
      }`}
    >
      <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
        {label}
      </span>
      <span className="truncate font-mono text-[12.5px] text-text-primary">
        {value}
        {note ? <span className="pl-2 text-[10px] text-text-muted">{note}</span> : null}
      </span>
    </div>
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
    <div className="space-y-2">
      <p className="font-mono text-[9.5px] tracking-[0.12em] text-text-dim uppercase">{label}</p>
      <p
        className={`tnum font-mono text-[22px] leading-none whitespace-nowrap ${
          tone === "accent"
            ? "text-accent"
            : tone === "negative"
              ? "text-negative"
              : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- helpers -- */

function maxDrawdownPct(values: number[]): number {
  if (values.length === 0) return 0;
  let peak = values[0];
  let worst = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) worst = Math.max(worst, ((peak - v) / peak) * 100);
  }
  return worst;
}

function withinDays(day: string, n: number): boolean {
  return (Date.now() - new Date(day).getTime()) / 86_400_000 <= n;
}

function dayLabel(day: string): string {
  const d = new Date(day);
  const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function since(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function signedPct(n: number): string {
  return `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(2)}%`;
}

/**
 * A holding's size, trimmed to something readable.
 *
 * Token quantities arrive as decimal strings with twelve places; printing them
 * whole turns a table of holdings into a table of noise.
 */
function qty(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/** How long a position has been open. Its age is the part that is public. */
function held(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "under an hour";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
