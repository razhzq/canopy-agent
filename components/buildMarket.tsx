"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { getUniverse, type UniverseAsset, type UniverseSelection } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ChoiceCard, ChoiceRow, StepHead } from "@/components/wizard";
import { CheckIcon } from "@/components/ui";

/**
 * Step 1 of the builder: what the agent is allowed to trade.
 *
 * Separated from the strategy step because the rule vocabulary is a function of
 * this answer — a commodity has no net margin, a meme coin has no filings. One
 * shared rule list only survives while RWA is the single shipped class.
 *
 * The class lives in the main column; the asset list is a dropdown in the rail
 * (see AssetPicker). Assets are a refinement of the class, and rendering them
 * as a fourteen-tile grid gave a secondary choice more visual weight than the
 * primary one.
 */

export interface MarketChoice {
  strategyClass: string;
  /**
   * Three distinct states, and the distinction matters:
   *
   *   null  — not chosen yet. The initial state, and NOT a synonym for "all".
   *           The step cannot be completed from here.
   *   []    — deliberately every asset in the class, including ones added
   *           later. Still available, but it has to be picked on purpose.
   *   [...] — a fixed list.
   *
   * The backend reads an empty array as the whole class (CANOPY_038), so `null`
   * exists purely to stop "the author never looked at this" from being stored
   * as "the author chose everything". Those are not the same claim, and one of
   * them commits an agent to assets nobody reviewed.
   */
  selection: UniverseSelection[] | null;
}

const CLASSES = [
  {
    key: "rwa",
    title: "Tokenized RWA",
    body: "Tokenized equities and commodities — xStocks and vaulted gold. Screened on filings, fundamentals and issuer policy.",
    available: true,
  },
  {
    key: "meme",
    title: "Meme",
    body: "Solana memecoins, screened on liquidity, holder distribution and mint authority.",
    available: false,
  },
  {
    key: "spot",
    title: "Spot token",
    body: "Majors and established SPL tokens.",
    available: false,
  },
  {
    key: "lp",
    title: "Liquidity provision",
    body: "Concentrated ranges on Solana AMMs.",
    available: false,
  },
] as const;

/* ------------------------------------------------------------ main column -- */

export function MarketStep({
  value,
  onChange,
}: {
  value: MarketChoice;
  onChange: (next: MarketChoice) => void;
}) {
  return (
    <div className="space-y-7">
      <section>
        <StepHead index="01" title="Asset class" note="Sets which rules exist in step 2." />

        <ChoiceRow cols={2}>
          {CLASSES.map((c) => (
            <button
              key={c.key}
              type="button"
              disabled={!c.available}
              // Changing class resets the selection: the assets belong to the
              // class, so carrying them across would leave a strategy pointing
              // at things its new class does not contain.
              onClick={() => onChange({ strategyClass: c.key, selection: null })}
              className={`group flex h-full text-left ${
                c.available ? "" : "cursor-not-allowed opacity-40"
              }`}
            >
              <ChoiceCard
                title={c.title}
                body={c.body}
                active={value.strategyClass === c.key}
                meta={c.available ? undefined : "Not yet available"}
                metaTone="warning"
                // Only on selectable, non-active cards: a hover border applied
                // to the active one would beat border-accent (hover variants
                // win on equal specificity) and unstyle the selection mid-hover.
                className={
                  c.available && value.strategyClass !== c.key
                    ? "group-hover:border-grid-strong"
                    : ""
                }
              />
            </button>
          ))}
        </ChoiceRow>
      </section>

      <p className="max-w-[64ch] border-t border-grid pt-6 font-ui text-[13px] leading-relaxed text-text-secondary">
        Then choose what it may trade with the <span className="text-accent">Assets</span> picker
        on the right. Nothing is selected for you — an agent should only ever hold things you
        looked at.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- rail picker -- */

/**
 * The asset selector, as a dropdown in the rail.
 *
 * Owns its own fetch of the resolved universe — the list of assets that survived
 * the issuer registry, research and the chain all agreeing. Anything excluded at
 * resolution is absent here rather than selectable and then permanently silent.
 */
export function AssetPicker({
  value,
  onChange,
}: {
  value: MarketChoice;
  onChange: (next: MarketChoice) => void;
}) {
  const { authenticated } = usePrivy();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrap = useRef<HTMLDivElement>(null);

  const universe = useApi((t) => getUniverse(t, value.strategyClass), [value.strategyClass]);
  const assets: UniverseAsset[] = universe.phase === "ready" ? universe.data.assets : [];
  const chosen = value.selection;
  const untouched = chosen === null;
  const auto = chosen !== null && chosen.length === 0;
  const count = chosen?.length ?? 0;

  // Close on outside click and on Escape. Both, because a dropdown that traps
  // you until you find the button again is the thing that makes these annoying.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isPicked = (a: UniverseAsset): boolean =>
    (chosen ?? []).some(
      (s) =>
        s.underlying.toUpperCase() === a.underlying.toUpperCase() &&
        (s.issuer === undefined || s.issuer.toLowerCase() === a.issuer.toLowerCase()),
    );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? assets.filter(
          (a) =>
            a.symbol.toLowerCase().includes(q) ||
            a.underlying.toLowerCase().includes(q) ||
            a.issuer.toLowerCase().includes(q),
        )
      : assets;

    const by = new Map<string, UniverseAsset[]>();
    for (const a of matched) {
      const k =
        a.assetClass === "commodity" ? "Commodities" : a.assetClass === "etf" ? "Funds" : "Equities";
      const list = by.get(k);
      if (list) list.push(a);
      else by.set(k, [a]);
    }
    // Commodities first: the cleanest case, and the one most likely picked alone.
    return [...by.entries()].sort(([a], [b]) =>
      a === "Commodities" ? -1 : b === "Commodities" ? 1 : a.localeCompare(b),
    );
  }, [assets, query]);

  function toggle(a: UniverseAsset): void {
    // From explicit Auto, the user is narrowing FROM everything — so the first
    // click materialises the full list and removes one.
    //
    // From untouched, they are building a list UP from nothing, so the click
    // selects just that asset. Same gesture, opposite starting point; treating
    // them alike would silently hand a first-time author all eight assets.
    const base: UniverseSelection[] = auto
      ? assets.map((x) => ({ underlying: x.underlying, issuer: x.issuer }))
      : (chosen ?? []);

    const next = isPicked(a)
      ? base.filter(
          (s) =>
            !(
              s.underlying.toUpperCase() === a.underlying.toUpperCase() &&
              (s.issuer === undefined || s.issuer.toLowerCase() === a.issuer.toLowerCase())
            ),
        )
      : [...base, { underlying: a.underlying, issuer: a.issuer }];

    onChange({ ...value, selection: next });
  }

  const summary = untouched
    ? "Select assets"
    : auto
      ? `Auto · all${assets.length ? ` ${assets.length}` : ""}`
      : `${count} selected`;

  return (
    <div className="border-b border-grid px-8 py-7">
      <div className="flex items-center justify-between pb-4">
        <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
          Assets
        </h3>
        <span
          className={`font-mono text-[10px] tracking-[0.1em] uppercase ${
            untouched ? "text-warning" : auto ? "text-text-dim" : "text-accent"
          }`}
        >
          {untouched ? "Required" : auto ? "Following the class" : "Fixed list"}
        </span>
      </div>

      <div ref={wrap} className="relative">
        {/* Underlined rather than boxed: a filled 48px slab inside the rail's
            own border was the heaviest thing on the step, for a control that is
            usually left alone. */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={`flex h-11 w-full items-center justify-between gap-3 border-b bg-transparent text-left transition-colors ${
            open
              ? "border-accent"
              : untouched
                ? "border-warning hover:border-text-dim"
                : "border-grid-strong hover:border-text-dim"
          }`}
        >
          <span className="flex min-w-0 items-baseline gap-2.5">
            <span
              className={`shrink-0 font-mono text-[13px] transition-colors ${
                untouched ? "text-warning" : auto ? "text-text-primary" : "text-accent"
              }`}
            >
              {summary}
            </span>
            {!auto && !untouched ? (
              <span className="truncate font-ui text-[11.5px] text-text-dim">
                {chosen!
                  .slice(0, 3)
                  .map((s) => s.underlying)
                  .join(", ")}
                {count > 3 ? ` +${count - 3}` : ""}
              </span>
            ) : null}
          </span>
          <Chevron open={open} />
        </button>

        {open ? (
          <div className="absolute top-[calc(100%+6px)] right-0 left-0 z-30 border border-grid bg-bg shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
            {/* Borderless search: a bordered box inside a bordered panel inside a
                bordered rail was three nested rectangles for one input. */}
            <div className="flex items-center gap-2.5 border-b border-grid px-4">
              <SearchGlyph />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by ticker or issuer"
                spellCheck={false}
                aria-label="Filter assets"
                autoFocus
                className="h-11 w-full bg-transparent font-mono text-[12.5px] text-text-primary outline-none placeholder:text-text-muted"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear filter"
                  className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-accent"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="max-h-[46vh] overflow-y-auto py-1.5 [&::-webkit-scrollbar-thumb]:bg-grid-strong [&::-webkit-scrollbar]:w-1.5">
              <Row
                selected={auto}
                onClick={() => {
                  onChange({ ...value, selection: [] });
                  setOpen(false);
                }}
                title="Auto"
                meta="Every asset in the class, including ones added later"
                stacked
              />

              {universe.phase === "loading" ? (
                <Note>Resolving tradable assets…</Note>
              ) : universe.phase === "signed-out" || !authenticated ? (
                <Note>Sign in to see which assets are tradable.</Note>
              ) : universe.phase === "error" ? (
                <Note tone="negative">Could not load — {universe.message}</Note>
              ) : assets.length === 0 ? (
                <Note tone="warning">
                  {universe.data.note ?? "No asset in this class currently resolves as tradable."}
                </Note>
              ) : groups.length === 0 ? (
                <Note>Nothing matches “{query}”.</Note>
              ) : (
                groups.map(([label, group]) => (
                  <div key={label} className="group/sec pt-2.5 first:pt-1">
                    {/* Label, hairline, action — instead of a solid bar. The
                        action stays hidden until the group is hovered so the
                        list reads as assets rather than as controls. */}
                    <div className="flex items-center gap-3 px-4 pb-1.5">
                      <span className="font-mono text-[9.5px] tracking-[0.18em] text-text-muted uppercase">
                        {label}
                      </span>
                      <span className="h-px flex-1 bg-grid" />
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...value,
                            selection: group.map((a) => ({
                              underlying: a.underlying,
                              issuer: a.issuer,
                            })),
                          })
                        }
                        className="font-mono text-[9.5px] tracking-[0.1em] text-text-dim uppercase opacity-0 transition-opacity group-hover/sec:opacity-100 focus-visible:opacity-100 hover:text-accent"
                      >
                        Only these
                      </button>
                    </div>
                    {group.map((a) => {
                      const picked = auto || isPicked(a);
                      return (
                        <Row
                          key={`${a.underlying}/${a.issuer}`}
                          selected={picked}
                          onClick={() => toggle(a)}
                          title={a.symbol}
                          meta={`${a.underlying} · ${a.issuer}`}
                          note={a.hasFilings ? undefined : "no filer"}
                        />
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-grid px-4 py-2.5">
              <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted uppercase">
                {untouched
                  ? "None selected"
                  : auto
                    ? `All ${assets.length}`
                    : `${count} of ${assets.length}`}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-[10px] tracking-[0.12em] text-accent uppercase transition-colors hover:text-text-primary"
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <p className="pt-3.5 font-ui text-[12px] leading-relaxed text-text-secondary">
        {untouched
          ? "Pick the assets this agent may trade, or choose Auto to follow the whole class."
          : auto
            ? "The agent follows this class as it grows, including assets added later."
            : "The agent will never look outside this list, even as the class grows."}{" "}
        Only assets whose mint the registry, research and the chain agree on are offered.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- fragments -- */

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-3.5 shrink-0 text-text-dim transition-transform ${
        open ? "rotate-180" : ""
      }`}
      aria-hidden
    >
      <path
        d="M4 6.5 8 10.5 12 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One selectable line.
 *
 * Selection is a 2px accent rule on the leading edge plus accent type and a
 * trailing check — NOT a filled background. Eight consecutive washed rows read
 * as a stack of coloured blocks, which is what made the list feel heavy; the
 * rule reads as a margin mark and lets the type carry the state.
 *
 * The rule occupies its gutter whether or not it is lit, so nothing shifts
 * sideways as rows are toggled.
 */
function Row({
  selected,
  onClick,
  title,
  meta,
  note,
  stacked = false,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  meta: string;
  note?: string;
  /** Auto puts its explanation under the title rather than beside it. */
  stacked?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className="group/row flex w-full items-center gap-3 py-2 pr-4 pl-0 text-left transition-colors hover:bg-panel"
    >
      <span
        aria-hidden
        className={`h-7 w-0.5 shrink-0 transition-colors ${
          selected ? "bg-accent" : "bg-transparent group-hover/row:bg-grid-strong"
        }`}
      />
      <span className={`flex min-w-0 flex-1 gap-x-2.5 ${stacked ? "flex-col" : "items-baseline"}`}>
        <span
          className={`truncate font-mono text-[12.5px] transition-colors ${
            selected ? "text-accent" : "text-text-primary"
          }`}
        >
          {title}
        </span>
        <span className="truncate font-ui text-[11px] text-text-dim">{meta}</span>
      </span>
      {note ? (
        <span className="shrink-0 font-mono text-[9.5px] tracking-[0.1em] text-text-muted uppercase">
          {note}
        </span>
      ) : null}
      <CheckIcon
        className={`size-3 shrink-0 transition-opacity ${
          selected ? "text-accent opacity-100" : "opacity-0"
        }`}
      />
    </button>
  );
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-text-muted" aria-hidden>
      <circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.2 10.2 13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function Note({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "warning" | "negative";
}) {
  return (
    <p
      className={`px-4 py-6 text-center font-ui text-[12.5px] ${
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
