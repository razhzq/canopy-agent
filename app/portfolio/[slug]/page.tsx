import Link from "next/link";
import {
  ChartGrid,
  DrawdownBars,
  EquityBars,
  SegmentMeter,
} from "@/components/charts";
import { MONITOR as M, drawdownSeries, equitySeries } from "@/lib/data";
import {
  AgentTile,
  ArrowRight,
  Badge,
  Breadcrumb,
  ChevronRight,
  Columns,
  Pill,
  RailRow,
  RailSection,
  SectionHead,
} from "@/components/ui";

export default function MonitorPage() {
  const equity = equitySeries(42, 4242, { start: 0.12, end: 0.96 });
  const drawdown = drawdownSeries(42, 5353, 1);

  return (
    <main>
      {/* ---------------------------------------------------------- header */}
      <section className="flex items-end justify-between border-b border-grid px-8 pt-[22px] pb-[18px]">
        <div className="space-y-3">
          <Breadcrumb parts={["Portfolio", "My agents"]} />
          <div className="flex items-center gap-4">
            <h1 className="font-mono text-[34px] leading-none text-text-primary">
              {M.name}
            </h1>
            <Pill>Running</Pill>
          </div>
          <div className="flex items-center gap-5 font-mono text-[11px] tracking-[0.06em] text-text-dim uppercase">
            <span>
              Mode <span className="text-text-secondary">{M.mode}</span>
            </span>
            <span className="text-grid-strong">|</span>
            <span>
              Mandate expires in{" "}
              <span className="text-text-secondary">{M.expiresIn}</span>
            </span>
            <span className="text-grid-strong">|</span>
            <span>
              Deployed <span className="text-text-secondary">{M.deployed}</span>
            </span>
            <span className="text-grid-strong">|</span>
            <span>
              Next cycle{" "}
              <span className="text-text-secondary">{M.nextCycle}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-11 items-center gap-2.5 border border-border px-5 font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase transition-colors hover:text-text-primary"
          >
            <PauseGlyph /> Pause
          </button>
          <button
            type="button"
            className="flex h-11 items-center gap-2.5 border border-negative px-5 font-mono text-[11px] tracking-[0.1em] text-negative uppercase transition-colors hover:bg-negative/10"
          >
            <StopGlyph /> Stop &amp; revoke
          </button>
        </div>
      </section>

      {/* ---------------------------------------------------------- ribbon */}
      <section className="flex border-b border-grid bg-panel px-8">
        {M.stats.map((s, i) => (
          <div
            key={s.label}
            className={`flex-1 px-6 py-6 ${i > 0 ? "border-l border-grid" : ""} ${i === 0 ? "pl-0" : ""}`}
          >
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                {s.label}
              </span>
              <span
                className={`tnum font-mono text-[21px] leading-none ${
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
          </div>
        ))}
      </section>

      <Columns
        main={
          <>
            {/* ---------------------------------------------------- equity */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="01"
                title="EQUITY SINCE DEPLOY"
                note="45 days · Marked to market"
              />
              <ChartGrid height={230}>
                <EquityBars values={equity} height={230} />
              </ChartGrid>

              <div className="mt-8 border-t border-grid pt-6">
                <div className="flex items-center justify-between pb-3">
                  <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                    Drawdown from peak
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                    Current <span className="text-negative">−3.10%</span> · Limit{" "}
                    <span className="text-text-secondary">−20.00%</span>
                  </span>
                </div>
                <DrawdownBars values={drawdown} height={70} />
              </div>
            </section>

            {/* ------------------------------------------------- positions */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="02"
                title="OPEN POSITIONS"
                note="3 of 6 slots used"
              />

              <div className="grid grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr_1fr_1fr_60px_120px] items-center gap-4 border-b border-grid pb-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                <span>Asset</span>
                <span className="text-right">Size</span>
                <span className="text-right">Entry</span>
                <span className="text-right">Mark</span>
                <span className="text-right">P&amp;L</span>
                <span className="text-right">Stop</span>
                <span className="text-right">Held</span>
                <span className="text-right">Opened by</span>
              </div>

              {M.positions.map((p) => (
                <div
                  key={p.asset}
                  className="grid grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr_1fr_1fr_60px_120px] items-center gap-4 border-b border-grid py-5 last:border-b-0"
                >
                  <span className="flex items-center gap-4">
                    <AgentTile size={26} />
                    <span className="font-mono text-[14px] text-text-primary">
                      {p.asset}
                    </span>
                  </span>
                  <span className="tnum text-right font-mono text-[13px] text-text-primary">
                    {p.size}
                  </span>
                  <span className="tnum text-right font-mono text-[13px] text-text-secondary">
                    {p.entry}
                  </span>
                  <span className="tnum text-right font-mono text-[13px] text-text-secondary">
                    {p.mark}
                  </span>
                  <span
                    className={`tnum text-right font-mono text-[13px] ${
                      p.pnlTone === "accent" ? "text-accent" : "text-negative"
                    }`}
                  >
                    {p.pnl}
                  </span>
                  <span className="tnum text-right font-mono text-[13px] text-text-secondary">
                    {p.stop}
                  </span>
                  <span className="tnum text-right font-mono text-[13px] text-text-dim">
                    {p.held}
                  </span>
                  <Link
                    href={`/portfolio/alpha_hunter/cycles/${p.cycle}`}
                    className="flex items-center justify-end gap-1.5 font-mono text-[11px] tracking-[0.08em] text-accent uppercase"
                  >
                    Cycle {p.cycle} <ArrowRight className="size-3" />
                  </Link>
                </div>
              ))}
            </section>

            {/* ---------------------------------------------- decision log */}
            <section className="px-8 py-8">
              <SectionHead
                index="03"
                title="DECISION LOG"
                note={
                  <span className="flex items-center gap-5">
                    Every proposal · Including blocks
                    <button type="button" className="text-accent">
                      Export CSV
                    </button>
                    <Link
                      href="/portfolio/alpha_hunter/cycles"
                      className="flex items-center gap-1.5 text-accent"
                    >
                      View all 128 cycles <ArrowRight className="size-3" />
                    </Link>
                  </span>
                }
              >
                <Badge tone="accent">Delegated · No approval required</Badge>
              </SectionHead>

              <div className="grid grid-cols-[110px_110px_130px_110px_90px_minmax(0,1fr)_24px] items-center gap-5 border-b border-grid pb-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                <span>Cycle</span>
                <span>Outcome</span>
                <span>Decided by</span>
                <span>Action</span>
                <span>Size</span>
                <span>Reason</span>
                <span />
              </div>

              {M.decisions.map((d, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[110px_110px_130px_110px_90px_minmax(0,1fr)_24px] items-center gap-5 border-b border-grid py-6"
                >
                  <span className="tnum font-mono text-[12px] text-accent">
                    {d.cycle} · {d.time}
                  </span>
                  <span>
                    <Badge tone={d.tone}>{d.outcome}</Badge>
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.06em] text-text-secondary uppercase">
                    {d.by}
                  </span>
                  <span className="font-mono text-[12.5px] tracking-[0.04em] text-text-primary uppercase">
                    {d.action}
                  </span>
                  <span className="tnum font-mono text-[12.5px] text-text-secondary">
                    {d.size}
                  </span>
                  <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
                    {d.reason}
                  </p>
                  <ChevronRight className="justify-self-end text-text-dim" />
                </div>
              ))}

              <div className="mt-7 flex gap-4">
                <div className="w-0.5 shrink-0 self-stretch bg-accent" />
                <div className="flex gap-3 pl-1">
                  <ShieldGlyph />
                  <div className="space-y-3">
                    <p className="max-w-[880px] font-ui text-[13px] leading-relaxed text-text-secondary">
                      {M.decisionNote}
                    </p>
                    <Link
                      href="/portfolio/alpha_hunter/cycles/128"
                      className="flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] text-accent uppercase"
                    >
                      Open any cycle to see the full agent trace{" "}
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </>
        }
        rail={
          <>
            <RailSection title="Limit utilisation" note="Live">
              <div className="space-y-6 pt-3">
                {M.utilisation.map((u) => (
                  <div key={u.label} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                        {u.label}
                      </span>
                      <span className="tnum font-mono text-[12px] text-text-primary">
                        {u.value}
                      </span>
                    </div>
                    <SegmentMeter fraction={u.fraction} tone={u.tone} />
                  </div>
                ))}
              </div>
            </RailSection>

            <RailSection title="Cycle budget" note="This cycle">
              {M.budget.map(([k, v]) => (
                <RailRow key={k} label={k} value={v} />
              ))}
            </RailSection>

            <RailSection title="Module health" note="5 bound">
              {M.modules.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between gap-4 border-b border-grid py-3.5"
                >
                  <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                    {k}
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="font-mono text-[11px] tracking-[0.06em] text-text-secondary uppercase">
                      {v}
                    </span>
                    <Badge tone="accent">OK</Badge>
                  </span>
                </div>
              ))}
            </RailSection>

            <div className="px-8 py-7">
              <h3 className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                Controls
              </h3>
              <div className="space-y-3">
                {["Adjust limits", "Extend mandate", "Export decision log"].map(
                  (c) => (
                    <button
                      key={c}
                      type="button"
                      className="flex h-11 w-full items-center gap-3 border border-border px-4 font-mono text-[11px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:text-text-primary"
                    >
                      {c}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-center gap-3 border border-negative font-mono text-[11px] tracking-[0.08em] text-negative uppercase transition-colors hover:bg-negative/10"
                >
                  <StopGlyph /> Stop &amp; revoke delegation
                </button>
              </div>
            </div>
          </>
        }
      />
    </main>
  );
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <path d="M5.5 3.5v9M10.5 3.5v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StopGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <rect x="4" y="4" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function ShieldGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden>
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
