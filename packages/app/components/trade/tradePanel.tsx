"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { FOCUS, LABEL, PRIMARY, SECONDARY } from "@/components/kit";
import { AmountField, Price, SafetyCard, Segmented } from "@/components/trade/bits";
import type { ChartLevel } from "@/components/trade/priceChart";
import type { TradeIntent } from "@/components/trade/tradeFlow";
import { ApiError, getCopilotSetup, listStrategies, realizedReturnPct, type StrategyRow } from "@/lib/api";
import { usd } from "@/lib/format";
import {
  ALL_PLANS,
  defaultPlanFor,
  manualPlan,
  planMath,
  planName,
  presetPlan,
  type CopilotSetup,
  type ExitPlanKey,
  type Position,
  type Safety,
  type TokenRow,
  type TradeAccount,
} from "@/lib/market";
import { useApi } from "@/lib/useApi";

type Mode = "copy" | "copilot" | "manual";

const BUY_PRESETS = ["50", "100", "250", "500"];
const SELL_PRESETS = ["25", "50", "75", "100"];

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between font-ui text-[12.5px]">
      <span className="text-text-dim">{label}</span>
      <span className="tnum font-mono text-text-primary">{children}</span>
    </div>
  );
}

function PctInput({ id, label, value, onChange, sign }: { id: string; label: string; value: string; onChange: (v: string) => void; sign: "+" | "−" }) {
  return (
    <label htmlFor={id} className="block space-y-1.5">
      <span className={LABEL}>{label}</span>
      <span className="flex h-10 items-center gap-1 rounded-xl border border-border bg-surface px-3 focus-within:border-grid-strong">
        <span className={`tnum font-mono text-[13px] ${sign === "+" ? "text-positive" : "text-negative"}`}>{sign}</span>
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          className="tnum w-full bg-transparent font-mono text-[13px] text-text-primary outline-none"
        />
        <span className="tnum font-mono text-[13px] text-text-dim">%</span>
      </span>
    </label>
  );
}

/* ----------------------------------------------------------------- manual -- */

function Manual({
  token,
  price,
  safety,
  holding,
  onTrade,
}: {
  token: TokenRow;
  price: number | null;
  safety: Safety | null;
  holding: { valueUsd: number; qty: number };
  onTrade: (i: TradeIntent) => void;
}) {
  const base = presetPlan(defaultPlanFor(token));
  const firstTp = base.scaleOut?.[0]?.atPct ?? base.takeProfitPct ?? 8;
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amt, setAmt] = useState("100");
  const [tp, setTp] = useState(String(firstTp));
  const [sl, setSl] = useState(String(base.stopLossPct));

  useEffect(() => {
    setTp(String(firstTp));
    setSl(String(base.stopLossPct));
    // reset to the token's defaults when the token changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token.mint]);

  const value = Number(amt) || 0;
  const blocked = side === "buy" && safety != null && safety.score < 50;
  const label =
    side === "buy" ? `Buy ${usd(value).replace(".00", "")} of ${token.symbol}` : `Sell ${value}% of my ${token.symbol}`;

  return (
    <div className="space-y-4">
      <Segmented<"buy" | "sell">
        label="Side"
        value={side}
        onChange={(s) => {
          setSide(s);
          setAmt(s === "buy" ? "100" : "50");
        }}
        options={[
          { key: "buy", label: "Buy" },
          { key: "sell", label: "Sell" },
        ]}
      />
      {side === "sell" && (
        <p className="font-ui text-[12.5px] text-text-secondary">
          {holding.qty > 0 ? (
            <>
              You hold <span className="tnum font-mono text-text-primary">{usd(holding.valueUsd)}</span> of {token.symbol}
            </>
          ) : (
            `You don’t hold any ${token.symbol}.`
          )}
        </p>
      )}
      <AmountField
        label={side === "buy" ? "Amount" : "Of holding"}
        value={amt}
        onChange={setAmt}
        presets={side === "buy" ? BUY_PRESETS : SELL_PRESETS}
        prefix={side === "buy" ? "$" : ""}
        suffix={side === "sell" ? "%" : undefined}
      />
      {side === "buy" && (
        <div className="grid grid-cols-2 gap-2">
          <PctInput id="m-tp" label="Take profit" value={tp} onChange={setTp} sign="+" />
          <PctInput id="m-sl" label="Stop loss" value={sl} onChange={setSl} sign="−" />
        </div>
      )}
      <div className="space-y-2 rounded-xl bg-surface p-3">
        <Line label="Slippage">0.5%</Line>
        <Line label="Route">Jupiter</Line>
        <Line label="MEV protection">On</Line>
      </div>
      <button
        type="button"
        className={`${PRIMARY} w-full`}
        disabled={!value || blocked || (side === "sell" && (holding.qty <= 0 || value > 100))}
        onClick={() =>
          side === "buy"
            ? onTrade({
                side: "buy",
                token,
                usd: value,
                exitPlan: manualPlan(Number(tp) || firstTp, Number(sl) || base.stopLossPct),
                source: "Manual",
                priceUsd: price,
              })
            : onTrade({ side: "sell", token, fraction: Math.min(1, value / 100), priceUsd: price })
        }
      >
        {label}
      </button>
      <SafetyCard safety={safety} />
    </div>
  );
}

/* ---------------------------------------------------------------- copilot -- */

function mmss(sec: number): string {
  const s = Math.max(0, sec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function Copilot({
  token,
  price,
  account,
  onTrade,
  onLevels,
  onCreditsChanged,
}: {
  token: TokenRow;
  price: number | null;
  account: TradeAccount | null;
  onTrade: (i: TradeIntent) => void;
  onLevels: (l: ChartLevel[]) => void;
  onCreditsChanged: () => void;
}) {
  const { authenticated, login, getAccessToken } = usePrivy();
  const [setup, setSetup] = useState<CopilotSetup | null>(null);
  const [plan, setPlan] = useState<ExitPlanKey>(defaultPlanFor(token));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [amt, setAmt] = useState("100");
  const [credits, setCredits] = useState<number | null>(null);

  // A setup belongs to one token. Moving to another clears it.
  useEffect(() => {
    setSetup(null);
    setError(null);
    setPlan(defaultPlanFor(token));
    onLevels([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token.mint]);

  useEffect(() => {
    if (!setup) return;
    setLeft(setup.validForSec);
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [setup]);

  useEffect(() => {
    if (setup && left <= 0) {
      setSetup(null);
      onLevels([]);
    }
  }, [left, setup, onLevels]);

  async function ask(rerun: boolean, nextPlan?: ExitPlanKey) {
    if (!authenticated) return login();
    setBusy(true);
    setError(null);
    try {
      const tk = await getAccessToken();
      if (!tk) throw new Error("Your session expired. Sign in again.");
      const s = await getCopilotSetup(tk, { mint: token.mint, plan: nextPlan ?? plan, ...(rerun ? { rerun: true } : {}) });
      setSetup(s);
      setCredits(s.creditsLeft);
      setPlan(s.exitPlan.key);
      onLevels([
        { priceUsd: s.entryPriceUsd, label: s.verdict === "wait" ? "Buy at" : "Entry", kind: "entry" },
        { priceUsd: s.targetPriceUsd, label: "Target", kind: "target" },
        { priceUsd: s.stopPriceUsd, label: "Stop", kind: "stop" },
      ]);
      if (!rerun) onCreditsChanged();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 402
          ? "Not enough credits for a setup."
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setBusy(false);
    }
  }

  const creditsLeft = credits ?? account?.credits ?? null;

  if (!setup) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="font-ui text-[14px] font-medium text-text-primary">Copilot’s setup for {token.symbol}</p>
          <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">
            When to buy, where to take profit, where to stop. You confirm.
          </p>
        </div>
        <button type="button" className={`${PRIMARY} h-auto w-full flex-col py-2.5`} disabled={busy} onClick={() => ask(false)}>
          <span>{busy ? "Reading the market" : "Get setup"}</span>
          <span className="font-ui text-[11.5px] font-normal opacity-70">
            Uses 2 credits{creditsLeft != null ? ` · ${creditsLeft} left` : ""}
          </span>
        </button>
        {error && (
          <p className="font-ui text-[12.5px] text-negative" role="alert">
            {error}
          </p>
        )}
        <p className="font-ui text-[11.5px] leading-relaxed text-text-muted">
          Spot only. No leverage, no liquidation. Tokens must pass the safety check.
        </p>
      </div>
    );
  }

  const value = Number(amt) || 0;
  const exitPlan = presetPlan(plan);
  const m = planMath(exitPlan, setup.entryPriceUsd);
  const tone = setup.verdict === "now" ? "text-positive" : setup.verdict === "skip" ? "text-negative" : "text-text-primary";
  const word = setup.verdict === "now" ? "Buy" : setup.verdict === "wait" ? "Wait" : "Skip";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className={`font-ui text-[12.5px] text-text-dim hover:text-text-primary ${FOCUS}`}
          onClick={() => {
            setSetup(null);
            onLevels([]);
          }}
        >
          Back
        </button>
        <span className="tnum font-mono text-[12px] text-text-muted" title="Setup valid for">
          {mmss(left)}
        </span>
      </div>

      <div className="space-y-1 rounded-xl border border-border p-3">
        <p className={`font-ui text-[11.5px] font-medium ${tone}`}>{word}</p>
        <p className="font-ui text-[14px] text-text-primary">{setup.title}</p>
        <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">{setup.reason}</p>
      </div>

      <div className="space-y-2 rounded-xl bg-surface p-3">
        <div className="flex items-center justify-between">
          <span className="font-ui text-[12.5px] font-medium text-text-primary">The plan</span>
          <select
            aria-label="Strategy"
            value={plan}
            disabled={busy}
            onChange={(e) => {
              const k = e.target.value as ExitPlanKey;
              setPlan(k);
              void ask(true, k);
            }}
            className="rounded-md border border-border bg-bg px-2 py-1 font-ui text-[12px] text-text-primary"
          >
            {ALL_PLANS.map((k) => (
              <option key={k} value={k}>
                {planName(k)}
              </option>
            ))}
          </select>
        </div>
        <Line label={setup.verdict === "wait" ? "Buy at (wait)" : "Buy at"}>
          <Price value={setup.entryPriceUsd} />
        </Line>
        <div className="flex items-center justify-between font-ui text-[12.5px]">
          <span className="text-text-dim">Target</span>
          <span className="flex gap-3">
            <Price value={setup.targetPriceUsd} className="text-text-primary" />
            <span className="tnum font-mono text-positive">+{usd(value * m.gainK)}</span>
          </span>
        </div>
        <div className="flex items-center justify-between font-ui text-[12.5px]">
          <span className="text-text-dim">Stop</span>
          <span className="flex gap-3">
            <Price value={setup.stopPriceUsd} className="text-text-primary" />
            <span className="tnum font-mono text-negative">−{usd((value * exitPlan.stopLossPct) / 100)}</span>
          </span>
        </div>
      </div>

      <AmountField label="Amount" value={amt} onChange={setAmt} presets={BUY_PRESETS} />

      <div className="flex gap-2">
        <button
          type="button"
          className={`${PRIMARY} flex-1`}
          disabled={!value || setup.verdict === "skip"}
          onClick={() =>
            onTrade({
              side: "buy",
              token,
              usd: value,
              exitPlan,
              source: `Copilot · ${planName(plan)}`,
              priceUsd: price,
            })
          }
        >
          {setup.verdict === "wait" ? "Buy now anyway" : `Buy ${token.symbol} now`}
        </button>
        <button
          type="button"
          className={SECONDARY}
          onClick={() => {
            setSetup(null);
            onLevels([]);
          }}
        >
          Pass
        </button>
      </div>
      {error && (
        <p className="font-ui text-[12.5px] text-negative" role="alert">
          {error}
        </p>
      )}

      <details className="group rounded-xl border border-border p-3">
        <summary className="cursor-pointer list-none font-ui text-[12.5px] text-text-secondary">Why this setup</summary>
        <dl className="mt-2 space-y-2 font-ui text-[12px]">
          {(
            [
              ["Analyst", setup.why.analyst],
              ["Risk", setup.why.risk],
              ["Route", setup.why.route],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-text-muted">{k}</dt>
              <dd className="leading-relaxed text-text-secondary">{v}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------- copy -- */

function Copy() {
  const s = useApi((tk) => listStrategies(tk).then((r) => r.strategies), []);
  const { login } = usePrivy();
  const top = useMemo(() => {
    if (s.phase !== "ready") return [];
    return [...s.data]
      .filter((x) => x.status === "published" && x.agent_kind !== "lp" && x.agent_kind !== "copy_lp")
      .sort((a, b) => (realizedReturnPct(b) ?? -Infinity) - (realizedReturnPct(a) ?? -Infinity))
      .slice(0, 5);
  }, [s]);

  let body: React.ReactNode;
  if (s.phase === "signed-out") {
    body = (
      <p className="p-3 font-ui text-[12.5px] text-text-dim">
        <button type="button" className="text-text-primary underline" onClick={() => login()}>
          Sign in
        </button>{" "}
        to copy an agent.
      </p>
    );
  } else if (s.phase === "loading") {
    body = (
      <div className="space-y-1.5 p-2" aria-busy>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    );
  } else if (s.phase === "error") {
    body = <p className="p-3 font-ui text-[12.5px] text-text-dim">Could not load agents.</p>;
  } else if (!top.length) {
    body = <p className="p-3 font-ui text-[12.5px] text-text-dim">No agents to copy yet.</p>;
  } else {
    body = (
      <ul className="divide-y divide-border-soft">
        {top.map((x: StrategyRow) => {
          const r = realizedReturnPct(x);
          return (
            <li key={x.id}>
              <Link href={`/agents/${x.id}`} className={`flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-surface ${FOCUS}`}>
                <span className="min-w-0">
                  <span className="block truncate font-ui text-[13px] text-text-primary">{x.name}</span>
                  <span className="block truncate font-ui text-[11.5px] text-text-muted">
                    {x.author_username ? `by ${x.author_username}` : "Canopy"}
                  </span>
                </span>
                <span className={`tnum font-mono text-[12px] ${r == null ? "text-text-muted" : r >= 0 ? "text-positive" : "text-negative"}`}>
                  {r == null ? "—" : `${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(1)}%`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border">
        <p className={`${LABEL} px-3 pt-3`}>Return, last 30 days</p>
        {body}
      </div>
      <Link href="/agents" className={`${SECONDARY} w-full`}>
        See all agents
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ panel -- */

export function TradePanel({
  token,
  price,
  safety,
  account,
  positions,
  onTrade,
  onLevels,
  onAccountChanged,
}: {
  token: TokenRow;
  price: number | null;
  safety: Safety | null;
  account: TradeAccount | null;
  positions: Position[];
  onTrade: (i: TradeIntent) => void;
  onLevels: (l: ChartLevel[]) => void;
  onAccountChanged: () => void;
}) {
  const [mode, setMode] = useState<Mode>("copilot");
  const holding = useMemo(() => {
    const mine = positions.filter((p) => p.mint === token.mint && p.status === "open");
    return { valueUsd: mine.reduce((a, p) => a + p.valueUsd, 0), qty: mine.reduce((a, p) => a + p.qty, 0) };
  }, [positions, token.mint]);

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="How you trade" className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-surface p-1">
        {(
          [
            ["copy", "Copy", "It trades"],
            ["copilot", "Copilot", "It suggests"],
            ["manual", "Manual", "You trade"],
          ] as const
        ).map(([k, t, sub]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mode === k}
            onClick={() => {
              setMode(k);
              if (k !== "copilot") onLevels([]);
            }}
            className={`flex flex-col items-center rounded-xl py-2 transition-colors ${FOCUS} ${
              mode === k ? "bg-surface-2 text-text-primary" : "text-text-dim hover:text-text-primary"
            }`}
          >
            <span className="font-ui text-[13px] font-medium">{t}</span>
            <span className="font-ui text-[11px] text-text-muted">{sub}</span>
          </button>
        ))}
      </div>
      {mode === "manual" && <Manual token={token} price={price} safety={safety} holding={holding} onTrade={onTrade} />}
      {mode === "copilot" && (
        <Copilot
          token={token}
          price={price}
          account={account}
          onTrade={onTrade}
          onLevels={onLevels}
          onCreditsChanged={onAccountChanged}
        />
      )}
      {mode === "copy" && <Copy />}
    </div>
  );
}
