"use client";

// "Close WIF / SOL?" — the confirmation behind the × on a liquidity row.
//
// NOT THE SPOT DIALOG. That one states a quantity being sold at a price; a
// liquidity close withdraws both tokens from a range, claims the fees and
// swaps everything back to the agent's CASH TOKEN — USDC for most, wrapped SOL
// for a copy-LP agent. So the figure that leads is what comes back,
// and the rows are the ones that explain it: what went in, what the position
// holds, the fees inside it, what the withdraw and swap-back cost.
//
// Every number is re-read from the server when the dialog opens, by the same
// functions the close will book with — the row behind it may be a tick old.

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { closePosition, closePreview, type LpValuation } from "@/lib/api";
import { tokenQty, usd } from "@/lib/format";
import { Modal } from "@/components/modal";
import { Figure, SectionLabel, StatusLine, FieldNote, Spinner, TxLink, LABEL, PRIMARY, QUIET } from "@/components/kit";
import { useT } from "@/lib/i18n";

export interface ClosableLp {
  mint: string;
  /** "WIF/SOL". */
  symbol: string;
  /** Everything that went in — what the result is measured against. */
  investedUsd: number;
  /** The row's valuation, shown until the fresh one arrives. */
  now: LpValuation | null;
}

export function CloseLpModal({
  agentId,
  position,
  onClose,
  onClosed,
  unit = "USD",
  solUsd = null,
}: {
  agentId: number;
  position: ClosableLp;
  onClose: () => void;
  onClosed: () => void;
  /**
   * What this agent's cash is (CANOPY_127) — which is what a close returns.
   *
   * A copy-LP agent's close swaps back to WRAPPED SOL, not USDC, so labelling
   * the proceeds "USDC" told an owner they were getting an asset the wallet
   * will never hold.
   */
  unit?: "USD" | "SOL";
  solUsd?: number | null;
}) {
  const { getAccessToken } = usePrivy();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [fresh, setFresh] = useState<LpValuation | null>(null);
  const sol = unit === "SOL" && typeof solUsd === "number" && solUsd > 0;
  const [checking, setChecking] = useState(true);
  const [unreadable, setUnreadable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const p = await closePreview(token, agentId, position.mint);
        if (!cancelled) setFresh(p.lp ?? null);
      } catch {
        // The pool could not be read. The close itself would fail the same
        // way, so the dialog says so rather than offering it.
        if (!cancelled) setUnreadable(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, position.mint, getAccessToken]);

  const v = fresh ?? position.now;
  const [x, y] = position.symbol.split("/");
  const pnl = v ? v.proceedsUsd - position.investedUsd : null;
  const pnlPct = pnl === null || position.investedUsd <= 0 ? null : (pnl / position.investedUsd) * 100;
  const title = t("lp_close_title", { pair: position.symbol.replace("/", " / ") });

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("close_sign_in"));
      const result = await closePosition(token, agentId, position.mint);
      onClosed();
      if (result.txSignature) {
        setDone(result.txSignature);
        setBusy(false);
      } else {
        onClose();
      }
    } catch (err) {
      // A live close signs, sends and swaps back — long enough to outlast the
      // proxy. A dropped connection is not a failed close: the page re-reads
      // the book, and the owner is told to look at it rather than click again.
      const dropped = err instanceof TypeError || /failed to fetch|load failed|network/i.test(String(err));
      if (dropped) onClosed();
      setError(dropped ? t("lp_close_dropped") : err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (done !== null) {
    return (
      <Modal title={title} onClose={onClose}>
        <div className="space-y-4 px-6 py-6">
          <StatusLine tone="good">{t("lp_close_done")}</StatusLine>
          <FieldNote tone="dim">{t("lp_close_done_body")}</FieldNote>
          <div className="flex items-center gap-4">
            {done ? <TxLink signature={done} label={t("common_view_transaction")} /> : null}
            <button type="button" onClick={onClose} className={QUIET}>
              {t("close_done")}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-6 px-6 py-6">
        <div className="space-y-2">
          <SectionLabel>{t("lp_close_returning")}</SectionLabel>
          {/* THE FIGURE IS IN THE UNIT IT ARRIVES IN. `proceedsUsd` is a
              valuation either way; what changes is which token the wallet
              ends up holding, and that is the thing an owner is deciding
              about. Without a price a SOL agent falls back to dollars rather
              than dividing by nothing. */}
          <Figure
            value={
              v === null
                ? "—"
                : sol
                  ? (v.proceedsUsd / solUsd!).toFixed(4)
                  : v.proceedsUsd.toFixed(2)
            }
            unit={sol ? "SOL" : "USDC"}
            size={30}
            dim={checking || !v}
          />
          {checking ? (
            <StatusLine tone="pending" live>
              {t("lp_close_reading")}
            </StatusLine>
          ) : unreadable ? (
            <StatusLine tone="bad">{t("lp_close_unreadable")}</StatusLine>
          ) : v ? (
            <StatusLine tone={v.inRange ? "good" : "pending"}>
              {t(v.inRange ? "lp_close_in_range" : "lp_close_out_of_range")}
            </StatusLine>
          ) : null}
        </div>

        <dl className="divide-y divide-grid">
          <Row label={t("lp_col_invested")} value={usd(position.investedUsd)} />
          <Row
            label={t("lp_close_holds")}
            value={
              v
                ? [
                    v.holds.x > 0 ? `${tokenQty(v.holds.x, v.holds.xUsd / v.holds.x)} ${x}` : null,
                    v.holds.y > 0 ? `${tokenQty(v.holds.y, v.holds.yUsd / v.holds.y)} ${y ?? ""}`.trim() : null,
                  ]
                    .filter(Boolean)
                    .join(" + ") || "—"
                : "—"
            }
            dim={!v}
          />
          <Row
            label={t("lp_close_fees")}
            value={v ? usd(v.unclaimedFeesUsd + v.claimedFeesUsd) : "—"}
            tone={v && v.unclaimedFeesUsd + v.claimedFeesUsd > 0 ? "up" : "none"}
            dim={!v}
          />
          <Row label={t("lp_close_value")} value={v ? usd(v.valueUsd) : "—"} dim={!v} />
          <Row label={t("lp_close_cost")} value={v ? `−${usd(v.closeCostUsd)}` : "—"} dim />
          <Row
            label={t("lp_close_pnl")}
            dim={pnl === null}
            tone={pnl === null ? "none" : pnl >= 0 ? "up" : "down"}
            value={
              pnl === null
                ? "—"
                : usd(pnl, { sign: true }) +
                  (pnlPct === null ? "" : `  (${pnlPct >= 0 ? "+" : "−"}${Math.abs(pnlPct).toFixed(1)}%)`)
            }
          />
        </dl>

        <div className="space-y-1.5">
          <FieldNote tone="dim">{t("lp_close_note")}</FieldNote>
          {v?.feesEstimated ? <FieldNote tone="dim">{t("lp_fees_estimated_title")}</FieldNote> : null}
          {error ? <FieldNote tone="bad">{error}</FieldNote> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy || checking || unreadable}
            aria-busy={busy}
            className={`flex-1 gap-2 ${PRIMARY}`}
          >
            {busy ? <Spinner /> : null}
            {t(busy ? "lp_close_closing" : "lp_close_confirm")}
          </button>
          <button type="button" onClick={onClose} disabled={busy} className={`shrink-0 px-3 ${QUIET}`}>
            {t("close_keep")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Row({
  label,
  value,
  dim = false,
  tone = "none",
}: {
  label: string;
  value: string;
  dim?: boolean;
  tone?: "none" | "up" | "down";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className={LABEL}>{label}</dt>
      <dd
        className={`tnum text-right font-mono text-[12.5px] ${
          dim ? "text-text-dim" : tone === "up" ? "text-accent" : tone === "down" ? "text-negative" : "text-text-primary"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
