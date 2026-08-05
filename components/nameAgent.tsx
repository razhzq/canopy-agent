"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The naming step, asked before the builder opens.
 *
 * Rendered by the builder itself rather than by each button that links to it.
 * There are three entry points today and direct navigation besides — gating the
 * destination covers all of them, and cannot drift when a fourth is added.
 *
 * The name is asked for first because it is the one field that outlives the
 * draft: it travels with the published record and with every deployment of it.
 * As an inline input in the header it read as an afterthought, which is exactly
 * how `rwa_value_v1` ends up on a listing.
 */

/** Backend truncates at 120; refusing here beats silently shortening. */
const MAX = 120;

export function NameAgentModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const trimmed = value.trim();
  const tooLong = trimmed.length > MAX;
  const valid = trimmed.length > 0 && !tooLong;

  useEffect(() => {
    input.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      // Keep focus inside the dialog. Without this, tabbing walks into the page
      // behind it, which for a screen reader means the modal is a suggestion.
      if (e.key !== "Tab" || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    // The page behind must not scroll while this is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    onConfirm(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 px-6 backdrop-blur-sm"
      // Clicking the backdrop cancels; clicks inside the panel must not.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-agent-title"
        className="w-full max-w-[520px] animate-[log-enter_180ms_ease-out] border border-grid-strong bg-bg shadow-[0_30px_80px_-24px_rgba(0,0,0,0.8)]"
      >
        <form onSubmit={submit}>
          <div className="space-y-2 border-b border-grid px-7 pt-7 pb-6">
            <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
              New agent
            </p>
            <h2
              id="name-agent-title"
              className="font-mono text-[22px] leading-none text-text-primary"
            >
              Name your agent
            </h2>
            <p className="max-w-[46ch] font-ui text-[13px] leading-relaxed text-text-secondary">
              This travels with the record. Anyone comparing your strategy sees it, so make it
              something you would put your name next to.
            </p>
          </div>

          <div className="px-7 py-6">
            <input
              ref={input}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="e.g. steady gold accumulation"
              spellCheck={false}
              maxLength={MAX + 20}
              aria-label="Agent name"
              aria-invalid={touched && !valid}
              className={`h-12 w-full border-b bg-transparent font-mono text-[16px] text-text-primary outline-none transition-colors placeholder:text-text-muted ${
                touched && !valid ? "border-negative" : "border-grid-strong focus:border-accent"
              }`}
            />
            <div className="flex items-baseline justify-between gap-4 pt-2.5">
              <p className="font-ui text-[12px] text-text-dim">
                {touched && trimmed.length === 0
                  ? "Give it a name to continue."
                  : tooLong
                    ? `${trimmed.length} characters — the limit is ${MAX}.`
                    : "You can rename it any time before publishing."}
              </p>
              {trimmed.length > MAX - 30 ? (
                <span
                  className={`tnum shrink-0 font-mono text-[10px] ${
                    tooLong ? "text-negative" : "text-text-muted"
                  }`}
                >
                  {trimmed.length}/{MAX}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-grid px-7 py-5">
            <button
              type="button"
              onClick={onCancel}
              className="font-mono text-[11px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid}
              className="flex h-11 items-center justify-center border border-accent bg-accent-wash px-7 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
