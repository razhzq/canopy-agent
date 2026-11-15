"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useMemo, useState } from "react";
import { ErrorState } from "@/components/states";
import { FOCUS, SECONDARY } from "@/components/kit";
import { FilterChip } from "@/components/trade/bits";
import { IdeaCard } from "@/components/feed/ideaCard";
import { TradeFlow, type TradeIntent, type TradeResult } from "@/components/trade/tradeFlow";
import { getFeedIdeas, passIdea } from "@/lib/api";
import { FEED_CATS, type FeedCat } from "@/lib/market";
import { usePublicApi, useTradeAccount } from "@/lib/useMarket";

function updatedText(iso: string | undefined, now: number): string {
  if (!iso) return "Live";
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  return m < 1 ? "Live · updated just now" : `Live · updated ${m} min ago`;
}

/**
 * The Feed: one trade idea at a time.
 *
 * The whole list is fetched once per category (and refreshed in the
 * background), and the reader steps through it. Position reads as "3 of 11" —
 * text, not a row of dots.
 */
export function FeedScreen() {
  const [cat, setCat] = useState<FeedCat>("all");
  const [index, setIndex] = useState(0);
  const [intent, setIntent] = useState<TradeIntent | null>(null);
  const [bought, setBought] = useState<Record<string, Extract<TradeResult, { side: "buy" }>>>({});
  const [now, setNow] = useState(() => Date.now());
  const { authenticated, getAccessToken } = usePrivy();
  const { account, loading, reload } = useTradeAccount();

  // The "all" request carries the counts for every chip; a category is
  // filtered from it so switching chips is instant.
  const feed = usePublicApi((tk) => getFeedIdeas(tk, "all"), [], { pollMs: 60_000 });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const ideas = useMemo(
    () => (feed.phase === "ready" ? feed.data.ideas.filter((i) => cat === "all" || i.cat === cat) : []),
    [feed, cat],
  );
  const current = ideas[Math.min(index, Math.max(0, ideas.length - 1))];

  const step = (d: number) => setIndex((i) => Math.max(0, Math.min(ideas.length - 1, i + d)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (intent) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function pass() {
    if (current && authenticated) {
      void (async () => {
        try {
          const tk = await getAccessToken();
          if (tk) await passIdea(tk, current.id);
        } catch {
          /* a lost pass is only a missed data point */
        }
      })();
    }
    step(1);
  }

  const counts = feed.phase === "ready" ? feed.data.counts : {};

  return (
    <main className="mx-auto w-full max-w-[860px] px-4 py-8 lg:px-6">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h1 className="font-ui text-[28px] font-light tracking-[-0.02em] text-text-primary">Feed</h1>
        <span className="font-ui text-[12px] text-text-muted">
          {feed.phase === "ready" ? updatedText(feed.data.updatedAt, now) : ""}
        </span>
      </div>
      <p className="mb-4 font-ui text-[13px] text-text-dim">
        Trending tokens and setups. Copilot sets your take profit and stop loss, so buying is one tap.
      </p>

      <div role="tablist" aria-label="Feed filter" className="mb-4 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {FEED_CATS.map((c) => (
          <FilterChip
            key={c.key}
            on={c.key === cat}
            count={counts[c.key]}
            onClick={() => {
              setCat(c.key);
              setIndex(0);
            }}
          >
            {c.label}
          </FilterChip>
        ))}
      </div>

      {feed.phase === "error" ? (
        <ErrorState message={feed.message} onRetry={feed.reload} />
      ) : feed.phase !== "ready" ? (
        <div className="space-y-3" aria-busy>
          <div className="h-[340px] animate-pulse rounded-2xl bg-surface" />
          <div className="h-[260px] animate-pulse rounded-2xl bg-surface" />
        </div>
      ) : !current ? (
        <div className="rounded-2xl border border-border px-6 py-16 text-center font-ui text-[13px] text-text-dim">
          No ideas in this category right now.
        </div>
      ) : (
        <>
          <IdeaCard
            key={current.id}
            idea={current}
            bought={bought[current.id] ?? null}
            onTrade={setIntent}
            onPass={pass}
            onNext={() => step(1)}
          />
          <div className="mt-4 flex items-center justify-between">
            <button type="button" className={`${SECONDARY} ${FOCUS}`} disabled={index <= 0} onClick={() => step(-1)}>
              Previous
            </button>
            <span className="tnum font-mono text-[12px] text-text-muted">
              {Math.min(index, ideas.length - 1) + 1} of {ideas.length}
            </span>
            <button
              type="button"
              className={`${SECONDARY} ${FOCUS}`}
              disabled={index >= ideas.length - 1}
              onClick={() => step(1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      {intent && (
        <TradeFlow
          intent={intent}
          account={account}
          accountLoading={loading}
          onAccountChanged={reload}
          onClose={() => setIntent(null)}
          onDone={(r) => {
            reload();
            if (r.side === "buy" && current) setBought((b) => ({ ...b, [current.id]: r }));
          }}
        />
      )}
    </main>
  );
}
