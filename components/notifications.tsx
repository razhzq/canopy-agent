"use client";

// Connecting Telegram.
//
// The whole screen is one decision — connected or not — so it is one panel
// rather than a settings page with a section in it. Everything else here is in
// service of making that decision honestly:
//
// - It says WHAT will be sent before asking for the connection, because
//   "connect Telegram" without that is asking someone to accept an unknown
//   volume of messages from a trading system.
// - It says what will NOT be sent. Most cycles do nothing, and an owner who
//   expects a message every hour will read silence as a broken agent.
// - Approving a trade from the chat is deliberately absent, and the panel says
//   so, because the obvious question on seeing a proposal alert is "can I just
//   reply yes?" — and the answer has a reason.

import { useCallback, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useApi } from "@/lib/useApi";
import {
  getTelegramStatus,
  linkTelegram,
  setTelegramEnabled,
  unlinkTelegram,
} from "@/lib/api";
import { SectionHead, Callout, InfoIcon } from "./ui";
import { ErrorState, SignedOutState } from "./states";
import { SkeletonPanel } from "./skeleton";
import { useT } from "@/lib/i18n";

const BTN =
  "flex h-11 items-center justify-center gap-2.5 border px-6 font-mono text-[11px] tracking-[0.1em] uppercase transition-colors disabled:opacity-40";

export function NotificationSettings() {
  const { getAccessToken } = usePrivy();
  const t = useT();
  const state = useApi(getTelegramStatus, []);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Runs one mutation, then reloads.
   *
   * The reload is what makes the panel truthful: linking finishes in TELEGRAM,
   * not here — the user leaves, sends `/start`, and comes back. Nothing this
   * component does can observe that moment, so the state is re-read rather than
   * assumed, and the panel below tells the user to come back and refresh rather
   * than pretending it will update itself.
   */
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
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [getAccessToken, t]);

  if (state.phase === "loading") return <SkeletonPanel labelKey="loading_telegram" lines={5} />;
  if (state.phase === "signed-out") {
    return <SignedOutState note={t("tg_signed_out_note")} />;
  }
  if (state.phase === "error") {
    return <ErrorState message={state.message} onRetry={state.reload} />;
  }

  const { configured, linked, username, enabled } = state.data;

  return (
    <div className="space-y-8">
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
        <>
          <div className="space-y-6 border border-grid px-6 py-6">
            <div className="space-y-3">
              <p className="font-mono text-[12px] tracking-[0.06em] text-text-primary uppercase">
                {t("tg_will_send_title")}
              </p>
              <ul className="space-y-2 font-ui text-[13px] leading-relaxed text-text-secondary">
                <li>{t("tg_will_send_1")}</li>
                <li>{t("tg_will_send_2")}</li>
                <li>{t("tg_will_send_3")}</li>
                <li>{t("tg_will_send_4")}</li>
              </ul>
            </div>

            <div className="space-y-3 border-t border-grid pt-5">
              <p className="font-mono text-[12px] tracking-[0.06em] text-text-dim uppercase">
                {t("tg_wont_send_title")}
              </p>
              <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
                {t("tg_wont_send_body")}
              </p>
            </div>

            <div className="space-y-3 border-t border-grid pt-5">
              <p className="font-mono text-[12px] tracking-[0.06em] text-text-dim uppercase">
                {t("tg_approving_title")}
              </p>
              <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
                {t("tg_approving_body")}
              </p>
            </div>
          </div>

          {linked ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between border border-grid px-6 py-5">
                <div className="space-y-1">
                  <p className="font-mono text-[12px] tracking-[0.06em] text-text-primary uppercase">
                    {username ? t("tg_connected_as", { username }) : t("tg_connected")}
                  </p>
                  <p className="font-ui text-[13px] text-text-secondary">
                    {t(enabled ? "tg_delivering" : "tg_muted_body")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run((token) => setTelegramEnabled(token, !enabled))}
                  className={`${BTN} border-border text-text-secondary hover:bg-surface`}
                >
                  {t(enabled ? "tg_mute" : "tg_unmute")}
                </button>
                {/* RECONNECT, FOR THE PERSON WHO KNOWS BEFORE WE DO.
                    A link dies for reasons this panel cannot see — the chat was
                    blocked, the account deactivated, or the bot itself was
                    replaced, which invalidates every chat it ever had. We only
                    learn on the first send that fails, and the user learns by
                    not being told something that mattered.
                    Without this the only way back was Disconnect → Connect, and
                    nobody whose alerts have gone quiet reaches for the button
                    that says it will forget the chat. Minting is safe while
                    connected: `offerLink` leaves the existing link working until
                    the new code is actually claimed, so pressing this and
                    changing your mind costs nothing. */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void connect()}
                  className={`${BTN} border-border text-text-secondary hover:border-accent hover:text-accent`}
                >
                  {t(busy ? "tg_opening" : "tg_reconnect")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(unlinkTelegram)}
                  className={`${BTN} border-border text-text-dim hover:border-negative hover:text-negative`}
                >
                  {t("tg_disconnect")}
                </button>
              </div>

              {/* Muting and disconnecting are not the same promise, and the
                  difference matters to someone acting on a lost phone. */}
              <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">
                {t("tg_mute_vs_disconnect")}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void connect()}
                className={`${BTN} w-full border-accent text-accent hover:bg-accent-wash sm:w-auto`}
              >
                {t(busy ? "tg_opening" : "tg_connect")}
              </button>
              <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">
                {t("tg_connect_help")}
              </p>
            </div>
          )}
        </>
      )}

      {failure ? (
        <p className="font-ui text-[13px] text-negative" role="alert">
          {failure}
        </p>
      ) : null}
    </div>
  );
}
