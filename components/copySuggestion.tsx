"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { PRIMARY, QUIET } from "@/components/kit";
import { formatUsd } from "@/components/buildType";
import { formatSol } from "@/components/copyLpSteps";
import { getCopySuggestion, updateAgentStrategy, type CopyLpInput, type CopySuggestion } from "@/lib/api";
import { useT } from "@/lib/i18n";

/**
 * "Match your copy % to your deposit", for a LIVE copy LP agent.
 *
 * WHY IT EXISTS. Copy % is a percent of each leader position, so the number
 * that fits depends on what the wallet holds — and that is only known after
 * the owner deposits, which going live does not wait for. So the suggestion
 * lives on the agent's page, appears once a deposit makes one possible, and
 * comes back when a later deposit changes it.
 *
 * AN OFFER, NEVER APPLIED BY ITSELF: an owner may mean to copy smaller than
 * their wallet allows. Apply replaces copy % only; the rest of the plan —
 * Max Amount, take profit, stop loss — is sent back exactly as stored,
 * because the route replaces the copy block whole.
 */

/** Differences smaller than this, relative, are not worth interrupting for: 19 vs 20 is noise. */
const WORTH_SAYING = 0.2;
/** How often to look again, so a deposit that lands while the page is open is noticed. */
const REFRESH_MS = 60_000;

const dismissKey = (agentId: number, pct: number) => `copySuggestion:${agentId}:${pct}`;
function dismissed(agentId: number, pct: number): boolean {
  try {
    return window.localStorage.getItem(dismissKey(agentId, pct)) === "1";
  } catch {
    return false;
  }
}

export function CopySuggestionBanner({
  agentId,
  copyLp,
  onApplied,
  className,
}: {
  agentId: number;
  /** The stored copy block, sent back whole with only copy % changed. */
  copyLp: CopyLpInput;
  onApplied: () => void;
  className?: string;
}) {
  const t = useT();
  const { getAccessToken } = usePrivy();
  const [s, setS] = useState<CopySuggestion | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const read = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      setS(await getCopySuggestion(token, agentId));
    } catch {
      // A failed read is not "no suggestion" — it is simply nothing to show.
    }
  }, [agentId, getAccessToken]);

  useEffect(() => {
    void read();
    const id = setInterval(() => void read(), REFRESH_MS);
    return () => clearInterval(id);
  }, [read]);

  const current = copyLp.copyPct ?? 100;
  const pct = s?.suggestedPct ?? null;
  if (!s || pct === null || hidden) return null;
  if (Math.abs(current - pct) / pct <= WORTH_SAYING) return null;
  if (dismissed(agentId, pct)) return null;

  const usd = (sol: number) => (s.solUsd ? formatUsd(Math.round(sol * s.solUsd)) : formatSol(sol));

  async function apply() {
    setBusy(true);
    setError(false);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("signed out");
      await updateAgentStrategy(token, agentId, { copyLp: { ...copyLp, copyPct: pct! } });
      setHidden(true);
      onApplied();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function keep() {
    // Keyed on the suggestion, so a later deposit that changes it asks again.
    try {
      window.localStorage.setItem(dismissKey(agentId, pct!), "1");
    } catch {
      // Storage refused: it hides for this visit only.
    }
    setHidden(true);
  }

  return (
    <div className={`rounded-xl border border-border bg-surface px-5 py-4 ${className ?? ""}`}>
      <p className="font-ui text-[13.5px] font-medium text-text-primary">{t("cl_sg_title")}</p>
      <p className="tnum mt-1 font-ui text-[12.5px] leading-relaxed text-text-secondary">
        {t("cl_sg_body", {
          deployable: usd(s.deployableSol),
          sol: formatSol(s.balanceSol),
          reserve: s.reserveSol === null ? "—" : formatSol(s.reserveSol),
          capital: s.leaderCapitalUsd === null ? "—" : formatUsd(Math.round(s.leaderCapitalUsd)),
          pct,
          current,
        })}
      </p>
      {error ? <p className="mt-2 font-ui text-[12px] text-negative">{t("cl_sg_failed")}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button type="button" className={PRIMARY} onClick={() => void apply()} disabled={busy}>
          {t("cl_sg_apply", { pct })}
        </button>
        <button type="button" className={QUIET} onClick={keep} disabled={busy}>
          {t("cl_sg_keep", { current })}
        </button>
      </div>
    </div>
  );
}
