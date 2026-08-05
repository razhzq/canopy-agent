"use client";

import { useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { composeAgent, type ComposedDraft } from "@/lib/api";

/**
 * The describe step: say what you want, and the builder arrives filled in.
 *
 * A FAST PATH, NOT A GATE. It sits between naming and the two-step builder and
 * can be walked straight past — every field it sets is one you could have set
 * yourself, and the next thing you see is those two steps with the values in
 * them, not a running agent. The review is the same review either way.
 *
 * That constraint is what makes this safe to offer. The model never returns a
 * configuration directly: it picks from the assets that survived universe
 * resolution and from the four rules the specialist actually measures, and the
 * server clamps everything to the ranges the sliders allow. Anything it asked
 * for that we refused comes back as a note and is shown, because a silently
 * narrowed draft is worse than no draft — you would believe it was followed.
 */

/**
 * Starting points, written against what the stack can genuinely honour: the
 * resolved RWA universe, the four measurable rules, and the exits.
 *
 * Deliberately phrased as intentions rather than settings. "Skip anything that
 * gapped" is a thing a trader says; "maxEventScore ≤ 30" is the translation,
 * and watching that translation happen is most of the value here.
 */
const PACKS: { label: string; prompt: string }[] = [
  {
    label: "Cautious gold",
    prompt:
      "Only tokenized gold. Be careful — deep liquidity only, and skip anything that has moved sharply in the last week.",
  },
  {
    label: "Quality blue chips",
    prompt:
      "US blue chips with strong net margins and deep liquidity. Calm names only, hold for a few weeks.",
  },
  {
    label: "Event-averse",
    prompt:
      "Anything liquid, but avoid names that have had abnormal activity recently. Take profit steadily and cut losses early.",
  },
  {
    label: "More active",
    prompt:
      "I want more activity. Tolerate volatility, look at the whole universe, take profit quickly and keep a tight stop.",
  },
];

export function DescribeAgent({
  name,
  onDraft,
  onSkip,
}: {
  name: string;
  onDraft: (draft: ComposedDraft, notes: string[]) => void;
  onSkip: () => void;
}) {
  const { getAccessToken, authenticated, ready, login } = usePrivy();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  async function submit(text?: string) {
    const value = (text ?? prompt).trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in to use this.");
      const { draft, notes } = await composeAgent(token, value);
      if (!draft) {
        // The model answered badly — distinct from it being unreachable, which
        // arrives as a thrown ApiError below with the real reason.
        setError(notes[0] ?? "That could not be turned into a configuration.");
        return;
      }
      onDraft(draft, notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function usePack(p: (typeof PACKS)[number]) {
    setPrompt(p.prompt);
    box.current?.focus();
  }

  return (
    <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-[720px]">
        <div className="space-y-2.5 text-center">
          <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
            {name} · Draft
          </p>
          <h1 className="font-mono text-[30px] leading-none text-text-primary">
            What should it trade?
          </h1>
          <p className="mx-auto max-w-[52ch] font-ui text-[13.5px] leading-relaxed text-text-secondary">
            Describe it in a sentence and the next two steps arrive filled in. Nothing runs
            until you have looked at them.
          </p>
        </div>

        {/* The input is the page. Everything else is support. */}
        <div
          className={`mt-8 border transition-colors ${
            busy ? "border-accent" : "border-grid-strong focus-within:border-accent"
          }`}
        >
          <textarea
            ref={box}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              // Enter submits; newlines need a modifier. A one-sentence brief
              // rarely wants a line break, and reaching for a button does.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            disabled={busy}
            rows={3}
            maxLength={2000}
            autoFocus
            aria-label="Describe your agent"
            placeholder="e.g. only tokenized gold, deep liquidity, and skip anything that gapped this week"
            className="w-full resize-none bg-transparent px-5 py-4 font-ui text-[15px] leading-relaxed text-text-primary outline-none placeholder:text-text-muted disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-4 border-t border-grid px-4 py-3">
            <span className="font-mono text-[10px] tracking-[0.08em] text-text-muted uppercase">
              {busy ? "Reading your description…" : "Enter to build · Shift+Enter for a new line"}
            </span>
            {ready && !authenticated ? (
              <button
                type="button"
                onClick={login}
                className="flex h-9 items-center border border-accent bg-accent-wash px-5 font-mono text-[10.5px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
              >
                Sign in
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || prompt.trim().length === 0}
                className="flex h-9 items-center border border-accent bg-accent-wash px-5 font-mono text-[10.5px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:border-grid disabled:bg-panel disabled:text-text-dim"
              >
                {busy ? "Building…" : "Build it"}
              </button>
            )}
          </div>
        </div>

        {error ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-3">
            <p className="max-w-[62ch] font-ui text-[12.5px] leading-relaxed text-negative">
              {error}
            </p>
            {/* Always a way forward. The manual builder does not depend on the
                model, so a model problem must never be a dead end. */}
            <button
              type="button"
              onClick={onSkip}
              className="shrink-0 font-mono text-[10.5px] tracking-[0.1em] text-accent uppercase transition-colors hover:text-text-primary"
            >
              Set it up myself →
            </button>
          </div>
        ) : null}

        {/* Packs are examples of how to ask, not presets — picking one fills the
            box so you can see and edit the sentence before it is read. */}
        <div className="pt-7">
          <p className="pb-3 text-center font-mono text-[10px] tracking-[0.12em] text-text-muted uppercase">
            Or start from one of these
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {PACKS.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={busy}
                onClick={() => usePack(p)}
                title={p.prompt}
                className="h-9 shrink-0 rounded-full border border-border px-4 font-mono text-[11.5px] text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-center pt-9">
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="font-mono text-[11px] tracking-[0.1em] text-text-dim uppercase transition-colors hover:text-text-primary disabled:opacity-50"
          >
            Set it up myself →
          </button>
        </div>
      </div>
    </main>
  );
}
