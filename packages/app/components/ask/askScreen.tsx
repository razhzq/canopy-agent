"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowUp, X } from "lucide-react";
import { FOCUS, PRIMARY, SECONDARY } from "@/components/kit";
import { Modal } from "@/components/modal";
import { DepositBody } from "@/components/portfolio2/deposit";
import { Delta, Price, TokenMark } from "@/components/trade/bits";
import {
  composeAgent,
  getMarketTokens,
  getTelegramStatus,
  getTradePositions,
  listAgents,
  listStrategies,
  return30dPct,
  realizedReturnPct,
  type ComposedDraft,
  type StrategyRow,
} from "@/lib/api";
import { SOL_MINT, type TokenRow } from "@/lib/market";
import { useTradeAccount } from "@/lib/useMarket";

const EXAMPLES: [string, string][] = [
  ["Buy the SOL dip", "Buy SOL when it dips 5% in an hour, sell at +8%"],
  ["DCA weekly", "Put $50 into JUP every Monday"],
  ["Ride momentum", "Buy tokens up 10% in an hour with rising volume, stop at -5%"],
  ["Snipe new tokens", "Buy new tokens that pass the safety check, $50 each"],
];

type Reply =
  | { phase: "thinking"; q: string }
  | { phase: "draft"; q: string; draft: ComposedDraft; notes: string[] }
  | { phase: "notes"; q: string; notes: string[] }
  | { phase: "error"; q: string; message: string };

/** Ask: one sentence in, rules out, then on to Studio or a single Copilot trade. */
export function AskScreen() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [text, setText] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const [trending, setTrending] = useState<TokenRow[]>([]);

  useEffect(() => {
    getMarketTokens("", "trending", 6)
      .then((r) => setTrending(r.tokens))
      .catch(() => undefined);
  }, []);

  function fill(s: string) {
    setText(s);
    box.current?.focus();
  }

  async function send() {
    const q = text.trim();
    if (!q) return;
    if (!ready) return;
    if (!authenticated) {
      login();
      return;
    }
    setReply({ phase: "thinking", q });
    try {
      const tk = await getAccessToken();
      if (!tk) return login();
      const r = await composeAgent(tk, q);
      if (r.draft) setReply({ phase: "draft", q, draft: r.draft, notes: r.notes });
      else setReply({ phase: "notes", q, notes: r.notes.length ? r.notes : ["I couldn’t turn that into trading rules. Try naming a token, an entry and an exit."] });
    } catch (err) {
      setReply({ phase: "error", q, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <main className="mx-auto w-full max-w-[820px] px-4 pt-[7vh] pb-12 sm:px-5">
      <h1 className="mb-6 text-center font-ui text-[30px] font-light tracking-[-0.02em] text-text-primary sm:text-[40px]">
        What should we trade today?
      </h1>

      <div className="rounded-[18px] border border-border bg-panel px-4 pt-4 pb-3 focus-within:border-grid-strong">
        <textarea
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder="Buy SOL when it dips 5% in an hour, sell at +8%…"
          aria-label="Ask Canopy"
          className="block min-h-[58px] w-full resize-none bg-transparent font-ui text-[16px] leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
        />
        <div className="mt-2 flex items-center gap-2">
          <span className="font-ui text-[12px] text-text-muted">Spot · Solana</span>
          <span className="flex-1" />
          <button
            type="button"
            aria-label="Send"
            disabled={!text.trim() || reply?.phase === "thinking"}
            onClick={() => void send()}
            className={`flex size-9 items-center justify-center rounded-full bg-white text-bg transition-opacity disabled:opacity-30 ${FOCUS}`}
          >
            <ArrowUp className="size-[18px]" strokeWidth={2} />
          </button>
        </div>
      </div>

      {reply && <ReplyCard reply={reply} onClose={() => setReply(null)} />}

      <div className="mt-3.5 flex flex-wrap justify-center gap-2">
        {EXAMPLES.map(([label, prompt]) => (
          <button
            key={label}
            type="button"
            onClick={() => fill(prompt)}
            className={`rounded-full border border-border bg-panel px-3.5 py-1.5 font-ui text-[13px] text-text-secondary hover:border-grid-strong hover:text-text-primary ${FOCUS}`}
          >
            {label}
          </button>
        ))}
      </div>

      {authenticated && <GetStarted />}

      <Doors />

      {trending.length > 0 && (
        <section className="mt-10 border-t border-border" aria-label="Trending questions">
          {trending.slice(0, 3).map((t) => {
            const q =
              (t.change24hPct ?? 0) < -3
                ? `Is ${t.symbol} a buy after today’s dip?`
                : (t.change24hPct ?? 0) > 3
                  ? `Is it too late to buy ${t.symbol} after today’s run?`
                  : `Is ${t.symbol} safe to buy right now?`;
            return (
              <button
                key={t.mint}
                type="button"
                onClick={() => fill(q)}
                className={`flex w-full items-center justify-between gap-4 border-b border-border px-0.5 py-3.5 text-left font-ui text-[14px] text-text-secondary hover:text-text-primary ${FOCUS}`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <TokenMark symbol={t.symbol} icon={t.icon} size={18} />
                  <span className="truncate">{q}</span>
                </span>
                <Delta value={t.change24hPct} className="shrink-0 text-[12px]" />
              </button>
            );
          })}
        </section>
      )}
    </main>
  );
}

function firstMint(d: ComposedDraft): string | null {
  for (const u of d.universe) if ("mint" in u && u.mint) return u.mint;
  return null;
}

function ReplyCard({ reply, onClose }: { reply: Reply; onClose: () => void }) {
  return (
    <section className="relative mt-3.5 rounded-2xl border border-border bg-panel px-4 py-3.5" aria-live="polite">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute top-3 right-3 text-text-muted hover:text-text-primary">
        <X className="size-4" />
      </button>
      <p className="mb-1.5 pr-6 font-ui text-[12.5px] text-text-muted">You asked: {reply.q}</p>
      {reply.phase === "thinking" && <p className="font-ui text-[13.5px] text-text-dim">Turning that into rules…</p>}
      {reply.phase === "error" && <p className="font-ui text-[13.5px] text-negative">{reply.message}</p>}
      {reply.phase === "notes" && (
        <div className="space-y-1.5 font-ui text-[13.5px] text-text-secondary">
          {reply.notes.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </div>
      )}
      {reply.phase === "draft" && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-[220px] flex-1 font-ui text-[13.5px] leading-relaxed text-text-secondary">
            I turned that into rules: <b className="font-medium text-text-primary">{reply.draft.reading}</b>
            {reply.notes.length > 0 && <span className="mt-1 block text-[12.5px] text-text-muted">{reply.notes.join(" ")}</span>}
          </p>
          <Link href={`/build/new?prompt=${encodeURIComponent(reply.q)}`} className={`${PRIMARY} h-8 px-3.5 text-[12.5px]`}>
            Review rules
          </Link>
          <Link href={`/trade/${firstMint(reply.draft) ?? SOL_MINT}`} className={`${SECONDARY} h-8 px-3.5 text-[12.5px]`}>
            Just suggest one trade
          </Link>
        </div>
      )}
    </section>
  );
}

const DISMISS_KEY = "canopy:getstarted:hidden";

/** Four first steps, ticked off from the account's real state. Hidden once done or dismissed. */
function GetStarted() {
  const { getAccessToken } = usePrivy();
  const { account } = useTradeAccount();
  const [state, setState] = useState<{ traded: boolean; agent: boolean; telegram: boolean } | null>(null);
  const [hidden, setHidden] = useState(true);
  const [deposit, setDeposit] = useState(false);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tk = await getAccessToken();
      if (!tk) return;
      const [open, closed, agents, tg] = await Promise.allSettled([
        getTradePositions(tk, "open"),
        getTradePositions(tk, "closed"),
        listAgents(tk),
        getTelegramStatus(tk),
      ]);
      if (cancelled) return;
      setState({
        traded: (open.status === "fulfilled" && open.value.positions.length > 0) || (closed.status === "fulfilled" && closed.value.positions.length > 0),
        agent: agents.status === "fulfilled" && agents.value.agents.some((a) => !a.is_paper),
        telegram: tg.status === "fulfilled" && tg.value.linked,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  if (hidden || !state) return null;
  const steps: { title: string; body: string; done: boolean; action: React.ReactNode }[] = [
    {
      title: "Add money",
      body: "Deposit USDC on Solana. It shows as dollars.",
      done: (account?.usdcBalance ?? 0) > 0,
      action: (
        <button type="button" className={`${PRIMARY} h-8 px-3.5 text-[12.5px]`} onClick={() => setDeposit(true)}>
          Deposit
        </button>
      ),
    },
    {
      title: "Make your first trade",
      body: "Start small, $5 is fine. Copilot sets the exits.",
      done: state.traded,
      action: <Link href="/feed" className={`${PRIMARY} h-8 px-3.5 text-[12.5px]`}>Open Feed</Link>,
    },
    {
      title: "Copy a top agent",
      body: "Let a proven agent trade for you.",
      done: state.agent,
      action: <Link href="/agents" className={`${PRIMARY} h-8 px-3.5 text-[12.5px]`}>Find an agent</Link>,
    },
    {
      title: "Get alerts on Telegram",
      body: "Know the moment a trade closes.",
      done: state.telegram,
      action: <Link href="/settings" className={`${PRIMARY} h-8 px-3.5 text-[12.5px]`}>Connect</Link>,
    },
  ];
  const n = steps.filter((s) => s.done).length;
  if (n === steps.length) return null;

  return (
    <section className="mt-8 rounded-2xl border border-accent/30 bg-accent-wash/40 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <p className="font-ui text-[13.5px] font-medium text-text-primary">Get started</p>
        <p className="font-ui text-[12px] text-text-muted">
          {n} of {steps.length} done
        </p>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
          <i className="block h-full bg-accent" style={{ width: `${(n / steps.length) * 100}%` }} />
        </div>
        <button
          type="button"
          aria-label="Hide checklist"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* hidden for this visit */
            }
          }}
          className="text-text-muted hover:text-text-primary"
        >
          <X className="size-4" />
        </button>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.title} className={`flex items-center gap-3 rounded-xl border border-border bg-panel px-3 py-2.5 ${s.done ? "opacity-60" : ""}`}>
            <span className="tnum w-5 shrink-0 text-center font-mono text-[12px] text-text-muted">{s.done ? "✓" : i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-ui text-[13px] text-text-primary">{s.title}</p>
              <p className="font-ui text-[11.5px] text-text-muted">{s.body}</p>
            </div>
            {s.done ? <span className="font-ui text-[11.5px] text-positive">Done</span> : s.action}
          </li>
        ))}
      </ol>
      {deposit && (
        <Modal title="Deposit" onClose={() => setDeposit(false)}>
          <DepositBody address={account?.walletAddress ?? null} />
        </Modal>
      )}
    </section>
  );
}

/** The three ways in, each with a live sample of what it leads to. */
function Doors() {
  const { authenticated, getAccessToken } = usePrivy();
  const [top, setTop] = useState<StrategyRow | null>(null);
  const [sol, setSol] = useState<TokenRow | null>(null);

  useEffect(() => {
    getMarketTokens("", "crypto", 5)
      .then((r) => setSol(r.tokens.find((t) => t.mint === SOL_MINT) ?? null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    void (async () => {
      const tk = await getAccessToken();
      if (!tk) return;
      try {
        const { strategies } = await listStrategies(tk);
        const best = strategies
          .filter((s) => s.status === "published" && (return30dPct(s) ?? realizedReturnPct(s)) !== null)
          .sort((a, b) => (return30dPct(b) ?? realizedReturnPct(b) ?? 0) - (return30dPct(a) ?? realizedReturnPct(a) ?? 0))[0];
        if (!cancelled) setTop(best ?? null);
      } catch {
        /* the door still works without a sample */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken]);

  const topRet = top ? (return30dPct(top) ?? realizedReturnPct(top)) : null;
  const door = `flex flex-col gap-3 rounded-2xl border border-border bg-panel p-4 text-left transition-colors hover:border-grid-strong ${FOCUS}`;
  const mini = "relative h-[92px] overflow-hidden rounded-xl border border-border-soft bg-surface p-2.5";

  return (
    <section className="mt-12">
      <h2 className="mb-3.5 font-ui text-[22px] font-light tracking-[-0.01em] text-text-primary">How do you want to trade?</h2>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Link href="/agents" className={door}>
          <div className={mini} aria-hidden>
            {top ? (
              <>
                <p className="truncate font-ui text-[12px] font-medium text-text-primary">{top.name}</p>
                <p className={`tnum mt-1 font-mono text-[20px] ${(topRet ?? 0) >= 0 ? "text-positive" : "text-negative"}`}>
                  {(topRet ?? 0) >= 0 ? "+" : "−"}
                  {Math.abs(topRet ?? 0).toFixed(1)}%
                </p>
                <p className="font-ui text-[11px] text-text-muted">{return30dPct(top) !== null ? "Last 30 days" : "Since launch"}</p>
              </>
            ) : (
              <p className="font-ui text-[12px] text-text-muted">Agents with a public track record</p>
            )}
          </div>
          <div>
            <b className="block font-ui text-[15px] font-medium text-text-primary">Copy a top agent</b>
            <span className="font-ui text-[13px] text-text-secondary">Follow a proven agent. Pay only from profit.</span>
          </div>
          <small className="font-ui text-[12px] text-text-muted">For beginners</small>
        </Link>

        <Link href={`/trade/${SOL_MINT}`} className={door}>
          <div className={mini} aria-hidden>
            <div className="flex items-center gap-2">
              <TokenMark symbol="SOL" icon={sol?.icon ?? null} size={16} />
              <span className="font-ui text-[12px] font-medium text-text-primary">SOL</span>
              <Delta value={sol?.change24hPct} className="text-[11px]" />
            </div>
            <p className="mt-2 font-mono text-[11px] leading-[1.7] text-text-muted">
              Price <Price value={sol?.priceUsd ?? null} className="text-text-primary" />
              <br />
              Copilot sets the target and stop
            </p>
          </div>
          <div>
            <b className="block font-ui text-[15px] font-medium text-text-primary">Trade with Copilot</b>
            <span className="font-ui text-[13px] text-text-secondary">It suggests a spot trade. You decide.</span>
          </div>
          <small className="font-ui text-[12px] text-text-muted">For newer traders</small>
        </Link>

        <Link href="/build/new" className={door}>
          <div className={mini} aria-hidden>
            <p className="font-mono text-[11px] leading-[1.7] text-text-secondary">
              IF SOL drop_1h ≥ 5%
              <br />
              BUY $500 SOL
              <br />
              SELL at +8% · STOP −4%
            </p>
          </div>
          <div>
            <b className="block font-ui text-[15px] font-medium text-text-primary">Build a strategy</b>
            <span className="font-ui text-[13px] text-text-secondary">Write the rules. Test on paper, then go live.</span>
          </div>
          <small className="font-ui text-[12px] text-text-muted">For pro traders</small>
        </Link>
      </div>
    </section>
  );
}
