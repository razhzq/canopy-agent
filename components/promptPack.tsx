"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Search, X } from "lucide-react";
import { FOCUS, ICON_BUTTON } from "@/components/kit";
import { Modal } from "@/components/modal";
import { useIsMobile } from "@/lib/useIsMobile";
import { useT } from "@/lib/i18n";
import {
  categoryBodyKey,
  categoryTitleKey,
  packFor,
  promptSentenceKey,
  promptTitleKey,
  type PackCategory,
  type PackKind,
  type PackPrompt,
} from "@/lib/promptPack";

/**
 * The prompt pack's handle: a pill at the far left of the compose footer.
 *
 * In the footer rather than above the box because it stays useful after the
 * first turn — risk add-ons append a clause to a strategy already being
 * discussed — and the footer is the one part of the chat that never scrolls
 * away.
 */
export function PromptPackPill({
  kind,
  open,
  onToggle,
}: {
  kind: PackKind;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const count = useMemo(() => packFor(kind).reduce((n, c) => n + c.prompts.length, 0), [kind]);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-haspopup="dialog"
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border pl-2.5 pr-3 font-ui text-[12px] font-medium transition-colors ${FOCUS} ${
        open
          ? "border-transparent bg-white text-bg"
          : "border-border text-text-secondary hover:border-grid-strong hover:text-text-primary"
      }`}
    >
      <BookOpen size={13} strokeWidth={2} aria-hidden />
      {t("pp_open")}
      <span className={`tnum font-mono text-[10.5px] ${open ? "text-bg/60" : "text-text-muted"}`}>{count}</span>
    </button>
  );
}

/**
 * The prompt pack itself: categories on the left, the chosen category's
 * prompts on the right, a search across all of them.
 *
 * A modal over a blurred page: choosing a starting strategy is its own small
 * task, and the budget and guardrails under the chat are noise while doing it.
 * The shared Modal owns Escape, the backdrop click and returning focus to the
 * pill. On a phone it is the bottom sheet, because the search field brings up
 * the keyboard and a centred dialog would be pushed off the top.
 *
 * Picking a prompt hands its sentence back and closes; it never sends —
 * Compile stays the author's act, same as the chips it replaced.
 */
export function PromptPackPanel({
  kind,
  gridAllowed,
  onPick,
  onClose,
}: {
  kind: PackKind;
  /** A grid runs on exactly one spot token; otherwise its prompts are dimmed. */
  gridAllowed: boolean;
  /** `append` is true for add-on clauses, which join the sentence rather than replace it. */
  onPick: (sentence: string, append: boolean) => void;
  /** Must be stable: the Modal re-arms its listeners and focus whenever it changes. */
  onClose: () => void;
}) {
  const t = useT();
  const cats = useMemo(() => packFor(kind), [kind]);
  const [catId, setCatId] = useState(cats[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const isMobile = useIsMobile();
  const search = useRef<HTMLInputElement | null>(null);

  // A kind change (the market was swapped for a perp) resets the selection.
  const cat = cats.find((c) => c.id === catId) ?? cats[0];

  // After the Modal's own effect, which focuses the dialog itself: a parent's
  // effects run after its children's, so a plain focus here would be undone.
  useEffect(() => {
    const id = requestAnimationFrame(() => search.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, []);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return null;
    const hits: { cat: PackCategory; prompt: PackPrompt }[] = [];
    for (const c of cats) {
      const catText = t(categoryTitleKey(c)).toLowerCase();
      for (const p of c.prompts) {
        const text = `${t(promptTitleKey(p))} ${t(promptSentenceKey(p))} ${p.knobs} ${catText}`.toLowerCase();
        if (text.includes(q)) hits.push({ cat: c, prompt: p });
      }
    }
    return hits;
  }, [q, cats, t]);

  const total = cats.reduce((n, c) => n + c.prompts.length, 0);

  const row = (c: PackCategory, p: PackPrompt, showCat: boolean) => {
    const locked = !!c.grid && !gridAllowed;
    return (
      <li key={p.id}>
        <button
          type="button"
          disabled={locked}
          onClick={() => onPick(t(promptSentenceKey(p)), !!c.append)}
          className={`group w-full rounded-lg px-3 py-2.5 text-left transition-colors enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
        >
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate font-ui text-[13px] font-medium text-text-primary">
              {t(promptTitleKey(p))}
              {showCat ? <span className="font-normal text-text-muted"> · {t(categoryTitleKey(c))}</span> : null}
            </span>
            {c.append ? (
              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-secondary">
                {t("pp_append")}
              </span>
            ) : (
              <span className="shrink-0 font-mono text-[10px] text-text-muted opacity-0 transition-opacity group-enabled:group-hover:opacity-100 group-focus-visible:opacity-100">
                ↵ {t("pp_fill")}
              </span>
            )}
          </span>
          <span className="mt-1 block font-ui text-[12px] leading-relaxed text-text-dim">{t(promptSentenceKey(p))}</span>
          <span className="mt-1 block font-mono text-[10.5px] text-accent">{p.knobs}</span>
        </button>
      </li>
    );
  };

  return (
    <Modal title={t("pp_open")} onClose={onClose} variant={isMobile ? "sheet" : "wide"} headless>
    <div className="flex h-full min-h-0 flex-col sm:h-[min(600px,calc(100dvh-64px))]">
      {/* ---------------------------------------------------------- head -- */}
      <div className="flex items-center justify-between gap-3 border-b border-grid px-4 py-3">
        <div className="hidden min-w-0 sm:block">
          <p className="font-ui text-[13.5px] font-medium text-text-primary">{t("pp_open")}</p>
          <p className="truncate font-ui text-[12px] text-text-muted">{t("pp_sub")}</p>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:flex-none">
          <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2/40 px-2.5 focus-within:border-grid-strong sm:w-[230px] sm:flex-none">
            <Search size={13} className="shrink-0 text-text-muted" aria-hidden />
            <input
              ref={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("pp_search")}
              aria-label={t("pp_search_aria")}
              className="w-full min-w-0 bg-transparent font-ui text-[12.5px] pointer-coarse:text-[16px] text-text-primary outline-none placeholder:text-text-muted"
            />
          </label>
          <button type="button" onClick={onClose} aria-label={t("pp_close")} className={ICON_BUTTON}>
            <X size={15} aria-hidden />
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------- body -- */}
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {results ? null : (
          <nav
            aria-label={t("pp_categories_aria")}
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-grid p-2 sm:w-[210px] sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r"
          >
            {cats.map((c) => {
              const on = c.id === cat?.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-current={on ? "true" : undefined}
                  onClick={() => setCatId(c.id)}
                  className={`flex shrink-0 items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left font-ui text-[12.5px] transition-colors ${FOCUS} ${
                    on ? "bg-surface-2 font-medium text-text-primary" : "text-text-secondary hover:text-text-primary"
                  } ${c.append ? "sm:mt-2" : ""}`}
                >
                  <span className="whitespace-nowrap">{t(categoryTitleKey(c))}</span>
                  <span className={`tnum font-mono text-[10.5px] ${on ? "text-accent" : "text-text-muted"}`}>
                    {c.append ? `+${c.prompts.length}` : c.prompts.length}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {results ? (
            results.length === 0 ? (
              <p className="px-3 py-6 font-ui text-[12.5px] text-text-muted">{t("pp_none", { q: query.trim() })}</p>
            ) : (
              <>
                <p className="px-3 pb-1 pt-1 font-ui text-[11.5px] text-text-muted">
                  {t("pp_results", { count: results.length })}
                </p>
                <ul>{results.map(({ cat: c, prompt: p }) => row(c, p, true))}</ul>
              </>
            )
          ) : cat ? (
            <>
              <div className="px-3 pb-2 pt-1">
                <p className="font-ui text-[13px] font-medium text-text-primary">{t(categoryTitleKey(cat))}</p>
                <p className="mt-0.5 font-ui text-[12px] leading-relaxed text-text-muted">{t(categoryBodyKey(cat))}</p>
                {cat.grid && !gridAllowed ? (
                  <p className="mt-1 font-ui text-[12px] text-text-secondary">{t("pp_grid_needs_one")}</p>
                ) : null}
              </div>
              <ul>{cat.prompts.map((p) => row(cat, p, false))}</ul>
            </>
          ) : null}
        </div>
      </div>

      {/* ---------------------------------------------------------- foot -- */}
      <div className="flex items-center justify-between gap-4 border-t border-grid px-4 py-2.5">
        <p className="font-ui text-[11.5px] leading-snug text-text-muted">
          {kind === "perp" ? `${t("pp_foot_perp")} ` : ""}
          {t("pp_foot")}
        </p>
        <span className="hidden shrink-0 font-mono text-[10.5px] text-text-muted sm:inline">
          {t(kind === "perp" ? "pp_scope_perp" : "pp_scope_spot", { count: total })}
        </span>
      </div>
    </div>
    </Modal>
  );
}
