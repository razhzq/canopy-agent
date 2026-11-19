"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { FOCUS, PRIMARY, SECONDARY } from "@/components/kit";
import { readAccounts } from "@/components/nav";
import { NotificationSettings } from "@/components/notifications";
import { DepositBody } from "@/components/portfolio2/deposit";
import { Signed } from "@/components/portfolio2/bits";
import { CopyButton } from "@/components/trade/bits";
import { UsernameModal } from "@/components/usernameModal";
import { WithdrawModal } from "@/components/walletModals";
import { getMyInvite, type PersonalInvite } from "@/lib/api";
import { usd } from "@/lib/format";
import { shortAddr } from "@/lib/market";
import { bookTotals } from "@/lib/portfolioMath";
import { useHoldings } from "@/lib/useHoldings";
import { useTradeAccount } from "@/lib/useMarket";
import { useUsername } from "@/lib/useUsername";
import { sectionOn } from "@/lib/enabledSections";
import { AccountHeading, Card, START_CREDITS } from "./accountShell";

/* ------------------------------------------------------------------ wallet -- */

export function WalletSection() {
  const { account } = useTradeAccount();
  const { state } = useHoldings();
  const [withdraw, setWithdraw] = useState(false);
  const totals = useMemo(
    () => (state.phase === "ready" ? bookTotals(state.holdings, "live", state.ownOpen, state.ownClosed) : null),
    [state],
  );
  const free = account?.usdcBalance ?? 0;
  const total = free + (totals?.investedUsd ?? 0);
  const address = account?.walletAddress ?? null;

  return (
    <>
      <AccountHeading
        aside={
          address ? (
            <button type="button" className={SECONDARY} onClick={() => setWithdraw(true)}>
              Withdraw
            </button>
          ) : null
        }
      >
        Wallet
      </AccountHeading>
      <div className="mb-4 rounded-2xl border border-border bg-panel p-5">
        <p className="font-ui text-[12px] text-text-muted">Total balance</p>
        <p className="tnum mt-1 font-mono text-[30px] leading-none text-text-primary">{usd(total)}</p>
        <p className="mt-2 font-ui text-[12px] text-text-muted">Your trading wallet plus everything working in live agents and your own trades.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card label="Free to use">{usd(free)}</Card>
        {sectionOn("portfolio") ? (
          <Link href="/portfolio" className={`rounded-2xl ${FOCUS}`}>
            <Card label="Invested ›" className="h-full hover:border-grid-strong">
              {usd(totals?.investedUsd ?? 0)}
            </Card>
          </Link>
        ) : (
          <Card label="Invested">{usd(totals?.investedUsd ?? 0)}</Card>
        )}
        <Card label="P&L, 30 days">
          <Signed usd={totals?.d30Usd ?? null} />
        </Card>
      </div>

      <h2 className="mt-8 mb-3 font-ui text-[18px] font-light text-text-primary">Deposit</h2>
      <div className="rounded-2xl border border-border bg-panel">
        <DepositBody address={address} />
      </div>
      {account && (
        <p className="mt-3 font-ui text-[12px] text-text-muted">
          SOL for network fees: <span className="tnum font-mono text-text-secondary">{account.solBalance.toFixed(4)} SOL</span>
        </p>
      )}
      {withdraw && address && <WithdrawModal address={address} onClose={() => setWithdraw(false)} />}
    </>
  );
}

/* ---------------------------------------------------------------- referral -- */

export function ReferralSection() {
  const { getAccessToken } = usePrivy();
  const [invite, setInvite] = useState<PersonalInvite | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const tk = await getAccessToken();
        if (!tk) return;
        const i = await getMyInvite(tk);
        if (!cancelled) setInvite(i);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  const link = invite && typeof window !== "undefined" ? `${window.location.origin}/?ref=${invite.code}` : "";

  return (
    <>
      <AccountHeading>Referral</AccountHeading>
      <p className="mb-4 max-w-[520px] font-ui text-[13px] text-text-dim">Invite friends with your link. Each one who signs up through it counts toward your invites.</p>
      {error && <p className="font-ui text-[13px] text-negative">{error}</p>}
      {!invite && !error && <div className="h-[200px] animate-pulse rounded-2xl bg-surface" />}
      {invite && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-panel p-4">
            <div className="min-w-0 flex-1">
              <p className="font-ui text-[12px] text-text-muted">Your invite link</p>
              <p className="tnum truncate font-mono text-[14px] text-text-primary">{link.replace(/^https?:\/\//, "")}</p>
            </div>
            <CopyButton text={link} label="Copy link" />
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(link)}`}
              target="_blank"
              rel="noreferrer"
              className={`${SECONDARY} h-8 px-3 text-[12.5px]`}
            >
              Share on Telegram
            </a>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Card label="Invited">{invite.uses}</Card>
            <Card label="Invites left">{invite.disabled ? "Paused" : invite.remaining}</Card>
            <Card label="Code">{invite.code}</Card>
          </div>
          <h2 className="mt-8 mb-3 font-ui text-[18px] font-light text-text-primary">Your friends</h2>
          {invite.referrals.length === 0 ? (
            <p className="rounded-2xl border border-border px-6 py-10 text-center font-ui text-[13px] text-text-dim">Nobody has joined through your link yet.</p>
          ) : (
            <ul className="divide-y divide-border-soft rounded-2xl border border-border bg-panel">
              {invite.referrals.map((r) => (
                <li key={r.privyId} className="flex items-center justify-between gap-3 px-4 py-3 font-ui text-[13px]">
                  <span className="truncate text-text-secondary">{r.email ? maskEmail(r.email) : "A friend"}</span>
                  <span className="text-[12px] text-text-muted">
                    Joined {new Date(r.redeemedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function maskEmail(e: string): string {
  const [u, d] = e.split("@");
  return d ? `${u.slice(0, 2)}•••@${d}` : e;
}

/* ----------------------------------------------------------------- profile -- */

export function ProfileSection() {
  const { user, linkEmail, linkWallet } = usePrivy();
  const { username } = useUsername();
  const [editing, setEditing] = useState(false);
  const { email, wallets } = readAccounts(user);
  const { account } = useTradeAccount();

  const row = "flex flex-wrap items-center justify-between gap-3 px-4 py-3.5";
  return (
    <>
      <AccountHeading>Profile</AccountHeading>
      <div className="divide-y divide-border-soft rounded-2xl border border-border bg-panel font-ui text-[13px]">
        <div className={row}>
          <div>
            <p className="text-[12px] text-text-muted">Username</p>
            <p className="text-text-primary">{username ? `@${username}` : "Not set"}</p>
            <p className="text-[11.5px] text-text-muted">Shown on agents you publish.</p>
          </div>
          <button type="button" className={`${SECONDARY} h-8 px-3 text-[12.5px]`} onClick={() => setEditing(true)}>
            {username ? "Change" : "Choose one"}
          </button>
        </div>
        <div className={row}>
          <div>
            <p className="text-[12px] text-text-muted">Email</p>
            <p className="text-text-primary">{email ?? "Not linked"}</p>
          </div>
          {!email && (
            <button type="button" className={`${SECONDARY} h-8 px-3 text-[12.5px]`} onClick={() => linkEmail()}>
              Link email
            </button>
          )}
        </div>
        <div className={row}>
          <div className="min-w-0">
            <p className="text-[12px] text-text-muted">Trading wallet</p>
            <p className="tnum truncate font-mono text-text-primary">{account?.walletAddress ? shortAddr(account.walletAddress) : "Not set up"}</p>
          </div>
          {account?.walletAddress ? <CopyButton text={account.walletAddress} label="Copy" /> : <Link href="/trade" className={`${SECONDARY} h-8 px-3 text-[12.5px]`}>Set up</Link>}
        </div>
        <div className={row}>
          <div>
            <p className="text-[12px] text-text-muted">Linked wallets</p>
            <p className="text-text-primary">{wallets.length ? wallets.map((w) => shortAddr(w.address)).join(", ") : "None"}</p>
          </div>
          <button type="button" className={`${SECONDARY} h-8 px-3 text-[12.5px]`} onClick={() => linkWallet()}>
            Link a wallet
          </button>
        </div>
        {sectionOn("portfolio") && (
        <div className={row}>
          <div>
            <p className="text-[12px] text-text-muted">Creator</p>
            <p className="text-text-primary">Earnings from agents others copy</p>
          </div>
          <Link href="/earnings" className={`${SECONDARY} h-8 px-3 text-[12.5px]`}>
            Open earnings
          </Link>
        </div>
        )}
      </div>
      {editing && <UsernameModal onClose={() => setEditing(false)} />}
    </>
  );
}

/* ----------------------------------------------------------- notifications -- */

export function NotificationsSection() {
  return (
    <>
      <AccountHeading>Notifications</AccountHeading>
      <p className="mb-4 font-ui text-[13px] text-text-dim">Stop losses and agent pauses always send, even in quiet hours.</p>
      <NotificationSettings />
    </>
  );
}

/* ----------------------------------------------------------------- credits -- */

const COSTS: [string, string][] = [
  ["Copilot setup on a token", "2"],
  ["Changing the plan on a setup you just got", "Free"],
  ["Ask and Studio drafts", "Free"],
  ["Running or copying agents", "Free"],
];

export function CreditsSection() {
  const { account } = useTradeAccount();
  const credits = account?.credits ?? null;
  return (
    <>
      <AccountHeading>Credits</AccountHeading>
      <div className="rounded-2xl border border-border bg-panel p-5">
        <p className="font-ui text-[12px] text-text-muted">Balance</p>
        <p className="tnum mt-1 font-mono text-[30px] leading-none text-text-primary">{credits === null ? "—" : credits.toLocaleString("en-US")}</p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <i className="block h-full bg-accent" style={{ width: `${credits === null ? 0 : Math.min(100, (credits / START_CREDITS) * 100)}%` }} />
        </div>
        <p className="mt-2 font-ui text-[12px] text-text-muted">Every account starts with {START_CREDITS.toLocaleString("en-US")} credits.</p>
      </div>
      <h2 className="mt-8 mb-3 font-ui text-[18px] font-light text-text-primary">What costs credits</h2>
      <ul className="divide-y divide-border-soft rounded-2xl border border-border bg-panel">
        {COSTS.map(([what, cost]) => (
          <li key={what} className="flex items-center justify-between gap-3 px-4 py-3 font-ui text-[13px]">
            <span className="text-text-secondary">{what}</span>
            <span className="tnum font-mono text-text-primary">{cost}</span>
          </li>
        ))}
      </ul>
      <Link href="/feed" className={`${PRIMARY} mt-5`}>
        Get a Copilot setup
      </Link>
    </>
  );
}
