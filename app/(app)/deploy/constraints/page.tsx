import { DEPLOY_STEPS } from "@/lib/data";
import { deployCopy, fill } from "@/lib/deployCopy";
import { getServerLocale } from "@/lib/i18n/server";
import {
  ArrowRight,
  Columns,
  GhostButton,
  InfoIcon,
  PrimaryButton,
  SectionHead,
} from "@/components/ui";
import {
  ChoiceCard,
  ChoiceRow,
  MandateRail,
  Proceed,
  StepBar,
  WizardHeader,
} from "@/components/wizard";

/**
 * The tickers are symbols and are the same in every language, so they stay
 * here rather than travelling through the copy bundle.
 */
const EXCLUDED = ["BONK", "WIF", "PEPE"];
const ALLOWED = [
  "SOL",
  "JUP",
  "JTO",
  "PYTH",
  "RAY",
  "ORCA",
  "DRIFT",
  "KMNO",
  "TNSR",
  "W",
  "JLP",
  "MNDE",
  "HNT",
  "RENDER",
  "IO",
];

/** Step 02 tightens the mandate written in step 01 but adds two fields. */
export default async function ConstraintsPage() {
  const c = deployCopy(await getServerLocale());
  const d = c.constraints;
  const data = c.constraintsData;

  return (
    <main>
      <StepBar steps={DEPLOY_STEPS} current={1} />

      <WizardHeader
        eyebrow={d.eyebrow}
        title={d.title}
        subtitle={d.subtitle}
        meta={[
          { label: c.agentLabel, value: "alpha_hunter" },
          { label: c.capitalLabel, value: c.mandate.capital },
          { label: d.universeLabel, value: d.universeValue, tone: "accent" },
        ]}
      />

      <Columns
        main={
          <>
            {/* -------------------------------------------------- universe */}
            <section className="border-b border-grid px-5 sm:px-8 py-8">
              <SectionHead index="01" title={d.secUniverse} note={d.secUniverseNote} />

              <ChoiceRow>
                {data.universeModes.map((m) => (
                  <ChoiceCard key={m.name} title={m.name} body={m.body} active={m.active} />
                ))}
              </ChoiceRow>

              <div className="mt-8">
                <p className="pb-4 font-mono text-[10px] tracking-[0.1em] text-negative uppercase">
                  {fill(d.excluded, { count: EXCLUDED.length })}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {EXCLUDED.map((asset) => (
                    <span
                      key={asset}
                      className="flex items-center gap-2.5 border border-negative px-3 py-2 font-mono text-[11px] tracking-[0.06em] text-negative uppercase"
                    >
                      {asset} <span className="text-[12px] leading-none">×</span>
                    </span>
                  ))}
                  <button
                    type="button"
                    className="border border-border px-3 py-2 font-mono text-[11px] tracking-[0.06em] text-text-dim uppercase transition-colors hover:text-text-secondary"
                  >
                    {d.addExclusion}
                  </button>
                </div>
              </div>

              <div className="mt-7">
                <p className="pb-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {fill(d.allowed, { count: ALLOWED.length })}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {ALLOWED.map((asset) => (
                    <span
                      key={asset}
                      className="border border-grid-strong px-3 py-2 font-mono text-[11px] tracking-[0.06em] text-text-secondary uppercase"
                    >
                      {asset}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* ------------------------------------------------ compliance */}
            <section className="border-b border-grid px-5 sm:px-8 py-8">
              <SectionHead index="02" title={d.secCompliance} note={d.secComplianceNote} />

              <ChoiceRow>
                {data.complianceProfiles.map((p) => (
                  <ChoiceCard
                    key={p.name}
                    title={p.name}
                    body={p.body}
                    meta={p.meta}
                    metaTone={p.metaTone}
                    active={p.active}
                  />
                ))}
              </ChoiceRow>

              <div className="mt-6 flex gap-4 bg-panel px-5 py-5">
                <div className="w-0.5 shrink-0 self-stretch bg-grid-strong" />
                <div className="flex gap-3">
                  <InfoIcon className="mt-0.5 shrink-0 text-text-dim" />
                  <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
                    {data.complianceNote}
                  </p>
                </div>
              </div>
            </section>

            {/* --------------------------------------------------- cadence */}
            <section className="px-5 sm:px-8 py-8">
              <SectionHead index="03" title={d.secCadence} note={d.secCadenceNote} />
              <div className="flex border border-grid">
                {data.cadence.map((row) => (
                  <div key={row.label} className="flex-1 border-r border-grid p-6 last:border-r-0">
                    <p className="pb-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                      {row.label}
                    </p>
                    <p className="pb-2.5 font-mono text-[20px] tracking-[0.04em] text-text-primary uppercase">
                      {row.value}
                    </p>
                    <p className="font-ui text-[12.5px] text-text-dim">{row.note}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        }
        rail={
          <>
            <MandateRail rows={c.mandate.railRows} />
            <Proceed
              step={2}
              total={5}
              primary={
                <PrimaryButton href="/deploy/autonomy">
                  {d.continue} <ArrowRight />
                </PrimaryButton>
              }
              secondary={<GhostButton href="/deploy/describe">{c.back}</GhostButton>}
            />
          </>
        }
      />
    </main>
  );
}
