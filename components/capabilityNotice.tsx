"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  dismissCapabilityNotices,
  getCapabilityNotices,
  type CapabilityNotice,
} from "@/lib/api";

/**
 * "You asked for this. It exists now."
 *
 * THE OTHER HALF OF A REFUSAL.
 *
 * When the composer cannot turn a sentence into a rule it records the phrase
 * and tells the author it was noted. That promise is only worth making if
 * something eventually comes back, and this is the something.
 *
 * It lives on the agents page rather than in the builder because the two ends
 * are months apart: the person who asked may never have finished a strategy —
 * a refused first sentence is a good reason to give up — so the notice is keyed
 * to the PERSON, not to an agent they might not have.
 *
 * SILENT ON EVERY OTHER DAY. It renders nothing while loading, nothing on
 * error, and nothing when there is nothing to say. A rail that occupies space
 * to announce it has no news trains people to skip the space.
 */
export function CapabilityNotices() {
  const { authenticated, getAccessToken } = usePrivy();
  const [notices, setNotices] = useState<CapabilityNotice[]>([]);

  const load = useCallback(async () => {
    if (!authenticated) return;
    try {
      const token = await getAccessToken();
      if (!token) return;
      const { notices: found } = await getCapabilityNotices(token);
      setNotices(found);
    } catch {
      // Deliberately silent. This is good news nobody is waiting on — failing
      // to fetch it must never put an error banner above someone's agents.
    }
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function dismiss(phraseNorm: string) {
    // Removed locally first: the row is gone the moment it is clicked, and a
    // dismissal that fails server-side simply reappears on the next load rather
    // than leaving a button that seems not to work.
    setNotices((current) => current.filter((n) => n.phraseNorm !== phraseNorm));
    try {
      const token = await getAccessToken();
      if (token) await dismissCapabilityNotices(token, [phraseNorm]);
    } catch {
      /* see above */
    }
  }

  if (notices.length === 0) return null;

  return (
    <section className="border-b border-grid px-8 py-4">
      <ul className="space-y-2">
        {notices.map((n) => (
          <li
            key={n.phraseNorm}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border border-accent/30 bg-accent-wash px-4 py-3"
          >
            <span className="min-w-0 font-ui text-[13px] text-text-primary">
              You asked for{" "}
              <span className="font-mono text-[12.5px] text-accent">{n.example}</span>.{" "}
              {/*
                The two statuses are genuinely different news and are worded
                that way. "It works now" after someone was told it did not is an
                apology; "we built it" is not.
              */}
              {n.status === "shipped"
                ? "It has been built and you can use it now."
                : "It turns out the agent could already do this."}
              {n.capabilityKey ? (
                <span className="text-text-secondary">
                  {" "}
                  Set it up under{" "}
                  <span className="font-mono text-[12.5px]">{n.capabilityKey}</span>.
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => void dismiss(n.phraseNorm)}
              className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase transition-colors hover:text-text-primary"
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
