"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import {
  selectionKey,
  num,
  addAgentMarket,
  removeAgentMarket,
  type UniverseAsset,
  type UniverseSelection,
} from "@/lib/api";
import {
  describeClass, AssetLogo } from "@/components/ui";

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
  return a.underlying === b.underlying && (a.issuer ?? null) === (b.issuer ?? null);
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

/**
 * The chips, in the order they are offered.
 *
 * Which of these actually APPEAR is derived from the assets in hand — see
 * `classes` below. A fixed list gave every RWA agent a "Funds" tab that always
 * answered "Nothing matches", because the only ETF in the registry (SPY) fails
 * resolution and never reaches the picker. A filter that can only ever return
 * nothing is worse than no filter: it reads as a broken search.
 */
const ALL_CLASSES = [
  { key: "equity", label: "Equities" },
  { key: "commodity", label: "Commodities" },
  { key: "etf", label: "Funds" },
] as const;

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
      const key = a.kind === "crypto" ? `mint:${a.mint}` : `${a.underlying}/${a.issuer ?? ""}`;
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
   * Chips worth showing: only classes present in this list, and only when
   * there is more than one to choose between.
   *
   * A crypto agent's universe is all tokens, so it gets no chips at all rather
   * than three that subdivide nothing.
   */
  const classes = useMemo(() => {
    const present = new Set(
      assets.filter((a) => a.kind !== "crypto").map((a) => a.assetClass),
    );
    const shown = ALL_CLASSES.filter((c) => present.has(c.key));
    return shown.length > 1 ? [{ key: "all", label: "All" } as const, ...shown] : [];
  }, [assets]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter(
      (a) =>
        // No class filter for tokens: an agent's universe is one class already,
        // so the list is either all RWA or all crypto and the chips only ever
        // subdivide the former.
        (klass === "all" || a.kind === "crypto" || a.assetClass === klass) &&
        (q === "" ||
          a.symbol.toLowerCase().includes(q) ||
          // Name as well: a token is searched for by what it is called
          // ("bitcoin"), not by its wrapped symbol ("WBTC").
          (a.name ?? "").toLowerCase().includes(q) ||
          (a.underlying ?? "").toLowerCase().includes(q) ||
          (a.issuer ?? "").toLowerCase().includes(q)),
    );
  }, [assets, query, klass]);

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
          'button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])',
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
        className="flex max-h-[calc(100vh-80px)] w-full max-w-[760px] flex-col border border-grid-strong bg-panel"
      >
        {/* ------------------------------------------------------------ head */}
        <div className="flex items-start justify-between gap-6 border-b border-grid px-7 py-5">
          <div className="min-w-0 space-y-1.5">
            <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
              {agentName}
            </p>
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
            className="shrink-0 border border-border px-2.5 py-1 font-mono text-[11px] text-text-dim transition-colors hover:border-accent hover:text-accent"
          >
            Esc
          </button>
        </div>

        {/* --------------------------------------------------------- filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-grid px-7 py-3.5">
          <div className="flex items-center gap-2">
            {classes.map((c) => (
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
              placeholder="Search markets…"
              spellCheck={false}
              aria-label="Search markets"
              className="h-9 w-[200px] border-b border-grid-strong bg-transparent font-mono text-[12.5px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent"
            />
            <span className="font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
              {rows.length} {rows.length === 1 ? "market" : "markets"}
            </span>
          </div>
        </div>

        {/* ------------------------------------------------------------ list */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_100px_80px_110px_70px] items-center gap-x-4 border-b border-grid bg-panel px-7 py-2.5 font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase">
            <span>Market</span>
            <span className="text-right">Price</span>
            <span className="text-right">24h</span>
            <span className="text-right">Pool depth</span>
            <span />
          </div>

          {loading ? (
            <Note>Resolving tradable markets…</Note>
          ) : rows.length === 0 ? (
            <Note tone="warning">
              {assets.length === 0
                ? "No market currently resolves as tradable."
                : `Nothing matches “${query}”.`}
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
                    <AssetLogo symbol={a.underlying ?? a.symbol} issuer={a.issuer} src={a.iconUrl} size={18} />
                    <span
                      className={`truncate font-mono text-[13px] ${
                        chosen ? "text-accent" : "text-text-primary"
                      }`}
                    >
                      {a.symbol}/USDC
                    </span>
                    <span className="truncate font-ui text-[11px] text-text-dim">
                      {describeClass(a)}
                      {a.issuer ? ` · ${a.issuer}` : ""}
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
                      : `${num(a.changePct)! >= 0 ? "+" : "−"}${Math.abs(
                          num(a.changePct)!,
                        ).toFixed(1)}%`}
                  </span>
                  <span className="tnum text-right font-mono text-[12.5px] text-text-secondary">
                    {num(a.liquidityUsd) === null ? "—" : money(num(a.liquidityUsd)!)}
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
                          <span className="text-text-muted group-hover:hidden">Added</span>
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
            <p className="pb-3 font-mono text-[11px] tracking-[0.06em] text-negative uppercase">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="min-w-0 font-ui text-[12.5px] text-text-secondary">
              {picked ? (
                <>
                  <span className="font-mono text-[12.5px] text-accent">
                    {picked.symbol}/USDC
                  </span>{" "}
                  — same rules and limits as {agentName}.
                </>
              ) : (
                <span className="font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
                  ↑↓ navigate · ⏎ pick · esc close
                </span>
              )}
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-11 border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!picked || busy}
                className="h-11 border border-accent bg-accent-wash px-6 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
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

function fmt(n: number): string {
  return n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toFixed(2);
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
