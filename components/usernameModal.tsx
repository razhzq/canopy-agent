"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { Modal } from "@/components/modal";
import { checkUsername } from "@/lib/api";
import { useUsername } from "@/lib/useUsername";

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

/** canopy-fe's mask, character for character. */
const ALLOWED = /^[a-zA-Z0-9_]*$/;
const MAX = 20;

type Check =
  | { at: "idle" }
  | { at: "checking" }
  | { at: "free" }
  | { at: "taken"; reason: string };

export function UsernameModal({ onClose }: { onClose: () => void }) {
  const { getAccessToken } = usePrivy();
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
    const t = setTimeout(async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        const res = await checkUsername(token, name);
        if (cancelled) return;
        setCheck(
          res.available
            ? { at: "free" }
            : { at: "taken", reason: res.reason ?? "That name is taken." },
        );
      } catch {
        // A failed lookup is not a refusal — leave the button live and let the
        // save be the thing that decides.
        if (!cancelled) setCheck({ at: "idle" });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [name, getAccessToken]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await save(name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  const ready = name.length >= 3 && check.at !== "taken" && !saving;

  return (
    <Modal title="Choose a username" onClose={onClose}>
      <div className="space-y-5 px-5 py-6">
        <p className="font-ui text-[12.5px] leading-relaxed text-text-secondary">
          It replaces your email everywhere in Canopy, and it is how other people will find
          you.
        </p>

        <div className="space-y-2">
          <div className="flex items-center border border-grid bg-bg focus-within:border-accent">
            <span className="pl-3 font-mono text-[15px] text-text-dim">@</span>
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
              placeholder="yourname"
              className="w-full bg-transparent px-2 py-2.5 font-mono text-[15px] text-text-primary outline-none placeholder:text-text-dim"
            />
            <span className="pr-3 font-mono text-[10px] text-text-dim">
              {name.length}/{MAX}
            </span>
          </div>

          <p className="min-h-[16px] font-ui text-[11.5px] leading-relaxed">
            {error ? (
              <span className="text-negative">{error}</span>
            ) : check.at === "taken" ? (
              <span className="text-negative">{check.reason}</span>
            ) : check.at === "free" ? (
              <span className="text-accent">@{name} is available.</span>
            ) : check.at === "checking" ? (
              <span className="text-text-dim">Checking…</span>
            ) : name.length > 0 && name.length < 3 ? (
              <span className="text-text-dim">At least 3 characters.</span>
            ) : (
              <span className="text-text-dim">Letters, numbers and underscores.</span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 border border-grid-strong py-2.5 font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase transition-colors hover:bg-surface disabled:opacity-40"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!ready}
            className="flex-1 bg-accent py-2.5 font-mono text-[11px] tracking-[0.1em] text-bg uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {saving ? "Saving…" : "Claim"}
          </button>
        </div>

        {/* Said once. A username is not a nickname you can cycle through — it is
            unique across Canopy, so the next person to want it cannot have it
            while you hold it. */}
        <p className="font-ui text-[11px] leading-relaxed text-text-dim">
          Usernames are unique across Canopy and shared with the exchange.
        </p>
      </div>
    </Modal>
  );
}
