"use client";

import Link from "next/link";
import { Badge } from "@/components/ui";
import { EmptyState, ErrorState, LoadingState, SignedOutState } from "@/components/states";
import { getCreatorDashboard, type StrategyRow } from "@/lib/api";
import { useApi } from "@/lib/useApi";

const STATUS_TONE: Record<string, "accent" | "warning" | "negative" | "muted"> = {
  published: "accent",
  verifying: "warning",
  delisted: "negative",
  superseded: "muted",
  draft: "muted",
};

/** Days elapsed in the 30-day paper record, for a verifying strategy. */
function verificationDay(s: StrategyRow): number | null {
  if (s.status !== "verifying" || !s.verification_started_at) return null;
  const days = Math.floor(
    (Date.now() - new Date(s.verification_started_at).getTime()) / 86_400_000,
  );
  return Math.min(days, 30);
}

export function CreatorDashboard() {
  const state = useApi<{
    strategies: StrategyRow[];
    counts: { live: number; verifying: number; delisted: number; superseded: number };
  }>((t) => getCreatorDashboard(t));

  if (state.phase === "loading") return <LoadingState label="Loading your strategies" />;
  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "error") return <ErrorState message={state.message} onRetry={state.reload} />;

  const { strategies, counts } = state.data;

  return (
    <>
      <section className="flex items-end justify-between border-b border-grid px-8 pt-6 pb-6">
        <div className="space-y-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            Creator
          </p>
          <h1 className="font-mono text-[34px] leading-none text-text-primary">
            Your strategies
          </h1>
          <p className="font-ui text-[14px] text-text-secondary">
            Each one earns its listing with a 30-day live paper record. There is no backtest.
          </p>
        </div>
        <div className="flex shrink-0">
          {[
            { label: "Live", value: counts.live, tone: "accent" as const },
            { label: "Verifying", value: counts.verifying, tone: "warning" as const },
            { label: "Delisted", value: counts.delisted, tone: "negative" as const },
            // A superseded strategy is one whose rules were edited mid-run. It
            // stays visible on purpose — that is the append-only promise.
            { label: "Superseded", value: counts.superseded, tone: "muted" as const },
          ].map((s, i) => (
            <div key={s.label} className={`px-7 ${i > 0 ? "border-l border-grid" : ""}`}>
              <div className="flex flex-col items-end gap-2.5">
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {s.label}
                </span>
                <span
                  className={`tnum font-mono text-[19px] leading-none ${
                    s.tone === "accent"
                      ? "text-accent"
                      : s.tone === "warning"
                        ? "text-warning"
                        : s.tone === "negative"
                          ? "text-negative"
                          : "text-text-dim"
                  }`}
                >
                  {s.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-8 py-8">
        {strategies.length === 0 ? (
          <EmptyState
            title="No strategies yet"
            body="Define the rules, and Canopy runs a 30-day paper record on live data before anyone can deploy it."
            action={{ label: "Build an agent", href: "/build/new" }}
          />
        ) : (
          <div className="border border-grid">
            {strategies.map((s, i) => {
              const day = verificationDay(s);
              return (
                <div
                  key={s.id}
                  className={`grid grid-cols-[minmax(0,1fr)_150px_110px_110px] items-center gap-4 px-6 py-5 ${
                    i > 0 ? "border-t border-grid" : ""
                  }`}
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="truncate font-mono text-[15px] text-text-primary">
                        {s.name}
                      </span>
                      <Badge tone={STATUS_TONE[s.status] ?? "muted"}>{s.status}</Badge>
                    </div>
                    <p className="font-mono text-[10px] tracking-[0.06em] text-text-dim uppercase">
                      {s.strategy_class} · {s.fee_pct}% fee
                      {s.forked_from_id ? ` · forked from #${s.forked_from_id}` : ""}
                    </p>
                  </div>

                  <div className="text-right">
                    {day !== null ? (
                      <span className="font-mono text-[12px] text-warning">
                        Day {day} of 30
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] tracking-[0.06em] text-text-dim uppercase">
                        {s.status === "published" ? "Listed" : "—"}
                      </span>
                    )}
                  </div>

                  <span className="tnum text-right font-mono text-[13px] text-text-secondary">
                    {s.deployments} deploys
                  </span>

                  <div className="text-right">
                    {s.status === "verifying" ? (
                      <Link
                        href="/build/new/publish"
                        className="font-mono text-[10px] tracking-[0.1em] text-accent uppercase"
                      >
                        Record
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
