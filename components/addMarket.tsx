"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tokenPrice } from "@/lib/format";
import {
  LABEL,
  BODY,
  PRIMARY,
  SECONDARY,
  SURFACE,
  FieldNote,
  SEGMENT_ITEM,
  SEGMENT_ON,
  SEGMENT_OFF,
} from "@/components/kit";
import { useRouter } from "next/navigation";
import { MARKET_CLASSES, VENUE_LABEL } from "@/components/pickMarket";
import { usePrivy } from "@privy-io/react-auth";
import {
  selectionKey,
  num,
  addAgentMarket,
  removeAgentMarket,
  type UniverseAsset,
  type UniverseSelection,
} from "@/lib/api";
import { AssetLogo } from "@/components/ui";
import { RouteBadge, routeOf, type Router } from "@/components/routeBadge";

/**
 * Whether two rows are the same market.
 *
 * By MINT when there is one, because that is a token's identity — and because
 * comparing `underlying`/`issuer` alone made every crypto row equal to every
 * other: a token has neither field, so `undefined === undefined` matched them
 * all and selecting one highlighted the lot.
 */
function sameAsset(a: UniverseAsset | null, b: UniverseAsset | null): boolean {
  if (!a || !b) return false;
  if (a.mint || b.mint) return Boolean(a.mint) && a.mint === b.mint;
  return (
    a.underlying === b.underlying && (a.issuer ?? null) === (b.issuer ?? null)
  );
}

/**
 * "Add market" — the picker behind the + Add market card on wireframe 1k.
 *
 * WHAT CONFIRMING ACTUALLY DOES
 *
 * It posts the request into the agent's own thread and takes you there to
 * approve or discard the diff that comes back. That is a real two-step, not a
 * euphemism for a missing feature: the same mechanism is what "edit limits"
 * uses, and the change is reviewable before it takes effect.
 *
 * Applying it edits THIS agent — same agent, same positions, same thread. It
 * used to fork the strategy into a new agent on a fresh paper run, which is
 * why this comment once described a much larger consequence.
 *
 * The list is the resolved universe the parent already fetched. Assets the
 * strategy holds are shown and disabled rather than filtered out — a picker
 * that silently omits what you are looking for reads as a missing asset.
 */

export function AddMarketModal({
  agentId,
  agentName,
  assets,
  existing,
  loading,
  onClose,
  onChanged,
}: {
  agentId: number;
  agentName: string;
  /** The resolved universe for this agent's class, already loaded upstream. */
  assets: UniverseAsset[];
  /** What the strategy already trades. Those rows render as taken. */
  existing: UniverseSelection[];
  loading?: boolean;
  /**
   * Called after a market is removed, so the page behind reloads.
   *
   * Removal happens WITHOUT closing: taking two markets off is one visit, not
   * two, and closing after each would make the second removal a fresh trip
   * through the same dialog.
   */
  onChanged?: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const { getAccessToken } = usePrivy();

  const [query, setQuery] = useState("");
  const [klass, setKlass] = useState<string>("all");
  /** A router key, or "all" — the second filter axis. See `venues` below. */
  const [venue, setVenue] = useState<Router | "all">("all");
  const venueSelect = useRef<HTMLSelectElement>(null);
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState<UniverseAsset | null>(null);
  /**
   * Markets removed during THIS visit.
   *
   * `existing` is a prop and does not change until the page behind reloads, so
   * without this a row stays labelled "Added" after being removed and the
   * dialog contradicts what just happened.
   */
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const held = useMemo(
    () => new Set(existing.map(selectionKey).filter((k) => !removed.has(k))),
    [existing, removed],
  );

  /**
   * How many markets remain.
   *
   * An empty list means EVERY market in the class, so removing the last one
   * widens the agent rather than narrowing it — the backend refuses, and the
   * row below stays inert rather than offering an action that always fails.
   */
  const heldCount = held.size;

  /** Removes one already-added market. Does not sell — the backend says so too. */
  const remove = useCallback(
    async (a: UniverseAsset) => {
      const key =
        a.kind === "crypto"
          ? `mint:${a.mint}`
          : `${a.underlying}/${a.issuer ?? ""}`;
      setRemovingKey(key);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Sign in to change this agent.");
        await removeAgentMarket(
          token,
          agentId,
          a.kind === "crypto"
            ? { mint: a.mint! }
            : { underlying: a.underlying ?? "", issuer: a.issuer },
        );
        setRemoved((prev) => new Set(prev).add(key));
        onChanged?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setRemovingKey(null);
      }
    },
    [agentId, getAccessToken, onChanged],
  );

  const isHeld = (a: UniverseAsset) =>
    a.kind === "crypto"
      ? held.has(`mint:${a.mint}`)
      : // The second form covers a selection that named the underlying without
        // pinning an issuer, which means every issuer of it.
        held.has(`${a.underlying}/${a.issuer}`) || held.has(`${a.underlying}/`);

  /**
   * The class chips worth offering, which is not the same list the creation
   * picker shows.
   *
   * `agentDetail` feeds this dialog the whole resolved universe, but a class
   * within it can still be empty — the crypto half fails its own fetch, or the
   * hourly refresh behind it has not run. Rendering the full MARKET_CLASSES row
   * regardless hands you chips that cannot match anything: clicking Crypto
   * emptied the list, and the empty state then blamed the search box for it.
   *
   * Derived from the assets rather than from `strategy_class`, because the
   * class→chip mapping would be a second copy of `admits` and the two would
   * drift. A chip is offered iff something in this universe satisfies it.
   */
  const classes = useMemo(
    () =>
      MARKET_CLASSES.filter(
        (c) => c.key === "all" || assets.some((a) => c.admits(a)),
      ),
    [assets],
  );

  /**
   * One class plus "All" is the same list twice. The row only earns its space
   * when there is a real choice to make.
   */
  const showClasses = classes.length > 2;

  /**
   * `assets` arrives after the first render, so a chip can stop being offered
   * under a selection that already points at it — which would show an empty
   * list with no chip lit to explain why.
   */
  useEffect(() => {
    if (!classes.some((c) => c.key === klass)) setKlass("all");
  }, [classes, klass]);

  /**
   * The venues present in this universe.
   *
   * The second axis, exactly as in the creation picker: class picks WHAT, venue
   * picks WHERE, and a venue is not a class — a KalqiX cbBTC is crypto AND an
   * order book, so it can never be a chip in the row above without putting the
   * same row under two of them.
   *
   * A DROPDOWN rather than chips, and that is the only thing that differs from
   * the picker. This bar is inside a dialog with a header, a search box and a
   * count already competing for one line; a second row of pills is what pushes
   * it from dense to crowded. A closed dropdown costs one control's width and
   * still says which venue is active.
   */
  const venues = useMemo(() => {
    const seen = new Set<Router>();
    for (const a of assets) seen.add(routeOf(a).router);
    return (Object.keys(VENUE_LABEL) as Router[]).filter((r) => seen.has(r));
  }, [assets]);

  /** Same reason as the chips: a filter offering one option is furniture. */
  const showVenues = venues.length > 1;

  // And the same hazard: a venue can stop being offered under a selection that
  // still points at it.
  useEffect(() => {
    if (venue !== "all" && !venues.includes(venue)) setVenue("all");
  }, [venue, venues]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter(
      (a) =>
        // The same predicate the creation picker uses, from the same list —
        // two copies of "what counts as a commodity" drift the moment either
        // is edited.
        (MARKET_CLASSES.find((c) => c.key === klass)?.admits(a) ?? true) &&
        (venue === "all" || routeOf(a).router === venue) &&
        (q === "" ||
          a.symbol.toLowerCase().includes(q) ||
          // Name as well: a token is searched for by what it is called
          // ("bitcoin"), not by its wrapped symbol ("WBTC").
          (a.name ?? "").toLowerCase().includes(q) ||
          (a.underlying ?? "").toLowerCase().includes(q) ||
          (a.issuer ?? "").toLowerCase().includes(q)),
    );
  }, [assets, query, klass, venue]);

  // The dialog owns the keyboard while it is open. Escape closes, arrows drive
  // the list wherever focus sits, and Tab is wrapped inside the panel so focus
  // cannot wander onto the page behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      // A native select owns ↑↓ and ⏎ while it has focus. The list handler
      // preventDefaults both, so without this the venue dropdown could be
      // opened by keyboard and then never changed with one.
      if (
        document.activeElement === venueSelect.current &&
        (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter")
      ) {
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
      if (e.key === "Enter") {
        const a = rows[cursor];
        if (a && !isHeld(a)) {
          e.preventDefault();
          setPicked(a);
        }
        return;
      }
      if (e.key === "Tab" && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, select, [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cursor, onClose]);

  // The page behind a modal must not scroll under it.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    search.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    panel.current
      ?.querySelector<HTMLElement>(`[data-row="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  async function submit() {
    if (!picked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in to change this agent.");
      // Direct, not a chat instruction. This used to send a sentence for the
      // agent to interpret into a proposal, which forked the strategy into a
      // NEW agent — a large outcome for "also watch gold". The universe is not
      // frozen while a strategy runs, so the same agent simply takes the extra
      // market and screens it on the next cycle, which the endpoint triggers.
      //
      // Whichever identity this agent's class uses. A token is pinned by its
      // mint, which IS its identity. An RWA market is named and resolved
      // through the registry server-side — and its issuer is passed explicitly,
      // because two issuers can wrap the same underlying and "Apple" alone is
      // ambiguous between them.
      await addAgentMarket(
        token,
        agentId,
        picked.kind === "crypto"
          ? { mint: picked.mint! }
          : { underlying: picked.underlying ?? "", issuer: picked.issuer },
      );
      // Cycles, not chat: the agent screens the new market immediately, and
      // that screen is the thing worth showing.
      router.push(`/workspace/${agentId}?tab=cycles`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/80 px-4 py-10 backdrop-blur-sm"
      // A click that starts inside the panel and ends on the backdrop must not
      // close it — checking the target rather than using a bare onClick keeps a
      // drag-selected search string from dismissing the dialog.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-market-title"
        className="flex max-h-[calc(100vh-80px)] w-full max-w-[760px] flex-col overflow-hidden rounded-xl border border-grid bg-panel"
      >
        {/* ------------------------------------------------------------ head */}
        <div className="flex shrink-0 items-start justify-between gap-6 px-7 pt-5 pb-1">
          <div className="min-w-0 space-y-1.5">
            <p className={LABEL}>{agentName}</p>
            <h2
              id="add-market-title"
              className="font-mono text-[20px] leading-none text-text-primary"
            >
              Add a market
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            // A mark in a hit target, matching every other dialog. The
            // bordered "Esc" chip was the heaviest element in this header and
            // the one nobody opens the dialog for.
            className="-mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-text-dim transition-colors hover:bg-surface hover:text-text-primary"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-[15px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
              focusable="false"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* --------------------------------------------------------- filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-grid px-7 py-3.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {(showClasses ? classes : []).map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  setKlass(c.key);
                  setCursor(0);
                }}
                // The kit's segment vocabulary: a filled pill for the chosen
                // one, nothing but colour for the rest. These were bordered in
                // both states, so the class filter read as four outlined
                // controls competing with the search field beside them.
                className={`${SEGMENT_ITEM} ${klass === c.key ? SEGMENT_ON : SEGMENT_OFF}`}
              >
                {c.label}
              </button>
            ))}

            {/* The venue axis, in the same bar and deliberately quieter: a
                dropdown states the current filter in one control's width,
                where a second row of pills would crowd a dialog that already
                carries a header, a search box and a count. */}
            {showVenues ? (
              <label className={`flex items-center gap-2 ${LABEL}`}>
                Venue
                <select
                  ref={venueSelect}
                  value={venue}
                  onChange={(e) => {
                    setVenue(e.target.value as Router | "all");
                    setCursor(0);
                  }}
                  className={`${SURFACE} px-2 py-1 font-mono text-[11px] text-text-primary outline-none focus:border-accent`}
                >
                  <option value="all" className="bg-bg">
                    All
                  </option>
                  {venues.map((v) => (
                    <option key={v} value={v} className="bg-bg">
                      {VENUE_LABEL[v]}
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
              placeholder="Search markets…"
              spellCheck={false}
              aria-label="Search markets"
              className={`h-9 w-[220px] ${SURFACE} px-3 font-mono text-[12.5px] text-text-primary outline-none transition-colors placeholder:text-text-dim focus:border-accent`}
            />
            <span className={LABEL}>
              {rows.length} {rows.length === 1 ? "market" : "markets"}
            </span>
          </div>
        </div>

        {/* ------------------------------------------------------------ list */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className={`sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_100px_80px_110px_70px] items-center gap-x-4 border-b border-grid bg-panel px-7 py-2.5 ${LABEL}`}
          >
            <span>Market</span>
            <span className="text-right">Price</span>
            <span className="text-right">24h</span>
            <span className="text-right">Pool depth</span>
            <span />
          </div>

          {loading ? (
            <Note>Resolving tradable markets…</Note>
          ) : rows.length === 0 ? (
            // Three different emptinesses, and the reader can act on only two
            // of them. Blaming the search box unconditionally produced the
            // nonsense `Nothing matches “”.` whenever a class chip was the
            // thing that emptied the list.
            <Note tone="warning">
              {emptyReason(
                assets.length,
                klass,
                query,
                classes,
                venue === "all" ? null : VENUE_LABEL[venue],
              )}
            </Note>
          ) : (
            rows.map((a, i) => {
              const taken = isHeld(a);
              const chosen = sameAsset(picked, a);
              return (
                <button
                  key={a.mint ?? `${a.underlying}/${a.issuer}`}
                  type="button"
                  data-row={i}
                  // A held row is no longer inert. It was greyed out saying
                  // "Added", which states a fact and offers nothing — the only
                  // way to drop a market was the card on the page behind.
                  //
                  // Still disabled when it is the LAST one: an empty list means
                  // every market in the class, so removing it widens the agent
                  // instead of narrowing it. The backend refuses, and a row
                  // that always fails is worse than one that does nothing.
                  disabled={busy || (taken && heldCount <= 1)}
                  onMouseEnter={() => setCursor(i)}
                  // Held: remove it. Otherwise pick it — and clicking the
                  // chosen row again unchooses it, since the only way out of a
                  // selection used to be picking a different market or closing
                  // the dialog, and neither is "I changed my mind".
                  onClick={() =>
                    taken
                      ? void remove(a)
                      : setPicked((prev) => (sameAsset(prev, a) ? null : a))
                  }
                  aria-pressed={chosen}
                  aria-label={
                    taken
                      ? heldCount <= 1
                        ? `${a.symbol} is the only market this agent trades and cannot be removed`
                        : `Stop trading ${a.symbol}`
                      : undefined
                  }
                  title={
                    taken && heldCount > 1
                      ? "Remove this market. Anything already held stays open."
                      : undefined
                  }
                  className={`grid w-full grid-cols-[minmax(0,1fr)_100px_80px_110px_70px] items-center gap-x-4 border-b border-grid px-7 py-3 text-left transition-colors ${
                    taken
                      ? heldCount <= 1
                        ? "cursor-not-allowed opacity-45"
                        : "group opacity-70 hover:opacity-100"
                      : chosen
                        ? "bg-accent-wash"
                        : i === cursor
                          ? "bg-surface"
                          : ""
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <AssetLogo
                      symbol={a.underlying ?? a.symbol}
                      issuer={a.issuer}
                      src={a.iconUrl}
                      size={18}
                    />
                    <span
                      className={`truncate font-mono text-[13px] ${
                        chosen ? "text-accent" : "text-text-primary"
                      }`}
                    >
                      {a.symbol}/USDC
                    </span>
                    {/* Same pair as the builder's picker, from the same
                        source — this list adds markets to a running agent, so
                        it must not describe an asset differently. */}
                    <RouteBadge {...routeOf(a)} size={15} />
                    {/* The class no longer leads this line — see pickMarket.
                        The issuer is what varies between two rows in the same
                        list; the class is the tab you are already in. */}
                    {a.issuer ? (
                      <span className="truncate font-ui text-[11px] text-text-dim">
                        {a.issuer}
                      </span>
                    ) : null}
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
                      : `${num(a.changePct)! >= 0 ? "+" : "−"}${Math.abs(
                          num(a.changePct)!,
                        ).toFixed(1)}%`}
                  </span>
                  <span className="tnum text-right font-mono text-[12.5px] text-text-secondary">
                    {num(a.liquidityUsd) === null
                      ? "—"
                      : money(num(a.liquidityUsd)!)}
                  </span>
                  <span className="text-right font-mono text-[9px] tracking-[0.12em] uppercase">
                    {taken ? (
                      removingKey ===
                      (a.kind === "crypto"
                        ? `mint:${a.mint}`
                        : `${a.underlying}/${a.issuer ?? ""}`) ? (
                        <span className="text-text-muted">…</span>
                      ) : heldCount <= 1 ? (
                        // The only market. Says added, offers nothing, and the
                        // title explains why rather than leaving a dead row.
                        <span className="text-text-muted">Added</span>
                      ) : (
                        // "Added" until pointed at, "Remove" once it is
                        // actionable — the label names what the click does.
                        <>
                          <span className="text-text-muted group-hover:hidden">
                            Added
                          </span>
                          <span className="hidden text-negative group-hover:inline">
                            Remove
                          </span>
                        </>
                      )
                    ) : chosen ? (
                      <span className="text-accent">Picked</span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* ---------------------------------------------------------- footer */}
        <div className="border-t border-grid px-7 py-4">
          {error ? (
            <div className="pb-3">
              <FieldNote tone="bad">{error}</FieldNote>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className={`min-w-0 ${BODY}`}>
              {picked ? (
                <>
                  <span className="font-mono text-[12.5px] text-accent">
                    {picked.symbol}/USDC
                  </span>{" "}
                  — same rules and limits as {agentName}.
                </>
              ) : (
                <span className={LABEL}>↑↓ navigate · ⏎ pick · esc close</span>
              )}
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <button type="button" onClick={onClose} className={SECONDARY}>
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!picked || busy}
                className={PRIMARY}
              >
                {busy ? "Sending…" : "Request add"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- bits -- */

function Note({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "warning";
}) {
  return (
    <p
      className={`px-7 py-10 text-center font-ui text-[13px] ${
        tone === "warning" ? "text-warning" : "text-text-secondary"
      }`}
    >
      {children}
    </p>
  );
}

/**
 * Why the list is empty, in the reader's terms.
 *
 * Order matters: the narrower cause is named first, because "nothing matches
 * your search" is the actionable sentence when a search is what emptied it,
 * and a filter is only worth mentioning while it is still narrowing.
 *
 * Every active narrowing is named, not just the first one. Two filters can each
 * be innocent and empty the list together — crypto and Jupiter both have rows,
 * crypto ON Jupiter may not — and a sentence blaming one of them sends the
 * reader to clear the wrong control.
 */
function emptyReason(
  total: number,
  klass: string,
  query: string,
  classes: readonly { key: string; label: string }[],
  venueLabel: string | null,
): string {
  if (total === 0) return "No market currently resolves as tradable.";
  const q = query.trim();
  const label = classes
    .find((c) => c.key === klass && c.key !== "all")
    ?.label.toLowerCase();
  const scope = [label, venueLabel ? `on ${venueLabel}` : null]
    .filter(Boolean)
    .join(" ");
  if (q) {
    return scope
      ? `Nothing in ${scope} matches “${q}”.`
      : `Nothing matches “${q}”.`;
  }
  if (label) return `This agent trades no ${scope}.`;
  if (venueLabel) return `Nothing here fills on ${venueLabel}.`;
  return "No market currently resolves as tradable.";
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
