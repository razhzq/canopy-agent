"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Callout, Columns, WarnIcon } from "@/components/ui";
import { StepBar } from "@/components/wizard";
import {
  classFor,
  createStrategy,
  selectionFor,
  startPaperRun,
  type UniverseAsset,
  type UniverseSelection,
} from "@/lib/api";
import { BUILD_STAGES } from "@/lib/data";
import { NameAgentModal } from "@/components/nameAgent";
import { lastRoute } from "@/components/routeMemory";
import { PickMarket } from "@/components/pickMarket";
import { CAPITAL_USD, RWA_RULES, SetLimits, type Limits } from "@/components/setLimits";
import { rulesForClass, toPayload } from "@/components/buildStrategy";
import {
  DEFAULT_ROUTE,
  PickRoute,
  describeRoute,
  type RouteChoice,
} from "@/components/pickRoute";

/**
 * The agent builder — wireframes 1d, 1e and 1f, after the naming modal.
 *
 *   name → 01 Market → 02 Limits → 03 Route → paper run
 *
 * ROUTE IS A STEP AGAIN
 *
 * It was skipped on the wireframe's own rule — "markets with only one live
 * venue skip this step entirely" — back when paper was the only thing that
 * executed. Two venues are live for these pairs now, so 1f takes its place
 * between the limits and the paper test the last button starts.
 *
 * The separate "describe" screen is gone. Compiling a sentence into editable
 * rules now happens inside step 2, beside the chips it produced — which is the
 * thing the old flow missed: it read a description, filled two pages elsewhere,
 * and never showed its working.
 */

const STEPS = [
  { index: "01", label: "Market" },
  { index: "02", label: "Limits" },
  { index: "03", label: "Route" },
];

const DEFAULT_LIMITS: Limits = {
  // Everything off until the compiler or the author turns something on. A
  // builder that arrives pre-armed teaches nobody what it is doing, and a
  // default threshold is still a threshold that excludes things.
  rules: RWA_RULES.map((r) => ({ ...r, enabled: false })),
  exits: { takeProfitPct: 25, stopLossPct: 12, maxHoldDays: 0 },
  positionUsd: 2_500,
  tradesPerCycle: 2,
};

export function BuildAgent() {
  const router = useRouter();
  const { ready, authenticated, getAccessToken, login } = usePrivy();

  const [name, setName] = useState("");
  const [named, setNamed] = useState(false);
  const [step, setStep] = useState(0);
  /**
   * Every market the agent may trade, in the order they were picked.
   *
   * A list rather than one, because the engine always screened a list — both
   * specialists loop over their universe and an auto strategy screens up to
   * sixty. The single-market limit was this component and one line below.
   *
   * The FIRST entry is the representative: it names the step in the rail, and
   * it is what the strategy composer is told it is trading. Every entry shares a
   * class, so any of them would describe the specialist equally well.
   */
  const [markets, setMarkets] = useState<UniverseAsset[]>([]);
  const asset = markets[0] ?? null;
  const [limits, setLimits] = useState<Limits>(DEFAULT_LIMITS);
  // Builder state only — no strategy or deploy payload carries a venue yet.
  // See the note at the top of pickRoute.tsx.
  const [route, setRoute] = useState<RouteChoice>(DEFAULT_ROUTE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A created-but-not-yet-started strategy, held back because its plan drew
  // warnings. The id is kept so confirming starts THAT strategy rather than
  // creating a second one.
  const [pending, setPending] = useState<{ id: number; warnings: string[] } | null>(null);

  const activeRules = limits.rules.filter((r) => r.enabled !== false);

  /**
   * Starts the paper run and leaves the builder.
   *
   * Split out because it is reachable two ways: straight through when a plan
   * drew no warnings, and from the confirm button when it did. The strategy
   * already exists by this point either way — confirming must never create a
   * second one.
   */
  async function start(token: string, strategyId: number): Promise<void> {
    // Creating leaves it a draft. Starting the paper run freezes the rules and
    // deploys the agent, so the button does what it says rather than leaving a
    // half-made thing behind.
    const { agentId } = await startPaperRun(token, strategyId);
    router.push(`/workspace/${agentId}?tab=cycles`);
  }

  async function confirmPending(): Promise<void> {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("not signed in");
      await start(token, pending.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("not signed in");
      if (markets.length === 0) throw new Error("pick a market first");

      const { strategy, warnings } = await createStrategy(token, {
        name: name.trim(),
        // The pick decides the specialist. A strategy has exactly one class.
        strategyClass: asset ? classFor(asset) : "rwa",
        // Only rules left on. An off rule is absent, not zeroed — a zeroed
        // threshold still applies and still excludes things.
        rules: toPayload(activeRules),
        safetyFloor: {
          minLiquidityUsd: 25_000,
          maxSlippagePct: 1.5,
          requireSafetyScreen: false,
        },
        feePct: 10,
        // Every market chosen. The picker guarantees they share a class, which
        // is what makes one `strategyClass` above correct for all of them.
        universe: markets.map(selectionFor),
        exits: limits.exits,
        // Both of these were collected by the builder and then dropped on the
        // floor here — a timeframe the author picked and a plan the composer
        // read out of their sentence never reached the strategy they created.
        timeframe: limits.timeframe,
        addPlan: limits.addPlan ?? null,
        // The compliance screen the author chose in step 2. Omitted when they
        // never chose, which defers to the server default rather than asserting
        // "none" on their behalf.
        complianceProfile: limits.complianceProfile,
        // The budget from step 2. These were collected by the builder and then
        // dropped here, exactly as timeframe and addPlan once were — the slider
        // went to 10 and every agent ran with 3.
        positionUsd: limits.positionUsd,
        tradesPerCycle: limits.tradesPerCycle,
        // Only meaningful across several markets — a top-3 of one asset is that
        // asset. Sent regardless when set, because the engine treats a ranking
        // wider than the universe as a no-op rather than an error.
        ranking: limits.ranking,
      });

      // Legal-but-probably-not-meant combinations — an add deeper than the
      // stop, an unbounded ladder. STOP here rather than reporting them on the
      // way past: starting the paper run freezes the config, so this is the
      // last moment the author can act on them. Setting state and navigating
      // in the same breath would show the warning to nobody.
      if (warnings?.length) {
        setPending({ id: strategy.id, warnings });
        return;
      }

      await start(token, strategy.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!named) {
    return (
      <NameAgentModal
        onConfirm={(n) => {
          setName(n);
          setNamed(true);
        }}
        // Back where they were, not to a page they never asked for. `replace`
        // rather than `push` so the builder does not sit in history — pressing
        // Back after cancelling must not reopen the naming modal.
        onCancel={() => router.replace(lastRoute())}
      />
    );
  }

  return (
    <main>
      <StepBar steps={BUILD_STAGES} current={0} />

      <section className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-grid px-8 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            New agent · Draft ·
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (!name.trim()) setName("untitled agent");
            }}
            spellCheck={false}
            aria-label="Agent name"
            className="w-[220px] border-b border-transparent bg-transparent pb-0.5 font-mono text-[14px] text-text-primary outline-none transition-colors hover:border-grid-strong focus:border-accent"
          />
        </div>

        <nav
          aria-label="Builder steps"
          className="flex shrink-0 items-center gap-0.5 rounded-full border border-grid p-1"
        >
          {STEPS.map((s, i) => (
            <button
              key={s.index}
              type="button"
              aria-current={i === step ? "step" : undefined}
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex h-7 items-center gap-2 rounded-full px-3.5 transition-colors ${
                i === step
                  ? "bg-accent-wash text-accent"
                  : i < step
                    ? "text-text-secondary hover:text-text-primary"
                    : "cursor-default text-text-muted"
              }`}
            >
              <span className="tnum font-mono text-[9.5px] opacity-70">{s.index}</span>
              <span className="font-mono text-[11.5px] tracking-[0.04em]">{s.label}</span>
            </button>
          ))}
        </nav>
      </section>

      <Columns
        main={
          <div className="px-8 py-8">
            {step === 0 || !asset ? (
              <PickMarket
                value={markets}
                onChange={(next) => {
                  const before = asset ? classFor(asset) : null;
                  const after = next[0] ? classFor(next[0]) : null;
                  setMarkets(next);
                  // Switching between classes changes which rules exist. Rules
                  // the new specialist cannot evaluate are not merely hidden —
                  // they are removed, because a rule left enabled in state
                  // would be sent to a backend that now REJECTS the asset over
                  // it rather than skipping it, which would stop the strategy
                  // trading at all.
                  if (after !== null && before !== after) {
                    setLimits((l) => ({
                      ...l,
                      rules: rulesForClass(after).map((r) => ({ ...r, enabled: false })),
                    }));
                  }
                }}
                onNext={() => setStep(1)}
              />
            ) : step === 1 ? (
              <SetLimits
                markets={markets}
                value={limits}
                onChange={setLimits}
                onBack={() => setStep(0)}
              />
            ) : (
              <PickRoute
                market={asset}
                value={route}
                onChange={setRoute}
                onBack={() => setStep(1)}
              />
            )}
          </div>
        }
        rail={
          <>
            {/* "Your agent so far", per the wireframe: what has been decided
                stays visible while the next thing is being decided. */}
            <div className="border-b border-grid px-8 py-7">
              <h3 className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                Your agent so far
              </h3>
              <Trail
                done={step > 0 && !!asset}
                here={step === 0}
                label="Market"
                value={
                  markets.length === 0
                    ? "this step"
                    : markets.length === 1
                      ? `${markets[0].symbol}/USDC`
                      : `${markets.length} markets`
                }
              />
              <Trail
                done={step > 1}
                here={step === 1}
                label="Strategy & budget"
                value={
                  step === 0
                    ? "next"
                    : `${activeRules.length} ${activeRules.length === 1 ? "rule" : "rules"}${
                        step === 1 ? " · this step" : ""
                      }`
                }
              />
              <Trail
                done={false}
                here={step === 2}
                label="Route"
                value={step === 2 ? describeRoute(route) : "2 venues live · choose next"}
              />
              <Trail done={false} label="Paper run" value="free, no time limit" />
              <Trail done={false} label="Publish" value="whenever you like" />

              {step >= 1 ? (
                <div className="mt-5 space-y-1.5 border-t border-grid pt-4">
                  <Row label="Position cap" value={money(limits.positionUsd)} tone="accent" />
                  <Row label="Per cycle" value={`${limits.tradesPerCycle} trades`} />
                  <Row
                    label="Exits"
                    value={`+${limits.exits.takeProfitPct}% / −${limits.exits.stopLossPct}%`}
                  />
                  <Row label="Paper book" value={money(CAPITAL_USD)} />
                </div>
              ) : null}
            </div>

            <div className="px-8 py-7">
              <div className="flex items-center justify-between pb-4">
                <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                  Proceed
                </h3>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  Step {step + 1} of {STEPS.length}
                </span>
              </div>

              {error ? (
                <div className="mb-4">
                  <Callout tone="negative" icon={<WarnIcon />}>
                    {error}
                  </Callout>
                </div>
              ) : null}

              {pending ? (
                <div className="mb-4 space-y-3">
                  <Callout tone="negative" icon={<WarnIcon />}>
                    <span className="block pb-1.5 font-mono text-[10px] tracking-[0.14em] uppercase">
                      Check the accumulation plan
                    </span>
                    <ul className="space-y-1">
                      {pending.warnings.map((w) => (
                        <li key={w} className="font-ui text-[12.5px] leading-relaxed">
                          {w}
                        </li>
                      ))}
                    </ul>
                    <span className="block pt-2 font-ui text-[12px] leading-relaxed opacity-80">
                      The strategy is saved as a draft. Starting the paper run freezes it, so this
                      is the last point you can change these.
                    </span>
                  </Callout>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={confirmPending}
                      className="h-9 rounded-full border border-grid px-4 font-mono text-[10px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:text-text-primary disabled:opacity-40"
                    >
                      Start anyway
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        // Back to the limits step with the plan intact. The
                        // draft stays on the server; editing and submitting
                        // again creates a new one, which is the same thing
                        // every other abandoned draft in this flow does.
                        setPending(null);
                        setStep(1);
                      }}
                      className="h-9 rounded-full border border-accent px-4 font-mono text-[10px] tracking-[0.08em] text-accent uppercase transition-colors disabled:opacity-40"
                    >
                      Go back and edit
                    </button>
                  </div>
                </div>
              ) : null}

              {step === 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={markets.length === 0}
                    className="flex h-14 w-full items-center justify-center border border-accent bg-accent-wash font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
                  >
                    Continue to limits
                  </button>
                  {markets.length === 0 ? (
                    <p className="pt-3 text-center font-mono text-[10.5px] tracking-[0.08em] text-warning uppercase">
                      Pick a market first
                    </p>
                  ) : null}
                </>
              ) : step === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={activeRules.length === 0}
                    className="flex h-14 w-full items-center justify-center border border-accent bg-accent-wash font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
                  >
                    Continue to route
                  </button>
                  {activeRules.length === 0 ? (
                    // A strategy with no active rule buys nothing, ever — so
                    // the gate sits here, one step before the run it would
                    // have made pointless.
                    <p className="pt-3 text-center font-mono text-[10.5px] tracking-[0.08em] text-warning uppercase">
                      Turn on at least one rule
                    </p>
                  ) : null}
                </>
              ) : ready && !authenticated ? (
                <button
                  type="button"
                  onClick={login}
                  className="flex h-14 w-full items-center justify-center border border-accent bg-accent-wash font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
                >
                  Sign in to start
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy || !ready || activeRules.length === 0}
                    className="flex h-14 w-full items-center justify-center border border-accent bg-accent-wash font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
                  >
                    {busy ? "Starting…" : "Run paper test"}
                  </button>
                  {activeRules.length === 0 ? (
                    // A strategy with no active rule buys nothing, ever.
                    <p className="pt-3 text-center font-mono text-[10.5px] tracking-[0.08em] text-warning uppercase">
                      Turn on at least one rule
                    </p>
                  ) : null}
                </>
              )}

              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="mt-3 flex h-11 w-full items-center justify-center border border-border font-mono text-[11px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:text-text-primary"
                >
                  Back to {STEPS[step - 1].label}
                </button>
              ) : null}

              <p className="pt-5 font-ui text-[12.5px] leading-relaxed text-text-secondary">
                Paper runs are free and have no time limit. Nothing is funded, and you publish
                whenever the record convinces you.
              </p>
            </div>
          </>
        }
      />
    </main>
  );
}

/* -------------------------------------------------------------------- bits -- */

function Trail({
  done,
  here,
  label,
  value,
}: {
  done: boolean;
  here?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline gap-3 border-b border-grid py-2.5 last:border-b-0">
      <span
        className={`w-3 shrink-0 text-center font-mono text-[11px] ${
          done || here ? "text-accent" : "text-text-muted"
        }`}
      >
        {done ? "✓" : here ? "→" : "○"}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate font-mono text-[11.5px] ${
            here || done ? "text-text-primary" : "text-text-dim"
          }`}
        >
          {label}
        </span>
        <span className="block truncate font-ui text-[11px] text-text-dim">{value}</span>
      </span>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
        {label}
      </span>
      <span
        className={`truncate font-mono text-[12px] ${
          tone === "accent" ? "text-accent" : "text-text-primary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
