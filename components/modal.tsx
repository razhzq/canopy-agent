"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";

/**
 * The dialog frame every modal sits in.
 *
 * Escape and a backdrop click close it, focus moves in on open and back to
 * whatever opened it on close, and the panel is `role="dialog" aria-modal` so a
 * screen reader treats the page behind it as inert. None of that is optional on
 * a surface that moves money — a dialog you cannot leave by keyboard is one
 * people click through to escape.
 *
 * Shared rather than copied: the portal below is subtle enough that a second
 * hand-written copy would get it wrong, and did.
 *
 * PORTALLED TO THE BODY, AND IT HAS TO BE.
 *
 * The trigger lives in the navbar, and that <header> carries `backdrop-blur-md`.
 * A `backdrop-filter` makes an element a containing block for fixed-position
 * descendants — so `fixed inset-0` resolved against a 64px-tall header instead
 * of the viewport, and the dialog rendered centred on that strip with its title
 * and close button clipped off the top of the screen. Rendering into the body
 * escapes it. The same is true of `transform` and `filter` on any ancestor,
 * which is why this must not be "fixed" by nudging offsets.
 */
export function Modal({
  title,
  onClose,
  children,
  variant = "dialog",
  headless = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * `sheet` rises from the bottom edge and fills the height it needs.
   *
   * A centred dialog is wrong for anything with a text input on a phone: the
   * keyboard takes the lower half of the screen and shoves a centred box off
   * the top. A sheet is already anchored to the bottom, so the composer stays
   * where the thumb is and the content above it simply gets shorter.
   *
   * `wide` is the same centred dialog with room for a two-column control row.
   *
   * The 420px panel is right for a confirmation and wrong for anything with a
   * label, a slider and a figure on one line — at that width the three wrap
   * onto three rows and a list of eight rules becomes a page. It caps its own
   * height and scrolls its body rather than the backdrop, so the header and
   * the footer's actions stay put while the rules move under them.
   */
  variant?: "dialog" | "sheet" | "wide";
  /** Suppresses the title bar for content that brings its own. */
  headless?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  // `title` arrives already translated from the caller — only the close
  // button's own name is this component's to say.
  const t = useT();

  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll under an open dialog.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      returnTo.current?.focus();
    };
  }, [onClose]);

  // Nothing to portal into during the server render.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex bg-bg/80 backdrop-blur-sm ${
        variant === "sheet"
          ? "items-end justify-center sm:items-center sm:p-4"
          : "items-center justify-center overflow-y-auto p-4"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        // `my-auto` with a scrollable backdrop keeps it centred on a tall
        // screen and scrollable on a short one, rather than centring it off the
        // top edge where the header is unreachable.
        className={
          variant === "wide"
            ? // Its own height cap, because the body scrolls rather than the
              // backdrop — a dialog whose actions scroll off the bottom of a
              // laptop screen is one people cannot finish.
              "my-auto flex max-h-[calc(100dvh-64px)] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_36px_90px_-28px_rgba(0,0,0,0.9)] outline-none"
            : variant === "sheet"
            ? // `dvh`, not `vh`: on iOS Safari `vh` counts the URL bar's height
              // whether or not it is showing, so a 90vh sheet is taller than the
              // screen and its composer sits under the browser chrome.
              "flex h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-[0_-16px_48px_-16px_rgba(0,0,0,0.9)] outline-none sm:h-[80dvh] sm:max-w-[520px] sm:rounded-2xl"
            : // Rounded, matching the deposit dialog and the rest of the wallet
              // surfaces. The square panel was the last place in this flow with
              // hard corners, and two dialogs opened from adjacent buttons
              // reading as different products is exactly the kind of seam a
              // shared shell exists to prevent.
              "my-auto w-full max-w-[440px] rounded-2xl border border-border bg-surface shadow-[0_36px_90px_-28px_rgba(0,0,0,0.9)] outline-none"
        }
      >
        {headless ? null : (
          <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-2">
            <h2 className="font-ui text-[20px] font-medium leading-none tracking-[-0.01em] text-text-primary">
              {title}
            </h2>
            {/* A mark in a hit target, not a bare glyph. 16px of text is a hard
                thing to aim at, and this is the control every dialog needs to
                offer and none of them are opened for. */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common_close")}
              className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-text-dim transition-colors hover:border-grid-strong hover:text-text-primary"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-[15px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
                focusable="false"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
