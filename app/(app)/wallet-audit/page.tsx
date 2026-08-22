import type { Metadata } from "next";
import { WalletAudit } from "@/components/walletAudit";

export const metadata: Metadata = {
  title: "Wallet audit · Canopy",
};

/**
 * TEMPORARY — read-only diagnostic for the duplicate-Solana-wallet issue.
 *
 * Answers one question: of the several embedded wallets this account
 * accumulated before `users-without-wallets` and the address pin landed, which
 * one is actually load-bearing — i.e. which is registered in
 * trading_agent_wallets and therefore carries the delegation and the signature
 * history.
 *
 * Delete this route once the account is sorted. It reads and shows; it changes
 * nothing, and it must never grow a button that does.
 */
export default function WalletAuditPage() {
  return (
    <main>
      <WalletAudit />
    </main>
  );
}
