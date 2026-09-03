"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tokenPrice } from "@/lib/format";
import { usePrivy } from "@privy-io/react-auth";
import {
  marketKey,
  peekAllMarkets,
  getAllMarkets,
  num,
  type DiscoverySpec,
  type UniverseAsset,
  type UniverseSelection,
} from "@/lib/api";
import { DEFAULT_DISCOVERY, DiscoveryFilters } from "@/components/discoveryFilters";
import { useApi } from "@/lib/useApi";
import { AssetLogo } from "@/components/ui";
import {
  LABEL,
  SEGMENT_ITEM,
  SEGMENT_OFF,
  SEGMENT_ON,
  SEGMENT_TRACK,
  SURFACE,
} from "@/components/kit";
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
 * Rows on one page.
 *
 * THE LIST OUTGREW THE PAGE. The universe used to be a few hundred tokens
 * behind a $50k liquidity floor, and rendering all of it was fine. Removing
 * that floor — so a screen can reach the long tail, which is the whole point of
 * one — took "All" into the thousands, and an unpaginated list of thousands
 * does not merely scroll badly: it buries everything BELOW it. The discovery
 * section sits under this table, and it became unreachable without a very
 * determined scroll.
 *
 * Fifty because it is a screen or two of rows — enough that paging feels like
 * an occasional act rather than the primary way to move, and few enough that
 * the thing after the table is always within reach.
 */
export const PAGE_SIZE = 50;

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
  discovery,
  onDiscoveryChange,
  onNext,
}: {
  value: UniverseAsset[];
  /** The whole selection, every time — the parent never merges. */
  onChange: (next: UniverseAsset[]) => void;
  /**
   * The screen, if this strategy has one. Undefined means it trades only what
   * is picked above.
   *
   * A SECOND WAY TO ANSWER THIS STEP, not a replacement for the first. Both can
   * be set: picked markets are always traded, and the screen adds to them. So
   * this is a section below the table rather than a mode beside it — a tab
   * would say the two are alternatives, and they are not.
   */
  discovery?: DiscoverySpec;
  onDiscoveryChange: (next: DiscoverySpec | undefined) => void;
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
  const [page, setPage] = useState(0);
  /**
   * Which half of the step is on screen.
   *
   * A VIEW, NOT A MODE — and the distinction is the whole reason the tabs are
   * labelled the way they are. The two compose: a strategy may pin markets AND
   * carry a screen, and the pinned ones are traded whether or not they satisfy
   * it. Switching tabs shows the other half; it never turns this one off.
   *
   * Two tabs rather than one long page because the list won. Discovery lived
   * under the table, and the table is a thousand rows — so the section that
   * offers the more powerful of the two answers was the one nobody found. A
   * pager helped and did not fix it: what is below a long list is still below
   * a long list.
   *
   * Each tab states what it holds, so nothing the other one contains is hidden
   * while it is off screen. That is what stops a view switch reading as an
   * either/or.
   */
  const [view, setView] = useState<"markets" | "discovery">("markets");
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

  /**
   * Whether a screen is worth offering at all.
   *
   * Derived rather than assumed, for the same reason the venue filter is: every
   * metric a screen names — market cap, pool depth, pair age, the buy/sell
   * split — is a property of an AMM pool. On a universe of tokenized equities
   * alone the whole panel would read "—" and could only ever match nothing,
   * which is a control that exists to disappoint.
   */
  const tokensPresent = useMemo(() => assets.some((a) => a.kind === "crypto"), [assets]);

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

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  /**
   * The page currently in view, clamped.
   *
   * Clamped rather than trusted because `rows` shrinks under the reader: typing
   * a fourth letter into the search can take a list of nine hundred down to two
   * while `page` still says 12, and the honest answer to that is the last page
   * that exists, not an empty table under a pager insisting there are more.
   */
  const safePage = Math.min(page, pageCount - 1);

  const pageRows = useMemo(
    () => rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [rows, safePage],
  );

  // Back to the top whenever the SET changes, not merely when it re-renders.
  // Keyed on the filters rather than on `rows` itself: `rows` is a fresh array
  // on every render, so depending on it would reset the page on every keystroke
  // including the ones that did not change what matches.
  useEffect(() => {
    setPage(0);
    setCursor(0);
  }, [query, klass, venue]);

  /**
   * Tickers held by more than one asset on screen.
   *
   * Ticker collisions are ordinary on a permissionless chain — the universe
   * carries three CATs and two each of DOG, GOLD and WOJAK — and every one of
   * them is a genuinely different token that happened to pick the same three
   * letters. Selection is keyed on the mint, so the ENGINE is never confused;
   * the person choosing from two identical-looking rows is.
   *
   * Computed over the rows ON THIS PAGE rather than the whole universe, or even
   * the whole filtered set: a name is only worth the horizontal space when the
   * ambiguity is actually visible. A search narrowed to one CAT does not need to
   * explain which CAT it is, and neither does a page holding only one of the
   * three.
   */
  const ambiguous = useMemo(() => {
    const seen = new Map<string, number>();
    for (const a of pageRows) {
      const key = a.symbol.toUpperCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return new Set([...seen].filter(([, n]) => n > 1).map(([sym]) => sym));
  }, [pageRows]);

  // Keyboard navigation over the whole step, not just the input — the table is
  // the subject of the page, so arrows should drive it wherever focus sits.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // THE TABLE'S KEYBOARD BELONGS TO THE TABLE. On the discovery tab every
      // binding below is either meaningless or actively harmful: `/` would steal
      // a slash somebody is typing into a filter, ↑↓ would move a cursor over
      // rows nobody can see, and ⏎ would toggle a market chosen by an invisible
      // highlight.
      if (view !== "markets") return;
      const typing = document.activeElement === search.current;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        search.current?.focus();
        return;
      }
      // ← → TURN PAGES, but never while somebody is typing: in a text field
      // they move the caret, and stealing that would make the search box
      // unusable for anyone correcting a letter mid-word.
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !typing) {
        const back = e.key === "ArrowLeft";
        if (back ? safePage > 0 : safePage < pageCount - 1) {
          e.preventDefault();
          setPage(back ? safePage - 1 : safePage + 1);
          setCursor(0);
        }
        return;
      }

      // ARROWS CARRY ACROSS PAGES. Clamping at the edge of a page would make
      // the boundary a wall the reader has to notice and step around with a
      // different control — which is exactly the friction pagination is
      // supposed to remove. Falling off the bottom turns the page and lands on
      // its first row; off the top lands on the previous page's last.
      //
      // The ends of the LIST still clamp: there is nothing past them.
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const down = e.key === "ArrowDown";
        setCursor((c) => {
          const next = down ? c + 1 : c - 1;
          if (next >= 0 && next < pageRows.length) return next;
          if (down && safePage < pageCount - 1) {
            setPage(safePage + 1);
            return 0;
          }
          if (!down && safePage > 0) {
            setPage(safePage - 1);
            // The previous page is always full — only the last page can be
            // short — so its final row is at PAGE_SIZE - 1.
            return PAGE_SIZE - 1;
          }
          return c;
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
      if (e.key === "Enter" && pageRows[cursor]) {
        // Toggles rather than advancing. Advancing on Enter made sense when one
        // pick WAS the whole selection; with several it would end the step on
        // the first choice.
        e.preventDefault();
        toggle(pageRows[cursor]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pageRows, cursor, safePage, pageCount, view, onChange, onNext]);

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

      {/*
        The two halves of this step.

        Rendered only where there is a second half to reach: on a universe with
        no tokens in it a screen can only ever match nothing, so the tab bar
        would be one usable tab beside one that exists to disappoint. Same rule
        the venue filter follows.

        `w-fit` on the track: SEGMENT_TRACK is a bare flex container, which as a
        block-level child would stretch the full width of the column and read as
        a toolbar rather than as a control.
      */}
      {tokensPresent ? (
        <div className={`${SEGMENT_TRACK} w-fit`} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === "markets"}
            onClick={() => setView("markets")}
            className={`${SEGMENT_ITEM} ${view === "markets" ? SEGMENT_ON : SEGMENT_OFF}`}
          >
            {t("mk_tab_pick")}
            {/* The count travels with the tab, so what the other view holds is
                never invisible while you are not looking at it. Absent at zero
                rather than shown as "0": a figure guaranteed to be zero is not
                a reading. */}
            {value.length > 0 ? (
              <span className="tnum text-[10px] opacity-70">{value.length}</span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "discovery"}
            onClick={() => {
              setView("discovery");
              // SELECTING THE TAB IS WHAT TURNS THE SCREEN ON. There is no
              // second gesture — a button behind the tab that only revealed the
              // same controls was a click charging rent on itself.
              //
              // Which means a curious click enables a screen, so nothing about
              // it is quiet: the tab lights a dot, the footer names it beside
              // the picked markets, and step 2 makes the ranking it needs
              // required and pre-filled. "Remove screen" in the panel undoes it
              // and returns here.
              if (!discovery) onDiscoveryChange(DEFAULT_DISCOVERY);
            }}
            className={`${SEGMENT_ITEM} ${view === "discovery" ? SEGMENT_ON : SEGMENT_OFF}`}
          >
            {t("mk_tab_discovery")}
            {/* A dot, not a word: it says "there is something here" in the
                width the tab already had. */}
            {discovery ? (
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-accent"
              />
            ) : null}
          </button>
        </div>
      ) : null}

      {view === "markets" ? (
      <>
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

          {pageRows.map((a, i) => (
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

          {/* Only when there is somewhere to go. A pager over a single page is
              furniture, the same reason the venue filter hides itself at one
              venue. */}
          {pageCount > 1 ? (
            <div className="flex items-center justify-between gap-4 border-t border-grid px-4 py-2.5">
              <span className="font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
                {t("mk_page_range", {
                  from: safePage * PAGE_SIZE + 1,
                  to: safePage * PAGE_SIZE + pageRows.length,
                  total: rows.length,
                })}
              </span>
              <span className="flex items-center gap-1">
                <PagerButton
                  label={t("mk_page_prev")}
                  disabled={safePage === 0}
                  onClick={() => {
                    setPage(safePage - 1);
                    setCursor(0);
                  }}
                />
                <PagerButton
                  label={t("mk_page_next")}
                  disabled={safePage >= pageCount - 1}
                  onClick={() => {
                    setPage(safePage + 1);
                    setCursor(0);
                  }}
                />
              </span>
            </div>
          ) : null}
        </div>
      )}

      </>
      ) : (
        <DiscoveryFilters
          value={discovery}
          onChange={(next) => {
            onDiscoveryChange(next);
            // Removing the screen leaves this tab with nothing on it, so it
            // hands the reader back to the table rather than to an empty panel
            // they have to work out how to leave.
            if (!next) setView("markets");
          }}
        />
      )}

      {/* The step no longer ends on a click, so it needs a way to end. */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-grid pt-5">
        {/* Keyboard hints describe the TABLE. On the discovery tab they would
            name controls that are not on screen. */}
        <div
          className={`flex flex-wrap items-center gap-5 font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase ${
            view === "markets" ? "" : "invisible"
          }`}
        >
          <span>{t("mk_hint_navigate")}</span>
          {/* Only when there is more than one page — a hint about a control
              that cannot do anything is noise on the one line the reader is
              meant to trust. */}
          {pageCount > 1 ? <span>{t("mk_hint_page")}</span> : null}
          <span>{t("mk_hint_toggle")}</span>
          <span>{t("mk_hint_search")}</span>
        </div>

        <div className="flex items-center gap-4">
          {value.length > 0 || discovery ? (
            <span className="font-ui text-[12.5px] text-text-secondary">
              {/* Named, not just counted, while the list is short enough to read.
                  "3 markets" is a number; "AAPLx, NVDAx, MSFTx" is the decision.
                  A screen is named too, because "3 markets" beside a strategy
                  that also screens two hundred is the wrong summary. */}
              {[
                value.length === 0
                  ? null
                  : value.length <= 4
                    ? value.map((a) => a.symbol).join(", ")
                    : t("mk_count_many", { count: value.length }),
                discovery ? t("dsc_title") : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onNext}
            // EITHER PATH ENDS THE STEP. A strategy with a screen and no picked
            // market is a complete answer to "what may this trade" — it is the
            // whole point of the section above — so gating on the table alone
            // would make the feature unreachable.
            disabled={value.length === 0 && !discovery}
            className="border border-border px-5 py-2.5 font-mono text-[11px] tracking-[0.08em] text-text-primary uppercase transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {t(value.length === 0 && !discovery ? "mk_pick_a_market" : "mk_continue")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One step through the list.
 *
 * Quiet on purpose: paging is a way to keep looking, not a decision, and it
 * must not compete with Continue — the only thing on this screen that commits.
 */
function PagerButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-text-dim"
    >
      {label}
    </button>
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
