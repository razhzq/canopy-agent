// The server half of the dictionary — for the two things a client hook cannot
// reach: `generateMetadata`, and any string rendered before hydration.
//
// The locale is read from the cookie `LocaleProvider` writes. localStorage is
// the primary store and the cookie mirrors it, so this can disagree with the
// client for exactly one render: a visitor whose FIRST visit sniffed `zh` from
// `navigator.language` has no cookie yet, and their tab title is English until
// they touch the switcher. That is the whole cost, and it buys not shipping
// two dictionaries to the browser to translate a <title>.
//
// Calling `getServerT()` opts the route into dynamic rendering, because
// `cookies()` does. Every page that uses it is a client-fetched shell whose
// HTML is a header and a skeleton, so there is no static payload being given
// up — do not reach for this from a page that is genuinely static.

import { cookies } from "next/headers";
import { en, type TranslationKey } from "./en";
import { zh } from "./zh";
import { tr } from "./tr";
import type { Locale } from "./index";
import { fill } from "./translate";
import { getTenant } from "../tenant/server";

const COOKIE_KEY = "canopy_locale";

export async function getServerLocale(): Promise<Locale> {
  const value = (await cookies()).get(COOKIE_KEY)?.value;
  if (value === "zh" || value === "tr") return value;
  return "en";
}

export type ServerT = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

export async function getServerT(): Promise<ServerT> {
  const locale = await getServerLocale();
  // Same fallback chain as the client's `t`: an in-progress locale shows
  // English for what it has not reached, never a raw key.
  const dict: Partial<Record<TranslationKey, string>> =
    locale === "zh" ? zh : locale === "tr" ? tr : en;
  // The tenant's name for `{brand}`; null (no tenant at this host) and a
  // failed lookup both fall back to the platform's.
  const brand = (await getTenant().catch(() => null))?.name ?? "Canopy";
  return (key, vars) => fill(dict[key] ?? en[key] ?? key, vars, brand);
}
