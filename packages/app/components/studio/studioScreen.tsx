"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowUp } from "lucide-react";
import { FOCUS, PRIMARY } from "@/components/kit";
import { Segmented } from "@/components/trade/bits";
import {
  assetMatchesSelection,
  composeAgent,
  getAllMarkets,
  listStrategies,
  realizedReturnPct,
  return30dPct,
  type ComposedDraft,
  type StrategyRow,
  type UniverseAsset,
} from "@/lib/api";
import { writeSeed } from "@/lib/studioSeed";

type Shape = "single" | "basket";

type State =
  | { phase: "idle" }
  | { phase: "thinking" }
  | { phase: "draft"; draft: ComposedDraft; markets: UniverseAsset[]; notes: string[] }
  | { phase: "notes"; notes: string[] }
  | { phase: "error"; message: string };

const STEPS = ["Describe", "Check the rules", "Run on paper", "Go live"];

/** Studio: describe a strategy, see how it was read, then build it in the rules step. */
export function StudioScreen() {
  const router = useRouter();
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [text, setText] = useState("");
  const [shape, setShape] = useState<Shape>("single");
  const [state, setState] = useState<State>({ phase: "idle" });
  const box = useRef<HTMLTextAreaElement>(null);

  async function draft() {
    const q = text.trim();
    if (!q || !ready) return;
    if (!authenticated) return login();
    setState({ phase: "thinking" });
    try {
      const tk = await getAccessToken();
      if (!tk) return login();
      const prompt = shape === "basket" ? `${q} (a basket: several markets)` : q;
      const [{ draft: d, notes }, all] = await Promise.all([composeAgent(tk, prompt), getAllMarkets(tk).catch(() => [] as UniverseAsset[])]);
      if (!d) {
        setState({ phase: "notes", notes: notes.length ? notes : ["I couldn’t read that as a strategy. Name a market, when to buy and when to sell."] });
        return;
      }
      const markets = all.filter((a) => d.universe.some((u) => assetMatchesSelection(a, u)));
      setState({ phase: "draft", draft: d, markets: shape === "single" ? markets.slice(0, 1) : markets, notes });
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  function build(markets: UniverseAsset[]) {
    writeSeed({ sentence: text.trim(), markets });
    router.push("/build/new");
  }

  return (
    <main className="mx-auto w-full max-w-[820px] px-4 pt-[6vh] pb-12 sm:px-5">
      <h1 className="text-center font-ui text-[30px] font-light tracking-[-0.02em] text-text-primary sm:text-[40px]">
        Turn an idea into a trading agent
      </h1>
      <p className="mt-2 mb-5 text-center font-ui text-[13px] text-text-dim">
        Every strategy runs on paper first, so you can test it before any money goes in.
      </p>

      <ol className="mb-4 flex flex-wrap justify-center gap-x-5 gap-y-1 font-ui text-[12.5px] text-text-muted">
        {STEPS.map((s, i) => (
          <li key={s} className={i === 0 ? "text-text-primary" : ""}>
            <span className="tnum mr-1.5 font-mono text-[11.5px] text-text-muted">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <div className="rounded-[18px] border border-border bg-panel px-4 pt-4 pb-3 focus-within:border-grid-strong">
        <textarea
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void draft();
            }
          }}
          rows={3}
          placeholder="Describe your idea in plain words…"
          aria-label="Describe your strategy"
          className="block min-h-[78px] w-full resize-none bg-transparent font-ui text-[16px] leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
        />
        <div className="mt-2 flex items-center gap-2">
          <Segmented<Shape>
            label="Strategy type"
            value={shape}
            onChange={setShape}
            options={[
              { key: "single", label: "Single market" },
              { key: "basket", label: "Basket" },
            ]}
          />
          <span className="flex-1" />
          <button
            type="button"
            aria-label="Draft strategy"
            disabled={!text.trim() || state.phase === "thinking"}
            onClick={() => void draft()}
            className={`flex size-9 items-center justify-center rounded-full bg-white text-bg transition-opacity disabled:opacity-30 ${FOCUS}`}
          >
            <ArrowUp className="size-[18px]" strokeWidth={2} />
          </button>
        </div>
      </div>
      <p className="mt-2.5 text-center font-ui text-[12px] text-text-muted">
        Non-custodial. Each agent gets its own wallet. It can trade, and it can never withdraw.
      </p>

      {state.phase !== "idle" && (
        <section className="mt-4 rounded-2xl border border-border bg-panel px-4 py-3.5" aria-live="polite">
          {state.phase === "thinking" && <p className="font-ui text-[13.5px] text-text-dim">Drafting your rules…</p>}
          {state.phase === "error" && <p className="font-ui text-[13.5px] text-negative">{state.message}</p>}
          {state.phase === "notes" && state.notes.map((n, i) => <p key={i} className="font-ui text-[13.5px] text-text-secondary">{n}</p>)}
          {state.phase === "draft" && (
            <div className="space-y-3">
              <p className="font-ui text-[13.5px] leading-relaxed text-text-secondary">
                How I read it: <b className="font-medium text-text-primary">{state.draft.reading}</b>
              </p>
              {state.markets.length > 0 && (
                <p className="font-ui text-[12.5px] text-text-muted">
                  Trades {state.markets.map((m) => m.symbol).join(", ")}
                </p>
              )}
              {state.notes.length > 0 && <p className="font-ui text-[12.5px] text-text-muted">{state.notes.join(" ")}</p>}
              <button type="button" className={`${PRIMARY} h-9`} onClick={() => build(state.markets)}>
                Check the rules
              </button>
            </div>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 font-ui text-[18px] font-light tracking-[-0.01em] text-text-primary">Other ways to start</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Link href="/build/new" className={`rounded-2xl border border-border bg-panel p-4 hover:border-grid-strong ${FOCUS}`}>
            <b className="block font-ui text-[14px] font-medium text-text-primary">Fill in a form</b>
            <span className="font-ui text-[12.5px] text-text-secondary">Market, trigger, size and exits, field by field.</span>
          </Link>
          <Link href="/agents" className={`rounded-2xl border border-border bg-panel p-4 hover:border-grid-strong ${FOCUS}`}>
            <b className="block font-ui text-[14px] font-medium text-text-primary">Start from someone else’s</b>
            <span className="font-ui text-[12.5px] text-text-secondary">Copy an agent with a public record, then change it.</span>
          </Link>
        </div>
      </section>

      <ProvenSetups />
    </main>
  );
}

/** The best published strategies by recent return: each opens its own page, where it can be copied. */
function ProvenSetups() {
  const { authenticated, getAccessToken } = usePrivy();
  const [rows, setRows] = useState<StrategyRow[] | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    void (async () => {
      const tk = await getAccessToken();
      if (!tk) return;
      try {
        const { strategies } = await listStrategies(tk);
        const ret = (s: StrategyRow) => return30dPct(s) ?? realizedReturnPct(s);
        const best = strategies
          .filter((s) => s.status === "published" && (ret(s) ?? 0) > 0)
          .sort((a, b) => (ret(b) ?? 0) - (ret(a) ?? 0))
          .slice(0, 5);
        if (!cancelled) setRows(best);
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken]);

  if (!rows || rows.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-ui text-[18px] font-light tracking-[-0.01em] text-text-primary">Start from a proven setup</h2>
      <ul className="divide-y divide-border-soft rounded-2xl border border-border bg-panel">
        {rows.map((s) => {
          const r30 = return30dPct(s);
          const r = r30 ?? realizedReturnPct(s) ?? 0;
          return (
            <li key={s.id}>
              <Link href={`/agents/${s.id}`} className={`flex items-center gap-3 px-4 py-3 hover:bg-surface ${FOCUS}`}>
                <span className="min-w-0 flex-1 truncate font-ui text-[13.5px] text-text-primary">{s.name}</span>
                <span className="font-ui text-[11.5px] text-text-muted">{s.all_paper ? "Paper" : "Live"}</span>
                <span className="tnum w-28 text-right font-mono text-[12.5px] text-positive">
                  +{r.toFixed(1)}% <span className="text-text-muted">{r30 !== null ? "30d" : "total"}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
