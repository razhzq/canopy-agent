"use client";

import Image from "next/image";
import { FOCUS, POPOVER } from "@/components/kit";
import { DepositModal, WithdrawModal } from "@/components/walletModals";
import { UsernameModal } from "@/components/usernameModal";
import { readChainFunding, type ChainFunding } from "@/lib/chainBalance";
import { useUsername } from "@/lib/useUsername";
import { personalWallet } from "@/lib/wallets";
import { NotificationCentre } from "@/components/notificationCentre";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getClaimedWallets,
  getMyInvite,
  listAgents,
  num,
  type AgentRow,
  type PersonalInvite,
} from "@/lib/api";
import { usd } from "@/lib/format";
import { LanguageSwitcher } from "@/components/languageSwitcher";
import { useT, type TranslationKey } from "@/lib/i18n";

const NAV = [
  // PORTFOLIO IS THE OWNER'S HOME, and it took this slot from "My agents".
  //
  // The two pages had drifted into answering one question. `MyAgents` said in
  // its own docblock that it existed to answer "what is all of my capital doing
  // right now" — which is the portfolio question, and /portfolio answers it
  // with an aggregate curve, where the capital sits, the open book and what
  // settled. Both then listed every agent underneath.
  //
  // What only /workspace had was operational: the count of agents wanting you,
  // and pause/resume. Neither needed a page. The first belongs in the
  // notification centre, which already carries `proposal`, `breach`,
  // `risk_hold` and `state_change` and has an unread badge on both platforms;
  // the second is now the status badge on each portfolio row.
  //
  // It also settles a disagreement between the two platforms: the mobile tab
  // bar's Profile tab has pointed at /portfolio all along, so a desktop bar
  // pointing at /workspace sent the same person to a different home depending
  // on what they opened it with.
  //
  // /workspace still matches, because /workspace/:id is the agent page and
  // reading one should light up the section it belongs to.
  //
  // The labels are dictionary keys, not text: this table is module-level and
  // therefore evaluated once, outside any component, where no hook can reach.
  // Resolving the key at render is what lets the bar re-label itself when the
  // language changes instead of freezing whatever locale loaded first.
  {
    key: "nav_portfolio" as TranslationKey,
    href: "/portfolio",
    match: ["/portfolio", "/workspace"],
  },
  {
    key: "nav_explore" as TranslationKey,
    href: "/agents",
    match: ["/agents", "/deploy"],
  },
  // Activity is NOT in the desktop bar. The route still exists and still
  // resolves — the mobile tab bar links to it, and so does anything else
  // holding the URL — it simply no longer takes a slot in the top bar.
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
/* ------------------------------------------------------------- accounts -- */

interface LinkedWallet {
  address: string;
  /** "privy" for the wallet Canopy created; anything else is the user's own. */
  client: string;
  chain: string;
  /**
   * Privy's creation order. The wallet made at sign-in is index 0, which is
   * what identifies the PERSONAL wallet among several embedded ones — see
   * `personalWallet`.
   */
  index: number | null;
  /**
   * Whether a signer has been attached. Canopy's key quorum is the only thing
   * that ever adds one, so `true` means "this is an agent's wallet" — known on
   * the client, without asking the backend anything.
   */
  delegated: boolean;
}

/**
 * Reads what we can display from Privy's user object.
 *
 * The linkedAccounts union is wide and version-sensitive, so this narrows by
 * checking the shape rather than casting to Privy's types — a field that
 * disappears in an SDK bump then degrades to "not shown" instead of throwing
 * inside the navbar, which is on every page.
 */
export function readAccounts(user: unknown): {
  email: string | null;
  wallets: LinkedWallet[];
} {
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
        client:
          typeof a.walletClientType === "string"
            ? a.walletClientType
            : "unknown",
        chain: typeof a.chainType === "string" ? a.chainType : "",
        index: typeof a.walletIndex === "number" ? a.walletIndex : null,
        delegated: a.delegated === true,
      });
    }
  }
  return { email, wallets };
}

function short(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address;
}

/**
 * What to call a wallet in the menu.
 *
 * Takes `t` rather than calling `useT()` itself: this runs inside `.map()` and
 * inside `aria-label` expressions, neither of which is a component. Only the
 * Canopy-created wallet has a translatable name — a third-party wallet's is a
 * brand ("Phantom"), and brands are not translated.
 */
function walletLabel(
  w: LinkedWallet,
  t: (k: TranslationKey) => string,
): string {
  if (w.client === "privy") return t("account_wallet_canopy");
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
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-ui font-medium text-text-primary ring-1 ring-border"
      style={{ width: size, height: size, fontSize: Math.max(size * 0.46, 9) }}
    >
      {initialOf(label)}
    </span>
  );
}

function CopyIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <rect
        x="5.5"
        y="5.5"
        width="7"
        height="7"
        rx="1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
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
    typeof window !== "undefined"
      ? window.location.origin
      : "https://agent.canopy.finance";
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

function SettingsIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
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
    <p className="px-4 pt-3 pb-1 font-ui text-[11.5px] text-text-muted">
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
      // `mx-1.5` + `px-2.5` = 16px, which is where every full-bleed row in this
      // panel starts its text. The two row shapes are deliberate — a pill that
      // lights up for a destination, an edge-to-edge band for a wallet — but
      // they have to begin on the same line or the panel reads as two lists
      // pasted together.
      className={`mx-1.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors -outline-offset-2 ${FOCUS} ${
        active
          ? "bg-surface-2 text-text-primary"
          : "text-text-secondary hover:bg-surface-2 hover:text-text-primary focus-visible:bg-surface-2 focus-visible:text-text-primary"
      }`}
    >
      <span className={`shrink-0 ${active ? "text-text-primary" : "text-text-dim"}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-ui text-[12.5px] font-medium">
        {label}
      </span>
      {value ? (
        <span
          className={`tnum shrink-0 font-mono text-[11.5px] ${active ? "text-text-primary" : "text-text-dim"}`}
        >
          {value}
        </span>
      ) : null}
    </Link>
  );
}

/* ------------------------------------------------------------- dropdown -- */

function AccountMenu() {
  const { ready, authenticated, user, login, logout, getAccessToken } =
    usePrivy();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [invite, setInvite] = useState<PersonalInvite | null>(null);
  const [inviteFailed, setInviteFailed] = useState(false);
  const [agents, setAgents] = useState<AgentRow[] | null>(null);
  const [agentsFailed, setAgentsFailed] = useState(false);
  // Addresses registered to an agent. Used to keep agent wallets OUT of this
  // menu — they belong on the agent's own page.
  const [agentAddrs, setAgentAddrs] = useState<ReadonlySet<string>>(new Set());
  // Three states, not two. A failed read and an empty wallet are different
  // facts, and collapsing them prints "$0.00" over funds the app simply could
  // not see — the exact mistake lib/chainBalance was written to avoid.
  const [balance, setBalance] = useState<
    { at: "loading" } | { at: "ready"; funds: ChainFunding } | { at: "failed" }
  >({ at: "loading" });
  const [modal, setModal] = useState<"deposit" | "withdraw" | null>(null);
  const [balanceNonce, setBalanceNonce] = useState(0);
  const [namingOpen, setNamingOpen] = useState(false);
  const { username, loaded: usernameLoaded } = useUsername();
  const pathname = usePathname() ?? "";
  const t = useT();

  // Derived up here, not below the early returns, because the balance effect
  // depends on the address. Pure reads off the Privy user object — safe to run
  // before `ready`, when they simply come back empty.
  const { email, wallets } = readAccounts(user);
  const mine = personalWallet(wallets, agentAddrs);
  const personalWalletAddress = mine?.address ?? null;
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
        // Settled, not all: the counts and the wallet filter fail
        // independently. Losing the agent-wallet list would otherwise blank
        // the row counts, and losing the counts would put agent wallets back
        // in the menu.
        const [list, claimed] = await Promise.allSettled([
          listAgents(token),
          getClaimedWallets(token),
        ]);
        if (cancelled) return;
        if (list.status === "fulfilled") setAgents(list.value.agents);
        else throw list.reason;
        if (claimed.status === "fulfilled")
          setAgentAddrs(new Set(claimed.value.addresses));
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

  // The balance, read from the chain rather than from our records.
  //
  // Keyed to the address, so it refetches if the resolved personal wallet
  // changes underneath — which it does once `getClaimedWallets` lands and rules
  // one out. Read on every open, not once: a balance is the one number here
  // that is stale the moment someone deposits.
  const walletAddress = personalWalletAddress;
  useEffect(() => {
    if (!open || !walletAddress) return;
    let cancelled = false;
    setBalance({ at: "loading" });
    void readChainFunding(walletAddress)
      .then((funds) => !cancelled && setBalance({ at: "ready", funds }))
      .catch((err) => {
        if (cancelled) return;
        setBalance({ at: "failed" });
        // Silent in the UI beyond the failed state, loud here. A balance that
        // will not load is worth a line in the console — this went unnoticed
        // precisely because the failure was swallowed.
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[nav] balance read failed",
            err instanceof Error ? err.message : err,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, walletAddress, balanceNonce]);

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
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
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
          if (ref.current && !ref.current.contains(document.activeElement))
            setOpen(false);
        }, 0);
        return;
      }
      if (
        e.key !== "ArrowDown" &&
        e.key !== "ArrowUp" &&
        e.key !== "Home" &&
        e.key !== "End"
      ) {
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
        className="h-10 w-[60px] rounded-full border border-border bg-surface/50 sm:w-[148px]"
        aria-hidden
      />
    );
  }

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={() => login()}
        className={`h-10 rounded-full border border-border px-5 font-ui text-[14px] font-medium text-text-primary transition-colors hover:border-grid-strong ${FOCUS}`}
      >
        {t("nav_sign_in")}
      </button>
    );
  }

  const external = wallets.filter((w) => w.client !== "privy");
  // One embedded wallet — the person's own. Agent wallets are deliberately not
  // here; see `personalWallet`. External wallets the user linked themselves are
  // theirs by definition and always shown.

  // What the button shows. An external wallet is the more identifying thing
  // for someone who signed in that way; email is the identity for everyone
  // else. Falls back to the Canopy-created wallet so the button is never blank.
  // The username is the identity once there is one. Email is what a person
  // signed in WITH, not what they are called — and it is the thing most people
  // would rather not have on screen in a shared window.
  const primary =
    username ??
    (external.length > 0
      ? short(external[0].address)
      : (email ?? (mine ? short(mine.address) : t("account_fallback"))));
  // An address is set in mono because its characters have to be comparable
  // digit by digit; an email is prose and reads better in the UI face.
  const primaryIsAddress = !username && (external.length > 0 || !email);
  // Which of the two ways in this was. Named in the menu header so the account
  // is identifiable without expanding a wallet row.
  const method = email
    ? t("account_method_email")
    : external.length > 0
      ? walletLabel(external[0], t)
      : t("account_method_wallet");

  // A row claims a number only once the request carrying it has landed.
  // What is under mandate right now. `draft` was never deployed and
  // `stopped`/`deleted` no longer hold anything, so counting either would
  // overstate what is actually at work.
  const deployedUsd = agents
    ? agents
        .filter(
          (a) =>
            a.status === "active" ||
            a.status === "paused" ||
            a.status === "liquidating",
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
    // Desktop only, and only ONCE SIGNED IN. The Profile tab carries all of
    // this below lg. The signed-out branches above deliberately stay visible on
    // every width: hiding those would leave a phone with no way to sign in at
    // all, since the tab bar itself renders nothing without a session.
    <div ref={ref} className="relative max-lg:hidden">
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
        aria-label={t("account_aria", { name: primary })}
        className={`flex h-10 items-center gap-2.5 rounded-full border pr-3 pl-1.5 transition-colors ${FOCUS} ${
          open ? "border-grid-strong bg-surface" : "border-border hover:border-grid-strong"
        }`}
      >
        <Avatar label={username ?? email ?? primary} size={28} />
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
        {copied ? t("account_address_copied") : ""}
      </span>

      {open ? (
        <div
          role="menu"
          aria-label={t("account_menu_aria")}
          // Chrome from the kit, geometry from here: what a popover LOOKS like
          // is a system decision, where this one hangs and how wide it is are
          // this menu's own. Splitting them is what stops the next overlay
          // inventing an eighth shadow.
          className={`absolute right-0 z-40 mt-2.5 w-[300px] origin-top-right animate-[menu-enter_120ms_ease-out] sm:w-[332px] ${POPOVER}`}
        >
          {/* Identity, stated once at the top. The rows below are things to DO
              with the account; this is the answer to "whose account is this",
              which the old header ("Signed in") never actually gave. */}
          <div className="flex items-center gap-3 border-b border-grid px-4 py-4">
            <Avatar label={username ?? email ?? primary} size={36} />
            <div className="min-w-0">
              <p
                className={`truncate text-[14px] font-medium text-text-primary ${
                  primaryIsAddress ? "font-mono" : "font-ui"
                }`}
              >
                {primary}
              </p>
              {/* The handle, where "Signed in · Email" used to be. That line
                  named the login METHOD, which is a fact about the door rather
                  than about the person — and it was the only thing here that
                  never changed no matter who was looking at it. */}
              {username ? (
                <p className="truncate pt-0.5 font-mono text-[11px] text-text-dim">
                  @{username}
                </p>
              ) : usernameLoaded ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setNamingOpen(true);
                    setOpen(false);
                  }}
                  className={`-mx-1 mt-0.5 rounded px-1 py-0.5 text-left font-ui text-[12px] text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline ${FOCUS}`}
                >
                  {t("account_set_username")}
                </button>
              ) : (
                // Neither name nor prompt until the profile has been read —
                // flashing "set a username" at someone who has one is worse
                // than a beat of nothing.
                <p className="pt-0.5 font-ui text-[11.5px] text-text-dim">
                  {t("account_signed_in_via", { method })}
                </p>
              )}
            </div>
          </div>

          {/* WALLETS THE PERSON BROUGHT, and only those. The Canopy-created one
              used to lead this list and then have its balance stated again in
              the block below — two sections, one wallet, and the address
              printed twice within a 320px panel.
              It now sits with its own balance, which is where someone looking
              for either of them expects to find the other. A linked external
              wallet has no balance here and nothing to do from this menu, so it
              stays a plain address to copy.

              The address is the row; what kind of wallet it is sits under it.
              The other way round — label first, address as a subtitle — is how
              this read before, and it buried the one string anyone opens this
              menu to copy. */}
          {external.length > 0 ? (
            <div className="border-b border-grid pb-1.5">
              <MenuGroupLabel>
                {t(
                  external.length === 1
                    ? "account_your_wallet"
                    : "account_your_wallets",
                )}
              </MenuGroupLabel>
              {external.map((w) => (
                <button
                  key={w.address}
                  type="button"
                  role="menuitem"
                  onClick={() => copy(w.address)}
                  aria-label={t("account_copy_wallet_aria", {
                    label: walletLabel(w, t),
                    address: w.address,
                  })}
                  // `group` so the copy affordance stays quiet until the row is
                  // pointed at: a permanent "COPY" on every row competed with
                  // the addresses themselves. It shows on focus too, or the
                  // keyboard path has no affordance at all.
                  className={`group mx-1.5 block w-[calc(100%-0.75rem)] rounded-lg px-2.5 py-2 text-left transition-colors -outline-offset-2 hover:bg-surface-2 focus-visible:bg-surface-2 ${FOCUS}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-[12.5px] text-text-primary">
                      {w.address}
                    </span>
                    <span
                      className={`flex shrink-0 items-center gap-1 font-ui text-[11px] transition-opacity ${
                        copied === w.address
                          ? "text-accent opacity-100"
                          : "text-text-dim opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                      }`}
                      aria-hidden
                    >
                      {copied === w.address ? (
                        t("common_copied")
                      ) : (
                        <CopyIcon className="size-3" />
                      )}
                    </span>
                  </div>
                  <p className="truncate pt-0.5 font-ui text-[11px] text-text-dim">
                    {walletLabel(w, t)}
                    {w.chain ? ` · ${w.chain}` : ""}
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          {/* Balance, then the two things you can do with it. Read from the
              chain rather than from our records — "has my deposit arrived" is a
              question about the chain, and answering it from a database is how
              a UI tells someone their money has not landed when it has. */}
          {mine ? (
            <div className="border-b border-grid px-4 pt-3 pb-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-ui text-[11.5px] text-text-muted">
                  {t("account_balance")}
                </span>
                {balance.at === "ready" ? (
                  <span className="tnum font-mono text-[11px] text-text-dim">
                    {balance.funds.sol.toLocaleString("en-US", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 4,
                    })}{" "}
                    SOL
                  </span>
                ) : null}
              </div>

              {balance.at === "failed" ? (
                // Never a zero here. The wallet may be full; this only knows
                // that the chain could not be reached.
                <div className="flex items-baseline gap-2 pt-1.5">
                  <span className="font-mono text-[13px] text-text-dim">
                    {t("account_balance_failed")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBalanceNonce((n) => n + 1)}
                    className="font-ui text-[12px] text-text-secondary underline-offset-4 hover:underline"
                  >
                    {t("common_retry")}
                  </button>
                </div>
              ) : (
                <p className="flex items-baseline gap-1.5 pt-1.5">
                  <span className="tnum font-mono text-[26px] leading-none tracking-[-0.02em] text-text-primary">
                    {balance.at === "ready" ? (
                      `$${balance.funds.usdc.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    ) : (
                      // A dash only while the read is in flight — brief, and
                      // never mistaken for a balance.
                      <span className="text-text-dim">—</span>
                    )}
                  </span>
                  <span className="font-ui text-[12px] text-text-dim">
                    USDC
                  </span>
                </p>
              )}

              {/* THE ADDRESS, UNDER THE BALANCE IT BELONGS TO.
                  Quiet on purpose: it is no longer a section of its own, and
                  the full-size treatment it had was competing with the figure
                  above it. Still copyable in one click, because "what is my
                  address" is asked far more often than it is acted on — and the
                  answer being one modal away is fine for depositing, not for
                  pasting into a chat. */}
              <button
                type="button"
                role="menuitem"
                onClick={() => copy(mine.address)}
                aria-label={t("account_copy_wallet_aria", {
                  label: walletLabel(mine, t),
                  address: mine.address,
                })}
                className={`group -mx-1 mt-2.5 flex w-[calc(100%+0.5rem)] items-center justify-between gap-3 rounded-md px-1 py-1 text-left transition-colors -outline-offset-2 hover:bg-surface-2 focus-visible:bg-surface-2 ${FOCUS}`}
              >
                <span className="truncate font-mono text-[11px] text-text-dim">
                  {mine.address}
                </span>
                <span
                  className={`flex shrink-0 items-center gap-1 font-ui text-[11px] transition-opacity ${
                    copied === mine.address
                      ? "text-accent opacity-100"
                      : "text-text-dim opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                  }`}
                  aria-hidden
                >
                  {copied === mine.address ? (
                    t("common_copied")
                  ) : (
                    <CopyIcon className="size-3" />
                  )}
                </span>
              </button>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setModal("deposit");
                    setOpen(false);
                  }}
                  className={`h-9 flex-1 rounded-full bg-white font-ui text-[13px] font-medium text-bg transition-transform hover:-translate-y-px ${FOCUS}`}
                >
                  {t("account_deposit")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setModal("withdraw");
                    setOpen(false);
                  }}
                  className={`h-9 flex-1 rounded-full border border-border font-ui text-[13px] font-medium text-text-primary transition-colors hover:border-grid-strong ${FOCUS}`}
                >
                  {t("account_withdraw")}
                </button>
              </div>
            </div>
          ) : null}

          {/* Nothing to show at all: no email, no linked wallet, and no Canopy
              one yet. `mine` has to be checked separately now that it has its
              own block rather than being the tail of a combined list. */}
          {!email && external.length === 0 && !mine ? (
            <div className="border-b border-grid px-4 py-3.5">
              <p className="font-ui text-[13px] text-text-dim">
                {t("account_no_details")}
              </p>
            </div>
          ) : null}

          {/* Where this account can go. The rows above say who you are; these
              are the places you own. Labelled groups rather than one flat run,
              because the menu now carries three different kinds of thing —
              identity, destinations, and a code to hand out — and undifferentiated
              rows made them read as a single list. */}
          <div className="border-b border-grid pb-1.5">
            <MenuGroupLabel>{t("account_group_account")}</MenuGroupLabel>
            <MenuRow
              href="/portfolio"
              icon={<PortfolioIcon className="size-3.5" />}
              label={t("account_row_portfolio")}
              // Deployed capital, NOT portfolio equity. The suffix is load-bearing:
              // a bare "$2,650" beside the word "Portfolio" reads as what the
              // portfolio is worth, and that is a different — and more expensive —
              // number. See the fetch above.
              value={
                deployedUsd === null
                  ? null
                  : t("account_row_deployed", { amount: usd(deployedUsd) })
              }
              // Matches /workspace too, now that it redirects here and that the
              // bar's own item does the same. The row for "My agents" is gone
              // from this group: it pointed at a redirect back to this page,
              // and two rows to one destination is a menu arguing with itself.
              active={isActive(pathname, ["/portfolio", "/workspace"])}
              onNavigate={() => close(false)}
            />
          </div>

          <div className="border-b border-grid pb-1.5">
            <MenuGroupLabel>{t("account_group_settings")}</MenuGroupLabel>
            <MenuRow
              href="/settings"
              icon={<SettingsIcon className="size-3.5" />}
              // Named for what the page actually holds. "Settings" over a group
              // already labelled SETTINGS says nothing twice.
              label={t("account_row_settings")}
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
                <p className="font-ui text-[11.5px] text-text-muted">
                  {t("invite_your_code")}
                </p>
                {/* The budget, stated as remaining rather than used: the
                    question being asked is "can I still invite someone". */}
                <p className="tnum font-mono text-[11px] text-text-dim">
                  {t("invite_remaining", {
                    remaining: invite.remaining,
                    max: invite.maxUses,
                  })}
                </p>
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => copy(invite.code)}
                disabled={invite.disabled}
                aria-label={t("invite_copy_code_aria", { code: invite.code })}
                className={`group block w-full px-4 py-2 text-left transition-colors -outline-offset-2 hover:bg-surface-2 focus-visible:bg-surface-2 disabled:opacity-50 ${FOCUS}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-[12.5px] tracking-[0.06em] text-text-primary">
                    {invite.code}
                  </span>
                  <span
                    className={`flex shrink-0 items-center gap-1 font-ui text-[11px] transition-opacity ${
                      copied === invite.code
                        ? "text-accent opacity-100"
                        : "text-text-dim opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    }`}
                    aria-hidden
                  >
                    {copied === invite.code ? (
                      t("common_copied")
                    ) : (
                      <CopyIcon className="size-3" />
                    )}
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
                  aria-label={t("invite_copy_link_aria")}
                  className={`group flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors -outline-offset-2 hover:bg-surface-2 focus-visible:bg-surface-2 ${FOCUS}`}
                >
                  <span className="font-ui text-[12px] text-text-secondary">
                    {t("invite_copy_link")}
                  </span>
                  <span
                    className={`flex shrink-0 items-center gap-1 font-ui text-[11px] transition-opacity ${
                      copied === inviteLink(invite.code)
                        ? "text-accent opacity-100"
                        : "text-text-dim opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    }`}
                    aria-hidden
                  >
                    {copied === inviteLink(invite.code) ? (
                      t("common_copied")
                    ) : (
                      <CopyIcon className="size-3" />
                    )}
                  </span>
                </button>
              ) : null}

              <p className="px-4 pt-0.5 pb-1.5 font-ui text-[11.5px] leading-relaxed text-text-dim">
                {t(
                  invite.disabled
                    ? "invite_note_disabled"
                    : invite.remaining === 0
                      ? "invite_note_exhausted"
                      : invite.gateActive
                        ? // The honest version of "invite your friends": the
                          // code is what gets them in.
                          "invite_note_gated"
                        : // Access is currently open, so the code does NOT
                          // unlock anything — it only records that they came
                          // from you. Saying "invite your friends" here would
                          // be selling a door that is already unlocked.
                          "invite_note_open",
                )}
              </p>

              {invite.uses > 0
                ? (() => {
                    /* Names, not just a count, when there are few enough to
                       read. A bare number is a metric; a name is a memory of
                       who you actually brought.

                       Built as one complete sentence per case rather than
                       assembled from "{n}" + "people have" + "joined on it":
                       Chinese counts with a measure word and puts the verb
                       last, so there is no arrangement of those fragments that
                       is a sentence in both languages. */
                    const names = invite.referrals
                      .map((r) => r.email)
                      .filter(Boolean)
                      .join("、");
                    const named = names.length > 0 && invite.uses <= 3;
                    const one = invite.uses === 1;
                    return (
                      <p className="px-4 pb-1.5 font-ui text-[11.5px] text-text-secondary">
                        {named
                          ? t(
                              one
                                ? "invite_joined_one_named"
                                : "invite_joined_many_named",
                              {
                                count: invite.uses,
                                names,
                              },
                            )
                          : t(
                              one ? "invite_joined_one" : "invite_joined_many",
                              {
                                count: invite.uses,
                              },
                            )}
                      </p>
                    );
                  })()
                : null}
            </div>
          ) : null}

          {/* Last, and the only row here that is not a place to go.
              "Sign out", not "Disconnect". The rename undoes a bad call: the
              old label named a WALLET action, and `privyConfig` sets
              `loginMethods: ["email"]` — nobody connects a wallet to get in
              here, Privy mints one afterwards. Worse, "Disconnect" means
              "unlink my wallet" everywhere else in crypto, and this does the
              opposite of that: the wallets are permanent and stay on the
              account. Reading it beside a balance, it looked like a button that
              detaches the wallet holding the money. */}
          <div className="py-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close(true);
                void logout();
              }}
              className={`mx-1.5 flex w-[calc(100%-0.75rem)] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-text-secondary transition-colors -outline-offset-2 hover:bg-surface-2 hover:text-negative focus-visible:bg-surface-2 focus-visible:text-negative ${FOCUS}`}
            >
              <SignOutIcon className="size-3.5 shrink-0" />
              <span className="font-ui text-[12.5px] font-medium">
                {t("account_sign_out")}
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Rendered as a sibling of the menu, not inside it: the menu closes when
          a modal opens, and a dialog that unmounts with its trigger would shut
          mid-transfer. */}
      {modal === "deposit" && personalWalletAddress ? (
        <DepositModal
          address={personalWalletAddress}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal === "withdraw" && personalWalletAddress ? (
        <WithdrawModal
          address={personalWalletAddress}
          onClose={() => setModal(null)}
        />
      ) : null}
      {namingOpen ? (
        <UsernameModal onClose={() => setNamingOpen(false)} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ nav -- */

/**
 * Whether the page has moved at all.
 *
 * rAF-throttled and passive, per the motion rule: a scroll handler that does
 * work on every event is the one thing on a page guaranteed to run during the
 * frames a reader is most likely to notice jank.
 *
 * The threshold is one pixel, not a distance. This answers "is anything behind
 * the bar", and a page scrolled by two pixels has content under it exactly as
 * much as one scrolled by two hundred.
 */
function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > 0);
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(read);
    };

    // Once on mount: a restored scroll position or a deep link lands mid-page
    // without ever firing an event, and the bar would sit borderless over
    // content it is plainly covering.
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return scrolled;
}

export function TopNav() {
  const pathname = usePathname() ?? "";
  const t = useT();
  const scrolled = useScrolled();

  return (
    // Translucent + blurred rather than opaque: content scrolling under the bar
    // stays faintly legible, which is what tells you the page moved. The solid
    // fallback keeps browsers without backdrop-filter from showing text through.
    //
    // THE HAIRLINE ARRIVES WHEN IT HAS WORK TO DO. The design principles ask
    // chrome not to assert itself — a floating panel with no hard border — and
    // this app cannot take that literally, because it is flat by construction:
    // there is not one shadow in the stylesheet, and separation is carried by
    // hairlines everywhere. So the rule is honoured the other way round. At the
    // top of a page there is nothing behind the bar and the line divides
    // nothing; the moment content passes under it, the line is what says so.
    //
    // The border is always PRESENT and only changes colour, so the bar's height
    // never changes and the page beneath it cannot shift by a pixel as you
    // begin to scroll.
    <header
      className={`sticky top-0 z-30 border-b bg-bg transition-colors duration-200 supports-[backdrop-filter]:bg-bg/85 supports-[backdrop-filter]:backdrop-blur-md ${
        scrolled ? "border-grid" : "border-transparent"
      }`}
    >
      <div className="relative flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4 lg:gap-6">
          {/* The brand wordmark, not set type: it is a specific blocky face with
              its own mint fill and offset shadow, taken from canopy-fe's
              /canopy.png. That source is 2000x1555 and ~83% transparent padding,
              which is why canopy-fe has to render it at h-[120px]; this copy is
              cropped to the ink so it sits correctly at navbar height. */}
          <Link
            href="/agents"
            aria-label={t("nav_home_aria")}
            // Shown on a phone again. It used to be dropped there because the
            // bar was 575px of shrink-0 content at a 375px viewport and the
            // wordmark was the only thing in it that was not a control. The
            // primary links have since moved to the bottom tab bar, which frees
            // the room — and left the mobile bar with no brand on it at all.
            className={`flex shrink-0 items-center rounded-sm ${FOCUS}`}
          >
            <Image
              src="/canopy-wordmark.png"
              alt="Canopy"
              width={1298}
              height={303}
              priority
              className="h-[24px] w-auto"
            />
          </Link>
          {/* Desktop only. Below lg the bottom tab bar owns navigation, and
              these links were a second set of destinations competing with it
              for the narrowest bar in the app. */}
          {/* Centred in the bar, as the landing's nav is, so the two bars read
              as one product. Absolute so the left and right groups can grow
              without pushing it off centre. */}
          <nav
            aria-label={t("nav_primary_aria")}
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex"
          >
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
                  // No fill in either state: the current page is the white
                  // label, the others are quiet. Colour is a signal, and
                  // "where am I" is carried by weight of tone alone.
                  className={`flex h-9 shrink-0 items-center rounded-full px-1 font-ui text-[15px] font-medium transition-colors ${FOCUS} ${
                    active ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-4">
          <Link
            href="/build/new"
            // WASH AT REST, FILLED ON HOVER — the colour model every primary in
            // the app now uses (kit.tsx, PRIMARY). It was solid accent at rest,
            // which is the heaviest treatment available, applied permanently to
            // a control that is present on every screen. Nothing could outrank
            // it, including the thing the current page is actually about.
            //
            // The typography stays a nav's — 14px ui semibold, not the kit's
            // 10px mono — because this is a destination, not a data surface.
            // The rule being borrowed is about WEIGHT, not about type.
            // WHITE ON DARK: the primary on a dark ground is the white pill,
            // never green (DESIGN_PRINCIPLES.md §2). It is the one filled
            // control in the bar.
            className={`flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 font-ui text-[14px] font-medium text-bg transition-transform hover:-translate-y-px sm:pr-4 ${FOCUS}`}
          >
            <PlusIcon className="size-3.5 shrink-0" />
            {/* On a phone the plus alone carries it; the label stays in the
                accessibility tree so the control is still named. */}
            <span className="max-sm:sr-only">{t("nav_create_agent")}</span>
          </Link>

          {/* At every width, including a phone.
              It sat on the Profile tab below lg, which put the one control a
              reader needs BEFORE they can read anything two taps behind a page
              whose own label they could not read. The top bar is the tightest
              row in the app and this earns its slot there: it is the only
              control on screen that is worth nothing to someone who already
              understands the language, and everything to someone who does not.

              The room comes from "Create agent", which is already icon-only
              below sm, and from the bell and account menu, which are desktop
              only — so on a phone this sits between a 36px plus button and the
              wordmark rather than competing with a full row. */}
          <LanguageSwitcher />

          {/* Between "create" and the account: notifications are about work
              already in flight, which sits nearer identity than action.

              Desktop only — the bottom tab bar carries Alerts below lg, and a
              bell in the top corner is a duplicate of it that a thumb cannot
              comfortably reach anyway. */}
          <div className="hidden lg:block">
            <NotificationCentre />
          </div>

          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
