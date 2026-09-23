"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Modal } from "@/components/modal";
import { Callout, WarnIcon } from "@/components/ui";
import { FieldNote, FOCUS, PRIMARY, SECONDARY } from "@/components/kit";
import {
  CopyLimitsStep,
  DEFAULT_COPY_LIMITS,
  PickLeader,
  copyLpPayload,
  shortAddress,
  useLeaderPreview,
  type CopyLimits,
} from "@/components/copyLpSteps";
import { updateAgentStrategy, type CopyLpInput, type StrategyRow } from "@/lib/api";
import { useT } from "@/lib/i18n";

/**
 * "Edit strategy" for an agent that COPIES A WALLET.
 *
 * WHY IT IS NOT THE OTHER DIALOG. `EditStrategyModal` edits a recipe: entry
 * rules, exits, the bar size they are measured on, how a position accumulates,
 * the position cap. A copy agent has none of those. It has a leader and a set
 * of limits on how much of that leader it takes — and it was being shown the
 * trading dialog, which offered chips for rules it does not evaluate over a
 * timeframe it does not read, while the six settings it actually runs on could
 * not be reached at all after deploy.
 *
 * So this is the same act — the owner changing their own agent in place, with a
 * diff-only patch — asked in the copy's own vocabulary, using the very controls
 * the builder used. The builder and the editor showing one setting two ways is
 * how the two drift apart, and the sizing worked through on the leader's
 * largest position is the part worth keeping most: it answers "what does 60%
 * actually open with" without anyone doing the arithmetic.
 */
export function EditCopyLpModal({
  agentId,
  agentName,
  strategy,
  bookUsd,
  hasOpenPositions,
  onClose,
  onSaved,
}: {
  agentId: number;
  /** What this agent is called now. See EditStrategyModal — same two names. */
  agentName: string;
  /** The strategy as `getStrategy` returned it, carrying `copy_lp`. */
  strategy: StrategyRow;
  /**
   * The book the copy sizes against, IN DOLLARS. Used only to restate sizing,
   * never sent.
   *
   * It is the equity curve's latest point, which the API serves in dollars for
   * every agent — including a SOL-denominated one, where it is that book
   * valued at the rate the response was built with (CANOPY_127). So this stays
   * a dollar figure and needs no unit of its own; it just is not "the wallet's
   * USDC", which is what this said and which is zero for a copy agent.
   */
  bookUsd: number;
  /**
   * Whether the agent is holding anything right now.
   *
   * Decides how loudly a leader change is warned about: with nothing open there
   * is no orphaned book to explain, and the warning would be noise.
   */
  hasOpenPositions: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const { getAccessToken } = usePrivy();

  const stored = fromPlan(strategy.copy_lp);
  const [copy, setCopy] = useState<CopyLimits>(stored);
  const [name, setName] = useState(agentName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set once the owner has been shown what changing the leader does. */
  const [acknowledged, setAcknowledged] = useState(false);

  const preview = useLeaderPreview(copy.leader);
  const leaderReady = preview.phase === "ready";
  const leaderChanged = copy.leader.trim() !== stored.leader;

  const next = copyLpPayload(copy);
  const renamed = name.trim() !== "" && name.trim() !== agentName.trim();
  const dirty =
    renamed || JSON.stringify(next) !== JSON.stringify(copyLpPayload(stored));
  // A leader that has not resolved is not saveable: the preview IS the check
  // that the address is a wallet with a readable book, and saving past it would
  // leave the agent following nothing until someone noticed.
  const canSave = dirty && leaderReady && !busy && (!leaderChanged || acknowledged);

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("es_sign_in"));
      // The block is replaced whole, which is what the route does with it —
      // there is no partial copy block, and a merge could not turn a cap off.
      // The name rides on the same request so one press is one change.
      await updateAgentStrategy(token, agentId, {
        copyLp: next,
        ...(renamed ? { name: name.trim() } : {}),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t("ec_title")} variant="wide" onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-5">
        <p className="max-w-[70ch] font-ui text-[13px] leading-relaxed text-text-secondary">
          {t("ec_intro")}
        </p>

        <div className="space-y-8 pt-5">
          {/* Same field, same place, as the strategy editor: the one thing
              somebody opens this dialog just to fix goes first. */}
          <div className="space-y-2">
            <label htmlFor="copy-name" className="block font-ui text-[12.5px] text-text-muted">
              {t("es_name")}
            </label>
            <input
              id="copy-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              spellCheck={false}
              placeholder={agentName}
              className={`w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 font-ui text-[13.5px] pointer-coarse:text-[16px] text-text-primary outline-none transition-colors placeholder:text-text-dim focus:border-accent ${FOCUS}`}
            />
            <FieldNote>{t("es_name_help")}</FieldNote>
          </div>

          <PickLeader value={copy} onChange={setCopy} preview={preview} bookUsd={bookUsd} compact />

          {/* WHAT A NEW LEADER DOES, before it is possible to save one. The
              engine decides what to mirror per poll against whatever the block
              names, so nothing migrates: the positions opened from the old
              leader simply stop being anyone's copy. */}
          {leaderChanged ? (
            <Callout tone="warning" icon={<WarnIcon />} title={t("ec_leader_change")}>
              <p className="font-ui text-[12.5px] leading-relaxed">
                {hasOpenPositions
                  ? t("ec_leader_change_open", { from: shortAddress(stored.leader) })
                  : t("ec_leader_change_flat", { from: shortAddress(stored.leader) })}
              </p>
              <label className="mt-2.5 flex items-start gap-2 font-ui text-[12.5px] text-text-primary">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 size-3.5 accent-[var(--color-accent)]"
                />
                {t("ec_leader_change_ack")}
              </label>
            </Callout>
          ) : null}

          <CopyLimitsStep value={copy} onChange={setCopy} preview={preview} bookUsd={bookUsd} compact />
        </div>

        {error ? (
          <div className="pt-4" role="alert">
            <FieldNote tone="bad">{error}</FieldNote>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-grid px-6 py-4">
        <button type="button" className={SECONDARY} onClick={onClose}>
          {t("es_cancel")}
        </button>
        <button type="button" className={PRIMARY} onClick={() => void save()} disabled={!canSave}>
          {busy ? t("es_saving") : t("es_save")}
        </button>
      </div>
    </Modal>
  );
}

/**
 * The stored block as the builder's controls read it.
 *
 * Absent optional caps come back as `null` rather than as the defaults: null is
 * "no cap", which is a setting the owner chose, and defaulting it here would
 * quietly reimpose a ceiling on save.
 */
function fromPlan(plan: CopyLpInput | null | undefined): CopyLimits {
  if (!plan) return DEFAULT_COPY_LIMITS;
  return {
    leader: plan.leader,
    copyPct: plan.copyPct ?? DEFAULT_COPY_LIMITS.copyPct,
    maxIncreaseUsd: plan.maxIncreaseUsd ?? null,
    minPoolTvlUsd: plan.minPoolTvlUsd ?? null,
    // Reads the SAVED plan, so it must agree with the normaliser: a plan
    // with no field is off, and showing the switch on would tell an owner the
    // opposite of what their agent does.
    verifiedTokensOnly: plan.verifiedTokensOnly === true,
    followRebalances: plan.followRebalances !== false,
    maxSlippagePct: plan.maxSlippagePct ?? DEFAULT_COPY_LIMITS.maxSlippagePct,
  };
}
