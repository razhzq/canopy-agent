import { HourHistogram, TickScale } from "@/components/charts";
import { DEPLOY_STEPS } from "@/lib/data";
import { deployCopy, fill } from "@/lib/deployCopy";
import { getServerLocale } from "@/lib/i18n/server";
import {
  ArrowRight,
  Columns,
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
 * Proposals per UTC hour over the agent's last 30 days.
 *
 * Numbers, so they live here rather than in the copy bundle — there is nothing
 * about a histogram to translate but the words beside it.
 */
const HOURS = [
  0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0,
].map((count, i) => ({ count, withinWindow: i >= 9 && i < 18 }));

const TERM_DAYS = 90;
const TERM_FRACTION = (90 - 7) / (365 - 7);
const WITHIN = 3;
const OUTSIDE = 4;

export default async function AutonomyPage() {
  const c = deployCopy(await getServerLocale());
  const d = c.autonomy;
  const data = c.autonomyData;

  return (
    <main>
      <StepBar steps={DEPLOY_STEPS} current={2} />

      <WizardHeader
        eyebrow={d.eyebrow}
        title={d.title}
        subtitle={d.subtitle}
        meta={[
          { label: c.agentLabel, value: "alpha_hunter" },
          { label: c.capitalLabel, value: c.mandate.capital },
          { label: c.modeLabel, value: d.modeValue, tone: "accent" },
        ]}
      />

      <Columns
        main={
          <>
            {/* --------------------------------------------------- levels */}
            <section className="border-b border-grid px-5 sm:px-8 py-8">
              <SectionHead index="01" title={d.secLevel} note={d.secLevelNote} />

              <ChoiceRow>
                {data.modes.map((m) => (
                  <ChoiceCard
                    key={m.name}
                    title={m.name}
                    body={m.body}
                    active={m.active}
                    icon={m.active ? <HandGlyph /> : <BoltGlyph />}
                  >
                    <div className="mt-2">
                      {m.points.map((p) => (
                        <div
                          key={p}
                          className="flex items-start gap-3 border-b border-grid py-3.5 last:border-b-0"
                        >
                          <span className="mt-2 h-px w-2.5 shrink-0 bg-text-dim" />
                          <span className="font-ui text-[13px] text-text-secondary">{p}</span>
                        </div>
                      ))}
                    </div>
                    <span
                      className={`mt-3 self-start border px-2.5 py-1.5 font-mono text-[10px] tracking-[0.08em] uppercase ${
                        m.active
                          ? "border-accent text-accent"
                          : "border-grid-strong text-text-dim"
                      }`}
                    >
                      {m.tag}
                    </span>
                  </ChoiceCard>
                ))}
              </ChoiceRow>
            </section>

            {/* -------------------------------------------------- what changes */}
            <section className="border-b border-grid px-5 sm:px-8 py-8">
              <SectionHead index="02" title={d.secChanges} note={d.secChangesNote} />

              <p className="pb-6 font-mono text-[11px] tracking-[0.08em] text-text-secondary uppercase">
                {d.byHour}
              </p>

              <HourHistogram hours={HOURS} height={80} />

              <div className="mt-6 flex items-center gap-8 font-mono text-[10px] tracking-[0.08em] text-text-secondary uppercase">
                <span className="flex items-center gap-2.5">
                  <span className="size-2.5 bg-accent" /> {d.within}{" "}
                  <span className="text-accent">{WITHIN}</span>
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="size-2.5 bg-warning" /> {d.outside}{" "}
                  <span className="text-warning">{OUTSIDE}</span>
                </span>
              </div>

              <div className="mt-8 border border-grid">
                <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-grid px-6 py-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  <span />
                  <span>{d.colAdvisory}</span>
                  <span>{d.colDelegated}</span>
                </div>
                {data.comparison.map(([label, advisory, delegated]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] items-center border-b border-grid px-6 py-4 last:border-b-0"
                  >
                    <span className="font-mono text-[12.5px] text-text-secondary">{label}</span>
                    <span className="font-mono text-[12.5px] text-accent">{advisory}</span>
                    <span className="font-mono text-[12.5px] text-text-primary">{delegated}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* ------------------------------------------------------ term */}
            <section className="px-5 sm:px-8 py-8">
              <SectionHead index="03" title={d.secTerm} note={d.secTermNote} />

              <div className="flex items-end justify-between">
                <span className="font-mono text-[46px] leading-none tracking-[0.02em] text-text-primary uppercase">
                  {fill(d.days, { count: TERM_DAYS })}
                </span>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {fill(d.expires, { date: data.expires })}
                </span>
              </div>

              <div className="mt-7">
                <TickScale fraction={TERM_FRACTION} />
                <div className="flex justify-between pt-3 font-mono text-[10px] text-text-dim">
                  <span>{d.scaleMin}</span>
                  <span>{d.scaleMax}</span>
                </div>
              </div>

              <div className="mt-7 flex items-center justify-between border border-grid px-6 py-5">
                <div className="flex gap-4">
                  <RenewGlyph />
                  <div className="space-y-1.5">
                    <p className="font-mono text-[12px] tracking-[0.06em] text-text-primary uppercase">
                      {d.autoRenewTitle}
                    </p>
                    <p className="font-ui text-[13px] text-text-secondary">{d.autoRenewBody}</p>
                  </div>
                </div>
                <span className="shrink-0 border border-accent px-3 py-1.5 font-mono text-[10px] tracking-[0.1em] text-accent uppercase">
                  {d.off}
                </span>
              </div>

              <div className="mt-8">
                <p className="pb-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {d.atExpiry}
                </p>
                {data.atExpiry.map((line, i) => (
                  <div
                    key={line}
                    className="grid grid-cols-[40px_minmax(0,1fr)] items-baseline gap-4 border-b border-grid py-4 last:border-b-0"
                  >
                    <span className="tnum font-mono text-[11px] text-accent">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="font-ui text-[13.5px] text-text-secondary">{line}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        }
        rail={
          <>
            <MandateRail
              rows={c.mandate.autonomyRailRows}
              readsAs={c.mandate.readsAsWithCompliance}
            />
            <Proceed
              step={3}
              total={5}
              primary={
                <PrimaryButton href="/deploy/wallet">
                  {d.continue} <ArrowRight />
                </PrimaryButton>
              }
              note={d.proceedNote}
              noteIcon="info"
            />
          </>
        }
      />
    </main>
  );
}

function HandGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <path
        d="M5 7.5V4.2a1 1 0 0 1 2 0v3m0 0V3.2a1 1 0 0 1 2 0v4.3m0 0V4.5a1 1 0 0 1 2 0V9m0-1.2a1 1 0 0 1 2 0v3.4c0 2-1.6 3.3-3.6 3.3H8.4C6.2 14.5 5 13.1 5 11.2V7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BoltGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <path
        d="M9 1.5 3.5 9h4l-.5 5.5L12.5 7h-4l.5-5.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RenewGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-text-dim" aria-hidden>
      <path
        d="M2.5 5.5h9L9 3m4.5 5h-9L7 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
