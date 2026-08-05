import {
  ChartGrid,
  DayBlocks,
  EquityBars,
  TickScale,
} from "@/components/charts";
import { BUILD_STAGES, PUBLISH as P, equitySeries } from "@/lib/data";
import {
  Badge,
  CheckIcon,
  Columns,
  InfoIcon,
  LockIcon,
  SectionHead,
  WarnIcon,
} from "@/components/ui";
import { StepBar } from "@/components/wizard";

export default function PublishPage() {
  /* The live paper run so far — one point per day of the verification window. */
  const paperEquity = equitySeries(P.day, 3311, { start: 0.5, end: 0.72, jitter: 0.08 });

  return (
    <main>
      <StepBar steps={BUILD_STAGES} current={1} />

      {/* ---------------------------------------------------------- header */}
      <section className="flex items-end justify-between border-b border-grid px-8 pt-6 pb-6">
        <div className="space-y-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            {P.name} · Unlisted
          </p>
          <div className="flex items-center gap-4">
            <h1 className="font-mono text-[34px] leading-none text-text-primary">
              Publish
            </h1>
            <Badge tone="warning">
              Verifying · Day {P.day} of {P.totalDays}
            </Badge>
          </div>
          <p className="font-ui text-[14px] text-text-secondary">
            The agent is paper-trading live data in public. It can be listed
            once the record below is complete.
          </p>
        </div>

        <div className="flex shrink-0">
          {P.headline.map((h, i) => (
            <div
              key={h.label}
              className={`px-7 ${i > 0 ? "border-l border-grid" : ""}`}
            >
              <div className="flex flex-col items-end gap-2.5">
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {h.label}
                </span>
                <span
                  className={`tnum font-mono text-[21px] leading-none ${
                    h.tone === "accent"
                      ? "text-accent"
                      : h.tone === "negative"
                        ? "text-negative"
                        : "text-warning"
                  }`}
                >
                  {h.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Columns
        main={
          <>
            {/* ------------------------------------------------ paper run */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="01"
                title="LIVE PAPER RECORD"
                note={`Run by Canopy · Day ${P.day} of ${P.totalDays} · Forward only`}
              />

              <ChartGrid height={210}>
                <EquityBars values={paperEquity} height={210} />
              </ChartGrid>

              <div className="flex items-center justify-between gap-6 pt-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                <span className="shrink-0">Day 1</span>
                <span className="truncate">Accrued in real time</span>
                <span className="shrink-0">Day {P.totalDays}</span>
              </div>

              <div className="mt-7 flex border border-grid">
                {P.paperStats.map((s, i) => (
                  <div
                    key={s.label}
                    className={`flex flex-1 flex-col gap-2.5 p-5 ${
                      i > 0 ? "border-l border-grid" : ""
                    }`}
                  >
                    <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                      {s.label}
                    </span>
                    <span
                      className={`tnum font-mono text-[19px] leading-none ${
                        s.tone === "accent"
                          ? "text-accent"
                          : s.tone === "negative"
                            ? "text-negative"
                            : "text-text-primary"
                      }`}
                    >
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-4 bg-panel px-5 py-5">
                <div className="w-0.5 shrink-0 self-stretch bg-grid-strong" />
                <div className="flex gap-3">
                  <InfoIcon className="mt-0.5 shrink-0 text-text-dim" />
                  <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
                    {P.paperNote}
                  </p>
                </div>
              </div>
            </section>

            {/* --------------------------------------------- verification */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="02"
                title="VERIFICATION"
                note="Live data · Paper execution · Public"
              />

              <div className="flex items-center justify-between pb-3">
                <span className="font-mono text-[11px] tracking-[0.08em] text-text-secondary uppercase">
                  Day {P.day} of {P.totalDays}
                </span>
                <span className="font-mono text-[11px] tracking-[0.08em] text-warning uppercase">
                  {P.totalDays - P.day} days remaining
                </span>
              </div>

              <DayBlocks total={P.totalDays} done={P.day} />

              <div className="mt-7">
                {P.checks.map((c) => (
                  <div
                    key={c.name}
                    className="grid grid-cols-[minmax(0,1fr)_120px_110px] items-center gap-5 border-b border-grid py-4"
                  >
                    <span className="flex items-center gap-4">
                      {c.done ? (
                        <CheckIcon className="shrink-0 text-accent" />
                      ) : (
                        <PendingGlyph />
                      )}
                      <span className="font-mono text-[13px] text-text-primary">
                        {c.name}
                      </span>
                    </span>
                    <span className="tnum text-right font-mono text-[13px] text-text-primary">
                      {c.value}
                    </span>
                    <span className="justify-self-end">
                      <Badge tone={c.tone}>{c.state}</Badge>
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex border border-grid">
                {P.paperStats.map((s) => (
                  <div
                    key={s.label}
                    className="flex-1 space-y-3.5 border-r border-grid p-5 last:border-r-0"
                  >
                    <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                      {s.label}
                    </p>
                    <p
                      className={`tnum font-mono text-[20px] leading-none ${
                        s.tone === "accent"
                          ? "text-accent"
                          : s.tone === "negative"
                            ? "text-negative"
                            : "text-text-primary"
                      }`}
                    >
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex gap-4 bg-panel px-5 py-5">
                <div className="w-0.5 shrink-0 self-stretch bg-warning" />
                <div className="flex gap-3">
                  <WarnIcon className="mt-0.5 shrink-0 text-warning" />
                  <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
                    {P.appendOnlyNote}
                  </p>
                </div>
              </div>
            </section>

            {/* -------------------------------------------------- your fee */}
            <section className="px-8 py-8">
              <SectionHead
                index="03"
                title="YOUR FEE"
                note="Charged on profit only"
              />

              <div className="flex items-end justify-between pb-7">
                <span className="tnum font-mono text-[46px] leading-none text-text-primary">
                  {P.fee.pct}%
                </span>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  Of profit · Cap {P.fee.cap}%
                </span>
              </div>

              <TickScale fraction={P.fee.pct / (P.fee.cap * 1.5)} />
              <div className="flex justify-between pt-3 font-mono text-[10px] tracking-[0.08em] uppercase">
                <span className="text-text-dim">0%</span>
                <span className="text-warning">Cap {P.fee.cap}%</span>
              </div>

              <div className="mt-7 flex border border-grid">
                {P.fee.split.map((s) => (
                  <div
                    key={s.label}
                    className="flex-1 space-y-3.5 border-r border-grid p-5 last:border-r-0"
                  >
                    <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                      {s.label}
                    </p>
                    <p
                      className={`font-mono text-[15px] tracking-[0.04em] uppercase ${
                        s.tone === "accent" ? "text-accent" : "text-text-primary"
                      }`}
                    >
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              <p className="pt-6 font-ui text-[13.5px] leading-relaxed text-text-secondary">
                {P.fee.note}
              </p>
            </section>
          </>
        }
        rail={
          <>
            <div className="border-b border-grid px-8 py-7">
              <div className="flex items-center justify-between pb-4">
                <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                  Publication
                </h3>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  Locked
                </span>
              </div>

              <div className="flex h-14 w-full items-center justify-center gap-3 border border-grid bg-panel font-mono text-[12px] tracking-[0.1em] text-text-dim uppercase">
                <LockIcon /> Publish · Locked
              </div>
              <p className="pt-4 text-center font-mono text-[11px] tracking-[0.08em] text-warning uppercase">
                Available in {P.totalDays - P.day} days
              </p>

              <div className="mt-5 border-t border-grid">
                {P.remaining.map((r) => (
                  <div
                    key={r}
                    className="flex items-center gap-3.5 border-b border-grid py-3.5 last:border-b-0"
                  >
                    <PendingGlyph />
                    <span className="font-ui text-[13px] text-text-secondary">
                      {r}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-b border-grid px-8 py-7">
              <h3 className="pb-3 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                On publish
              </h3>
              {P.onPublish.map((line, i) => (
                <div
                  key={line}
                  className="grid grid-cols-[34px_minmax(0,1fr)] items-baseline gap-3 border-b border-grid py-4 last:border-b-0"
                >
                  <span className="tnum font-mono text-[11px] text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
                    {line}
                  </p>
                </div>
              ))}
            </div>

            <div className="px-8 py-7">
              <h3 className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                Actions
              </h3>
              <div className="space-y-3">
                <button
                  type="button"
                  className="flex h-11 w-full items-center gap-3 border border-border px-4 font-mono text-[11px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:text-text-primary"
                >
                  View public paper run
                </button>
                <button
                  type="button"
                  className="flex h-11 w-full items-center gap-3 border border-border px-4 font-mono text-[11px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:text-text-primary"
                >
                  Edit rules · Restarts 30 days
                </button>
                <button
                  type="button"
                  className="flex h-11 w-full items-center gap-3 border border-negative px-4 font-mono text-[11px] tracking-[0.08em] text-negative uppercase transition-colors hover:bg-negative/10"
                >
                  Abandon this draft
                </button>
              </div>
            </div>
          </>
        }
      />
    </main>
  );
}

function PendingGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-warning" aria-hidden>
      <circle cx="8" cy="8" r="5.8" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v3.2l2.2 1.3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
