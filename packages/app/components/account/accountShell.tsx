"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { FOCUS } from "@/components/kit";
import { SignedOutState } from "@/components/states";
import { useTradeAccount } from "@/lib/useMarket";
import { useUsername } from "@/lib/useUsername";

export const ACCOUNT_SECTIONS: [string, string][] = [
  ["wallet", "Wallet"],
  ["referral", "Referral"],
  ["profile", "Profile"],
  ["notifications", "Notifications"],
  ["credits", "Credits"],
];

/** Credits every account starts with; the bar in the menu reads against it. */
export const START_CREDITS = 1000;

/** The account area: a section menu beside (or above, on a phone) the section. */
export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { ready, authenticated, user } = usePrivy();
  const { username } = useUsername();
  const { account } = useTradeAccount();
  const current = pathname.split("/")[2] ?? "wallet";

  if (ready && !authenticated) {
    return (
      <main className="mx-auto max-w-[1100px] px-4 py-8 lg:px-6">
        <SignedOutState />
      </main>
    );
  }
  const name = username ?? user?.email?.address ?? "Your account";
  const credits = account?.credits ?? null;

  return (
    <main className="mx-auto grid w-full max-w-[1100px] gap-4 px-4 py-6 lg:grid-cols-[220px_1fr] lg:px-6 lg:py-8">
      <nav aria-label="Account sections" className="h-fit rounded-2xl border border-border bg-panel p-2 lg:sticky lg:top-[80px]">
        <div className="hidden items-center gap-3 px-2.5 pt-2 pb-3 lg:flex">
          <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 font-ui text-[13px] text-text-primary">
            {name.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 truncate font-ui text-[13.5px] text-text-primary">{name}</span>
        </div>
        <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col">
          {ACCOUNT_SECTIONS.map(([key, label]) => {
            const on = key === current;
            return (
              <li key={key} className="shrink-0">
                <Link
                  href={`/account/${key}`}
                  aria-current={on ? "page" : undefined}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 font-ui text-[13px] ${FOCUS} ${
                    on ? "bg-surface-2 text-text-primary" : "text-text-dim hover:bg-surface hover:text-text-primary"
                  }`}
                >
                  {label}
                  {key === "credits" && credits !== null && <span className="tnum font-mono text-[11.5px] text-text-muted">{credits.toLocaleString("en-US")}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </main>
  );
}

export function AccountHeading({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <h1 className="font-ui text-[26px] font-light tracking-[-0.02em] text-text-primary">{children}</h1>
      {aside}
    </div>
  );
}

export function Card({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-panel p-4 ${className}`}>
      <p className="font-ui text-[12px] text-text-muted">{label}</p>
      <div className="tnum mt-1.5 font-mono text-[20px] text-text-primary">{children}</div>
    </div>
  );
}
