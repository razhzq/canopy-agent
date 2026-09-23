"use client";

// WHICH UNIT A BOOK IS SHOWN IN, and the one place that converts between them.
//
// A copy-LP agent's book is a QUANTITY OF SOL (CANOPY_127). The backend serves
// every figure in dollars — that book valued at one rate, sent alongside as
// `solUsd` — so the page can offer SOL or USD without a second request.
//
// ONE RATE FOR EVERY FIGURE ON THE SCREEN. That is the whole reason this is a
// module rather than a `toFixed` at each call site. A panel that converted its
// headline at one rate and its chart at another would show a book that does
// not add up, and the discrepancy would be small enough to look like rounding.
//
// PERCENTAGES AND COUNTS NEVER PASS THROUGH HERE. A return of 4.2% is 4.2% in
// either unit, and nine closed positions are nine. Only amounts convert — and
// routing a percentage through a currency formatter is how "+4.2%" becomes
// "+$4.20" in a language nobody notices.

import { useCallback, useEffect, useState } from "react";

export type BookUnit = "USD" | "SOL";

export interface BookFormat {
  /** Which unit the figures below are being rendered in. */
  unit: BookUnit;
  /** An amount, unsigned: "$1,240" or "6.1841 SOL". */
  money(usd: number): string;
  /** The same, with an explicit sign and a real minus. */
  signed(usd: number): string;
}

/** Dollars, unconverted — what every surface did before there was a choice. */
export const USD_FORMAT: BookFormat = {
  unit: "USD",
  money: (n) => usd(n),
  signed: (n) => sign(n, usd(n)),
};

function usd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${Math.abs(n).toLocaleString("en-US", {
    maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0,
  })}`;
}

/** A SOL quantity, already in SOL — no conversion. */
function solAmount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  return `${a.toLocaleString("en-US", {
    maximumFractionDigits: a < 1 ? 4 : a < 1_000 ? 3 : 1,
  })} SOL`;
}

function sign(n: number, body: string): string {
  if (!Number.isFinite(n)) return "—";
  return n < 0 ? `−${body}` : `+${body}`;
}

/**
 * How to render this book's amounts.
 *
 * `solUsd` NULL FALLS BACK TO DOLLARS rather than to a guess. The page has the
 * dollar figures whatever happens; what it may not have is a rate, and
 * dividing by one it could not read would be inventing a balance.
 */
export function bookFormat(
  unit: BookUnit,
  solUsd: number | null | undefined,
  /**
   * WHICH UNIT THE NUMBERS ARRIVE IN — not which one to show.
   *
   * "USD" is the legacy path: dollar readings, converted for a SOL view by
   * dividing. That division is the bug this whole pair exists to end, because a
   * frozen baseline and a live reading were taken at different rates and
   * dividing both by today's does not cancel. It stays only for history
   * recorded before SOL quantities were.
   *
   * "SOL" means the values are already quantities of SOL, each measured when
   * it was true. A SOL view then formats them as they are — no arithmetic at
   * all — and a USD view multiplies by the current rate, which is an honest
   * "what this is worth now".
   */
  base: BookUnit = "USD",
): BookFormat {
  if (base === "SOL") {
    // Already SOL. Showing SOL is a formatting job; showing dollars is a
    // valuation at the current rate.
    if (unit === "SOL") return { unit: "SOL", money: solAmount, signed: (n) => sign(n, solAmount(n)) };
    if (typeof solUsd === "number" && solUsd > 0) {
      const asUsd = (n: number) => usd(n * solUsd);
      return { unit: "USD", money: asUsd, signed: (n) => sign(n, asUsd(n)) };
    }
    // No rate: the numbers are SOL and cannot honestly be called dollars.
    return { unit: "SOL", money: solAmount, signed: (n) => sign(n, solAmount(n)) };
  }
  if (unit !== "SOL" || !(typeof solUsd === "number" && solUsd > 0)) return USD_FORMAT;
  const sol = (n: number): string => {
    if (!Number.isFinite(n)) return "—";
    const amount = Math.abs(n) / solUsd;
    return `${amount.toLocaleString("en-US", {
      // FOUR PLACES, AND FOUR IS NOT ARBITRARY. At a few hundred dollars a SOL
      // that is a hundredth of a cent — fine enough that a day's fees on a
      // small book do not round to zero, coarse enough that the column does
      // not turn into lamports.
      maximumFractionDigits: amount < 1 ? 4 : amount < 1_000 ? 3 : 1,
    })} SOL`;
  };
  return { unit: "SOL", money: sol, signed: (n) => sign(n, sol(n)) };
}

const KEY = "canopy.bookUnit";

/**
 * The viewer's chosen unit, remembered on this device.
 *
 * A PER-VIEWER CONVENIENCE, which is the only thing browser storage is used
 * for here. Nothing about the book is stored — the unit is a way of looking at
 * figures the server already sent, so losing it costs one click and never a
 * fact. Every read and write is guarded: storage throws in a private window
 * and returns nothing with site data cleared, and a panel that could not
 * render because of that would be a worse bug than a forgotten preference.
 */
export function useBookUnit(available: boolean): [BookUnit, (u: BookUnit) => void] {
  // ALWAYS "SOL" ON THE FIRST RENDER, never a storage read. The server and the
  // browser must agree on the first paint, and reading a per-device preference
  // during render is how a hydration mismatch gets shipped. The stored value
  // arrives in the effect below, after hydration.
  const [unit, set] = useState<BookUnit>("SOL");

  useEffect(() => {
    if (!available) return;
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === "USD" || saved === "SOL") set(saved);
    } catch {
      /* private window, blocked storage — the default stands */
    }
  }, [available]);

  const choose = useCallback((u: BookUnit) => {
    set(u);
    try {
      window.localStorage.setItem(KEY, u);
    } catch {
      /* the choice still applies to this session */
    }
  }, []);

  // A book with no rate has no choice to remember. Reporting USD keeps every
  // caller from having to repeat the fallback that `bookFormat` already makes.
  return [available ? unit : "USD", choose];
}
