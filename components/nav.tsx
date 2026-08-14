"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";

const NAV = [
  // "My agents" is the workspace — the rail plus one agent open beside it. It
  // matches /portfolio too, which still serves older deep links into the same
  // agents.
  { label: "My agents", href: "/workspace", match: ["/workspace", "/portfolio"] },
  { label: "Explore", href: "/agents", match: ["/agents", "/deploy"] },
];

/**
 * Whether a nav entry owns the current route.
 *
 * Segment-aware rather than a bare startsWith: "/agents" must not light up on
 * "/agents-archive", which is a different section that merely shares a prefix.
 */
function isActive(pathname: string, match: string[]): boolean {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/**
 * The one focus treatment for everything in the bar.
 *
 * An outline rather than a ring: it sits outside the element's own border, so
 * it stays visible on the filled accent button and the bordered ones alike
 * without either having to reserve space for it.
 */
const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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

/**
 * One letter for the avatar.
 *
 * Deliberately not a generated identicon: the label sits right beside it, so a
 * pattern would be decoration, while an initial is the same information the
 * reader is already using to recognise the account.
 */
function initialOf(label: string): string {
  const c = label.trim()[0];
  return c ? c.toUpperCase() : "?";
}

/** The circular monogram, shared by the trigger and the menu's header. */
function Avatar({ label, size = 20 }: { label: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-wash font-mono text-accent ring-1 ring-accent/30"
      style={{ width: size, height: size, fontSize: Math.max(size * 0.46, 9) }}
    >
      {initialOf(label)}
    </span>
  );
}

function CopyIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <rect x="5.5" y="5.5" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M10.5 3.5h-7v7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path
        d="M8 3.75v8.5M3.75 8h8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------- dropdown -- */

function AccountMenu() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    // Never strand focus on a panel that no longer exists — put it back where
    // the keyboard user opened it from.
    if (restoreFocus) trigger.current?.focus();
  }, []);

  // Close on an outside click, Escape, or a Tab out of the panel. Without this
  // the panel stays open behind whatever the user clicks next, which reads as
  // a stuck UI.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close(true);
        return;
      }
      if (e.key === "Tab") {
        // Let the browser move focus normally, then drop the panel if focus
        // has left it — a menu that outlives its own focus is a trap.
        setTimeout(() => {
          if (ref.current && !ref.current.contains(document.activeElement)) setOpen(false);
        }, 0);
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") {
        return;
      }
      // The rows carry role="menuitem", which promises arrow-key traversal.
      // This is that promise kept.
      const items = Array.from(
        ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
      );
      if (items.length === 0) return;
      e.preventDefault();
      const here = items.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? items.length - 1
            : e.key === "ArrowDown"
              ? (here + 1) % items.length
              : here <= 0
                ? items.length - 1
                : here - 1;
      items[next].focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // The "Copied" flag is on a timer; unmounting mid-flight (a sign-out, a route
  // change) must not leave it to fire into a dead component.
  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  if (!ready) {
    // Shaped like the button it becomes, not a circle: a placeholder of the
    // wrong width shoves the whole right-hand side of the navbar sideways the
    // moment Privy resolves.
    return <div className="h-9 w-[112px] rounded-md bg-surface-2 sm:w-[148px]" aria-hidden />;
  }

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={() => login()}
        className={`h-9 rounded-md border border-border px-4 font-ui text-[14px] font-medium text-text-secondary transition-colors hover:border-accent hover:bg-accent-wash hover:text-accent ${FOCUS}`}
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
  // An address is set in mono because its characters have to be comparable
  // digit by digit; an email is prose and reads better in the UI face.
  const primaryIsAddress = external.length > 0 || !email;
  // Which of the two ways in this was. Named in the menu header so the account
  // is identifiable without expanding a wallet row.
  const method = email ? "Email" : external.length > 0 ? walletLabel(external[0]) : "Wallet";

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard blocked — the address is still visible to select by hand */
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          // Opening with the keyboard should land on the first row, the way
          // every other menu button on the platform behaves.
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${primary}`}
        className={`flex h-9 items-center gap-2.5 rounded-md border pr-2.5 pl-2 transition-colors ${FOCUS} ${
          open
            ? "border-grid-strong bg-surface-2"
            : "border-border hover:border-grid-strong hover:bg-surface"
        }`}
      >
        <Avatar label={email ?? primary} />
        <span
          className={`max-w-[92px] truncate text-[13px] text-text-primary sm:max-w-[180px] ${
            primaryIsAddress ? "font-mono" : "font-ui"
          }`}
        >
          {primary}
        </span>
        <svg
          viewBox="0 0 16 16"
          className={`size-3 shrink-0 text-text-dim transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
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

      {/* Copying is a silent, purely visual event otherwise — this is the same
          confirmation, spoken. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Address copied to clipboard" : ""}
      </span>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-40 mt-2 w-[288px] origin-top-right animate-[menu-enter_120ms_ease-out] overflow-hidden rounded-md border border-grid-strong bg-panel shadow-[0_20px_44px_-16px_rgba(0,0,0,0.9)] sm:w-[320px]"
        >
          {/* Identity, stated once at the top. The rows below are things to DO
              with the account; this is the answer to "whose account is this",
              which the old header ("Signed in") never actually gave. */}
          <div className="flex items-center gap-3 border-b border-grid px-4 py-3.5">
            <Avatar label={email ?? primary} size={32} />
            <div className="min-w-0">
              <p
                className={`truncate text-[13.5px] text-text-primary ${
                  primaryIsAddress ? "font-mono" : "font-ui"
                }`}
              >
                {primary}
              </p>
              <p className="pt-0.5 font-mono text-[9.5px] tracking-[0.1em] text-text-dim uppercase">
                Signed in · {method}
              </p>
            </div>
          </div>

          {wallets.length > 0 ? (
            <div className="border-b border-grid py-1.5">
              <p className="px-4 pt-1.5 pb-1 font-mono text-[9px] tracking-[0.12em] text-text-muted uppercase">
                {wallets.length === 1 ? "Wallet" : "Wallets"}
              </p>
              {[...external, ...embedded].map((w) => (
                <button
                  key={w.address}
                  type="button"
                  role="menuitem"
                  onClick={() => copy(w.address)}
                  aria-label={`Copy ${walletLabel(w)} address ${w.address}`}
                  // `group` so the copy affordance can stay quiet until the row
                  // is pointed at: a permanent "COPY" on every row competed
                  // with the addresses themselves for attention. It also shows
                  // on focus, or the keyboard path has no affordance at all.
                  className={`group block w-full px-4 py-2 text-left transition-colors -outline-offset-2 hover:bg-surface focus-visible:bg-surface ${FOCUS}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-ui text-[12px] text-text-secondary">
                      {walletLabel(w)}
                      {w.chain ? <span className="text-text-muted"> · {w.chain}</span> : null}
                    </span>
                    <span
                      className={`flex shrink-0 items-center gap-1 font-mono text-[9px] tracking-[0.1em] uppercase transition-opacity ${
                        copied === w.address
                          ? "text-accent opacity-100"
                          : "text-text-dim opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                      }`}
                      aria-hidden
                    >
                      {copied === w.address ? "Copied" : <CopyIcon className="size-3" />}
                    </span>
                  </div>
                  <p className="truncate font-mono text-[12.5px] text-text-primary">{w.address}</p>
                </button>
              ))}
            </div>
          ) : null}

          {!email && wallets.length === 0 ? (
            <div className="border-b border-grid px-4 py-3.5">
              <p className="font-ui text-[13px] text-text-dim">No linked account details.</p>
            </div>
          ) : null}

          {/* Above sign-out, and inside the same bordered group, because it is
              a destination rather than an action on the session. */}
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => close(false)}
            className={`group flex w-full items-center gap-2.5 border-b border-grid px-4 py-3 text-left font-ui text-[13px] text-text-secondary transition-colors -outline-offset-2 hover:bg-surface hover:text-text-primary focus-visible:bg-surface focus-visible:text-text-primary ${FOCUS}`}
          >
            <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden>
              <path
                d="M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8m10.6-4.4-1.1 1.1M4.7 11.3l-1.1 1.1m0-8.8 1.1 1.1m6.6 6.6 1.1 1.1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            Settings
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close(true);
              void logout();
            }}
            className={`group flex w-full items-center gap-2.5 px-4 py-3 text-left font-ui text-[13px] text-text-secondary transition-colors -outline-offset-2 hover:bg-surface hover:text-negative focus-visible:bg-surface focus-visible:text-negative ${FOCUS}`}
          >
            <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden>
              <path
                d="M6.5 3.5h-3v9h3M9 5.5l2.5 2.5L9 10.5M11 8H5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ nav -- */

export function TopNav() {
  const pathname = usePathname() ?? "";

  return (
    // Translucent + blurred rather than opaque: content scrolling under the bar
    // stays faintly legible, which is what tells you the page moved. The solid
    // fallback keeps browsers without backdrop-filter from showing text through.
    <header className="sticky top-0 z-30 border-b border-border bg-surface supports-[backdrop-filter]:bg-surface/80 supports-[backdrop-filter]:backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4 lg:gap-6">
          {/* The brand wordmark, not set type: it is a specific blocky face with
              its own mint fill and offset shadow, taken from canopy-fe's
              /canopy.png. That source is 2000x1555 and ~83% transparent padding,
              which is why canopy-fe has to render it at h-[120px]; this copy is
              cropped to the ink so it sits correctly at navbar height. */}
          <Link
            href="/agents"
            aria-label="Canopy — home"
            className={`flex shrink-0 items-center rounded-sm ${FOCUS}`}
          >
            <Image
              src="/canopy-wordmark.png"
              alt="Canopy"
              width={1298}
              height={303}
              priority
              className="h-[21px] w-auto"
            />
          </Link>
          <nav aria-label="Primary" className="flex min-w-0 items-center gap-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.match);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-md px-3 py-1.5 font-ui text-[15px] transition-colors sm:px-3.5 ${FOCUS} ${
                    active
                      ? "bg-surface-2 font-medium text-text-primary"
                      : // Inactive links get a background on hover too, so the
                        // hit target is legible before the click, not only the
                        // label colour shifting.
                        "text-text-secondary hover:bg-surface-2/60 hover:text-text-primary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-4">
          <Link
            href="/build/new"
            className={`flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 font-ui text-[14px] font-semibold text-bg transition-colors hover:bg-accent/85 active:bg-accent/75 sm:pr-4 ${FOCUS}`}
          >
            <PlusIcon className="size-3.5 shrink-0" />
            {/* On a phone the plus alone carries it; the label stays in the
                accessibility tree so the control is still named. */}
            <span className="max-sm:sr-only">Create agent</span>
          </Link>

          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
