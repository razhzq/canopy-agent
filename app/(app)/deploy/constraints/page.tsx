import { CONSTRAINTS, DEPLOY_STEPS, MANDATE } from "@/lib/data";
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

/** Step 02 tightens the mandate written in step 01 but adds two fields. */
const RAIL_ROWS: [string, string, "neutral" | "accent"][] = [
  ["Capital", "$2,000.00", "neutral"],
  ["Posture", "MODERATE", "neutral"],
  ["Max position", "15%", "neutral"],
  ["Max drawdown", "20%", "neutral"],
  ["Universe", "15 OF 18", "accent"],
  ["Compliance", "SHARIAH", "accent"],
  ["Cadence", "HOURLY", "neutral"],
  ["Max hold", "10 DAYS", "neutral"],
];

export default function ConstraintsPage() {
  return (
    <main>
      <StepBar steps={DEPLOY_STEPS} current={1} />

      <WizardHeader
        eyebrow="New mandate · Step 02"
        title="Set the boundaries"
        subtitle="You can narrow what the agent is allowed to touch. You cannot widen it beyond its design."
        meta={[
          { label: "Agent", value: "alpha_hunter" },
          { label: "Capital", value: MANDATE.capital },
          { label: "Universe", value: "15 OF 18", tone: "accent" },
        ]}
      />

      <Columns
        main={
          <>
            {/* -------------------------------------------------- universe */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="01"
                title="ASSET UNIVERSE"
                note="The agent trades 18 · You have allowed 15"
              />

              <ChoiceRow>
                {CONSTRAINTS.universeModes.map((m) => (
                  <ChoiceCard
                    key={m.name}
                    title={m.name}
                    body={m.body}
                    active={m.active}
                  />
                ))}
              </ChoiceRow>

              <div className="mt-8">
                <p className="pb-4 font-mono text-[10px] tracking-[0.1em] text-negative uppercase">
                  Excluded by you · {CONSTRAINTS.excluded.length}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {CONSTRAINTS.excluded.map((asset) => (
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
                    + Add exclusion
                  </button>
                </div>
              </div>

              <div className="mt-7">
                <p className="pb-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  Allowed · {CONSTRAINTS.allowed.length}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {CONSTRAINTS.allowed.map((asset) => (
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
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="02"
                title="COMPLIANCE PROFILE"
                note="Applied before any sizing"
              />

              <ChoiceRow>
                {CONSTRAINTS.complianceProfiles.map((p) => (
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
                    {CONSTRAINTS.complianceNote}
                  </p>
                </div>
              </div>
            </section>

            {/* --------------------------------------------------- cadence */}
            <section className="px-8 py-8">
              <SectionHead index="03" title="CADENCE" note="How often it looks" />
              <div className="flex border border-grid">
                {CONSTRAINTS.cadence.map((c) => (
                  <div
                    key={c.label}
                    className="flex-1 border-r border-grid p-6 last:border-r-0"
                  >
                    <p className="pb-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                      {c.label}
                    </p>
                    <p className="pb-2.5 font-mono text-[20px] tracking-[0.04em] text-text-primary uppercase">
                      {c.value}
                    </p>
                    <p className="font-ui text-[12.5px] text-text-dim">{c.note}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        }
        rail={
          <>
            <MandateRail rows={RAIL_ROWS} />
            <Proceed
              step={2}
              total={5}
              primary={
                <PrimaryButton href="/deploy/autonomy">
                  Continue to autonomy <ArrowRight />
                </PrimaryButton>
              }
              secondary={
                <GhostButton href="/deploy/describe">Back</GhostButton>
              }
            />
          </>
        }
      />
    </main>
  );
}
