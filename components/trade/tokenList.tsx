"use client";

import Link from "next/link";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { FOCUS } from "@/components/kit";
import { Delta, FilterChip, Price, TokenMark, UnderlineTabs } from "@/components/trade/bits";
import { getFeedIdeas, getMarketTokens, getWatchlist } from "@/lib/api";
import { compactUsd } from "@/lib/format";
import { TOKEN_LISTS, type TokenList as ListKey, type TokenRow } from "@/lib/market";
import { usePublicApi } from "@/lib/useMarket";

type Tab = "tokens" | "feed" | "watch";

function Row({ t, on }: { t: TokenRow; on: boolean }) {
  return (
    <Link
      href={`/trade/${t.mint}`}
      aria-current={on ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${FOCUS} ${
        on ? "bg-surface-2" : "hover:bg-surface"
      }`}
    >
      <TokenMark symbol={t.symbol} icon={t.icon} size={22} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-ui text-[13px] text-text-primary">{t.symbol}</span>
        <span className="block truncate font-mono text-[11px] text-text-muted">{compactUsd(t.marketCapUsd)}</span>
      </span>
      <span className="text-right">
        <Price value={t.priceUsd} className="block text-[12px] text-text-primary" />
        <Delta value={t.change24hPct} className="block text-[11px]" />
      </span>
    </Link>
  );
}

function Rows({ state, current, empty }: {
  state: ReturnType<typeof usePublicApi<TokenRow[]>>;
  current: string;
  empty: string;
}) {
  if (state.phase === "loading") {
    return (
      <div className="space-y-1.5 p-1" aria-busy>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    );
  }
  if (state.phase === "error") {
    return (
      <div className="p-3 font-ui text-[12.5px] text-text-dim">
        Could not load tokens.{" "}
        <button type="button" className="text-text-primary underline" onClick={state.reload}>
          Retry
        </button>
      </div>
    );
  }
  if (state.phase !== "ready" || !state.data.length) {
    return <p className="p-3 font-ui text-[12.5px] text-text-dim">{empty}</p>;
  }
  return (
    <div className="space-y-0.5">
      {state.data.map((t) => (
        <Row key={t.mint} t={t} on={t.mint === current} />
      ))}
    </div>
  );
}

export function TokenList({ current, watchVersion }: { current: string; watchVersion: number }) {
  const [tab, setTab] = useState<Tab>("tokens");
  const [list, setList] = useState<ListKey>("crypto");
  const { authenticated, login } = usePrivy();

  const tokens = usePublicApi((tk) => getMarketTokens(tk, list).then((r) => r.tokens), [list], { pollMs: 30_000 });
  const feed = usePublicApi((tk) => getFeedIdeas(tk, "all").then((r) => r.ideas), [], { pollMs: 60_000 });
  const watch = usePublicApi(
    (tk) => (tk ? getWatchlist(tk).then((r) => r.tokens) : Promise.resolve([] as TokenRow[])),
    [watchVersion],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <UnderlineTabs<Tab>
        label="List"
        value={tab}
        onChange={setTab}
        className="px-3"
        tabs={[
          { key: "tokens", label: "Tokens" },
          { key: "feed", label: "Feed" },
          { key: "watch", label: "Watchlist" },
        ]}
      />
      {tab === "tokens" && (
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 [scrollbar-width:none]">
          {TOKEN_LISTS.map((l) => (
            <FilterChip key={l.key} on={l.key === list} onClick={() => setList(l.key)}>
              {l.label}
            </FilterChip>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {tab === "tokens" && <Rows state={tokens} current={current} empty="No tokens in this list right now." />}
        {tab === "watch" &&
          (authenticated ? (
            <Rows state={watch} current={current} empty="Star a token to keep it here." />
          ) : (
            <div className="p-3 font-ui text-[12.5px] text-text-dim">
              <button type="button" className="text-text-primary underline" onClick={() => login()}>
                Sign in
              </button>{" "}
              to keep a watchlist.
            </div>
          ))}
        {tab === "feed" &&
          (feed.phase === "ready" ? (
            feed.data.length ? (
              <div className="space-y-0.5 pt-1.5">
                {feed.data.map((i) => (
                  <Link
                    key={i.id}
                    href={`/trade/${i.token.mint}`}
                    className={`block rounded-lg px-2.5 py-2 transition-colors ${FOCUS} ${
                      i.token.mint === current ? "bg-surface-2" : "hover:bg-surface"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <TokenMark symbol={i.token.symbol} icon={i.token.icon} size={18} />
                      <span className="font-ui text-[12.5px] text-text-primary">{i.token.symbol}</span>
                      <span className="flex-1" />
                      <span className="font-ui text-[11px] text-text-muted">{i.ageLabel}</span>
                    </span>
                    <span className="mt-1 block font-ui text-[12px] leading-snug text-text-dim">{i.headline}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="p-3 font-ui text-[12.5px] text-text-dim">No ideas right now.</p>
            )
          ) : feed.phase === "error" ? (
            <p className="p-3 font-ui text-[12.5px] text-text-dim">Could not load the feed.</p>
          ) : (
            <div className="space-y-1.5 p-1" aria-busy>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-surface" />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
