"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Flame, SlidersHorizontal, TrendingUp } from "lucide-react";

import { EmptyState } from "@/components/states";
import { MiniCurve } from "@/components/charts";
import { useAccountBalance } from "@/lib/useAccountBalance";
import { hitRatePct, num, return30dPct, type StrategyRow } from "@/lib/api";
import { useT, type TranslationKey } from "@/lib/i18n";

/**
 * The mobile home — wireframe M01.
 *
 * THIS IS EXPLORE, NOT MY AGENTS. The list is every published strategy, which
 * is what makes it a home screen rather than a dashboard: you open the app to
 * see what is worth deploying, and the weekly performers strip is the whole
 * point of the design. Your own agents live on the profile, which is where the
 * wireframe puts them.
 *
 * What is yours here is the headline — the balance and the way to add to it —
 * because the one thing a discovery screen still owes you is what you have to
 * spend.
 *
 * Measurements are the .pen's: 34px balance with the cents dropped to
 * $text-muted, a 196-wide card strip, 34px chips at radius 10, and 44px agent
 * glyphs at radius 13. They are written out rather than approximated because
 * "close enough" is what made the first attempt look like a different product.
 */

type Chip = "all" | "top" | "new" | "held";

// Keys rather than labels — the table is module-level and cannot call a hook.
const CHIPS: { key: Chip; labelKey: TranslationKey }[] = [
  { key: "all", labelKey: "home_chip_all" },
  { key: "top", labelKey: "home_chip_top" },
  { key: "new", labelKey: "home_chip_new" },
  { key: "held", labelKey: "home_chip_held" },
];

export function HomeFeed({ strategies }: { strategies: StrategyRow[] }) {
  const t = useT();
  const balance = useAccountBalance();
  const [chip, setChip] = useState<Chip>("all");

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
    const list = [...strategies];
    if (chip === "top") return list.sort((a, b) => (return30dPct(b) ?? 0) - (return30dPct(a) ?? 0));
    if (chip === "new")
      return list.sort(
        (a, b) =>
          new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime(),
      );
    if (chip === "held")
      return list.sort((a, b) => (num(b.deployments) ?? 0) - (num(a.deployments) ?? 0));
    return list;
  }, [strategies, chip]);

  const [whole, cents] = splitMoney(balance.equityUsd);

  return (
    <div className="lg:hidden">
      {/* ------------------------------------------------------ balance -- */}
      <div className="px-[18px] pt-3.5 pb-[18px]">
        <div className="space-y-[5px]">
          <p className="flex items-end font-mono text-[34px] leading-none font-semibold tracking-[-1.2px]">
            {/* Cents in $text-muted: the figure people read is the dollars, and
                dropping the cents back stops two decimal places competing with
                four significant ones. */}
            {/* A dash until the fan-out lands, never a zero — an account
                with money in it must not render as empty for a beat. */}
            <span className="text-text-primary">{balance.loaded ? whole : "—"}</span>
            <span className="text-text-muted">{balance.loaded ? cents : ""}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <span
              className={`font-mono text-[13px] font-semibold ${
                (balance.moved24hUsd ?? 0) >= 0 ? "text-accent" : "text-negative"
              }`}
            >
              {balance.moved24hUsd === null ? "—" : signed(balance.moved24hUsd)}
            </span>
            <span className="font-mono text-[9.5px] font-semibold tracking-[0.7px] text-text-dim uppercase">
              {balance.agents === 1
                ? t("home_balance_window_one")
                : t("home_balance_window_many", { count: balance.agents })}
            </span>
          </p>
        </div>
      </div>

      {/* ---------------------------------------------- top performers -- */}
      {top.length > 0 ? (
        <div className="space-y-[11px] pt-0.5 pb-4">
          <div className="flex items-center gap-[7px] px-[18px]">
            <Flame className="size-[15px] text-warning" aria-hidden />
            <span className="font-mono text-[10.5px] font-semibold tracking-[0.9px] text-text-secondary uppercase">
              {t("home_top_performers")}
            </span>
          </div>
          {/* Overflows on purpose — a card clipped at the right edge is what
              says there are more. */}
          <div className="flex gap-2.5 overflow-x-auto px-[18px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {top.map((x) => {
              const pct = return30dPct(x) ?? 0;
              return (
                <Link
                  key={x.id}
                  href={`/agents/${x.id}`}
                  className="w-[196px] shrink-0 space-y-[11px] rounded-[14px] border border-border bg-panel px-3.5 py-[13px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-surface-2">
                      <TrendingUp className="size-[13px] text-accent" aria-hidden />
                    </span>
                    <span className="truncate font-ui text-[13.5px] font-semibold tracking-[-0.2px] text-text-primary">
                      {x.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[14px] font-semibold ${pct >= 0 ? "text-accent" : "text-negative"}`}>
                      {signedPct(pct)}
                    </span>
                    <span className="font-mono text-[8.5px] font-semibold tracking-[0.6px] text-text-dim uppercase">
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
      <div className="flex h-[60px] items-center gap-2 overflow-x-auto px-[18px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="flex size-9 h-[34px] w-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface">
          <SlidersHorizontal className="size-[15px] text-text-secondary" aria-hidden />
        </span>
        {CHIPS.map((c) => {
          const on = chip === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setChip(c.key)}
              aria-pressed={on}
              className={`flex h-[34px] shrink-0 items-center rounded-[10px] border px-3.5 font-ui text-[13.5px] transition-colors ${
                on
                  ? "border-border bg-surface-2 font-semibold text-text-primary"
                  : "border-border-soft font-medium text-text-secondary"
              }`}
            >
              {t(c.labelKey)}
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------------------- list -- */}
      {shown.length === 0 ? (
        <div className="px-[18px] py-8">
          <EmptyState
            title={t("home_empty_title")}
            body={t("home_empty_body")}
            action={{ label: t("home_empty_action"), href: "/build/new" }}
          />
        </div>
      ) : (
        <ul className="px-[18px] pt-0.5">
          {shown.map((x, i) => (
            <StrategyFeedRow key={x.id} row={x} first={i === 0} />
          ))}
        </ul>
      )}

    </div>
  );
}

function StrategyFeedRow({ row, first }: { row: StrategyRow; first: boolean }) {
  const t = useT();
  const pct = return30dPct(row);
  const hit = hitRatePct(row);
  const deployments = num(row.deployments) ?? 0;
  const aum = num(row.aum_usd);
  const spark = (row.spark ?? []).map(Number).filter(Number.isFinite);

  return (
    <li className={first ? "" : "border-t border-grid"}>
      <Link href={`/agents/${row.id}`} className="flex items-center gap-3 py-[11px]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] border border-border bg-surface-2">
          <TrendingUp className="size-5 text-accent" aria-hidden />
        </span>

        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-ui text-[15px] font-semibold tracking-[-0.2px] text-text-primary">
              {row.name}
            </span>
            <span className="shrink-0 rounded bg-surface-2 px-[5px] py-0.5 font-mono text-[8.5px] font-semibold tracking-[0.6px] text-text-secondary uppercase">
              {row.all_paper ? t("home_badge_paper") : row.strategy_class}
            </span>
          </span>
          <span className="block font-mono text-[11.5px] text-text-dim">
            {hit === null
              ? t("home_row_deployed", { count: deployments })
              : t("home_row_deployed_win", { count: deployments, pct: hit.toFixed(0) })}
          </span>
        </span>

        {/* The strategy's own equity readings, not a generated shape. */}
        {spark.length > 1 ? (
          <span className="hidden shrink-0 sm:block">
            <MiniCurve values={spark} tone={(pct ?? 0) >= 0 ? "accent" : "negative"} width={64} height={24} />
          </span>
        ) : null}

        <span className="shrink-0 space-y-1 text-right">
          <span className="block font-mono text-[15px] font-semibold text-text-primary">
            {aum === null ? "—" : money(aum)}
          </span>
          <span
            className={`block font-mono text-[12.5px] font-semibold ${
              pct === null ? "text-text-dim" : pct >= 0 ? "text-accent" : "text-negative"
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
  const s = `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  return n < 0 ? `−${s}` : `+${s}`;
}

function signedPct(n: number): string {
  return `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(1)}%`;
}
