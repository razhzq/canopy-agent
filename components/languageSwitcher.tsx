"use client";

// Language picker for the top nav.
//
// IT WAS A TOGGLE, AND A TOGGLE WAS RIGHT FOR TWO LANGUAGES: a menu that exists
// to offer one alternative is a click of ceremony around a click of work. With
// three, the same button would have to mean "cycle to whichever is next", and a
// control whose result you have to remember is worse than a list you can read.
//
// So it is a small menu now, and the rule that made the toggle work survives
// into it: EVERY LABEL IS WRITTEN IN THE LANGUAGE IT SELECTS. A reader who
// cannot read the current UI can still find their own language in the list —
// which is the entire job of this control, and the reason none of these strings
// goes through `t()`.
//
// The choice is persisted by lib/i18n's LocaleProvider (localStorage + cookie).

import { useEffect, useRef, useState } from "react";
import { Languages, Check } from "lucide-react";
import { useLocale, type Locale } from "@/lib/i18n";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Each in its own language, and the short label the button wears. */
const LANGUAGES: { id: Locale; label: string; short: string }[] = [
  { id: "en", label: "English", short: "EN" },
  { id: "zh", label: "中文", short: "中文" },
  { id: "tr", label: "Türkçe", short: "TR" },
];

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.id === locale) ?? LANGUAGES[0];

  // Close on an outside click or Escape. Both, because a menu that traps the
  // page is worse than the ceremony it replaced.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        // Not translated, for the same reason the options are not.
        aria-label="Language / 语言 / Dil"
        // h-9 to match the bell, the account button and the nav links either
        // side of it — the top bar reads as one row and this must not break it.
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-ui text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text-primary ${FOCUS}`}
      >
        {/* Shown at every width, phones included: at 375px — the floor the tab
            bar is specced around — the signed-out bar still fits with room to
            spare, and a bare "TR" between two buttons reads as a stray word
            rather than something to press. The glyph is what makes it a
            control. */}
        <Languages className="size-[15px] shrink-0" aria-hidden />
        <span>{current.short}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[9rem] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-[0_20px_44px_-16px_rgba(0,0,0,0.9)]"
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setLocale(l.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left font-ui text-[13px] transition-colors hover:bg-surface-2 ${
                l.id === locale ? "text-text-primary" : "text-text-secondary"
              } ${FOCUS}`}
            >
              <span>{l.label}</span>
              {l.id === locale ? (
                <Check className="size-[14px] shrink-0 text-accent" aria-hidden />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
