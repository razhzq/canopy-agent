import Link from "next/link";
import { EarningsBars } from "@/components/charts";
import { CREATOR as C } from "@/lib/data";
import {
  AgentTile,
  Badge,
  ChevronRight,
  Columns,
  RailRow,
  RailSection,
  SectionHead,
} from "@/components/ui";

export default function CreatorDashboardPage() {
  return (
    <main>
      {/* ---------------------------------------------------------- header */}
      <section className="flex items-end justify-between border-b border-grid px-8 pt-6 pb-[22px]">
        <div className="space-y-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            Creator · {C.address}
          </p>
          <div className="flex items-center gap-4">
            <h1 className="font-mono text-[38px] leading-none text-text-primary">
              Build
            </h1>
            <Badge tone="muted">{C.since}</Badge>
          </div>
          <p className="font-ui text-[14px] text-text-secondary">
            Everything you have published, including what did not work out.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-11 items-center gap-2.5 border border-border px-5 font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase transition-colors hover:text-text-primary"
          >
            <ExternalGlyph /> Public profile
          </button>
          <Link
            href="/build/new"
            className="flex h-11 items-center gap-2.5 bg-accent px-6 font-mono text-[11px] tracking-[0.1em] text-bg uppercase transition-opacity hover:opacity-90"
          >
            + New agent
          </Link>
        </div>
      </section>

      {/* ---------------------------------------------------------- ribbon */}
      <section className="flex border-b border-grid px-8">
        {C.stats.map((s, i) => (
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
                      : s.tone === "warning"
                        ? "text-warning"
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
            {/* --------------------------------------------------- agents */}
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="01"
                title="YOUR AGENTS"
                note="All six · Nothing hidden"
              />

              <div className="grid grid-cols-[minmax(0,1fr)_100px_80px_80px_56px_76px_52px_86px_20px] items-center gap-3 border-b border-grid pb-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                <span>Agent</span>
                <span>Status</span>
                <span className="text-right">Return</span>
                <span className="text-right">Max DD</span>
                <span className="text-right">Users</span>
                <span className="text-right">Capital</span>
                <span className="text-right">Fee</span>
                <span className="text-right">Earned 30D</span>
                <span />
              </div>

              {C.agents.map((a) => (
                <div
                  key={a.name}
                  className={`grid grid-cols-[minmax(0,1fr)_100px_80px_80px_56px_76px_52px_86px_20px] items-center gap-3 border-b border-grid py-5 ${
                    a.dimmed ? "opacity-70" : ""
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-4">
                    <AgentTile size={30} />
                    <span className="min-w-0 space-y-1.5">
                      <span className="block font-mono text-[14px] whitespace-nowrap text-text-primary">
                        {a.name}
                      </span>
                      <span
                        className={`block font-mono text-[10px] tracking-[0.06em] uppercase ${
                          a.statusTone === "negative"
                            ? "text-negative"
                            : "text-text-dim"
                        }`}
                      >
                        {a.meta}
                      </span>
                    </span>
                  </span>

                  <span>
                    <Badge tone={a.statusTone}>{a.status}</Badge>
                  </span>

                  <span
                    className={`tnum text-right font-mono ${
                      a.retTone === "accent"
                        ? "text-[13.5px] text-accent"
                        : a.retTone === "negative"
                          ? "text-[13.5px] text-negative"
                          : "text-[11px] tracking-[0.06em] text-simulated uppercase"
                    }`}
                  >
                    {a.ret}
                  </span>
                  <span className="tnum text-right font-mono text-[13px] text-negative">
                    {a.dd}
                  </span>
                  <span className="tnum text-right font-mono text-[13px] text-text-secondary">
                    {a.users}
                  </span>
                  <span className="tnum text-right font-mono text-[13px] text-text-primary">
                    {a.capital}
                  </span>
                  <span className="tnum text-right font-mono text-[13px] text-text-secondary">
                    {a.fee}
                  </span>
                  <span
                    className={`tnum text-right font-mono text-[13px] ${
                      a.earned === "—" ? "text-text-dim" : "text-accent"
                    }`}
                  >
                    {a.earned}
                  </span>
                  <ChevronRight className="justify-self-end text-text-dim" />
                </div>
              ))}

              <div className="mt-7 flex gap-4">
                <div className="w-0.5 shrink-0 self-stretch bg-warning" />
                <div className="flex gap-3 pl-1">
                  <EyeGlyph />
                  <p className="max-w-[900px] font-ui text-[13px] leading-relaxed text-text-secondary">
                    {C.transparencyNote}
                  </p>
                </div>
              </div>
            </section>

            {/* ------------------------------------------------- earnings */}
            <section className="px-8 py-8">
              <SectionHead
                index="02"
                title="EARNINGS"
                note="Profit share only · Settles daily"
              />

              <EarningsBars
                values={C.earnings.values}
                labels={C.earnings.labels}
                height={170}
              />

              <div className="mt-8">
                <div className="grid grid-cols-[minmax(0,1fr)_140px_140px_120px_110px] items-center gap-5 border-b border-grid pb-4 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  <span>Period</span>
                  <span className="text-right">Deployments</span>
                  <span className="text-right">Volume</span>
                  <span className="text-right">Earned</span>
                  <span className="text-right">Status</span>
                </div>

                {C.earnings.rows.map(([period, dep, vol, earned, status, tone]) => (
                  <div
                    key={period}
                    className="grid grid-cols-[minmax(0,1fr)_140px_140px_120px_110px] items-center gap-5 border-b border-grid py-4.5 last:border-b-0"
                  >
                    <span className="font-mono text-[13.5px] text-text-primary">
                      {period}
                    </span>
                    <span className="tnum text-right font-mono text-[13px] text-text-secondary">
                      {dep}
                    </span>
                    <span className="tnum text-right font-mono text-[13px] text-text-secondary">
                      {vol}
                    </span>
                    <span className="tnum text-right font-mono text-[13.5px] text-accent">
                      {earned}
                    </span>
                    <span className="justify-self-end">
                      <Badge tone={tone}>{status}</Badge>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        }
        rail={
          <>
            <div className="border-b border-grid px-8 py-7">
              <div className="flex items-center justify-between pb-5">
                <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                  Next payout
                </h3>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  Settles 00:00 UTC
                </span>
              </div>

              <p className="tnum pb-5 font-mono text-[38px] leading-none text-accent">
                {C.payout.amount}
              </p>

              <RailRow label="Accrued today" value={C.payout.accrued} />
              <RailRow label="To wallet" value={C.payout.wallet} />
              <RailRow label="Network" value={C.payout.network} />
            </div>

            <RailSection title="Public profile">
              <div className="mt-3 flex border border-grid">
                {C.profile.map((p) => (
                  <div
                    key={p.label}
                    className="flex-1 space-y-3 border-r border-grid p-4 last:border-r-0"
                  >
                    <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                      {p.label}
                    </p>
                    <p
                      className={`tnum font-mono text-[18px] leading-none ${
                        p.tone === "accent"
                          ? "text-accent"
                          : p.tone === "negative"
                            ? "text-negative"
                            : "text-text-primary"
                      }`}
                    >
                      {p.value}
                    </p>
                  </div>
                ))}
              </div>
              <p className="pt-5 font-ui text-[13px] leading-relaxed text-text-secondary">
                {C.profileNote}
              </p>
            </RailSection>

            <RailSection title="Fee policy">
              {C.feePolicy.map(([k, v, tone]) => (
                <RailRow
                  key={k}
                  label={k}
                  value={v}
                  tone={tone === "warning" ? "warning" : "neutral"}
                />
              ))}
              <p className="pt-5 font-ui text-[13px] leading-relaxed text-text-secondary">
                {C.feePolicyNote}
              </p>
            </RailSection>
          </>
        }
      />
    </main>
  );
}

function ExternalGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <path
        d="M9 3h4v4M13 3 7.5 8.5M11 9.5v3H3.5v-9h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden>
      <path
        d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
