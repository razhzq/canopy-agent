"use client";

import { useEffect } from "react";
import Link from "next/link";
import { WarnIcon } from "@/components/ui";
import { PRIMARY, QUIET } from "@/components/kit";
import { useT } from "@/lib/i18n";

/**
 * The error boundary over every signed-in page.
 *
 * WHAT IT REPLACES. Nothing caught a render error in this group, so any client
 * crash fell through to Next's own screen: a grey "This page couldn't load"
 * with two buttons, no message, no reference, and nothing written anywhere. A
 * stale build draft took the builder down that way and the only cure was
 * knowing to clear a localStorage key from the console — which is not a thing
 * to ask of anyone, and not a thing the screen said.
 *
 * So this one states what happened, carries the digest the reader can quote,
 * and offers the escape that actually fixes the class of crash we have seen:
 * clearing the drafts this browser is holding. `reset()` re-renders the segment
 * without a reload, which is enough when the cause was transient and useless
 * when it is on disk — hence both buttons.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  // The console is where a developer looks and where a user is asked to look.
  // Next logs the digest server-side; the message itself only exists here.
  useEffect(() => {
    console.error("[canopy] page crashed", error);
  }, [error]);

  /**
   * Drafts only, by prefix — never `localStorage.clear()`.
   *
   * Privy keeps the session in this same store. Wiping it would sign the reader
   * out on their way past an error screen, which is a second failure wearing
   * the first one's clothes.
   */
  function clearDrafts(): void {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("canopy_build_draft")) localStorage.removeItem(key);
      }
    } catch {
      /* blocked storage: the reload below is still worth attempting */
    }
    // A full load, not `reset()`: the bad state was read at mount, so the
    // component has to start again from nothing.
    window.location.reload();
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center gap-4 px-5 text-center">
      <WarnIcon className="text-warning" />

      <h1 className="font-mono text-[13px] tracking-[0.06em] text-text-primary uppercase">
        {t("crash_title")}
      </h1>
      <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
        {t("crash_body")}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={reset} className={PRIMARY}>
          {t("crash_retry")}
        </button>
        <Link href="/workspace" className={QUIET}>
          {t("crash_home")}
        </Link>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 border-t border-border pt-6">
        <button
          type="button"
          onClick={clearDrafts}
          className="font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase underline-offset-4 transition-colors hover:text-text-primary hover:underline"
        >
          {t("crash_reset")}
        </button>
        <p className="font-ui text-[12px] leading-relaxed text-text-muted">
          {t("crash_reset_note")}
        </p>
      </div>

      {/* Quotable in a bug report, and the only thread back to the server log. */}
      {error.digest ? (
        <p className="font-mono text-[11px] text-text-muted">
          {t("crash_ref", { digest: error.digest })}
        </p>
      ) : null}
    </main>
  );
}
