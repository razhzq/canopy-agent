"use client";

import { useMemo } from "react";
import { getPnlByToken, type AgentDetail, type UniverseAsset } from "@/lib/api";
import { markOpenBook } from "@/lib/perf";
import { useApi } from "@/lib/useApi";
import { useT } from "@/lib/i18n";

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
  universe: readonly Pick<UniverseAsset, "mint" | "symbol" | "priceUsd">[];
  onClose: () => void;
}) {
  const t = useT();
  const state = useApi((token) => getPnlByToken(token, agentId, { book, range }), [agentId, book, range]);

  const rows = useMemo(() => {
    const byMint = new Map<string, { symbol: string; net: number }>();
    if (state.phase === "ready") {
      for (const r of state.data.tokens) byMint.set(r.mint, { symbol: r.symbol, net: r.realizedUsd });
    }
    // Open lots, marked now. A lot the universe cannot price is left out rather
    // than carried at cost: a bar has no way to say "unknown".
    for (const p of positions) {
      if (!p.mint) continue;
      const mark = markOpenBook([p], universe);
      if (mark.unpriced.length > 0) continue;
      const row = byMint.get(p.mint) ?? { symbol: p.symbol, net: 0 };
      row.net += mark.unrealizedPnlUsd;
      byMint.set(p.mint, row);
    }
    return [...byMint.entries()]
      .map(([mint, r]) => ({ mint, ...r }))
      .filter((r) => Math.abs(r.net) >= 0.005)
      .sort((a, b) => b.net - a.net);
  }, [state, positions, universe]);

  const total = rows.reduce((s, r) => s + r.net, 0);
  const winners = rows.filter((r) => r.net > 0).length;
  const max = rows.reduce((m, r) => Math.max(m, Math.abs(r.net)), 0);

  return (
    <div className="flex min-w-0 flex-col gap-3.5 border-t border-grid px-5 pt-5 pb-4 lg:w-[372px] lg:shrink-0 lg:border-t-0 lg:border-l">
      <div className="flex items-center justify-between gap-2">
        <span className="font-ui text-[12.5px] font-medium text-text-primary">{t("equity_by_token")}</span>
        <span className="flex items-center gap-2">
          {rows.length > 0 ? (
            <span className="font-ui text-[12px] text-text-muted">
              {t("equity_by_token_winners", { winners, count: rows.length })}{" "}
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
        // Scrolls rather than grows: the panel sits beside a curve of fixed
        // height, and a book of eighty tokens must not push the page apart.
        <ol className="max-h-[248px] space-y-2 overflow-y-auto pr-1">
          {rows.map((r) => {
            const w = max > 0 ? Math.max((Math.abs(r.net) / max) * 100, 1.5) : 0;
            return (
              <li key={r.mint} className="grid grid-cols-[76px_minmax(0,1fr)_64px] items-center gap-3">
                <span className="truncate font-mono text-[11.5px] text-text-primary" title={r.symbol}>
                  {r.symbol}
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
      )}
    </div>
  );
}

function signed(n: number): string {
  const a = Math.abs(n);
  const body = `$${a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: a < 1000 ? 2 : 0 })}`;
  return n < 0 ? `−${body}` : `+${body}`;
}
