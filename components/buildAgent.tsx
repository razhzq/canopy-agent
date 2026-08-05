"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Callout, Columns, LockIcon, SectionHead, WarnIcon } from "@/components/ui";
import { ChoiceCard, ChoiceRow, StepBar } from "@/components/wizard";
import { usePrivy } from "@privy-io/react-auth";
import { createStrategy, startPaperRun, type DetectionRule } from "@/lib/api";
import { BUILD_STAGES } from "@/lib/data";

/* --------------------------------------------------------------- classes -- */

/**
 * Strategy classes.
 *
 * `available` reflects what the BACKEND can actually run. Only the RWA
 * specialist exists; the others are in the schema because they are planned.
 * Showing them as selectable would let a creator build a strategy the runner
 * then refuses to tick, an hour later, with the reason buried in a log.
 */
const CLASSES = [
  {
    key: "rwa",
    name: "Tokenized RWA",
    body: "Tokenized equities and gold. Screened on SEC filings and the underlying's own volatility; the underlying's market hours apply.",
    runsAs: "The RWA Analyst",
    available: true,
  },
  { key: "spot", name: "Spot momentum", available: false },
  { key: "lp", name: "Liquidity provision", available: false },
  { key: "meme", name: "Meme discovery", available: false },
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

const SAFETY = [
  ["Mint verified against the issuer", "Every tokenized mint is checked against the issuer's published list."],
  ["Priced and tradable on Jupiter", "An asset with no live quote is excluded from the universe."],
  ["Market session respected", "No new position while the underlying's market is closed."],
  ["Simulated before execution", "A fill is simulated and refused on slippage divergence."],
];

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

  // Configuring is exploratory — someone should be able to see the classes and
  // rules before committing to an account. Only saving requires identity.

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

      // Creating leaves it a draft. Starting the paper run is what freezes the
      // rules and begins the 30 days — done here so the button does what it
      // says rather than leaving a half-made thing behind.
      await startPaperRun(token, strategy.id);
      router.push("/build");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const unavailable = CLASSES.filter((c) => !c.available);
  const selected = CLASSES.find((c) => c.key === strategyClass);

  return (
    <main>
      <StepBar steps={BUILD_STAGES} current={0} />

      {/* ---------------------------------------------------------- header */}
      {/* The name is metadata, not a headline. It sits on the eyebrow line at
          label size — a bordered 520px box at 24px was the loudest element on
          the page for the least consequential field. */}
      <section className="flex items-center gap-3 border-b border-grid px-8 py-4">
        <span className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
          New agent · Draft ·
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          spellCheck={false}
          aria-label="Agent name"
          className="w-[260px] border-b border-transparent bg-transparent pb-0.5 font-mono text-[15px] text-text-primary outline-none transition-colors hover:border-grid-strong focus:border-accent"
        />
      </section>

      <Columns
        main={
          <>
            {/* ------------------------------------------------ 01 class */}
            <section className="border-b border-grid px-8 py-7">
              <SectionHead
                index="01"
                title="STRATEGY CLASS"
                note="Determines which specialist runs your rules"
              />
              <ChoiceRow>
                <ChoiceCard
                  title={selected?.name ?? "Tokenized RWA"}
                  body={CLASSES[0].body}
                  active
                  meta={`Runs as ${CLASSES[0].runsAs}`}
                />
              </ChoiceRow>
              {/* One muted line instead of three greyed cards. Same
                  information, a fraction of the space, and it stops giving
                  unavailable options equal billing with the live one. */}
              <p className="pt-3.5 font-ui text-[12.5px] text-text-dim">
                {unavailable.map((c) => c.name).join(", ")} — specialists not built yet.
                An agent on those would be refused at its first cycle.
              </p>
            </section>

            {/* ------------------------------------------------ 02 rules */}
            <section className="border-b border-grid px-8 py-7">
              <SectionHead
                index="02"
                title="DETECTION RULES"
                note="Deterministic · The model cannot override these"
              />
              <div className="divide-y divide-grid">
                {rules.map((r) => (
                  // Three columns when there is room; stacked below that, with
                  // the value moving up beside its label. The design targets a
                  // 1440 viewport where the main column is ~1004px, but a
                  // three-column row squeezed into a laptop window wraps every
                  // label onto two lines and the help text onto four.
                  <div
                    key={r.key}
                    className="space-y-2.5 py-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(140px,220px)_72px] lg:items-center lg:gap-5 lg:space-y-0"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-mono text-[13px] text-text-primary">
                          {r.label}{" "}
                          <span className="text-text-dim">{r.op === "gte" ? "≥" : "≤"}</span>
                        </p>
                        <span className="tnum shrink-0 font-mono text-[14px] text-accent lg:hidden">
                          {fmt(r.value, r.unit)}
                        </span>
                      </div>
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
                    <span className="tnum hidden text-right font-mono text-[14px] text-accent lg:block">
                      {fmt(r.value, r.unit)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="pt-3.5 font-ui text-[12px] text-text-dim">
                A rule only applies to assets that have the fact it names — net margin is
                skipped for gold, which has no filings.
              </p>
            </section>

            {/* ----------------------------------------------- 03 safety */}
            <section className="px-8 py-7">
              <SectionHead
                index="03"
                title="SAFETY SCREEN"
                note="Mandatory · You cannot disable these"
              />
              <div className="divide-y divide-grid">
                {SAFETY.map(([n, b]) => (
                  <div key={n} className="flex items-start justify-between gap-6 py-4">
                    <div className="flex gap-3.5">
                      <LockIcon className="mt-0.5 shrink-0 text-accent" />
                      <div className="space-y-1">
                        <p className="font-mono text-[13px] text-text-primary">{n}</p>
                        <p className="font-ui text-[12px] text-text-dim">{b}</p>
                      </div>
                    </div>
                    <Badge tone="accent">Locked on</Badge>
                  </div>
                ))}
              </div>
            </section>
          </>
        }
        rail={
          <>
            {/* The primary action sits in the rail, in view without scrolling,
                matching every other screen in the product. */}
            <div className="border-b border-grid px-8 py-7">
              <h3 className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                Your fee
              </h3>
              <div className="flex items-center justify-between gap-4">
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={feePct}
                  onChange={(e) => setFeePct(Number(e.target.value))}
                  className="w-full accent-accent"
                />
                <span className="tnum shrink-0 font-mono text-[15px] text-accent">
                  {feePct}%
                </span>
              </div>
              <p className="pt-3 font-ui text-[12px] leading-relaxed text-text-dim">
                Your cut of a deployer's profit. Raising it later applies only to new
                deployments.
              </p>
            </div>

            <div className="border-b border-grid px-8 py-7">
              {ready && !authenticated ? (
                <button
                  type="button"
                  onClick={() => login()}
                  className="flex h-11 w-full items-center justify-center border border-accent font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent-wash"
                >
                  Sign in to start
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || !ready || !selected?.available || !name.trim()}
                  className="flex h-11 w-full items-center justify-center border border-accent font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent-wash disabled:opacity-40"
                >
                  {busy ? "Starting…" : "Start paper run"}
                </button>
              )}

              {error ? (
                <div className="pt-4">
                  <Callout tone="negative" icon={<WarnIcon />}>
                    {error}
                  </Callout>
                </div>
              ) : null}
            </div>

            <div className="px-8 py-7">
              <h3 className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                What happens next
              </h3>
              <ol className="space-y-3 font-ui text-[13px] leading-relaxed text-text-secondary">
                <li>
                  <span className="font-mono text-[11px] text-accent">01</span> These rules
                  are <span className="text-text-primary">frozen</span>.
                </li>
                <li>
                  <span className="font-mono text-[11px] text-accent">02</span> It trades
                  live data in paper mode, one cycle an hour, for 30 days. Nothing is
                  funded and no order reaches a venue.
                </li>
                <li>
                  <span className="font-mono text-[11px] text-accent">03</span> When the
                  record is complete you can publish, and others can deploy it with their
                  own capital and limits.
                </li>
              </ol>
              <p className="pt-4 font-ui text-[12px] leading-relaxed text-text-dim">
                There is no backtest — a forward record cannot be fitted to a window that
                flattered it. Editing a rule later forks a new agent and restarts the
                clock; the run you abandon stays on your profile.
              </p>
            </div>
          </>
        }
      />
    </main>
  );
}
