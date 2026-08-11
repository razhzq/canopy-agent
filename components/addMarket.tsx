"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import {
  num,
  addAgentMarket,
  type UniverseAsset,
  type UniverseSelection,
} from "@/lib/api";
import { AssetLogo } from "@/components/ui";

/**
 * "Add market" — the picker behind the + Add market card on wireframe 1k.
 *
 * WHAT CONFIRMING ACTUALLY DOES
 *
 * It does not edit this agent. A live strategy's rules and universe are frozen
 * by a database trigger, and the only route that can change a universe is the
 * chat proposal's apply path — which forks the strategy and starts the fork as
 * a new agent on a fresh paper run. So the button posts the request into the
 * agent's own thread and takes you there to approve or discard what it comes
 * back with. Nothing is forked until you apply the proposal.
 *
 * That is a real two-step, not a euphemism for a missing feature: the same
 * mechanism is what "edit limits" uses, and the proposal is reviewable before
 * anything is created.
 *
 * The list is the resolved universe the parent already fetched. Assets the
 * strategy holds are shown and disabled rather than filtered out — a picker
 * that silently omits what you are looking for reads as a missing asset.
 */

const CLASSES = [
  { key: "all", label: "All" },
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
}: {
  agentId: number;
  agentName: string;
  /** The resolved universe for this agent's class, already loaded upstream. */
  assets: UniverseAsset[];
  /** What the strategy already trades. Those rows render as taken. */
  existing: UniverseSelection[];
  loading?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { getAccessToken } = usePrivy();

  const [query, setQuery] = useState("");
  const [klass, setKlass] = useState<string>("all");
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState<UniverseAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const held = useMemo(
    () =>
      new Set(
        existing.map((s) => `${s.underlying}/${s.issuer ?? ""}`),
      ),
    [existing],
  );

  const isHeld = (a: UniverseAsset) =>
    held.has(`${a.underlying}/${a.issuer}`) || held.has(`${a.underlying}/`);

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
      // Issuer is passed explicitly: two issuers can wrap the same underlying,
      // and "Apple" alone is ambiguous between them.
      await addAgentMarket(token, agentId, {
        underlying: picked.underlying,
        issuer: picked.issuer,
      });
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
              const chosen =
                picked?.underlying === a.underlying && picked?.issuer === a.issuer;
              return (
                <button
                  key={`${a.underlying}/${a.issuer}`}
                  type="button"
                  data-row={i}
                  disabled={taken}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => setPicked(a)}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_100px_80px_110px_70px] items-center gap-x-4 border-b border-grid px-7 py-3 text-left transition-colors ${
                    taken
                      ? "cursor-not-allowed opacity-45"
                      : chosen
                        ? "bg-accent-wash"
                        : i === cursor
                          ? "bg-surface"
                          : ""
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <AssetLogo symbol={a.underlying} issuer={a.issuer} size={18} />
                    <span
                      className={`truncate font-mono text-[13px] ${
                        chosen ? "text-accent" : "text-text-primary"
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
                      : `${num(a.changePct)! >= 0 ? "+" : "−"}${Math.abs(
                          num(a.changePct)!,
                        ).toFixed(1)}%`}
                  </span>
                  <span className="tnum text-right font-mono text-[12.5px] text-text-secondary">
                    {num(a.liquidityUsd) === null ? "—" : money(num(a.liquidityUsd)!)}
                  </span>
                  <span className="text-right font-mono text-[9px] tracking-[0.12em] uppercase">
                    {taken ? (
                      <span className="text-text-muted">Added</span>
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
