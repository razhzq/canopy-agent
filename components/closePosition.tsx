"use client";

// "Close this position?" — the confirmation behind the × in the positions table.
//
// WHY A MODAL AND NOT A ONE-CLICK ×
//
// The × sits at the end of a dense row, next to an expander, in a table people
// scan rather than read. A misclick that sells a position is not recoverable —
// re-buying is a new trade at a new price, with fees, and the agent's own entry
// rule may not agree with it. So the click opens a statement of what is about
// to be sold and asks for a second one.
//
// WHAT THE MODAL SHOWS, AND WHY EACH LINE IS THERE
//
// The owner is being asked to confirm a sale, so they need what they would need
// to make that decision themselves: what they paid, what it is worth now, and
// the difference. Showing only "close TSLAx?" would be asking for a signature
// on an unread document.
//
// A position that cannot be priced still renders — with the value and P&L blank
// rather than zeroed. The backend will refuse the sale, and the modal saying so
// beforehand is better than a button that fails.

import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { closePosition } from "@/lib/api";
import { AssetLogo } from "@/components/ui";
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
  const panel = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  const priced = holding.valueUsd !== null;

  // Escape closes, and focus starts on CANCEL rather than on the destructive
  // button — a stray Enter on an unread dialog should do nothing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        // Focus stays in the dialog. Tabbing onto the table behind it would let
        // someone act on a row while a confirmation about another row is open.
        const items = panel.current?.querySelectorAll<HTMLElement>("button");
        if (!items || items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, onClose]);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("close_sign_in"));
      await closePosition(token, agentId, holding.mint);
      onClosed();
      onClose();
    } catch (err) {
      // Left OPEN on failure, showing why. Most failures here are temporary —
      // the agent is mid-cycle, or the price went unreadable — and closing the
      // dialog would hide the reason and lose the click.
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-bg/80 px-4 py-10 backdrop-blur-sm"
      onMouseDown={(e) => {
        // Only a click that STARTED on the backdrop dismisses. Without the
        // mousedown check, releasing a text selection outside the panel closes
        // the dialog under the user's hand.
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-position-title"
        className="w-full max-w-[440px] border border-grid bg-panel"
      >
        <div className="flex items-center gap-3 border-b border-grid px-6 py-5">
          <AssetLogo symbol={holding.symbol} />
          <div className="min-w-0">
            <h2
              id="close-position-title"
              className="font-mono text-[13px] tracking-[0.06em] text-text-primary"
            >
              {t("close_title", { symbol: holding.symbol })}
            </h2>
            <p className="pt-0.5 font-ui text-[12px] text-text-dim">
              {t("close_subtitle")}
            </p>
          </div>
        </div>

        <dl className="divide-y divide-grid px-6">
          <Row label={t("close_size")} value={`${holding.qty.toFixed(4)} ${holding.symbol}`} />
          <Row label={t("close_avg_cost")} value={`$${holding.avgUsd.toFixed(2)}`} />
          <Row
            label={t("close_price_now")}
            value={
              holding.markUsd === null
                ? t("close_not_priced")
                : `$${holding.markUsd.toFixed(2)}`
            }
            dim={holding.markUsd === null}
          />
          <Row
            label={t("close_total_value")}
            value={
              holding.valueUsd === null
                ? t("close_not_priced")
                : `$${holding.valueUsd.toFixed(2)}`
            }
            dim={holding.valueUsd === null}
          />
          <Row
            label={t("close_pnl")}
            dim={holding.pnlUsd === null}
            tone={holding.pnlUsd === null ? "none" : holding.pnlUsd >= 0 ? "up" : "down"}
            value={
              holding.pnlUsd === null
                ? "—"
                : `${holding.pnlUsd >= 0 ? "+" : "−"}$${Math.abs(holding.pnlUsd).toFixed(2)}` +
                  (holding.pnlPct === null
                    ? ""
                    : `  (${holding.pnlPct >= 0 ? "+" : "−"}${Math.abs(holding.pnlPct).toFixed(1)}%)`)
            }
          />
        </dl>

        <div className="space-y-4 px-6 py-5">
          {!priced ? (
            <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">
              {t("close_unpriced_note")}
            </p>
          ) : (
            <p className="font-ui text-[12.5px] leading-relaxed text-text-secondary">
              {t("close_note")}
            </p>
          )}

          {error ? (
            <p className="font-ui text-[12.5px] leading-relaxed text-negative" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3">
            <button
              ref={cancel}
              type="button"
              disabled={busy}
              onClick={onClose}
              className="h-11 flex-1 border border-border font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase transition-colors hover:bg-surface disabled:opacity-40"
            >
              {t("close_keep")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirm()}
              className="h-11 flex-1 border border-negative font-mono text-[11px] tracking-[0.1em] text-negative uppercase transition-colors hover:bg-negative hover:text-bg disabled:opacity-40"
            >
              {t(busy ? "close_closing" : "close_confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
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
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="font-mono text-[10px] tracking-[0.12em] text-text-dim uppercase">
        {label}
      </dt>
      <dd
        className={`tnum font-mono text-[12.5px] ${
          dim
            ? "text-text-muted"
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
