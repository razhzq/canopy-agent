"use client";

import { num, type UniverseAsset } from "@/lib/api";
import { tokenPrice } from "@/lib/format";
import { routeOf, type Chain } from "@/components/routeBadge";

/**
 * Step 3 — choose a venue. Wireframe 1f.
 *
 * WHY THIS STEP EXISTS AGAIN
 *
 * The builder used to run market → limits → paper run, on the wireframe's own
 * rule that "markets with only one live venue skip this step entirely". More
 * than one is live for the RWA pairs now, so the step comes back where the
 * wireframe puts it: after the limits, before the paper test that the footer
 * button starts.
 *
 * WHICH VENUES ARE LIVE IS A PROPERTY OF THE SELECTION, NOT OF THE APP
 *
 * The venue list used to be one global constant, which was true only while
 * every market settled on Solana. It is not any more: a KalqiX listing fills on
 * that venue's own order book on Base, and Jupiter cannot touch it — nor KalqiX
 * a Solana pair. So liveness is resolved per selection, from the chains the
 * chosen markets settle on, and a venue that cannot fill what you picked is not
 * listed at all rather than listed as "Live" and wrong.
 *
 * The not-yet-integrated venues are the exception: they are listed for every
 * selection, because their chain is not a fact this frontend has yet, and the
 * point of those rows is to say that a pin is not forever.
 *
 * WHAT IS REAL ON THIS SCREEN
 *
 * Jupiter's price and depth are the ones the universe resolver already returned
 * for the chosen market — the same numbers step 1 ranked on. Neither Canopy's
 * nor KalqiX's quote is wired to this frontend, so those rows show what is
 * published — a fee, or a dash where there is no published schedule — and say
 * as much where a live quote would go, rather than a plausible-looking number
 * nobody measured.
 *
 * NOT SENT TO THE BACKEND YET
 *
 * `createStrategy` and `deployAgent` have no venue field, so the choice below
 * lives in builder state and in the summary rail. It is a decision the creator
 * makes and sees carried forward — it does not yet change how the paper run
 * fills. Wire it through the moment the strategy payload grows a route.
 */

export type RouteMode = "auto" | "pin";

export interface RouteChoice {
  mode: RouteMode;
  /** Which venue every trade pins to. Only read when `mode` is "pin". */
  venue: string;
}

export const DEFAULT_ROUTE: RouteChoice = { mode: "auto", venue: "jupiter" };

type Venue = {
  key: string;
  name: string;
  /** Taker fee as a percentage, or null where the venue publishes no schedule. */
  feePct: number | null;
  live: boolean;
  /**
   * The chain this venue fills on. Set only for live venues: it is what scopes
   * them to a selection, and it is not a fact this frontend has for the ones
   * still integrating.
   */
  chain?: Chain;
  /** Shown instead of a depth bar when there is no quote to draw. */
  note?: string;
};

/**
 * Every venue this builder knows about, live or coming.
 *
 * Fees are published schedules, not quotes — a quote is the price/depth pair,
 * and only Jupiter's is available to this frontend today. KalqiX publishes no
 * flat taker schedule to put in that column, so its fee is a dash rather than
 * a guess.
 */
const VENUES: Venue[] = [
  { key: "jupiter", name: "Jupiter", feePct: 0.04, live: true, chain: "solana" },
  { key: "canopy", name: "Canopy", feePct: 0.02, live: true, chain: "solana" },
  {
    key: "kalqix",
    name: "KalqiX",
    feePct: null,
    live: true,
    chain: "base",
    note: "CLOB on Base · quote not wired yet",
  },
  { key: "aeonian", name: "Aeonian", feePct: null, live: false, note: "RWA DEX · integrating" },
  { key: "edgex", name: "edgeX", feePct: null, live: false, note: "Spot & perps · integrating" },
];

/** The chains a selection settles on. Empty before a market is picked. */
function chainsOf(markets: UniverseAsset[]): Set<Chain> {
  return new Set(markets.map((m) => routeOf(m).chain));
}

/**
 * The venues that can actually fill this selection.
 *
 * A mixed-chain universe returns the union: the agent trades every market it
 * was given, so every venue that can fill any of them is a real option.
 */
export function liveVenuesFor(markets: UniverseAsset[]): Venue[] {
  const chains = chainsOf(markets);
  return VENUES.filter((v) => v.live && v.chain && chains.has(v.chain));
}

/** The rows step 3 shows: what can fill this selection, plus what is coming. */
function venuesFor(markets: UniverseAsset[]): Venue[] {
  const live = new Set(liveVenuesFor(markets).map((v) => v.key));
  return VENUES.filter((v) => live.has(v.key) || !v.live);
}

/**
 * Whether a pinned choice still means anything for this selection.
 *
 * Changing the market can strand a pin — pin KalqiX, step back, swap to a
 * Solana pair, and the agent is pinned to a venue that cannot fill it. The
 * caller resets rather than silently re-routing, because "auto" and "pinned
 * somewhere else" are different promises to the person who chose.
 */
export function routeIsValidFor(route: RouteChoice, markets: UniverseAsset[]): boolean {
  if (route.mode === "auto") return true;
  return liveVenuesFor(markets).some((v) => v.key === route.venue);
}

/** One line for the summary rail: what the current choice actually routes to. */
export function describeRoute(route: RouteChoice, markets: UniverseAsset[]): string {
  const live = liveVenuesFor(markets);
  if (route.mode === "auto") {
    return live.length ? `Auto · ${live.map((v) => v.name).join(" + ")}` : "Auto";
  }
  const v = live.find((x) => x.key === route.venue);
  return `Pinned · ${v?.name ?? "—"}`;
}

export function PickRoute({
  markets,
  value,
  onChange,
  onBack,
}: {
  /**
   * The whole selection. Step 1 is multi-select, and the venues that can fill
   * it are the union across every chain it settles on.
   */
  markets: UniverseAsset[];
  value: RouteChoice;
  onChange: (next: RouteChoice) => void;
  onBack: () => void;
}) {
  // A quote belongs to a market, not to a selection. With one market picked the
  // row can carry its real price and depth; with several there is no single
  // number to put there, and the cell says so rather than showing the first
  // market's and letting it read as the route's.
  const single = markets.length === 1 ? markets[0] : null;
  const pair = single ? `${single.symbol}/USDC` : `these ${markets.length} markets`;
  const rows = venuesFor(markets);
  const live = liveVenuesFor(markets);

  // Only Jupiter has a quote here, so it is also the only bar with a length.
  // A single full-width bar would read as "deepest of several" when it is
  // really "the one we can measure" — so the bar is scaled against the row's
  // own liquidity and the unmeasured row gets a dash instead of an empty
  // track that looks like zero depth.
  const jupiterPrice = single ? num(single.priceUsd) : null;
  const jupiterDepth = single ? num(single.liquidityUsd) : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-mono text-[10px] tracking-[0.12em] text-text-dim uppercase">
          Step 3 of 3 · Route
        </p>
        <h2 className="font-mono text-[22px] leading-none text-text-primary">Choose a venue</h2>
        <p className="max-w-[68ch] font-ui text-[13.5px] leading-relaxed text-text-secondary">
          {live.length === 1 ? "One venue is" : `${live.length} venues are`} live for {pair} —{" "}
          {live.map((v) => v.name).join(" and ")}
          {live.length === 1
            ? ". Nothing else can fill it yet, so Auto and pinning come to the same thing here."
            : "."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <ModeCard
          title="Auto"
          badge="Recommended"
          body="Best price across every venue that can fill this market, checked per trade."
          active={value.mode === "auto"}
          onClick={() => onChange({ ...value, mode: "auto" })}
        />
        <ModeCard
          title="Pick a venue"
          body="Pin every trade to one DEX."
          active={value.mode === "pin"}
          onClick={() => onChange({ ...value, mode: "pin" })}
        />
      </div>

      <div className="space-y-3">
        <p className="font-mono text-[10px] tracking-[0.12em] text-text-dim uppercase">
          Venues for {pair}
        </p>

        <div className="border border-grid">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.4fr)_90px_110px_minmax(0,1.4fr)] items-center gap-x-4 border-b border-grid px-4 py-2.5 font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase">
            <span>Venue</span>
            <span className="text-right">Fee</span>
            <span className="text-right">Price</span>
            <span>Liquidity depth</span>
          </div>

          {rows.map((v) => {
            const pinned = value.mode === "pin" && value.venue === v.key;
            const price = v.key === "jupiter" ? jupiterPrice : null;
            const depth = v.key === "jupiter" ? jupiterDepth : null;

            const row = (
              <>
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`truncate font-mono text-[13px] ${
                      pinned
                        ? "text-accent"
                        : v.live
                          ? "text-text-primary"
                          : "text-text-muted"
                    }`}
                  >
                    {v.name}
                  </span>
                  <span
                    className={`shrink-0 border px-1.5 py-px font-mono text-[8.5px] tracking-[0.12em] uppercase ${
                      v.live
                        ? "border-grid-strong text-text-secondary"
                        : "border-grid text-text-muted"
                    }`}
                  >
                    {v.live ? "Live" : "Soon"}
                  </span>
                </span>

                <span
                  className={`tnum text-right font-mono text-[12.5px] ${
                    v.feePct === null ? "text-text-muted" : "text-text-secondary"
                  }`}
                >
                  {v.feePct === null ? "—" : `${v.feePct}%`}
                </span>

                <span
                  className={`tnum text-right font-mono text-[12.5px] ${
                    price === null ? "text-text-muted" : "text-text-primary"
                  }`}
                >
                  {tokenPrice(price).display}
                </span>

                {v.note ? (
                  <span className="truncate font-ui text-[11.5px] text-text-muted">{v.note}</span>
                ) : depth === null ? (
                  // No quote to draw — either this frontend has none for the
                  // venue, or several markets are selected and a quote is per
                  // market. Say which, rather than draw an empty bar, which
                  // reads as no depth.
                  <span className="truncate font-ui text-[11.5px] text-text-muted">
                    {single ? "Quote not wired yet" : "Quotes are per market"}
                  </span>
                ) : (
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="h-1.5 min-w-0 flex-1 bg-grid">
                      <span className="block h-1.5 w-full bg-accent" />
                    </span>
                    <span className="tnum shrink-0 font-mono text-[11.5px] text-text-secondary">
                      {money(depth)}
                    </span>
                  </span>
                )}
              </>
            );

            const className = `grid w-full grid-cols-1 sm:grid-cols-[minmax(0,1.4fr)_90px_110px_minmax(0,1.4fr)] items-center gap-x-4 border-b border-grid px-4 py-3 text-left last:border-b-0 ${
              pinned ? "bg-accent-wash" : ""
            }`;

            // Rows are only pressable when pinning is the active mode AND the
            // venue can actually take an order. Under Auto nothing here is a
            // choice — it is the list Auto prices across.
            return v.live && value.mode === "pin" ? (
              <button
                key={v.key}
                type="button"
                aria-pressed={pinned}
                onClick={() => onChange({ mode: "pin", venue: v.key })}
                className={`${className} transition-colors hover:bg-panel`}
              >
                {row}
              </button>
            ) : (
              <div key={v.key} className={className}>
                {row}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-4 border border-grid bg-panel px-5 py-4">
        <span className="mt-0.5 w-0.5 shrink-0 self-stretch bg-accent" />
        <p className="font-ui text-[12.5px] leading-relaxed text-text-secondary">
          {value.mode === "auto"
            ? "Auto prices across every venue that can fill this market on every trade, and picks up new ones as they integrate."
            : "Pinned agents stay where you put them until you change it — including after a new venue integrates."}{" "}
          The paper run does not fill on a venue, so this is the route your agent takes when you
          take it live.
        </p>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="font-mono text-[11px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-text-primary"
      >
        ← Back to limits
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------- bits -- */

function ModeCard({
  title,
  badge,
  body,
  active,
  onClick,
}: {
  title: string;
  badge?: string;
  body: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-full flex-col gap-2.5 border p-5 text-left transition-colors ${
        active ? "border-accent bg-accent-wash" : "border-grid hover:border-grid-strong"
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span
          className={`font-mono text-[11.5px] tracking-[0.1em] uppercase ${
            active ? "text-accent" : "text-text-primary"
          }`}
        >
          {title}
        </span>
        {badge ? (
          <span className="shrink-0 font-mono text-[9px] tracking-[0.12em] text-accent uppercase">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="font-ui text-[12.5px] leading-relaxed text-text-dim">{body}</span>
    </button>
  );
}



function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
