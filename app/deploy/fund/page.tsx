import { DEPLOY_STEPS, FUND } from "@/lib/data";
import {
  ArrowRight,
  Badge,
  CheckIcon,
  Columns,
  PrimaryButton,
  SectionHead,
} from "@/components/ui";
import { StepBar, WizardHeader } from "@/components/wizard";

export default function FundPage() {
  return (
    <main>
      <StepBar steps={DEPLOY_STEPS} current={4} />

      <WizardHeader
        eyebrow="New mandate · Step 05"
        title="Fund the mandate"
        meta={[
          { label: "Agent", value: "alpha_hunter" },
          { label: "Delegation", value: "GRANTED", tone: "accent" },
          { label: "Status", value: "AWAITING FUNDS", tone: "warning" },
        ]}
      />

      <Columns
        main={
          <>
            {/* --------------------------------------------------- balance */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead index="01" title="BALANCE" note="Wallet 7xKX…9mQt" />

              <div className="flex border border-grid">
                {FUND.balance.map((b) => (
                  <div
                    key={b.label}
                    className="flex-1 space-y-4 border-r border-grid p-6 last:border-r-0"
                  >
                    <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                      {b.label}
                    </p>
                    <p
                      className={`tnum font-mono text-[26px] leading-none ${
                        b.tone === "accent" ? "text-accent" : "text-text-primary"
                      }`}
                    >
                      {b.value}
                    </p>
                  </div>
                ))}
              </div>

              <p className="pt-6 font-ui text-[13.5px] text-text-secondary">
                {FUND.balanceNote}
              </p>
            </section>

            {/* ------------------------------------------------- adequacy */}
            <section className="px-8 py-8">
              <SectionHead
                index="02"
                title="CAPITAL ADEQUACY"
                note="Computed for this strategy"
              />

              <div className="grid grid-cols-[minmax(0,1fr)_140px_90px] items-center gap-6 border-b border-grid pb-3.5 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                <span>Check</span>
                <span className="text-right">Value</span>
                <span className="text-right">Result</span>
              </div>

              {FUND.checks.map((c) => (
                <div key={c.name} className="border-b border-grid py-6">
                  <div className="grid grid-cols-[minmax(0,1fr)_140px_90px] items-center gap-6">
                    <span className="font-mono text-[13.5px] text-text-primary">
                      {c.name}
                    </span>
                    <span className="tnum text-right font-mono text-[13.5px] text-text-primary">
                      {c.value}
                    </span>
                    <span className="justify-self-end">
                      <Badge tone={c.tone}>{c.result}</Badge>
                    </span>
                  </div>
                  <p className="pt-3 font-ui text-[13px] text-text-dim">{c.body}</p>
                </div>
              ))}
            </section>
          </>
        }
        rail={
          <>
            <div className="border-b border-grid px-8 py-7">
              <div className="flex items-center justify-between pb-2">
                <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                  Readiness
                </h3>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  4 of 4
                </span>
              </div>
              {FUND.readiness.map((item, i) => (
                <div
                  key={item}
                  className="flex items-center justify-between border-b border-grid py-3.5 last:border-b-0"
                >
                  <span className="flex items-center gap-3.5">
                    <CheckIcon className="text-accent" />
                    <span className="font-mono text-[13px] text-text-primary">
                      {item}
                    </span>
                  </span>
                  <span className="tnum font-mono text-[10px] text-text-dim">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-b border-grid px-8 py-7">
              <div className="flex items-center justify-between pb-4">
                <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                  First run
                </h3>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  Dry run · 7 days
                </span>
              </div>
              <p className="pb-6 font-ui text-[13.5px] leading-relaxed text-text-secondary">
                {FUND.firstRun}
              </p>
              <PrimaryButton href="/portfolio/alpha_hunter">
                Start dry run <ArrowRight />
              </PrimaryButton>
              <div className="flex gap-2.5 pt-4">
                <ShieldGlyph />
                <p className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
                  No funds at risk during dry run
                </p>
              </div>
            </div>
          </>
        }
      />
    </main>
  );
}

function ShieldGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="mt-px size-3.5 shrink-0 text-text-dim" aria-hidden>
      <path
        d="M8 2 13 4v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V4l5-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
