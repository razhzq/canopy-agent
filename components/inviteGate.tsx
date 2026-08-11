"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getInviteStatus, redeemInvite } from "@/lib/api";

/**
 * The invite gate.
 *
 * Signing in is not the same as being let in. Privy authenticates the human;
 * this asks canopy-be whether that human is on the list, and holds the product
 * behind a modal until they are. The check runs on every authenticated mount,
 * not only on the first ever login — "first time" is not a thing the client can
 * know, and a client that tried to would let anyone through by clearing
 * localStorage.
 *
 * THIS IS NOT THE ENFORCEMENT. Every /agents route on canopy-be must refuse an
 * uninvited caller on its own. What this component is for is the difference
 * between a locked door and a wall of 403s: the gate says what is missing and
 * gives the user somewhere to type it.
 *
 * Children are NOT rendered while the gate is closed. Blurring them behind the
 * modal would leave a dozen pages fetching routes that are about to 403, and
 * the resulting error boxes would show through the backdrop.
 */

type Phase =
  /** Privy has not resolved, or the check is in flight. */
  | { kind: "checking" }
  /** Signed out. Not the gate's problem — pages handle their own signed-out state. */
  | { kind: "open" }
  | { kind: "locked" }
  /** The check itself failed. A dead backend is not permission, so this blocks too. */
  | { kind: "unreachable"; message: string };

/**
 * Remembered for the tab, so route changes that remount the layout do not
 * re-ask. Deliberately module scope and not storage: a granted flag that
 * survives a reload would be a granted flag a user could write by hand, and
 * this must always be re-derived from the backend on a fresh load.
 */
let grantedThisSession = false;

export function InviteGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [phase, setPhase] = useState<Phase>(
    grantedThisSession ? { kind: "open" } : { kind: "checking" },
  );
  const [nonce, setNonce] = useState(0);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!ready) return;
    // Signed out is open: the gate has nobody to check. Pages already render
    // their own sign-in prompt, and stacking a second modal on top of Privy's
    // login modal would be two dialogs asking for two different things.
    if (!authenticated) {
      grantedThisSession = false;
      setPhase({ kind: "open" });
      return;
    }
    if (grantedThisSession) {
      setPhase({ kind: "open" });
      return;
    }

    let cancelled = false;
    setPhase({ kind: "checking" });

    void (async () => {
      try {
        const token = await getAccessToken();
        // No token on an authenticated session means it lapsed mid-check.
        // Treated as signed out rather than locked — the user is about to be
        // asked to sign in again, and a gate on top of that is noise.
        if (!token) {
          if (!cancelled) setPhase({ kind: "open" });
          return;
        }
        const status = await getInviteStatus(token);
        if (cancelled) return;
        if (!status.required || status.granted) {
          grantedThisSession = true;
          setPhase({ kind: "open" });
        } else {
          setPhase({ kind: "locked" });
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setPhase({ kind: "open" });
          return;
        }
        setPhase({
          kind: "unreachable",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, nonce]);

  const onRedeemed = useCallback(() => {
    grantedThisSession = true;
    setPhase({ kind: "open" });
  }, []);

  if (phase.kind === "open") return <>{children}</>;

  // Checking renders nothing rather than a spinner. The check is one request
  // against a warm token and normally resolves inside a frame; a flash of
  // "checking access…" on every cold load costs more than it explains.
  if (phase.kind === "checking") return null;

  return phase.kind === "unreachable" ? (
    <GateShell title="Cannot confirm access">
      <p className="font-ui text-[13.5px] leading-relaxed text-text-secondary">
        We could not reach Canopy to check your access. This is not a decision
        about your account — the check simply did not complete.
      </p>
      <p className="pt-3 font-mono text-[11px] tracking-[0.06em] text-negative">
        {phase.message}
      </p>
      <button
        type="button"
        onClick={retry}
        className="mt-6 h-11 w-full border border-accent bg-accent-wash font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
      >
        Try again
      </button>
    </GateShell>
  ) : (
    <InvitePrompt onRedeemed={onRedeemed} />
  );
}

/* ------------------------------------------------------------------ prompt -- */

function InvitePrompt({ onRedeemed }: { onRedeemed: () => void }) {
  const { getAccessToken, logout } = usePrivy();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const trimmed = code.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Your session expired. Sign in again.");
      const status = await redeemInvite(token, trimmed);
      // Trusting the echoed status rather than assuming a 200 means granted:
      // the backend is the authority on what the code did, and a code that
      // resolves to "still not granted" must keep the gate shut.
      if (!status.granted) {
        setError("That code did not unlock access.");
        setBusy(false);
        return;
      }
      onRedeemed();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <GateShell title="You need an invite code">
      <p className="font-ui text-[13.5px] leading-relaxed text-text-secondary">
        Canopy Agent is in closed access. Your account is signed in — it just is
        not on the list yet. Enter the code you were sent to open the stack.
      </p>

      <form onSubmit={submit} className="pt-6">
        <label
          htmlFor="invite-code"
          className="block pb-2 font-mono text-[9.5px] tracking-[0.14em] text-text-dim uppercase"
        >
          Invite code
        </label>
        <input
          ref={input}
          id="invite-code"
          value={code}
          // Uppercased on the way in so the field matches how codes are
          // written down. The backend still normalises — this is legibility,
          // not validation.
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CANOPY-XXXX-XXXX"
          spellCheck={false}
          autoComplete="one-time-code"
          aria-invalid={error !== null}
          aria-describedby={error ? "invite-error" : undefined}
          disabled={busy}
          className="h-12 w-full border border-grid-strong bg-transparent px-3.5 font-mono text-[14px] tracking-[0.08em] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent disabled:opacity-60"
        />

        {error ? (
          <p
            id="invite-error"
            role="alert"
            className="pt-3 font-mono text-[11px] tracking-[0.06em] text-negative"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!trimmed || busy}
          className="mt-5 h-12 w-full border border-accent bg-accent-wash font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
        >
          {busy ? "Checking…" : "Unlock access"}
        </button>
      </form>

      {/* The only way out. A gate with no exit strands anyone who signed in
          with the wrong account — which, sharing one Privy app with the DEX,
          is a real way to arrive here. */}
      <button
        type="button"
        onClick={() => void logout()}
        className="mt-4 h-11 w-full border border-border font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase transition-colors hover:border-grid-strong hover:text-text-primary"
      >
        Sign out
      </button>
    </GateShell>
  );
}

/* ------------------------------------------------------------------- shell -- */

/**
 * The blocking dialog. No backdrop click, no Escape: this is a gate, and a
 * dismissible gate is a decoration. Tab is wrapped inside the panel so the
 * keyboard cannot reach the page underneath.
 */
function GateShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-bg/90 px-4 py-10 backdrop-blur-sm">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-gate-title"
        className="w-full max-w-[440px] border border-grid-strong bg-panel px-8 py-8"
      >
        <p className="pb-2 font-mono text-[9.5px] tracking-[0.14em] text-accent uppercase">
          Closed access
        </p>
        <h2
          id="invite-gate-title"
          className="pb-5 font-mono text-[20px] leading-tight text-text-primary"
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
