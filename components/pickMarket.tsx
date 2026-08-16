"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tokenPrice } from "@/lib/format";
import { usePrivy } from "@privy-io/react-auth";
import {
  marketKey,
  peekAllMarkets,
  getAllMarkets,
  num,
  type UniverseAsset,
  type UniverseSelection,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import {
  describeClass, AssetLogo } from "@/components/ui";

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

/**
 * The categories, and what each one admits.
 *
 * ETFs sit under stocks rather than getting a chip of their own: a tokenized
 * index fund is an equity position to everyone choosing one here, and a fourth
 * category holding a single asset is a worse list than a third holding two.
 *
 * The choice is not cosmetic. A strategy has exactly ONE class — one specialist
 * screens it — so the category picked here decides which specialist runs and,
 * in the next step, which rules can even apply.
 */
export const MARKET_CLASSES = [
  { key: "all", label: "All", admits: () => true },
  {
    key: "stocks",
    label: "Tokenized stocks",
    admits: (a: UniverseAsset) => a.assetClass === "equity" || a.assetClass === "etf",
  },
  {
    key: "commodity",
    label: "Commodities",
    admits: (a: UniverseAsset) => a.assetClass === "commodity",
  },
  { key: "token", label: "Crypto", admits: (a: UniverseAsset) => a.kind === "crypto" },
] as const;

/** Kept so this file reads unchanged; the picker and the add-market modal
 *  now share one definition, because two lists of the same chips drift. */
const CLASSES = MARKET_CLASSES;

/**
 * Step 1 — choose what the agent may trade.
 *
 * MULTI-SELECT, because the engine always was.
 *
 * Both specialists loop over `this.opts.universe` and an auto strategy screens
 * up to sixty assets; the single-market limit lived entirely in this component
 * and in one line of buildAgent. A strategy that says "buy RSI-oversold dips"
 * has no reason to be pinned to one ticker.
 *
 * MIXED CLASSES ARE ALLOWED.
 *
 * This used to replace the selection when you crossed classes, because the loop
 * ran ONE specialist and the two evaluate different facts — a tokenized stock
 * has fundamentals and no ATR, a token the reverse. A mixed universe therefore
 * meant half of it silently failing rules the other half satisfied.
 *
 * The loop now runs both and merges (see MultiSme), so the restriction is gone.
 * What remains true is that a rule can only be measured on assets that carry
 * the fact it names — a margin rule cannot screen a token — and that is
 * surfaced when the strategy is composed, not by refusing the pick.
 */
export function PickMarket({
  value,
  onChange,
  onNext,
}: {
  value: UniverseAsset[];
  /** The whole selection, every time — the parent never merges. */
  onChange: (next: UniverseAsset[]) => void;
  onNext: () => void;
}) {
  const { authenticated } = usePrivy();
  // Seeded from the module cache, so stepping back here from limits shows the
  // list it was already showing instead of a skeleton. `peekUniverse` is empty
  // on a cold load and on the server, so the first render of the page is
  // unchanged and there is nothing for hydration to disagree about.
  // Every class at once. The categories below are a view over one list rather
  // than four separate fetches, so switching chips never waits on the network.
  const universe = useApi((t) => getAllMarkets(t), [], peekAllMarkets() ?? undefined);
  const [query, setQuery] = useState("");
  const [klass, setKlass] = useState<string>("all");
  const [cursor, setCursor] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const assets = universe.phase === "ready" ? universe.data : [];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const admits = CLASSES.find((c) => c.key === klass)?.admits ?? (() => true);
    return assets.filter(
      (a) =>
        admits(a) &&
        (q === "" ||
          a.symbol.toLowerCase().includes(q) ||
          (a.name ?? "").toLowerCase().includes(q) ||
          (a.underlying ?? "").toLowerCase().includes(q) ||
          (a.issuer ?? "").toLowerCase().includes(q)),
    );
  }, [assets, query, klass]);

  /**
   * Tickers held by more than one asset on screen.
   *
   * Ticker collisions are ordinary on a permissionless chain — the universe
   * carries three CATs and two each of DOG, GOLD and WOJAK — and every one of
   * them is a genuinely different token that happened to pick the same three
   * letters. Selection is keyed on the mint, so the ENGINE is never confused;
   * the person choosing from two identical-looking rows is.
   *
   * Computed over the FILTERED rows rather than the whole universe: a name is
   * only worth the horizontal space when the ambiguity is actually visible. A
   * search narrowed to one CAT does not need to explain which CAT it is.
   */
  const ambiguous = useMemo(() => {
    const seen = new Map<string, number>();
    for (const a of rows) {
      const key = a.symbol.toUpperCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return new Set([...seen].filter(([, n]) => n > 1).map(([sym]) => sym));
  }, [rows]);

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
        // Toggles rather than advancing. Advancing on Enter made sense when one
        // pick WAS the whole selection; with several it would end the step on
        // the first choice.
        e.preventDefault();
        toggle(rows[cursor]);
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

  /**
   * Identity: mint for crypto, issuer+underlying for RWA.
   *
   * `marketKey` from the data layer rather than a copy, because the list is
   * deduped on that definition and these rows are keyed on this one. Two
   * definitions of "the same asset" that disagree put duplicate keys back.
   */
  const idOf = marketKey;

  const chosen = (a: UniverseAsset) => value.some((v) => idOf(v) === idOf(a));

  /**
   * Adds or removes one market.
   *
   * Picking an asset from a different CLASS clears the rest rather than mixing:
   * a strategy has one specialist, and a universe spanning both would leave half
   * of it unable to satisfy rules the other half was written for.
   */
  const toggle = (a: UniverseAsset) => {
    const already = chosen(a);
    if (already) {
      onChange(value.filter((v) => idOf(v) !== idOf(a)));
      return;
    }
    // Mixing is allowed. The tick screens each half with its own specialist
    // (MultiSme), so a universe of tokenized equities AND tokens is a supported
    // shape rather than one that would half-silently fail.
    onChange([...value, a]);
  };

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
          Pick one or several — the agent screens every market you choose, on the same rules, and
          buys whichever qualify. Tokenized stocks and commodities keep their underlying&apos;s
          trading hours even though the token trades around the clock; crypto never closes.
          Everything must come from one category, because a single specialist screens them all,
          and that choice decides which rules are available in the next step.
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
              // `idOf`, the same identity selection is keyed on, rather than a
              // second hand-rolled one. The old key was the bare mint, which
              // collides the moment one asset reaches this list twice — and a
              // duplicate key is not a warning to live with: React reuses rows
              // across a re-render, so a filter change can leave the previous
              // category's rows on screen.
              key={idOf(a)}
              type="button"
              data-row={i}
              onMouseEnter={() => setCursor(i)}
              onClick={() => toggle(a)}
              className={`grid w-full grid-cols-[minmax(0,1fr)_110px_90px_120px] items-center gap-x-4 border-b border-grid px-4 py-3 text-left transition-colors last:border-b-0 ${
                i === cursor ? "bg-panel" : ""
              } ${chosen(a) ? "bg-accent-wash" : ""}`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <AssetLogo symbol={a.underlying ?? a.symbol} issuer={a.issuer} src={a.iconUrl} size={18} />
                <span
                  className={`truncate font-mono text-[13px] ${
                    chosen(a) ? "text-accent" : "text-text-primary"
                  }`}
                >
                  {a.symbol}/USDC
                </span>
                <span className="truncate font-ui text-[11px] text-text-dim">
                  {describeClass(a)}
                  {a.issuer ? ` · ${a.issuer}` : ""}
                  {/*
                    Only when the ticker is genuinely ambiguous on screen. The
                    name comes first because it is what a person recognises;
                    the mint prefix is the tiebreak for the case the name does
                    not settle, since two tokens may share both.
                  */}
                  {ambiguous.has(a.symbol.toUpperCase())
                    ? ` · ${a.name ?? `${a.mint?.slice(0, 4)}…`}`
                    : ""}
                </span>
              </span>
              <span className="tnum text-right font-mono text-[12.5px] text-text-primary">
                {tokenPrice(num(a.priceUsd)).display}
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

      {/* The step no longer ends on a click, so it needs a way to end. */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-grid pt-5">
        <div className="flex flex-wrap items-center gap-5 font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
          <span>↑↓ navigate</span>
          <span>⏎ add or remove</span>
          <span>/ search</span>
        </div>

        <div className="flex items-center gap-4">
          {value.length > 0 ? (
            <span className="font-ui text-[12.5px] text-text-secondary">
              {/* Named, not just counted, while the list is short enough to read.
                  "3 markets" is a number; "AAPLx, NVDAx, MSFTx" is the decision. */}
              {value.length <= 4
                ? value.map((a) => a.symbol).join(", ")
                : `${value.length} markets`}{" "}
              <span className="text-text-dim">
                · {describeClass(value[0])}
              </span>
            </span>
          ) : null}
          <button
            type="button"
            onClick={onNext}
            disabled={value.length === 0}
            className="border border-border px-5 py-2.5 font-mono text-[11px] tracking-[0.08em] text-text-primary uppercase transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {value.length === 0 ? "Pick a market" : "Continue"}
          </button>
        </div>
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



function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
