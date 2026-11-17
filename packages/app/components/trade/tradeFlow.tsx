"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { GrantDelegation } from "@/components/grantDelegation";
import { AddFundsModal } from "@/components/addFunds";
import { PRIMARY, SECONDARY, LABEL } from "@/components/kit";
import { Price } from "@/components/trade/bits";
import {
  getTradeQuote,
  setupTradeAccount,
  tradeBuy,
  tradeErrorCode,
  tradeSell,
} from "@/lib/api";
import { usd } from "@/lib/format";
import {
  ladderLines,
  planName,
  type ExitPlan,
  type Position,
  type TokenRow,
  type TradeAccount,
  type TradeQuote,
} from "@/lib/market";
import { usePersonalWallet } from "@/lib/usePersonalWallet";

export type TradeIntent =
  | { side: "buy"; token: TokenRow; usd: number; exitPlan: ExitPlan; source: string; priceUsd: number | null }
  | { side: "sell"; token: TokenRow; fraction: number; priceUsd: number | null };

export type TradeResult =
  | { side: "buy"; position: Position; signature: string }
  | { side: "sell"; soldUsd: number; pnlUsd: number; signature: string };

const SLIPPAGE_BPS = 50;

const ERRORS: Record<string, string> = {
  safety_failed: "This token fails the safety check, so Canopy will not buy it.",
  amount_invalid: "Enter an amount of at least $5.",
  insufficient_balance: "Not enough USDC in your trading wallet.",
  account_required: "Set up your trading account first.",
};

function message(err: unknown): string {
  const code = tradeErrorCode(err);
  if (code && ERRORS[code]) return ERRORS[code];
  return err instanceof Error ? err.message : String(err);
}

/**
 * Every buy and sell goes through here: account, quote, confirm, place.
 *
 * One flow for the Trade panel and the Feed, so the confirmation a reader
 * learns in one place is the confirmation they get in the other.
 */
export function TradeFlow({
  intent,
  account,
  accountLoading,
  onAccountChanged,
  onClose,
  onDone,
}: {
  intent: TradeIntent;
  account: TradeAccount | null;
  accountLoading: boolean;
  onAccountChanged: () => void;
  onClose: () => void;
  onDone: (r: TradeResult) => void;
}) {
  const { authenticated, login, getAccessToken } = usePrivy();
  const personal = usePersonalWallet();
  const [funding, setFunding] = useState(false);

  const title = intent.side === "buy" ? `Buy ${intent.token.symbol}` : `Sell ${intent.token.symbol}`;

  if (funding && account?.agentId) {
    return (
      <AddFundsModal
        agentId={Number(account.agentId)}
        agentWallet={account.walletAddress}
        personalWallet={personal}
        onChanged={onAccountChanged}
        onClose={() => setFunding(false)}
      />
    );
  }

  let body: React.ReactNode;
  if (!authenticated) {
    body = (
      <div className="space-y-4">
        <p className="font-ui text-[13px] text-text-secondary">Sign in to trade.</p>
        <button type="button" className={PRIMARY} onClick={() => login()}>
          Sign in
        </button>
      </div>
    );
  } else if (accountLoading) {
    body = <p className="font-ui text-[13px] text-text-dim">Checking your trading account</p>;
  } else if (!account?.ready) {
    body = <AccountSetup account={account} getToken={getAccessToken} onChanged={onAccountChanged} />;
  } else {
    body = (
      <Confirm
        intent={intent}
        account={account}
        getToken={getAccessToken}
        onFund={() => setFunding(true)}
        onClose={onClose}
        onDone={onDone}
      />
    );
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="px-6 pt-4 pb-6">{body}</div>
    </Modal>
  );
}

/* --------------------------------------------------------- account setup -- */

const DEFAULT_CAP = 1000;
const EXPIRY_DAYS = 90;

export function AccountSetup({
  account,
  getToken,
  onChanged,
}: {
  account: TradeAccount | null;
  getToken: () => Promise<string | null>;
  onChanged: () => void;
}) {
  const [agentId, setAgentId] = useState<string | null>(account?.agentId ?? null);
  const [cap, setCap] = useState(String(DEFAULT_CAP));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expiresAt = useMemo(() => new Date(Date.now() + EXPIRY_DAYS * 86_400_000), []);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session expired. Sign in again.");
      const a = await setupTradeAccount(token);
      setAgentId(a.agentId);
      if (a.ready) onChanged();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(address: string) {
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session expired. Sign in again.");
      await setupTradeAccount(token, address);
      onChanged();
    } catch (err) {
      setError(message(err));
    }
  }

  return (
    <div className="space-y-4">
      <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
        Trades run from a wallet you own. Canopy signs your buys and the exits you set, through Jupiter only, up to your
        spend cap. It cannot withdraw.
      </p>
      {!agentId ? (
        <button type="button" className={PRIMARY} disabled={busy} onClick={create}>
          {busy ? "Setting up" : "Set up trading account"}
        </button>
      ) : (
        <div className="space-y-4">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3">
            <span className={LABEL}>Spend cap</span>
            <span className="flex-1" />
            <span className="tnum font-mono text-[14px] text-text-dim">$</span>
            <input
              inputMode="decimal"
              value={cap}
              onChange={(e) => setCap(e.target.value.replace(/[^0-9.]/g, ""))}
              className="tnum w-24 bg-transparent text-right font-mono text-[14px] text-text-primary outline-none"
              aria-label="Spend cap in dollars"
            />
          </label>
          <p className="font-ui text-[12px] text-text-muted">Expires in {EXPIRY_DAYS} days.</p>
          <GrantDelegation
            agentId={Number(agentId)}
            maxSpendUsd={Math.max(1, Number(cap) || DEFAULT_CAP)}
            expiresAt={expiresAt}
            onGranted={(r) => void confirm(r.address)}
          />
        </div>
      )}
      {error && (
        <p className="font-ui text-[13px] text-negative" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- confirm -- */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="font-ui text-[12.5px] text-text-dim">{label}</span>
      <span className="tnum text-right font-mono text-[12.5px] text-text-primary">{children}</span>
    </div>
  );
}

function Confirm({
  intent,
  account,
  getToken,
  onFund,
  onClose,
  onDone,
}: {
  intent: TradeIntent;
  account: TradeAccount;
  getToken: () => Promise<string | null>;
  onFund: () => void;
  onClose: () => void;
  onDone: (r: TradeResult) => void;
}) {
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "placing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TradeResult | null>(null);

  const short = intent.side === "buy" && intent.usd > account.usdcBalance;
  const mint = intent.token.mint;
  const side = intent.side;
  const amount = intent.side === "buy" ? intent.usd : intent.fraction;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const q = await getTradeQuote(token, {
          mint,
          side,
          ...(side === "buy" ? { usd: amount } : { fraction: amount }),
          slippageBps: SLIPPAGE_BPS,
        });
        if (!cancelled) setQuote(q);
      } catch (err) {
        if (!cancelled) setQuoteError(message(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mint, side, amount, getToken]);

  async function place() {
    setPhase("placing");
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session expired. Sign in again.");
      let r: TradeResult;
      if (intent.side === "buy") {
        const res = await tradeBuy(token, {
          mint,
          usd: intent.usd,
          exitPlan: intent.exitPlan,
          source: intent.source,
          slippageBps: SLIPPAGE_BPS,
        });
        r = { side: "buy", ...res };
      } else {
        const res = await tradeSell(token, { mint, fraction: intent.fraction });
        r = { side: "sell", ...res };
      }
      setResult(r);
      setPhase("done");
      onDone(r);
    } catch (err) {
      setError(message(err));
      setPhase("idle");
    }
  }

  if (phase === "done" && result) {
    return (
      <div className="space-y-4" role="status">
        {result.side === "buy" ? (
          <>
            <p className="font-ui text-[14px] text-text-primary">Bought {intent.token.symbol}</p>
            <div className="divide-y divide-border-soft">
              <Row label="Filled at">
                <Price value={result.position.entryPriceUsd} />
              </Row>
              <Row label="Size">{usd(result.position.costUsd)}</Row>
              <Row label="Take profit">
                {result.position.takeProfitPriceUsd != null ? <Price value={result.position.takeProfitPriceUsd} /> : "—"}
              </Row>
              <Row label="Stop loss">
                {result.position.stopPriceUsd != null ? <Price value={result.position.stopPriceUsd} /> : "—"}
              </Row>
            </div>
          </>
        ) : (
          <>
            <p className="font-ui text-[14px] text-text-primary">Sold {intent.token.symbol}</p>
            <div className="divide-y divide-border-soft">
              <Row label="Received">{usd(result.soldUsd)}</Row>
              <Row label="Profit">
                <span className={result.pnlUsd >= 0 ? "text-positive" : "text-negative"}>{usd(result.pnlUsd, { sign: true })}</span>
              </Row>
            </div>
          </>
        )}
        <div className="flex justify-end">
          <button type="button" className={PRIMARY} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    );
  }

  const lines = intent.side === "buy" && intent.priceUsd ? ladderLines(intent.exitPlan, intent.priceUsd) : [];

  return (
    <div className="space-y-4">
      <div className="divide-y divide-border-soft">
        {intent.side === "buy" ? (
          <Row label="You pay">{usd(intent.usd)} USDC</Row>
        ) : (
          <Row label="You sell">{Math.round(intent.fraction * 100)}% of your holding</Row>
        )}
        <Row label="Price">
          <Price value={intent.priceUsd} />
        </Row>
        <Row label="Price impact">{quote ? `${quote.priceImpactPct.toFixed(2)}%` : quoteError ? "—" : "…"}</Row>
        <Row label="Fee">{quote ? usd(quote.feeUsd) : quoteError ? "—" : "…"}</Row>
        <Row label="Slippage">{((quote?.slippageBps ?? SLIPPAGE_BPS) / 100).toFixed(1)}%</Row>
        <Row label="Route">{quote?.route ?? "Jupiter"}</Row>
        <Row label="MEV protection">On</Row>
      </div>

      {intent.side === "buy" && (
        <div className="rounded-xl border border-border p-3">
          <p className={`${LABEL} mb-1.5`}>Exits · {planName(intent.exitPlan.key)}</p>
          <ul className="space-y-1">
            {lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 font-ui text-[12px] text-text-secondary">
                <span>{l.text}</span>
                {l.priceUsd != null && <Price value={l.priceUsd} className="text-text-primary" />}
              </li>
            ))}
          </ul>
        </div>
      )}

      {quoteError && <p className="font-ui text-[12.5px] text-negative">{quoteError}</p>}
      {short && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <span className="font-ui text-[12.5px] text-text-secondary">
            Trading wallet holds {usd(account.usdcBalance)} USDC.
          </span>
          <button type="button" className={SECONDARY} onClick={onFund}>
            Add funds
          </button>
        </div>
      )}
      {error && (
        <p className="font-ui text-[13px] text-negative" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className={SECONDARY} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={PRIMARY} disabled={phase === "placing" || short} onClick={place}>
          {phase === "placing"
            ? "Placing order"
            : intent.side === "buy"
              ? `Confirm buy · ${usd(intent.usd)}`
              : "Confirm sell"}
        </button>
      </div>
    </div>
  );
}
