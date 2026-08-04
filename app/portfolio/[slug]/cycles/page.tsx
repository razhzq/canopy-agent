import Link from "next/link";
import { CycleHistogram } from "@/components/charts";
import { CYCLES, cycleHistogramBars } from "@/lib/data";
import { Badge, Breadcrumb, ChevronRight, ToolButton } from "@/components/ui";

export default function CyclesPage() {
  const bars = cycleHistogramBars();

  return (
    <main>
      {/* ---------------------------------------------------------- header */}
      <section className="flex items-end justify-between border-b border-grid px-8 pt-6 pb-[22px]">
        <div className="space-y-3">
          <Breadcrumb parts={["My agents", "alpha_hunter"]} />
          <div className="flex items-center gap-4">
            <h1 className="font-mono text-[38px] leading-none text-text-primary">
              Cycles
            </h1>
            <Badge tone="accent">Running</Badge>
          </div>
          <p className="font-ui text-[14px] text-text-secondary">
            Every scheduled run since deploy. Open any cycle to see what each agent
            decided and why.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ToolButton>45D</ToolButton>
          <ToolButton>Outcome</ToolButton>
          <ToolButton>Export</ToolButton>
        </div>
      </section>

      {/* ---------------------------------------------------------- ribbon */}
      <section className="flex border-b border-grid px-8">
        {CYCLES.stats.map((s, i) => (
          <div
            key={s.label}
            className={`flex-1 px-6 py-6 ${i > 0 ? "border-l border-grid" : ""} ${i === 0 ? "pl-0" : ""}`}
          >
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                {s.label}
              </span>
              <span
                className={`tnum font-mono text-[22px] leading-none ${
                  s.tone === "accent"
                    ? "text-accent"
                    : s.tone === "negative"
                      ? "text-negative"
                      : s.tone === "muted"
                        ? "text-text-secondary"
                        : "text-text-primary"
                }`}
              >
                {s.value}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------------- histogram */}
      <section className="border-b border-grid px-8 py-7">
        <div className="flex items-center justify-between pb-5">
          <span className="font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase">
            Last 48 cycles
          </span>
          <div className="flex items-center gap-6 font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
            {[
              ["Executed", "bg-accent"],
              ["All blocked", "bg-negative"],
              ["No action", "bg-grid-strong"],
            ].map(([label, dot]) => (
              <span key={label} className="flex items-center gap-2.5">
                <span className={`size-2.5 ${dot}`} /> {label}
              </span>
            ))}
          </div>
        </div>

        <CycleHistogram bars={bars} height={70} />

        <div className="flex items-center justify-between pt-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
          <span>Cycle 081</span>
          <span>Bar height = proposals raised</span>
          <span>Cycle 128</span>
        </div>
      </section>

      {/* ----------------------------------------------------------- table */}
      <section className="px-8">
        <div className="grid grid-cols-[80px_140px_110px_110px_110px_130px_minmax(0,1fr)_100px_24px] items-center gap-5 border-b border-grid py-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
          <span>Cycle</span>
          <span>Started</span>
          <span className="text-right">Proposed</span>
          <span className="text-right">Blocked</span>
          <span className="text-right">Executed</span>
          <span>Result</span>
          <span>Blocked by</span>
          <span className="text-right">Cost</span>
          <span />
        </div>

        {CYCLES.rows.map((r) => (
          <Link
            key={r.cycle}
            href={`/portfolio/alpha_hunter/cycles/${r.cycle}`}
            className="grid grid-cols-[80px_140px_110px_110px_110px_130px_minmax(0,1fr)_100px_24px] items-center gap-5 border-b border-grid py-5 transition-colors hover:bg-panel"
          >
            <span className="tnum font-mono text-[14px] text-accent">
              {r.cycle}
            </span>
            <span className="tnum font-mono text-[12.5px] text-text-dim">
              {r.started}
            </span>
            <span className="tnum text-right font-mono text-[13px] text-text-primary">
              {r.proposed}
            </span>
            <span
              className={`tnum text-right font-mono text-[13px] ${
                r.blocked > 0 ? "text-negative" : "text-text-secondary"
              }`}
            >
              {r.blocked}
            </span>
            <span
              className={`tnum text-right font-mono text-[13px] ${
                r.executed > 0 ? "text-accent" : "text-text-secondary"
              }`}
            >
              {r.executed}
            </span>
            <span>
              <Badge tone={r.tone}>{r.result}</Badge>
            </span>
            <span className="font-mono text-[11.5px] tracking-[0.06em] text-text-secondary uppercase">
              {r.by}
            </span>
            <span className="tnum text-right font-mono text-[12.5px] text-text-secondary">
              {r.cost}
            </span>
            <ChevronRight className="justify-self-end text-text-dim" />
          </Link>
        ))}
      </section>

      <section className="flex items-center justify-between px-8 pt-4 pb-7">
        <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
          Showing 8 of 128 · Select a row to open the agent trace
        </p>
        <button
          type="button"
          className="font-mono text-[10px] tracking-[0.1em] text-accent uppercase"
        >
          Load more
        </button>
      </section>
    </main>
  );
}
