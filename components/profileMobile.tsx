"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy, useUser } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/solana";
import {
  Bell,
  ChevronDown,
  Copy,
  History,
  LogOut,
  Settings,
} from "lucide-react";

import { EquityCurve } from "@/components/charts";
import {
  Avatar,
  BODY,
  FOCUS,
  LABEL,
  PRIMARY,
  QUIET,
  SECONDARY,
  SEGMENT_ITEM,
  SEGMENT_OFF,
  SEGMENT_ON,
  SEGMENT_TRACK,
  SectionLabel,
} from "@/components/kit";
import { readAccounts } from "@/components/nav";
import { UsernameModal } from "@/components/usernameModal";
import { DepositModal, WithdrawModal } from "@/components/walletModals";
import { readChainFunding, type ChainFunding } from "@/lib/chainBalance";
import { usePersonalWallet } from "@/lib/usePersonalWallet";
import { useUsername } from "@/lib/useUsername";
import { movedOverUsd } from "@/lib/perf";
import { getMyInvite, num, type PersonalInvite } from "@/lib/api";
import type { Holding, Totals } from "@/components/portfolioOverview";
import { useT } from "@/lib/i18n";

/**
 * The profile, below `lg`.
 *
 * ONE SCREEN DOING THE ACCOUNT MENU'S JOB. The top bar's account menu is
 * desktop-only, and the Profile tab is what replaces it on a phone — so every
 * fact that menu states has to be stated here too: who is signed in, what the
 * main wallet holds ON THE CHAIN, its address to copy, the two ways money
 * moves, the invite code, and the way out. The first version of this screen
 * carried the equity curve and the agents but none of that, which left a phone
 * with no way to see a deposit land or to invite anyone.
 *
 * Built on the kit rather than to a wireframe. The earlier version set its own
 * radii and weights per element; this one takes the same segment, label, and
 * button classes the desktop uses, so the two platforms read as one product.
 */

const RANGES = [
  { key: "24H", ms: 86_400_000 },
  { key: "7D", ms: 7 * 86_400_000 },
  { key: "30D", ms: 30 * 86_400_000 },
  { key: "ALL", ms: Infinity },
] as const;

function short(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address;
}

/** See `inviteLink` in nav.tsx — the host the sharer is actually looking at. */
function inviteLink(code: string): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://agent.canopy.finance";
  return `${origin}/?ref=${code}`;
}

export function ProfileMobile({
  holdings,
  totals,
}: {
  holdings: Holding[];
  totals: Totals;
}) {
  const { logout, user, authenticated, getAccessToken } = usePrivy();
  const { refreshUser } = useUser();
  const { createWallet } = useCreateWallet();
  const t = useT();
  const { username, loaded: nameLoaded } = useUsername();
  const wallet = usePersonalWallet();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("24H");
  const [modal, setModal] = useState<
    "deposit" | "withdraw" | "username" | null
  >(null);
  const [live, setLive] = useState(true);
  const [klass, setKlass] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [creatingWallet, setCreatingWallet] = useState(false);

  // Pure reads off the Privy user object, the same narrowing the nav does.
  const { email } = readAccounts(user);

  /* -------------------------------------------------------- balance -- */

  // Three states, not two — see the nav. A failed read is not an empty wallet.
  const [balance, setBalance] = useState<
    { at: "loading" } | { at: "ready"; funds: ChainFunding } | { at: "failed" }
  >({ at: "loading" });
  const [balanceNonce, setBalanceNonce] = useState(0);

  // Read on mount and again whenever a transfer dialog closes: the nav reads
  // when its menu opens, and opening this tab is the phone's equivalent.
  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    setBalance({ at: "loading" });
    void readChainFunding(wallet)
      .then((funds) => !cancelled && setBalance({ at: "ready", funds }))
      .catch((err) => {
        if (cancelled) return;
        setBalance({ at: "failed" });
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[profile] balance read failed",
            err instanceof Error ? err.message : err,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [wallet, balanceNonce]);

  const closeTransfer = useCallback(() => {
    setModal(null);
    setBalanceNonce((n) => n + 1);
  }, []);

  /* --------------------------------------------------------- invite -- */

  // Fetched on DISCLOSURE, never on mount. The backend mints a code on first
  // read, and this tab is on the way to every agent a phone user owns —
  // minting on view would hand a code to everyone who never wanted one. The
  // nav fetches when its menu opens; opening this row is the same gesture.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<PersonalInvite | null>(null);
  const [inviteFailed, setInviteFailed] = useState(false);

  useEffect(() => {
    if (!inviteOpen || !authenticated || invite || inviteFailed) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const data = await getMyInvite(token);
        if (!cancelled) setInvite(data);
      } catch (err) {
        if (!cancelled) setInviteFailed(true);
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[profile] invite code unavailable",
            err instanceof Error ? err.message : err,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteOpen, authenticated, invite, inviteFailed, getAccessToken]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard blocked — the value is still on screen to select by hand */
    }
  };

  /* --------------------------------------------------------- equity -- */

  const path = useMemo(() => {
    const cutoff = RANGES.find((r) => r.key === range)!.ms;
    const inWindow = totals.path.filter(
      (p) =>
        cutoff === Infinity || Date.now() - new Date(p.at).getTime() <= cutoff,
    );
    return inWindow.length > 1 ? inWindow : totals.path;
  }, [totals.path, range]);

  const moved = useMemo(() => {
    const cutoff = RANGES.find((r) => r.key === range)!.ms;
    if (cutoff === Infinity) return totals.pnlUsd;
    let sum = 0;
    let any = false;
    for (const h of holdings) {
      if (!h.mark) continue;
      const m = movedOverUsd(h.mark.points, Date.now() - cutoff);
      if (m === null) continue;
      sum += m;
      any = true;
    }
    return any ? sum : null;
  }, [holdings, totals.pnlUsd, range]);

  const classes = useMemo(
    () =>
      [...new Set(holdings.map((h) => h.agent.strategy_class))].filter(Boolean),
    [holdings],
  );
  const rows = useMemo(
    () =>
      holdings
        .filter((h) =>
          live
            ? h.agent.status === "active"
            : h.agent.status === "paused" || h.agent.status === "liquidating",
        )
        .filter((h) => klass === "all" || h.agent.strategy_class === klass),
    [holdings, live, klass],
  );

  const [whole, cents] = splitMoney(totals.equityUsd);
  const name = username ?? email ?? (wallet ? short(wallet) : null);
  const label = name ?? t("profile_your_portfolio");
  const cycles = holdings.reduce(
    (n, h) => n + (h.mark?.points.length ?? 0),
    0,
  );

  return (
    <div className="lg:hidden">
      {/* Copying is a purely visual event otherwise — the same, spoken. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? t("account_address_copied") : ""}
      </span>

      {/* ----------------------------------------------------- identity -- */}
      <div className="space-y-4 px-5 pt-3 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar label={label} size={52} />
            <div className="min-w-0">
              <p
                className={`truncate text-[22px] leading-tight font-light tracking-[-0.02em] text-text-primary ${
                  !username && !email ? "font-mono" : "font-ui"
                }`}
              >
                {username ?? email ?? label}
              </p>
              {/* The second line is whichever identity the first did not use:
                  the handle under an email, the email under a handle. */}
              {username && email ? (
                <p className="truncate pt-0.5 font-ui text-[12.5px] text-text-dim">
                  {email}
                </p>
              ) : username ? (
                <p className="truncate pt-0.5 font-mono text-[12px] text-text-dim">
                  @{username}
                </p>
              ) : nameLoaded ? (
                <button
                  type="button"
                  onClick={() => setModal("username")}
                  className={`-mx-1 mt-0.5 rounded px-1 py-0.5 text-left underline-offset-4 hover:underline ${QUIET} ${FOCUS}`}
                >
                  {t("account_set_username")}
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconLink
              href="/notifications"
              label={t("profile_notifications_aria")}
            >
              <Bell className="size-[17px]" aria-hidden />
            </IconLink>
            <IconLink href="/activity" label={t("profile_activity_aria")}>
              <History className="size-[17px]" aria-hidden />
            </IconLink>
            <IconLink href="/settings" label={t("profile_settings_aria")}>
              <Settings className="size-[17px]" aria-hidden />
            </IconLink>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <Stat
            value={String(totals.counted)}
            label={t(
              totals.counted === 1
                ? "profile_stat_agent"
                : "profile_stat_agents",
            )}
          />
          <Stat
            value={cycles.toLocaleString("en-US")}
            label={t("profile_stat_cycles")}
          />
          <Stat
            value={money(totals.openBookUsd)}
            label={t("profile_stat_open")}
          />
        </div>
      </div>

      {/* --------------------------------------------------- main wallet -- */}
      {/* The chain's answer, not ours. "Has my deposit arrived" is a question
          about the chain, and the aggregate below can only say what the agents
          hold. This block is what the desktop menu shows; it had no phone
          counterpart at all. */}
      <div className="border-y border-grid px-5 pt-4 pb-5">
        {wallet ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <SectionLabel>{t("profile_main_wallet")}</SectionLabel>
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
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[15px] text-text-dim">
                  {t("account_balance_failed")}
                </span>
                <button
                  type="button"
                  onClick={() => setBalanceNonce((n) => n + 1)}
                  className={`underline-offset-4 hover:underline ${QUIET}`}
                >
                  {t("common_retry")}
                </button>
              </div>
            ) : (
              <p className="flex items-baseline gap-2">
                <span className="tnum font-mono text-[30px] leading-none text-text-primary">
                  {balance.at === "ready" ? (
                    `$${balance.funds.usdc.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  ) : (
                    <span className="text-text-dim">—</span>
                  )}
                </span>
                <span className="font-ui text-[13px] text-text-dim">USDC</span>
              </p>
            )}

            {/* The full address, one tap to copy. Deliberately not truncated:
                this is the one string anyone opens this screen to paste, and a
                shortened form is not pasteable. `break-all` keeps it on the
                page at any width. */}
            <button
              type="button"
              onClick={() => copy(wallet)}
              aria-label={t("account_copy_wallet_aria", {
                label: t("account_wallet_canopy"),
                address: wallet,
              })}
              className={`group -mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-3 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2 ${FOCUS}`}
            >
              <span className="min-w-0 flex-1 font-mono text-[11.5px] leading-snug break-all text-text-secondary">
                {wallet}
              </span>
              <span
                className={`flex shrink-0 items-center gap-1 font-ui text-[11px] ${
                  copied === wallet ? "text-accent" : "text-text-dim"
                }`}
                aria-hidden
              >
                {copied === wallet ? (
                  t("common_copied")
                ) : (
                  <Copy className="size-3.5" aria-hidden />
                )}
              </span>
            </button>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModal("deposit")}
                className={`h-10 flex-1 ${PRIMARY}`}
              >
                {t("account_deposit")}
              </button>
              <button
                type="button"
                onClick={() => setModal("withdraw")}
                className={`h-10 flex-1 ${SECONDARY}`}
              >
                {t("account_withdraw")}
              </button>
            </div>
          </div>
        ) : email ? (
          // Signed in, but every embedded wallet is an agent's or retired. One
          // quiet action, because the only way forward is a new wallet and the
          // reader should not have to know that.
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-ui text-[13px] text-text-dim">
              {t("account_no_wallet")}
            </p>
            <button
              type="button"
              disabled={creatingWallet}
              onClick={async () => {
                setCreatingWallet(true);
                try {
                  await createWallet({ createAdditional: true });
                  await refreshUser();
                } catch (err) {
                  if (process.env.NODE_ENV !== "production") {
                    console.warn("[profile] create wallet failed", err);
                  }
                } finally {
                  setCreatingWallet(false);
                }
              }}
              className={QUIET}
            >
              {t(
                creatingWallet
                  ? "account_creating_wallet"
                  : "account_create_wallet",
              )}
            </button>
          </div>
        ) : (
          <p className="font-ui text-[13px] text-text-dim">
            {t("account_no_details")}
          </p>
        )}
      </div>

      {/* ------------------------------------------------------- equity -- */}
      <div className="border-b border-grid bg-panel">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-3 px-5 pt-4 pb-3">
          <div className="space-y-1.5">
            <SectionLabel>
              {totals.counted === 1
                ? t("profile_aggregate_equity_one")
                : t("profile_aggregate_equity_many", {
                    count: totals.counted,
                  })}
            </SectionLabel>
            <p className="tnum flex items-end font-mono text-[30px] leading-none tracking-[-0.02em]">
              <span className="text-text-primary">{whole}</span>
              <span className="text-text-muted">{cents}</span>
            </p>
            <p className="flex flex-wrap items-baseline gap-1.5">
              <span
                className={`tnum font-mono text-[13px] ${
                  (moved ?? 0) >= 0 ? "text-accent" : "text-negative"
                }`}
              >
                {moved === null ? "—" : signed(moved)}
              </span>
              <span className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
                {range}
              </span>
            </p>
          </div>
          <div
            role="group"
            aria-label={t("profile_range_aria")}
            className={`shrink-0 ${SEGMENT_TRACK}`}
          >
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                className={`${SEGMENT_ITEM} h-7 px-2.5 font-mono text-[11px] ${
                  range === r.key ? SEGMENT_ON : SEGMENT_OFF
                }`}
              >
                {r.key}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[168px]">
          {path.length > 1 ? (
            <EquityCurve
              values={path.map((p) => p.equityUsd)}
              baseline={totals.capitalUsd}
              height={168}
            />
          ) : (
            <p className="px-5 py-14 text-center font-ui text-[12.5px] text-text-dim">
              {t("profile_no_readings")}
            </p>
          )}
        </div>

        {/* What the curve is made of: how it is marked, whether any of it is
            real money, and what sits inside agents without a position. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pt-1 pb-4">
          <span className={BODY}>
            {t(totals.marked ? "profile_marked_live" : "profile_marked_last_cycle")}
          </span>
          <span className={BODY}>
            {t(totals.allPaper ? "profile_paper" : "profile_live")}
          </span>
          <span className={BODY}>
            {t("profile_idle_in_agents", { amount: money(totals.idleUsd) })}
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------- agents -- */}
      <div className="pt-5">
        <div className="flex items-center justify-between gap-3 px-5 pb-3">
          <p className="font-ui text-[17px] leading-none tracking-[-0.01em] text-text-primary">
            {t("profile_your_agents")}
          </p>
          <div
            role="group"
            aria-label={t("profile_your_agents")}
            className={SEGMENT_TRACK}
          >
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setLive(v)}
                aria-pressed={live === v}
                className={`${SEGMENT_ITEM} h-7 px-3 ${
                  live === v ? SEGMENT_ON : SEGMENT_OFF
                }`}
              >
                {t(v ? "profile_filter_live" : "profile_filter_paused")}
              </button>
            ))}
          </div>
        </div>

        {classes.length > 1 ? (
          <div className="flex gap-1.5 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {["all", ...classes].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setKlass(c)}
                aria-pressed={klass === c}
                className={`h-8 shrink-0 rounded-lg px-3 font-ui text-[12.5px] capitalize transition-colors ${
                  klass === c
                    ? "bg-surface-2 text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {c === "all" ? t("common_all") : c}
              </button>
            ))}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center font-ui text-[13px] text-text-dim">
            {t(live ? "profile_none_running" : "profile_none_paused")}
          </p>
        ) : (
          <ul className="border-t border-grid">
            {rows.map((h) => (
              <OwnedRow key={h.agent.id} holding={h} />
            ))}
          </ul>
        )}
      </div>

      {/* ------------------------------------------------------- invite -- */}
      {/* A disclosure, not a section: the fetch that fills it mints a code. */}
      <div className="border-t border-grid">
        <button
          type="button"
          onClick={() => setInviteOpen((o) => !o)}
          aria-expanded={inviteOpen}
          className={`flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left ${FOCUS}`}
        >
          <span className="font-ui text-[13.5px] text-text-primary">
            {t("invite_your_code")}
          </span>
          <span className="flex items-center gap-2">
            {invite ? (
              <span className="tnum font-mono text-[11px] text-text-dim">
                {t("invite_remaining", {
                  remaining: invite.remaining,
                  max: invite.maxUses,
                })}
              </span>
            ) : null}
            <ChevronDown
              className={`size-4 text-text-dim transition-transform duration-150 ${
                inviteOpen ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </span>
        </button>

        {inviteOpen ? (
          <div className="space-y-2 px-5 pb-4">
            {invite ? (
              <>
                <button
                  type="button"
                  onClick={() => copy(invite.code)}
                  disabled={invite.disabled}
                  aria-label={t("invite_copy_code_aria", { code: invite.code })}
                  className={`flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-border px-3 text-left transition-colors hover:border-grid-strong disabled:opacity-50 ${FOCUS}`}
                >
                  <span className="truncate font-mono text-[13px] tracking-[0.06em] text-text-primary">
                    {invite.code}
                  </span>
                  <span
                    className={`shrink-0 font-ui text-[11px] ${
                      copied === invite.code ? "text-accent" : "text-text-dim"
                    }`}
                    aria-hidden
                  >
                    {copied === invite.code ? (
                      t("common_copied")
                    ) : (
                      <Copy className="size-3.5" aria-hidden />
                    )}
                  </span>
                </button>
                {!invite.disabled && invite.remaining > 0 ? (
                  <button
                    type="button"
                    onClick={() => copy(inviteLink(invite.code))}
                    aria-label={t("invite_copy_link_aria")}
                    className={`flex items-center gap-1.5 py-1 ${QUIET} ${FOCUS}`}
                  >
                    {copied === inviteLink(invite.code)
                      ? t("common_copied")
                      : t("invite_copy_link")}
                  </button>
                ) : null}
                <p className={BODY}>
                  {t(
                    invite.disabled
                      ? "invite_note_disabled"
                      : invite.remaining === 0
                        ? "invite_note_exhausted"
                        : invite.gateActive
                          ? "invite_note_gated"
                          : "invite_note_open",
                  )}
                </p>
                {invite.uses > 0
                  ? (() => {
                      // One complete sentence per case — see nav.tsx for why
                      // this is not assembled from fragments.
                      const names = invite.referrals
                        .map((r) => r.email)
                        .filter(Boolean)
                        .join("、");
                      const named = names.length > 0 && invite.uses <= 3;
                      const one = invite.uses === 1;
                      return (
                        <p className="font-ui text-[12px] text-text-secondary">
                          {named
                            ? t(
                                one
                                  ? "invite_joined_one_named"
                                  : "invite_joined_many_named",
                                { count: invite.uses, names },
                              )
                            : t(
                                one ? "invite_joined_one" : "invite_joined_many",
                                { count: invite.uses },
                              )}
                        </p>
                      );
                    })()
                  : null}
              </>
            ) : inviteFailed ? (
              <p className={BODY}>{t("profile_invite_unavailable")}</p>
            ) : (
              <p className={BODY}>{t("common_loading")}</p>
            )}
          </div>
        ) : null}
      </div>

      {/* ----------------------------------------------------- sign out -- */}
      {/* A quiet row, as in the menu — not a red button. "Sign out", not
          "Disconnect": sign-in is by email, and the wallets stay. */}
      <div className="border-t border-grid px-5 py-2">
        <button
          type="button"
          onClick={() => void logout()}
          className={`-mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-text-secondary transition-colors hover:bg-surface-2 hover:text-negative ${FOCUS}`}
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          <span className="font-ui text-[13px] font-medium">
            {t("account_sign_out")}
          </span>
        </button>
      </div>

      {modal === "deposit" && wallet ? (
        <DepositModal address={wallet} onClose={closeTransfer} />
      ) : null}
      {modal === "withdraw" && wallet ? (
        <WithdrawModal address={wallet} onClose={closeTransfer} />
      ) : null}
      {modal === "username" ? (
        <UsernameModal onClose={() => setModal(null)} />
      ) : null}
    </div>
  );
}

function OwnedRow({ holding }: { holding: Holding }) {
  const t = useT();
  const { agent, mark } = holding;
  const moved = mark
    ? movedOverUsd(mark.points, Date.now() - 86_400_000)
    : null;
  const cycle = mark?.points.length
    ? mark.points[mark.points.length - 1].tickSeq
    : null;
  return (
    <li className="border-b border-grid">
      <Link
        href={`/workspace/${agent.id}`}
        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface/60"
      >
        {/* The initial, not a stock glyph: the name is beside it, and an
            initial is the same information the reader is already using. */}
        <Avatar label={agent.strategy_name} size={36} />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-ui text-[14px] text-text-primary">
              {agent.strategy_name}
            </span>
            <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.06em] text-text-secondary uppercase">
              {agent.is_paper ? t("profile_badge_paper") : agent.strategy_class}
            </span>
          </span>
          <span className="block font-mono text-[11px] text-text-dim">
            {cycle === null
              ? t("profile_deployed", {
                  amount: money(num(agent.capital_usd) ?? 0),
                })
              : t("profile_deployed_cycle", {
                  amount: money(num(agent.capital_usd) ?? 0),
                  cycle,
                })}
          </span>
        </span>
        <span className="shrink-0 space-y-1 text-right">
          <span className="tnum block font-mono text-[14px] text-text-primary">
            {mark ? money(mark.equityUsd) : "—"}
          </span>
          <span
            className={`tnum block font-mono text-[12px] ${
              moved === null
                ? "text-text-dim"
                : moved >= 0
                  ? "text-accent"
                  : "text-negative"
            }`}
          >
            {moved === null ? "—" : signed(moved)}
          </span>
        </span>
      </Link>
    </li>
  );
}

function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-text-dim transition-colors hover:bg-surface-2 hover:text-text-primary ${FOCUS}`}
    >
      {children}
    </Link>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="tnum font-mono text-[13px] text-text-primary">
        {value}
      </span>
      <span className={LABEL}>{label}</span>
    </span>
  );
}

/* ---------------------------------------------------------------- format -- */

function splitMoney(n: number): [string, string] {
  if (!Number.isFinite(n)) return ["—", ""];
  const s = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const [whole, frac] = s.split(".");
  return [`${n < 0 ? "−" : ""}$${whole}`, `.${frac}`];
}

function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function signed(n: number): string {
  const s = `$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return n < 0 ? `−${s}` : `+${s}`;
}
