"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Callout, Columns, WarnIcon } from "@/components/ui";
import { StepBar } from "@/components/wizard";
import { createStrategy, startPaperRun } from "@/lib/api";
import { BUILD_STAGES } from "@/lib/data";
import { AssetPicker, MarketStep, type MarketChoice } from "@/components/buildMarket";
import { NameAgentModal } from "@/components/nameAgent";
import { DescribeAgent } from "@/components/describeAgent";
import {
  RWA_RULES,
  StrategyStep,
  TEMPLATES,
  fmt,
  toPayload,
  type RuleSpec,
} from "@/components/buildStrategy";
import type { ExitRules } from "@/lib/api";

/**
 * The agent builder, in two steps.
 *
 *   01 Market   — what it may trade
 *   02 Strategy — what makes it buy
 *
 * The order is not cosmetic: step 2's rule vocabulary is a function of step 1's
 * answer. A commodity has no net margin, a meme coin has no filings, a perp has
 * a funding rate. One shared rule list only survives while RWA is the single
 * shipped class, and it stops being true the moment Meme lands.
 *
 * Both steps are explorable signed out. Only starting the run needs identity.
 */

const STEPS = [
  { index: "01", label: "Market" },
  { index: "02", label: "Strategy" },
];

export function BuildAgent() {
  const router = useRouter();
  const { ready, authenticated, getAccessToken, login } = usePrivy();

  const [step, setStep] = useState(0);
  // Empty until the naming modal is answered. `rwa_value_v1` as a default was
  // how three strategies ended up sharing that name — a prefilled field is a
  // field nobody edits.
  //
  // `named` latches separately from `name`. Gating the modal on `name` alone
  // meant clearing the header input to retype it emptied the state, re-opened
  // the modal and threw away the whole draft.
  const [name, setName] = useState("");
  const [named, setNamed] = useState(false);
  // `selection: null` means not chosen yet — deliberately not the same as "all".
  // Step 1 cannot be completed until the author picks something.
  const [market, setMarket] = useState<MarketChoice>({ strategyClass: "rwa", selection: null });
  const [rules, setRules] = useState<RuleSpec[]>(RWA_RULES);
  const [template, setTemplate] = useState<string | null>(TEMPLATES[0].key);
  // Seeded from the default template so the two always agree on first paint.
  const [exits, setExits] = useState<ExitRules>({ ...TEMPLATES[0].exits });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "describe" is the fast path and the default; "build" is the two-step form.
  // Skipping straight to build must leave every value at its manual default.
  const [phase, setPhase] = useState<"describe" | "build">("describe");
  const [composed, setComposed] = useState<{ reading: string; notes: string[] } | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("not signed in");

      const { strategy } = await createStrategy(token, {
        name: name.trim(),
        strategyClass: market.strategyClass,
        rules: toPayload(rules),
        safetyFloor: { minLiquidityUsd: 25_000, maxSlippagePct: 1.5, requireSafetyScreen: false },
        feePct: 10,
        // Empty means Auto — the whole class, including assets added later.
        // Non-null by here: the Continue button gates on it, and submit() is
        // only reachable from the last step.
        universe: market.selection ?? [],
        // maxHoldDays 0 means "never on time alone"; the API treats it as absent.
        exits,
      });

      // Creating leaves it a draft. Starting the paper run is what freezes the
      // rules and deploys the paper agent — done here so the button does what
      // it says rather than leaving a half-made thing behind.
      //
      // Straight to the agent: the creator just started something running and
      // the next thing they want is to watch it.
      const { agentId } = await startPaperRun(token, strategy.id);
      router.push(`/portfolio/${agentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const chosen = market.selection;
  const auto = chosen !== null && chosen.length === 0;
  // The one thing step 1 requires. Without it the agent would be committed to
  // assets its author never looked at.
  const marketReady = chosen !== null;
  const last = step === STEPS.length - 1;

  // The name is asked for before anything else. Rendered here rather than by
  // each button that links to /build/new, so direct navigation is covered too.
  if (!named) {
    return (
      <NameAgentModal
        onConfirm={(n) => {
          setName(n);
          setNamed(true);
        }}
        onCancel={() => router.push("/build")}
      />
    );
  }

  if (phase === "describe") {
    return (
      <DescribeAgent
        name={name}
        onSkip={() => setPhase("build")}
        onDraft={(draft, notes) => {
          // Applied to the SAME state the form edits, so everything below is
          // immediately reviewable and editable. Nothing is submitted here.
          setMarket({ strategyClass: draft.strategyClass, selection: draft.universe });
          setRules((rs) =>
            rs.map((r) => {
              const hit = draft.rules.find((d) => d.key === r.key);
              return hit ? { ...r, value: hit.value } : r;
            }),
          );
          setExits(draft.exits);
          // No template describes these values, so the label must not claim one.
          setTemplate(null);
          setComposed({ reading: draft.reading, notes });
          setPhase("build");
        }}
      />
    );
  }

  return (
    <main>
      <StepBar steps={BUILD_STAGES} current={0} />

      {/* Name and position on one line.
          These were two stacked full-width bars — an eyebrow row and a
          segmented nav — under the lifecycle bar above, so three horizontal
          slabs ran across the top before any content. The step control is a
          compact segment group instead: it is orientation, not a destination,
          and it does not need the width of the page to say "you are on 1 of 2".
      */}
      <section className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-grid px-8 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            New agent · Draft ·
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            // A name is required, so leaving it blank has to resolve to
            // something rather than submitting an empty string.
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
          {STEPS.map((s, i) => {
            const current = i === step;
            const done = i < step;
            return (
              <button
                key={s.index}
                type="button"
                aria-current={current ? "step" : undefined}
                // Back is always allowed — reconsidering the market should never
                // cost the rules you set. Forward only via Continue, which is
                // where the completeness check lives.
                onClick={() => done && setStep(i)}
                disabled={!done && !current}
                className={`flex h-7 items-center gap-2 rounded-full px-3.5 transition-colors ${
                  current
                    ? "bg-accent-wash text-accent"
                    : done
                      ? "text-text-secondary hover:text-text-primary"
                      : "cursor-default text-text-muted"
                }`}
              >
                <span className="tnum font-mono text-[9.5px] opacity-70">{s.index}</span>
                <span className="font-mono text-[11.5px] tracking-[0.04em]">{s.label}</span>
              </button>
            );
          })}
        </nav>
      </section>

      {composed ? (
        <section className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3 border-b border-grid bg-accent-wash px-8 py-4">
          <div className="min-w-0 space-y-1.5">
            <p className="font-mono text-[10px] tracking-[0.12em] text-accent uppercase">
              Filled in from your description
            </p>
            {composed.reading ? (
              <p className="max-w-[78ch] font-ui text-[13px] leading-relaxed text-text-secondary">
                {composed.reading}
              </p>
            ) : null}
            {/* Refusals are shown, never swallowed: a silently narrowed draft
                is worse than none, because you would believe it was followed. */}
            {composed.notes.length > 0 ? (
              <ul className="max-w-[78ch] space-y-0.5 pt-1">
                {composed.notes.map((n) => (
                  <li key={n} className="font-ui text-[12px] leading-relaxed text-warning">
                    {n}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <button
              type="button"
              onClick={() => setPhase("describe")}
              className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:text-accent"
            >
              Describe again
            </button>
            <button
              type="button"
              onClick={() => setComposed(null)}
              className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:text-text-primary"
            >
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      <Columns
        main={
          <div className="px-8 py-8">
            {step === 0 ? (
              <MarketStep value={market} onChange={setMarket} />
            ) : (
              <StrategyStep
                rules={rules}
                onChange={setRules}
                template={template}
                onTemplate={(k) => setTemplate(k || null)}
                exits={exits}
                onExits={setExits}
              />
            )}
          </div>
        }
        rail={
          <>
            {/* Assets are a refinement of the class chosen on the left, so the
                picker sits beside it rather than below it — and only on the step
                where it applies. */}
            {step === 0 ? <AssetPicker value={market} onChange={setMarket} /> : null}

            <div className="border-b border-grid px-8 py-7">
              <h3 className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                This agent
              </h3>
              <Row label="Class" value={market.strategyClass === "rwa" ? "Tokenized RWA" : market.strategyClass} />
              <Row
                label="Assets"
                value={
                  chosen === null ? "Not selected" : auto ? "Auto · all" : `${chosen.length} selected`
                }
                tone={chosen === null ? "warning" : "accent"}
              />
              <Row
                label="Starting point"
                value={TEMPLATES.find((t) => t.key === template)?.title ?? "Custom"}
              />
              {rules.map((r) => (
                <Row
                  key={r.key}
                  label={r.label}
                  value={`${r.op === "gte" ? "≥" : "≤"} ${fmt(r.value, r.unit)}`}
                />
              ))}
              <Row label="Take profit" value={`+${exits.takeProfitPct}%`} tone="accent" />
              <Row label="Stop loss" value={`−${exits.stopLossPct}%`} />
              <Row
                label="Time limit"
                value={exits.maxHoldDays ? `${exits.maxHoldDays}d` : "Never"}
              />
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

              {!last ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(step + 1)}
                    disabled={!marketReady}
                    className="flex h-14 w-full items-center justify-center border border-accent bg-accent-wash font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
                  >
                    Continue to strategy
                  </button>
                  {!marketReady ? (
                    <p className="pt-3 text-center font-mono text-[10.5px] tracking-[0.08em] text-warning uppercase">
                      Choose the assets first
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
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || !ready}
                  className="flex h-14 w-full items-center justify-center border border-accent bg-accent-wash font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
                >
                  {busy ? "Starting…" : "Start paper run"}
                </button>
              )}

              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="mt-3 flex h-11 w-full items-center justify-center border border-border font-mono text-[11px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:text-text-primary"
                >
                  Back to market
                </button>
              ) : null}

              <p className="pt-5 font-ui text-[12.5px] leading-relaxed text-text-secondary">
                Nothing is funded. The agent trades live data in paper mode, one cycle an hour,
                building a record you can publish whenever it convinces you.
              </p>
            </div>
          </>
        }
      />
    </main>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "warning";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-grid py-3 last:border-b-0">
      <span className="font-mono text-[11px] tracking-[0.06em] text-text-dim uppercase">
        {label}
      </span>
      <span
        className={`truncate text-right font-mono text-[12.5px] ${
          tone === "accent" ? "text-accent" : tone === "warning" ? "text-warning" : "text-text-primary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
