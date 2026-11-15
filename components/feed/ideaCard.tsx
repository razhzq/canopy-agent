"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FOCUS, LABEL, PRIMARY, SECONDARY } from "@/components/kit";
import { AmountField, Delta, Price, Segmented, TokenMark, scoreTone } from "@/components/trade/bits";
import { MiniChart, type MiniLevel } from "@/components/feed/miniChart";
import type { TradeIntent, TradeResult } from "@/components/trade/tradeFlow";
import { getMarketCandles } from "@/lib/api";
import { usd } from "@/lib/format";
import {
  ladderLines,
  manualPlan,
  planMath,
  planName,
  presetPlan,
  upLabel,
  type ExitPlanKey,
  type Idea,
} from "@/lib/market";
import { useLivePrice, usePublicApi } from "@/lib/useMarket";

const PRESETS = ["50", "100", "250", "500"];

function Receipt({ idea, result, onNext }: { idea: Idea; result: Extract<TradeResult, { side: "buy" }>; onNext: () => void }) {
  const p = result.position;
  const cell = (label: string, v: React.ReactNode) => (
    <div>
      <p className={LABEL}>{label}</p>
      <div className="tnum font-mono text-[13px] text-text-primary">{v}</div>
    </div>
  );
  return (
    <div className="space-y-4 rounded-xl border border-border p-4" role="status">
      <p className="font-ui text-[14px] text-text-primary">Bought {idea.token.symbol}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cell("Filled at", <Price value={p.entryPriceUsd} />)}
        {cell("Size", usd(p.costUsd))}
        {cell("Take profit", p.takeProfitPriceUsd != null ? <Price value={p.takeProfitPriceUsd} /> : "—")}
        {cell("Stop loss", p.stopPriceUsd != null ? <Price value={p.stopPriceUsd} /> : "—")}
      </div>
      <div className="flex justify-end gap-2">
        <Link href={`/trade/${idea.token.mint}`} className={SECONDARY}>
          View position
        </Link>
        <button type="button" className={PRIMARY} onClick={onNext}>
          Next idea
        </button>
      </div>
    </div>
  );
}

export function IdeaCard({
  idea,
  bought,
  onTrade,
  onPass,
  onNext,
}: {
  idea: Idea;
  bought: Extract<TradeResult, { side: "buy" }> | null;
  onTrade: (i: TradeIntent) => void;
  onPass: () => void;
  onNext: () => void;
}) {
  const t = idea.token;
  const { price } = useLivePrice(t.mint, t.priceUsd);
  const [mode, setMode] = useState<"copilot" | "manual">("copilot");
  const [plan, setPlan] = useState<ExitPlanKey>(idea.plan);
  const [amt, setAmt] = useState("100");
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [shared, setShared] = useState(false);

  useEffect(() => {
    setMode("copilot");
    setPlan(idea.plan);
    const base = presetPlan(idea.plan);
    setTp(String(base.scaleOut?.[0]?.atPct ?? base.takeProfitPct ?? 8));
    setSl(String(base.stopLossPct));
  }, [idea.id, idea.plan]);

  const candles = usePublicApi((tk) => getMarketCandles(tk, t.mint, "15m", 96).then((r) => r.candles), [t.mint]);

  const exitPlan = mode === "manual" ? manualPlan(Number(tp) || 8, Number(sl) || 10) : presetPlan(plan);
  const entry = price ?? t.priceUsd ?? 0;
  const math = planMath(exitPlan, entry);
  const value = Number(amt) || 0;
  const blocked = idea.safety.score < 50;

  const levels: MiniLevel[] = useMemo(() => {
    const l: MiniLevel[] = idea.levels.map((x) => ({ priceUsd: x.priceUsd, label: x.label, kind: "ref" }));
    const first = math.steps[0];
    // A 2x target would flatten the whole line into the bottom of the chart;
    // past +35% it is listed in the ladder and left off the drawing.
    if (first && first.atPct <= 35) {
      l.push({
        priceUsd: first.priceUsd,
        label: `${first.fraction < 1 ? `Sell ${Math.round(first.fraction * 100)}%` : "Target"} ${upLabel(first.atPct)}`,
        kind: "target",
      });
    }
    l.push({ priceUsd: math.stopPriceUsd, label: `Stop −${exitPlan.stopLossPct}%`, kind: "stop" });
    return l;
  }, [idea.levels, math.steps, math.stopPriceUsd, exitPlan.stopLossPct]);

  const source = mode === "manual" ? "Manual" : `Copilot · ${planName(plan)}`;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-panel" aria-live="polite">
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <TokenMark symbol={t.symbol} icon={t.icon} size={26} />
          <span className="font-ui text-[16px] font-medium text-text-primary">{t.symbol}</span>
          <Price value={price} className="text-[14px] text-text-primary" />
          <Delta value={t.change24hPct} className="text-[12px]" suffix=" today" />
          <span className="flex-1" />
          <span className="font-ui text-[11.5px] text-text-muted">{idea.ageLabel}</span>
          <Link href={`/trade/${t.mint}`} className={`${SECONDARY} h-8 px-3 text-[12px]`}>
            Open chart
          </Link>
          <button
            type="button"
            className={`${SECONDARY} h-8 px-3 text-[12px]`}
            onClick={() => {
              const url = `${window.location.origin}/trade/${t.mint}`;
              void navigator.clipboard?.writeText(url).then(() => {
                setShared(true);
                setTimeout(() => setShared(false), 1400);
              });
            }}
          >
            {shared ? "Link copied" : "Share"}
          </button>
        </div>
        <h2 className="font-ui text-[22px] leading-snug font-light tracking-[-0.02em] text-text-primary">{idea.headline}</h2>
        {candles.phase === "ready" ? (
          <MiniChart candles={candles.data} price={price} levels={levels} symbol={t.symbol} />
        ) : (
          <div className="h-[200px] animate-pulse rounded-xl bg-surface" aria-busy />
        )}
      </div>

      <div className="space-y-4 border-t border-border p-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 font-ui text-[12px]">
            <span className="tnum font-mono text-positive">Buyers {idea.flow.buyPct}%</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-negative/60" aria-hidden>
              <div className="h-full bg-positive" style={{ width: `${idea.flow.buyPct}%` }} />
            </div>
            <span className="tnum font-mono text-negative">{100 - idea.flow.buyPct}% sellers</span>
          </div>
          <p className="font-ui text-[12px] text-text-dim">
            {idea.flow.label}: <span className="tnum font-mono text-text-secondary">{idea.flow.buys.toLocaleString("en-US")}</span> buys ·{" "}
            <span className="tnum font-mono text-text-secondary">{idea.flow.sells.toLocaleString("en-US")}</span> sells
            <span className="mx-2 text-border">|</span>
            Safety <span className={`tnum font-mono ${scoreTone(idea.safety.score)}`}>{idea.safety.score}/100</span>
          </p>
        </div>

        {bought ? (
          <Receipt idea={idea} result={bought} onNext={onNext} />
        ) : (
          <>
            <Segmented<"copilot" | "manual">
              label="How to trade"
              value={mode}
              onChange={setMode}
              className="w-fit"
              options={[
                { key: "copilot", label: "Copilot" },
                { key: "manual", label: "Manual" },
              ]}
            />

            <div className="space-y-3 rounded-xl bg-surface p-4">
              <div className="flex items-center gap-2">
                {mode === "copilot" ? (
                  <>
                    <span className="font-ui text-[13px] font-medium text-text-primary">Copilot strategy</span>
                    <select
                      aria-label="Strategy for this trade"
                      value={plan}
                      onChange={(e) => setPlan(e.target.value as ExitPlanKey)}
                      className="rounded-md border border-border bg-bg px-2 py-1 font-ui text-[12px] text-text-primary"
                    >
                      {idea.planOptions.map((k) => (
                        <option key={k} value={k}>
                          {planName(k)}
                          {k === idea.plan ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <span className="font-ui text-[13px] font-medium text-text-primary">Your plan</span>
                )}
              </div>
              {mode === "manual" && (
                <div className="grid grid-cols-2 gap-2">
                  <AmountField label="Take profit" value={tp} onChange={setTp} presets={[]} prefix="+" suffix="%" />
                  <AmountField label="Stop loss" value={sl} onChange={setSl} presets={[]} prefix="−" suffix="%" />
                </div>
              )}
              <ul className="space-y-1.5">
                {ladderLines(exitPlan, entry).map((l, i) => (
                  <li key={i} className="flex justify-between gap-3 font-ui text-[12.5px] text-text-secondary">
                    <span>{l.text}</span>
                    {l.priceUsd != null ? <Price value={l.priceUsd} className="text-text-primary" /> : null}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap justify-between gap-2 border-t border-border-soft pt-3 font-ui text-[12.5px] text-text-dim">
                <span>
                  If every exit hits: <span className="tnum font-mono text-positive">+{usd(value * math.gainK)}</span>
                  {math.rest > 0 ? " and the rest rides" : ""}
                </span>
                <span>
                  If the stop hits: <span className="tnum font-mono text-negative">−{usd((value * exitPlan.stopLossPct) / 100)}</span>
                </span>
              </div>
              <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">
                <span className="text-text-secondary">Why this token:</span> {idea.insight}
              </p>
            </div>

            <AmountField label="Amount" value={amt} onChange={setAmt} presets={PRESETS} />

            {blocked && (
              <p className="font-ui text-[12.5px] text-negative" role="alert">
                Fails the safety check. Canopy will not buy this token.
              </p>
            )}
            {idea.highRisk && !blocked && (
              <p className="font-ui text-[12px] text-text-dim">New token. Keep the size small.</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                className={`${PRIMARY} flex-1`}
                disabled={!value || blocked}
                onClick={() =>
                  onTrade({ side: "buy", token: t, usd: value, exitPlan, source, priceUsd: price })
                }
              >
                Buy {usd(value).replace(".00", "")} of {t.symbol}
              </button>
              <button type="button" className={`${SECONDARY} ${FOCUS}`} onClick={onPass}>
                Pass
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

