"use client";

import { useEffect, useMemo, useState } from "react";
import { getPnlByToken, type AgentDetail, type UniverseAsset } from "@/lib/api";
import { markOpenBook } from "@/lib/perf";
import { useApi } from "@/lib/useApi";
import { useT } from "@/lib/i18n";
import { AssetLogo } from "@/components/ui";

/**
 * Where the money came from: net P&L per token, beside the equity curve.
 *
 * One row per token — the ticker, a pale track with a bar growing from a
 * centre line (winners right, losers left), and the figure. Nothing else: the
 * curve beside it already carries the time series, and a table of columns here
 * would be a second report competing with the first.
 *
 * NET = REALISED + UNREALISED. Realised comes from the server, summed over the
 * closed trades in the curve's window. Unrealised is marked here, per open lot,
 * with `markOpenBook` against the same live universe the positions table uses —
 * so a token's bar and its row in Positions can never disagree.
 */
export function ByToken({
  agentId,
  book,
  range,
  positions,
  universe,
  onClose,
}: {
  agentId: number;
  book: "paper" | "live";
  range: "24h" | "7d" | "all";
  positions: AgentDetail["positions"];
  universe: readonly Pick<UniverseAsset, "mint" | "symbol" | "priceUsd" | "iconUrl">[];
  onClose: () => void;
}) {
  const t = useT();
  const state = useApi((token) => getPnlByToken(token, agentId, { book, range }), [agentId, book, range]);

  const rows = useMemo(() => {
    const byMint = new Map<string, { symbol: string; net: number; icon: string | null }>();
    if (state.phase === "ready") {
      for (const r of state.data.tokens) {
        byMint.set(r.mint, { symbol: r.symbol, net: r.realizedUsd, icon: r.iconUrl ?? null });
      }
    }
    // Open lots, marked now. Every held token gets a row — it has been traded
    // — but a lot the universe cannot price adds nothing to it rather than
    // being carried at cost: a bar has no way to say "unknown".
    for (const p of positions) {
      if (!p.mint) continue;
      const row = byMint.get(p.mint) ?? { symbol: p.symbol, net: 0, icon: null };
      const mark = markOpenBook([p], universe);
      if (mark.unpriced.length === 0) row.net += mark.unrealizedPnlUsd;
      byMint.set(p.mint, row);
    }
    // The server's icon first; the live universe's when the token table has
    // none; the monogram AssetLogo draws when neither does.
    const icons = new Map(universe.filter((a) => a.mint).map((a) => [a.mint!, a.iconUrl ?? null]));
    return [...byMint.entries()]
      .map(([mint, r]) => ({ mint, ...r, icon: r.icon ?? icons.get(mint) ?? null }))
      // EVERY TOKEN TRADED, winners and losers, ordered by how much it moved
      // the book either way. Sorted best-first, a book of more than a page
      // put every loser on the last page and the first read as all green.
      // Ties (break-evens) fall to the end, alphabetically.
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.symbol.localeCompare(b.symbol));
  }, [state, positions, universe]);

  // PAGED, not scrolled: eight rows a page, so the drawer keeps one height
  // beside a curve of fixed height and every page is read whole. The summary
  // above and the bar scale below stay whole-book — a bar's length means the
  // same thing on page 2 as on page 1.
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [agentId, book, range]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE);

  const total = rows.reduce((s, r) => s + r.net, 0);
  const winners = rows.filter((r) => r.net > 0).length;
  const losers = rows.filter((r) => r.net < 0).length;
  const max = rows.reduce((m, r) => Math.max(m, Math.abs(r.net)), 0);

  return (
    <div className="flex min-w-0 flex-col gap-3.5 px-5 pt-5 pb-4 lg:w-[372px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-ui text-[12.5px] font-medium text-text-primary">{t("equity_by_token")}</span>
        <span className="flex items-center gap-2">
          {rows.length > 0 ? (
            <span className="font-ui text-[12px] text-text-muted">
              {t("equity_by_token_split", { winners, losers })}{" "}
              <span className={`tnum font-mono ${total >= 0 ? "text-accent" : "text-negative"}`}>{signed(total)}</span>
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("equity_by_token_close")}
            className="flex size-[22px] items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </span>
      </div>

      {state.phase === "loading" && rows.length === 0 ? (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-3.5 animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="font-ui text-[12px] leading-relaxed text-text-muted">
          {state.phase === "error" ? t("equity_by_token_error") : t("equity_by_token_empty")}
        </p>
      ) : (
        <>
        <ol className="space-y-2">
          {shown.map((r) => {
            const w = max > 0 ? Math.max((Math.abs(r.net) / max) * 100, 1.5) : 0;
            return (
              <li key={r.mint} className="grid grid-cols-[96px_minmax(0,1fr)_64px] items-center gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <AssetLogo symbol={r.symbol} src={r.icon} size={16} />
                  <span className="truncate font-mono text-[11.5px] text-text-primary" title={r.symbol}>
                    {r.symbol}
                  </span>
                </span>
                <span className="flex h-3.5 overflow-hidden rounded-[3px] bg-surface-2" aria-hidden>
                  <span className="flex flex-1 justify-end">
                    {r.net < 0 ? <span className="h-full rounded-l-[3px] bg-negative" style={{ width: `${w}%` }} /> : null}
                  </span>
                  <span className="flex flex-1">
                    {r.net > 0 ? <span className="h-full rounded-r-[3px] bg-accent" style={{ width: `${w}%` }} /> : null}
                  </span>
                </span>
                <span className={`tnum text-right font-mono text-[11.5px] ${r.net >= 0 ? "text-accent" : "text-negative"}`}>
                  {signed(r.net)}
                </span>
              </li>
            );
          })}
        </ol>
        {pages > 1 ? (
          <div className="mt-auto flex items-center justify-between border-t border-grid pt-3">
            <span className="tnum font-mono text-[11.5px] text-text-muted">
              {t("equity_by_token_page", {
                from: current * PAGE + 1,
                to: current * PAGE + shown.length,
                count: rows.length,
              })}
            </span>
            <span className="flex gap-1.5">
              {([
                [-1, "m15 18-6-6 6-6", t("equity_by_token_prev")],
                [1, "m9 18 6-6-6-6", t("equity_by_token_next")],
              ] as const).map(([step, path, label]) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setPage(current + step)}
                  disabled={step < 0 ? current === 0 : current >= pages - 1}
                  aria-label={label}
                  className="flex size-7 items-center justify-center rounded-lg border border-grid text-text-secondary transition-colors hover:border-grid-strong hover:text-text-primary disabled:cursor-default disabled:opacity-35 disabled:hover:border-grid"
                >
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={path} />
                  </svg>
                </button>
              ))}
            </span>
          </div>
        ) : null}
        </>
      )}
    </div>
  );
}

/** Tokens per page. */
const PAGE = 8;

function signed(n: number): string {
  const a = Math.abs(n);
  const body = `$${a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: a < 1000 ? 2 : 0 })}`;
  return n < 0 ? `−${body}` : `+${body}`;
}
