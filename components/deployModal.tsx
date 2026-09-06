"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Modal } from "@/components/modal";
import { AmountInput, Field, FieldNote, PRIMARY, QUIET } from "@/components/kit";
import { deployAgent, type StrategyRow } from "@/lib/api";
import { useT } from "@/lib/i18n";

/**
 * Deploying a listed strategy as your own agent.
 *
 * ONE DIALOG, NOT A WIZARD. "Deploy this" used to link into five static
 * wireframe pages that ignored the strategy and showed a fixture. What a
 * deployer actually decides is one number — the paper book the agent starts
 * on — because the recipe is the author's and stays private, and the model and
 * funding live on the agent's own page once it exists. So this asks for the
 * number, starts the agent, and goes there.
 *
 * Paper first, always. Going live is a later decision from the workspace,
 * where the agent has a wallet to pay from.
 */

const MIN_USD = 100;
const MAX_USD = 10_000;
const DEFAULT_USD = 10_000;

export function DeployModal({
  strategy,
  onClose,
}: {
  strategy: StrategyRow;
  onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const { getAccessToken } = usePrivy();
  const [amount, setAmount] = useState(String(DEFAULT_USD));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capital = Number(amount.replace(/,/g, ""));
  const valid = Number.isFinite(capital) && capital >= MIN_USD && capital <= MAX_USD;

  async function deploy() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("error_not_signed_in"));
      const { agent } = await deployAgent(token, {
        strategyId: strategy.id,
        capitalUsd: capital,
      });
      // Straight to the new agent. The dialog closes with the page.
      router.push(`/workspace/${agent.id}?tab=overview`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={t("dp_title", { name: strategy.name })} onClose={onClose}>
      <div className="space-y-5 px-6 pt-2 pb-6">
        <p className="font-ui text-[13px] leading-relaxed text-text-secondary">{t("dp_body")}</p>

        <Field
          label={t("dp_capital")}
          aside={<span className="font-ui text-[11.5px] text-text-dim">{t("dp_capital_range")}</span>}
        >
          <AmountInput
            value={amount}
            onChange={setAmount}
            unit="USDC"
            label={t("dp_capital")}
            onMax={() => setAmount(String(MAX_USD))}
          />
          {amount.trim() !== "" && !valid ? (
            <FieldNote tone="bad">{t("dp_capital_invalid")}</FieldNote>
          ) : (
            <FieldNote>{t("dp_capital_note")}</FieldNote>
          )}
        </Field>

        {error ? (
          <p className="font-ui text-[12.5px] leading-relaxed text-negative" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void deploy()}
            disabled={!valid || busy}
            className={`flex-1 ${PRIMARY}`}
          >
            {t(busy ? "dp_starting" : "dp_start")}
          </button>
          <button type="button" onClick={onClose} disabled={busy} className={`px-3 ${QUIET}`}>
            {t("dp_not_now")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
