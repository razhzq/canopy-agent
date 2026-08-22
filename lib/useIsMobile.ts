"use client";

// Is this a small screen, in JavaScript rather than in CSS?
//
// Most of the mobile work is `lg:hidden` — the layout differs but the data does
// not, so rendering both and hiding one costs nothing. The agent detail screen
// is the exception: its phase bar needs a request the desktop layout has no use
// for, and a hidden component still mounts and still fetches.
//
// Starts `null`, not `false`. The server cannot know the viewport, so guessing
// either way renders one layout and then swaps it — a hydration mismatch on
// every load. `null` means "not known yet" and callers render neither.

import { useEffect, useState } from "react";

/** Matches Tailwind's `lg`. Below this is the phone layout. */
const QUERY = "(max-width: 1023.98px)";

export function useIsMobile(): boolean | null {
  const [is, setIs] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const sync = () => setIs(mq.matches);
    sync();
    // Rotating a phone crosses this boundary, and so does a desktop window
    // being dragged narrow — both should swap the layout rather than leave the
    // wrong one in place until navigation.
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return is;
}
