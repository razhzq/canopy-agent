"use client";

import { usePrivy } from "@privy-io/react-auth";
import { InfoIcon, WarnIcon } from "./ui";

/**
 * The four states a live screen can be in.
 *
 * They are written in the same visual language as the rest of the product
 * rather than as generic spinners and red boxes, because a user meets these
 * states as often as the populated one — a new account sees the empty state
 * before it ever sees data.
 */

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center border border-grid px-8 py-16">
      <div className="max-w-[420px] space-y-4 text-center">{children}</div>
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <Frame>
      <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
        {label}
      </p>
      {/* A determinate-looking bar would imply progress we cannot measure. */}
      <div className="mx-auto h-px w-24 animate-pulse bg-grid-strong" />
    </Frame>
  );
}

export function SignedOutState({ note }: { note?: string }) {
  const { login, ready } = usePrivy();
  return (
    <Frame>
      <p className="font-mono text-[13px] tracking-[0.06em] text-text-primary uppercase">
        Sign in to continue
      </p>
      <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
        {note ??
          "Your agents are tied to your Canopy account. Signing in here uses the same login as the exchange."}
      </p>
      <button
        type="button"
        disabled={!ready}
        onClick={() => login()}
        className="mt-2 border border-accent px-5 py-2.5 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent-wash disabled:opacity-40"
      >
        Sign in
      </button>
    </Frame>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Frame>
      <WarnIcon className="mx-auto text-warning" />
      <p className="font-mono text-[13px] tracking-[0.06em] text-text-primary uppercase">
        Could not load
      </p>
      {/* The real message, not a sanitised one — a user reporting a bug should
          be able to quote something specific. */}
      <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
        {message}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 border border-border px-5 py-2.5 font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase transition-colors hover:text-text-primary"
        >
          Try again
        </button>
      ) : null}
    </Frame>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; href: string };
}) {
  return (
    <Frame>
      <InfoIcon className="mx-auto text-text-dim" />
      <p className="font-mono text-[13px] tracking-[0.06em] text-text-primary uppercase">
        {title}
      </p>
      <p className="font-ui text-[13px] leading-relaxed text-text-secondary">{body}</p>
      {action ? (
        <a
          href={action.href}
          className="mt-2 inline-block border border-accent px-5 py-2.5 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent-wash"
        >
          {action.label}
        </a>
      ) : null}
    </Frame>
  );
}
