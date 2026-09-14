"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePrivy } from "@privy-io/react-auth";
import { getTokenSparkline, type UniverseAsset } from "@/lib/api";
import { compactUsd, tokenPrice } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { AssetLogo } from "@/components/ui";
import { MiniCurve } from "@/components/charts";
import { POPOVER_SHADOW } from "@/components/kit";

/**
 * A day of closes per mint, shared by every card on the page.
 *
 * MODULE-LEVEL ON PURPOSE. The book and the history list the same tokens over
 * and over, and a reader scanning down a column hovers each one in turn. A
 * per-card cache would refetch the same series on every second hover; this one
 * asks once per token and every card reads the answer. Kept for five minutes —
 * the series is hourly, so anything fresher is the same picture.
 */
const SERIES_TTL_MS = 5 * 60_000;
const series = new Map<string, { at: number; closes: number[] }>();
const inflight = new Map<string, Promise<number[]>>();

/** How long the pointer rests before the card opens. Below this is a pass-by. */
const HOVER_DELAY_MS = 180;

/** Card width, and what the anchor is clamped against so it never opens off-screen. */
const CARD_W = 264;

/**
 * Wraps a token's logo and symbol; hovering it opens a card with what the
 * token is doing right now — price, the day's move, market cap, depth, and a
 * 24-hour line.
 *
 * HOVER, NOT PRESS. Both tables render this inside something that already
 * owns the click (the open row is an expand button, the history row is a
 * link-bearing grid), so a second interactive element here would nest a
 * control inside a control. The card is a glance, not a destination: nothing
 * on it can only be learned here, so hover-only costs nothing a keyboard user
 * cannot get from the row itself.
 *
 * Everything but the line comes from the universe row already in hand, so a
 * card with no network opens as fast as a tooltip. The line is fetched when
 * the card first opens, and only then — a page of forty positions must not
 * fire forty requests on load for charts nobody looked at.
 */
export function TokenPeek({
  symbol,
  mint,
  asset,
  children,
}: {
  symbol: string;
  /** What the sparkline is keyed on. Null when the row has no mint to ask about. */
  mint: string | null;
  /** The universe row behind the symbol, when the universe still has it. */
  asset: UniverseAsset | undefined;
  children: ReactNode;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [at, setAt] = useState<{ x: number; y: number; above: boolean } | null>(null);

  const open = () => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    // Below by default, above when the bottom of the viewport is nearer than
    // the card is tall. Left-aligned to the symbol rather than centred, the
    // way a dropdown sits under its field, and clamped so the right edge stays
    // on screen for the last column of a narrow layout.
    const above = window.innerHeight - r.bottom < 260;
    setAt({
      x: Math.min(Math.max(r.left, 8), window.innerWidth - CARD_W - 8),
      y: above ? r.top - 8 : r.bottom + 8,
      above,
    });
  };

  const arm = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(open, HOVER_DELAY_MS);
  };
  const disarm = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setAt(null);
  };

  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    // Capture: the scroller is an ancestor and scroll does not bubble.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [at]);

  // A pending open must not fire after the row it belonged to is gone.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <>
      <span
        ref={anchor}
        onMouseEnter={arm}
        onMouseLeave={disarm}
        className="inline-flex min-w-0 cursor-default items-center gap-2"
      >
        {children}
      </span>
      {at && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              style={{
                left: at.x,
                top: at.y,
                width: CARD_W,
                transform: at.above ? "translateY(-100%)" : undefined,
              }}
              className={`pointer-events-none fixed z-[60] rounded-xl border border-border bg-surface p-3 ${POPOVER_SHADOW}`}
            >
              <Card symbol={symbol} mint={mint} asset={asset} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function Card({
  symbol,
  mint,
  asset,
}: {
  symbol: string;
  mint: string | null;
  asset: UniverseAsset | undefined;
}) {
  const { t } = useLocale();
  const closes = useSeries(mint);

  const price = asset?.priceUsd ?? null;
  const change = asset?.changePct ?? null;
  // The line's own move, from its first close to its last. Coloured from
  // that rather than from `changePct`, which is a different window (the
  // research day, not the trailing 24 hours) and can disagree with the shape.
  const lineMove =
    closes && closes.length > 1 && closes[0] > 0
      ? ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100
      : null;

  const facts: { label: string; value: string }[] = [
    { label: t("token_peek_market_cap"), value: compactUsd(asset?.marketCapUsd) },
    { label: t("token_peek_fdv"), value: compactUsd(asset?.fdvUsd) },
    { label: t("token_peek_liquidity"), value: compactUsd(asset?.liquidityUsd) },
    { label: t("token_peek_volume_24h"), value: compactUsd(asset?.volume24hUsd) },
  ].filter((f) => f.value !== "—");

  return (
    <div className="flex flex-col gap-2.5">
      {/* Who: logo, name if the universe knows one, the symbol either way. */}
      <div className="flex items-center gap-2">
        <AssetLogo symbol={symbol} issuer={asset?.issuer} src={asset?.iconUrl} size={22} />
        <span className="min-w-0">
          <span className="block truncate font-ui text-[12.5px] font-medium text-text-primary">
            {asset?.name ?? symbol}
          </span>
          <span className="block font-mono text-[11px] text-text-dim">{symbol}</span>
        </span>
      </div>

      {/* What it costs, and how the day is going. */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="tnum font-mono text-[17px] text-text-primary" title={tokenPrice(price).label}>
          {tokenPrice(price).display}
        </span>
        {change === null ? null : (
          <span
            className={`tnum font-mono text-[12px] ${change >= 0 ? "text-accent" : "text-negative"}`}
          >
            {change >= 0 ? "+" : "−"}
            {Math.abs(change).toFixed(2)}%
            <span className="pl-1 font-ui text-[10.5px] text-text-dim">{t("token_peek_daily")}</span>
          </span>
        )}
      </div>

      {/* The last day, hour by hour. */}
      <div className="rounded-lg bg-surface-2 px-2 pb-1.5 pt-2">
        {closes === undefined ? (
          <div className="h-[44px] animate-pulse rounded bg-grid" />
        ) : closes.length < 2 ? (
          <p className="flex h-[44px] items-center justify-center font-ui text-[11px] text-text-muted">
            {t("token_peek_no_chart")}
          </p>
        ) : (
          <MiniCurve
            values={closes}
            width={CARD_W - 24 - 16}
            height={44}
            tone={lineMove !== null && lineMove < 0 ? "negative" : "accent"}
          />
        )}
        <div className="flex items-center justify-between pt-1 font-ui text-[10.5px] text-text-muted">
          <span>{t("token_peek_last_24h")}</span>
          {lineMove === null ? null : (
            <span className={`tnum font-mono ${lineMove >= 0 ? "text-accent" : "text-negative"}`}>
              {lineMove >= 0 ? "+" : "−"}
              {Math.abs(lineMove).toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* Size and depth. Only the facts the universe actually has for this row;
          an RWA wrapper or a perp market carries few or none, and a grid of
          dashes says less than no grid. */}
      {facts.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {facts.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-2">
              <dt className="font-ui text-[11px] text-text-muted">{f.label}</dt>
              <dd className="tnum font-mono text-[11.5px] text-text-secondary">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/**
 * The closes for a mint: `undefined` while loading, `[]` when there is nothing
 * to draw, the series otherwise. A failed read reads as nothing to draw — the
 * card is a glance, and a red state on a hover is more alarm than it merits.
 */
function useSeries(mint: string | null): number[] | undefined {
  const { getAccessToken } = usePrivy();
  const cached = mint ? series.get(mint) : undefined;
  const fresh = cached && Date.now() - cached.at < SERIES_TTL_MS ? cached.closes : undefined;
  const [closes, setCloses] = useState<number[] | undefined>(mint ? fresh : []);

  useEffect(() => {
    if (!mint) return;
    const hit = series.get(mint);
    if (hit && Date.now() - hit.at < SERIES_TTL_MS) {
      setCloses(hit.closes);
      return;
    }
    let live = true;
    let p = inflight.get(mint);
    if (!p) {
      p = (async () => {
        try {
          const token = await getAccessToken();
          if (!token) return [];
          const r = await getTokenSparkline(token, mint);
          return r.closes;
        } catch {
          return [];
        }
      })();
      inflight.set(mint, p);
      void p.then((c) => {
        series.set(mint, { at: Date.now(), closes: c });
        inflight.delete(mint);
      });
    }
    void p.then((c) => {
      if (live) setCloses(c);
    });
    return () => {
      live = false;
    };
  }, [mint, getAccessToken]);

  return closes;
}
