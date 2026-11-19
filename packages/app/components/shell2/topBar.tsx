"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Search, X } from "lucide-react";
import { LanguageSwitcher } from "@canopy-agent/shared/languageSwitcher";
import { FOCUS, SECONDARY } from "@/components/kit";
import { Modal } from "@/components/modal";
import { AccountMenu } from "@/components/nav";
import { NotificationCentre } from "@/components/notificationCentre";
import { DepositBody } from "@/components/portfolio2/deposit";
import { Delta, Price, TokenMark } from "@/components/trade/bits";
import { searchMarket } from "@/lib/api";
import { usd } from "@/lib/format";
import type { TokenRow } from "@/lib/market";
import { useTradeAccount } from "@/lib/useMarket";
import { OTHER_PAGES, sectionFor } from "./sections";

function crumbFor(pathname: string): string {
  const s = sectionFor(pathname);
  if (s) return s.label;
  return OTHER_PAGES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`))?.[1] ?? "";
}

/** The top bar: where you are, token search, alerts, balance, deposit, account. */
export function TopBar() {
  const pathname = usePathname() ?? "";
  const { authenticated } = usePrivy();
  const { account } = useTradeAccount();
  const [deposit, setDeposit] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-bg pt-2 lg:top-2 lg:pt-0">
      <div className="relative flex h-14 items-center gap-2 rounded-2xl border border-border bg-panel pr-2 pl-4 sm:gap-2.5 lg:pl-5">
        <span className="hidden font-ui text-[14px] font-medium text-text-primary sm:block lg:w-28">{crumbFor(pathname)}</span>
        <Link href="/ask" className="font-ui text-[14px] font-medium text-text-primary sm:hidden">
          {crumbFor(pathname) || "Canopy"}
        </Link>

        <TokenSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
        <span className="flex-1 md:hidden" />
        <button
          type="button"
          aria-label="Search tokens"
          onClick={() => setSearchOpen(true)}
          className={`flex size-9 items-center justify-center rounded-full text-text-dim hover:bg-surface-2 hover:text-text-primary md:hidden ${FOCUS}`}
        >
          <Search className="size-[18px]" strokeWidth={1.7} />
        </button>

        <LanguageSwitcher />
        {authenticated && <NotificationCentre />}
        {authenticated && account?.ready && (
          <Link
            href="/portfolio"
            title="Free in your trading wallet"
            className={`hidden h-9 items-center rounded-full border border-border px-3 font-mono text-[12.5px] text-text-primary tnum hover:border-grid-strong sm:flex ${FOCUS}`}
          >
            {usd(account.usdcBalance)}
          </Link>
        )}
        {authenticated && (
          <button type="button" className={`${SECONDARY} hidden h-9 sm:inline-flex`} onClick={() => setDeposit(true)}>
            Deposit
          </button>
        )}
        <AccountMenu compact />
      </div>
      {deposit && (
        <Modal title="Deposit" onClose={() => setDeposit(false)}>
          <DepositBody address={account?.walletAddress ?? null} />
        </Modal>
      )}
    </header>
  );
}

/**
 * Search by symbol, name or pasted contract address; Enter or a click opens
 * the token on Trade. "/" focuses it from anywhere.
 *
 * Inline from md up; below that it opens as a row under the bar.
 */
function TokenSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [focused, setFocused] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRows([]);
      return;
    }
    let cancelled = false;
    const id = setTimeout(() => {
      searchMarket("", term)
        .then((r) => !cancelled && (setRows(r.tokens.slice(0, 8)), setSel(0)))
        .catch(() => !cancelled && setRows([]));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q]);

  function go(t: TokenRow) {
    setQ("");
    setRows([]);
    input.current?.blur();
    onClose();
    router.push(`/trade/${t.mint}`);
  }

  async function paste() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) setQ(text);
      input.current?.focus();
    } catch {
      input.current?.focus();
    }
  }

  const showList = focused && rows.length > 0;

  return (
    <div
      className={`${open ? "absolute inset-x-2 top-full mt-1.5 flex" : "hidden"} z-40 h-11 items-center gap-2 rounded-xl border border-border bg-panel px-3 md:relative md:inset-auto md:top-auto md:mt-0 md:flex md:h-9 md:max-w-[440px] md:flex-1 md:bg-surface`}
    >
      <Search className="size-4 shrink-0 text-text-muted" strokeWidth={1.7} aria-hidden />
      <input
        ref={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setSel((s) => Math.min(s + 1, rows.length - 1));
          else if (e.key === "ArrowUp") setSel((s) => Math.max(s - 1, 0));
          else if (e.key === "Enter" && rows[sel]) go(rows[sel]);
          else if (e.key === "Escape") {
            input.current?.blur();
            onClose();
          }
        }}
        placeholder="Search token or paste contract address"
        aria-label="Search tokens or paste a contract address"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent font-ui text-[13px] text-text-primary outline-none placeholder:text-text-muted"
      />
      {q ? (
        <button type="button" aria-label="Clear" onClick={() => setQ("")} className="text-text-muted hover:text-text-primary">
          <X className="size-4" />
        </button>
      ) : (
        <>
          <button type="button" onClick={() => void paste()} className="font-ui text-[11.5px] text-text-dim hover:text-text-primary">
            Paste
          </button>
          <kbd className="hidden rounded border border-border px-1.5 font-mono text-[10.5px] text-text-muted md:inline">/</kbd>
        </>
      )}
      {open && (
        <button type="button" aria-label="Close search" onClick={onClose} className="text-text-muted md:hidden">
          <X className="size-4" />
        </button>
      )}
      {showList && (
        <ul role="listbox" className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-[0_20px_44px_-16px_rgba(0,0,0,0.9)]">
          {rows.map((t, i) => (
            <li key={t.mint} role="option" aria-selected={i === sel}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(t)}
                onMouseEnter={() => setSel(i)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === sel ? "bg-surface-2" : ""}`}
              >
                <TokenMark symbol={t.symbol} icon={t.icon} size={22} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-ui text-[13px] text-text-primary">{t.symbol}</span>
                  <span className="block truncate font-ui text-[11.5px] text-text-muted">{t.name}</span>
                </span>
                <span className="text-right">
                  <Price value={t.priceUsd} className="block text-[12.5px] text-text-primary" />
                  <Delta value={t.change24hPct} className="text-[11px]" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
