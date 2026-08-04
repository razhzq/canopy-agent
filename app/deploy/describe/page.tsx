import { LimitRow } from "@/components/charts";
import { DEPLOY_STEPS, MANDATE } from "@/lib/data";
import {
  AgentTile,
  ArrowRight,
  Columns,
  PrimaryButton,
  SectionHead,
  WarnIcon,
} from "@/components/ui";
import {
  ChoiceCard,
  ChoiceRow,
  MandateRail,
  Proceed,
  StepBar,
  WizardHeader,
} from "@/components/wizard";

const PRESETS = [
  "Low-risk SOL momentum",
  "Meme sniper · tight stops",
  "LP fees only",
];

const CAPITAL_STOPS = ["500", "1,000", "2,000", "5,240 · MAX"];

export default function DescribePage() {
  return (
    <main>
      <StepBar steps={DEPLOY_STEPS} current={0} />

      <WizardHeader
        eyebrow="New mandate"
        title="What should this agent do?"
        meta={[
          { label: "Agent", value: "alpha_hunter" },
          { label: "Class", value: "SPOT" },
          { label: "Venue", value: "SOLANA" },
        ]}
      />

      <Columns
        main={
          <>
            {/* ---------------------------------------------------- intent */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="01"
                title="INTENT"
                note="Plain language · Parsed to a mandate"
              />

              <div className="border border-accent bg-panel">
                <p className="p-6 font-mono text-[14px] leading-relaxed text-text-primary">
                  {MANDATE.intent}
                </p>
                <div className="flex items-center justify-between px-6 pb-4 font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
                  <span className="tnum">{MANDATE.intentChars} / 500</span>
                  <span>No trading jargon required</span>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  Presets
                </span>
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="border border-border px-3.5 py-2 font-mono text-[10px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:border-accent hover:text-accent"
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* parse output */}
              <div className="mt-7 border border-grid bg-panel">
                <div className="flex items-center justify-between px-6 py-5">
                  <span className="font-mono text-[12px] tracking-[0.08em] text-accent uppercase">
                    Parse output
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                    {MANDATE.parse.resolved} fields resolved ·{" "}
                    {MANDATE.parse.defaulted} defaulted
                  </span>
                </div>

                <div className="flex gap-12 px-6">
                  {[MANDATE.parse.left, MANDATE.parse.right].map((col, ci) => (
                    <div key={ci} className="flex-1">
                      {col.map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between border-b border-grid py-3.5"
                        >
                          <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                            {k}
                          </span>
                          <span className="tnum font-mono text-[12px] text-accent">
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 px-6 py-5">
                  <WarnIcon className="mt-px shrink-0 text-warning" />
                  <p className="font-ui text-[13px] text-text-secondary">
                    {MANDATE.parse.warning}
                  </p>
                </div>
              </div>
            </section>

            {/* --------------------------------------------------- capital */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="02"
                title="CAPITAL"
                note={`Wallet balance  ${MANDATE.walletBalance} USDC`}
              />

              <div className="flex items-end justify-between">
                <div className="flex items-baseline gap-4">
                  <span className="tnum font-mono text-[52px] leading-none text-text-primary">
                    2,000.00
                  </span>
                  <span className="font-mono text-[14px] tracking-[0.08em] text-text-dim uppercase">
                    USDC
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                    Allocation
                  </span>
                  <span className="tnum font-mono text-[14px] tracking-[0.06em] text-accent uppercase">
                    {MANDATE.allocationPct}% of balance
                  </span>
                </div>
              </div>

              <div className="mt-7 h-1.5 w-full bg-surface-2">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${MANDATE.allocationPct}%` }}
                />
              </div>

              <div className="mt-5 flex border border-grid">
                {CAPITAL_STOPS.map((stop) => (
                  <button
                    key={stop}
                    type="button"
                    className={`flex-1 border-r border-grid py-4 font-mono text-[13px] last:border-r-0 ${
                      stop === "2,000"
                        ? "bg-accent-wash text-accent"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {stop}
                  </button>
                ))}
              </div>
            </section>

            {/* ------------------------------------------------ risk posture */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="03"
                title="RISK POSTURE"
                note="Derived from your description"
              />
              <ChoiceRow>
                {MANDATE.postures.map((p) => (
                  <ChoiceCard key={p.name} title={p.name} active={p.active}>
                    <div className="mt-1">
                      {[
                        ["Pos", p.pos],
                        ["DD", p.dd],
                        ["Slip", p.slip],
                      ].map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between border-b border-grid py-2.5 last:border-b-0"
                        >
                          <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                            {k}
                          </span>
                          <span className="tnum font-mono text-[12px] text-text-primary">
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ChoiceCard>
                ))}
              </ChoiceRow>
            </section>

            {/* ---------------------------------------------------- limits */}
            <section className="px-8 py-8">
              <SectionHead
                index="04"
                title="LIMITS"
                note="Tighten only · Cannot exceed agent design"
              />
              <div className="divide-y divide-grid">
                {MANDATE.limits.map((l) => (
                  <LimitRow key={l.label} {...l} />
                ))}
              </div>

              <div className="mt-6 flex gap-4 bg-panel px-5 py-5">
                <div className="w-0.5 shrink-0 self-stretch bg-warning" />
                <div className="flex gap-3">
                  <WarnIcon className="mt-0.5 shrink-0 text-warning" />
                  <div className="space-y-1.5">
                    <p className="font-mono text-[12px] tracking-[0.06em] text-text-primary uppercase">
                      {MANDATE.drawdownWarning.title}
                    </p>
                    <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
                      {MANDATE.drawdownWarning.body}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </>
        }
        rail={
          <>
            <div className="border-b border-grid px-8 py-7">
              <p className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                Target agent
              </p>
              <div className="flex items-center gap-4">
                <AgentTile size={40} />
                <div className="space-y-1.5">
                  <p className="font-mono text-[15px] text-text-primary">
                    alpha_hunter
                  </p>
                  <p className="font-mono text-[10px] tracking-[0.06em] text-text-dim uppercase">
                    Spot · Solana · +18.2% / 90D
                  </p>
                </div>
              </div>
            </div>

            <MandateRail rows={MANDATE.rows} readsAs={MANDATE.readsAs} />

            <Proceed
              step={1}
              total={5}
              primary={
                <PrimaryButton href="/deploy/constraints">
                  Continue to constraints <ArrowRight />
                </PrimaryButton>
              }
              note="Nothing signed or funded yet"
            />
          </>
        }
      />
    </main>
  );
}
