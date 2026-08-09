"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { DayBlocks } from "@/components/charts";
import { BUILD_STAGES } from "@/lib/data";
import {
  Badge,
  CheckIcon,
  Columns,
  InfoIcon,
  SectionHead,
  WarnIcon,
} from "@/components/ui";
import { StepBar } from "@/components/wizard";
import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonPanel } from "@/components/skeleton";
import {
  ApiError,
  getStrategy,
  publishStrategy,
  type PublishCheck,
  type StrategyRow,
  type VerificationStatus,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";

/**
 * The publish screen for one strategy.
 *
 * Publishing is NOT gated on the record. A creator starts a paper run and
 * lists it whenever they are convinced — the checks below are disclosure, not
 * a lock. What protects a deployer is that the record's length and thinness
 * travel with the listing, not a waiting period the creator can simply outlast
 * by launching ten strategies and promoting the lucky one.
 *
 * The one hard rule: a strategy with no paper record at all cannot be listed.
 */
export function PublishScreen() {
  const params = useSearchParams();
  const raw = params.get("strategy");
  const strategyId = raw && /^\d+$/.test(raw) ? Number(raw) : null;

  const state = useApi(
    (token) => (strategyId === null ? Promise.reject(new Error("no strategy")) : getStrategy(token, strategyId)),
    [strategyId],
  );

  if (strategyId === null) {
    return (
      <Frame>
        <ErrorState message="This page needs a strategy — open it from one of your strategies rather than directly." />
      </Frame>
    );
  }
  if (state.phase === "loading") return <Frame><SkeletonPanel label="Loading record" /></Frame>;
  if (state.phase === "signed-out")
    return <Frame><SignedOutState note="Sign in to see this strategy's paper record." /></Frame>;
  if (state.phase === "error")
    return <Frame><ErrorState message={state.message} onRetry={state.reload} /></Frame>;

  return (
    <Frame>
      <Body
        strategy={state.data.strategy}
        verification={state.data.verification}
        onPublished={state.reload}
      />
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <StepBar steps={BUILD_STAGES} current={1} />
      {children}
    </main>
  );
}

function Body({
  strategy,
  verification: v,
  onPublished,
}: {
  strategy: StrategyRow;
  verification: VerificationStatus;
  onPublished: () => void;
}) {
  const live = strategy.status === "published";
  const days = v.day;
  // Under a fortnight is little to judge a strategy on. Said out loud rather
  // than used to block — the creator is allowed to list it, the deployer is
  // entitled to know.
  const thin = days < 14;

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-6 border-b border-grid px-8 pt-6 pb-6">
        <div className="space-y-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            {strategy.name} · {live ? "Listed" : "Unlisted"}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="font-mono text-[34px] leading-none text-text-primary">
              {live ? "Listed" : "Publish"}
            </h1>
            <Badge tone={live ? "accent" : "warning"}>
              {live ? "Live" : `Paper run · ${days} ${days === 1 ? "day" : "days"}`}
            </Badge>
          </div>
          <p className="max-w-[62ch] font-ui text-[14px] text-text-secondary">
            {live
              ? "This strategy is listed. Its paper record stays visible alongside it — the length is part of the listing."
              : "The agent is paper-trading live data in public. List it whenever the record convinces you; how long it ran is shown to everyone who sees it."}
          </p>
        </div>

        <div className="flex shrink-0">
          <Headline label="Paper return" value={pct(v.stats.paperReturnPct)} tone={v.stats.paperReturnPct >= 0 ? "accent" : "negative"} />
          <Headline label="Max drawdown" value={pct(-Math.abs(v.stats.maxDrawdownPct))} tone="negative" />
          <Headline label="Record" value={`${days}D`} tone={thin ? "warning" : "accent"} />
        </div>
      </section>

      <Columns
        main={
          <>
            <section className="border-b border-grid px-8 py-8">
              <SectionHead
                index="01"
                title="LIVE PAPER RECORD"
                note={`Run by Canopy · ${days} ${days === 1 ? "day" : "days"} · Forward only`}
              />

              <DayBlocks total={Math.max(days, 14)} done={days} />

              <div className="mt-7 flex flex-wrap border border-grid">
                <Stat label="Paper return" value={pct(v.stats.paperReturnPct)} tone={v.stats.paperReturnPct >= 0 ? "accent" : "negative"} />
                <Stat label="Max DD" value={pct(-Math.abs(v.stats.maxDrawdownPct))} tone="negative" />
                <Stat label="Proposed" value={String(v.stats.proposed)} />
                <Stat label="Blocked" value={String(v.stats.blocked)} tone="negative" />
                <Stat label="Would fill" value={String(v.stats.wouldFill)} tone="accent" />
              </div>

              <Note icon="info">
                This record is a live forward run, not a backtest. The agent traded on
                Canopy&apos;s data, in real time, with venue fees, network fees and realistic
                fills at the liquidity available at the moment. Nothing here was selected
                after the fact — a forward record cannot be fitted to a window that
                flattered it.
              </Note>
            </section>

            <section className="px-8 py-8">
              <SectionHead
                index="02"
                title="WHAT THE RECORD SHOWS"
                note="Disclosure · Not a gate"
              />

              <div className="mt-1">
                {v.checks.map((c) => (
                  <CheckRow key={c.key} check={c} />
                ))}
              </div>

              <Note icon="warn">
                These are shown to anyone considering your strategy, met or not. Nothing
                here blocks you from listing — a short record lists as a short record. The
                record is also append-only: editing a rule forks a new strategy and starts
                a fresh run, and the old one stays visible on your profile. You can abandon
                a strategy, but you cannot quietly reset a bad run.
              </Note>
            </section>
          </>
        }
        rail={
          <>
            <PublishPanel
              strategy={strategy}
              verification={v}
              thin={thin}
              onPublished={onPublished}
            />

            <div className="px-8 py-7">
              <h3 className="pb-4 font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                Actions
              </h3>
              <div className="space-y-3">
                <Link
                  href="/build"
                  className="flex h-11 w-full items-center border border-border px-4 font-mono text-[11px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:text-text-primary"
                >
                  Your strategies
                </Link>
                {live ? (
                  <Link
                    href={`/deploy/describe?strategy=${strategy.id}`}
                    className="flex h-11 w-full items-center border border-border px-4 font-mono text-[11px] tracking-[0.08em] text-text-secondary uppercase transition-colors hover:text-text-primary"
                  >
                    View in marketplace
                  </Link>
                ) : null}
              </div>
            </div>
          </>
        }
      />
    </>
  );
}

/**
 * The publish control. Enabled whenever the strategy is running a paper
 * record, regardless of its length — with the thinness stated on the button
 * rather than used to disable it.
 */
function PublishPanel({
  strategy,
  verification: v,
  thin,
  onPublished,
}: {
  strategy: StrategyRow;
  verification: VerificationStatus;
  thin: boolean;
  onPublished: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const live = strategy.status === "published";

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Your session expired — sign in again.");
      await publishStrategy(token, strategy.id);
      onPublished();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-grid px-8 py-7">
      <div className="flex items-center justify-between pb-4">
        <h3 className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
          Publication
        </h3>
        <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
          {live ? "Listed" : v.publishable ? "Ready" : "Not started"}
        </span>
      </div>

      {live ? (
        <div className="flex h-14 w-full items-center justify-center gap-3 border border-accent bg-accent-wash font-mono text-[12px] tracking-[0.1em] text-accent uppercase">
          <CheckIcon /> Published
        </div>
      ) : (
        <button
          type="button"
          onClick={publish}
          disabled={busy || !v.publishable}
          className="flex h-14 w-full items-center justify-center gap-3 border border-accent bg-accent-wash font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
        >
          {busy ? "Publishing…" : "Publish to marketplace"}
        </button>
      )}

      {!live && !v.publishable ? (
        <p className="pt-4 text-center font-mono text-[11px] tracking-[0.08em] text-warning uppercase">
          Start a paper run first
        </p>
      ) : null}

      {!live && v.publishable && thin ? (
        <p className="pt-4 font-ui text-[12.5px] leading-relaxed text-warning">
          Your record is {v.day} {v.day === 1 ? "day" : "days"} long. You can list it
          now — it will be shown as a short record wherever it appears.
        </p>
      ) : null}

      {error ? (
        <p className="pt-4 font-ui text-[12.5px] leading-relaxed text-negative">{error}</p>
      ) : null}

      {v.remaining.length > 0 && !live ? (
        <div className="mt-5 border-t border-grid">
          <p className="pt-4 pb-1 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
            Will be disclosed as unmet
          </p>
          {v.remaining.map((r) => (
            <div
              key={r}
              className="flex items-center gap-3.5 border-b border-grid py-3.5 last:border-b-0"
            >
              <PendingGlyph />
              <span className="font-ui text-[13px] text-text-secondary">{r}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- fragments -- */

function CheckRow({ check }: { check: PublishCheck }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_110px_100px] items-center gap-5 border-b border-grid py-4">
      <span className="flex items-center gap-4">
        {check.passed ? <CheckIcon className="shrink-0 text-accent" /> : <PendingGlyph />}
        <span className="font-mono text-[13px] text-text-primary">{check.name}</span>
      </span>
      <span className="tnum text-right font-mono text-[13px] text-text-primary">
        {check.value}
      </span>
      <span className="justify-self-end">
        <Badge tone={check.passed ? "accent" : "warning"}>
          {check.passed ? "Met" : "Not met"}
        </Badge>
      </span>
    </div>
  );
}

function Headline({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "accent" | "negative" | "warning";
}) {
  return (
    <div className="border-l border-grid px-7 first:border-l-0">
      <div className="flex flex-col items-end gap-2.5">
        <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
          {label}
        </span>
        <span className={`tnum font-mono text-[21px] leading-none ${TONE[tone]}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "negative";
}) {
  return (
    <div className="min-w-[120px] flex-1 space-y-3.5 border-r border-grid p-5 last:border-r-0">
      <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
        {label}
      </p>
      <p
        className={`tnum font-mono text-[19px] leading-none ${
          tone ? TONE[tone] : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

const TONE = {
  accent: "text-accent",
  negative: "text-negative",
  warning: "text-warning",
} as const;

function Note({ icon, children }: { icon: "info" | "warn"; children: React.ReactNode }) {
  return (
    <div className="mt-6 flex gap-4 bg-panel px-5 py-5">
      <div
        className={`w-0.5 shrink-0 self-stretch ${
          icon === "warn" ? "bg-warning" : "bg-grid-strong"
        }`}
      />
      <div className="flex gap-3">
        {icon === "warn" ? (
          <WarnIcon className="mt-0.5 shrink-0 text-warning" />
        ) : (
          <InfoIcon className="mt-0.5 shrink-0 text-text-dim" />
        )}
        <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
          {children}
        </p>
      </div>
    </div>
  );
}

function PendingGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-warning" aria-hidden>
      <circle cx="8" cy="8" r="5.8" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 5v3.2l2.2 1.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Percent with an explicit sign, so a flat record never reads as a gain. */
function pct(n: number): string {
  const s = n.toFixed(1);
  return n > 0 ? `+${s}%` : `${s}%`;
}
