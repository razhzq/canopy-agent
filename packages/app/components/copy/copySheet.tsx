"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Modal } from "@/components/modal";
import { FOCUS, PRIMARY } from "@/components/kit";
import { deployAgent, num, type StrategyRow } from "@/lib/api";
import { usd } from "@/lib/format";
import { track } from "@canopy-agent/shared/analytics";
import { recordReturn } from "./copyScreen";

const MIN_USD = 100;
const MAX_USD = 10_000;
const PRESETS = [100, 500, 1000];

/**
 * Copying an agent: it starts on paper with the amount you set, using the
 * creator's rules; you take it live from its own page. The projection is the
 * agent's own record repeated once on your amount, never a promise.
 */
export function CopySheet({ strategy, onClose }: { strategy: StrategyRow; onClose: () => void }) {
  const router = useRouter();
  const { authenticated, login, getAccessToken } = usePrivy();
  const [amount, setAmount] = useState("500");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capital = Number(amount.replace(/[,$\s]/g, ""));
  const valid = Number.isFinite(capital) && capital >= MIN_USD && capital <= MAX_USD;
  const ret = recordReturn(strategy);
  const days = strategy.stats?.days ?? null;
  const share = num(strategy.fee_pct) ?? 0;
  const gross = valid && ret !== null ? (capital * ret) / 100 : null;
  const fee = gross !== null && gross > 0 ? (gross * share) / 100 : 0;
  const keep = gross !== null ? gross - fee : null;

  async function start() {
    if (!authenticated) return login();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in to copy an agent.");
      const { agent } = await deployAgent(token, { strategyId: strategy.id, capitalUsd: capital });
      track("agent_deployed", { agent_id: agent.id, strategy_id: strategy.id, source: "copy_v2" });
      router.push(`/portfolio/${agent.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const row = "flex items-baseline justify-between gap-3 font-ui text-[12.5px]";
  return (
    <Modal title={`Copy ${strategy.name}`} onClose={onClose}>
      <div className="space-y-4 px-6 pt-2 pb-6">
        <div>
          <label htmlFor="copy-amt" className="font-ui text-[12px] text-text-muted">
            Amount to give it
          </label>
          <div className="mt-1.5 flex h-11 items-center rounded-xl border border-border bg-surface px-3.5 focus-within:border-grid-strong">
            <span className="font-mono text-[14px] text-text-muted">$</span>
            <input
              id="copy-amt"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="tnum ml-1 min-w-0 flex-1 bg-transparent font-mono text-[15px] text-text-primary outline-none"
            />
          </div>
          <div className="mt-2 flex gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className={`rounded-full border px-3 py-1 font-mono text-[12px] ${String(p) === amount ? "border-grid-strong bg-surface-2 text-text-primary" : "border-border text-text-dim hover:text-text-primary"} ${FOCUS}`}
              >
                {usd(p).replace(".00", "")}
              </button>
            ))}
          </div>
          {amount.trim() !== "" && !valid && (
            <p className="mt-1.5 font-ui text-[12px] text-negative">Between {usd(MIN_USD).replace(".00", "")} and {usd(MAX_USD).replace(".00", "")}.</p>
          )}
        </div>

        <div className="space-y-1.5 rounded-xl border border-border-soft bg-surface p-3.5">
          <div className={row}>
            <span className="text-text-muted">{days ? `If its last ${days} days repeat` : "If its record repeats"}</span>
            <span className={`tnum font-mono ${(gross ?? 0) >= 0 ? "text-positive" : "text-negative"}`}>{gross === null ? "—" : usd(gross, { sign: true })}</span>
          </div>
          <div className={row}>
            <span className="text-text-muted">Creator’s share</span>
            <span className="tnum font-mono text-text-primary">
              {share}% · {usd(fee)}
            </span>
          </div>
          <div className={row}>
            <span className="text-text-muted">You keep</span>
            <span className={`tnum font-mono ${(keep ?? 0) >= 0 ? "text-positive" : "text-negative"}`}>{keep === null ? "—" : usd(keep, { sign: true })}</span>
          </div>
          <p className="pt-1 font-ui text-[11.5px] leading-relaxed text-text-muted">
            Past results don’t promise future ones. The creator’s share is taken only from profit. It starts on paper; you take it live from its own page.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-border p-3">
            <p className="mb-1.5 font-ui text-[12px] font-medium text-positive">It can</p>
            <ul className="space-y-1 font-ui text-[12px] text-text-secondary">
              <li>Trade with the creator’s rules</li>
              <li>Use up to {valid ? usd(capital).replace(".00", "") : "your amount"}</li>
              <li>Stop itself at its loss limit</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="mb-1.5 font-ui text-[12px] font-medium text-negative">It can never</p>
            <ul className="space-y-1 font-ui text-[12px] text-text-secondary">
              <li>Withdraw funds</li>
              <li>Go over your amount</li>
              <li>Trade outside the creator’s rules</li>
            </ul>
          </div>
        </div>

        {error && (
          <p className="font-ui text-[12.5px] text-negative" role="alert">
            {error}
          </p>
        )}
        <button type="button" disabled={(!valid && authenticated) || busy} onClick={() => void start()} className={`${PRIMARY} w-full`}>
          {!authenticated ? "Sign in to copy" : busy ? "Starting…" : "Start copying"}
        </button>
      </div>
    </Modal>
  );
}
