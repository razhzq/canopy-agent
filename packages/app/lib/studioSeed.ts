// A one-time handoff from Studio (or Ask) into the builder.
//
// Studio composes the sentence first, so the markets it named are already
// known; the builder then opens on its rules step with those markets picked
// and the sentence sent as the first turn. Session storage, read once and
// cleared, so a reload of the builder later resumes its own saved draft
// instead of replaying the handoff.

import type { UniverseAsset } from "@/lib/api";

const KEY = "canopy:studio:seed";

export interface StudioSeed {
  sentence: string;
  markets: UniverseAsset[];
}

export function writeSeed(seed: StudioSeed): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(seed));
  } catch {
    /* the builder opens empty; nothing is lost but the head start */
  }
}

export function takeSeed(): StudioSeed | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const s = JSON.parse(raw) as StudioSeed;
    return typeof s?.sentence === "string" && Array.isArray(s.markets) ? s : null;
  } catch {
    return null;
  }
}
