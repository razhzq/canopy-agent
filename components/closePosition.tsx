"use client";

// "Close USX?" — the confirmation behind the × in the positions table.
//
// WHY A MODAL AND NOT A ONE-CLICK ×
//
// The × sits at the end of a dense row, next to an expander, in a table people
// scan rather than read. A misclick that sells a position is not recoverable —
// re-buying is a new trade at a new price, with fees, and the agent's own entry
// rule may not agree with it. So the click opens a statement of what is about
// to be sold and asks for a second one.
//
// WHAT THE DIALOG SHOWS, AND WHY EACH LINE IS THERE
//
// Built like the withdraw dialog's confirm step, because it is the same kind
// of moment: one figure that leads (what is being sold), the facts needed to
// judge it (cost, price, value, fee, what is left), one status line saying
// whether the wallet agrees with the book, and one white pill that commits.
// Nothing on it is red. Rule 3: colour is a signal, and a red button is a
// warning label on a decision the owner has already read.
//
// THE FIGURE IS THE WALLET'S, NOT THE BOOK'S. The book records what a buy was
// quoted; the wallet holds what arrived, which is a hair less, and an owner
// can move tokens out by hand. A live sale offers the wallet's balance, so
// this states that balance — a confirmation for 9.4166 that sells 9.4165 is a
// signature on a number that was not true. Every dollar figure below scales to
// the same quantity.

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { closePosition, closePreview, type ClosePreview } from "@/lib/api";
import { Modal } from "@/components/modal";
import {
  Figure,
  SectionLabel,
  StatusLine,
  FieldNote,
  Spinner,
  TxLink,
  LABEL,
  PRIMARY,
  QUIET,
} from "@/components/kit";
import { useT } from "@/lib/i18n";

export interface ClosableHolding {
  mint: string;
  symbol: string;
  qty: number;
  costUsd: number;
  avgUsd: number;
  markUsd: number | null;
  valueUsd: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  /** See Holding in positions.tsx — what closing costs, and what it leaves. */
  exitCostUsd?: number | null;
  netPnlUsd?: number | null;
}

export function ClosePositionModal({
  agentId,
  holding,
  onClose,
  onClosed,
}: {
  agentId: number;
  holding: ClosableHolding;
  onClose: () => void;
  /** Called after a successful sale, so the page can re-read the book. */
  onClosed: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * The sale's receipt, once a LIVE close has landed. The dialog stays open
   * to show it — like the withdraw dialog after a send — because a swap that
   * moved real money deserves a line saying so and a link to check it. A
   * paper close has no receipt and the dialog simply closes.
   */
  const [sold, setSold] = useState<string | null>(null);

  // What the wallet holds, read on open. Until it returns the size shows the
  // book with a live status line; if the read fails the book stands, and the
  // sale itself re-reads the wallet before it offers anything.
  const [preview, setPreview] = useState<ClosePreview | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const p = await closePreview(token, agentId, holding.mint);
        if (!cancelled) setPreview(p);
      } catch {
        // The book stands; see above.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, holding.mint, getAccessToken]);

  const heldQty = preview?.heldQty ?? null;
  const sellQty = heldQty === null ? holding.qty : Math.min(holding.qty, heldQty);
  const walletShort = heldQty !== null && heldQty < holding.qty && heldQty > 0;
  const walletEmpty = heldQty !== null && heldQty <= 0;
  const walletChecked = heldQty !== null && !walletShort && !walletEmpty;
  const share = holding.qty > 0 ? sellQty / holding.qty : 1;

  const scale = (v: number | null | undefined): number | null =>
    v === null || v === undefined ? null : v * share;
  const valueUsd = scale(holding.valueUsd);
  const exitCostUsd = scale(holding.exitCostUsd);
  // `netPnlUsd` is absent only against a backend that sends no cost model;
  // then the gross figure stands and the label says "P&L" rather than
  // "P&L after fee".
  const net = scale(holding.netPnlUsd);
  const shownPnl = net ?? scale(holding.pnlUsd);
  const costBasis =
    holding.valueUsd === null || holding.pnlUsd === null
      ? null
      : (holding.valueUsd - holding.pnlUsd) * share;
  const shownPct =
    shownPnl === null || costBasis === null || costBasis <= 0
      ? holding.pnlPct
      : (shownPnl / costBasis) * 100;
  const priced = valueUsd !== null;

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("close_sign_in"));
      const result = await closePosition(token, agentId, holding.mint);
      onClosed();
      if (result.txSignature) {
        setSold(result.txSignature);
        setBusy(false);
      } else {
        onClose();
      }
    } catch (err) {
      // Left OPEN on failure, showing why. Most failures here are temporary —
      // the agent is mid-cycle, or the price went unreadable — and closing the
      // dialog would hide the reason and lose the click.
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const signed = (v: number) => `${v >= 0 ? "+" : "−"}$${Math.abs(v).toFixed(2)}`;

  if (sold) {
    return (
      <Modal title={t("close_title", { symbol: holding.symbol })} onClose={onClose}>
        <div className="space-y-4 px-6 py-6">
          <StatusLine tone="good">{t("close_sold")}</StatusLine>
          <FieldNote tone="dim">{t("close_sold_body")}</FieldNote>
          <div className="flex items-center gap-4">
            <TxLink signature={sold} label={t("common_view_transaction")} />
            <button type="button" onClick={onClose} className={QUIET}>
              {t("close_done")}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={t("close_title", { symbol: holding.symbol })} onClose={onClose}>
      <div className="space-y-6 px-6 py-6">
        {/* The one figure. Left-aligned like the withdraw confirm: centred
            type reads as a receipt, and this is a decision still being made. */}
        <div className="space-y-2">
          <SectionLabel>{t("close_selling")}</SectionLabel>
          <Figure
            value={sellQty.toFixed(4)}
            unit={holding.symbol}
            size={30}
            dim={checking || walletEmpty}
          />
          {checking ? (
            <StatusLine tone="pending" live>
              {t("close_checking_wallet")}
            </StatusLine>
          ) : walletEmpty ? (
            <StatusLine tone="bad">{t("close_wallet_empty", { symbol: holding.symbol })}</StatusLine>
          ) : walletShort ? (
            <StatusLine tone="pending">
              {t("close_wallet_short", {
                held: sellQty.toFixed(4),
                book: holding.qty.toFixed(4),
              })}
            </StatusLine>
          ) : walletChecked ? (
            <StatusLine tone="good">{t("close_wallet_matches")}</StatusLine>
          ) : null}
        </div>

        {/* The facts, as label-and-figure rows on hairlines. No boxes: rule 2,
            and a bordered container of bordered rows is eight edges for five
            facts. */}
        <dl className="divide-y divide-grid">
          <Row label={t("close_avg_cost")} value={`$${holding.avgUsd.toFixed(2)}`} />
          <Row
            label={t("close_price_now")}
            value={holding.markUsd === null ? t("close_not_priced") : `$${holding.markUsd.toFixed(2)}`}
            dim={holding.markUsd === null}
          />
          <Row
            label={t("close_total_value")}
            value={valueUsd === null ? t("close_not_priced") : `$${valueUsd.toFixed(2)}`}
            dim={valueUsd === null}
          />
          {/* The cost of the act being confirmed, on the screen confirming it.
              Its own line rather than folded into the total, so the arithmetic
              is checkable. */}
          {net === null ? null : (
            <Row label={t("close_fee")} value={`−$${(exitCostUsd ?? 0).toFixed(2)}`} dim />
          )}
          <Row
            label={net === null ? t("close_pnl") : t("close_pnl_net")}
            dim={shownPnl === null}
            tone={shownPnl === null ? "none" : shownPnl >= 0 ? "up" : "down"}
            value={
              shownPnl === null
                ? "—"
                : signed(shownPnl) +
                  (shownPct === null
                    ? ""
                    : `  (${shownPct >= 0 ? "+" : "−"}${Math.abs(shownPct).toFixed(1)}%)`)
            }
          />
        </dl>

        <div className="space-y-1.5">
          {walletEmpty ? (
            <FieldNote tone="dim">{t("close_wallet_empty_note")}</FieldNote>
          ) : walletShort ? (
            <FieldNote tone="dim">{t("close_wallet_short_note")}</FieldNote>
          ) : null}
          <FieldNote tone="dim">{t(priced ? "close_note" : "close_unpriced_note")}</FieldNote>
          {error ? <FieldNote tone="bad">{error}</FieldNote> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy || checking || walletEmpty}
            aria-busy={busy}
            className={`flex-1 gap-2 ${PRIMARY}`}
          >
            {busy ? <Spinner /> : null}
            {t(busy ? "close_closing" : "close_confirm")}
          </button>
          {/* Quiet, and second. Keeping is the safe direction and does not
              need to compete for the eye with the one action that sells. */}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`shrink-0 px-3 ${QUIET}`}
          >
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
        className={`tnum font-mono text-[12.5px] ${
          dim
            ? "text-text-dim"
            : tone === "up"
              ? "text-accent"
              : tone === "down"
                ? "text-negative"
                : "text-text-primary"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
