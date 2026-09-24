"use client";

import { useState } from "react";
import { RailRow, Rule } from "@/components/ui";
import { SECONDARY } from "@/components/kit";
import { useLeaderPreview } from "@/components/copyLpSteps";
import { compactUsd } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { CopyLpInput } from "@/lib/api";

/**
 * What a copy LP agent is configured to do: who it copies, and on what terms.
 *
 * Takes the place of the Strategy and Markets blocks on a copy agent. Those
 * describe a trading agent — entry rules, a bar size, a pinned universe — and
 * on a copy agent every one of them was empty ("No rules returned", "Measured
 * on 1d", "screens the whole lp class"), while the settings that actually
 * decide what it does appeared nowhere on the page.
 *
 * Every row is a fact, including the ones that are off: an absent take profit
 * reads "Off", not a blank, so the owner never has to guess whether a missing
 * row means "none" or "not loaded".
 */
export function CopyTerms({
  plan,
  onEdit,
  editable = true,
}: {
  plan: CopyLpInput;
  onEdit: () => void;
  /** False while the strategy is still loading — the dialog edits what was fetched. */
  editable?: boolean;
}) {
  const t = useT();
  const leader = useLeaderPreview(plan.leader);
  const [copied, setCopied] = useState(false);

  // The engine's own defaults (normaliseCopyLpPlan), so an absent field reads
  // as what the agent actually does rather than as unset.
  const copyPct = plan.copyPct ?? 100;
  const follows = plan.followRebalances !== false;
  const slippage = plan.maxSlippagePct ?? 1;

  const pools = [
    plan.verifiedTokensOnly ? t("ad_copy_pools_verified") : null,
    plan.minPoolTvlUsd ? t("ad_copy_pools_tvl", { tvl: compactUsd(plan.minPoolTvlUsd) }) : null,
  ].filter(Boolean);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(plan.leader);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the address is still on screen to select */
    }
  }

  return (
    <div>
      <Rule
        label={t("ad_copy_title")}
        line={false}
        right={
          <button
            type="button"
            onClick={onEdit}
            disabled={!editable}
            className={`${SECONDARY} disabled:cursor-not-allowed`}
          >
            {t("ad_copy_edit")}
          </button>
        }
      />

      {/* ------------------------------------------------------ leader -- */}
      <div className="mt-5">
        <p className="font-ui text-[11.5px] text-text-muted">{t("ad_copy_leader")}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5">
          <span className="font-mono text-[14px] text-text-primary" title={plan.leader}>
            {`${plan.leader.slice(0, 4)}…${plan.leader.slice(-4)}`}
          </span>
          <button
            type="button"
            onClick={() => void copyAddress()}
            className="inline-flex items-center gap-1 font-ui text-[12px] text-text-dim transition-colors hover:text-text-primary"
          >
            <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="9" y="9" width="12" height="12" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </svg>
            {copied ? t("ad_copy_copied") : t("ad_copy_copy")}
          </button>
          <a
            href={`https://solscan.io/account/${plan.leader}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-ui text-[12px] text-text-dim transition-colors hover:text-text-primary"
          >
            <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
            Solscan
          </a>
        </div>
        {/* The leader as they stand now. Quiet on failure: the address above is
            the fact that matters, and an error box here would be louder than
            the thing it failed to decorate. */}
        {leader.phase === "ready" ? (
          <p className="pt-1.5 font-ui text-[12.5px] text-text-secondary">
            {leader.data.positions.length === 0
              ? t("ad_copy_leader_flat")
              : t(leader.data.positions.length === 1 ? "ad_copy_leader_now_one" : "ad_copy_leader_now", {
                  amount: compactUsd(leader.data.inDlmmUsd),
                  count: leader.data.positions.length,
                  inRange: leader.data.positions.filter((p) => p.inRange === true).length,
                })}
          </p>
        ) : null}
      </div>

      {/* ------------------------------------------------------- terms -- */}
      <div className="mt-5">
        <p className="font-ui text-[11.5px] text-text-muted">{t("ad_copy_terms")}</p>
        <div className="pt-1">
          <RailRow label={t("ad_copy_size")} value={t("ad_copy_size_value", { pct: copyPct })} />
          <RailRow
            label={t("ad_copy_max")}
            value={plan.maxAmountSol ? `${plan.maxAmountSol} SOL` : t("ad_copy_no_cap")}
          />
          <RailRow
            label={t("ad_copy_tp")}
            value={plan.takeProfitPct ? `+${plan.takeProfitPct}%` : t("ad_copy_off")}
          />
          <RailRow
            label={t("ad_copy_sl")}
            value={plan.stopLossPct ? `−${plan.stopLossPct}%` : t("ad_copy_off")}
          />
          <RailRow
            label={t("ad_copy_range")}
            value={follows ? t("ad_copy_followed") : t("ad_copy_not_followed")}
          />
          <RailRow
            label={t("ad_copy_pools")}
            value={pools.length ? pools.join(" · ") : t("ad_copy_any_pool")}
          />
          <RailRow label={t("ad_copy_slippage")} value={`${slippage}%`} />
        </div>
      </div>
    </div>
  );
}
