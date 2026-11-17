"use client";
// Whether Canopy is paying network fees right now.
//
// One read per mount, cached for the tab: the answer changes when ops flips
// an env var, not between two clicks. Unknown (loading, signed out, error)
// reads as "not sponsored", so a dialog never promises a free fee it cannot
// deliver — the transfer path still tries to sponsor at send time either way,
// and falls back on its own.

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { getGasSponsorship } from "@/lib/api";

let cached: boolean | null = null;

/**
 * A browser-side kill switch for diagnosis: `localStorage.canopy_gas_sponsor =
 * "off"` makes every dialog build self-paid, whatever the backend says. Lets a
 * failing send be split into "the sponsored bytes" versus "the send itself"
 * without a redeploy. Not a setting; not surfaced anywhere.
 */
function forcedOff(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem("canopy_gas_sponsor") === "off";
  } catch {
    return false;
  }
}

export function useGasSponsorship(): { enabled: boolean; known: boolean } {
  const { getAccessToken, authenticated } = usePrivy();
  const [enabled, setEnabled] = useState<boolean | null>(cached);

  useEffect(() => {
    if (cached !== null || !authenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const { enabled: on } = await getGasSponsorship(token);
        cached = on;
        if (!cancelled) setEnabled(on);
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken]);

  return { enabled: enabled === true && !forcedOff(), known: enabled !== null };
}
