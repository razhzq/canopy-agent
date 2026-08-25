"use client";

import { usePrivy } from "@privy-io/react-auth";
import { InfoIcon, WarnIcon } from "./ui";
import { useT } from "@/lib/i18n";

/**
 * The states a live screen can be in, minus loading.
 *
 * They are written in the same visual language as the rest of the product
 * rather than as generic spinners and red boxes, because a user meets these
 * states as often as the populated one — a new account sees the empty state
 * before it ever sees data.
 *
 * LOADING LIVES IN skeleton.tsx AND NOT HERE.
 *
 * There used to be a `LoadingState` beside these: a centred label over a
 * pulsing rule, in a bordered frame the size of nothing in particular. It has
 * been removed rather than left unused, because an idle export is an
 * invitation — the next screen would reach for it, and the page would go back
 * to collapsing to a small box and then jumping to full height when data
 * arrived. Use the skeleton that matches the surface instead.
 */

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center border border-grid px-8 py-16">
      <div className="max-w-[420px] space-y-4 text-center">{children}</div>
    </div>
  );
}

export function SignedOutState({ note }: { note?: string }) {
  const { login, ready } = usePrivy();
  const t = useT();
  return (
    <Frame>
      <p className="font-mono text-[13px] tracking-[0.06em] text-text-primary uppercase">
        {t("state_signed_out_title")}
      </p>
      <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
        {/* A caller-supplied note wins: it names the specific thing behind
            the wall, and it arrives already translated by whoever passed it. */}
        {note ?? t("state_signed_out_body")}
      </p>
      <button
        type="button"
        disabled={!ready}
        onClick={() => login()}
        className="mt-2 border border-accent px-5 py-2.5 font-mono text-[11px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent-wash disabled:opacity-40"
      >
        {t("state_sign_in")}
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
  const t = useT();
  return (
    <Frame>
      <WarnIcon className="mx-auto text-warning" />
      <p className="font-mono text-[13px] tracking-[0.06em] text-text-primary uppercase">
        {t("state_error_title")}
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
          {t("state_try_again")}
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
