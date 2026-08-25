"use client";

// EN / 中文 toggle for the top nav.
//
// A toggle rather than a dropdown: there are two languages, and a menu that
// exists to offer one alternative is a click of ceremony around a click of
// work. The button shows the language you would SWITCH TO, which is the
// convention every bilingual site on this side of the Pacific uses — showing
// the current one reads as a status light and gets ignored.
//
// The choice is persisted by lib/i18n's LocaleProvider (localStorage + cookie).

import { Languages } from "lucide-react";
import { useLocale } from "@/lib/i18n";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const next = locale === "en" ? "zh" : "en";
  // Deliberately NOT run through t(): each label is written in the language it
  // switches to, so a reader who cannot read the current UI can still find it.
  const label = locale === "en" ? "中文" : "EN";
  const title = locale === "en" ? "切换到中文" : "Switch to English";

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      title={title}
      aria-label={title}
      // h-9 to match the bell, the account button and the nav links either
      // side of it — the top bar reads as one row and this must not break it.
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-ui text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text-primary ${FOCUS} ${className}`}
    >
      {/* Shown at every width, phones included. It was briefly hidden below sm
          to buy 21px, and that was the wrong trade twice over: it did not save
          enough to matter (signed out at 320px the bar overflows with or
          without it), and a bare "中文" between a plus button and a Sign in
          button reads as a stray word rather than something to press. The
          glyph is what makes it look like a control.

          At the design's own floor — 375px, which the tab bar is specced
          around — the signed-out bar comes to ~312px inside a 343px box, so
          this fits with room to spare. */}
      <Languages className="size-[15px] shrink-0" aria-hidden />
      <span>{label}</span>
    </button>
  );
}
