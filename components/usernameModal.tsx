"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { Modal } from "@/components/modal";
import { FOCUS, PRIMARY, QUIET, SURFACE } from "@/components/kit";
import { checkUsername } from "@/lib/api";
import { useUsername } from "@/lib/useUsername";
import { useT } from "@/lib/i18n";

/**
 * Claiming a username.
 *
 * THE RULES ARE THE SERVER'S. The shape check below mirrors canopy-fe's input
 * mask so the two products refuse the same characters at the same moment, but
 * "is it long enough" and "is it taken" are answered by /check-username, and
 * its `reason` is rendered verbatim. A second copy of the length rule here
 * would be a rule that can drift out of step with the one actually enforced.
 *
 * The check is advisory even when it passes: someone can take the name between
 * the lookup and the save, which is what the 409 on PATCH is for.
 */

const noop = () => undefined;

/** canopy-fe's mask, character for character. */
const ALLOWED = /^[a-zA-Z0-9_]*$/;
const MAX = 20;

type Check =
  | { at: "idle" }
  | { at: "checking" }
  | { at: "free" }
  | { at: "taken"; reason: string };

export function UsernameModal({
  onClose,
  required = false,
}: {
  /** Absent when `required`: the only way out is a claimed name. */
  onClose?: () => void;
  /**
   * Opened for a new account rather than from the menu. Cannot be dismissed
   * — no Later, no X, no backdrop, no Escape — and carries the welcome.
   */
  required?: boolean;
}) {
  const { getAccessToken } = usePrivy();
  const t = useT();
  const { save } = useUsername();
  const [name, setName] = useState("");
  const [check, setCheck] = useState<Check>({ at: "idle" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced, and every response is discarded if the field moved on. Without
  // that, a slow lookup for "da" lands after a fast one for "dave" and marks
  // the wrong name taken.
  useEffect(() => {
    setError(null);
    if (name.length < 3) {
      setCheck({ at: "idle" });
      return;
    }
    setCheck({ at: "checking" });
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        const res = await checkUsername(token, name);
        if (cancelled) return;
        setCheck(
          res.available
            ? { at: "free" }
            // The server's own `reason` when it gave one — it is more
            // specific than anything this side could say, and it arrives in
            // English. Ours is the fallback.
            : { at: "taken", reason: res.reason ?? t("username_taken") },
        );
      } catch {
        // A failed lookup is not a refusal — leave the button live and let the
        // save be the thing that decides.
        if (!cancelled) setCheck({ at: "idle" });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, getAccessToken, t]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await save(name);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  const ready = name.length >= 3 && check.at !== "taken" && !saving;

  return (
    <Modal
      title={t(required ? "username_welcome_title" : "username_title")}
      // A required dialog swallows every dismissal the shell offers.
      onClose={required ? noop : (onClose ?? noop)}
      headless={required}
    >
      <div className="space-y-6 px-5 py-6">
        {required ? (
          <p className="font-ui text-[15px] font-medium text-text-primary">
            {t("username_welcome_title")}
          </p>
        ) : null}
        <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
          {t(required ? "username_welcome_body" : "username_body")}
        </p>

        {/* The one bordered object in the dialog is the input (rule 3), in
            the same surface, ring and radius as the amount field on the
            deposit dialog — a name is typed the way a figure is. */}
        <div className="space-y-2">
          <div
            className={`flex items-center ${SURFACE} px-3.5 transition-[border-color,box-shadow] focus-within:border-accent/40 focus-within:shadow-[0_0_0_6px_rgba(94,211,179,0.10)]`}
          >
            <span className="font-mono text-[15px] text-text-dim">@</span>
            <input
              value={name}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              onChange={(e) =>
                // Masked on the way in rather than validated on the way out:
                // silently dropping a space is kinder than an error about one.
                setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, MAX))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && ready) void submit();
              }}
              placeholder={t("username_placeholder")}
              className="w-full bg-transparent px-2 py-3 font-mono text-[15px] pointer-coarse:text-[16px] text-text-primary outline-none placeholder:text-text-dim"
            />
            <span className="tnum font-mono text-[11px] text-text-dim">
              {name.length}/{MAX}
            </span>
          </div>

          <p className="min-h-[16px] font-ui text-[11.5px] leading-relaxed">
            {error ? (
              <span className="text-negative">{error}</span>
            ) : check.at === "taken" ? (
              <span className="text-negative">{check.reason}</span>
            ) : check.at === "free" ? (
              <span className="text-accent">{t("username_available", { name })}</span>
            ) : check.at === "checking" ? (
              <span className="text-text-dim">{t("username_checking")}</span>
            ) : name.length > 0 && name.length < 3 ? (
              <span className="text-text-dim">{t("username_min_length")}</span>
            ) : (
              <span className="text-text-dim">{t("username_charset")}</span>
            )}
          </p>
        </div>

        {/* Weighted by consequence (rule 5): claiming is the filled pill,
            "Later" is quiet text beside it, never an equal half of a split
            row. Said once, under them: a username is unique across Canopy. */}
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-4">
            {required ? null : (
              <button type="button" onClick={onClose} disabled={saving} className={`${QUIET} ${FOCUS}`}>
                {t("username_later")}
              </button>
            )}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!ready}
              className={`${PRIMARY} ${FOCUS} min-w-[7.5rem]`}
            >
              {t(saving ? "username_saving" : "username_claim")}
            </button>
          </div>
          <p className="font-ui text-[11.5px] leading-relaxed text-text-dim">{t("username_note")}</p>
        </div>
      </div>
    </Modal>
  );
}
