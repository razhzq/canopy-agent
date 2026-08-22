// Skeletons — the shape of the page, before the page.
//
// A spinner says "something is happening". A skeleton says "a table of five
// columns is about to appear here", which is the more useful sentence: the
// layout does not jump when data lands, and the eye has already found the
// column it was going to read.
//
// That only holds if the skeleton MATCHES what replaces it. A generic grey
// block under every screen is a spinner with extra steps, and worse — it
// promises a shape the real content then contradicts. So these are built per
// surface, mirroring the grid templates the live components actually use.
//
// SCREEN READERS STILL GET A SENTENCE.
//
// The old LoadingState carried a visible "Loading your agents". Replacing that
// with silent grey bars would be a regression for anyone not looking at it, so
// every skeleton is wrapped in a live region announcing the same words. The
// bars themselves are aria-hidden: forty empty divs read aloud is noise.
//
// NO RANDOM WIDTHS.
//
// Varying the bar widths keeps a block of rows from reading as a solid slab,
// but Math.random() during render produces different markup on the server and
// the client, and React resolves that as a hydration error. The variation is a
// fixed cycle indexed by row instead — visually irregular, deterministically
// so.

const WIDTHS = ["w-[68%]", "w-[42%]", "w-[81%]", "w-[55%]", "w-[73%]", "w-[38%]"];
const width = (i: number) => WIDTHS[i % WIDTHS.length];

/**
 * One shimmering bar.
 *
 * `motion-reduce:animate-none` because a page full of pulsing blocks is
 * exactly the kind of thing that triggers vestibular discomfort, and the
 * skeleton still communicates its shape perfectly well while still.
 */
function Bar({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block h-[9px] animate-pulse rounded-[1px] bg-grid-strong/70 motion-reduce:animate-none ${className}`}
    />
  );
}

/**
 * The live region every skeleton sits in.
 *
 * `aria-busy` marks the region as in-flight; the label is the same wording the
 * spinner used, so nothing is lost by the change.
 */
function Screen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** The stat band across the top of the agent and portfolio screens. */
function Band({ cells = 5 }: { cells?: number }) {
  return (
    <div className="grid grid-cols-2 border-b border-grid sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: cells }, (_, i) => (
        <div key={i} className="space-y-3 border-r border-grid px-6 py-5 last:border-r-0">
          <Bar className="h-[7px] w-[54%]" />
          <Bar className="h-[15px] w-[70%]" />
        </div>
      ))}
    </div>
  );
}

/**
 * Rows under a column template.
 *
 * `cols` takes the same grid-template-columns string the real table uses, so
 * the skeleton's columns land where the real ones will.
 */
export function SkeletonRows({
  label,
  cols,
  rows = 6,
  band,
}: {
  label: string;
  cols: string;
  rows?: number;
  band?: number;
}) {
  const columns = cols.split(/\s+/).length;
  return (
    <Screen label={label}>
      {band ? <Band cells={band} /> : null}
      <div>
        {Array.from({ length: rows }, (_, r) => (
          <div
            key={r}
            className="grid items-center gap-4 border-b border-grid px-6 py-5 last:border-b-0"
            style={{ gridTemplateColumns: cols }}
          >
            {Array.from({ length: columns }, (_, c) => (
              <Bar key={c} className={c === 0 ? width(r) : "w-[60%]"} />
            ))}
          </div>
        ))}
      </div>
    </Screen>
  );
}

/** The marketplace's card grid. */
export function SkeletonCards({ label, count = 6 }: { label: string; count?: number }) {
  return (
    <Screen label={label}>
      <div className="grid gap-4 px-5 sm:px-8 py-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="space-y-4 border border-grid bg-panel p-5">
            <Bar className="h-[13px] w-[62%]" />
            <Bar className="h-[7px] w-[38%]" />
            <div className="flex gap-4 pt-3">
              <Bar className="h-[22px] w-[30%]" />
              <Bar className="h-[22px] w-[30%]" />
            </div>
            <Bar className={`h-[7px] ${width(i)}`} />
          </div>
        ))}
      </div>
    </Screen>
  );
}

/** Activity log and cycle traces: a marker column and a line of text. */
export function SkeletonLog({ label, rows = 8 }: { label: string; rows?: number }) {
  return (
    <Screen label={label}>
      <ul>
        {Array.from({ length: rows }, (_, i) => (
          <li
            key={i}
            className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-3.5 border-b border-grid px-5 py-3 last:border-b-0"
          >
            <Bar className="size-[9px] rounded-full" />
            <Bar className={width(i)} />
          </li>
        ))}
      </ul>
    </Screen>
  );
}

/**
 * The agent detail page: header, stat band, then the panel column.
 *
 * The heaviest screen in the product and the one that benefits most — four
 * requests compose it, so the spinner it replaces was on screen the longest.
 */
export function SkeletonAgentDetail({ label = "Loading agent" }: { label?: string }) {
  return (
    <Screen label={label}>
      <section className="border-b border-grid px-5 sm:px-8 pt-6 pb-7">
        <Bar className="h-[7px] w-[90px]" />
        <div className="flex flex-wrap items-center gap-4 pt-4">
          <Bar className="h-[24px] w-[240px]" />
          <Bar className="h-[18px] w-[80px]" />
        </div>
        <Bar className="mt-5 h-[30px] w-[180px] rounded-full" />
      </section>

      <Band />

      <div className="grid gap-6 px-5 sm:px-8 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-3.5 border border-grid bg-panel p-6">
              <Bar className="h-[7px] w-[120px]" />
              <Bar className={`h-[13px] ${width(i)}`} />
              <Bar className="w-[46%]" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="space-y-3 border border-grid p-5">
              <Bar className="h-[7px] w-[80px]" />
              <Bar className="w-[70%]" />
              <Bar className="w-[52%]" />
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

/** The steer thread: alternating message blocks. */
export function SkeletonThread({ label = "Loading the thread" }: { label?: string }) {
  return (
    <Screen label={label}>
      <div className="space-y-5 px-5 py-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={i % 2 ? "flex justify-end" : ""}>
            <div
              className={`w-[76%] space-y-2.5 border border-grid p-4 ${i % 2 ? "bg-panel" : ""}`}
            >
              <Bar className="h-[7px] w-[70px]" />
              <Bar className={width(i)} />
              <Bar className={width(i + 2)} />
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

/** A single panel's worth, for regions that load inside an already-drawn page. */
export function SkeletonPanel({ label, lines = 4 }: { label: string; lines?: number }) {
  return (
    <Screen label={label}>
      <div className="space-y-3.5 border border-grid p-6">
        {Array.from({ length: lines }, (_, i) => (
          <Bar key={i} className={width(i)} />
        ))}
      </div>
    </Screen>
  );
}
