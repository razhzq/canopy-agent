"use client";

import Link from "next/link";
import { Check, CornerDownLeft, Loader2, X } from "lucide-react";
import { StickToBottom, type StickToBottomContext } from "use-stick-to-bottom";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonThread } from "@/components/skeleton";
import { relativeTime } from "@/lib/format";
import { useT, type Translate, type TranslationKey } from "@/lib/i18n";
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
  const t = useT();
  const router = useRouter();
  const box = useRef<HTMLTextAreaElement>(null);

  const state = useApi((t) => getMessages(t, agentId), [agentId, nonce]);

  // THE LAST GOOD THREAD, KEPT ACROSS REFETCHES.
  //
  // This is what stopped the page "refreshing itself" mid-conversation. The
  // poll below bumps `nonce` every 60 seconds; `useApi` answers a dep change by
  // resetting to `loading`; and the loading branch renders a skeleton. So once
  // a minute the entire conversation was replaced by grey bars and then put
  // back — indistinguishable from a page reload, and it landed in the middle of
  // reading a reply.
  //
  // Holding the previous messages means a refetch is invisible: the thread
  // stays on screen and is simply replaced by the newer copy when it lands.
  // Written during render on purpose — it is a cache of a value already in
  // hand, so an effect would only make it arrive one frame late.
  const seen = useRef<AgentMessage[]>([]);
  if (state.phase === "ready") seen.current = state.data.messages;
  const messages = state.phase === "ready" ? state.data.messages : seen.current;

  /**
   * The stick-to-bottom controller, for the one caller outside the scroll area.
   *
   * Following the newest turn used to be hand-rolled here: a `pinned` ref set
   * false on any upward scroll, an `adrift` flag to offer the way back, and an
   * effect re-pinning on every dependency that might have grown the thread.
   * That last part is what the library replaces properly — it watches the
   * CONTENT with a ResizeObserver rather than guessing at which state changes
   * imply new height, which is the case the old deps list kept missing (an
   * answer typing itself out grows the box without changing any of them).
   *
   * A ref rather than the hook because `send` lives out here, outside the
   * provider. Reading `isAtBottom` for the pill still goes through the render
   * prop below — that one has to paint.
   */
  const stick = useRef<StickToBottomContext>(null);

  // The composer grows to fit what is in it. Reset to `auto` first — without
  // that, scrollHeight only ever reports the current height and the box can
  // grow but never shrink again after a deletion.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [draft]);

  // Everything that grows the thread, not just the message count.
  //
  // The deps used to be [messages.length, live], which covered a reply landing
  // and a reply streaming — and missed the case that matters most: the moment
  // you press send. Your own message appears as `echo` and the status line as
  // `stage`, neither of which changes the message count, so the thread grew
  // under the fold and you had to scroll to find your own question.

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
    // Sending is an explicit request to be at the bottom. Someone who scrolled
    // up to re-read something and then asked a question wants to watch the
    // answer, not to stay where they were reading.
    stick.current?.scrollToBottom();
    // Shown immediately, in its final position. Waiting for the round trip to
    // echo it back is what made sending feel like nothing had happened — the
    // box emptied and the thread sat unchanged for several seconds.
    setEcho(body);
    setDraft("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("th_sign_in"));
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

  async function ack(id: string, approved?: boolean) {
    try {
      const token = await getAccessToken();
      if (!token) return;
      await ackMessage(token, agentId, id, approved);
      setNonce((n) => n + 1);
    } catch {
      /* the count is a convenience; failing to clear it is not worth a dialog */
    }
  }

  // The skeleton is for the FIRST load only. Every later fetch is a background
  // refresh of a thread already on screen.
  if (state.phase === "loading" && seen.current.length === 0) return <SkeletonThread />;
  if (state.phase === "signed-out") return <SignedOutState />;
  // A failed poll must not destroy the conversation either. With nothing to
  // fall back on this is still the right screen; with a thread in hand, the
  // honest thing is to keep showing it — the messages did not stop existing
  // because one request timed out.
  if (state.phase === "error" && seen.current.length === 0)
    return <ErrorState message={state.message} onRetry={state.reload} />;

  return (
    <div className="mx-auto flex h-[calc(100vh-152px)] max-w-[820px] flex-col px-8">
      {/* shadcn's Conversation: the library owns the scroll box and keeps it
          pinned as content grows, so nothing here listens for scroll events.
          `instant` on both, not their `smooth` — the note this replaced was
          right that an eased scroll never catches up with text being typed in
          above it, and the spring would be racing the `Typed` animation. */}
      <StickToBottom
        contextRef={stick}
        initial="instant"
        resize="instant"
        className="relative min-h-0 flex-1 overflow-y-hidden [&::-webkit-scrollbar-thumb]:bg-grid-strong [&::-webkit-scrollbar]:w-1.5"
      >
        {({ isAtBottom, scrollToBottom }) => (
          <>
            <StickToBottom.Content className="flex flex-col gap-8 py-7">
        <Opening agent={agent} />
        {messages.map((m, i) => (
          <Turn
            key={m.id}
            // ONLY THE NEWEST TURN ANIMATES. Applying the entrance to every
            // message would replay the whole conversation on each poll — the
            // thread would twitch once a minute, which is the exact mistake
            // log-enter's comment in globals.css warns about.
            fresh={i === messages.length - 1}
            message={m}
            onAck={(approved) => void ack(m.id, approved)}
            // Stays put: the agent that just changed is the one on screen.
            // This used to navigate to the fork's replacement agent.
            onApplied={() => setNonce((n) => n + 1)}
            agentId={agentId}
            typing={typing === m.id}
            onTyped={() => setTyping(null)}
          />
        ))}

        {/* The user's own words, before the server has echoed them. Suppressed
            once the refetch lands so the message does not appear twice. */}
        {echo && !messages.some((m) => m.role === "user" && m.body === echo) ? (
          <div className="flex w-full max-w-[95%] justify-end self-end">
            {/* Identical to a settled message except for the text colour, and
                it has to STAY identical — these two render the same words a
                few hundred milliseconds apart, so any difference between them
                is a flinch the eye catches on every send. It used to be 60%
                opacity for that reason.
                The shape below is therefore a copy of the settled bubble, not
                a variation on it: same rounded-lg, same px-4 py-3, same 95%.
                It drifted once already when the settled one moved. */}
            <div className="w-fit max-w-full min-w-0 overflow-hidden rounded-lg bg-surface-2 px-4 py-3">
              <p className="font-ui text-[14px] leading-[1.65] whitespace-pre-wrap text-text-secondary">
                {echo}
              </p>
            </div>
          </div>
        ) : null}

        {/* The answer as it is written. Replaced by the persisted message once
            the turn completes — same text, so the swap is invisible. */}
        {live ? (
          <Row role="agent">
            <p className="font-ui text-[14px] leading-[1.7] whitespace-pre-wrap text-text-primary">
              {live}
              <span className="ml-0.5 inline-block h-[13px] w-[7px] translate-y-[2px] animate-pulse bg-accent motion-reduce:animate-none" />
            </p>
          </Row>
        ) : null}

        {/* Stages stop once prose starts: the answer arriving IS the progress. */}
            {stage && !live ? <Thinking stage={stage} /> : null}
            </StickToBottom.Content>

      {/* The way back. Only while away from the bottom, and only when there is
          something to go back TO — offering it on an already-complete thread
          would be a button that does nothing visible. */}
      {!isAtBottom && messages.length > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4">
          <button
            type="button"
            onClick={() => void scrollToBottom()}
            style={{ animation: "pill-enter 180ms ease-out" }}
            className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-grid-strong bg-surface-2/95 py-2 pr-4 pl-3 font-mono text-[10px] tracking-[0.08em] text-text-secondary uppercase shadow-lg backdrop-blur transition-colors hover:border-accent hover:text-accent"
          >
            <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
              <path
                d="M8 3v10m0 0 4-4m-4 4-4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t(live || stage ? "th_answering" : "th_latest")}
          </button>
        </div>
      ) : null}
          </>
        )}
      </StickToBottom>

      <div
        className={`mb-6 rounded-xl border bg-panel/60 transition-colors duration-150 ${
          sending
            ? "border-accent"
            : "border-grid-strong focus-within:border-accent focus-within:bg-panel"
        }`}
      >
        <textarea
          ref={box}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          disabled={sending}
          rows={1}
          maxLength={2000}
          aria-label={t("th_message_aria")}
          placeholder={t("th_placeholder")}
          // GROWS WITH WHAT IS BEING WRITTEN, up to a point. It was a fixed two
          // rows, so a three-line instruction — which is what "change the stop
          // to 8% and stop trading equities" becomes — was composed through a
          // slot showing two-thirds of itself. The cap keeps a long paste from
          // eating the conversation above it.
          // min-h-16 / max-h-48 are shadcn's PromptInputTextarea sizes. The
          // floor is the visible change: this rested at a single row, so the
          // composer read as a search field rather than somewhere to write a
          // paragraph to your agent.
          className="max-h-48 min-h-16 w-full resize-none bg-transparent px-5 pt-4 pb-2 font-ui text-[14px] leading-[1.6] text-text-primary outline-none placeholder:text-text-muted disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-4 px-4 pb-3">
          <span className="font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
            {error ? (
              <span className="text-negative">{error}</span>
            ) : draft.length > 1800 ? (
              // Only near the ceiling. A counter shown from the first keystroke
              // is a limit announcing itself to people who will never reach it.
              <span className={draft.length >= 2000 ? "text-negative" : "text-warning"}>
                {t("th_chars_left", { count: 2000 - draft.length })}
              </span>
            ) : (
              t("th_enter_hint")
            )}
          </span>
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || draft.trim().length === 0}
            aria-label={t("th_send_aria")}
            className="flex size-9 items-center justify-center rounded-lg bg-accent text-bg transition-all duration-150 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-dim"
          >
            {sending ? (
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
            ) : (
              // shadcn's PromptInputSubmit glyph. Not the word "Send": the hint
              // beside it already says Enter sends, and a second instruction in
              // the same 40 pixels is noise. Their return-key arrow says the
              // same thing as the old up-arrow while naming the actual key.
              //
              // Their third state — a Square that stops a stream — is left out
              // on purpose: nothing here can abort an answer in flight, and a
              // stop button that does not stop is worse than none.
              <CornerDownLeft className="size-4" aria-hidden />
            )}
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
const STAGE_LABEL: Record<TurnStage, TranslationKey> = {
  reading: "th_stage_reading",
  drafting: "th_stage_drafting",
  searching: "th_stage_searching",
};

function Thinking({ stage }: { stage: TurnStage }) {
  const t = useT();
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
                {t(STAGE_LABEL[s])}
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
      <p className="font-ui text-[13.5px] leading-[1.7] text-text-secondary">
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
  fresh = false,
}: {
  message: AgentMessage;
  onAck: (approved?: boolean) => void;
  onApplied: () => void;
  agentId: number;
  /** Reveal this reply a character at a time rather than all at once. */
  typing?: boolean;
  onTyped?: () => void;
  /** The newest turn, and the only one that animates in. */
  fresh?: boolean;
}) {
  const t = useT();
  const open = m.requires_action && !m.acted_at;
  const changes = proposedChanges(m);

  const enter = fresh ? { animation: "turn-enter 220ms ease-out" } : undefined;

  if (m.role === "user") {
    return (
      <div className="group flex w-full max-w-[95%] justify-end self-end" style={enter}>
        {/* Filled rather than outlined: an outlined box on a dark ground reads
            as an input waiting to be filled; a filled one reads as something
            already said.
            shadcn's MessageContent shape — `w-fit`, uniform `rounded-lg`,
            `px-4 py-3`. The tail (`rounded-br-sm`) goes with it: their bubble
            has none, and once the gap between turns is 32px the tail is doing
            work nothing needs done. Width now comes from the wrapper at 95%
            rather than 78%, so a long question wraps later. */}
        <div className="w-fit max-w-full min-w-0 overflow-hidden rounded-lg bg-surface-2 px-4 py-3">
          <p className="font-ui text-[14px] leading-[1.65] whitespace-pre-wrap text-text-primary">
            {m.body}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Row role="agent" style={enter}>
      {/* The answer is the content of this page, so it is set at reading
          contrast and reading measure — not at the secondary grey used for
          labels around it. This was the single cheapest legibility win here. */}
      <p className="font-ui text-[14px] leading-[1.7] whitespace-pre-wrap text-text-primary">
        {typing ? <Typed text={m.body} onDone={onTyped} /> : m.body}
      </p>

      {/* The proposal, as one block: what changes, and the decision about it.
          shadcn's Confirmation is a single Alert holding the request and its
          actions, and that is the improvement worth taking — this was a
          bordered diff table with a separate row of buttons floating beneath
          it, which read as two things when it is one. An outstanding decision
          is now visibly a container waiting on you, and it keeps its border
          after settling so the record of what was proposed stays whole.

          The diff itself stays as before → after. Nothing is applied by
          reading it, and prose cannot say "8% became 5%" as quickly. */}
      {changes.length > 0 ? (
        <div
          // rounded-lg and overflow-hidden together: the radius is shadcn's
          // Alert, and the clip is what makes it read as one object — the row
          // rules run edge to edge, so without it they would cut across the
          // corners and the softening would be undone by the first divider.
          //
          // The open state lifts rather than shouting: a thinner accent border,
          // a wash at a quarter strength, and a shadow. It was a hard 45%
          // border on a square box, which is most of what made this feel like a
          // table dropped into a conversation.
          className={`mt-3 overflow-hidden rounded-lg border transition-colors duration-200 ${
            open
              ? "border-accent/30 bg-accent-wash/20 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.8)]"
              : "border-grid"
          }`}
        >
          {changes.map((c) => (
            <div
              key={c.field}
              // Dividers at 55%: full-strength rules between every row is what
              // gives a small table its grid, and there are rarely more than
              // three of these. py-3 for the same reason — the rhythm was tight
              // enough to read as data rather than as a proposal.
              className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-b border-grid/55 px-4 py-3 last:border-b-0"
            >
              <span className="truncate font-mono text-[11.5px] text-text-primary">{c.label}</span>
              <span className="flex shrink-0 items-baseline gap-2 font-mono text-[11.5px]">
                <span className="text-text-dim line-through">{c.from}</span>
                <span className="text-text-muted">→</span>
                <span className="text-accent">{c.to}</span>
              </span>
            </div>
          ))}

          {open ? (
            <ApplyBar
              agentId={agentId}
              messageId={m.id}
              onApplied={onApplied}
              // A refusal, and recorded as one.
              onDismiss={() => onAck(false)}
            />
          ) : (
            /* shadcn's ConfirmationAccepted / ConfirmationRejected, off the
               `approved` column. Three states, not two: null is a real answer —
               a message settled without anyone choosing, and every message
               older than the column. Saying "Applied" there would be a guess
               printed as a fact on a screen about changing a trading agent. */
            <p
              // Tinted, so the outcome reads as the foot of the block rather
              // than one more row of the table above it.
              className={`flex items-center gap-2 border-t border-grid/55 bg-surface/30 px-4 py-3 font-mono text-[10px] tracking-[0.1em] uppercase ${
                m.approved === true
                  ? "text-accent"
                  : m.approved === false
                    ? "text-text-dim"
                    : "text-text-muted"
              }`}
            >
              {m.approved === true ? (
                <Check className="size-3" aria-hidden />
              ) : m.approved === false ? (
                <X className="size-3" aria-hidden />
              ) : null}
              {t(
                m.approved === true
                  ? "th_applied"
                  : m.approved === false
                    ? "th_declined"
                    : "th_settled",
              )}
            </p>
          )}
        </div>
      ) : null}

      {/* "Looked at", not "source". The cycles are what retrieval put in front
          of the narrator — which is not the same claim as "these prove it", and
          matters most when the honest answer was "that is not in my record". */}
      {cycles(m).length > 0 ? (
        <p className="pt-2 font-mono text-[10px] tracking-[0.06em] text-text-muted uppercase">
          {t(cycles(m).length === 1 ? "th_read_cycle" : "th_read_cycles", {
            cycles: compact(cycles(m)),
          })}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 pt-2.5">
        <span className="font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
          {relativeTime(m.created_at, t)}
          {m.acted_at ? t("th_settled_suffix") : ""}
        </span>
        <span className="flex items-center gap-4">
          {/* The claim links to its evidence: every event names the cycle that
              produced it, and that cycle's full transcript is one click away. */}
          {m.run_id ? (
            <Link
              href={`/workspace/${agentId}?tab=cycles`}
              className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:text-accent"
            >
              {t("th_see_cycle")}
            </Link>
          ) : null}
          {open && changes.length === 0 ? (
            <button
              type="button"
              // Acknowledged, NOT declined — there was no diff to refuse. Sends
              // no verdict, so the record stays neutral.
              onClick={() => onAck()}
              className="font-mono text-[10px] tracking-[0.1em] text-accent uppercase transition-colors hover:text-text-primary"
            >
              {t("th_mark_handled")}
            </button>
          ) : null}
        </span>
      </div>
    </Row>
  );
}

/**
 * One thing the agent said.
 *
 * OPEN PROSE, NOT A BUBBLE — and that is the biggest change to this page.
 *
 * Every agent turn used to be a bordered box with an empty circle beside it.
 * The circle was a placeholder that read as a missing avatar, and the box gave
 * the agent's words the same visual weight as the owner's — so a four-sentence
 * analysis and a three-word question looked like peers. Worse, boxing long
 * prose puts a hard edge a few words from the end of every line, which is
 * exactly where the eye wants to run on.
 *
 * So the agent speaks in the open, full width, like a document; the owner's
 * messages stay contained and right-aligned. That asymmetry is what makes a
 * transcript scannable — you can find your own questions without reading.
 *
 * A turn waiting on a decision is not marked at the row level either — the
 * proposal card inside it already carries the accent, and a rail around the
 * whole turn only doubled that signal.
 */
function Row({
  children,
  style,
}: {
  role: "agent";
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style} className="min-w-0 py-1.5">
      {children}
    </div>
  );
}

/**
 * Applying edits THIS agent, in place.
 *
 * It used to fork — new strategy, new agent, this one superseded and stopped —
 * and the bar said so, because that was a large enough consequence to warn
 * about before a click. It is no longer true: the agent keeps its id, its
 * positions and this thread, so there is nothing to warn about and the note is
 * a plain statement of when the change takes effect.
 */
function ApplyBar({
  agentId,
  messageId,
  onApplied,
  onDismiss,
}: {
  agentId: number;
  messageId: string;
  onApplied: () => void;
  onDismiss: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("th_sign_in"));
      await applyProposal(token, agentId, messageId);
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    // Same footer treatment as the settled line — a softened rule and a tint,
    // so the decision sits at the foot of the block instead of reading as a
    // final table row with buttons in it.
    <div className="border-t border-grid/55 bg-surface/30 px-4 py-3">
      {error ? (
        <p className="pb-2 font-ui text-[12px] leading-relaxed text-negative">{error}</p>
      ) : null}
      {/* shadcn's ConfirmationActions: `justify-end`, the decision at the end
          of what it is a decision about. The note keeps its place at the start
          of the row rather than being dropped — "takes effect from the next
          cycle" is the answer to the question someone asks with the cursor
          already over Apply. */}
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        <span className="mr-auto font-ui text-[11.5px] text-text-muted">
          {t("th_takes_effect")}
        </span>
        {/* Decline first, confirm last — the order shadcn's ConfirmationActions
            renders and the one every dialog on the platform has taught, so the
            rightmost button is the one the hand is already moving toward.
            h-8 is theirs too; h-9 beside a 12px diff row was a button from a
            different screen. */}
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          className="flex h-8 items-center rounded-md px-2.5 font-mono text-[10.5px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:bg-surface-2 hover:text-text-primary disabled:opacity-50"
        >
          {t("th_leave_it")}
        </button>
        <button
          type="button"
          onClick={() => void apply()}
          disabled={busy}
          // rounded-md, matching the container it now sits inside. A square
          // button in a rounded box is the corner that gives the whole thing
          // away.
          className="flex h-8 items-center rounded-md border border-accent bg-accent-wash px-3.5 font-mono text-[10.5px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
        >
          {t(busy ? "th_applying" : "th_apply")}
        </button>
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

// `when` moved to lib/format as `relativeTime`.
