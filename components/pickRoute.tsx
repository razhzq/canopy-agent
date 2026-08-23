"use client";

import { num, type UniverseAsset } from "@/lib/api";
import { tokenPrice } from "@/lib/format";

/**
 * Step 3 — choose a venue. Wireframe 1f.
 *
 * WHY THIS STEP EXISTS AGAIN
 *
 * The builder used to run market → limits → paper run, on the wireframe's own
 * rule that "markets with only one live venue skip this step entirely". Two are
 * live for the RWA pairs now, so the step comes back where the wireframe puts
 * it: after the limits, before the paper test that the footer button starts.
 *
 * WHAT IS REAL ON THIS SCREEN
 *
 * Jupiter's price and depth are the ones the universe resolver already returned
 * for the chosen market — the same numbers step 1 ranked on. Canopy's quote is
 * NOT wired to this frontend yet, so its row shows its published fee and a dash
 * where a live quote would be, rather than a plausible-looking number nobody
 * measured. The three integrating venues are listed because the wireframe lists
 * them: they set the expectation that a pin is not forever.
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
  /** Taker fee as a percentage, or null while the venue is integrating. */
  feePct: number | null;
  live: boolean;
  /** Shown instead of a depth bar for venues that are not live. */
  note?: string;
};

/**
 * The venue list. Fees are published schedules, not quotes — a quote is the
 * price/depth pair, and only Jupiter's is available to this frontend today.
 */
const VENUES: Venue[] = [
  { key: "jupiter", name: "Jupiter", feePct: 0.04, live: true },
  { key: "canopy", name: "Canopy", feePct: 0.02, live: true },
  { key: "aeonian", name: "Aeonian", feePct: null, live: false, note: "RWA DEX · integrating" },
  { key: "kalqix", name: "KalqiX", feePct: null, live: false, note: "CLOB DEX · integrating" },
  { key: "edgex", name: "edgeX", feePct: null, live: false, note: "Spot & perps · integrating" },
];

export const LIVE_VENUES = VENUES.filter((v) => v.live);

/** One line for the summary rail: what the current choice actually routes to. */
export function describeRoute(route: RouteChoice): string {
  if (route.mode === "auto") {
    return `Auto · ${LIVE_VENUES.map((v) => v.name).join(" + ")}`;
  }
  const v = LIVE_VENUES.find((x) => x.key === route.venue);
  return `Pinned · ${v?.name ?? "—"}`;
}

export function PickRoute({
  market,
  value,
  onChange,
  onBack,
}: {
  market: UniverseAsset;
  value: RouteChoice;
  onChange: (next: RouteChoice) => void;
  onBack: () => void;
}) {
  const pair = `${market.symbol}/USDC`;

  // Only Jupiter has a quote here, so it is also the only bar with a length.
  // A single full-width bar would read as "deepest of several" when it is
  // really "the one we can measure" — so the bar is scaled against the row's
  // own liquidity and the unmeasured row gets a dash instead of an empty
  // track that looks like zero depth.
  const jupiterPrice = num(market.priceUsd);
  const jupiterDepth = num(market.liquidityUsd);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-mono text-[10px] tracking-[0.12em] text-text-dim uppercase">
          Step 3 of 3 · Route
        </p>
        <h2 className="font-mono text-[22px] leading-none text-text-primary">Choose a venue</h2>
        <p className="max-w-[68ch] font-ui text-[13.5px] leading-relaxed text-text-secondary">
          {LIVE_VENUES.length} venues are live for {pair} —{" "}
          {LIVE_VENUES.map((v) => v.name).join(" and ")}. Markets with only one live venue skip
          this step entirely.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <ModeCard
          title="Auto"
          badge="Recommended"
          body="Best price across every live venue, checked per trade."
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

          {VENUES.map((v) => {
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
                  // Live, but this frontend has no quote for it. Say that
                  // rather than draw an empty bar, which reads as no depth.
                  <span className="truncate font-ui text-[11.5px] text-text-muted">
                    Quote not wired yet
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
            ? "Auto prices across every live venue on every trade, and picks up new ones as they integrate."
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
