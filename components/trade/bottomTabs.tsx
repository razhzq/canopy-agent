"use client";

import Link from "next/link";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { FOCUS } from "@/components/kit";
import { Price, TokenMark, UnderlineTabs } from "@/components/trade/bits";
import { getMarketHolders, getMarketTrades, getTradePositions } from "@/lib/api";
import { usd } from "@/lib/format";
import { ageText, shortAddr, type Position } from "@/lib/market";
import { usePublicApi } from "@/lib/useMarket";

type Pane = "trades" | "holders" | "positions";

const TH = "px-3 py-2 text-left font-ui text-[11.5px] font-normal text-text-muted";
const TD = "px-3 py-2 font-ui text-[12.5px] text-text-secondary";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-6 font-ui text-[12.5px] text-text-dim">{children}</p>;
}

function Loading() {
  return (
    <div className="space-y-1.5 p-3" aria-busy>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-7 animate-pulse rounded bg-surface" />
      ))}
    </div>
  );
}

function Trades({ mint }: { mint: string }) {
  const s = usePublicApi((tk) => getMarketTrades(tk, mint), [mint], { pollMs: 5_000 });
  if (s.phase === "loading") return <Loading />;
  if (s.phase === "error") return <Empty>Could not load trades.</Empty>;
  if (s.phase !== "ready") return null;
  if (!s.data.available) return <Empty>Live trades are not available for this token yet.</Empty>;
  if (!s.data.trades.length) return <Empty>No trades in the last few minutes.</Empty>;
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className={TH}>Age</th>
          <th className={TH}>Type</th>
          <th className={`${TH} text-right`}>Value</th>
          <th className={`${TH} text-right`}>Price</th>
          <th className={TH}>Wallet</th>
        </tr>
      </thead>
      <tbody>
        {s.data.trades.map((t, i) => (
          <tr key={`${t.ts}-${t.wallet}-${i}`} className="border-t border-border-soft">
            <td className={`${TD} tnum font-mono`}>{ageText(t.ts)}</td>
            <td className={`${TD} ${t.side === "buy" ? "text-positive" : "text-negative"}`}>
              {t.side === "buy" ? "Buy" : "Sell"}
            </td>
            <td className={`${TD} tnum text-right font-mono text-text-primary`}>{usd(t.valueUsd)}</td>
            <td className={`${TD} text-right`}>
              <Price value={t.priceUsd} />
            </td>
            <td className={`${TD} tnum font-mono`}>
              <a href={`https://solscan.io/account/${t.wallet}`} target="_blank" rel="noreferrer" className="hover:text-text-primary">
                {shortAddr(t.wallet)}
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Holders({ mint }: { mint: string }) {
  const s = usePublicApi((tk) => getMarketHolders(tk, mint), [mint]);
  if (s.phase === "loading") return <Loading />;
  if (s.phase === "error") return <Empty>Could not load holders.</Empty>;
  if (s.phase !== "ready") return null;
  if (!s.data.available) return <Empty>Holders are not available for this token yet.</Empty>;
  if (!s.data.holders.length) return <Empty>No holders found.</Empty>;
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className={TH}>#</th>
          <th className={TH}>Wallet</th>
          <th className={`${TH} text-right`}>Share</th>
          <th className={TH}>Note</th>
        </tr>
      </thead>
      <tbody>
        {s.data.holders.map((h) => (
          <tr key={h.wallet} className="border-t border-border-soft">
            <td className={`${TD} tnum font-mono`}>{h.rank}</td>
            <td className={`${TD} tnum font-mono`}>
              <a href={`https://solscan.io/account/${h.wallet}`} target="_blank" rel="noreferrer" className="hover:text-text-primary">
                {shortAddr(h.wallet)}
              </a>
            </td>
            <td className={`${TD} tnum text-right font-mono text-text-primary`}>{h.sharePct.toFixed(2)}%</td>
            <td className={TD}>{h.note ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Positions({
  state,
  onSell,
}: {
  state: ReturnType<typeof usePositions>;
  onSell: (p: Position) => void;
}) {
  const { authenticated, login } = usePrivy();
  if (!authenticated)
    return (
      <Empty>
        <button type="button" className="text-text-primary underline" onClick={() => login()}>
          Sign in
        </button>{" "}
        to see your positions.
      </Empty>
    );
  if (state.phase === "loading") return <Loading />;
  if (state.phase === "error") return <Empty>Could not load positions.</Empty>;
  if (state.phase !== "ready") return null;
  if (!state.data.length) return <Empty>No open positions.</Empty>;
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className={TH}>Token</th>
          <th className={`${TH} text-right`}>Bought</th>
          <th className={`${TH} text-right`}>Value</th>
          <th className={`${TH} text-right`}>P&amp;L</th>
          <th className={TH}>Source</th>
          <th className={TH} />
        </tr>
      </thead>
      <tbody>
        {state.data.map((p) => (
          <tr key={p.id} className="border-t border-border-soft">
            <td className={TD}>
              <Link href={`/trade/${p.mint}`} className={`flex items-center gap-2 text-text-primary ${FOCUS}`}>
                <TokenMark symbol={p.symbol} icon={p.icon} size={16} />
                {p.symbol}
              </Link>
            </td>
            <td className={`${TD} tnum text-right font-mono`}>{usd(p.costUsd)}</td>
            <td className={`${TD} tnum text-right font-mono text-text-primary`}>{usd(p.valueUsd)}</td>
            <td className={`${TD} tnum text-right font-mono ${p.pnlUsd >= 0 ? "text-positive" : "text-negative"}`}>
              {usd(p.pnlUsd, { sign: true })} · {p.pnlPct >= 0 ? "+" : "−"}
              {Math.abs(p.pnlPct).toFixed(1)}%
            </td>
            <td className={TD}>{p.source}</td>
            <td className={`${TD} text-right`}>
              <button type="button" onClick={() => onSell(p)} className={`text-text-dim hover:text-text-primary ${FOCUS}`}>
                Sell
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The signed-in user's open positions, polled; empty while signed out. */
export function usePositions(version: number) {
  return usePublicApi(
    (tk) => (tk ? getTradePositions(tk, "open").then((r) => r.positions) : Promise.resolve([] as Position[])),
    [version],
    { pollMs: 15_000 },
  );
}

export function BottomTabs({
  mint,
  positions,
  onSell,
}: {
  mint: string;
  positions: ReturnType<typeof usePositions>;
  onSell: (p: Position) => void;
}) {
  const [pane, setPane] = useState<Pane>("trades");
  const count = positions.phase === "ready" ? positions.data.length : null;
  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-panel">
      <UnderlineTabs<Pane>
        label="Market activity"
        value={pane}
        onChange={setPane}
        className="px-4"
        tabs={[
          { key: "trades", label: "Live trades" },
          { key: "holders", label: "Holders" },
          {
            key: "positions",
            label: (
              <>
                Positions{count ? <span className="tnum ml-1.5 font-mono text-[11px] text-text-muted">{count}</span> : null}
              </>
            ),
          },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-auto">
        {pane === "trades" && <Trades mint={mint} />}
        {pane === "holders" && <Holders mint={mint} />}
        {pane === "positions" && <Positions state={positions} onSell={onSell} />}
      </div>
    </div>
  );
}
