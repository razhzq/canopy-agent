import Link from "next/link";
import { Sparkline } from "@/components/charts";
import { AGENTS, LIVE_TAPE, MOVER_PANELS, sparkSeries } from "@/lib/data";
import { AgentTile, Badge, ToolButton } from "@/components/ui";

const TABS = [
  { label: "Official", count: 12, active: false },
  { label: "Community", count: 148, active: true },
  { label: "My agents", count: 3, active: false },
];

function signed(n: number, suffix = "%") {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}${suffix}`;
}

export default function AgentsPage() {
  return (
    <main>
      {/* ---------------------------------------------------------- header */}
      <section className="flex items-end justify-between border-b border-grid px-8 pt-6 pb-[22px]">
        <div className="space-y-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            Marketplace
          </p>
          <h1 className="font-mono text-[38px] leading-none text-text-primary">
            Agents
          </h1>
          <p className="font-ui text-[14px] text-text-secondary">
            Deploy a strategy as your own agent. You keep custody. You set every
            limit.
          </p>
        </div>
        <div className="flex">
          {[
            { label: "Live agents", value: "1,284" },
            { label: "Capital deployed", value: "$4.2M" },
            { label: "Custody", value: "Non-custodial", tone: "accent" as const },
          ].map((s, i) => (
            <div
              key={s.label}
              className={`px-8 ${i > 0 ? "border-l border-grid" : ""}`}
            >
              <div className="flex flex-col items-end gap-2.5">
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {s.label}
                </span>
                <span
                  className={`tnum font-mono text-[20px] leading-none ${
                    s.tone === "accent" ? "text-accent uppercase" : "text-text-primary"
                  }`}
                >
                  {s.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- movers */}
      <section className="flex border-b border-grid bg-panel">
        {MOVER_PANELS.map((panel, i) => (
          <div
            key={panel.title}
            className={`flex-1 px-8 py-6 ${i > 0 ? "border-l border-grid" : ""}`}
          >
            <div className="flex items-center justify-between pb-4">
              <span className="font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase">
                {panel.title}
              </span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim">
                {panel.window}
              </span>
            </div>
            <div className="space-y-3">
              {panel.rows.map(([name, delta]) => (
                <div key={name} className="flex items-center justify-between gap-4">
                  <span className="truncate font-mono text-[12px] text-text-secondary">
                    {name}
                  </span>
                  <span
                    className={`tnum shrink-0 font-mono text-[12px] ${
                      delta >= 0 ? "text-accent" : "text-negative"
                    }`}
                  >
                    {signed(delta)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex-1 border-l border-grid px-8 py-6">
          <div className="flex items-center justify-between pb-4">
            <span className="font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase">
              Live tape
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-accent uppercase">
              <span className="size-1.5 rounded-full bg-accent" />
              Live
            </span>
          </div>
          <div className="space-y-3">
            {LIVE_TAPE.map(([time, side, asset]) => (
              <div key={time} className="flex items-center gap-4">
                <span className="tnum font-mono text-[11px] text-text-dim">
                  {time}
                </span>
                <span
                  className={`font-mono text-[11px] tracking-[0.06em] ${
                    side === "SELL" ? "text-negative" : "text-accent"
                  }`}
                >
                  {side}
                </span>
                <span className="ml-auto font-mono text-[11px] text-text-secondary">
                  {asset}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- controls */}
      <section className="flex items-center justify-between border-b border-grid px-8">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              className={`flex items-center gap-2 border-b-2 px-5 py-5 font-mono text-[12px] tracking-[0.1em] uppercase transition-colors ${
                tab.active
                  ? "border-accent text-text-primary"
                  : "border-transparent text-text-dim hover:text-text-secondary"
              }`}
            >
              {tab.label}
              <span className={tab.active ? "text-accent" : "text-text-muted"}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <ToolButton>
            <ClockGlyph /> 90D <Caret />
          </ToolButton>
          <ToolButton>
            <SlidersGlyph /> Filters <Caret />
          </ToolButton>
          <ToolButton>
            <SortGlyph /> Return
          </ToolButton>
        </div>
      </section>

      {/* ----------------------------------------------------------- table */}
      <section className="px-8">
        <div className="grid grid-cols-[46px_minmax(0,1fr)_92px_84px_60px_56px_190px_84px_68px_56px_92px] items-center gap-x-4 border-b border-grid py-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
          <span>Rank</span>
          <span>Name</span>
          <span className="text-right">Return 90D</span>
          <span className="text-right">Max DD</span>
          <span className="text-right">Hit</span>
          <span className="text-right">PF</span>
          <span className="pl-3">Equity</span>
          <span className="text-right">AUM</span>
          <span className="text-right">Users</span>
          <span className="text-right">Age</span>
          <span />
        </div>

        {AGENTS.map((agent) => (
          <div
            key={agent.slug}
            className="grid grid-cols-[46px_minmax(0,1fr)_92px_84px_60px_56px_190px_84px_68px_56px_92px] items-center gap-x-4 border-b border-grid py-5"
          >
            <span className="tnum font-mono text-[12px] text-text-dim">
              {agent.rank}
            </span>

            <div className="flex min-w-0 items-center gap-4">
              <AgentTile />
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <Link
                    href={`/agents/${agent.slug}`}
                    className={`truncate font-mono text-[15px] hover:text-accent ${
                      agent.return90d === null
                        ? "text-text-secondary"
                        : "text-text-primary"
                    }`}
                  >
                    {agent.name}
                  </Link>
                  {agent.verified ? <VerifiedGlyph /> : null}
                  {agent.flag ? (
                    <Badge tone={agent.flag.tone === "warning" ? "warning" : "muted"}>
                      {agent.flag.label}
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate font-mono text-[10px] tracking-[0.06em] text-text-dim">
                  {agent.klass} · {agent.posture} · {agent.author}
                </p>
              </div>
            </div>

            <span
              className={`tnum text-right font-mono text-[14px] ${
                agent.return90d === null
                  ? "text-[11px] tracking-[0.08em] text-simulated uppercase"
                  : agent.return90d >= 0
                    ? "text-accent"
                    : "text-negative"
              }`}
            >
              {agent.return90d === null ? "Simulated" : signed(agent.return90d)}
            </span>

            <span className="tnum text-right font-mono text-[13px] text-negative">
              {signed(agent.maxDD)}
            </span>
            <span className="tnum text-right font-mono text-[13px] text-text-primary">
              {agent.hit === null ? "—" : `${agent.hit}%`}
            </span>
            <span className="tnum text-right font-mono text-[13px] text-text-primary">
              {agent.pf === null ? "—" : agent.pf.toFixed(2)}
            </span>

            <div className="pl-3">
              <Sparkline
                values={sparkSeries(24, agent.spark.seed, agent.spark.tone !== "accent")}
                tone={agent.spark.tone}
              />
            </div>

            <span className="tnum text-right font-mono text-[13px] text-text-primary">
              {agent.aum ?? "—"}
            </span>
            <span className="tnum text-right font-mono text-[13px] text-text-secondary">
              {agent.users ?? "—"}
            </span>
            <span className="text-right font-mono text-[11px] tracking-[0.06em] text-text-dim uppercase">
              {agent.age}
            </span>

            <Link
              href="/deploy/describe"
              className="flex h-8 items-center justify-center border border-border font-mono text-[10px] tracking-[0.1em] text-text-secondary uppercase transition-colors hover:border-accent hover:text-accent"
            >
              Deploy
            </Link>
          </div>
        ))}
      </section>

      <section className="flex items-center justify-between border-t border-grid px-8 pt-4 pb-7">
        <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
          Showing 6 of 148 · Ranked by capital-weighted return, not raw return
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

/* --------------------------------------------------------------- glyphs ---- */

function VerifiedGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-accent" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M5.4 8.2 7.2 10l3.4-3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Caret() {
  return (
    <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
      <path
        d="m4 6 4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v3.2l2.2 1.3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SlidersGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <path d="M2 4.5h12M2 8h12M2 11.5h12" />
        <circle cx="5.5" cy="4.5" r="1.4" fill="var(--color-bg)" />
        <circle cx="10" cy="8" r="1.4" fill="var(--color-bg)" />
        <circle cx="6.5" cy="11.5" r="1.4" fill="var(--color-bg)" />
      </g>
    </svg>
  );
}

function SortGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 13V3.5M2.5 5.5l2-2 2 2" />
        <path d="M11.5 3v9.5M9.5 10.5l2 2 2-2" />
      </g>
    </svg>
  );
}
