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
import { AssetLogo } from "@/components/ui";
import { LABEL, SURFACE } from "@/components/kit";
import { RouteBadge, routeOf, type Router } from "@/components/routeBadge";
import { useT, type TranslationKey } from "@/lib/i18n";

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
/**
 * VENUE IS A SECOND AXIS, NOT A FIFTH CHIP.
 *
 * "CLOB" or "KalqiX" cannot join the list below without breaking it. These
 * chips are a partition — every market lands in exactly one, and which one
 * decides the specialist — while a KalqiX cbBTC is crypto AND an order book.
 * Adding it here would put the same row under two chips and imply a specialist
 * that does not exist. So the venue filter is its own control: it composes with
 * the class instead of competing with it, and it appears only once the universe
 * actually reports more than one venue.
 */

/**
 * What each venue is called in the filter — which is not always its name.
 *
 * KalqiX used to read as "CLOB DEX" here — the structure someone reaches for
 * this control to filter on, rather than a brand. That worked while there was
 * one order book. There are now two: PhantX is KalqiX's whitelabel, the same
 * listings through a different account, and an agent trades one of them. Two
 * chips both saying "CLOB DEX" would be a control that cannot be used, so the
 * structure name gives way to the names that actually distinguish them.
 *
 * The key order is the order of the buttons.
 *
 * Exported for the add-market dialog, which filters the same universe and must
 * not invent a second name for the same venue — the dialog draws the control as
 * a dropdown rather than chips, but the words have to match.
 */
export const VENUE_LABEL: Record<Router, TranslationKey | "Jupiter" | "KalqiX" | "PhantX"> = {
  // Brands, not descriptions — they read the same in every language.
  jupiter: "Jupiter",
  kalqix: "KalqiX",
  phantx: "PhantX",
};

/**
 * Every entry is a brand today, so nothing needs resolving — but the signature
 * keeps `t` and the table keeps its union: the moment a venue is best named by
 * what it IS rather than what it is called, that entry becomes a key again and
 * only this function changes.
 */
export function venueLabel(
  router: Router,
  t: (k: TranslationKey) => string,
): string {
  const entry = VENUE_LABEL[router];
  return entry === "Jupiter" || entry === "KalqiX" || entry === "PhantX"
    ? entry
    : t(entry);
}

export const MARKET_CLASSES = [
  { key: "all", labelKey: "mk_class_all" as TranslationKey, admits: () => true },
  {
    key: "stocks",
    labelKey: "mk_class_stocks" as TranslationKey,
    admits: (a: UniverseAsset) => a.assetClass === "equity" || a.assetClass === "etf",
  },
  {
    key: "commodity",
    labelKey: "mk_class_commodity" as TranslationKey,
    admits: (a: UniverseAsset) => a.assetClass === "commodity",
  },
  {
    key: "token",
    labelKey: "mk_class_token" as TranslationKey,
    admits: (a: UniverseAsset) => a.kind === "crypto",
  },
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
  const t = useT();
  // Seeded from the module cache, so stepping back here from limits shows the
  // list it was already showing instead of a skeleton. `peekUniverse` is empty
  // on a cold load and on the server, so the first render of the page is
  // unchanged and there is nothing for hydration to disagree about.
  // Every class at once. The categories below are a view over one list rather
  // than four separate fetches, so switching chips never waits on the network.
  const universe = useApi((t) => getAllMarkets(t), [], peekAllMarkets() ?? undefined);
  const [query, setQuery] = useState("");
  const [klass, setKlass] = useState<string>("all");
  /** A router key, or "all". Independent of the class chips — see the note above. */
  const [venue, setVenue] = useState<Router | "all">("all");
  const [cursor, setCursor] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const assets = universe.phase === "ready" ? universe.data : [];

  /**
   * The venues actually present in the loaded universe, in the order
   * {@link VENUE_LABEL} lists them.
   *
   * Derived rather than hardcoded: a filter offering KalqiX on a day the
   * backend returned no KalqiX listing is a control that can only produce an
   * empty list. The filter disappears entirely while there is one venue to
   * choose from — a one-option filter is furniture.
   */
  const venuesPresent = useMemo(() => {
    const seen = new Set<Router>();
    for (const a of assets) seen.add(routeOf(a).router);
    return (Object.keys(VENUE_LABEL) as Router[]).filter((r) => seen.has(r));
  }, [assets]);

  // A venue can leave the universe between loads. Fall back rather than show an
  // empty list under a chip that is still lit.
  useEffect(() => {
    if (venue !== "all" && !venuesPresent.includes(venue)) setVenue("all");
  }, [venue, venuesPresent]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const admits = CLASSES.find((c) => c.key === klass)?.admits ?? (() => true);
    return assets.filter(
      (a) =>
        admits(a) &&
        (venue === "all" || routeOf(a).router === venue) &&
        (q === "" ||
          a.symbol.toLowerCase().includes(q) ||
          (a.name ?? "").toLowerCase().includes(q) ||
          (a.underlying ?? "").toLowerCase().includes(q) ||
          (a.issuer ?? "").toLowerCase().includes(q)),
    );
  }, [assets, query, klass, venue]);

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
      // A focused FILTER owns ⏎. Without this, tabbing to a class or venue
      // button and pressing Enter toggles a market instead of the control the
      // reader is standing on. Row buttons are the exception and keep the old
      // behaviour: ⏎ takes the row the CURSOR is on, which is not necessarily
      // the row that happens to hold focus after a click.
      const focused = document.activeElement;
      if (
        e.key === "Enter" &&
        focused instanceof HTMLButtonElement &&
        !focused.hasAttribute("data-row")
      ) {
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
          {t("mk_step")}
        </p>
        <h2 className="font-mono text-[22px] leading-none text-text-primary">
          {t("mk_title")}
        </h2>
        <p className="max-w-[68ch] font-ui text-[13.5px] leading-relaxed text-text-secondary">
          {t("mk_intro")}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
                {t(c.labelKey)}
              </button>
            ))}
          </div>

          {/*
            The venue filter, as a dropdown rather than pills.
            
            It used to be the same pill as the class chips, on the reasoning
            that one shape read as one family of filters. That held while the
            row was "All · Jupiter · KalqiX" — three options beside four class
            chips. PhantX made it four, and seven pills on one line is a row
            you scan rather than read, with the two axes running into each
            other exactly where the rule was supposed to separate them.

            A dropdown states the current venue in one control's width and
            costs a click only when someone actually wants to change it —
            which is rarely, since the class chips are the filter people
            reach for. It also stops the row growing again the next time a
            venue is added. Same control the add-market dialog already uses,
            so the two surfaces filtering the same universe now look alike.
          */}
          {venuesPresent.length > 1 ? (
            <label className={`flex items-center gap-2 border-l border-grid pl-3 ${LABEL}`}>
              {t("mk_venue")}
              <select
                value={venue}
                onChange={(e) => {
                  setVenue(e.target.value as Router | "all");
                  setCursor(0);
                }}
                aria-label={t("mk_venue")}
                className={`${SURFACE} px-2 py-1 font-mono text-[11px] text-text-primary outline-none focus:border-accent`}
              >
                <option value="all" className="bg-bg">
                  {t("mk_venue_all")}
                </option>
                {venuesPresent.map((v) => (
                  <option key={v} value={v} className="bg-bg">
                    {venueLabel(v, t)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={search}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder={t("mk_search_placeholder")}
            spellCheck={false}
            aria-label={t("mk_search_aria")}
            className="h-9 w-[210px] border-b border-grid-strong bg-transparent font-mono text-[12.5px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent"
          />
          <span className="font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
            {rows.length === 1
              ? t("mk_count_one")
              : t("mk_count_many", { count: rows.length })}
          </span>
        </div>
      </div>

      {universe.phase === "loading" ? (
        <Note>{t("mk_resolving")}</Note>
      ) : universe.phase === "signed-out" || !authenticated ? (
        <Note>{t("mk_signed_out")}</Note>
      ) : universe.phase === "error" ? (
        <Note tone="negative">{t("mk_load_failed", { message: universe.message })}</Note>
      ) : rows.length === 0 ? (
        <Note tone="warning">
          {assets.length === 0
            ? t("mk_none_tradable")
            : query.trim()
              ? t("mk_no_query_match", { query })
              : t("mk_no_filter_match")}
        </Note>
      ) : (
        <div ref={listRef} className="border border-grid">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_110px_90px_120px] items-center gap-x-4 border-b border-grid px-4 py-2.5 font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase">
            <span>{t("mk_col_market")}</span>
            <span className="text-right">{t("mk_col_price")}</span>
            <span className="text-right">{t("mk_col_24h")}</span>
            {/* Not "volume": nothing here measures traded volume. */}
            <span className="text-right">{t("mk_col_depth")}</span>
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
              className={`grid w-full grid-cols-1 sm:grid-cols-[minmax(0,1fr)_110px_90px_120px] items-center gap-x-4 border-b border-grid px-4 py-3 text-left transition-colors last:border-b-0 ${
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
                {/* Where it settles and who fills it. Per row, because that
                    stops being one answer as soon as a second chain lands. */}
                <RouteBadge {...routeOf(a)} size={15} />
                {/*
                  The asset class used to lead this line — "Crypto", "Tokenized
                  commodity". It went because the class is already the tab the
                  reader is standing in, and repeating it on every row spent the
                  only line of secondary text on the one fact the list does not
                  vary by.

                  What is left is what DOES vary: who wrapped it, and — only
                  when the ticker is genuinely ambiguous on screen — the name.
                  The name comes first because it is what a person recognises;
                  the mint prefix is the tiebreak for the case the name does not
                  settle, since two tokens may share both.
                */}
                {(() => {
                  const parts = [
                    a.issuer,
                    ambiguous.has(a.symbol.toUpperCase())
                      ? (a.name ?? `${a.mint?.slice(0, 4)}…`)
                      : null,
                  ].filter(Boolean);
                  return parts.length ? (
                    <span className="truncate font-ui text-[11px] text-text-dim">
                      {parts.join(" · ")}
                    </span>
                  ) : null;
                })()}
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
          <span>{t("mk_hint_navigate")}</span>
          <span>{t("mk_hint_toggle")}</span>
          <span>{t("mk_hint_search")}</span>
        </div>

        <div className="flex items-center gap-4">
          {value.length > 0 ? (
            <span className="font-ui text-[12.5px] text-text-secondary">
              {/* Named, not just counted, while the list is short enough to read.
                  "3 markets" is a number; "AAPLx, NVDAx, MSFTx" is the decision. */}
              {value.length <= 4
                ? value.map((a) => a.symbol).join(", ")
                : t("mk_count_many", { count: value.length })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onNext}
            disabled={value.length === 0}
            className="border border-border px-5 py-2.5 font-mono text-[11px] tracking-[0.08em] text-text-primary uppercase transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {t(value.length === 0 ? "mk_pick_a_market" : "mk_continue")}
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
