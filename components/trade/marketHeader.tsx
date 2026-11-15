"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { FOCUS, POPOVER } from "@/components/kit";
import { CopyButton, Delta, FilterChip, Price, StarIcon, TokenMark } from "@/components/trade/bits";
import { getMarketTokens, searchMarket } from "@/lib/api";
import { compactUsd } from "@/lib/format";
import { TOKEN_LISTS, type TokenList, type TokenRow } from "@/lib/market";


function Picker({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { authenticated, getAccessToken } = usePrivy();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<TokenList>("crypto");
  const [rows, setRows] = useState<TokenRow[] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const tk = authenticated ? ((await getAccessToken()) ?? "") : "";
        const res = q.trim()
          ? await searchMarket(tk, q.trim())
          : await getMarketTokens(tk, tab, 30);
        if (!cancelled) setRows(res.tokens);
      } catch {
        if (!cancelled) setRows([]);
      }
    }, q ? 200 : 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q, tab, authenticated, getAccessToken]);

  return (
    <div ref={box} className={`absolute top-full left-0 z-30 mt-2 w-[min(360px,calc(100vw-32px))] ${POPOVER}`}>
      <div className="space-y-2 border-b border-border p-3">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tokens or paste a contract"
          aria-label="Search tokens"
          className="h-9 w-full rounded-lg border border-border bg-bg px-3 font-ui text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-grid-strong"
        />
        {!q && (
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {TOKEN_LISTS.map((t) => (
              <FilterChip key={t.key} on={tab === t.key} onClick={() => setTab(t.key)}>
                {t.label}
              </FilterChip>
            ))}
          </div>
        )}
      </div>
      <div role="listbox" aria-label="Tokens" className="max-h-[340px] overflow-y-auto p-1.5">
        {rows === null ? (
          <p className="p-3 font-ui text-[12.5px] text-text-dim">Loading</p>
        ) : rows.length === 0 ? (
          <p className="p-3 font-ui text-[12.5px] text-text-dim">No tokens match.</p>
        ) : (
          rows.map((t) => (
            <button
              key={t.mint}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                onClose();
                router.push(`/trade/${t.mint}`);
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2 ${FOCUS}`}
            >
              <TokenMark symbol={t.symbol} icon={t.icon} size={20} />
              <span className="min-w-0 flex-1">
                <span className="block font-ui text-[13px] text-text-primary">{t.symbol}</span>
                <span className="block truncate font-ui text-[11.5px] text-text-muted">{t.name}</span>
              </span>
              <span className="text-right">
                <Price value={t.priceUsd} className="block text-[12px] text-text-primary" />
                <Delta value={t.change24hPct} className="block text-[11px]" />
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function Fact({ label, children, big = false }: { label: string; children: React.ReactNode; big?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="font-ui text-[11.5px] text-text-muted">{label}</p>
      <div className={`tnum font-mono text-text-primary ${big ? "text-[18px]" : "text-[13px]"}`}>{children}</div>
    </div>
  );
}

export function MarketHeader({
  token,
  livePrice,
  live,
  watched,
  onToggleWatch,
}: {
  token: TokenRow | null;
  livePrice: number | null;
  live: boolean;
  watched: boolean;
  onToggleWatch: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-panel p-4">
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-2 ${FOCUS}`}
        >
          {token && <TokenMark symbol={token.symbol} icon={token.icon} size={24} />}
          <span className="font-ui text-[16px] font-medium text-text-primary">{token?.symbol ?? "—"}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-dim" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          aria-pressed={watched}
          aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
          onClick={onToggleWatch}
          className={`rounded-md p-1.5 transition-colors hover:bg-surface-2 ${FOCUS} ${watched ? "text-accent" : "text-text-dim"}`}
        >
          <StarIcon on={watched} />
        </button>
        <span className="truncate font-ui text-[12.5px] text-text-muted">{token?.name}</span>
        <span className="flex-1" />
        <span className="font-ui text-[11.5px] text-text-muted">{live ? "Live" : "Delayed"}</span>
        {open && <Picker onClose={() => setOpen(false)} />}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
        <Fact label="Market cap" big>
          {compactUsd(token?.marketCapUsd)}
        </Fact>
        <Fact label="Price">
          <Price value={livePrice ?? token?.priceUsd} />
        </Fact>
        <Fact label="Change 24h">
          <Delta value={token?.change24hPct} />
        </Fact>
        <Fact label="24h vol.">{compactUsd(token?.volume24hUsd)}</Fact>
        <Fact label="Liquidity">{compactUsd(token?.liquidityUsd)}</Fact>
      </div>
      {token && (
        <div className="flex items-center gap-2 border-t border-border-soft pt-3">
          <span className="font-ui text-[11.5px] text-text-muted">Contract</span>
          <span className="tnum min-w-0 truncate font-mono text-[11.5px] text-text-secondary">{token.mint}</span>
          <CopyButton text={token.mint} label="Copy contract address" />
          <span className="flex-1" />
          <a
            href={`https://solscan.io/token/${token.mint}`}
            target="_blank"
            rel="noreferrer"
            className="font-ui text-[11.5px] text-text-dim hover:text-text-primary"
          >
            Solscan
          </a>
        </div>
      )}
    </div>
  );
}
