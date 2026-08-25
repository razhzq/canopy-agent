import { DEPLOY_STEPS } from "@/lib/data";
import { deployCopy } from "@/lib/deployCopy";
import { getServerLocale } from "@/lib/i18n/server";
import { ArrowRight, Badge, CheckIcon, Columns, PrimaryButton, SectionHead } from "@/components/ui";
import { StepBar, WizardHeader } from "@/components/wizard";

export default async function FundPage() {
  const c = deployCopy(await getServerLocale());
  const d = c.fund;
  const data = c.fundData;

  return (
    <main>
      <StepBar steps={DEPLOY_STEPS} current={4} />

      <WizardHeader
        eyebrow={d.eyebrow}
        title={d.title}
        meta={[
          { label: c.agentLabel, value: "alpha_hunter" },
          { label: c.delegationLabel, value: d.delegationValue, tone: "accent" },
          { label: c.statusLabel, value: d.statusValue, tone: "warning" },
        ]}
      />

      <Columns
        main={
          <>
            {/* --------------------------------------------------- balance */}
            <section className="border-b border-grid px-5 sm:px-8 py-8">
              <SectionHead index="01" title={d.secBalance} note={d.secBalanceNote} />

              <div className="flex border border-grid">
                {data.balance.map((b) => (
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

              <p className="pt-6 font-ui text-[13.5px] text-text-secondary">{data.balanceNote}</p>
            </section>

            {/* ------------------------------------------------- adequacy */}
            <section className="px-5 sm:px-8 py-8">
              <SectionHead index="02" title={d.secAdequacy} note={d.secAdequacyNote} />

              <div className="grid grid-cols-[minmax(0,1fr)_140px_90px] items-center gap-6 border-b border-grid pb-3.5 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                <span>{d.colCheck}</span>
                <span className="text-right">{d.colValue}</span>
                <span className="text-right">{d.colResult}</span>
              </div>

              {data.checks.map((check) => (
                <div key={check.name} className="border-b border-grid py-6">
                  <div className="grid grid-cols-[minmax(0,1fr)_140px_90px] items-center gap-6">
                    <span className="font-mono text-[13.5px] text-text-primary">{check.name}</span>
                    <span className="tnum text-right font-mono text-[13.5px] text-text-primary">
                      {check.value}
                    </span>
                    <span className="justify-self-end">
                      <Badge tone={check.tone}>{check.result}</Badge>
                    </span>
                  </div>
                  <p className="pt-3 font-ui text-[13px] text-text-dim">{check.body}</p>
                </div>
              ))}
            </section>
          </>
        }
        rail={
          <>
            <div className="border-b border-grid px-5 sm:px-8 py-7">
              <div className="flex items-center justify-between pb-2">
                <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                  {d.readiness}
                </h3>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {d.readinessCount}
                </span>
              </div>
              {data.readiness.map((item, i) => (
                <div
                  key={item}
                  className="flex items-center justify-between border-b border-grid py-3.5 last:border-b-0"
                >
                  <span className="flex items-center gap-3.5">
                    <CheckIcon className="text-accent" />
                    <span className="font-mono text-[13px] text-text-primary">{item}</span>
                  </span>
                  <span className="tnum font-mono text-[10px] text-text-dim">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-b border-grid px-5 sm:px-8 py-7">
              <div className="flex items-center justify-between pb-4">
                <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                  {d.firstRun}
                </h3>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {d.firstRunNote}
                </span>
              </div>
              <p className="pb-6 font-ui text-[13.5px] leading-relaxed text-text-secondary">
                {data.firstRun}
              </p>
              <PrimaryButton href="/portfolio/alpha_hunter">
                {d.startDryRun} <ArrowRight />
              </PrimaryButton>
              <div className="flex gap-2.5 pt-4">
                <ShieldGlyph />
                <p className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
                  {d.noFundsAtRisk}
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
