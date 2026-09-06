"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { getModels, peekModels, type ModelOption } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { RemoteIcon } from "@/components/remoteIcon";
import { PrepaidBundles } from "@/components/prepaidBundles";
import { bundlesFor } from "@/lib/modelBundles";
import { InfoDot, QUIET } from "@/components/kit";
import { Check, Search } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";

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
 * NOTHING IS CHARGED HERE — BUT THE AMOUNT IS DECIDED HERE.
 *
 * The agent does not exist yet, so it has no Pod account and no deposit code to
 * credit, and a wizard that takes money before the thing exists is a wizard
 * that needs a refund path. The DECISION is a different matter: this screen is
 * the only place that knows the model, its accepted ceiling, and the cadence
 * from step 2 all at once, which is everything a bundle has to be sized
 * against. Asking here and signing later means the funding screen confirms a
 * number rather than opening a fresh question on a page with no context left.
 *
 * That is what `intendedTopUpUsd` has always been for. It was previously
 * defaulted, carried to the rail, and then dropped — the top-up form opened
 * empty and asked again from nothing.
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
  /** Omitted when the wizard owns Back (desktop footer). */
  onBack?: () => void;
  context?: "builder" | "panel";
}) {
  const inBuilder = context === "builder";
  const t = useT();
  // Seeded from the cache so paging back into this step does not flash a
  // spinner over a list that has not changed — the same treatment the market
  // picker gets. useApi still revalidates behind it.
  const catalogue = useApi((t) => getModels(t), [], peekModels() ?? undefined);
  const [query, setQuery] = useState("");
  /**
   * "BUY A MODEL" OPENS THE CATALOGUE; IT DOES NOT PICK ONE. The card used to
   * select the first Pod row on click, silently — a purchase decision made by
   * a button that looked like a category. Now it reveals the list and puts the
   * caret in its search; the choice is the row you press. The list stays
   * hidden while the included model is chosen and nobody has asked to browse,
   * because forty rows of prices under a decision already made is noise.
   */
  const [browsing, setBrowsing] = useState(false);
  const searchBox = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (browsing) requestAnimationFrame(() => searchBox.current?.focus());
  }, [browsing]);

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
    if (!m.selectable) return;

    // THE CEILING RULE IS ABOUT BOUGHT MODELS, AND ONLY ABOUT THOSE.
    //
    // Canopy's model carries no ceiling on purpose: there is nothing to buy and
    // no spend to cap, so `maxPriceInputUsd` is null the way `inputPerMTokenUsd`
    // is — an absent price, not an unpriced risk.
    //
    // That null used to be caught by the same guard as the Pod rows, one line
    // above this branch. The effect was that once someone picked a bought
    // model, clicking "Included" to go back did NOTHING — no change, no error,
    // no reason given. The way out of a purchase decision was a dead button,
    // which is the worst place in the flow to put one.
    if (m.provider === "canopy") {
      onChange({ modelId: m.id, label: m.label, provider: "canopy" });
      return;
    }

    // A BOUGHT model with no ceiling cannot be agreed to: the agreement IS the
    // ceiling. The catalogue marks those unselectable; this is the second lock.
    if (m.maxPriceInputUsd === null) return;

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
            <p className="font-ui text-[12.5px] text-text-muted">{t("pm_step")}</p>
            <h2 className="font-ui text-[22px] leading-tight tracking-[-0.01em] text-text-primary">
              {t("pm_title")}
            </h2>
          </>
        ) : null}
        <p className="flex max-w-[68ch] items-center gap-1.5 font-ui text-[13.5px] leading-relaxed text-text-secondary">
          {t("pm_lede")}
          <InfoDot label={t("pm_title")}>
            {t("pm_lede_more")}
            <span className="block pt-1.5 text-text-dim">
              {t(inBuilder ? "pm_lede_builder" : "pm_lede_panel")}
            </span>
          </InfoDot>
        </p>
      </div>

      {catalogue.phase === "loading" ? (
        <Note>{t("pm_loading")}</Note>
      ) : catalogue.phase === "signed-out" ? (
        <Note>{t("pm_signed_out")}</Note>
      ) : catalogue.phase === "error" ? (
        <Note tone="negative">{t("pm_load_failed", { message: catalogue.message })}</Note>
      ) : !catalogue.data.podEnabled ? (
        // The kill switch, and it is not an error state. Canopy's model is what
        // every agent ran before Pod existed, so this is a working screen with
        // one option rather than a broken one with none.
        <Note>{t("pm_only_included", { label: canopy?.label ?? DEFAULT_MODEL.label })}</Note>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <ModeCard
              title={canopy?.label ?? DEFAULT_MODEL.label}
              badge={t("pm_included")}
              body={t("pm_included_body")}
              active={!onPod && !browsing}
              onClick={() => {
                setBrowsing(false);
                if (canopy) choose(canopy);
                else onChange(DEFAULT_MODEL);
              }}
            />
            <ModeCard
              title={t("pm_buy_title")}
              body={t(isPaper ? "pm_buy_body_paper" : "pm_buy_body_live")}
              active={onPod || browsing}
              onClick={() => setBrowsing(true)}
            />
          </div>

          {onPod || browsing ? (
          <div className="reveal-in space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-ui text-[13px] font-medium text-text-primary">{t("pm_on_pod")}</p>
              <div className="flex items-center gap-3">
                <label className="flex h-9 w-[220px] items-center gap-2 rounded-full border border-border px-3.5 transition-colors focus-within:border-grid-strong hover:border-grid-strong">
                  <Search className="size-3.5 shrink-0 text-text-muted" aria-hidden />
                  <input
                    ref={searchBox}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("pm_search_placeholder")}
                    spellCheck={false}
                    aria-label={t("pm_search_aria")}
                    className="min-w-0 flex-1 bg-transparent font-ui text-[13px] text-text-primary outline-none placeholder:text-text-muted"
                  />
                </label>
                {/* What is on screen versus what matched. The list is capped at
                    forty rows, and a cap nobody is told about reads as "that is
                    all there is". */}
                <span className="tnum font-ui text-[12px] text-text-muted">
                  {matchedCount > pod.length
                    ? t("pm_count_of", { shown: pod.length, total: matchedCount })
                    : t(matchedCount === 1 ? "pm_count_one" : "pm_count_many", { count: matchedCount })}
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.5fr)_130px_120px_110px] items-center gap-x-4 border-b border-grid px-4 py-2.5 font-ui text-[11.5px] text-text-muted">
                <span>{t("pm_col_model")}</span>
                <span className="text-right">{t("pm_col_per_cycle")}</span>
                <span className="text-right">{t("pm_col_per_million")}</span>
                <span className="text-right">{t("pm_col_providers")}</span>
              </div>

              {pod.length === 0 ? (
                <p className="px-4 py-3 font-ui text-[12.5px] text-text-muted">
                  {t(emptyReason(catalogue.data.podStatus, query.trim() !== ""))}
                </p>
              ) : (
                pod.map((m) => {
                  const picked = value.modelId === m.id;
                  const row = (
                    <>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="flex size-[15px] shrink-0 items-center justify-center">
                          {picked ? (
                            <span key="on" className="reveal-in flex size-[15px] items-center justify-center rounded-full bg-accent text-bg">
                              <Check className="size-2.5" strokeWidth={2.5} aria-hidden />
                            </span>
                          ) : m.logo ? (
                            <RemoteIcon src={m.logo} size={15} fallback={null} />
                          ) : null}
                        </span>
                        <span
                          className={`truncate font-mono text-[13px] ${
                            m.selectable ? "text-text-primary" : "text-text-muted"
                          }`}
                        >
                          {m.label}
                        </span>
                        {m.contextTokens ? (
                          <span className="shrink-0 font-ui text-[11px] text-text-dim">
                            {t("pm_context", { k: Math.round(m.contextTokens / 1000) })}
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
                                {t("pm_max_price", { in_: fine(m.maxPriceInputUsd), out: fine(m.maxPriceOutputUsd ?? 0) })}
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
                          ? t("pm_unavailable")
                          : m.providersOnline === null
                            ? "—"
                            : t("pm_online", { count: m.providersOnline })}
                      </span>
                    </>
                  );

                  const className = `grid w-full grid-cols-1 sm:grid-cols-[minmax(0,1.5fr)_130px_120px_110px] items-center gap-x-4 border-b border-grid px-4 py-3 text-left last:border-b-0 ${
                    picked ? "bg-surface-2/60" : ""
                  }`;

                  return m.selectable ? (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={picked}
                      onClick={() => choose(m)}
                      className={`${className} transition-colors hover:bg-surface-2/40`}
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

            {/* HOW MUCH IT STARTS WITH, decided where the numbers that size it
                are. Builder only: in the panel the agent already exists and has
                a balance, and its top-up is a signature away rather than an
                intention. */}
            {onPod && inBuilder ? (
              <StartingBalance
                value={value}
                picked={models.find((m) => m.id === value.modelId) ?? null}
                cadenceSec={cadenceSec}
                onChange={(usdc) => onChange({ ...value, intendedTopUpUsd: usdc })}
              />
            ) : null}
          </div>
          ) : null}
        </>
      )}

      {onBack ? (
        <button type="button" onClick={onBack} className={QUIET}>
          {inBuilder ? t("pm_back_limits") : t("pm_keep_model")}
        </button>
      ) : null}
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
  const t = useT();
  // Three facts as three lines, each with its explanation behind a dot rather
  // than as a paragraph: prepaid, never self-funding, capped.
  const lines: { text: string; more: string }[] = [
    {
      text: t("pm_terms_prepaid", { label: value.label }),
      more: t(isPaper ? "pm_terms_prepaid_paper" : "pm_terms_prepaid_live"),
    },
    { text: t("pm_terms_pauses"), more: t("pm_terms_pauses_more") },
    ...(value.maxPriceInputUsd !== undefined
      ? [
          {
            text: t("pm_terms_cap", { in_: value.maxPriceInputUsd, out: value.maxPriceOutputUsd ?? 0 }),
            more: t("pm_terms_cap_more"),
          },
        ]
      : []),
  ];
  return (
    <div className="reveal-in overflow-hidden rounded-xl border border-border">
      <ul className="divide-y divide-grid">
        {lines.map((l) => (
          <li key={l.text} className="flex items-center gap-1.5 px-4 py-2.5 font-ui text-[12.5px] text-text-secondary">
            {l.text}
            <InfoDot label={l.text}>{l.more}</InfoDot>
          </li>
        ))}
        {cadenceSec ? (
          <li className="px-4 py-2.5 font-ui text-[12px] text-text-dim">
            {t("pm_terms_cadence", { cadence: cadence(cadenceSec), perDay: perDay(cadenceSec) })}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/**
 * What the agent starts with — chosen here, signed for after it exists.
 *
 * THE QUESTION BELONGS TO THIS SCREEN AND NOT TO THE ONE AFTER IT.
 *
 * Sizing a prepaid bundle needs three facts: the model, the ceiling its tokens
 * are priced at, and how often it will run. All three are on this screen and
 * none of them are on the funding screen, which opens after the builder has
 * been torn down. Asking there meant asking with the context gone — an empty
 * USDC field and a rate, on a page that had just told the owner they were out
 * of balance.
 *
 * NOTHING IS CHARGED AND THE WORDING MUST NOT IMPLY IT IS. This is a stated
 * intention that pre-fills a form; the money moves later, against a signature,
 * from a wallet chosen there. "Starts with" rather than "Pay" for exactly that
 * reason.
 */
function StartingBalance({
  value,
  picked,
  cadenceSec,
  onChange,
}: {
  value: ModelChoice;
  /** The catalogue row for the chosen model, for its measured per-cycle cost. */
  picked: ModelOption | null;
  cadenceSec?: number;
  onChange: (usdc: number) => void;
}) {
  const t = useT();
  const bundles = bundlesFor(value.maxPriceInputUsd, value.maxPriceOutputUsd);
  if (!bundles || value.maxPriceInputUsd === undefined || value.maxPriceOutputUsd === undefined) {
    return null;
  }

  const chosen = value.intendedTopUpUsd ?? null;
  // How long the money lasts, in the unit the owner actually holds the question
  // in. Only ever from a MEASURED per-cycle cost — `estCostPerCycleUsd` is null
  // until the model has run somewhere, and a runway extrapolated from a price
  // nobody has spent is a promise we have no basis for.
  const perCycle = picked?.estCostPerCycleUsd ?? null;
  const days =
    chosen !== null && perCycle !== null && perCycle > 0 && cadenceSec
      ? Math.floor(chosen / (perCycle * perDay(cadenceSec)))
      : null;

  return (
    <div className="space-y-2.5">
      <PrepaidBundles
        bundles={bundles}
        priceInPerM={value.maxPriceInputUsd}
        priceOutPerM={value.maxPriceOutputUsd}
        // A number, held as the string PrepaidBundles matches tiers on.
        current={chosen === null ? "" : String(chosen)}
        onPick={onChange}
      />
      <p className="flex items-center gap-1.5 font-ui text-[12px] leading-relaxed text-text-secondary">
        {days !== null
          ? t(days === 1 ? "pm_runway_one" : "pm_runway_many", { days, cadence: cadence(cadenceSec!) })
          : t("pm_nothing_charged")}
        <InfoDot label={t("pm_buy_title")}>{t("pm_nothing_charged_more")}</InfoDot>
      </p>
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
      // Selecting is not committing: the chosen card is a surface, not green.
      className={`flex h-full flex-col gap-2 rounded-xl border p-5 text-left transition-colors ${
        active ? "border-border bg-surface-2" : "border-border hover:border-grid-strong"
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="font-ui text-[14px] font-medium text-text-primary">{title}</span>
        {badge ? (
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-ui text-[11px] text-text-secondary">
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
      className={`rounded-xl border px-4 py-3 font-ui text-[12.5px] ${
        tone === "negative" ? "border-negative text-negative" : "border-border text-text-secondary"
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
function emptyReason(status?: string, searching?: boolean): TranslationKey {
  // "stale" never lands here: it carries a real list, so the empty branch is
  // not reached. It is named anyway, because a status this function does not
  // know would otherwise fall through to "Pod is listing no models", which
  // would be a lie about a list that exists.
  if (status === "unreachable" || status === "stale") {
    return "pm_empty_unreachable";
  }
  if (searching) return "pm_empty_search";
  return "pm_empty_none";
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
