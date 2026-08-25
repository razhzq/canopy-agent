"use client";

// The account's username, in one place.
//
// Two screens need it — the account menu and the portfolio header — and a
// per-component fetch would mean two requests and, worse, two answers on screen
// for a moment after someone sets one. A module-level cache with subscribers is
// enough here: there is exactly one signed-in identity per tab, and it never
// changes without a reload.
//
// NOT the source of truth. canopy-fe owns setting usernames and this reads the
// same `users` row over the same endpoints; the cache only avoids asking twice.

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { getUserProfile, setUsername as setUsernameApi } from "@/lib/api";
import { useT } from "@/lib/i18n";

type State = {
  /** null = this identity has no username yet. */
  username: string | null;
  /** False until the profile has been read once — do not render "unset" before. */
  loaded: boolean;
};

let cache: State = { username: null, loaded: false };
let inFlight: Promise<void> | null = null;
let cachedFor: string | null = null;
const subscribers = new Set<() => void>();

function publish(next: State) {
  cache = next;
  for (const fn of subscribers) fn();
}

/**
 * The username, fetched once per identity.
 *
 * `loaded` matters as much as the value. Rendering "Set a username" against an
 * unread profile flashes a prompt at people who already have one, which is a
 * worse first impression than a moment of nothing.
 */
export function useUsername() {
  const t = useT();
  const { authenticated, user, getAccessToken } = usePrivy();
  const privyId = user?.id ?? null;
  const [, bump] = useState(0);

  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);

  useEffect(() => {
    if (!authenticated || !privyId) return;
    // A different identity signed in — the cached name is not theirs.
    if (cachedFor !== privyId) {
      cachedFor = privyId;
      inFlight = null;
      publish({ username: null, loaded: false });
    }
    if (cache.loaded || inFlight) return;

    inFlight = (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const profile = await getUserProfile(token, privyId);
        publish({ username: profile?.username ?? null, loaded: true });
      } catch (err) {
        // Loaded stays false, so nothing claims the user has no username on the
        // strength of a request that never answered.
        if (process.env.NODE_ENV !== "production") {
          console.warn("[username] profile read failed", err instanceof Error ? err.message : err);
        }
      } finally {
        inFlight = null;
      }
    })();
  }, [authenticated, privyId, getAccessToken]);

  const save = useCallback(
    async (name: string) => {
      if (!privyId) throw new Error(t("error_session_expired"));
      const token = await getAccessToken();
      if (!token) throw new Error(t("error_session_expired"));
      const { user: updated } = await setUsernameApi(token, privyId, name);
      publish({ username: updated.username ?? name, loaded: true });
    },
    [privyId, getAccessToken, t],
  );

  return { username: cache.username, loaded: cache.loaded, save };
}
