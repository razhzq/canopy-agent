"use client";

import Image from "next/image";
import { NotificationCentre } from "@/components/notificationCentre";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { getMyInvite, listAgents, num, type AgentRow, type PersonalInvite } from "@/lib/api";
import { usd } from "@/lib/format";

const NAV = [
  // "My agents" is the workspace — the rail plus one agent open beside it.
  // /portfolio is NOT matched here any more: it used to redirect straight back
  // to /workspace, and now it is the portfolio overview in its own right,
  // reached from the account menu. Leaving it in this match would light up
  // "My agents" while you were reading a different page.
  { label: "My agents", href: "/workspace", match: ["/workspace"] },
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

/**
 * The shareable form of an invite code.
 *
 * Built from `window.location.origin` rather than a configured base URL so it
 * is always the host the sharer is actually looking at — a link minted on a
 * preview deploy that pointed at production would send people somewhere the
 * sharer never visited. Falls back to the canonical host for the server render,
 * which never runs this in practice but must not produce "undefined/?ref=".
 */
function inviteLink(code: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://agent.canopy.finance";
  return `${origin}/?ref=${code}`;
}

/* --------------------------------------------------------- menu pieces -- */

function PortfolioIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path
        d="M2 13.2h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M2.6 10.4 6 7l2.4 2.4L13.4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AgentsIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <rect
        x="2.8"
        y="5.2"
        width="10.4"
        height="8"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M8 2.4v2.8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M6 8.6v1.4M10 8.6v1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path d="M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8m10.6-4.4-1.1 1.1M4.7 11.3l-1.1 1.1m0-8.8 1.1 1.1m6.6 6.6 1.1 1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SignOutIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path
        d="M6.5 3.5h-3v9h3M9 5.5l2.5 2.5L9 10.5M11 8H5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The label over a group of menu rows.
 *
 * The menu grew from a flat list into sections, and a section that is only a
 * gap reads as an accident of spacing. This says what the rows below it are.
 */
function MenuGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3.5 pt-2.5 pb-1 font-mono text-[8.5px] tracking-[0.14em] text-text-dim uppercase">
      {children}
    </p>
  );
}

/**
 * One destination row.
 *
 * Inset and rounded rather than full-bleed: the active row is filled, and a
 * fill that runs edge to edge inside a bordered panel reads as a new section
 * of the panel rather than as one selected item.
 *
 * `value` is the row's own number — deliberately in mono beside a UI-face
 * label, because it is a figure to compare, not prose to read.
 */
function MenuRow({
  href,
  icon,
  label,
  value,
  active,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`mx-1.5 flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors -outline-offset-2 ${FOCUS} ${
        active
          ? "bg-accent-wash text-accent"
          : "text-text-secondary hover:bg-surface hover:text-text-primary focus-visible:bg-surface focus-visible:text-text-primary"
      }`}
    >
      <span className={`shrink-0 ${active ? "text-accent" : "text-text-dim"}`}>{icon}</span>
      <span className="min-w-0 flex-1 truncate font-ui text-[12.5px] font-medium">{label}</span>
      {value ? (
        <span
          className={`tnum shrink-0 font-mono text-[11.5px] ${active ? "text-accent" : "text-text-dim"}`}
        >
          {value}
        </span>
      ) : null}
    </Link>
  );
}

/* ------------------------------------------------------------- dropdown -- */

function AccountMenu() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [invite, setInvite] = useState<PersonalInvite | null>(null);
  const [inviteFailed, setInviteFailed] = useState(false);
  const [agents, setAgents] = useState<AgentRow[] | null>(null);
  const [agentsFailed, setAgentsFailed] = useState(false);
  const pathname = usePathname() ?? "";
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetched when the menu OPENS, never on mount.
  //
  // The backend mints the code on first read, so fetching this from the navbar
  // — which is on every page — would issue a code to every visitor who never
  // opens the menu. Loading it on demand keeps "has a code" meaning "wanted
  // one". Fetched once per session and kept; a code does not change, and the
  // referral count being a few minutes stale is not worth a request per open.
  useEffect(() => {
    if (!open || !authenticated || invite || inviteFailed) return;

    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const data = await getMyInvite(token);
        if (!cancelled) setInvite(data);
      } catch (err) {
        // Silent IN THE UI. The invite row is one section of a menu whose main
        // job is signing out, and an error banner there would be louder than
        // the feature it is apologising for.
        //
        // Not silent in the console. Hiding the section and saying nothing
        // anywhere makes "the code is missing" and "the request failed"
        // indistinguishable from the outside — which costs far more time than
        // the banner would have.
        if (!cancelled) setInviteFailed(true);
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[nav] invite code unavailable — the section stays hidden.",
            err instanceof Error ? err.message : err,
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, authenticated, invite, inviteFailed, getAccessToken]);

  // The numbers on the ACCOUNT rows. Same on-open, once-per-session shape as
  // the invite fetch above, and for the same reason: the navbar is on every
  // page, and a menu nobody opens should cost nothing.
  //
  // One request, and only figures that request actually contains. Deployed
  // capital is the sum of the mandates; it is NOT portfolio equity, which
  // would need every agent's open positions marked against the live universe —
  // N+1 requests from a navbar, and the one number in this app that is
  // easiest to state wrongly. See markOpenBook in lib/perf.
  useEffect(() => {
    if (!open || !authenticated || agents || agentsFailed) return;

    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const data = await listAgents(token);
        if (!cancelled) setAgents(data.agents);
      } catch (err) {
        // Silent in the UI, loud in the console — the rows still navigate,
        // they just lose their trailing figure. Same trade as the invite
        // block: a broken count must not become a banner over a menu whose
        // main job is getting you somewhere else.
        if (!cancelled) setAgentsFailed(true);
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[nav] agent counts unavailable — the rows render without them.",
            err instanceof Error ? err.message : err,
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, authenticated, agents, agentsFailed, getAccessToken]);

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
    // Outlined rather than a filled slab: at this size a solid block is the
    // loudest thing in the bar, and it stands in for a bordered button.
    return (
      <div
        className="h-9 w-[60px] rounded-md border border-border bg-surface-2/50 sm:w-[148px]"
        aria-hidden
      />
    );
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

  // A row claims a number only once the request carrying it has landed.
  const agentCount = agents ? agents.length : null;
  // What is under mandate right now. `draft` was never deployed and
  // `stopped`/`deleted` no longer hold anything, so counting either would
  // overstate what is actually at work.
  const deployedUsd = agents
    ? agents
        .filter(
          (a) => a.status === "active" || a.status === "paused" || a.status === "liquidating",
        )
        .reduce((total, a) => total + (num(a.capital_usd) ?? 0), 0)
    : null;

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
          // The avatar and the chevron alone say "your account" on a phone;
          // the address or email is the first thing that can go when the bar
          // runs out of room.
          className={`hidden max-w-[92px] truncate text-[13px] text-text-primary sm:inline sm:max-w-[180px] ${
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

          {/* The address is the row; what kind of wallet it is sits under it.
              The other way round — label first, address as a subtitle — is how
              this read before, and it buried the one string anyone opens this
              menu to copy. */}
          {wallets.length > 0 ? (
            <div className="border-b border-grid pb-1.5">
              <MenuGroupLabel>{wallets.length === 1 ? "Wallet" : "Wallets"}</MenuGroupLabel>
              {[...external, ...embedded].map((w) => (
                <button
                  key={w.address}
                  type="button"
                  role="menuitem"
                  onClick={() => copy(w.address)}
                  aria-label={`Copy ${walletLabel(w)} address ${w.address}`}
                  // `group` so the copy affordance stays quiet until the row is
                  // pointed at: a permanent "COPY" on every row competed with
                  // the addresses themselves. It shows on focus too, or the
                  // keyboard path has no affordance at all.
                  className={`group mx-1.5 block w-[calc(100%-0.75rem)] rounded-md px-2 py-1.5 text-left transition-colors -outline-offset-2 hover:bg-surface focus-visible:bg-surface ${FOCUS}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-[12.5px] text-text-primary">
                      {w.address}
                    </span>
                    <span
                      className={`flex shrink-0 items-center gap-1 font-mono text-[9px] tracking-[0.1em] uppercase transition-opacity ${
                        copied === w.address
                          ? "text-accent opacity-100"
                          : "text-text-dim opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                      }`}
                      aria-hidden
                    >
                      {copied === w.address ? "Copied" : <CopyIcon className="size-3" />}
                    </span>
                  </div>
                  <p className="truncate pt-0.5 font-ui text-[11px] text-text-dim">
                    {walletLabel(w)}
                    {w.chain ? ` · ${w.chain}` : ""}
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          {!email && wallets.length === 0 ? (
            <div className="border-b border-grid px-4 py-3.5">
              <p className="font-ui text-[13px] text-text-dim">No linked account details.</p>
            </div>
          ) : null}

          {/* Where this account can go. The rows above say who you are; these
              are the places you own. Labelled groups rather than one flat run,
              because the menu now carries three different kinds of thing —
              identity, destinations, and a code to hand out — and undifferentiated
              rows made them read as a single list. */}
          <div className="border-b border-grid pb-1.5">
            <MenuGroupLabel>Account</MenuGroupLabel>
            <MenuRow
              href="/portfolio"
              icon={<PortfolioIcon className="size-3.5" />}
              label="Portfolio"
              // Deployed capital, NOT portfolio equity. The suffix is load-bearing:
              // a bare "$2,650" beside the word "Portfolio" reads as what the
              // portfolio is worth, and that is a different — and more expensive —
              // number. See the fetch above.
              value={deployedUsd === null ? null : `${usd(deployedUsd)} deployed`}
              active={isActive(pathname, ["/portfolio"])}
              onNavigate={() => close(false)}
            />
            <MenuRow
              href="/workspace"
              icon={<AgentsIcon className="size-3.5" />}
              label="My agents"
              value={agentCount === null ? null : String(agentCount)}
              active={isActive(pathname, ["/workspace"])}
              onNavigate={() => close(false)}
            />
          </div>

          <div className="border-b border-grid pb-1.5">
            <MenuGroupLabel>Settings</MenuGroupLabel>
            <MenuRow
              href="/settings"
              icon={<SettingsIcon className="size-3.5" />}
              // Named for what the page actually holds. "Settings" over a group
              // already labelled SETTINGS says nothing twice.
              label="Plan & notifications"
              active={isActive(pathname, ["/settings"])}
              onNavigate={() => close(false)}
            />
          </div>

          {/* Your invite code.
              Below the wallets because it is about other people, not about
              this account — and above Settings because it is a thing to copy
              here rather than a place to go. */}
          {invite ? (
            <div className="border-b border-grid py-1.5">
              <div className="flex items-baseline justify-between gap-3 px-4 pt-1.5 pb-1">
                <p className="font-mono text-[9px] tracking-[0.12em] text-text-muted uppercase">
                  Your invite code
                </p>
                {/* The budget, stated as remaining rather than used: the
                    question being asked is "can I still invite someone". */}
                <p className="font-mono text-[9px] tracking-[0.1em] text-text-dim uppercase">
                  {invite.remaining} of {invite.maxUses} left
                </p>
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => copy(invite.code)}
                disabled={invite.disabled}
                aria-label={`Copy your invite code ${invite.code}`}
                className={`group block w-full px-4 py-2 text-left transition-colors -outline-offset-2 hover:bg-surface focus-visible:bg-surface disabled:opacity-50 ${FOCUS}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-[12.5px] tracking-[0.06em] text-text-primary">
                    {invite.code}
                  </span>
                  <span
                    className={`flex shrink-0 items-center gap-1 font-mono text-[9px] tracking-[0.1em] uppercase transition-opacity ${
                      copied === invite.code
                        ? "text-accent opacity-100"
                        : "text-text-dim opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    }`}
                    aria-hidden
                  >
                    {copied === invite.code ? "Copied" : <CopyIcon className="size-3" />}
                  </span>
                </div>
              </button>

              {/* The link, not just the code. `?ref=` is captured on landing
                  and redeemed automatically, so this path costs the recipient
                  no typing and no prompt — the code above is the fallback for
                  anywhere a URL cannot go. */}
              {!invite.disabled && invite.remaining > 0 ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => copy(inviteLink(invite.code))}
                  aria-label="Copy your invite link"
                  className={`group flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors -outline-offset-2 hover:bg-surface focus-visible:bg-surface ${FOCUS}`}
                >
                  <span className="font-ui text-[12px] text-text-secondary">
                    Copy invite link
                  </span>
                  <span
                    className={`flex shrink-0 items-center gap-1 font-mono text-[9px] tracking-[0.1em] uppercase transition-opacity ${
                      copied === inviteLink(invite.code)
                        ? "text-accent opacity-100"
                        : "text-text-dim opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    }`}
                    aria-hidden
                  >
                    {copied === inviteLink(invite.code) ? (
                      "Copied"
                    ) : (
                      <CopyIcon className="size-3" />
                    )}
                  </span>
                </button>
              ) : null}

              <p className="px-4 pt-0.5 pb-1.5 font-ui text-[11.5px] leading-relaxed text-text-dim">
                {invite.disabled
                  ? "This code has been disabled."
                  : invite.remaining === 0
                    ? "You've used every invite on this code."
                    : invite.gateActive
                      ? // The honest version of "invite your friends": the code
                        // is what gets them in.
                        "Share it with someone you want inside the closed access."
                      : // Access is currently open, so the code does NOT unlock
                        // anything — it only records that they came from you.
                        // Saying "invite your friends" here would be selling a
                        // door that is already unlocked.
                        "Access is open right now, so this isn't needed to get in — it just records who you brought."}
              </p>

              {invite.uses > 0 ? (
                <p className="px-4 pb-1.5 font-ui text-[11.5px] text-text-secondary">
                  {invite.uses} {invite.uses === 1 ? "person has" : "people have"} joined on
                  it
                  {/* Names, not just a count, when there are few enough to read.
                      A bare number is a metric; a name is a memory of who you
                      actually brought. */}
                  {invite.referrals.some((r) => r.email) && invite.uses <= 3
                    ? ` — ${invite.referrals
                        .map((r) => r.email)
                        .filter(Boolean)
                        .join(", ")}`
                    : ""}
                  .
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Last, and the only row here that is not a place to go. Named for
              what it does to a wallet-backed session rather than for what it
              does to a password one: the keys stop being reachable from this
              browser. */}
          <div className="py-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close(true);
                void logout();
              }}
              className={`mx-1.5 flex w-[calc(100%-0.75rem)] items-center gap-2.5 rounded-md px-2 py-2 text-left text-negative/90 transition-colors -outline-offset-2 hover:bg-surface hover:text-negative focus-visible:bg-surface focus-visible:text-negative ${FOCUS}`}
            >
              <SignOutIcon className="size-3.5 shrink-0" />
              <span className="font-ui text-[12.5px] font-medium">Disconnect</span>
            </button>
          </div>
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
            // Hidden on a phone. The bar is 575px of content at a 375px
            // viewport and every item in it is shrink-0, so something has to
            // go; the wordmark is the only element that is decoration rather
            // than a control, and "My agents" is the home destination anyway.
            className={`hidden shrink-0 items-center rounded-sm sm:flex ${FOCUS}`}
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
                  // h-9 rather than vertical padding: every other control in
                  // the bar — Create agent, the bell, the account button — is
                  // 36px, and a nav link three pixels short of that broke the
                  // one row the eye reads across.
                  //
                  // The weight is `font-medium` in BOTH states. It used to bold
                  // only when active, which re-flowed the label a pixel or two
                  // wider and nudged its neighbour sideways on every route
                  // change; the fill and text colour already say which is live.
                  className={`flex h-9 shrink-0 items-center rounded-md px-2.5 font-ui text-[14px] font-medium transition-colors sm:px-3.5 ${FOCUS} ${
                    active
                      ? "bg-surface-2 text-text-primary"
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
            // Brightness rather than opacity for the hover. Fading the accent
            // toward an almost-black background darkens it, so the primary
            // action of the whole app dimmed on hover and read as disabled;
            // lifting it is the response the pointer is asking for.
            className={`flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 font-ui text-[14px] font-semibold text-bg transition-[filter,background-color] hover:brightness-110 active:brightness-95 sm:pr-4 ${FOCUS}`}
          >
            <PlusIcon className="size-3.5 shrink-0" />
            {/* On a phone the plus alone carries it; the label stays in the
                accessibility tree so the control is still named. */}
            <span className="max-sm:sr-only">Create agent</span>
          </Link>

          {/* Between "create" and the account: notifications are about work
              already in flight, which sits nearer identity than action. */}
          <NotificationCentre />

          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
