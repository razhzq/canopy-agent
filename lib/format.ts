// Number display for a book that spans eighteen orders of magnitude.
//
// A position table holds gold at $4,000 and a memecoin at $0.00005835 in the
// same column. Two fixed decimals serves the first and destroys the second: the
// token renders as "$0.00", which is not a rounded price, it is a wrong one —
// and it is wrong in the way that matters most, because the owner reads it as
// worthless and cannot tell a 3x from a rug.
//
// So precision is a function of magnitude, not a constant. The rules below
// follow the number-formatting spec:
//
//   * scientific notation is never shown — 1.52e-7 is not a price
//   * a value that rounds to zero but is not zero says so ("<$0.01"), because
//     "$0.00" claims a certainty the rounding destroyed
//   * three or more leading zeros collapse into subscript form, so
//     $0.00005835 reads as $0.0₄58 instead of a column of zeros nobody counts
//   * null, NaN and Infinity all render as "—", never as a number
//   * a negative that rounds to zero loses its sign; "-$0.00" is noise
//
// DISPLAY ONLY. Every figure here is derived from a raw value that stays at
// full precision for arithmetic — the formatter is the last step before the
// screen and never feeds anything back.

import type { Translate } from "./i18n/translate";

const DASH = "—";

const SUBSCRIPT = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"] as const;

function subscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUBSCRIPT[Number(d)] ?? d)
    .join("");
}

/** Zeros between the decimal point and the first significant digit. */
function leadingZeros(abs: number): number {
  if (abs >= 1 || abs === 0) return 0;
  // toFixed rather than String(): String() yields "5.835e-5" below 1e-6, and
  // counting zeros in an exponent is how a price becomes nonsense.
  const afterDot = abs.toFixed(20).split(".")[1] ?? "";
  let count = 0;
  for (const ch of afterDot) {
    if (ch === "0") count++;
    else break;
  }
  return count;
}

/** Trailing zeros carry no information below the decimal point. */
function trim(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/**
 * A number as a plain decimal string, with no exponent and no float artefacts.
 *
 * `String(n)` is exact and short for almost everything — but it switches to
 * exponent form below 1e-6, and "1.23e-7" is not a price. `toFixed(20)` never
 * uses an exponent but exposes the binary representation, so 0.1 comes back as
 * 0.10000000000000000555 — which a screen reader would then read out, digit by
 * digit, as the price.
 *
 * So: the short form when it is already plain, and the padded form only when
 * an exponent forced the issue.
 */
function plainDecimal(abs: number): string {
  const s = String(abs);
  if (!s.includes("e") && !s.includes("E")) return s;
  return trim(abs.toFixed(20));
}

export interface PriceParts {
  /** What to render. */
  display: string;
  /** Expanded decimal for screen readers — subscript form is unreadable aloud. */
  label: string;
}

/**
 * The price of ONE unit, at whatever scale that unit happens to trade.
 *
 * Never abbreviated: "$1.2K" is a fine way to show a position's value and a
 * terrible way to show what you paid per token, because the abbreviation hides
 * exactly the digits a price is consulted for.
 */
export function tokenPrice(value: number | null | undefined): PriceParts {
  if (value == null || !Number.isFinite(value)) return { display: DASH, label: "no data" };
  if (value === 0) return { display: "$0.00", label: "$0.00" };

  const negative = value < 0;
  const abs = Math.abs(value);
  const sign = negative ? "−" : "";
  const full = plainDecimal(abs);

  // ≥ $1,000: cents are noise next to the integer part, but they are what a
  // reader expects on a large number, so they stay.
  if (abs >= 1000) {
    const s = abs.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return { display: `${sign}$${s}`, label: `${sign}$${full}` };
  }

  // $1–$1,000: five significant figures, and a floor of two decimals.
  //
  // Trailing zeros are NOT trimmed here, unlike below the decimal point. On a
  // price they carry meaning: "$1.90" states the cents, "$1.9" reads as though
  // the last digit were unknown. And cents stay on round numbers for the same
  // reason — this is a position table for someone's own book, where "$136" for
  // a cost basis invites the question the column exists to answer.
  if (abs >= 1) {
    const intDigits = Math.floor(Math.log10(abs)) + 1;
    const decimals = Math.max(2, Math.min(4, 5 - intDigits));
    return { display: `${sign}$${abs.toFixed(decimals)}`, label: `${sign}$${full}` };
  }

  const zeros = leadingZeros(abs);

  // Under a dollar with a long tail of zeros. Subscript keeps the column
  // narrow AND keeps the digits: $0.0₄58 is both shorter and more informative
  // than $0.0001 rounded, which is a different number entirely.
  if (zeros >= 3) {
    const sig = 4;
    const fixed = abs.toFixed(zeros + sig);
    const afterDot = fixed.split(".")[1] ?? "";
    const digits = trim(`0.${afterDot.slice(zeros, zeros + sig)}`).replace("0.", "");
    return {
      display: `${sign}$0.0${subscript(zeros)}${digits}`,
      label: `${sign}$${full}`,
    };
  }

  // Under a dollar, short tail: plain decimals, four significant figures.
  const decimals = Math.min(8, zeros + 4);
  const shown = trim(abs.toFixed(decimals));
  // Rounds to nothing but is not nothing. Saying "$0.00" would assert a value
  // the rounding threw away.
  if (Number(shown) === 0) return { display: `${sign}<$0.0001`, label: `${sign}$${full}` };
  return { display: `${sign}$${shown}`, label: `${sign}$${full}` };
}

/**
 * A USD amount — what a position is worth, what it cost, what it made.
 *
 * Two decimals always, because these are dollars and dollars have cents. The
 * one exception is an amount that rounds away: "<$0.01" rather than "$0.00",
 * which would read as nothing held at all.
 */
export function usd(value: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  const abs = Math.abs(value);
  // Checked BEFORE the sign is chosen, so a tiny negative cannot render
  // "−$0.00" — a minus sign attached to nothing.
  if (abs > 0 && abs < 0.005) return value < 0 ? "−<$0.01" : "<$0.01";
  const s = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value < 0) return `−$${s}`;
  return opts.sign ? `+$${s}` : `$${s}`;
}

/**
 * A quantity of tokens.
 *
 * Decimals scale to what a unit is WORTH, not to a fixed guess: four decimals
 * on a billion memecoins is four digits of noise, and zero decimals on a
 * fraction of a gold token hides the whole position. Given the mark, the rule
 * is simply "show enough that the hidden value stays under a cent".
 */
export function tokenQty(qty: number | null | undefined, priceUsd?: number | null): string {
  if (qty == null || !Number.isFinite(qty)) return DASH;
  if (qty === 0) return "0";

  let decimals = 4;
  if (priceUsd != null && Number.isFinite(priceUsd) && priceUsd > 0) {
    decimals = Math.ceil(Math.log10(priceUsd / 0.01));
  }
  decimals = Math.max(0, Math.min(6, decimals));

  const shown = qty.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
  // A quantity that rounds to nothing is still a holding, and reporting "0"
  // for something the book says is open is the one answer that is never right.
  if (Number(shown.replace(/,/g, "")) === 0) return "<0.001";
  return shown;
}

/* ------------------------------------------------------------------ time -- */

/**
 * How long ago, in the reader's language.
 *
 * There were SIX copies of this before the app was translated — in
 * `portfolio`, `agentDetail`, `agentDetailMobile`, `myAgents`, `agentThread`
 * and `equity` — and they had already drifted: half rendered "5m ago" and half
 * "5 min ago" for the same instant on two screens a click apart. Translating
 * six copies would have meant six sets of keys and the same drift in a second
 * language, so they are one function. The short form won, because it is what
 * the denser surfaces used and what the mobile designs are measured for.
 *
 * Takes `t` for the same reason lib/narrate does: this is called from render
 * bodies and from plain helpers alike, and a hook would rule out the second.
 *
 * Deliberately NOT `Intl.RelativeTimeFormat`. It would spare the four keys, and
 * cost the thing they exist for: it renders "5 minutes ago" in a 90px column
 * measured for "5m ago", and no option makes it shorter — `numeric: "auto"`
 * changes "1 day ago" to "yesterday", which is longer still.
 */
export function relativeTime(iso: string | null | undefined, t: Translate): string {
  if (!iso) return DASH;
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return DASH;

  const mins = Math.round((Date.now() - at) / 60_000);
  // A clock skew of a few seconds must not render "−0m ago".
  if (mins < 1) return t("time_just_now");
  if (mins < 60) return t("time_minutes", { count: mins });
  if (mins < 1440) return t("time_hours", { count: Math.floor(mins / 60) });
  return t("time_days", { count: Math.floor(mins / 1440) });
}

/**
 * The same age, with the "ago" dropped.
 *
 * A timestamp gutter down the right of a feed does not need every row to say
 * "ago" — the column establishes that once, and the rows are narrow. Separate
 * from `relativeTime` rather than an option on it, because they are two
 * different registers and a boolean would hide that at every call site.
 */
export function compactAge(iso: string | null | undefined, t: Translate): string {
  if (!iso) return DASH;
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return DASH;

  const mins = Math.floor((Date.now() - at) / 60_000);
  if (mins < 1) return t("time_compact_now");
  if (mins < 60) return t("time_compact_minutes", { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("time_compact_hours", { count: hrs });
  return t("time_compact_days", { count: Math.floor(hrs / 24) });
}

/**
 * A short calendar date — "4 Mar 25" / "2025年3月4日".
 *
 * Takes the locale rather than the translator: a date's shape is a regional
 * convention Intl already knows, and writing month names into the dictionary
 * would be re-implementing a table the browser ships.
 *
 * Explicitly locale-driven rather than `undefined` (the browser's own setting),
 * unlike the billing renewal date. That one is a fact about a contract and
 * belongs in the reader's regional format; these sit inside a dense table of
 * translated labels, and a run of English months down a Chinese column reads as
 * a rendering failure.
 */
export function shortDate(iso: string, locale: "en" | "zh"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}
