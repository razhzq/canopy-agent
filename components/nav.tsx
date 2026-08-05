"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";

const NAV = [
  { label: "Agents", href: "/agents", match: ["/agents", "/deploy"] },
  { label: "Portfolio", href: "/portfolio", match: ["/portfolio"] },
  { label: "Build", href: "/build", match: ["/build"] },
];

/* ------------------------------------------------------------- accounts -- */

interface LinkedWallet {
  address: string;
  /** "privy" for the wallet Canopy created; anything else is the user's own. */
  client: string;
  chain: string;
}

/**
 * Reads what we can display from Privy's user object.
 *
 * The linkedAccounts union is wide and version-sensitive, so this narrows by
 * checking the shape rather than casting to Privy's types — a field that
 * disappears in an SDK bump then degrades to "not shown" instead of throwing
 * inside the navbar, which is on every page.
 */
export function readAccounts(user: unknown): { email: string | null; wallets: LinkedWallet[] } {
  const raw = (user as { linkedAccounts?: unknown })?.linkedAccounts;
  // Guard the container AND each entry. A null element inside the array threw
  // here and took the whole navbar — and therefore every page — down with it.
  const accounts: unknown[] = Array.isArray(raw) ? raw : [];
  let email: string | null = null;
  const wallets: LinkedWallet[] = [];

  for (const entry of accounts) {
    if (!entry || typeof entry !== "object") continue;
    const a = entry as Record<string, unknown>;
    if (a.type === "email" && typeof a.address === "string") {
      email = a.address;
    }
    if (a.type === "wallet" && typeof a.address === "string") {
      wallets.push({
        address: a.address,
        client: typeof a.walletClientType === "string" ? a.walletClientType : "unknown",
        chain: typeof a.chainType === "string" ? a.chainType : "",
      });
    }
  }
  return { email, wallets };
}

function short(address: string): string {
  return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

function walletLabel(w: LinkedWallet): string {
  if (w.client === "privy") return "Canopy wallet";
  // "phantom" → "Phantom". The client type is the wallet the user chose.
  return w.client.charAt(0).toUpperCase() + w.client.slice(1);
}

/* ------------------------------------------------------------- dropdown -- */

function AccountMenu() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape. Without this the panel stays open
  // behind whatever the user clicks next, which reads as a stuck UI.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!ready) {
    return <div className="size-9 rounded-full bg-surface-2" />;
  }

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={() => login()}
        className="h-9 rounded-md border border-border px-4 font-ui text-[14px] text-text-secondary transition-colors hover:border-accent hover:text-accent"
      >
        Sign in
      </button>
    );
  }

  const { email, wallets } = readAccounts(user);
  const external = wallets.filter((w) => w.client !== "privy");
  const embedded = wallets.filter((w) => w.client === "privy");

  // What the button shows. An external wallet is the more identifying thing
  // for someone who signed in that way; email is the identity for everyone
  // else. Falls back to the Canopy-created wallet so the button is never blank.
  const primary =
    external.length > 0 ? short(external[0].address) : (email ?? (embedded[0] ? short(embedded[0].address) : "Account"));

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard blocked — the address is still visible to select by hand */
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2.5 rounded-md border border-border px-3 transition-colors hover:border-grid-strong"
      >
        <span className="size-5 rounded-full bg-accent-wash ring-1 ring-accent/40" />
        <span className="max-w-[190px] truncate font-mono text-[13px] text-text-primary">
          {primary}
        </span>
        <svg viewBox="0 0 16 16" className="size-3 shrink-0 text-text-dim" aria-hidden>
          <path
            d="m4 6 4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[300px] border border-grid-strong bg-panel">
          <div className="border-b border-grid px-4 py-3">
            <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
              Signed in
            </p>
          </div>

          {email ? (
            <div className="border-b border-grid px-4 py-3.5">
              <p className="pb-1 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                Email
              </p>
              <p className="truncate font-ui text-[13px] text-text-primary">{email}</p>
            </div>
          ) : null}

          {[...external, ...embedded].map((w) => (
            <button
              key={w.address}
              type="button"
              onClick={() => copy(w.address)}
              className="block w-full border-b border-grid px-4 py-3.5 text-left transition-colors hover:bg-surface"
            >
              <div className="flex items-center justify-between pb-1">
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {walletLabel(w)}
                  {w.chain ? ` · ${w.chain}` : ""}
                </span>
                <span className="font-mono text-[9px] tracking-[0.1em] text-accent uppercase">
                  {copied === w.address ? "Copied" : "Copy"}
                </span>
              </div>
              <p className="truncate font-mono text-[13px] text-text-primary">{w.address}</p>
            </button>
          ))}

          {!email && wallets.length === 0 ? (
            <div className="border-b border-grid px-4 py-3.5">
              <p className="font-ui text-[13px] text-text-dim">No linked account details.</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
            className="block w-full px-4 py-3.5 text-left font-mono text-[12px] tracking-[0.06em] text-text-secondary uppercase transition-colors hover:text-negative"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ nav -- */

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-8">
      <div className="flex items-center gap-6">
        {/* The brand wordmark, not set type: it is a specific blocky face with
            its own mint fill and offset shadow, taken from canopy-fe's
            /canopy.png. That source is 2000x1555 and ~83% transparent padding,
            which is why canopy-fe has to render it at h-[120px]; this copy is
            cropped to the ink so it sits correctly at navbar height. */}
        <Link href="/agents" className="flex items-center">
          <Image
            src="/canopy-wordmark.png"
            alt="Canopy"
            width={1298}
            height={303}
            priority
            className="h-[21px] w-auto"
          />
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = item.match.some((m) => pathname.startsWith(m));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "rounded-md bg-surface-2 px-3.5 py-1.5 font-ui text-[15px] font-medium text-text-primary"
                    : "rounded-md px-3.5 py-1.5 font-ui text-[15px] text-text-secondary transition-colors hover:text-text-primary"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/build/new"
          className="flex h-9 items-center gap-2 rounded-md bg-accent px-4 font-ui text-[14px] font-semibold text-bg transition-opacity hover:opacity-90"
        >
          <span className="text-[16px] leading-none">+</span>
          Create agent
        </Link>

        <AccountMenu />
      </div>
    </header>
  );
}
