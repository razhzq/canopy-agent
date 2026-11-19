"use client";

import Link from "next/link";
import { PRIMARY, SECONDARY } from "@/components/kit";
import { CopyButton } from "@/components/trade/bits";
import { shortAddr } from "@/lib/market";

/** The deposit dialog's body: the trading wallet's address, or the way to get one. */
export function DepositBody({ address }: { address: string | null }) {
  if (!address) {
    return (
      <div className="space-y-4 px-6 pt-4 pb-6">
        <p className="font-ui text-[13px] text-text-dim">Set up your trading account first. It takes one step on the Trade screen.</p>
        <Link href="/trade" className={PRIMARY}>
          Go to Trade
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4 px-6 pt-4 pb-6">
      <p className="font-ui text-[13px] text-text-dim">Send USDC on Solana to your trading wallet. SOL is used for network fees.</p>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <span className="tnum truncate font-mono text-[12.5px] text-text-primary" title={address}>
          {shortAddr(address)}
        </span>
        <CopyButton text={address} label="Copy address" />
      </div>
      <p className="font-ui text-[12px] text-text-muted">Tokens sent on another network can be lost.</p>
      <a href={`https://solscan.io/account/${address}`} target="_blank" rel="noreferrer" className={SECONDARY}>
        View on Solscan
      </a>
    </div>
  );
}
