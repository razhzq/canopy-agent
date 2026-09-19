"use client";

import { RailRow } from "@/components/ui";
import { useLocale, dateLocale, type Locale, type Translate } from "@/lib/i18n";
import type { AgentRow } from "@/lib/api";

/**
 * How a running agent runs — the handful of facts that live nowhere else.
 *
 * WHAT IT DELIBERATELY DOES NOT CARRY, and why the list is this short. The rail
 * this came from also stated the book, the capital and the open-position count,
 * and every one of them was the page repeating itself: the book is the switch
 * in the header, the capital is the equity headline's "against $10,000
 * deployed", and the count is the Positions tab, which already reads "Open ·
 * 2". A panel that restates the screen it sits on teaches the reader to skip
 * it, and then it is carrying the three facts below past a reader who has
 * stopped looking.
 *
 * The open-position row was also WRONG. It printed `positions.length` over
 * `maxTradesPerTick` — entries per CYCLE — as though the denominator were a
 * concurrency cap, so an agent holding two lots with a two-per-cycle entry
 * limit read "2 / 2", which is "full" in every other table in the product. The
 * real cap is `maxOpenPositions`, and it is stated in the caps sentence under
 * Watching now. Deleting the row deletes the bug.
 *
 * SHARED BECAUSE BOTH LAYOUTS NEED IT. The desktop rail had it and the phone
 * had nothing — no cadence, no autonomy, no position cap, no deploy date — so
 * the same owner could read how their agent runs at a desk and not on a train.
 * One component, so the two cannot drift.
 */
export function AgentFacts({
  agent,
  cadenceSec,
  positionCap,
}: {
  agent: AgentRow;
  /**
   * Seconds between cycles.
   *
   * Passed in rather than read here because the two layouts know it from
   * different places: the desktop has the strategy row (`tick_interval_sec`)
   * and the phone does not, so it falls back to the mandate's snapshot — the
   * same value, copied onto the agent at deploy.
   */
  cadenceSec: number | null;
  /** The mandate's position cap in dollars, or null when it cannot be resolved. */
  positionCap: number | null;
}) {
  const { t, locale } = useLocale();
  const constraints = agent.mandate?.constraints ?? {};

  return (
    <dl>
      <RailRow
        label={t("ad_row_cadence")}
        value={cadenceSec ? cadence(cadenceSec, t) : "—"}
      />
      <RailRow
        label={t("ad_row_deployed")}
        value={absolute(agent.created_at, locale)}
      />
      {/* THE ACT, NOT THE ENUM. This printed `agent.autonomy` with its
          underscores swapped for spaces — "execute with caps" — which is the
          column name, not a sentence anyone would say. The thread already tells
          the owner the same thing in words ("I trade within your caps and close
          on your exit rules without asking"); this is that, shortened. */}
      <RailRow
        label={t("ad_row_autonomy")}
        value={t(
          agent.autonomy === "propose_only"
            ? "ad_autonomy_propose"
            : "ad_autonomy_caps",
        )}
      />
      {/* THE CAP, IN WHICHEVER UNIT IS TRUE YET.
          `positionCap` is null for two unrelated reasons — no cap was set, or
          there is no book to resolve it against — and a single dash said both.
          A cap the owner set is a real answer even before the money arrives, so
          it is stated as the percent they chose; `$0` would be a figure that
          means nothing (legacy §10, "absence of history is not data"). No cap
          at all does not apply, which is rule 12's own exception to "dim, don't
          hide", so the row goes. */}
      {positionCap !== null ? (
        <RailRow
          label={t("ad_row_position_cap")}
          value={t("ad_position_cap_value", { amount: money(positionCap) })}
        />
      ) : constraints.maxPositionPct ? (
        <RailRow
          label={t("ad_row_position_cap")}
          value={t("ad_position_cap_pct", { pct: constraints.maxPositionPct })}
        />
      ) : null}
      {/* What the reasoning costs, where the other per-agent facts are. Only
          for a bought model: a Canopy agent has no balance, and a row reading
          "—" would imply one it is missing. */}
      {agent.model && agent.model.provider === "pod" ? (
        <RailRow label={t("ad_row_model")} value={agent.model.label} />
      ) : null}
      {/* HIDDEN, NOT DASHED. Rule 12 dims what is not reachable YET and hides
          what does not apply at all, and an agent whose owner never chose a
          compliance profile is the second: there is no reading to wait for. A
          dash here asked the reader to wonder what was missing, at the foot of
          the panel, which is the last thing they see. */}
      {constraints.complianceProfile ? (
        <RailRow
          label={t("ad_row_compliance")}
          value={constraints.complianceProfile}
        />
      ) : null}

      {/* THE CAPS, AS FACTS RATHER THAN AS TWO SENTENCES.
          These were prose at the foot of "Watching now" — "Agent-wide breaker
          at −20% from the high-water mark…", "at most 5 positions open — exits
          always run." They are configuration, which is what this table is, and
          they are the numbers an owner checks rather than reads: rule 9 wants
          them aligned in the value column, not buried mid-sentence where no two
          of them line up.

          Each is shown only when it is set. An unset cap is not a cap of zero,
          and a row saying "—" would imply a limit that is missing rather than
          one that was never asked for. */}
      {constraints.maxDrawdownPct ? (
        <RailRow
          label={t("ad_row_breaker")}
          value={t("ad_breaker_value", { pct: constraints.maxDrawdownPct })}
        />
      ) : null}
      {constraints.maxOpenPositions ? (
        <RailRow
          label={t("ad_row_open_at_once")}
          value={`≤ ${constraints.maxOpenPositions}`}
        />
      ) : null}
      {constraints.dailyLossLimitPct ? (
        <RailRow
          label={t("ad_row_daily_loss")}
          value={`−${constraints.dailyLossLimitPct}%`}
        />
      ) : null}
      {constraints.cooldownAfterLosses ? (
        <RailRow
          label={t("ad_row_cooldown")}
          value={t("ad_cooldown_value", {
            losses: constraints.cooldownAfterLosses.losses,
            minutes: constraints.cooldownAfterLosses.minutes,
          })}
        />
      ) : null}
      {/* THE SENTENCE THAT MUST SURVIVE THE TABLE. Every cap above stops the
          agent BUYING; none of them stops it selling. Read as a bare list a
          reader could reasonably conclude that a breaker at −20% leaves their
          position unmanaged, which is the opposite of what it does. */}
      {hasCaps(constraints) ? (
        <p className="pt-2.5 font-ui text-[11.5px] leading-relaxed text-text-muted">
          {t("ad_caps_note")}
        </p>
      ) : null}
    </dl>
  );
}

/** Whether any entry cap is set, and so whether the note below them applies. */
function hasCaps(c: {
  maxDrawdownPct?: number;
  maxOpenPositions?: number;
  dailyLossLimitPct?: number;
  cooldownAfterLosses?: unknown;
}): boolean {
  return !!(
    c.maxDrawdownPct ||
    c.maxOpenPositions ||
    c.dailyLossLimitPct ||
    c.cooldownAfterLosses
  );
}

/** Seconds between cycles, in the largest whole unit that divides them. */
function cadence(sec: number, t: Translate): string {
  if (sec % 86_400 === 0) return t("ad_cadence_days", { n: sec / 86_400 });
  if (sec % 3600 === 0) return t("ad_cadence_hours", { n: sec / 3600 });
  return t("ad_cadence_minutes", { n: Math.round(sec / 60) });
}

function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** The deploy timestamp, in the reader's calendar conventions. */
function absolute(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(dateLocale(locale), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
