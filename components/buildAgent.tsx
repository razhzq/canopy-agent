"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Callout, LockIcon, SectionHead, WarnIcon } from "@/components/ui";
import { ChoiceCard, ChoiceRow, StepBar } from "@/components/wizard";
import { usePrivy } from "@privy-io/react-auth";
import { createStrategy, startPaperRun, type DetectionRule } from "@/lib/api";
import { BUILD_STEPS } from "@/lib/data";

/* --------------------------------------------------------------- classes -- */

/**
 * Strategy classes.
 *
 * `available` reflects what the BACKEND can actually run. Only the RWA
 * specialist exists; the others are in the schema because they are planned.
 * Showing them as selectable would let a creator build a strategy that the
 * runner then refuses to tick — better to say so here than to fail silently
 * an hour later.
 */
const CLASSES = [
  {
    key: "rwa",
    name: "Tokenized RWA",
    body: "Tokenized equities and gold. The underlying's market hours apply.",
    runsAs: "The RWA Analyst",
    available: true,
  },
  {
    key: "spot",
    name: "Spot momentum",
    body: "Volume and breakout signals on established pairs.",
    runsAs: "The Analyst",
    available: false,
  },
  {
    key: "lp",
    name: "Liquidity provision",
    body: "Fee income from concentrated ranges. Impermanent loss modelled.",
    runsAs: "The LP Specialist",
    available: false,
  },
  {
    key: "meme",
    name: "Meme discovery",
    body: "New pools and social velocity. Compliance profile must be off.",
    runsAs: "The Analyst",
    available: false,
  },
] as const;

/* ----------------------------------------------------------------- rules -- */

/**
 * Every rule key here is a fact the RWA specialist actually gathers, so a rule
 * you set is a rule that runs. A key the SME never produces would silently
 * never apply — the asset would simply never qualify, with nothing explaining
 * why.
 */
interface RuleSpec {
  key: string;
  label: string;
  help: string;
  op: "gte" | "lte";
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const RWA_RULES: RuleSpec[] = [
  {
    key: "liquidityUsd",
    label: "Liquidity floor",
    help: "Pool depth on Solana. Applies to every asset, including gold.",
    op: "gte",
    value: 50_000,
    min: 0,
    max: 500_000,
    step: 10_000,
    unit: "$",
  },
  {
    key: "dailyVolPct",
    label: "Max daily volatility",
    help: "Trailing realized volatility of the underlying, from Wintel.",
    op: "lte",
    value: 5,
    min: 1,
    max: 15,
    step: 0.5,
    unit: "%",
  },
  {
    key: "maxEventScore",
    label: "Max recent event severity",
    help: "Skip anything that has had a serious abnormal-activity event this week.",
    op: "lte",
    value: 70,
    min: 0,
    max: 100,
    step: 5,
    unit: "",
  },
  {
    key: "netMarginPct",
    label: "Min net margin",
    help: "From SEC filings. Applies to equities; skipped for commodities.",
    op: "gte",
    value: 5,
    min: -20,
    max: 50,
    step: 1,
    unit: "%",
  },
];

function fmt(v: number, unit: string): string {
  if (unit === "$") return v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;
  return `${v}${unit}`;
}

/* ------------------------------------------------------------- component -- */

export function BuildAgent() {
  const router = useRouter();
  const { ready, authenticated, getAccessToken, login } = usePrivy();

  const [name, setName] = useState("rwa_value_v1");
  const [strategyClass, setStrategyClass] = useState<string>("rwa");
  const [rules, setRules] = useState<RuleSpec[]>(RWA_RULES);
  const [feePct, setFeePct] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deliberately NOT gating the whole page on sign-in. Configuring a strategy
  // is exploratory — someone should be able to see what the classes and rules
  // are before committing to an account. Only saving requires identity, so the
  // gate sits on the submit button.

  const setRule = (key: string, value: number) =>
    setRules((rs) => rs.map((r) => (r.key === key ? { ...r, value } : r)));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("not signed in");

      const payload: DetectionRule[] = rules.map((r) => ({
        key: r.key,
        op: r.op,
        value: r.value,
      }));

      const { strategy } = await createStrategy(token, {
        name: name.trim(),
        strategyClass,
        rules: payload,
        safetyFloor: { minLiquidityUsd: 25_000, maxSlippagePct: 1.5, requireSafetyScreen: false },
        feePct,
      });

      // Creating a strategy leaves it a draft. Starting the paper run is what
      // freezes the rules and begins the 30-day record — done here so the
      // button does what it says rather than leaving a half-made thing behind.
      await startPaperRun(token, strategy.id);
      router.push("/build");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const selected = CLASSES.find((c) => c.key === strategyClass);

  return (
    <main>
      <StepBar steps={BUILD_STEPS} current={0} />

      {/* --------------------------------------------------------- header */}
      <section className="flex items-end justify-between border-b border-grid px-8 pt-6 pb-6">
        <div className="space-y-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            New agent · Draft
          </p>
          <div className="flex w-[520px] items-center justify-between border border-accent px-5 py-3.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              spellCheck={false}
              className="w-full bg-transparent font-mono text-[24px] text-text-primary outline-none"
            />
          </div>
          <p className="font-ui text-[14px] text-text-secondary">
            Define the rules. Canopy runs the 30-day paper record on live data, then it
            lists.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- 01 class */}
      <section className="border-b border-grid px-8 py-8">
        <SectionHead
          index="01"
          title="STRATEGY CLASS"
          note="Determines which specialist runs your rules"
        />
        <ChoiceRow cols={2}>
          {CLASSES.map((c) => (
            <button
              key={c.key}
              type="button"
              disabled={!c.available}
              onClick={() => c.available && setStrategyClass(c.key)}
              className={`block w-full text-left ${
                c.available ? "cursor-pointer" : "cursor-not-allowed opacity-45"
              }`}
            >
              <ChoiceCard
                title={c.name}
                body={c.body}
                active={strategyClass === c.key}
                meta={c.available ? `Runs as ${c.runsAs}` : "Specialist not built yet"}
                metaTone={c.available ? "muted" : "warning"}
              />
            </button>
          ))}
        </ChoiceRow>
        {/* Honest about why three of four are greyed out. */}
        <p className="pt-4 font-ui text-[13px] text-text-dim">
          Only the RWA specialist exists today. The others are greyed out because an
          agent built on them would be refused at its first cycle rather than run by the
          wrong analyst.
        </p>
      </section>

      {/* ------------------------------------------------------- 02 rules */}
      <section className="border-b border-grid px-8 py-8">
        <SectionHead
          index="02"
          title="DETECTION RULES"
          note="Deterministic · The model cannot override these"
        />
        <div className="divide-y divide-grid">
          {rules.map((r) => (
            <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_320px_110px] items-center gap-6 py-5">
              <div className="min-w-0 space-y-1.5">
                <p className="font-mono text-[13px] text-text-primary">
                  {r.label}{" "}
                  <span className="text-text-dim">{r.op === "gte" ? "≥" : "≤"}</span>
                </p>
                <p className="font-ui text-[12px] text-text-dim">{r.help}</p>
              </div>
              <input
                type="range"
                min={r.min}
                max={r.max}
                step={r.step}
                value={r.value}
                onChange={(e) => setRule(r.key, Number(e.target.value))}
                className="w-full accent-accent"
              />
              <span className="tnum text-right font-mono text-[14px] text-accent">
                {fmt(r.value, r.unit)}
              </span>
            </div>
          ))}
        </div>
        <p className="pt-4 font-ui text-[12px] text-text-dim">
          A rule only applies to assets that have the fact it names — net margin is
          skipped for gold, which has no filings.
        </p>
      </section>

      {/* ------------------------------------------------------ 03 safety */}
      <section className="border-b border-grid px-8 py-8">
        <SectionHead index="03" title="SAFETY SCREEN" note="Mandatory · You cannot disable these" />
        {[
          ["Mint verified against the issuer", "Every tokenized mint is checked against the issuer's published list."],
          ["Priced and tradable on Jupiter", "An asset with no live quote is excluded from the universe."],
          ["Market session respected", "No new position while the underlying's market is closed."],
          ["Simulated before execution", "A fill is simulated and refused on slippage divergence."],
        ].map(([n, b]) => (
          <div key={n} className="flex items-start justify-between gap-6 border-b border-grid py-5">
            <div className="flex gap-4">
              <LockIcon className="mt-0.5 shrink-0 text-accent" />
              <div className="space-y-1.5">
                <p className="font-mono text-[13px] text-text-primary">{n}</p>
                <p className="font-ui text-[13px] text-text-dim">{b}</p>
              </div>
            </div>
            <Badge tone="accent">Locked on</Badge>
          </div>
        ))}
      </section>

      {/* --------------------------------------------------------- submit */}
      <section className="space-y-5 px-8 py-8">
        <div className="flex items-end justify-between gap-8">
          <div className="space-y-2">
            <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
              Your fee
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={feePct}
                onChange={(e) => setFeePct(Number(e.target.value))}
                className="w-[220px] accent-accent"
              />
              <span className="tnum font-mono text-[15px] text-accent">{feePct}% of profit</span>
            </div>
          </div>

          {ready && !authenticated ? (
            <button
              type="button"
              onClick={() => login()}
              className="border border-accent px-7 py-3.5 font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent-wash"
            >
              Sign in to start
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={busy || !ready || !selected?.available || !name.trim()}
              className="border border-accent px-7 py-3.5 font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent-wash disabled:opacity-40"
            >
              {busy ? "Starting…" : "Start paper run"}
            </button>
          )}
        </div>

        {error ? (
          <Callout tone="negative" icon={<WarnIcon />}>
            {error}
          </Callout>
        ) : null}

        <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
          Starting the paper run freezes these rules for 30 days. The agent trades live
          data on Canopy's infrastructure and the record accrues in public. Editing any
          rule forks a new agent and restarts the clock — the run you abandon stays on
          your profile.
        </p>
      </section>
    </main>
  );
}
