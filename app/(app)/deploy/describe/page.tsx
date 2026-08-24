import { LimitRow } from "@/components/charts";
import { DEPLOY_STEPS } from "@/lib/data";
import { deployCopy, fill } from "@/lib/deployCopy";
import { getServerLocale } from "@/lib/i18n/server";
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

export default async function DescribePage() {
  const c = deployCopy(await getServerLocale());
  const d = c.describe;
  const m = c.mandate;

  return (
    <main>
      <StepBar steps={DEPLOY_STEPS} current={0} />

      <WizardHeader
        eyebrow={d.eyebrow}
        title={d.title}
        meta={[
          { label: c.agentLabel, value: "alpha_hunter" },
          { label: c.classLabel, value: d.classValue },
          { label: c.venueLabel, value: d.venueValue },
        ]}
      />

      <Columns
        main={
          <>
            {/* ---------------------------------------------------- intent */}
            <section className="border-b border-grid px-5 sm:px-8 py-8">
              <SectionHead index="01" title={d.secIntent} note={d.secIntentNote} />

              <div className="border border-accent bg-panel">
                <p className="p-6 font-mono text-[14px] leading-relaxed text-text-primary">
                  {m.intent}
                </p>
                <div className="flex items-center justify-between px-6 pb-4 font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
                  <span className="tnum">{fill(d.charCount, { used: m.intentChars })}</span>
                  <span>{d.noJargon}</span>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {d.presetsLabel}
                </span>
                {d.presets.map((p) => (
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
                    {d.parseOutput}
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                    {fill(d.parseCount, {
                      resolved: m.parse.resolved,
                      defaulted: m.parse.defaulted,
                    })}
                  </span>
                </div>

                <div className="flex gap-12 px-6">
                  {[m.parse.left, m.parse.right].map((col, ci) => (
                    <div key={ci} className="flex-1">
                      {col.map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between border-b border-grid py-3.5"
                        >
                          <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                            {k}
                          </span>
                          <span className="tnum font-mono text-[12px] text-accent">{v}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 px-6 py-5">
                  <WarnIcon className="mt-px shrink-0 text-warning" />
                  <p className="font-ui text-[13px] text-text-secondary">{m.parse.warning}</p>
                </div>
              </div>
            </section>

            {/* --------------------------------------------------- capital */}
            <section className="border-b border-grid px-5 sm:px-8 py-8">
              <SectionHead
                index="02"
                title={d.secCapital}
                note={fill(d.secCapitalNote, { balance: m.walletBalance })}
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
                    {d.allocation}
                  </span>
                  <span className="tnum font-mono text-[14px] tracking-[0.06em] text-accent uppercase">
                    {fill(d.allocationValue, { pct: m.allocationPct })}
                  </span>
                </div>
              </div>

              <div className="mt-7 h-1.5 w-full bg-surface-2">
                <div className="h-full bg-accent" style={{ width: `${m.allocationPct}%` }} />
              </div>

              <div className="mt-5 flex border border-grid">
                {d.capitalStops.map((stop, i) => (
                  <button
                    key={stop}
                    type="button"
                    className={`flex-1 border-r border-grid py-4 font-mono text-[13px] last:border-r-0 ${
                      // By POSITION, not by matching the label: the last stop
                      // carries a translated "MAX" and the third is the one
                      // that is selected in the mock.
                      i === 2
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
            <section className="border-b border-grid px-5 sm:px-8 py-8">
              <SectionHead index="03" title={d.secPosture} note={d.secPostureNote} />
              <ChoiceRow>
                {m.postures.map((p) => (
                  <ChoiceCard key={p.name} title={p.name} active={p.active}>
                    <div className="mt-1">
                      {[
                        [d.postureCols.pos, p.pos],
                        [d.postureCols.dd, p.dd],
                        [d.postureCols.slip, p.slip],
                      ].map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between border-b border-grid py-2.5 last:border-b-0"
                        >
                          <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                            {k}
                          </span>
                          <span className="tnum font-mono text-[12px] text-text-primary">{v}</span>
                        </div>
                      ))}
                    </div>
                  </ChoiceCard>
                ))}
              </ChoiceRow>
            </section>

            {/* ---------------------------------------------------- limits */}
            <section className="px-5 sm:px-8 py-8">
              <SectionHead index="04" title={d.secLimits} note={d.secLimitsNote} />
              <div className="divide-y divide-grid">
                {m.limits.map((l) => (
                  <LimitRow key={l.label} {...l} />
                ))}
              </div>

              <div className="mt-6 flex gap-4 bg-panel px-5 py-5">
                <div className="w-0.5 shrink-0 self-stretch bg-warning" />
                <div className="flex gap-3">
                  <WarnIcon className="mt-0.5 shrink-0 text-warning" />
                  <div className="space-y-1.5">
                    <p className="font-mono text-[12px] tracking-[0.06em] text-text-primary uppercase">
                      {m.drawdownWarning.title}
                    </p>
                    <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
                      {m.drawdownWarning.body}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </>
        }
        rail={
          <>
            <div className="border-b border-grid px-5 sm:px-8 py-7">
              <p className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                {d.targetAgent}
              </p>
              <div className="flex items-center gap-4">
                <AgentTile size={40} />
                <div className="space-y-1.5">
                  <p className="font-mono text-[15px] text-text-primary">alpha_hunter</p>
                  <p className="font-mono text-[10px] tracking-[0.06em] text-text-dim uppercase">
                    {d.targetAgentSub}
                  </p>
                </div>
              </div>
            </div>

            <MandateRail rows={m.rows} readsAs={m.readsAs} />

            <Proceed
              step={1}
              total={5}
              primary={
                <PrimaryButton href="/deploy/constraints">
                  {d.continue} <ArrowRight />
                </PrimaryButton>
              }
              note={d.proceedNote}
            />
          </>
        }
      />
    </main>
  );
}
