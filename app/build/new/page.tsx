import { LimitRow, Sparkline } from "@/components/charts";
import { BUILD, BUILD_STEPS, sparkSeries } from "@/lib/data";
import {
  AgentTile,
  Badge,
  Columns,
  LockIcon,
  PrimaryButton,
  SectionHead,
  WarnIcon,
} from "@/components/ui";
import { ChoiceCard, ChoiceRow, StepBar } from "@/components/wizard";

export default function BuildAgentPage() {
  return (
    <main>
      <StepBar steps={BUILD_STEPS} current={0} />

      {/* ---------------------------------------------------------- header */}
      <section className="flex items-end justify-between border-b border-grid px-8 pt-6 pb-6">
        <div className="space-y-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            New agent · Draft
          </p>
          <div className="flex w-[520px] items-center justify-between border border-accent px-5 py-3.5">
            <span className="font-mono text-[24px] text-text-primary">
              {BUILD.name}
            </span>
            <button
              type="button"
              className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase"
            >
              Edit
            </button>
          </div>
          <p className="font-ui text-[14px] text-text-secondary">
            Define the rules. Canopy runs the backtest and the verification period,
            then it lists.
          </p>
        </div>

        <div className="flex shrink-0">
          {[
            { label: "Author", value: BUILD.author },
            { label: "Published", value: String(BUILD.published) },
            { label: "Delisted", value: String(BUILD.delisted), tone: "warning" },
          ].map((m, i) => (
            <div
              key={m.label}
              className={`px-7 ${i > 0 ? "border-l border-grid" : ""}`}
            >
              <div className="flex flex-col items-end gap-2.5">
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {m.label}
                </span>
                <span
                  className={`tnum font-mono text-[13px] ${
                    m.tone === "warning" ? "text-warning" : "text-text-primary"
                  }`}
                >
                  {m.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Columns
        main={
          <>
            {/* ------------------------------------------------ strategy */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="01"
                title="STRATEGY CLASS"
                note="Determines which specialist runs your rules"
              />
              <ChoiceRow>
                {BUILD.classes.map((c) => (
                  <ChoiceCard
                    key={c.name}
                    title={c.name}
                    body={c.body}
                    active={c.active}
                    icon={<TargetGlyph />}
                    meta={`Runs as ${c.runsAs}`}
                  />
                ))}
              </ChoiceRow>
            </section>

            {/* --------------------------------------------------- rules */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="02"
                title="DETECTION RULES"
                note="Deterministic · The model cannot override these"
              />
              <div className="divide-y divide-grid">
                {BUILD.rules.map((r) => (
                  <LimitRow key={r.label} {...r} />
                ))}
              </div>
            </section>

            {/* -------------------------------------------------- safety */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="03"
                title="SAFETY SCREEN"
                note="Mandatory · You cannot disable these"
              />

              {BUILD.safety.map((s) => (
                <div
                  key={s.name}
                  className="flex items-start justify-between gap-6 border-b border-grid py-5"
                >
                  <div className="flex gap-4">
                    <LockIcon className="mt-0.5 shrink-0 text-accent" />
                    <div className="space-y-1.5">
                      <p className="font-mono text-[13px] text-text-primary">
                        {s.name}
                      </p>
                      <p className="font-ui text-[13px] text-text-dim">{s.body}</p>
                    </div>
                  </div>
                  <Badge tone={s.tone}>{s.state}</Badge>
                </div>
              ))}

              <div className="mt-7 flex border border-grid">
                {BUILD.venue.map(([k, v, tone]) => (
                  <div
                    key={k}
                    className="flex-1 space-y-3.5 border-r border-grid p-5 last:border-r-0"
                  >
                    <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                      {k}
                    </p>
                    <p
                      className={`font-mono text-[14px] tracking-[0.04em] uppercase ${
                        tone === "warning" ? "text-warning" : "text-text-primary"
                      }`}
                    >
                      {v}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* --------------------------------------------- risk defaults */}
            <section className="px-8 py-8">
              <SectionHead
                index="04"
                title="RISK DEFAULTS"
                note="Starting values · Deployers may tighten, never loosen"
              />

              <div className="grid grid-cols-[minmax(0,1fr)_140px_140px] items-center gap-6 border-b border-grid pb-3.5 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                <span>Parameter</span>
                <span className="text-right">Default</span>
                <span className="text-right">Ceiling</span>
              </div>

              {BUILD.riskDefaults.map(([param, def, ceiling]) => (
                <div
                  key={param}
                  className="grid grid-cols-[minmax(0,1fr)_140px_140px] items-center gap-6 border-b border-grid py-4.5 last:border-b-0"
                >
                  <span className="font-mono text-[13px] text-text-secondary">
                    {param}
                  </span>
                  <span className="tnum text-right font-mono text-[13.5px] text-text-primary">
                    {def}
                  </span>
                  <span className="tnum text-right font-mono text-[12.5px] text-text-dim">
                    {ceiling}
                  </span>
                </div>
              ))}
            </section>
          </>
        }
        rail={
          <>
            {/* -------------------------------------------- listing preview */}
            <div className="border-b border-grid px-8 py-7">
              <div className="flex items-center justify-between pb-4">
                <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                  Listing preview
                </h3>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  Not yet listed
                </span>
              </div>

              <div className="border border-grid bg-panel p-5">
                <div className="flex items-center gap-4 pb-5">
                  <AgentTile size={36} />
                  <div className="space-y-1.5">
                    <p className="font-mono text-[14px] text-text-primary">
                      {BUILD.name}
                    </p>
                    <p className="font-mono text-[10px] tracking-[0.06em] text-text-dim">
                      SPOT · MODERATE · {BUILD.author}
                    </p>
                  </div>
                </div>
                <div className="flex border-t border-grid pt-4">
                  {["Return", "Max DD", "AUM", "Users"].map((k, i) => (
                    <div
                      key={k}
                      className={`flex-1 space-y-2.5 ${i > 0 ? "border-l border-grid pl-4" : ""}`}
                    >
                      <p className="font-mono text-[9.5px] tracking-[0.1em] text-text-dim uppercase">
                        {k}
                      </p>
                      <p className="font-mono text-[13px] text-text-dim">—</p>
                    </div>
                  ))}
                </div>
              </div>

              <p className="pt-4 font-ui text-[13px] leading-relaxed text-text-secondary">
                Performance stays blank until the backtest runs and the
                verification period completes. There is no way to list an agent
                with no record.
              </p>
            </div>

            {/* ------------------------------------------------- rule match */}
            <div className="border-b border-grid px-8 py-7">
              <div className="flex items-center justify-between pb-4">
                <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                  Rule match
                </h3>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  Last 30 days
                </span>
              </div>

              <div className="flex items-end justify-between pb-4">
                <span className="tnum font-mono text-[32px] leading-none text-accent">
                  {BUILD.ruleMatch.count}
                </span>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  Candidates matched
                </span>
              </div>

              <Sparkline
                values={sparkSeries(30, 7007, true)}
                width={372}
                height={34}
              />

              <p className="pt-4 font-ui text-[13px] leading-relaxed text-text-secondary">
                {BUILD.ruleMatch.note}
              </p>
            </div>

            {/* -------------------------------------------------------- next */}
            <div className="px-8 py-7">
              <h3 className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                Next
              </h3>
              <PrimaryButton href="/build/new/publish">
                <PlayGlyph /> Run backtest
              </PrimaryButton>

              <div className="mt-5 flex gap-4">
                <div className="w-0.5 shrink-0 self-stretch bg-warning" />
                <div className="flex gap-3 pl-1">
                  <WarnIcon className="mt-0.5 shrink-0 text-warning" />
                  <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
                    {BUILD.backtestNote}
                  </p>
                </div>
              </div>
            </div>
          </>
        }
      />
    </main>
  );
}

function TargetGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <path d="M5 3.5 12 8l-7 4.5v-9Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
