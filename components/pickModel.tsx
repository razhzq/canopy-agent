"use client";

import { useMemo, useState } from "react";

import { getModels, type ModelOption } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { RemoteIcon } from "@/components/remoteIcon";

/**
 * Step 3 — choose the model. The council's, not the compiler's.
 *
 * WHAT THIS CHOOSES, AND WHAT IT POINTEDLY DOES NOT.
 *
 * A cycle records five seats — desk, analyst, risk, trader, PM — but only ONE
 * of them reasons with a model. The analyst reads the screened candidates and
 * decides which are worth proposing; the other four are deterministic code and
 * cost nothing to run. This screen picks the model the analyst uses.
 *
 * That is worth being exact about on screen as well as here, because "five
 * seats, five models" is what a reader assumes from the transcript, and it
 * would make every cost estimate on this page look five times too low.
 *
 * It does NOT change step 2. The strategy compiler that turned your sentence
 * into chips runs on Canopy's own model and always will: it runs before an
 * agent exists, so there is no wallet to pay with and no balance to check. A
 * creator who picks a marketplace model here and then wonders why their rules
 * were not recompiled is asking a reasonable question, so the screen answers it
 * before they ask.
 *
 * INCLUDED VERSUS BOUGHT.
 *
 * cQWEN3 is included — Canopy hosts it and absorbs the cost. Everything else
 * comes through Pod, a marketplace that routes each call to the cheapest
 * provider willing to serve it, and it is paid for in USDC by THIS AGENT. That
 * is a real difference in kind, not a price comparison, which is why the two
 * are cards rather than two rows of one table.
 *
 * PRICE PER MILLION TOKENS IS NOT A NUMBER ANYONE CAN ACT ON.
 *
 * Nobody knows how many tokens five seats spend arguing about a book. The
 * backend does — it has measured them — so the figure that leads each row is
 * its estimate of what one cycle costs, multiplied out to a day at the cadence
 * chosen in step 2. The per-million prices stay, in smaller type, because they
 * are the thing that can be checked against Pod.
 *
 * NOTHING IS CHARGED HERE.
 *
 * The agent does not exist yet, so it has no Pod account and no deposit code to
 * credit. Funding happens on the agent's own page, straight after creation. A
 * wizard that takes money before the thing exists is a wizard that needs a
 * refund path.
 */

export interface ModelChoice {
  modelId: string;
  /** Carried so the rail and the review can label the choice without refetching. */
  label: string;
  provider: "canopy" | "pod";
  /**
   * The price the creator accepted, USD per million tokens. Pod only.
   *
   * Sent with the strategy and enforced on every call as `X-Pod-Max-Price-*`.
   * A marketplace price moves; this is the number that decides whether a rise
   * is absorbed or refused, and it is agreed here rather than assumed later.
   */
  maxPriceInputUsd?: number;
  maxPriceOutputUsd?: number;
  /** What they said they would fund it with. Pre-fills the top-up, spends nothing. */
  intendedTopUpUsd?: number;
}

/** Every agent that predates this screen ran the Canopy model. So does the default. */
export const DEFAULT_MODEL: ModelChoice = {
  modelId: "canopy:qwen3-14b",
  label: "cQWEN3",
  provider: "canopy",
};

const VISIBLE = 40;

export function PickModel({
  value,
  onChange,
  cadenceSec,
  isPaper,
  onBack,
  /**
   * Where this is being rendered.
   *
   * "builder" is step 3 of the wizard and says so. "panel" is the owner
   * changing the model of an agent that already exists — same table, same
   * terms, but the step counter and "back to limits" would both be lies there,
   * and the standing note about the compiler is about a step that has long
   * since finished.
   */
  context = "builder",
}: {
  value: ModelChoice;
  onChange: (next: ModelChoice) => void;
  /** From step 2, so a per-cycle cost can be stated as a per-day one. */
  cadenceSec?: number;
  /** Paper agents have no wallet of their own — the owner funds them. */
  isPaper: boolean;
  onBack: () => void;
  context?: "builder" | "panel";
}) {
  const inBuilder = context === "builder";
  const catalogue = useApi((t) => getModels(t), []);
  const [query, setQuery] = useState("");

  const models = catalogue.phase === "ready" ? catalogue.data.models : [];
  const suggested = catalogue.phase === "ready" ? catalogue.data.suggestedTopUpUsd : 10;

  const canopy = models.find((m) => m.provider === "canopy") ?? null;
  const all = useMemo(() => models.filter((m) => m.provider === "pod"), [models]);
  const onPod = value.provider === "pod";

  /**
   * The rows on screen.
   *
   * The marketplace lists over five hundred models, cheapest first. Showing all
   * of them is a scroll nobody finishes and showing the top forty silently is a
   * cap pretending to be a catalogue — so the count below says how many matched
   * and the search is how you reach the rest.
   */
  const pod = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q === "" ? all : all.filter((m) => m.label.toLowerCase().includes(q));
    return matched.slice(0, VISIBLE);
  }, [all, query]);
  const matchedCount = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q === "" ? all.length : all.filter((m) => m.label.toLowerCase().includes(q)).length;
  }, [all, query]);

  function choose(m: ModelOption) {
    // A model with no ceiling cannot be agreed to: the agreement IS the
    // ceiling. The catalogue marks those unselectable; this is the second lock.
    if (!m.selectable || m.maxPriceInputUsd === null) return;
    if (m.provider === "canopy") {
      onChange({ modelId: m.id, label: m.label, provider: "canopy" });
      return;
    }
    onChange({
      modelId: m.id,
      label: m.label,
      provider: "pod",
      // Accepted here, once, with the number on screen. Taken from the
      // catalogue rather than derived from the price beside it: Pod publishes
      // the cap its own providers are held to, and a ceiling we computed would
      // be a different promise from the one it enforces.
      maxPriceInputUsd: m.maxPriceInputUsd ?? undefined,
      maxPriceOutputUsd: m.maxPriceOutputUsd ?? undefined,
      intendedTopUpUsd: value.intendedTopUpUsd ?? suggested,
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {inBuilder ? (
          <>
            <p className="font-mono text-[10px] tracking-[0.12em] text-text-dim uppercase">
              Step 3 of 3 · Model
            </p>
            <h2 className="font-mono text-[22px] leading-none text-text-primary">
              Choose what it thinks with
            </h2>
          </>
        ) : null}
        <p className="max-w-[68ch] font-ui text-[13.5px] leading-relaxed text-text-secondary">
          Every cycle, the analyst seat reads what passed your rules and decides what is worth
          proposing. This is the model it thinks with — the rest of the council is deterministic
          and costs nothing.{" "}
          {inBuilder
            ? "Your strategy was compiled by Canopy's own model and stays that way — picking here changes how the agent reasons from now on, not how your rules were read."
            : "Changing it changes every cycle from here on. It does not re-read the rules this agent already has."}
        </p>
      </div>

      {catalogue.phase === "loading" ? (
        <Note>Loading models…</Note>
      ) : catalogue.phase === "signed-out" ? (
        <Note>Sign in to choose a model.</Note>
      ) : catalogue.phase === "error" ? (
        <Note tone="negative">Could not load the model list — {catalogue.message}</Note>
      ) : !catalogue.data.podEnabled ? (
        // The kill switch, and it is not an error state. Canopy's model is what
        // every agent ran before Pod existed, so this is a working screen with
        // one option rather than a broken one with none.
        <Note>
          {canopy?.label ?? DEFAULT_MODEL.label} is the only model available right now. Your agent
          will reason with it, included in your plan.
        </Note>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <ModeCard
              title={canopy?.label ?? DEFAULT_MODEL.label}
              badge="Included"
              body="Hosted by Canopy. Nothing to fund, nothing to run out of."
              active={!onPod}
              onClick={() =>
                canopy ? choose(canopy) : onChange(DEFAULT_MODEL)
              }
            />
            <ModeCard
              title="Buy a model"
              body={`Bought through Pod and paid for in USDC by ${
                isPaper ? "you" : "this agent"
              }, per cycle.`}
              active={onPod}
              onClick={() => {
                const first = pod.find((m) => m.selectable);
                if (first) choose(first);
              }}
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[10px] tracking-[0.12em] text-text-dim uppercase">
                Models on Pod
              </p>
              <div className="flex items-center gap-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search models…"
                  spellCheck={false}
                  aria-label="Search models"
                  className="h-9 w-[190px] border-b border-grid-strong bg-transparent font-mono text-[12.5px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent"
                />
                {/* What is on screen versus what matched. The list is capped at
                    forty rows, and a cap nobody is told about reads as "that is
                    all there is". */}
                <span className="font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
                  {matchedCount > pod.length
                    ? `${pod.length} of ${matchedCount}`
                    : `${matchedCount} ${matchedCount === 1 ? "model" : "models"}`}
                </span>
              </div>
            </div>

            <div className="border border-grid">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.5fr)_130px_120px_110px] items-center gap-x-4 border-b border-grid px-4 py-2.5 font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase">
                <span>Model</span>
                <span className="text-right">Per cycle</span>
                <span className="text-right">Per million</span>
                <span className="text-right">Providers</span>
              </div>

              {pod.length === 0 ? (
                <p className="px-4 py-3 font-ui text-[12.5px] text-text-muted">
                  {emptyReason(catalogue.data.podStatus, query.trim() !== "")}
                </p>
              ) : (
                pod.map((m) => {
                  const picked = value.modelId === m.id;
                  const row = (
                    <>
                      <span className="flex min-w-0 items-center gap-2.5">
                        {m.logo ? <RemoteIcon src={m.logo} size={15} fallback={null} /> : null}
                        <span
                          className={`truncate font-mono text-[13px] ${
                            picked
                              ? "text-accent"
                              : m.selectable
                                ? "text-text-primary"
                                : "text-text-muted"
                          }`}
                        >
                          {m.label}
                        </span>
                        {m.contextTokens ? (
                          <span className="shrink-0 font-ui text-[11px] text-text-dim">
                            {Math.round(m.contextTokens / 1000)}k context
                          </span>
                        ) : null}
                      </span>

                      {/* The only figure on this row anyone can act on, and the
                          reason it leads: what a cycle costs, and what that is
                          per day at the cadence chosen in step 2. */}
                      <span className="tnum text-right font-mono text-[12.5px] text-text-primary">
                        {m.estCostPerCycleUsd === null ? (
                          // No measured history yet. A dash, not an
                          // extrapolation from a price nobody has spent.
                          <span className="text-text-muted">—</span>
                        ) : (
                          cents(m.estCostPerCycleUsd)
                        )}
                      </span>

                      <span className="tnum flex flex-col items-end text-right font-mono text-[11.5px] text-text-secondary">
                        {m.inputPerMTokenUsd === null || m.outputPerMTokenUsd === null ? (
                          <span className="text-text-muted">—</span>
                        ) : (
                          <>
                            <span>
                              ${fine(m.inputPerMTokenUsd)} / ${fine(m.outputPerMTokenUsd)}
                            </span>
                            {/* What it costs today, and the most it can ever
                                cost. Both, because the first is what a reader
                                compares on and the second is what they agree
                                to — and they are not the same number. */}
                            {m.maxPriceInputUsd !== null ? (
                              <span className="text-[10px] text-text-muted">
                                max ${fine(m.maxPriceInputUsd)} / ${fine(m.maxPriceOutputUsd ?? 0)}
                              </span>
                            ) : null}
                          </>
                        )}
                      </span>

                      <span className="text-right font-ui text-[11.5px] text-text-muted">
                        {/* A model nobody is serving is a model that will refuse.
                            Say which it is rather than letting it be picked and
                            fail on the first cycle. */}
                        {!m.selectable
                          ? "Unavailable"
                          : m.providersOnline === null
                            ? "—"
                            : `${m.providersOnline} online`}
                      </span>
                    </>
                  );

                  const className = `grid w-full grid-cols-1 sm:grid-cols-[minmax(0,1.5fr)_130px_120px_110px] items-center gap-x-4 border-b border-grid px-4 py-3 text-left last:border-b-0 ${
                    picked ? "bg-accent-wash" : ""
                  }`;

                  return m.selectable ? (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={picked}
                      onClick={() => choose(m)}
                      className={`${className} transition-colors hover:bg-panel`}
                    >
                      {row}
                    </button>
                  ) : (
                    <div key={m.id} className={className}>
                      {row}
                    </div>
                  );
                })
              )}
            </div>

            {onPod ? <PodTerms value={value} cadenceSec={cadenceSec} isPaper={isPaper} /> : null}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onBack}
        className="font-mono text-[11px] tracking-[0.08em] text-text-dim uppercase transition-colors hover:text-text-primary"
      >
        {inBuilder ? "← Back to limits" : "← Keep the current model"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------- bits -- */

/**
 * What picking a marketplace model actually commits the creator to.
 *
 * Three facts, and every one of them is something people get wrong about
 * prepaid inference: nothing is charged now, the agent will never top itself
 * up, and the price they just accepted has a ceiling on it. Stated here, at the
 * moment of choosing, rather than discovered on the agent's page a day later.
 */
function PodTerms({
  value,
  cadenceSec,
  isPaper,
}: {
  value: ModelChoice;
  cadenceSec?: number;
  isPaper: boolean;
}) {
  return (
    <div className="flex gap-4 border border-grid bg-panel px-5 py-4">
      <span className="mt-0.5 w-0.5 shrink-0 self-stretch bg-accent" />
      <div className="space-y-2 font-ui text-[12.5px] leading-relaxed text-text-secondary">
        <p>
          {value.label} is prepaid.{" "}
          {isPaper
            ? "You fund it from your own wallet — a paper agent has no wallet of its own until you grant delegation."
            : "It is funded from this agent's wallet, in USDC."}{" "}
          Nothing is charged now: the agent does not exist yet. You top it up on its page, right
          after this.
        </p>
        <p>
          It never tops itself up. When the balance runs out the agent pauses and asks you, rather
          than spending anything you did not put there.
        </p>
        {value.maxPriceInputUsd !== undefined ? (
          <p>
            You&apos;ll pay at most ${value.maxPriceInputUsd} per million tokens in and $
            {value.maxPriceOutputUsd} out — Pod&apos;s own cap for this model, which its providers
            are held to. Most cycles cost less; if the price ever rises past it, the agent holds
            instead of paying more.
          </p>
        ) : null}
        {cadenceSec ? (
          <p className="text-text-dim">
            At {cadence(cadenceSec)} cycles that is {perDay(cadenceSec)} cycles a day.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ModeCard({
  title,
  badge,
  body,
  active,
  onClick,
}: {
  title: string;
  badge?: string;
  body: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-full flex-col gap-2.5 border p-5 text-left transition-colors ${
        active ? "border-accent bg-accent-wash" : "border-grid hover:border-grid-strong"
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span
          className={`font-mono text-[11.5px] tracking-[0.1em] uppercase ${
            active ? "text-accent" : "text-text-primary"
          }`}
        >
          {title}
        </span>
        {badge ? (
          <span className="shrink-0 font-mono text-[9px] tracking-[0.12em] text-accent uppercase">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="font-ui text-[12.5px] leading-relaxed text-text-dim">{body}</span>
    </button>
  );
}

function Note({ children, tone }: { children: React.ReactNode; tone?: "negative" }) {
  return (
    <p
      className={`border px-4 py-3 font-ui text-[12.5px] ${
        tone === "negative" ? "border-negative text-negative" : "border-grid text-text-secondary"
      }`}
    >
      {children}
    </p>
  );
}

/**
 * Why there are no models to choose from.
 *
 * The first version of this said "Pod is listing no models we can run right
 * now" for every cause, which was actively misleading: the usual cause is that
 * nobody has funded the account Canopy reads the catalogue with, and no amount
 * of waiting fixes that. Each sentence below names something a reader can
 * either act on or stop worrying about.
 */
function emptyReason(status?: string, searching?: boolean): string {
  if (status === "unreachable") {
    return "Pod could not be reached just now. Your agent can still run on the included model.";
  }
  if (searching) return "No model matches that.";
  return "Pod is listing no models we can run right now.";
}

/* ----------------------------------------------------------------- helpers -- */

/** Sub-cent costs are the normal case here, so a plain $0.00 would say nothing. */
function cents(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(5)}`;
}

/** Prices run to thousandths of a dollar per million tokens. Show them. */
function fine(usd: number): string {
  if (usd >= 1) return usd.toFixed(2);
  return usd.toFixed(3);
}

function cadence(sec: number): string {
  if (sec % 3600 === 0) return `${sec / 3600}h`;
  return `${Math.round(sec / 60)}m`;
}

function perDay(sec: number): number {
  return Math.round(86_400 / sec);
}
