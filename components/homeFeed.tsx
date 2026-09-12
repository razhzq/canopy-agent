"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { EmptyState } from "@/components/states";
import { MiniCurve } from "@/components/charts";
import { Avatar, FOCUS, SectionLabel } from "@/components/kit";
import { useAccountBalance } from "@/lib/useAccountBalance";
import { hitRatePct, num, return30dPct, type StrategyRow } from "@/lib/api";
import { useT, type TranslationKey } from "@/lib/i18n";

/**
 * The mobile home.
 *
 * THIS IS EXPLORE, NOT MY AGENTS. The list is every published strategy, which
 * is what makes it a home screen rather than a dashboard: you open the app to
 * see what is worth deploying, and the performers strip is the whole point.
 * Your own agents live on the profile.
 *
 * What is yours here is the headline — the balance — because the one thing a
 * discovery screen still owes you is what you have to spend.
 *
 * SEARCH AND THE FULL SORT SET, as on the desktop. The first version had three
 * chips and a filter icon that did nothing; a phone could not find an agent by
 * name at all, and "Top PnL" was sorting on 30-day return. The chips are now
 * the desktop's orderings under the same names, and the search matches the
 * same four fields the desktop's does.
 */

type Chip = "all" | "pnl" | "return" | "new" | "held" | "capital";

// Keys rather than labels — the table is module-level and cannot call a hook.
const CHIPS: { key: Chip; labelKey: TranslationKey }[] = [
  { key: "all", labelKey: "home_chip_all" },
  { key: "pnl", labelKey: "home_chip_top" },
  { key: "return", labelKey: "home_chip_return" },
  { key: "new", labelKey: "home_chip_new" },
  { key: "held", labelKey: "home_chip_held" },
  { key: "capital", labelKey: "home_chip_capital" },
];

function orderBy(chip: Chip): ((a: StrategyRow, b: StrategyRow) => number) | null {
  switch (chip) {
    case "pnl":
      return (a, b) =>
        Number(b.realized_pnl_usd ?? 0) - Number(a.realized_pnl_usd ?? 0);
    case "return":
      return (a, b) =>
        (return30dPct(b) ?? -Infinity) - (return30dPct(a) ?? -Infinity);
    case "new":
      return (a, b) =>
        new Date(b.published_at ?? 0).getTime() -
        new Date(a.published_at ?? 0).getTime();
    case "held":
      return (a, b) => (num(b.deployments) ?? 0) - (num(a.deployments) ?? 0);
    case "capital":
      return (a, b) => (num(b.aum_usd) ?? 0) - (num(a.aum_usd) ?? 0);
    default:
      return null;
  }
}

export function HomeFeed({ strategies }: { strategies: StrategyRow[] }) {
  const t = useT();
  const balance = useAccountBalance();
  const [chip, setChip] = useState<Chip>("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // Ranked on the trailing 30 days — the shortest window `listStrategies`
  // reports. The heading does not name a window, so nothing here claims to
  // cover a period the data does not.
  const top = useMemo(
    () =>
      [...strategies]
        .filter((x) => return30dPct(x) !== null)
        .sort((a, b) => (return30dPct(b) ?? 0) - (return30dPct(a) ?? 0))
        .slice(0, 4),
    [strategies],
  );

  const shown = useMemo(() => {
    // The same four fields the desktop search reads.
    const list = strategies.filter(
      (r) =>
        q === "" ||
        r.name.toLowerCase().includes(q) ||
        r.strategy_class.toLowerCase().includes(q) ||
        r.author.toLowerCase().includes(q) ||
        (r.author_username ?? "").toLowerCase().includes(q),
    );
    const by = orderBy(chip);
    return by ? [...list].sort(by) : list;
  }, [strategies, chip, q]);

  const [whole, cents] = splitMoney(balance.equityUsd);

  return (
    <div className="lg:hidden">
      {/* ------------------------------------------------------ balance -- */}
      <div className="px-5 pt-4 pb-5">
        <div className="space-y-1.5">
          <p className="tnum flex items-end font-mono text-[34px] leading-none tracking-[-0.02em]">
            {/* Cents in $text-muted: the figure people read is the dollars.
                A dash until the fan-out lands, never a zero — an account with
                money in it must not render as empty for a beat. */}
            <span className="text-text-primary">
              {balance.loaded ? whole : "—"}
            </span>
            <span className="text-text-muted">{balance.loaded ? cents : ""}</span>
          </p>
          <p className="flex items-baseline gap-1.5">
            <span
              className={`tnum font-mono text-[13px] ${
                (balance.moved24hUsd ?? 0) >= 0 ? "text-accent" : "text-negative"
              }`}
            >
              {balance.moved24hUsd === null ? "—" : signed(balance.moved24hUsd)}
            </span>
            <span className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
              {balance.agents === 1
                ? t("home_balance_window_one")
                : t("home_balance_window_many", { count: balance.agents })}
            </span>
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------- search -- */}
      {/* The desktop's pill, full width. Its own row rather than a slot in
          the chip strip: a text field inside a horizontal scroller is one
          swipe from disappearing. */}
      <div className="px-5 pb-3">
        <label className="flex h-10 items-center gap-2.5 rounded-full border border-border bg-surface px-4 transition-colors focus-within:border-grid-strong">
          <Search className="size-[15px] shrink-0 text-text-dim" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("market_search_placeholder")}
            aria-label={t("market_search_aria")}
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent font-ui text-[14px] pointer-coarse:text-[16px] text-text-primary outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("common_dismiss")}
              className={`-mr-1.5 flex size-7 shrink-0 items-center justify-center rounded-full text-text-dim transition-colors hover:text-text-primary ${FOCUS}`}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </label>
      </div>

      {/* ---------------------------------------------- top performers -- */}
      {/* Hidden while searching: a strip of the best four is a browse aid,
          and a reader typing a name has stopped browsing. */}
      {top.length > 0 && q === "" ? (
        <div className="space-y-2.5 pt-1 pb-4">
          <div className="px-5">
            <SectionLabel>{t("home_top_performers")}</SectionLabel>
          </div>
          {/* Overflows on purpose — a card clipped at the right edge is what
              says there are more. */}
          <div className="flex gap-2.5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {top.map((x) => {
              const pct = return30dPct(x) ?? 0;
              return (
                <Link
                  key={x.id}
                  href={`/agents/${x.id}`}
                  className={`w-[196px] shrink-0 space-y-2.5 rounded-2xl border border-border bg-surface px-3.5 py-3 transition-colors hover:border-grid-strong ${FOCUS}`}
                >
                  <div className="flex items-center gap-2">
                    <Avatar label={x.name} size={24} />
                    <span className="truncate font-ui text-[13.5px] text-text-primary">
                      {x.name}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`tnum font-mono text-[14px] ${pct >= 0 ? "text-accent" : "text-negative"}`}
                    >
                      {signedPct(pct)}
                    </span>
                    <span className="font-mono text-[9px] tracking-[0.08em] text-text-dim uppercase">
                      {x.strategy_class}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* -------------------------------------------------------- chips -- */}
      <div
        role="group"
        aria-label={t("home_sort_aria")}
        className="flex items-center gap-1.5 overflow-x-auto px-5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CHIPS.map((c) => {
          const on = chip === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setChip(c.key)}
              aria-pressed={on}
              className={`h-8 shrink-0 rounded-lg px-3 font-ui text-[12.5px] transition-colors ${FOCUS} ${
                on
                  ? "bg-surface-2 text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t(c.labelKey)}
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------------------- list -- */}
      {shown.length === 0 ? (
        <div className="px-5 py-8">
          {q ? (
            <p className="py-6 text-center font-ui text-[13px] text-text-dim">
              {t("home_search_none", { query: query.trim() })}
            </p>
          ) : (
            <EmptyState
              title={t("home_empty_title")}
              body={t("home_empty_body")}
              action={{ label: t("home_empty_action"), href: "/build/new" }}
            />
          )}
        </div>
      ) : (
        <ul className="border-t border-grid">
          {shown.map((x) => (
            <StrategyFeedRow key={x.id} row={x} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StrategyFeedRow({ row }: { row: StrategyRow }) {
  const t = useT();
  const pct = return30dPct(row);
  const hit = hitRatePct(row);
  const deployments = num(row.deployments) ?? 0;
  const aum = num(row.aum_usd);
  const spark = (row.spark ?? []).map(Number).filter(Number.isFinite);

  return (
    <li className="border-b border-grid">
      <Link
        href={`/agents/${row.id}`}
        className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface/60 ${FOCUS}`}
      >
        <Avatar label={row.name} size={36} />

        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-ui text-[14px] text-text-primary">
              {row.name}
            </span>
            <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.06em] text-text-secondary uppercase">
              {row.all_paper ? t("home_badge_paper") : row.strategy_class}
            </span>
          </span>
          <span className="block font-mono text-[11px] text-text-dim">
            {hit === null
              ? t("home_row_deployed", { count: deployments })
              : t("home_row_deployed_win", {
                  count: deployments,
                  pct: hit.toFixed(0),
                })}
          </span>
        </span>

        {/* The strategy's own equity readings, not a generated shape. */}
        {spark.length > 1 ? (
          <span className="hidden shrink-0 sm:block">
            <MiniCurve
              values={spark}
              tone={(pct ?? 0) >= 0 ? "accent" : "negative"}
              width={64}
              height={24}
            />
          </span>
        ) : null}

        <span className="shrink-0 space-y-1 text-right">
          <span className="tnum block font-mono text-[14px] text-text-primary">
            {aum === null ? "—" : money(aum)}
          </span>
          <span
            className={`tnum block font-mono text-[12px] ${
              pct === null
                ? "text-text-dim"
                : pct >= 0
                  ? "text-accent"
                  : "text-negative"
            }`}
          >
            {pct === null ? "—" : signedPct(pct)}
          </span>
        </span>
      </Link>
    </li>
  );
}

/* ------------------------------------------------------------- format -- */

/** `$4,281.28` → `["$4,281", ".28"]`, so the cents can be set back. */
function splitMoney(n: number): [string, string] {
  if (!Number.isFinite(n)) return ["—", ""];
  const s = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const [whole, frac] = s.split(".");
  return [`${n < 0 ? "−" : ""}$${whole}`, `.${frac}`];
}

function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function signed(n: number): string {
  const s = `$${Math.abs(n).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
  return n < 0 ? `−${s}` : `+${s}`;
}

function signedPct(n: number): string {
  return `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(1)}%`;
}
