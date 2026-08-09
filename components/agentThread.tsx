"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonThread } from "@/components/skeleton";
import {
  ackMessage,
  applyProposal,
  getMessages,
  sendMessageStreaming,
  type AgentMessage,
  type TurnStage,
  type AgentRow,
  type ProposedChange,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";

/**
 * The agent's thread: one conversation spanning its whole life.
 *
 * Three kinds of turn, and the distinction is the point:
 *
 *   message   prose, from either side
 *   event     the agent reporting something it did, written by the tick from
 *             recorded fact — never by a model
 *   proposal  something waiting on a decision
 *
 * A quiet cycle posts nothing. An agent that reports "screened 8, bought
 * nothing" every hour buries the one message that matters under ninety that do
 * not; the Cycles tab already holds every tick in full.
 *
 * Questions are answered from the agent's own decision rows: retrieval decides
 * which rows are relevant, the model only phrases them, and its cycle citations
 * are checked against what was actually retrieved before they are shown. When
 * the record holds nothing, it says so rather than reasoning — an agent that
 * guesses about its own behaviour is worse than one that admits the limit.
 */
export function AgentThread({
  agentId,
  agent,
}: {
  agentId: number;
  agent: AgentRow | null;
}) {
  const [nonce, setNonce] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Which pipeline stage the turn is at, or null when nothing is in flight. */
  const [stage, setStage] = useState<TurnStage | null>(null);
  /** The user's message, shown before the server has echoed it back. */
  const [echo, setEcho] = useState<string | null>(null);
  /** Id of the reply currently being typed out. */
  const [typing, setTyping] = useState<string | null>(null);
  /** The answer as it arrives, token by token. Null when nothing is streaming. */
  const [live, setLive] = useState<string | null>(null);
  const { getAccessToken } = usePrivy();
  const router = useRouter();
  const foot = useRef<HTMLDivElement>(null);

  const state = useApi((t) => getMessages(t, agentId), [agentId, nonce]);
  const messages = state.phase === "ready" ? state.data.messages : [];

  // Stick to the newest turn, the way a conversation behaves. `live` is in the
  // deps because a streaming answer grows the page without adding a message —
  // without it the text would type itself out below the fold.
  useEffect(() => {
    foot.current?.scrollIntoView({ block: "end" });
  }, [messages.length, live]);

  // Poll while something is pending: an approval that expires unseen is the
  // failure this whole surface exists to prevent.
  const pending = messages.some((m) => m.requires_action && !m.acted_at);
  useEffect(() => {
    const id = setInterval(() => setNonce((n) => n + 1), pending ? 15_000 : 60_000);
    return () => clearInterval(id);
  }, [pending]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    setStage("reading");
    // Shown immediately, in its final position. Waiting for the round trip to
    // echo it back is what made sending feel like nothing had happened — the
    // box emptied and the thread sat unchanged for several seconds.
    setEcho(body);
    setDraft("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in again.");
      let streamed = false;
      const fresh = await sendMessageStreaming(token, agentId, body, setStage, (text) => {
        streamed = true;
        setLive((prev) => (prev ?? "") + text);
      });
      // A question streams its answer, so by now the user has read most of it —
      // replaying it as an animation would make them watch it a second time.
      // A proposal has no prose to stream (it is a structured diff), so that
      // one still gets the typed reveal.
      const reply = fresh.find((m) => m.role === "agent");
      if (reply && !streamed) setTyping(reply.id);
      setNonce((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      // The message was accepted server-side before anything could fail here,
      // so a refetch is what shows the user their own words back rather than
      // losing them.
      setNonce((n) => n + 1);
    } finally {
      setSending(false);
      setStage(null);
      setEcho(null);
      setLive(null);
    }
  }

  async function ack(id: string) {
    try {
      const token = await getAccessToken();
      if (!token) return;
      await ackMessage(token, agentId, id);
      setNonce((n) => n + 1);
    } catch {
      /* the count is a convenience; failing to clear it is not worth a dialog */
    }
  }

  if (state.phase === "loading") return <SkeletonThread />;
  if (state.phase === "signed-out") return <SignedOutState />;
  if (state.phase === "error")
    return <ErrorState message={state.message} onRetry={state.reload} />;

  return (
    <div className="mx-auto flex h-[calc(100vh-152px)] max-w-[820px] flex-col px-8">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-7 [&::-webkit-scrollbar-thumb]:bg-grid-strong [&::-webkit-scrollbar]:w-1.5">
        <Opening agent={agent} />
        {messages.map((m) => (
          <Turn
            key={m.id}
            message={m}
            onAck={() => void ack(m.id)}
            onApplied={(newAgentId) => router.push(`/workspace/${newAgentId}?tab=chat`)}
            agentId={agentId}
            typing={typing === m.id}
            onTyped={() => setTyping(null)}
          />
        ))}

        {/* The user's own words, before the server has echoed them. Suppressed
            once the refetch lands so the message does not appear twice. */}
        {echo && !messages.some((m) => m.role === "user" && m.body === echo) ? (
          <div className="flex justify-end">
            <div className="max-w-[76%] border border-grid bg-panel px-5 py-3 opacity-60">
              <p className="font-ui text-[13.5px] leading-relaxed whitespace-pre-wrap text-text-primary">
                {echo}
              </p>
            </div>
          </div>
        ) : null}

        {/* The answer as it is written. Replaced by the persisted message once
            the turn completes — same text, so the swap is invisible. */}
        {live ? (
          <Row role="agent">
            <p className="font-ui text-[13.5px] leading-relaxed whitespace-pre-wrap text-text-secondary">
              {live}
              <span className="ml-0.5 inline-block h-[13px] w-[7px] translate-y-[2px] animate-pulse bg-accent motion-reduce:animate-none" />
            </p>
          </Row>
        ) : null}

        {/* Stages stop once prose starts: the answer arriving IS the progress. */}
        {stage && !live ? <Thinking stage={stage} /> : null}
        <div ref={foot} />
      </div>

      <div
        className={`mb-6 border transition-colors ${
          sending ? "border-accent" : "border-grid-strong focus-within:border-accent"
        }`}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          disabled={sending}
          rows={2}
          maxLength={2000}
          aria-label="Message this agent"
          placeholder="Ask it something, or tell it what to change…"
          className="w-full resize-none bg-transparent px-5 py-3.5 font-ui text-[14px] leading-relaxed text-text-primary outline-none placeholder:text-text-muted disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-4 border-t border-grid px-4 py-2.5">
          <span className="font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
            {error ? (
              <span className="text-negative">{error}</span>
            ) : (
              "Enter to send · Shift+Enter for a new line"
            )}
          </span>
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || draft.trim().length === 0}
            className="flex h-8 items-center border border-accent bg-accent-wash px-5 font-mono text-[10px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ in flight -- */

/**
 * What the agent is doing, while it does it.
 *
 * The stages are REAL — they arrive from the server as the pipeline crosses
 * them, because one message costs two to five sequential model calls and the
 * wait is long enough that silence reads as breakage. A timed animation would
 * have looked identical on a good day and lied on a bad one, saying "drafting"
 * about a request that had already failed.
 *
 * Each stage is also a genuinely different thing to wait for, which is why
 * they are worth naming rather than showing one spinner: "checking your
 * record" and "drafting changes" set different expectations about what is
 * about to appear.
 */
const STAGE_LABEL: Record<TurnStage, string> = {
  reading: "Reading your message",
  drafting: "Drafting the changes",
  searching: "Checking its record",
};

function Thinking({ stage }: { stage: TurnStage }) {
  // The stages are strictly ordered, so earlier ones are shown as settled
  // rather than replaced. Watching items tick off is the difference between
  // "it is working" and "it is still working".
  const order: TurnStage[] = ["reading", stage === "searching" ? "searching" : "drafting"];
  const reached = order.indexOf(stage);

  return (
    <Row role="agent">
      <ul className="space-y-1.5" role="status" aria-live="polite">
        {order.map((s, i) => {
          const done = i < reached;
          const now = i === reached;
          if (!done && !now) return null;
          return (
            <li key={s} className="flex items-center gap-2.5">
              <span
                className={`size-1.5 rounded-full ${
                  done ? "bg-accent" : "animate-pulse bg-text-dim motion-reduce:animate-none"
                }`}
              />
              <span
                className={`font-mono text-[11px] tracking-[0.06em] ${
                  done ? "text-text-dim" : "text-text-secondary"
                }`}
              >
                {STAGE_LABEL[s]}
                {now ? "…" : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </Row>
  );
}

/**
 * Reveals text a few characters at a time.
 *
 * Presentation, and labelled as such: the reply is already complete by the
 * time this runs. The backend answers questions as one structured call whose
 * citations are verified against the record BEFORE anything is shown, so
 * streaming the raw tokens would mean displaying claims that had not been
 * checked yet. Typing out the verified answer keeps that guarantee and still
 * avoids a wall of text landing at once, which after a long wait reads as a
 * page reload rather than an answer.
 *
 * Chunked rather than one character per frame: a 400-character answer would
 * otherwise take seven seconds to read out, which is slower than reading it.
 */
function Typed({ text, onDone }: { text: string; onDone?: () => void }) {
  const [shown, setShown] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    setShown(0);
    // Anyone who prefers reduced motion gets the whole thing immediately —
    // this is decoration, and decoration should never withhold content.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(text.length);
      done.current?.();
      return;
    }

    const step = Math.max(2, Math.ceil(text.length / 90));
    const id = setInterval(() => {
      setShown((n) => {
        const next = n + step;
        if (next >= text.length) {
          clearInterval(id);
          done.current?.();
          return text.length;
        }
        return next;
      });
    }, 16);
    return () => clearInterval(id);
  }, [text]);

  return <>{text.slice(0, shown)}</>;
}

/* -------------------------------------------------------------------- turns -- */

/** The standing brief. Always first, so an empty thread is not a blank page. */
function Opening({ agent }: { agent: AgentRow | null }) {
  if (!agent) return null;
  return (
    <Row role="agent">
      <p className="font-ui text-[13.5px] leading-relaxed text-text-secondary">
        I run{" "}
        <span className="font-mono text-[12.5px] text-text-primary">
          {agent.strategy_class}
        </span>{" "}
        on{" "}
        <span className="font-mono text-[12.5px] text-text-primary">
          ${Number(agent.capital_usd).toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>{" "}
        of {agent.is_paper ? "paper" : "live"} capital.{" "}
        {agent.autonomy === "propose_only"
          ? "I ask before every trade."
          : "I trade within your caps, and close on your exit rules without asking."}{" "}
        I will tell you here when something happens.
      </p>
    </Row>
  );
}

function Turn({
  message: m,
  onAck,
  onApplied,
  agentId,
  typing = false,
  onTyped,
}: {
  message: AgentMessage;
  onAck: () => void;
  onApplied: (newAgentId: number) => void;
  agentId: number;
  /** Reveal this reply a character at a time rather than all at once. */
  typing?: boolean;
  onTyped?: () => void;
}) {
  const open = m.requires_action && !m.acted_at;
  const changes = proposedChanges(m);

  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[76%] border border-grid bg-panel px-5 py-3">
          <p className="font-ui text-[13.5px] leading-relaxed whitespace-pre-wrap text-text-primary">
            {m.body}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Row role="agent" tone={open ? "accent" : undefined}>
      <p className="font-ui text-[13.5px] leading-relaxed whitespace-pre-wrap text-text-secondary">
        {typing ? <Typed text={m.body} onDone={onTyped} /> : m.body}
      </p>

      {/* The diff. Rendered as before → after so what is actually changing is
          legible without reading prose, and nothing is applied by reading it. */}
      {changes.length > 0 ? (
        <div className="mt-3 border border-grid">
          {changes.map((c) => (
            <div
              key={c.field}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-b border-grid px-4 py-2.5 last:border-b-0"
            >
              <span className="truncate font-mono text-[11.5px] text-text-primary">{c.label}</span>
              <span className="flex shrink-0 items-baseline gap-2 font-mono text-[11.5px]">
                <span className="text-text-dim line-through">{c.from}</span>
                <span className="text-text-muted">→</span>
                <span className="text-accent">{c.to}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {open && changes.length > 0 ? (
        <ApplyBar agentId={agentId} messageId={m.id} onApplied={onApplied} onDismiss={onAck} />
      ) : null}

      {/* "Looked at", not "source". The cycles are what retrieval put in front
          of the narrator — which is not the same claim as "these prove it", and
          matters most when the honest answer was "that is not in my record". */}
      {cycles(m).length > 0 ? (
        <p className="pt-2 font-mono text-[10px] tracking-[0.06em] text-text-muted uppercase">
          Read {cycles(m).length === 1 ? "cycle" : "cycles"}{" "}
          {compact(cycles(m))}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 pt-2.5">
        <span className="font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
          {when(m.created_at)}
          {m.acted_at ? " · settled" : ""}
        </span>
        <span className="flex items-center gap-4">
          {/* The claim links to its evidence: every event names the cycle that
              produced it, and that cycle's full transcript is one click away. */}
          {m.run_id ? (
            <Link
              href={`/workspace/${agentId}?tab=cycles`}
              className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:text-accent"
            >
              See the cycle →
            </Link>
          ) : null}
          {open && changes.length === 0 ? (
            <button
              type="button"
              onClick={onAck}
              className="font-mono text-[10px] tracking-[0.1em] text-accent uppercase transition-colors hover:text-text-primary"
            >
              Mark handled
            </button>
          ) : null}
        </span>
      </div>
    </Row>
  );
}

function Row({
  children,
  tone,
}: {
  role: "agent";
  children: React.ReactNode;
  tone?: "accent";
}) {
  return (
    <div className="flex gap-3.5">
      <span
        className={`mt-1 block size-6 shrink-0 rounded-full border ${
          tone === "accent" ? "border-accent bg-accent-wash" : "border-grid bg-panel"
        }`}
      />
      <div
        className={`min-w-0 flex-1 border px-5 py-3.5 ${
          tone === "accent" ? "border-accent bg-accent-wash" : "border-grid"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Applying forks the strategy, so this says so before you press it. A change
 * agreed in conversation is as append-only as one made through the form —
 * the old record stays, and a new one starts.
 */
function ApplyBar({
  agentId,
  messageId,
  onApplied,
  onDismiss,
}: {
  agentId: number;
  messageId: string;
  onApplied: (newAgentId: number) => void;
  onDismiss: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in again.");
      const { newAgentId } = await applyProposal(token, agentId, messageId);
      onApplied(newAgentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-3">
      {error ? (
        <p className="pb-2 font-ui text-[12px] leading-relaxed text-negative">{error}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void apply()}
          disabled={busy}
          className="flex h-9 items-center border border-accent bg-accent-wash px-5 font-mono text-[10.5px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
        >
          {busy ? "Applying…" : "Apply"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          className="font-mono text-[10.5px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:text-text-primary disabled:opacity-50"
        >
          Leave it
        </button>
        <span className="font-ui text-[11.5px] text-text-muted">
          Applying starts a fresh record — the current one stays on your profile.
        </span>
      </div>
    </div>
  );
}

/** The diff carried on a proposal message. */
function proposedChanges(m: AgentMessage): ProposedChange[] {
  const raw = (m.payload as { changes?: unknown })?.changes;
  return Array.isArray(raw) ? (raw as ProposedChange[]) : [];
}

/** Cycles the answer was drawn from, as recorded on the message. */
function cycles(m: AgentMessage): number[] {
  const raw = (m.payload as { citedCycles?: unknown })?.citedCycles;
  return Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : [];
}

/** "18–23" rather than six separate numbers. */
function compact(ns: number[]): string {
  const sorted = [...new Set(ns)].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return `#${sorted[0]}`;
  const consecutive = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
  return consecutive
    ? `#${sorted[0]}–${sorted[sorted.length - 1]}`
    : sorted.map((n) => `#${n}`).join(", ");
}

function when(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
