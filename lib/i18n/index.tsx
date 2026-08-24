"use client";

// Tiny in-house i18n, ported from canopy-rps-portal's lib/i18n.
//
// Why not next-intl / react-intl? — this app needs one thing those libraries
// bury under a message compiler and a build step: look up a key, substitute
// {vars}. No plural categories, no ICU select, no per-locale date or currency
// formats that Intl.NumberFormat does not already do for us in lib/format.
// A ~100-line provider carries it, and the dictionaries stay greppable.
//
// The locale lives in three places, each for a different reader:
//   1. localStorage — survives refreshes and new tabs.
//   2. cookie       — readable server-side if we ever move this to SSR.
//   3. <html lang>  — screen readers, and the `:lang(zh)` font stack in
//                     globals.css that swaps in a CJK face.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { en, type TranslationKey } from "./en";
import { zh } from "./zh";

export type Locale = "en" | "zh";
export type { TranslationKey };
export type { Translate } from "./translate";

const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = { en, zh };
const STORAGE_KEY = "canopy_agent_locale";
// Shared with canopy-fe / the RPS portal: same name, same values, so a user
// who picked 中文 on one Canopy surface lands in 中文 here too — as long as
// the cookie domain covers both. Harmless when it does not.
const COOKIE_KEY = "canopy_locale";

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<LocaleCtx | null>(null);

function htmlLang(l: Locale): string {
  return l === "zh" ? "zh-CN" : "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Always start English. The persisted choice is resolved in an effect, so
  // the server HTML and the first client paint agree — the alternative reads
  // localStorage during render and hydration-mismatches every string on the
  // page at once.
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "zh" || stored === "en") {
        setLocaleState(stored);
        document.documentElement.lang = htmlLang(stored);
        return;
      }
    } catch {
      /* localStorage can throw in private mode / embedded webviews */
    }
    // First visit — take the browser's word for it.
    const browser = navigator.language?.toLowerCase() ?? "";
    if (browser.startsWith("zh")) {
      setLocaleState("zh");
      document.documentElement.lang = "zh-CN";
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    document.cookie = `${COOKIE_KEY}=${l}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = htmlLang(l);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      const dict = DICTIONARIES[locale];
      // Fall back through English rather than rendering a raw key: a missing
      // Chinese string should read as English, not as `portfolio_empty_title`.
      const raw = dict[key] ?? en[key] ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
        vars[name] != null ? String(vars[name]) : `{${name}}`,
      );
    },
    [locale],
  );

  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Rendered outside the provider — a test, or a component mounted into a
    // portal that escaped the tree. Degrade to English rather than throwing.
    return {
      locale: "en",
      setLocale: () => undefined,
      t: (key, vars) => {
        const raw = en[key] ?? key;
        if (!vars) return raw;
        return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
          vars[name] != null ? String(vars[name]) : `{${name}}`,
        );
      },
    };
  }
  return ctx;
}

export function useT(): LocaleCtx["t"] {
  return useLocale().t;
}
