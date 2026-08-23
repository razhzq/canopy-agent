"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Ellipsis, Gift, History, LogOut, Pencil, Plus, Settings, Timer, Trees, Wallet } from "lucide-react";

import { EquityCurve } from "@/components/charts";
import { UsernameModal } from "@/components/usernameModal";
import { DepositModal, WithdrawModal } from "@/components/walletModals";
import { usePersonalWallet } from "@/lib/usePersonalWallet";
import { useUsername } from "@/lib/useUsername";
import { movedOverUsd } from "@/lib/perf";
import { num } from "@/lib/api";
import type { Holding, Totals } from "@/components/portfolioOverview";

/**
 * The profile — wireframe M02.
 *
 * The desktop portfolio is a two-column workspace: curve and table on the left,
 * allocation and exposure in a rail. That shape has nothing to give a phone, so
 * this is the wireframe's arrangement instead — who you are, what it is all
 * worth, and the agents underneath.
 *
 * Measurements are the .pen's: a 70px avatar at radius 22, a 32px equity figure
 * with the cents set back, a 168px chart, and 32px filter chips at radius 9.
 *
 * IT DOES NOT FETCH — `PortfolioOverview` has already loaded and marked every
 * agent, and this renders the same `Holding`s and the same `Totals`. A second
 * fan-out would be the same numbers at twice the cost, with a window in which
 * the two disagreed.
 */

const RANGES = [
  { key: "24H", ms: 86_400_000 },
  { key: "7D", ms: 7 * 86_400_000 },
  { key: "30D", ms: 30 * 86_400_000 },
  { key: "ALL", ms: Infinity },
] as const;

export function ProfileMobile({
  holdings,
  totals,
}: {
  holdings: Holding[];
  totals: Totals;
}) {
  const { logout } = usePrivy();
  const { username, loaded: nameLoaded } = useUsername();
  const wallet = usePersonalWallet();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("24H");
  const [modal, setModal] = useState<"deposit" | "withdraw" | "username" | null>(null);
  const [live, setLive] = useState(true);
  const [klass, setKlass] = useState<string>("all");

  const path = useMemo(() => {
    const cutoff = RANGES.find((r) => r.key === range)!.ms;
    const inWindow = totals.path.filter(
      (p) => cutoff === Infinity || Date.now() - new Date(p.at).getTime() <= cutoff,
    );
    // A window with one reading or none cannot be drawn; fall back to the whole
    // path rather than to an empty frame that reads as a chart which failed.
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
    () => [...new Set(holdings.map((h) => h.agent.strategy_class))].filter(Boolean),
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
  const handle = username ?? (wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : "");
  const cycles = holdings.reduce((n, h) => n + (h.mark?.points.length ?? 0), 0);

  return (
    <div className="lg:hidden">
      {/* ----------------------------------------------------- identity -- */}
      <div className="space-y-3.5 px-[18px] pt-2.5 pb-[18px]">
        <div className="flex items-start justify-between">
          <div className="relative size-[76px]">
            <div className="flex size-[70px] items-center justify-center rounded-[22px] border border-border bg-accent-wash">
              <Trees className="size-[30px] text-accent" aria-hidden />
            </div>
            <button
              type="button"
              onClick={() => setModal("username")}
              aria-label="Edit your profile"
              className="absolute top-12 left-12 flex size-[26px] items-center justify-center rounded-[13px] border-[3px] border-bg bg-surface-2"
            >
              <Pencil className="size-3 text-text-primary" aria-hidden />
            </button>
          </div>
          <div className="flex items-center gap-[18px] pt-2.5">
            <Link href="/notifications" aria-label="Notifications">
              <Gift className="size-5 text-text-secondary" aria-hidden />
            </Link>
            <Link href="/activity" aria-label="Activity">
              <History className="size-5 text-text-secondary" aria-hidden />
            </Link>
            <Link href="/settings" aria-label="Settings">
              <Settings className="size-5 text-text-secondary" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="space-y-1">
          <p className="font-ui text-[26px] leading-none font-semibold tracking-[-0.6px] text-text-primary">
            {username ?? "Your portfolio"}
          </p>
          {handle ? <p className="font-mono text-[13.5px] text-text-muted">@{handle}</p> : null}
        </div>

        {/* The wireframe's "+ Add a bio". There is no bio field on the users
            row, so the slot carries the one piece of identity that IS missing
            and settable — and disappears once it is set, rather than sitting
            there as a permanent invitation to nothing. */}
        {nameLoaded && !username ? (
          <button
            type="button"
            onClick={() => setModal("username")}
            className="font-ui text-[14.5px] font-medium text-accent"
          >
            + Set a username
          </button>
        ) : null}

        {/* Following / Followers in the wireframe. There is no social graph, so
            the shape carries two figures that are real. */}
        <div className="flex items-center gap-[18px]">
          <Stat value={String(totals.counted)} label={totals.counted === 1 ? "Agent" : "Agents"} />
          <Stat value={cycles.toLocaleString("en-US")} label="Cycles" />
        </div>

        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          <Meta icon={<Timer className="size-[13px]" aria-hidden />} text={`${totals.marked ? "Marked live" : "Marked at last cycle"}`} />
          <Meta icon={<Wallet className="size-[13px]" aria-hidden />} text={`${money(totals.openBookUsd)} open`} />
          <Meta icon={<Trees className="size-[13px]" aria-hidden />} text={totals.allPaper ? "Paper" : "Live"} />
        </div>
      </div>

      {/* ------------------------------------------------------- equity -- */}
      <div className="border-y border-grid bg-panel">
        <div className="flex items-start justify-between px-[18px] pt-4 pb-2.5">
          <div className="space-y-1.5">
            <p className="font-mono text-[9px] font-semibold tracking-[0.9px] text-text-dim uppercase">
              Aggregate equity · {totals.counted} {totals.counted === 1 ? "agent" : "agents"}
            </p>
            <p className="flex items-end font-mono text-[32px] leading-none font-semibold tracking-[-1.1px]">
              <span className="text-text-primary">{whole}</span>
              <span className="text-text-muted">{cents}</span>
            </p>
            <p className="flex flex-wrap items-center gap-1.5">
              <span
                className={`font-mono text-[13.5px] font-semibold ${
                  (moved ?? 0) >= 0 ? "text-accent" : "text-negative"
                }`}
              >
                {moved === null ? "—" : signed(moved)}
              </span>
              <span className="font-mono text-[9.5px] font-semibold tracking-[0.7px] text-text-dim uppercase">
                {range}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 gap-0.5 rounded-[9px] border border-border bg-bg p-[3px]">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                className={`rounded-[7px] px-2 py-[5px] font-mono text-[10px] font-semibold tracking-[0.4px] ${
                  range === r.key ? "bg-surface-2 text-text-primary" : "text-text-muted"
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
            <p className="px-[18px] py-14 text-center font-ui text-[12.5px] text-text-dim">
              No readings yet — the curve starts at the first settled cycle.
            </p>
          )}
        </div>

        <p className="px-[18px] pt-1 pb-3.5 font-mono text-[9px] font-medium tracking-[0.5px] text-text-muted">
          Capital held at today&apos;s total, so funding an agent does not read as a gain.
        </p>
      </div>

      {/* ---------------------------------------------------- idle cash -- */}
      <div className="flex items-center gap-3.5 border-b border-grid p-[18px]">
        <span className="flex size-[46px] shrink-0 items-center justify-center rounded-[23px] border border-border bg-surface">
          <Wallet className="size-[19px] text-text-secondary" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-ui text-[14px] font-medium text-text-secondary">Idle cash</p>
          <p className="font-mono text-[17px] font-semibold text-text-primary">
            {money(totals.idleUsd)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <IconButton label="Deposit" onClick={() => setModal("deposit")} disabled={!wallet}>
            <Plus className="size-[17px]" aria-hidden />
          </IconButton>
          <IconButton label="Withdraw" onClick={() => setModal("withdraw")} disabled={!wallet}>
            <Ellipsis className="size-[17px]" aria-hidden />
          </IconButton>
        </div>
      </div>

      {/* ------------------------------------------------------- agents -- */}
      <div className="pt-[18px]">
        <div className="flex items-center justify-between px-[18px] pb-3.5">
          <p className="font-ui text-[19px] font-semibold tracking-[-0.3px] text-text-primary">
            Your agents
          </p>
          <div className="flex gap-0.5 rounded-[10px] border border-border bg-surface p-[3px]">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setLive(v)}
                aria-pressed={live === v}
                className={`flex items-center gap-1.5 rounded-lg px-[11px] py-1.5 font-ui text-[13px] font-semibold ${
                  live === v ? "bg-accent-wash text-accent" : "text-text-muted"
                }`}
              >
                {v ? "Live" : "Paused"}
                {v && live ? <span className="size-1.5 rounded-full bg-accent" /> : null}
              </button>
            ))}
          </div>
        </div>

        {classes.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto px-[18px] pb-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {["all", ...classes].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setKlass(c)}
                aria-pressed={klass === c}
                className={`flex h-8 shrink-0 items-center rounded-[9px] px-[13px] font-ui text-[13px] capitalize ${
                  klass === c
                    ? "bg-surface-2 font-semibold text-text-primary"
                    : "font-medium text-text-secondary"
                }`}
              >
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <p className="px-[18px] py-10 text-center font-ui text-[13px] text-text-dim">
            {live ? "No agents running right now." : "Nothing paused."}
          </p>
        ) : (
          <ul className="px-[18px]">
            {rows.map((h, i) => (
              <OwnedRow key={h.agent.id} holding={h} first={i === 0} />
            ))}
          </ul>
        )}
      </div>

      {/* Signing out lives here now.
          It used to exist only in the top bar's account menu, which is hidden
          below lg — so removing that menu from a phone without this would have
          left no way to sign out at all.

          "Sign out", not "Disconnect": sign-in is by email, and "Disconnect"
          reads as "unlink my wallet", which this does not do. See nav.tsx. */}
      <div className="px-[18px] pt-6 pb-2">
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3.5 text-negative/90 transition-colors hover:bg-surface hover:text-negative"
        >
          <LogOut className="size-4" aria-hidden />
          <span className="font-ui text-[14px] font-semibold">Sign out</span>
        </button>
      </div>

      {modal === "deposit" && wallet ? (
        <DepositModal address={wallet} onClose={() => setModal(null)} />
      ) : null}
      {modal === "withdraw" && wallet ? (
        <WithdrawModal address={wallet} onClose={() => setModal(null)} />
      ) : null}
      {modal === "username" ? <UsernameModal onClose={() => setModal(null)} /> : null}
    </div>
  );
}

function OwnedRow({ holding, first }: { holding: Holding; first: boolean }) {
  const { agent, mark } = holding;
  const moved = mark ? movedOverUsd(mark.points, Date.now() - 86_400_000) : null;
  const cycle = mark?.points.length ? mark.points[mark.points.length - 1].tickSeq : null;

  return (
    <li className={first ? "" : "border-t border-grid"}>
      <Link href={`/workspace/${agent.id}`} className="flex items-center gap-3 py-[11px]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] border border-border bg-surface-2">
          <Trees className="size-5 text-accent" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-ui text-[15px] font-semibold tracking-[-0.2px] text-text-primary">
              {agent.strategy_name}
            </span>
            <span className="shrink-0 rounded bg-surface-2 px-[5px] py-0.5 font-mono text-[8.5px] font-semibold tracking-[0.6px] text-text-secondary uppercase">
              {agent.is_paper ? "paper" : agent.strategy_class}
            </span>
          </span>
          <span className="block font-mono text-[11.5px] text-text-dim">
            {money(num(agent.capital_usd) ?? 0)} deployed
            {cycle === null ? "" : ` · cycle ${cycle}`}
          </span>
        </span>
        <span className="shrink-0 space-y-1 text-right">
          <span className="block font-mono text-[15px] font-semibold text-text-primary">
            {mark ? money(mark.equityUsd) : "—"}
          </span>
          <span
            className={`block font-mono text-[12.5px] font-semibold ${
              moved === null ? "text-text-dim" : moved >= 0 ? "text-accent" : "text-negative"
            }`}
          >
            {moved === null ? "—" : signed(moved)}
          </span>
        </span>
      </Link>
    </li>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-mono text-[14px] font-semibold text-text-primary">{value}</span>
      <span className="font-ui text-[14px] text-text-secondary">{label}</span>
    </span>
  );
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-1.5 text-text-muted">
      {icon}
      <span className="font-ui text-[11.5px]">{text}</span>
    </span>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-[42px] items-center justify-center rounded-xl border border-border bg-surface text-text-primary transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------- format -- */

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
  const s = `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `−${s}` : `+${s}`;
}
