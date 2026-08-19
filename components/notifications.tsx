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

const BTN =
  "flex h-11 items-center justify-center gap-2.5 border px-6 font-mono text-[11px] tracking-[0.1em] uppercase transition-colors disabled:opacity-40";

export function NotificationSettings() {
  const { getAccessToken } = usePrivy();
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
        if (!token) throw new Error("Session expired. Sign in again.");
        await fn(token);
        state.reload();
      } catch (err) {
        setFailure(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [getAccessToken, state],
  );

  const connect = useCallback(async () => {
    setBusy(true);
    setFailure(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Session expired. Sign in again.");
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
  }, [getAccessToken]);

  if (state.phase === "loading") return <SkeletonPanel label="TELEGRAM" lines={5} />;
  if (state.phase === "signed-out") {
    return <SignedOutState note="Notification settings belong to your account." />;
  }
  if (state.phase === "error") {
    return <ErrorState message={state.message} onRetry={state.reload} />;
  }

  const { configured, linked, username, enabled } = state.data;

  return (
    <div className="space-y-8">
      <SectionHead
        index="02"
        title="TELEGRAM"
        note={linked ? (enabled ? "connected" : "muted") : "not connected"}
      />

      {!configured ? (
        <Callout tone="info" icon={<InfoIcon />} title="Not available here">
          This deployment has no Telegram bot configured, so there is nothing to
          connect to yet.
        </Callout>
      ) : (
        <>
          <div className="space-y-6 border border-grid px-6 py-6">
            <div className="space-y-3">
              <p className="font-mono text-[12px] tracking-[0.06em] text-text-primary uppercase">
                What you will be sent
              </p>
              <ul className="space-y-2 font-ui text-[13px] leading-relaxed text-text-secondary">
                <li>— Every trade an agent makes, with what it earned or lost.</li>
                <li>— Anything waiting on your decision.</li>
                <li>— A drawdown limit being hit, and the agent stopping itself.</li>
                <li>— Trading being frozen because prices went unreadable, and it lifting.</li>
              </ul>
            </div>

            <div className="space-y-3 border-t border-grid pt-5">
              <p className="font-mono text-[12px] tracking-[0.06em] text-text-dim uppercase">
                What you will not be sent
              </p>
              <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
                Ordinary cycles where the agent looked and did nothing. That is
                most of them — about three in four — and sending those would bury
                the messages above. Silence here means the agent is working, not
                that it is stuck.
              </p>
            </div>

            <div className="space-y-3 border-t border-grid pt-5">
              <p className="font-mono text-[12px] tracking-[0.06em] text-text-dim uppercase">
                Approving from Telegram
              </p>
              <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
                Not possible, on purpose. Telegram identifies a chat, not a
                person — so a reply that could authorise a trade would turn an
                unlocked phone into trading authority. Proposals are approved in
                Canopy, behind your login.
              </p>
            </div>
          </div>

          {linked ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between border border-grid px-6 py-5">
                <div className="space-y-1">
                  <p className="font-mono text-[12px] tracking-[0.06em] text-text-primary uppercase">
                    Connected{username ? ` · @${username}` : ""}
                  </p>
                  <p className="font-ui text-[13px] text-text-secondary">
                    {enabled
                      ? "Alerts are being delivered to this chat."
                      : "Muted. The chat stays connected; nothing is sent."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run((t) => setTelegramEnabled(t, !enabled))}
                  className={`${BTN} border-border text-text-secondary hover:bg-surface`}
                >
                  {enabled ? "Mute" : "Unmute"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(unlinkTelegram)}
                  className={`${BTN} border-border text-text-dim hover:border-negative hover:text-negative`}
                >
                  Disconnect
                </button>
              </div>

              {/* Muting and disconnecting are not the same promise, and the
                  difference matters to someone acting on a lost phone. */}
              <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">
                Muting keeps the connection and stops the messages. Disconnecting
                forgets the chat entirely — reconnecting needs a new link.
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
                {busy ? "Opening Telegram…" : "Connect Telegram"}
              </button>
              <p className="font-ui text-[12.5px] leading-relaxed text-text-dim">
                This opens a chat with the Canopy bot carrying a one-time code.
                Send the message it pre-fills, then come back and refresh this
                page — the connection completes in Telegram, so this screen only
                learns about it on its next look.
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
