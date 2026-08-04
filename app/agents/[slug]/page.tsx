import Link from "next/link";
import {
  ChartGrid,
  DrawdownBars,
  EquityBars,
  MonthlyReturns,
} from "@/components/charts";
import { ALPHA_HUNTER as A, drawdownSeries, equitySeries } from "@/lib/data";
import {
  AgentTile,
  ArrowRight,
  Breadcrumb,
  Columns,
  InfoIcon,
  LockIcon,
  RailRow,
  RailSection,
  SectionHead,
} from "@/components/ui";

const TABS = ["Overview", "Track record", "Method", "Limits", "Decisions", "Fees"];
const RANGES = ["30D", "90D", "1Y", "All"];

export default function AgentDetailPage() {
  const equity = equitySeries(46, 1101, { start: 0.06, end: 0.98 });
  const drawdown = drawdownSeries(46, 2202, 1);

  return (
    <main>
      {/* ---------------------------------------------------------- header */}
      <section className="flex items-end justify-between border-b border-grid px-8 pt-[22px] pb-[18px]">
        <div className="space-y-3">
          <Breadcrumb parts={["Agents", "Community", "alpha_hunter"]} />
          <div className="flex items-center gap-4">
            <h1 className="font-mono text-[34px] leading-none text-text-primary">
              {A.name}
            </h1>
            <span className="inline-flex items-center gap-1.5 bg-accent-wash px-2 py-1.5 font-mono text-[10px] tracking-[0.1em] text-accent uppercase">
              <VerifiedGlyph /> Verified
            </span>
          </div>
          <div className="flex items-center gap-5 font-mono text-[11px] tracking-[0.06em] text-text-dim uppercase">
            {[
              ["Class", A.klass],
              ["Chain", A.chain],
              ["Posture", A.posture],
              ["Author", A.author],
            ].map(([k, v], i) => (
              <span key={k} className="flex items-center gap-5">
                {i > 0 ? <span className="text-grid-strong">|</span> : null}
                <span>
                  {k}{" "}
                  <span className={`text-text-secondary ${k === "Author" ? "normal-case" : ""}`}>
                    {v}
                  </span>
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-11 items-center gap-2.5 border border-border px-5 font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase transition-colors hover:text-text-primary"
          >
            <StarGlyph /> Watch
          </button>
          <Link
            href="/deploy/describe"
            className="flex h-11 items-center gap-2.5 bg-accent px-6 font-mono text-[11px] tracking-[0.1em] text-bg uppercase transition-opacity hover:opacity-90"
          >
            Deploy agent <ArrowRight />
          </Link>
        </div>
      </section>

      {/* ---------------------------------------------------------- ribbon */}
      <section className="flex border-b border-grid bg-panel px-8">
        {A.stats.map((s, i) => (
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

      {/* ------------------------------------------------------------ tabs */}
      <section className="flex border-b border-grid px-8">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            type="button"
            className={`border-b-2 px-5 py-5 font-mono text-[12px] tracking-[0.1em] uppercase transition-colors ${
              i === 0
                ? "border-accent text-text-primary"
                : "border-transparent text-text-dim hover:text-text-secondary"
            } ${i === 0 ? "pl-0" : ""}`}
          >
            {tab}
          </button>
        ))}
      </section>

      <Columns
        main={
          <>
            {/* ------------------------------------------------ performance */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead index="01" title="PERFORMANCE" note="Net of fees and slippage">
                <div className="flex border border-border">
                  {RANGES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`px-4 py-1.5 font-mono text-[11px] tracking-[0.06em] uppercase ${
                        r === "90D"
                          ? "bg-accent-wash text-accent"
                          : "text-text-dim hover:text-text-secondary"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </SectionHead>

              <ChartGrid height={260}>
                <EquityBars values={equity} height={260} />
              </ChartGrid>

              <div className="flex justify-between pt-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                {["Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>

              <div className="mt-8 border-t border-grid pt-6">
                <div className="flex items-center justify-between pb-3">
                  <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                    Drawdown from peak
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.1em] text-negative uppercase">
                    Worst −14.3%
                  </span>
                </div>
                <DrawdownBars values={drawdown} height={90} />
              </div>
            </section>

            {/* --------------------------------------------------- monthly */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="02"
                title="MONTHLY RETURNS"
                note={`${A.monthly.up} up · ${A.monthly.down} down · Best ${A.monthly.best} · Worst ${A.monthly.worst}`}
              />
              <MonthlyReturns
                values={A.monthly.values}
                labels={A.monthly.labels}
                height={130}
              />
            </section>

            {/* ---------------------------------------------------- method */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="03"
                title="METHOD"
                note="Deterministic · Model-assisted"
              />
              <p className="max-w-[880px] font-ui text-[14px] leading-relaxed text-text-secondary">
                Signals are computed from observed on-chain data, not inferred by a
                language model. The model reads the resulting candidate set, argues
                for or against each one, and writes the rationale you see in the
                decision log. It cannot originate a trade.
              </p>

              <div className="mt-8">
                {A.method.map((step) => (
                  <div
                    key={step.index}
                    className="grid grid-cols-[40px_120px_minmax(0,1fr)] items-baseline gap-4 border-b border-grid py-5"
                  >
                    <span className="tnum font-mono text-[11px] text-text-dim">
                      {step.index}
                    </span>
                    <span className="font-mono text-[12px] tracking-[0.08em] text-accent uppercase">
                      {step.name}
                    </span>
                    <p className="font-ui text-[13.5px] leading-relaxed text-text-secondary">
                      {step.body}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* ------------------------------------------------ constraints */}
            <section className="px-8 py-8">
              <SectionHead
                index="04"
                title="HARD CONSTRAINTS"
                note="Enforced in code · Not by the model"
              />
              <div>
                {A.constraints.map((c) => (
                  <div
                    key={c.title}
                    className="flex gap-4 border-b border-grid py-5 last:border-b-0"
                  >
                    <LockIcon className="mt-0.5 shrink-0 text-accent" />
                    <div className="space-y-1.5">
                      <p className="font-mono text-[13px] text-text-primary">
                        {c.title}
                      </p>
                      <p className="font-ui text-[13px] text-text-dim">{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        }
        rail={
          <>
            <RailSection title="Default limits" note="Tighten at deploy">
              {A.defaultLimits.map(([k, v]) => (
                <RailRow key={k} label={k} value={v} />
              ))}
            </RailSection>

            <RailSection title="Fees">
              {A.fees.map(([k, v, tone]) => (
                <RailRow key={k} label={k} value={v.toUpperCase()} tone={tone} />
              ))}
            </RailSection>

            <RailSection title="Creator">
              <div className="flex items-center gap-4 py-4">
                <AgentTile size={40} />
                <div className="space-y-1">
                  <p className="font-mono text-[13px] text-text-primary">
                    {A.creator.address}
                  </p>
                  <p className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
                    {A.creator.since}
                  </p>
                </div>
              </div>
              <RailRow label="Published" value={A.creator.published} />
              <RailRow
                label="Delisted"
                value={A.creator.delisted}
                tone="warning"
              />
              <RailRow label="Total AUM" value={A.creator.totalAum} />

              <div className="flex gap-3 pt-6">
                <InfoIcon className="mt-0.5 shrink-0 text-text-dim" />
                <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">
                  Every agent this creator has published stays visible, including
                  the delisted one.
                </p>
              </div>
            </RailSection>
          </>
        }
      />
    </main>
  );
}

function VerifiedGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.4 8.2 7.2 10l3.4-3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <path
        d="m8 2.5 1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 11.2l-3.4 1.8.7-3.8L2.5 6.5l3.8-.5L8 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
