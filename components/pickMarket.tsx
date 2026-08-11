"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  getUniverse,
  num,
  peekUniverse,
  type UniverseAsset,
  type UniverseSelection,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { AssetLogo } from "@/components/ui";

/**
 * Step 1 — pick the market. Wireframe 1d.
 *
 * ONE MARKET, NOT A UNIVERSE
 *
 * The wireframe is single-select: "one pick sets the asset and the market", and
 * further markets are added later from the agent's own page, sharing its
 * strategy. That is a real change from the multi-asset screen this replaces,
 * and it needed no backend work — a universe of one is what applySelection
 * already stores.
 *
 * Keyboard-first, as specified: ↑↓ to move, ⏎ to take, / to search. A list of
 * eight is quick with a mouse; a list of eighty is not, and this is the screen
 * that grows.
 */

const CLASSES = [
  { key: "all", label: "All" },
  { key: "equity", label: "Equities" },
  { key: "commodity", label: "Commodities" },
  { key: "etf", label: "Funds" },
] as const;

export function PickMarket({
  value,
  onChange,
  onNext,
}: {
  value: UniverseSelection | null;
  onChange: (next: UniverseSelection, asset: UniverseAsset) => void;
  onNext: () => void;
}) {
  const { authenticated } = usePrivy();
  // Seeded from the module cache, so stepping back here from limits shows the
  // list it was already showing instead of a skeleton. `peekUniverse` is empty
  // on a cold load and on the server, so the first render of the page is
  // unchanged and there is nothing for hydration to disagree about.
  const universe = useApi((t) => getUniverse(t, "rwa"), [], peekUniverse("rwa") ?? undefined);
  const [query, setQuery] = useState("");
  const [klass, setKlass] = useState<string>("all");
  const [cursor, setCursor] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const assets = universe.phase === "ready" ? universe.data.assets : [];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter(
      (a) =>
        (klass === "all" || a.assetClass === klass) &&
        (q === "" ||
          a.symbol.toLowerCase().includes(q) ||
          a.underlying.toLowerCase().includes(q) ||
          a.issuer.toLowerCase().includes(q)),
    );
  }, [assets, query, klass]);

  // Keyboard navigation over the whole step, not just the input — the table is
  // the subject of the page, so arrows should drive it wherever focus sits.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = document.activeElement === search.current;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        search.current?.focus();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => {
          const next = e.key === "ArrowDown" ? c + 1 : c - 1;
          return Math.max(0, Math.min(next, rows.length - 1));
        });
        return;
      }
      if (e.key === "Enter" && rows[cursor]) {
        e.preventDefault();
        const a = rows[cursor];
        onChange({ underlying: a.underlying, issuer: a.issuer }, a);
        onNext();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rows, cursor, onChange, onNext]);

  // Keep the cursor in view as it moves past the fold.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${cursor}"]`)?.scrollIntoView({
      block: "nearest",
    });
  }, [cursor]);

  const chosen = (a: UniverseAsset) =>
    value?.underlying === a.underlying && value?.issuer === a.issuer;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-mono text-[10px] tracking-[0.12em] text-text-dim uppercase">
          Step 1 of 2 · Assign
        </p>
        <h2 className="font-mono text-[22px] leading-none text-text-primary">
          Pick what you&apos;re trading
        </h2>
        <p className="max-w-[68ch] font-ui text-[13.5px] leading-relaxed text-text-secondary">
          One pick sets the asset and the market. Tokenized real-world assets — equities and
          commodities, wrapped on Solana. The token trades around the clock; the underlying keeps
          its own hours, and the agent respects them.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {CLASSES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setKlass(c.key);
                setCursor(0);
              }}
              className={`h-8 rounded-full border px-3.5 font-mono text-[11px] transition-colors ${
                klass === c.key
                  ? "border-accent bg-accent-wash text-accent"
                  : "border-border text-text-secondary hover:border-grid-strong"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={search}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder="Search markets…  /"
            spellCheck={false}
            aria-label="Search markets"
            className="h-9 w-[210px] border-b border-grid-strong bg-transparent font-mono text-[12.5px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent"
          />
          <span className="font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
            {rows.length} {rows.length === 1 ? "market" : "markets"}
          </span>
        </div>
      </div>

      {universe.phase === "loading" ? (
        <Note>Resolving tradable markets…</Note>
      ) : universe.phase === "signed-out" || !authenticated ? (
        <Note>Sign in to see which markets are tradable.</Note>
      ) : universe.phase === "error" ? (
        <Note tone="negative">Could not load markets — {universe.message}</Note>
      ) : rows.length === 0 ? (
        <Note tone="warning">
          {assets.length === 0
            ? "No market currently resolves as tradable."
            : `Nothing matches “${query}”.`}
        </Note>
      ) : (
        <div ref={listRef} className="border border-grid">
          <div className="grid grid-cols-[minmax(0,1fr)_110px_90px_120px] items-center gap-x-4 border-b border-grid px-4 py-2.5 font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase">
            <span>Market</span>
            <span className="text-right">Price</span>
            <span className="text-right">24h</span>
            {/* Not "volume": nothing here measures traded volume. */}
            <span className="text-right">Pool depth</span>
          </div>

          {rows.map((a, i) => (
            <button
              key={`${a.underlying}/${a.issuer}`}
              type="button"
              data-row={i}
              onMouseEnter={() => setCursor(i)}
              onClick={() => {
                onChange({ underlying: a.underlying, issuer: a.issuer }, a);
                onNext();
              }}
              className={`grid w-full grid-cols-[minmax(0,1fr)_110px_90px_120px] items-center gap-x-4 border-b border-grid px-4 py-3 text-left transition-colors last:border-b-0 ${
                i === cursor ? "bg-panel" : ""
              } ${chosen(a) ? "bg-accent-wash" : ""}`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <AssetLogo symbol={a.underlying} issuer={a.issuer} size={18} />
                <span
                  className={`truncate font-mono text-[13px] ${
                    chosen(a) ? "text-accent" : "text-text-primary"
                  }`}
                >
                  {a.symbol}/USDC
                </span>
                <span className="truncate font-ui text-[11px] text-text-dim">
                  {a.assetClass === "commodity" ? "Tokenized commodity" : "Tokenized equity"} ·{" "}
                  {a.issuer}
                </span>
              </span>
              <span className="tnum text-right font-mono text-[12.5px] text-text-primary">
                {num(a.priceUsd) === null ? "—" : `$${fmt(num(a.priceUsd)!)}`}
              </span>
              <span
                className={`tnum text-right font-mono text-[12.5px] ${
                  num(a.changePct) === null
                    ? "text-text-dim"
                    : num(a.changePct)! >= 0
                      ? "text-accent"
                      : "text-negative"
                }`}
              >
                {num(a.changePct) === null
                  ? "—"
                  : `${num(a.changePct)! >= 0 ? "+" : ""}${num(a.changePct)!.toFixed(1)}%`}
              </span>
              <span className="tnum text-right font-mono text-[12.5px] text-text-secondary">
                {num(a.liquidityUsd) === null ? "—" : money(num(a.liquidityUsd)!)}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-5 font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
        <span>↑↓ navigate</span>
        <span>⏎ select</span>
        <span>/ search</span>
      </div>
    </div>
  );
}

function Note({ children, tone }: { children: React.ReactNode; tone?: "warning" | "negative" }) {
  return (
    <p
      className={`border border-grid bg-panel px-5 py-8 text-center font-ui text-[13px] ${
        tone === "negative"
          ? "text-negative"
          : tone === "warning"
            ? "text-warning"
            : "text-text-secondary"
      }`}
    >
      {children}
    </p>
  );
}

function fmt(n: number): string {
  return n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toFixed(2);
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
