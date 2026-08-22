"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

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
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-bg/80 p-4 backdrop-blur-sm"
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
        className="my-auto w-full max-w-[420px] border border-grid-strong bg-panel shadow-[0_24px_64px_-20px_rgba(0,0,0,0.9)] outline-none"
      >
        <div className="flex items-center justify-between border-b border-grid px-5 py-4">
          <h2 className="font-mono text-[12px] tracking-[0.1em] text-text-primary uppercase">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="font-mono text-[16px] leading-none text-text-dim transition-colors hover:text-text-primary"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

