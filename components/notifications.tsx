"use client";

// Connecting Telegram.
//
// ONE CARD, ONE DECISION. The header says what this is and whether it is
// connected; the one action that changes that sits beside it. The body says
// what you will get, in three lines, before you are asked to accept it.
//
// WHAT HAPPENS AFTER YOU PRESS CONNECT
//
// The link is finished inside Telegram — a chat opens with a one-time code,
// you send it, and the bot claims the link. Nothing on this page can observe
// that moment directly, so this used to say "come back and refresh". Now it
// watches for you: while the Telegram window is open it re-reads the status
// every few seconds, quietly, and flips to Connected the moment the claim
// lands. The polling is its own request rather than a reload of the panel's
// data, because a reload blanks the panel to a skeleton, and a card that
// flashes every three seconds reads as broken.
//
// Approving a trade from the chat is deliberately absent: Telegram identifies a
// chat, not a person. The card says so in one clause.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Send } from "lucide-react";
import { useApi } from "@/lib/useApi";
import {
  getTelegramStatus,
  linkTelegram,
  setTelegramEnabled,
  setTelegramPrefs,
  unlinkTelegram,
  type MutableTelegramKind,
} from "@/lib/api";
import { SectionHead, Callout, InfoIcon } from "./ui";
import { ErrorState, SignedOutState } from "./states";
import { SkeletonPanel } from "./skeleton";
import { StatusLine, FOCUS, LABEL, SURFACE } from "./kit";
import { useT, type TranslationKey } from "@/lib/i18n";

/** The kinds an owner may switch off, in the order they are listed. */
const KINDS: { key: MutableTelegramKind; label: TranslationKey; note: TranslationKey }[] = [
  { key: "fill", label: "tg_kind_fill", note: "tg_kind_fill_note" },
  { key: "proposal", label: "tg_kind_proposal", note: "tg_kind_proposal_note" },
  { key: "risk_hold", label: "tg_kind_risk_hold", note: "tg_kind_risk_hold_note" },
  { key: "alert", label: "tg_kind_alert", note: "tg_kind_alert_note" },
  { key: "discovery", label: "tg_kind_discovery", note: "tg_kind_discovery_note" },
  { key: "digest", label: "tg_kind_digest", note: "tg_kind_digest_note" },
];

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** An hour of the day in UTC, or off. Mono digits, the same face as figures. */
function HourSelect({
  id,
  value,
  offLabel,
  disabled,
  onChange,
}: {
  id: string;
  value: number | null;
  offLabel: string;
  disabled?: boolean;
  onChange: (h: number | null) => void;
}) {
  return (
    <select
      id={id}
      value={value === null ? "off" : String(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === "off" ? null : Number(e.target.value))}
      className={`${SURFACE} h-8 px-2 font-mono text-[11.5px] text-text-primary outline-none focus:border-accent disabled:opacity-50`}
    >
      <option value="off" className="bg-bg">
        {offLabel}
      </option>
      {HOURS.map((h) => (
        <option key={h} value={String(h)} className="bg-bg">
          {String(h).padStart(2, "0")}:00
        </option>
      ))}
    </select>
  );
}

/** How often to look for the claim while Telegram is open, and for how long. */
const WATCH_MS = 3_000;
const WATCH_FOR_MS = 120_000;

export function NotificationSettings() {
  const { getAccessToken } = usePrivy();
  const t = useT();
  const state = useApi(getTelegramStatus, []);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Set when Connect was pressed and the claim has not landed yet.
  const [watching, setWatching] = useState(false);
  const watchStarted = useRef(0);

  const run = useCallback(
    async (fn: (token: string) => Promise<unknown>) => {
      setBusy(true);
      setFailure(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error(t("billing_session_expired"));
        await fn(token);
        state.reload();
      } catch (err) {
        setFailure(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [getAccessToken, state, t],
  );

  const connect = useCallback(async () => {
    setBusy(true);
    setFailure(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("billing_session_expired"));
      const { url } = await linkTelegram(token);
      // Opened rather than rendered as a link the user must click twice. The
      // token is single-use and minted by the call that just returned, so the
      // shortest possible path from mint to use is also the safest one.
      window.open(url, "_blank", "noopener,noreferrer");
      watchStarted.current = Date.now();
      setWatching(true);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [getAccessToken, t]);

  const linkedNow = state.phase === "ready" && state.data.linked;

  // Watch for the claim. Stops when it lands, when two minutes pass, or when
  // the tab is hidden — Telegram is a separate window, so this keeps going in
  // the background, which is the whole point.
  useEffect(() => {
    if (!watching) return;
    if (linkedNow) {
      setWatching(false);
      return;
    }
    let cancelled = false;
    const id = setInterval(async () => {
      if (Date.now() - watchStarted.current > WATCH_FOR_MS) {
        setWatching(false);
        return;
      }
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        const s = await getTelegramStatus(token);
        if (!cancelled && s.linked) {
          setWatching(false);
          state.reload();
        }
      } catch {
        /* a missed poll is nothing; the next one will look again */
      }
    }, WATCH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [watching, linkedNow, getAccessToken, state]);

  if (state.phase === "loading") return <SkeletonPanel labelKey="loading_telegram" lines={5} />;
  if (state.phase === "signed-out") {
    return <SignedOutState note={t("tg_signed_out_note")} />;
  }
  if (state.phase === "error") {
    return <ErrorState message={state.message} onRetry={state.reload} />;
  }

  const { configured, linked, username, enabled, mutedKinds, quietFrom, quietTo, digestHourUtc } =
    state.data;
  const quietOn = quietFrom !== null && quietTo !== null;

  return (
    <div className="space-y-6">
      <SectionHead
        index="02"
        title={t("tg_section")}
        note={t(
          linked ? (enabled ? "tg_state_connected" : "tg_state_muted") : "tg_state_not_connected",
        )}
      />

      {!configured ? (
        <Callout tone="info" icon={<InfoIcon />} title={t("tg_unavailable_title")}>
          {t("tg_unavailable_body")}
        </Callout>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {/* ------------------------------------------------------ header */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-text-secondary"
                aria-hidden
              >
                <Send className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="font-ui text-[14px] font-medium text-text-primary">
                  {linked
                    ? username
                      ? t("tg_connected_as", { username })
                      : t("tg_connected")
                    : t("tg_section")}
                </p>
                <div className="pt-0.5">
                  {linked ? (
                    <StatusLine tone={enabled ? "good" : "pending"}>
                      {t(enabled ? "tg_delivering" : "tg_muted_body")}
                    </StatusLine>
                  ) : watching ? (
                    <StatusLine tone="pending" live>
                      {t("tg_waiting")}
                    </StatusLine>
                  ) : (
                    <span className="font-ui text-[12.5px] text-text-dim">
                      {t("tg_not_connected_body")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {linked ? (
              // Delivering | Muted, as the state of one control rather than a
              // button whose label flips. Selecting is not committing, so the
              // active half is a surface fill, not green.
              <div
                role="group"
                aria-label={t("tg_delivery_aria")}
                className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-bg p-1"
              >
                {(["on", "off"] as const).map((k) => {
                  const active = k === "on" ? enabled : !enabled;
                  return (
                    <button
                      key={k}
                      type="button"
                      disabled={busy}
                      aria-pressed={active}
                      onClick={() =>
                        active
                          ? undefined
                          : void run((token) => setTelegramEnabled(token, k === "on"))
                      }
                      className={`h-8 rounded-full px-3.5 font-ui text-[12.5px] font-medium transition-colors disabled:opacity-50 ${FOCUS} ${
                        active
                          ? "bg-surface-2 text-text-primary"
                          : "text-text-dim hover:text-text-primary"
                      }`}
                    >
                      {t(k === "on" ? "tg_toggle_delivering" : "tg_toggle_muted")}
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void connect()}
                className={`inline-flex h-10 shrink-0 items-center justify-center rounded-full px-5 font-ui text-[13px] font-medium transition-[transform,background-color,color] disabled:opacity-40 ${FOCUS} ${
                  watching
                    ? "border border-border text-text-primary hover:border-grid-strong"
                    : "bg-white text-bg hover:-translate-y-px"
                }`}
              >
                {t(busy ? "tg_opening" : watching ? "tg_open_again" : "tg_connect")}
              </button>
            )}
          </div>

          {/* -------------------------------------------------------- body */}
          {linked ? (
            // What arrives. One row per kind, the whole row a control; an
            // off row dims rather than disappears, so the list stays the same
            // shape whichever are on. Breaches have no switch — a stopped
            // agent is the message no setting may silence — so they read as
            // a fixed line under the others.
            <div className="border-t border-grid px-5 py-4">
              <p className="font-ui text-[12.5px] text-text-muted">{t("tg_will_send_title")}</p>
              <ul className="mt-2 divide-y divide-grid">
                {KINDS.map((k) => {
                  const on = !mutedKinds.includes(k.key);
                  return (
                    <li key={k.key}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        disabled={busy}
                        onClick={() =>
                          void run((token) =>
                            setTelegramPrefs(token, {
                              mutedKinds: on
                                ? [...mutedKinds, k.key]
                                : mutedKinds.filter((m) => m !== k.key),
                            }),
                          )
                        }
                        className={`flex w-full items-center justify-between gap-4 py-2.5 text-left transition-opacity disabled:opacity-50 ${FOCUS} ${on ? "" : "opacity-50"}`}
                      >
                        <span className="min-w-0">
                          <span className="block font-ui text-[13px] text-text-primary">{t(k.label)}</span>
                          <span className="block font-ui text-[11.5px] text-text-dim">{t(k.note)}</span>
                        </span>
                        <span
                          className={`relative h-[18px] w-8 shrink-0 rounded-full border transition-colors ${on ? "border-text-secondary bg-text-secondary" : "border-border bg-bg"}`}
                          aria-hidden
                        >
                          <span
                            className={`absolute top-[2px] size-3 rounded-full transition-[left] ${on ? "left-[15px] bg-bg" : "left-[2px] bg-text-muted"}`}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
                <li className="flex items-center justify-between gap-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-ui text-[13px] text-text-primary">{t("tg_kind_breach")}</span>
                    <span className="block font-ui text-[11.5px] text-text-dim">{t("tg_kind_breach_note")}</span>
                  </span>
                  <span className="font-ui text-[11.5px] text-text-muted">{t("tg_always")}</span>
                </li>
              </ul>

              {/* Hours. Two selects for the window, one for the digest; UTC
                  said once in the label rather than after every value. */}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className={LABEL}>{t("tg_quiet_label")}</span>
                  <div className="flex items-center gap-2">
                    <HourSelect
                      id="tg-quiet-from"
                      value={quietOn ? quietFrom : null}
                      offLabel={t("tg_off")}
                      disabled={busy}
                      onChange={(h) =>
                        void run((token) =>
                          setTelegramPrefs(
                            token,
                            h === null
                              ? { quietFrom: null, quietTo: null }
                              : { quietFrom: h, quietTo: quietTo ?? (h + 8) % 24 },
                          ),
                        )
                      }
                    />
                    <span className="font-ui text-[12px] text-text-dim">{t("tg_quiet_to")}</span>
                    <HourSelect
                      id="tg-quiet-to"
                      value={quietOn ? quietTo : null}
                      offLabel="—"
                      disabled={busy || !quietOn}
                      onChange={(h) =>
                        h === null
                          ? undefined
                          : void run((token) => setTelegramPrefs(token, { quietFrom: quietFrom ?? 22, quietTo: h }))
                      }
                    />
                  </div>
                  <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">{t("tg_quiet_note")}</p>
                </div>
                <div className="space-y-2">
                  <span className={LABEL}>{t("tg_digest_label")}</span>
                  <HourSelect
                    id="tg-digest-hour"
                    value={digestHourUtc}
                    offLabel={t("tg_off")}
                    disabled={busy}
                    onChange={(h) => void run((token) => setTelegramPrefs(token, { digestHourUtc: h }))}
                  />
                  <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">{t("tg_digest_note")}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-t border-grid px-5 py-4">
              <p className="font-ui text-[12.5px] text-text-muted">{t("tg_will_send_title")}</p>
              <ul className="mt-2 space-y-1.5 font-ui text-[13px] leading-relaxed text-text-secondary">
                {(["tg_will_send_1", "tg_will_send_2", "tg_will_send_3"] as const).map((k) => (
                  <li key={k} className="flex gap-2.5">
                    <span className="mt-[9px] size-1 shrink-0 rounded-full bg-text-muted" aria-hidden />
                    {t(k)}
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-ui text-[12.5px] text-text-dim">{t("tg_wont_line")}</p>
            </div>
          )}

          {/* ------------------------------------------------------ footer */}
          {linked ? (
            // Utilities: quiet, last, and the destructive one turns red only
            // when pointed at. Reconnect is for the person whose alerts went
            // quiet — it mints a fresh code without dropping this link until
            // the new chat is confirmed.
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-grid px-5 py-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void connect()}
                title={t("tg_reconnect_title")}
                className={`font-ui text-[12.5px] text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40 ${FOCUS}`}
              >
                {t(busy ? "tg_opening" : "tg_reconnect")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(unlinkTelegram)}
                title={t("tg_disconnect_title")}
                className={`font-ui text-[12.5px] text-text-secondary transition-colors hover:text-negative disabled:opacity-40 ${FOCUS}`}
              >
                {t("tg_disconnect")}
              </button>
            </div>
          ) : watching ? (
            <div className="border-t border-grid px-5 py-3">
              <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">
                {t("tg_waiting_help")}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {failure ? (
        <p className="font-ui text-[13px] text-negative" role="alert">
          {failure}
        </p>
      ) : null}
    </div>
  );
}
