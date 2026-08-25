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
import type { Locale } from "./index";

const COOKIE_KEY = "canopy_locale";

export async function getServerLocale(): Promise<Locale> {
  const value = (await cookies()).get(COOKIE_KEY)?.value;
  return value === "zh" ? "zh" : "en";
}

export type ServerT = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

export async function getServerT(): Promise<ServerT> {
  const locale = await getServerLocale();
  const dict = locale === "zh" ? zh : en;
  return (key, vars) => {
    const raw = dict[key] ?? en[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
      vars[name] != null ? String(vars[name]) : `{${name}}`,
    );
  };
}
