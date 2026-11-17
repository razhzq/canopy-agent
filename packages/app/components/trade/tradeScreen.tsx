"use client";

import { useCallback, useState } from "react";
import { ErrorState } from "@/components/states";
import { BottomTabs, usePositions } from "@/components/trade/bottomTabs";
import { MarketHeader } from "@/components/trade/marketHeader";
import { PriceChart, type ChartLevel } from "@/components/trade/priceChart";
import { TokenList } from "@/components/trade/tokenList";
import { TradeFlow, type TradeIntent } from "@/components/trade/tradeFlow";
import { TradePanel } from "@/components/trade/tradePanel";
import { FOCUS } from "@/components/kit";
import { getMarketCandles, getMarketToken } from "@/lib/api";
import { TIMEFRAMES, type Timeframe } from "@/lib/market";
import { useIsMobile } from "@/lib/useIsMobile";
import { useLivePrice, usePublicApi, useTradeAccount, useWatchlist } from "@/lib/useMarket";

/**
 * The Trade screen: token list, market, chart, activity, and the panel.
 *
 * Desktop is three columns at full height under the nav. Below `lg` it stacks
 * — market, chart, the panel, then activity — and the token list gives way to
 * the picker in the market header, which reaches every token anyway.
 */
export function TradeScreen({ mint }: { mint: string }) {
  const [tf, setTf] = useState<Timeframe>("1m");
  const [levels, setLevels] = useState<ChartLevel[]>([]);
  const [intent, setIntent] = useState<TradeIntent | null>(null);
  const [posVersion, setPosVersion] = useState(0);

  const detail = usePublicApi((tk) => getMarketToken(tk, mint), [mint], { pollMs: 30_000 });
  const candles = usePublicApi((tk) => getMarketCandles(tk, mint, tf).then((r) => r.candles), [mint, tf], {
    pollMs: 60_000,
  });
  const token = detail.phase === "ready" ? detail.data.token : null;
  const { price, live } = useLivePrice(mint, token?.priceUsd ?? null);
  const watch = useWatchlist();
  const { account, loading: accountLoading, reload: reloadAccount } = useTradeAccount();
  const positions = usePositions(posVersion);
  const onLevels = useCallback((l: ChartLevel[]) => setLevels(l), []);
  // The panel holds a Copilot setup and a countdown; mounting it twice (one
  // copy per layout, one hidden) would run both. Rendered once, where it fits.
  const mobile = useIsMobile();

  if (detail.phase === "error") {
    return (
      <main className="px-4 py-8 lg:px-8">
        <ErrorState
          message={detail.status === 404 ? "This token is not in Canopy’s universe." : detail.message}
          onRetry={detail.reload}
        />
      </main>
    );
  }

  const chart = (
    <div className="flex h-[340px] flex-col rounded-2xl border border-border bg-panel lg:h-auto lg:min-h-0 lg:flex-1">
      <div role="group" aria-label="Timeframe" className="flex items-center gap-1 px-3 pt-3">
        {TIMEFRAMES.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={t === tf}
            onClick={() => setTf(t)}
            className={`h-7 rounded-md px-2.5 font-mono text-[11.5px] transition-colors ${FOCUS} ${
              t === tf ? "bg-surface-2 text-text-primary" : "text-text-dim hover:text-text-primary"
            }`}
          >
            {t}
          </button>
        ))}
        <span className="flex-1" />
        <span className="font-ui text-[11.5px] text-text-muted">Price</span>
      </div>
      <div className="relative min-h-0 flex-1 p-2">
        {candles.phase === "ready" && candles.data.length ? (
          <PriceChart candles={candles.data} livePrice={price} levels={levels} />
        ) : (
          <div className="flex h-full items-center justify-center font-ui text-[12.5px] text-text-dim">
            {candles.phase === "loading"
              ? "Loading chart"
              : candles.phase === "error"
                ? "Could not load the chart."
                : "No candles for this timeframe yet."}
          </div>
        )}
      </div>
    </div>
  );

  const panel = token ? (
    <TradePanel
      token={token}
      price={price}
      safety={detail.phase === "ready" ? detail.data.safety : null}
      account={account}
      positions={positions.phase === "ready" ? positions.data : []}
      onTrade={setIntent}
      onLevels={onLevels}
      onAccountChanged={reloadAccount}
    />
  ) : (
    <div className="h-64 animate-pulse rounded-2xl bg-surface" aria-busy />
  );

  return (
    <main className="px-4 py-4 lg:h-[calc(100vh-64px)] lg:px-6">
      <div className="flex flex-col gap-4 lg:grid lg:h-full lg:grid-cols-[248px_minmax(0,1fr)_340px]">
        <aside aria-label="Tokens" className="hidden min-h-0 rounded-2xl border border-border bg-panel lg:block">
          <TokenList current={mint} watchVersion={watch.version} />
        </aside>

        <div className="flex min-h-0 flex-col gap-4">
          <MarketHeader
            token={token}
            livePrice={price}
            live={live}
            watched={watch.mints.has(mint)}
            onToggleWatch={() => void watch.toggle(mint)}
          />
          {chart}
          {mobile === true && <section aria-label="Trade panel">{panel}</section>}
          <div className="h-[300px] lg:h-[260px] lg:shrink-0">
            <BottomTabs
              mint={mint}
              positions={positions}
              onSell={(p) =>
                setIntent({
                  side: "sell",
                  token: token && token.mint === p.mint ? token : {
                    mint: p.mint,
                    symbol: p.symbol,
                    name: p.symbol,
                    icon: p.icon,
                    priceUsd: p.qty ? p.valueUsd / p.qty : null,
                    change1hPct: null,
                    change24hPct: null,
                    marketCapUsd: null,
                    volume24hUsd: null,
                    liquidityUsd: null,
                    holderCount: null,
                    category: null,
                    createdAt: null,
                  },
                  fraction: 1,
                  priceUsd: p.qty ? p.valueUsd / p.qty : null,
                })
              }
            />
          </div>
        </div>

        <aside aria-label="Trade panel" className="hidden min-h-0 overflow-y-auto rounded-2xl border border-border bg-panel p-4 lg:block">
          {mobile === false && panel}
        </aside>
      </div>

      {intent && (
        <TradeFlow
          intent={intent}
          account={account}
          accountLoading={accountLoading}
          onAccountChanged={reloadAccount}
          onClose={() => setIntent(null)}
          onDone={() => {
            setPosVersion((v) => v + 1);
            reloadAccount();
            setLevels([]);
          }}
        />
      )}
    </main>
  );
}
