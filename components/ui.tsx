import type { UniverseAsset } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { RemoteIcon } from "@/components/remoteIcon";
import {
  Ban,
  Check,
  Info,
  Lock,
  TriangleAlert,
  ArrowRight as LucideArrowRight,
  ChevronRight as LucideChevronRight,
} from "lucide-react";

/* ---------------------------------------------------------------- tone ---- */

export type Tone =
  | "accent"
  | "negative"
  | "warning"
  | "neutral"
  | "muted"
  | "simulated";

const TONE_TEXT: Record<Tone, string> = {
  accent: "text-accent",
  negative: "text-negative",
  warning: "text-warning",
  neutral: "text-text-primary",
  muted: "text-text-dim",
  simulated: "text-simulated",
};

const TONE_BORDER: Record<Tone, string> = {
  accent: "border-accent text-accent",
  negative: "border-negative text-negative",
  warning: "border-warning text-warning",
  neutral: "border-border text-text-secondary",
  muted: "border-grid-strong text-text-dim",
  simulated: "border-grid-strong text-simulated",
};

/** Signed number: green when positive, red when negative, dim at zero. */
export function toneForDelta(value: number): Tone {
  if (value > 0) return "accent";
  if (value < 0) return "negative";
  return "muted";
}

/* --------------------------------------------------------------- badge ---- */

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center border px-1.5 py-[3px] font-mono text-[10px] leading-none tracking-[0.08em] uppercase ${TONE_BORDER[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Filled status chip — used for RUNNING and other live states. */
export function Pill({
  children,
  tone = "accent",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 border px-2 py-1 font-mono text-[10px] leading-none tracking-[0.08em] uppercase ${TONE_BORDER[tone]}`}
    >
      <span
        className={`size-1.5 rounded-full ${tone === "accent" ? "bg-accent" : "bg-current"}`}
      />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- section ---- */

/**
 * The numbered section header that runs down every screen:
 * `01  PERFORMANCE                        NET OF FEES AND SLIPPAGE`
 */
export function SectionHead({
  index,
  title,
  note,
  children,
}: {
  index: string;
  title: string;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 pb-6">
      <div className="flex items-center gap-6">
        <span className="w-4 font-mono text-[11px] text-accent">{index}</span>
        <h2 className="font-mono text-[14px] tracking-[0.06em] text-text-primary">
          {title}
        </h2>
        {children}
      </div>
      {note ? (
        <div className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
          {note}
        </div>
      ) : null}
    </div>
  );
}

/** A full-bleed horizontal band with a hairline underneath. */
export function Band({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-b border-grid ${className}`}>{children}</section>
  );
}

/* ---------------------------------------------------------------- stat ---- */

export function StatCell({
  label,
  value,
  tone = "neutral",
  size = "md",
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
        {label}
      </span>
      <span
        className={`tnum font-mono ${size === "md" ? "text-[22px]" : "text-[15px]"} leading-none ${TONE_TEXT[tone]}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Row of stat cells divided by hairlines — the ribbon under every page title. */
export function StatRail({
  items,
  className = "",
}: {
  items: { label: string; value: ReactNode; tone?: Tone }[];
  className?: string;
}) {
  return (
    <div className={`flex ${className}`}>
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`flex-1 px-8 py-6 ${i > 0 ? "border-l border-grid" : ""}`}
        >
          <StatCell label={item.label} value={item.value} tone={item.tone} />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- rails ---- */

/** `LABEL ....................... value` — the sidebar summary row. */
export function RailRow({
  label,
  value,
  tone = "neutral",
  mono = true,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-grid py-3.5">
      <span className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
        {label}
      </span>
      <span
        className={`tnum text-right text-[12px] ${mono ? "font-mono" : "font-ui"} ${TONE_TEXT[tone]}`}
      >
        {value}
      </span>
    </div>
  );
}

export function RailSection({
  title,
  note,
  children,
  className = "",
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-b border-grid px-8 py-7 ${className}`}>
      <div className="flex items-center justify-between gap-4 pb-2">
        <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
          {title}
        </h3>
        {note ? (
          <span className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
            {note}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------- callout ---- */

const CALLOUT_TONE: Record<string, { bar: string; icon: string }> = {
  info: { bar: "bg-grid-strong", icon: "text-text-dim" },
  warning: { bar: "bg-warning", icon: "text-warning" },
  accent: { bar: "bg-accent", icon: "text-accent" },
  negative: { bar: "bg-negative", icon: "text-negative" },
};

export function Callout({
  tone = "info",
  icon,
  title,
  children,
  filled = true,
}: {
  tone?: keyof typeof CALLOUT_TONE;
  icon?: ReactNode;
  title?: string;
  children?: ReactNode;
  filled?: boolean;
}) {
  const t = CALLOUT_TONE[tone];
  return (
    <div className={`flex gap-4 ${filled ? "bg-panel" : ""} px-5 py-4`}>
      <div className={`w-0.5 shrink-0 self-stretch ${t.bar}`} />
      <div className="flex gap-3">
        {icon ? <span className={`mt-0.5 shrink-0 ${t.icon}`}>{icon}</span> : null}
        <div className="space-y-1.5">
          {title ? (
            <p className="font-mono text-[12px] tracking-[0.06em] text-text-primary uppercase">
              {title}
            </p>
          ) : null}
          {children ? (
            <div className="font-ui text-[13px] leading-relaxed text-text-secondary">
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- buttons ---- */

export function PrimaryButton({
  children,
  href,
  className = "",
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  const cls = `flex h-12 w-full items-center justify-center gap-2.5 bg-accent font-mono text-[12px] tracking-[0.1em] text-bg uppercase transition-opacity hover:opacity-90 ${className}`;
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" className={cls}>
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  href,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  tone?: Tone;
  className?: string;
}) {
  const cls = `flex h-11 w-full items-center justify-center gap-2.5 border font-mono text-[11px] tracking-[0.1em] uppercase transition-colors hover:bg-surface ${TONE_BORDER[tone]} ${className}`;
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" className={cls}>
      {children}
    </button>
  );
}

/** Small square-cornered control used in toolbars (90D, FILTERS, RETURN…). */
export function ToolButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-9 items-center gap-2 border border-border px-3.5 font-mono text-[11px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:border-grid-strong hover:text-text-primary"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------- sources ---- */

/** Providers whose attribution is a mark. Anything absent stays a word. */
const SOURCE_LOGO: Record<string, { src: string; alt: string }> = {
  // The dark-background variant of Wintel's horizontal lockup (#EDEDED type,
  // amber mark), not the black-on-white one their site serves to light pages.
  // This app's panels are #0b0f0e.
  Wintel: { src: "/wintel-horizontal.svg", alt: "Wintel" },
};

/**
 * Who a narrated line got its facts from, stamped at the end of the line.
 *
 * The line already names the provider in prose — "TSLAx volatility from Wintel:
 * 1.61% daily" — so the attribution was repeating the word right after it. A
 * logo attributes without saying it twice.
 *
 * Lives here rather than beside one of its callers because both places that
 * narrate a cycle render this: the activity log on the agent page and the full
 * transcript under /portfolio. They drifted apart once already.
 *
 * No load-failure state on purpose, which keeps this hook-free and usable from
 * a server component: `alt` is the browser's own fallback and renders the
 * provider's name as text, which is exactly what this used to be.
 */
export function SourceMark({ source }: { source: string }) {
  const logo = SOURCE_LOGO[source];

  if (!logo) {
    return (
      <span className="ml-2 font-mono text-[10px] tracking-[0.06em] text-text-dim uppercase">
        {source}
      </span>
    );
  }

  return (
    <Image
      src={logo.src}
      alt={logo.alt}
      title={`Source: ${source}`}
      // The lockup's own viewBox, so the ratio is right; `h-3.5 w-auto` is what
      // sizes it on the line. `unoptimized` because the optimiser refuses SVG
      // without dangerouslyAllowSVG — and a 2.7KB vector has nothing to gain
      // from being rasterised anyway.
      width={1100}
      height={300}
      unoptimized
      className="ml-2 inline-block h-3.5 w-auto align-[-2px] opacity-80"
    />
  );
}

/* -------------------------------------------------------------- tickers --- */

/**
 * Underlyings we hold artwork for, in `public/tickers/<TICKER>.png`.
 *
 * A set rather than a lookup of URLs because the filename IS the ticker — and
 * because the list has to be explicit: `<Image>` on a missing file logs a 404
 * per row, so "try it and see" is not a fallback strategy, it is a console full
 * of noise on every render of a universe we do not have logos for.
 *
 * The seeded universe is a dozen names, so keeping this in step is a one-line
 * job when one is added. Anything not listed renders as a monogram, which is a
 * complete answer rather than a hole.
 */
const TICKER_LOGOS = new Set([
  "AAPL",
  "AMZN",
  "COIN",
  "CRCL",
  "GOOGL",
  "MSFT",
  "NVDA",
  "PLTR",
  "SPCX",
  "SPY",
  "STRC",
  "TSLA",
  // Tokenized gold, which has no equity ticker — these are the wrappers
  // themselves (Paxos and Tether), both of which back the XAU underlying.
  "PAXG",
  "XAUT",
]);

/**
 * Wrapper symbols that are not their own ticker.
 *
 * Tether's gold token is `XAUt0` on Solana, which no amount of unwrapping turns
 * into a filename.
 */
const TICKER_ALIASES: Record<string, string> = {
  XAUT0: "XAUT",
  "XAU₮": "XAUT",
};

/**
 * Tokenized gold is the one asset where the underlying does NOT identify the
 * mark: XAU is a metal, not a company, and the two wrappers of it are separate
 * issuers with separate logos. So gold resolves by issuer, and a gold row with
 * no issuer to hand stays a monogram rather than borrowing Paxos's coin to
 * stand for Tether's.
 */
const GOLD_BY_ISSUER: Record<string, string> = {
  paxos: "PAXG",
  tether: "XAUT",
};

/**
 * The company behind a ticker, resolved from whatever a caller has.
 *
 * Call sites hold different things: the markets table knows the underlying
 * ("TSLA", "XAU") and usually its issuer, a fill row only ever has the
 * wrapper's own symbol ("TSLAx", "PAXG"). The trailing wrapper letter is
 * stripped as a LATE attempt, never a first, or SPCX — a real ticker ending in
 * X — would resolve to a company called SPC.
 */
function tickerOf(symbol: string, issuer?: string | null): string | null {
  const raw = symbol.trim().toUpperCase();

  // Gold first: "XAU" is the only input whose mark depends on who wrapped it.
  if (raw === "XAU") {
    const byIssuer = issuer ? GOLD_BY_ISSUER[issuer.trim().toLowerCase()] : undefined;
    return byIssuer ?? null;
  }

  const aliased = TICKER_ALIASES[raw] ?? raw;
  if (TICKER_LOGOS.has(aliased)) return aliased;

  const unwrapped = aliased.replace(/X$/, "");
  return TICKER_LOGOS.has(unwrapped) ? unwrapped : null;
}

/**
 * A ticker's company mark, for the left of a symbol.
 *
 * The logos are committed under `public/tickers/` rather than hotlinked from a
 * logo CDN: this renders on every row of every position, fill and screening
 * line, and none of those should depend on a third party being up, or tell one
 * which agents a reader is looking at.
 *
 * Each file is an opaque brand tile (the artwork carries its own background),
 * so they are clipped to a rounded square and given no border of their own.
 *
 * Unknown tickers get a monogram in the same footprint. That matters more than
 * it sounds: a row that sometimes has a mark and sometimes has nothing loses
 * its alignment, and the eye reads the gap as an error rather than as an asset
 * nobody has drawn yet.
 */
export function AssetLogo({
  symbol,
  issuer,
  src,
  size = 16,
}: {
  symbol: string;
  /** Which wrapper this is, where the underlying alone cannot say (gold). */
  issuer?: string | null;
  /**
   * A remote icon, for assets with no bundled ticker file.
   *
   * There are five hundred-odd Solana tokens in the universe and the list grows
   * hourly, so shipping a PNG per token is not a thing that can work. The URL
   * comes from the same DexScreener response the sweep already makes to find
   * each token's pool.
   */
  src?: string | null;
  size?: number;
}) {
  const ticker = tickerOf(symbol, issuer);
  const monogram = <Monogram symbol={symbol} size={size} />;

  // A remote icon wins when there is one: the bundled ticker files cover a
  // dozen tokenized RWAs, not five hundred Solana tokens.
  if (src) return <RemoteIcon src={src} size={size} fallback={monogram} />;

  if (!ticker) return monogram;

  return (
    <Image
      src={`/tickers/${ticker}.png`}
      alt=""
      aria-hidden
      // The files are 128px squares; `size` is what actually places them.
      width={128}
      height={128}
      // Nothing to gain from routing a 600-byte icon through the optimiser.
      unoptimized
      className="inline-block shrink-0 rounded-[3px] object-contain"
      style={{ width: size, height: size }}
    />
  );
}

/* --------------------------------------------------------------- misc ----- */

/** Square agent avatar placeholder — the design shows an empty tile. */
export function AgentTile({ size = 34 }: { size?: number }) {
  return (
    <div
      className="shrink-0 border border-grid-strong bg-surface-2"
      style={{ width: size, height: size }}
    />
  );
}

/** A crumb: plain text, or somewhere to go back to. */
export type Crumb = string | { label: string; href: string };

/**
 * The trail back up.
 *
 * Crumbs with an `href` are links; the last one never is, because it names the
 * page you are already on. This used to render every part as plain text, which
 * looked like navigation and did nothing — on the cycle transcript, three
 * levels deep, that left the browser's back button as the only way out.
 */
export function Breadcrumb({ parts }: { parts: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase"
    >
      {parts.map((part, i) => {
        const label = typeof part === "string" ? part : part.label;
        const href = typeof part === "string" ? undefined : part.href;
        const last = i === parts.length - 1;
        return (
          <span key={`${label}-${i}`} className="flex items-center gap-2">
            {i > 0 ? <span className="text-grid-strong">/</span> : null}
            {href && !last ? (
              <Link
                href={href}
                className="transition-colors hover:text-accent hover:underline underline-offset-4"
              >
                {label}
              </Link>
            ) : (
              <span aria-current={last ? "page" : undefined} className={last ? "text-text-secondary" : undefined}>
                {label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/** Two-column page body: 1004px main + 436px rail, matching the design grid. */
export function Columns({
  main,
  rail,
}: {
  main: ReactNode;
  rail: ReactNode;
}) {
  return (
    <div className="flex items-stretch">
      <div className="min-w-0 flex-1">{main}</div>
      <aside className="w-[436px] shrink-0 border-l border-grid">{rail}</aside>
    </div>
  );
}

/* --------------------------------------------------------------- icons -- */

/*
 * Drawn by lucide, wrapped here.
 *
 * These were seven hand-drawn SVGs on a 16 grid. The glyphs are lucide's now —
 * one icon set instead of two, once `lucide-react` arrived for the notification
 * bell — but the WRAPPERS stay, and that is the point of the shape below: every
 * call site keeps passing `className` to a `size-3.5` default, so this is a
 * change of geometry and nothing else. Around fifty usages did not have to be
 * touched, and none of them can drift on sizing.
 *
 * WEIGHT SURVIVED THE MOVE, which is the part that could have gone wrong. The
 * originals drew at stroke 1.3 on a 16 grid, which at the shared 14px default
 * renders ~1.14. Lucide draws at stroke 2 on a 24 grid, which at 14px is ~1.17.
 * Close enough that nothing beside them shifts in apparent weight — and the
 * reason there are no per-icon `strokeWidth` overrides here. Adding those would
 * rebuild by hand the inconsistency that adopting one set removes.
 */

export function CheckIcon({ className = "" }: { className?: string }) {
  return <Check className={`size-3.5 ${className}`} aria-hidden />;
}

export function LockIcon({ className = "" }: { className?: string }) {
  return <Lock className={`size-3.5 ${className}`} aria-hidden />;
}

/** A circle with a bar through it: not "an error", but "cannot happen". */
export function BlockIcon({ className = "" }: { className?: string }) {
  return <Ban className={`size-3.5 ${className}`} aria-hidden />;
}

export function InfoIcon({ className = "" }: { className?: string }) {
  return <Info className={`size-3.5 ${className}`} aria-hidden />;
}

export function WarnIcon({ className = "" }: { className?: string }) {
  return <TriangleAlert className={`size-3.5 ${className}`} aria-hidden />;
}

// Kept under the names the app already uses. Aliased on import because lucide
// exports these two names itself, and renaming ~20 call sites to say
// `LucideArrowRight` would be churn in service of nothing.
export function ArrowRight({ className = "" }: { className?: string }) {
  return <LucideArrowRight className={`size-3.5 ${className}`} aria-hidden />;
}

export function ChevronRight({ className = "" }: { className?: string }) {
  return <LucideChevronRight className={`size-3.5 ${className}`} aria-hidden />;
}

/** What kind of thing this is, in the reader's terms. */
export function describeClass(a: UniverseAsset): string {
  if (a.kind === "crypto") {
    // The tier is the honest caveat on a token nobody vouches for.
    return a.tier === "pool" ? "Crypto · unverified" : "Crypto";
  }
  if (a.assetClass === "commodity") return "Tokenized commodity";
  if (a.assetClass === "etf") return "Tokenized fund";
  return "Tokenized equity";
}

/** The two-letter stand-in for an asset with no artwork. */
function Monogram({ symbol, size }: { symbol: string; size: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[3px] border border-grid bg-surface-2 font-mono text-text-dim"
      style={{ width: size, height: size, fontSize: Math.max(size * 0.42, 7) }}
    >
      {symbol.trim().slice(0, 2).toUpperCase()}
    </span>
  );
}
