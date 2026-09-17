"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { FOCUS, SEGMENT_ITEM, SEGMENT_OFF, SEGMENT_ON, SEGMENT_TRACK, Spinner } from "@/components/kit";
import { formatUsd, parseAmount } from "@/components/buildType";
import { getLeaderPreview, type CopyLpInput, type LeaderPreview } from "@/lib/api";
import { useT } from "@/lib/i18n";

/**
 * The two Copy LP builder steps — who is copied, and how much — designed as
 * `Build — Copy LP · 01 Leader` and `· 02 Limits` in canopyatlas.pen.
 *
 * Numbers over prose: the leader step is the wallet's book as it is now, and
 * the limits step works the sizing through on the leader's largest position
 * with this agent's own paper book, so the owner sees what a copy opens with
 * rather than reading how sizing works.
 */

export interface CopyLimits {
  leader: string;
  /** Percent of the leader's capital share to copy. 100 mirrors it exactly. */
  copyPct: number;
  /** Most USD one open or one add deposits. Null is no cap. */
  maxIncreaseUsd: number | null;
  /** Null is no floor. */
  minPoolTvlUsd: number | null;
  verifiedTokensOnly: boolean;
  followRebalances: boolean;
  maxSlippagePct: number;
}

export const DEFAULT_COPY_LIMITS: CopyLimits = {
  leader: "",
  copyPct: 100,
  maxIncreaseUsd: null,
  minPoolTvlUsd: null,
  verifiedTokensOnly: true,
  followRebalances: true,
  maxSlippagePct: 1,
};

/** The engine's bounds (agent-contracts COPY_LP_BOUNDS), mirrored for the controls. */
const COPY_PCT = { min: 1, max: 500 };
const MIN_CAP_USD = 5;
const SLIPPAGES = [0.5, 1, 2];

export function copyLpPayload(c: CopyLimits): CopyLpInput {
  return {
    leader: c.leader.trim(),
    copyPct: c.copyPct,
    verifiedTokensOnly: c.verifiedTokensOnly,
    followRebalances: c.followRebalances,
    maxSlippagePct: c.maxSlippagePct,
    ...(c.maxIncreaseUsd !== null ? { maxIncreaseUsd: c.maxIncreaseUsd } : {}),
    ...(c.minPoolTvlUsd !== null ? { minPoolTvlUsd: c.minPoolTvlUsd } : {}),
  };
}

/** A base58 string that decodes to 32 bytes — the same check the server makes. */
export function isSolanaAddress(value: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const ch of value) n = n * 58n + BigInt(ALPHABET.indexOf(ch));
  let bytes = 0;
  while (n > 0n) {
    n >>= 8n;
    bytes++;
  }
  let leadingOnes = 0;
  for (const ch of value) {
    if (ch !== "1") break;
    leadingOnes++;
  }
  return bytes + leadingOnes === 32;
}

/** What one leader position becomes in this agent's book, the way the engine sizes it. */
export function copySize(
  position: { valueUsd: number; sharePct: number | null },
  bookUsd: number,
  limits: Pick<CopyLimits, "copyPct" | "maxIncreaseUsd">,
  minCopyUsd: number,
): { shareUsd: number; usd: number; capped: boolean; skipped: boolean } | null {
  if (position.sharePct === null) return null;
  // The engine's arithmetic (agent-stack copyLp/plan.ts): share × equity × copy %, then the per-deposit cap.
  const shareUsd = (position.sharePct / 100) * bookUsd * (limits.copyPct / 100);
  const capped = limits.maxIncreaseUsd !== null && shareUsd > limits.maxIncreaseUsd;
  const usd = capped ? limits.maxIncreaseUsd! : shareUsd;
  return { shareUsd, usd, capped, skipped: usd < minCopyUsd };
}

export type LeaderState =
  | { phase: "idle" }
  | { phase: "invalid" }
  | { phase: "loading" }
  | { phase: "signed-out" }
  | { phase: "error"; message: string }
  | { phase: "ready"; data: LeaderPreview };

/** The leader's book, read a beat after the address stops changing. */
export function useLeaderPreview(address: string): LeaderState {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [state, setState] = useState<LeaderState>({ phase: "idle" });
  useEffect(() => {
    const a = address.trim();
    if (a === "") return void setState({ phase: "idle" });
    if (!isSolanaAddress(a)) return void setState({ phase: "invalid" });
    // The read is an authenticated route; signed out is a prompt, not a failure.
    if (ready && !authenticated) return void setState({ phase: "signed-out" });
    let live = true;
    setState({ phase: "loading" });
    const id = setTimeout(async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("");
        const data = await getLeaderPreview(token, a);
        if (live) setState({ phase: "ready", data });
      } catch (err) {
        if (live) setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
      }
    }, 350);
    return () => {
      live = false;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, ready, authenticated]);
  return state;
}

const shortAddress = (a: string) => (a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);
export { shortAddress };

/* ------------------------------------------------------------ leader -- */

export function PickLeader({
  value,
  onChange,
  preview,
  bookUsd,
}: {
  value: CopyLimits;
  onChange: (next: CopyLimits) => void;
  preview: LeaderState;
  bookUsd: number;
}) {
  const t = useT();
  const [all, setAll] = useState(false);
  const data = preview.phase === "ready" ? preview.data : null;
  const copyable = data
    ? data.positions.filter((p) => {
        const s = copySize(p, bookUsd, value, data.minCopyUsd);
        return s !== null && !s.skipped;
      }).length
    : null;
  const shown = data ? (all ? data.positions : data.positions.slice(0, 7)) : [];

  return (
    <div className="space-y-6">
      <h1 className="font-ui text-[28px] font-light leading-tight tracking-[-0.02em] text-text-primary">{t("cl_title_leader")}</h1>

      <div className="space-y-2">
        <label htmlFor="copy-leader" className="block font-ui text-[12.5px] text-text-muted">
          {t("cl_field")}
        </label>
        <div
          className={`flex h-[52px] items-center gap-3 rounded-[14px] border-[1.5px] px-4 transition-colors ${
            preview.phase === "invalid" ? "border-negative/70" : "border-grid-strong focus-within:border-accent"
          }`}
        >
          <input
            id="copy-leader"
            data-market-search
            value={value.leader}
            onChange={(e) => onChange({ ...value, leader: e.target.value.trim() })}
            placeholder={t("cl_placeholder")}
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent font-mono text-[15px] text-text-primary outline-none placeholder:font-ui placeholder:text-text-dim"
          />
          {preview.phase === "loading" ? (
            <span className="flex shrink-0 items-center gap-2 font-ui text-[12px] text-text-muted">
              <Spinner /> {t("cl_reading")}
            </span>
          ) : data ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-wash px-2.5 py-1 font-ui text-[12px] font-medium text-accent">
              <span className="size-1.5 rounded-full bg-accent" />
              {t(data.positions.length > 0 ? "cl_found" : "cl_no_positions")}
            </span>
          ) : null}
        </div>
        <p className={`font-ui text-[12px] ${preview.phase === "invalid" || preview.phase === "error" ? "text-negative" : "text-text-muted"}`}>
          {preview.phase === "invalid"
            ? t("cl_invalid")
            : preview.phase === "error"
              ? t("cl_read_failed", { message: preview.message })
              : preview.phase === "signed-out"
                ? t("cl_sign_in")
                : t("cl_help")}
        </p>
      </div>

      {data ? (
        <>
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-grid sm:grid-cols-5">
            <Kpi label={t("cl_capital")} value={data.capitalUsd === null ? "—" : formatUsd(Math.round(data.capitalUsd))} />
            <Kpi
              label={t("cl_in_dlmm")}
              value={formatUsd(Math.round(data.inDlmmUsd))}
              sub={data.capitalUsd ? `${Math.round((data.inDlmmUsd / data.capitalUsd) * 100)}%` : undefined}
            />
            <Kpi label={t("cl_open")} value={String(data.positions.length)} />
            <Kpi label={t("cl_pools")} value={String(data.pools)} />
            <Kpi
              label={t("cl_copyable", { book: formatUsd(bookUsd) })}
              value={copyable === null ? "—" : `${copyable} / ${data.positions.length}`}
              tone={copyable === 0 && data.positions.length > 0 ? "negative" : undefined}
            />
          </div>

          {data.positions.length === 0 ? (
            <p className="rounded-2xl border border-grid px-5 py-4 font-ui text-[13px] text-text-secondary">{t("cl_none_body")}</p>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-grid">
              <div className="flex items-center justify-between px-5 py-4">
                <h2 className="font-ui text-[14px] font-medium text-text-primary">{t("cl_positions")}</h2>
                <span className="font-mono text-[11.5px] text-text-muted">
                  {data.positions.length} · {t("cl_positions_meta")}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-t border-grid">
                  <thead>
                    <tr className="bg-surface text-left font-ui text-[12px] text-text-muted">
                      <th className="px-5 py-2.5 font-normal">{t("cl_col_pool")}</th>
                      <th className="px-3 py-2.5 font-normal">{t("cl_col_range")}</th>
                      <th className="px-3 py-2.5 text-right font-normal">{t("cl_col_value")}</th>
                      <th className="px-3 py-2.5 text-right font-normal">{t("cl_col_share")}</th>
                      <th className="px-3 py-2.5 text-right font-normal">{t("cl_col_copy", { book: formatUsd(bookUsd) })}</th>
                      <th className="px-5 py-2.5 text-right font-normal">{t("cl_col_in_range")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((p) => {
                      const s = copySize(p, bookUsd, value, data.minCopyUsd);
                      return (
                        <tr key={p.position} className="border-t border-grid">
                          <td className="px-5 py-2.5 font-ui text-[13px] font-medium text-text-primary">{p.pair}</td>
                          <td className="tnum px-3 py-2.5 font-mono text-[12px] text-text-secondary">
                            {p.lowerBinId} → {p.upperBinId}
                          </td>
                          <td className="tnum px-3 py-2.5 text-right font-mono text-[12px] text-text-primary">{formatUsd(Math.round(p.valueUsd * 100) / 100)}</td>
                          <td className="tnum px-3 py-2.5 text-right font-mono text-[12px] text-text-secondary">
                            {p.sharePct === null ? "—" : `${p.sharePct.toFixed(1)}%`}
                          </td>
                          <td className="tnum px-3 py-2.5 text-right font-mono text-[12px]">
                            {s === null ? (
                              <span className="text-text-muted">—</span>
                            ) : s.skipped ? (
                              <span className="text-text-muted">{t("cl_below_min", { min: formatUsd(data.minCopyUsd) })}</span>
                            ) : (
                              <span className="text-text-primary">{formatUsd(Math.round(s.usd))}</span>
                            )}
                          </td>
                          <td className="px-5 py-2.5 text-right font-ui text-[12px]">
                            {p.inRange === null ? (
                              <span className="text-text-muted">—</span>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 ${p.inRange ? "text-text-primary" : "text-text-muted"}`}>
                                <span className={`size-1.5 rounded-full ${p.inRange ? "bg-accent" : "bg-grid-strong"}`} />
                                {t(p.inRange ? "cl_yes" : "cl_no")}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {data.positions.length > 7 ? (
                <div className="flex items-center justify-between border-t border-grid px-5 py-3">
                  <span className="tnum font-mono text-[11.5px] text-text-muted">
                    1–{shown.length} / {data.positions.length}
                  </span>
                  <button type="button" onClick={() => setAll((v) => !v)} className={`font-ui text-[12.5px] text-text-secondary hover:text-text-primary ${FOCUS}`}>
                    {t(all ? "cl_show_less" : "cl_show_all", { count: data.positions.length })}
                  </button>
                </div>
              ) : null}
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "negative" }) {
  return (
    <div className="border-grid px-5 py-4 [&:not(:first-child)]:border-l">
      <div className="truncate font-ui text-[12px] text-text-muted">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={`tnum font-mono text-[22px] tracking-[-0.02em] ${tone === "negative" ? "text-negative" : "text-text-primary"}`}>{value}</span>
        {sub ? <span className="tnum font-mono text-[11.5px] text-text-muted">{sub}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ limits -- */

export function CopyLimitsStep({
  value,
  onChange,
  preview,
  bookUsd,
}: {
  value: CopyLimits;
  onChange: (next: CopyLimits) => void;
  preview: LeaderState;
  bookUsd: number;
}) {
  const t = useT();
  const data = preview.phase === "ready" ? preview.data : null;
  const largest = data?.positions[0] ?? null;
  const size = data && largest ? copySize(largest, bookUsd, value, data.minCopyUsd) : null;

  const mirrors: [string, string, string][] = [
    [t("cl_m_open"), t("cl_m_open_copy"), t("cl_m_open_note")],
    [t("cl_m_resize"), t("cl_m_resize_copy"), t("cl_m_resize_note")],
    [t("cl_m_range"), t("cl_m_range_copy"), t(value.followRebalances ? "cl_m_range_note_on" : "cl_m_range_note_off")],
    [t("cl_m_close"), t("cl_m_close_copy"), "—"],
    [t("cl_m_claim"), t("cl_m_claim_copy"), t("cl_m_claim_note")],
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-ui text-[28px] font-light leading-tight tracking-[-0.02em] text-text-primary">{t("cl_title_limits")}</h1>

      <section className="rounded-2xl border border-grid px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-ui text-[14px] font-medium text-text-primary">{t(largest ? "cl_sizing" : "cl_sizing_none")}</h2>
          {largest ? <span className="font-mono text-[11.5px] text-text-muted">{largest.pair}</span> : null}
        </div>
        {largest && size && data?.capitalUsd ? (
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-4">
            <Calc label={t("cl_calc_position")} value={formatUsd(Math.round(largest.valueUsd * 100) / 100)} />
            <Op>÷</Op>
            <Calc label={t("cl_calc_capital")} value={formatUsd(Math.round(data.capitalUsd))} />
            <Op>=</Op>
            <Calc label={t("cl_calc_share")} value={`${largest.sharePct?.toFixed(1)}%`} />
            <Op>×</Op>
            <Calc label={t("cl_calc_equity")} value={formatUsd(bookUsd)} />
            <Op>×</Op>
            <Calc label={t("cl_calc_copy_pct")} value={`${value.copyPct}%`} />
            <Op>=</Op>
            <Calc
              label={t("cl_calc_copy")}
              value={formatUsd(Math.round(size.shareUsd))}
              sub={size.capped && value.maxIncreaseUsd !== null ? t("cl_calc_capped", { usd: formatUsd(value.maxIncreaseUsd) }) : undefined}
            />
            <Op>→</Op>
            <Calc
              label={t("cl_calc_opens")}
              value={size.skipped ? "—" : formatUsd(Math.round(size.usd))}
              sub={size.skipped ? t("cl_calc_skipped", { min: formatUsd(data.minCopyUsd) }) : undefined}
              big
              tone={size.skipped ? "muted" : "accent"}
            />
          </div>
        ) : (
          <p className="mt-2 font-ui text-[13px] text-text-secondary">{t("cl_sizing_empty")}</p>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-grid">
          <h2 className="border-b border-grid px-5 py-4 font-ui text-[14px] font-medium text-text-primary">{t("cl_limits")}</h2>
          <Field label={t("cl_copy_pct")} help={t("cl_copy_pct_help")}>
            <Percent
              value={value.copyPct}
              min={COPY_PCT.min}
              max={COPY_PCT.max}
              onChange={(n) => onChange({ ...value, copyPct: n })}
              aria={t("cl_copy_pct")}
            />
          </Field>
          <Field label={t("cl_max_increase")} help={t("cl_max_increase_help")}>
            <OptionalAmount
              value={value.maxIncreaseUsd}
              min={MIN_CAP_USD}
              onChange={(n) => onChange({ ...value, maxIncreaseUsd: n })}
              offLabel={t("cl_off")}
              aria={t("cl_max_increase")}
            />
          </Field>
          <Field label={t("cl_tvl")} help={t("cl_tvl_help")}>
            <OptionalAmount
              value={value.minPoolTvlUsd}
              min={0}
              onChange={(n) => onChange({ ...value, minPoolTvlUsd: n })}
              offLabel={t("cl_off")}
              aria={t("cl_tvl")}
            />
          </Field>
          <Field label={t("cl_slippage")} help={t("cl_slippage_help")}>
            <div className={SEGMENT_TRACK} role="radiogroup" aria-label={t("cl_slippage")}>
              {SLIPPAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={value.maxSlippagePct === s}
                  onClick={() => onChange({ ...value, maxSlippagePct: s })}
                  className={`${SEGMENT_ITEM} tnum font-mono ${value.maxSlippagePct === s ? SEGMENT_ON : SEGMENT_OFF}`}
                >
                  {s}%
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("cl_verified")} help={t("cl_verified_help")}>
            <Switch on={value.verifiedTokensOnly} label={t("cl_verified")} onChange={(on) => onChange({ ...value, verifiedTokensOnly: on })} />
          </Field>
          <Field label={t("cl_rebalances")} help={t("cl_rebalances_help")} last>
            <Switch on={value.followRebalances} label={t("cl_rebalances")} onChange={(on) => onChange({ ...value, followRebalances: on })} />
          </Field>
        </section>

        <section className="self-start overflow-hidden rounded-2xl border border-grid">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <h2 className="font-ui text-[14px] font-medium text-text-primary">{t("cl_mirrors")}</h2>
            <span className="font-mono text-[11.5px] text-text-muted">{t("cl_mirrors_meta")}</span>
          </div>
          <table className="w-full border-t border-grid">
            <thead>
              <tr className="bg-surface text-left font-ui text-[12px] text-text-muted">
                <th className="w-[34%] px-5 py-2.5 font-normal">{t("cl_m_when")}</th>
                <th className="px-3 py-2.5 font-normal">{t("cl_m_copy")}</th>
                <th className="w-[26%] px-5 py-2.5 font-normal">{t("cl_m_note")}</th>
              </tr>
            </thead>
            <tbody>
              {mirrors.map(([when, copy, note]) => (
                <tr key={when} className="border-t border-grid align-top">
                  <td className="px-5 py-3 font-ui text-[12.5px] font-medium text-text-primary">{when}</td>
                  <td className="px-3 py-3 font-ui text-[12.5px] text-text-primary">{copy}</td>
                  <td className="px-5 py-3 font-ui text-[12.5px] text-text-muted">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Calc({ label, value, sub, big, tone }: { label: string; value: string; sub?: string; big?: boolean; tone?: "accent" | "muted" }) {
  return (
    <div>
      <div className="font-ui text-[12px] text-text-muted">{label}</div>
      <div
        className={`tnum mt-1 font-mono tracking-[-0.02em] ${big ? "text-[30px]" : "text-[22px]"} ${
          tone === "accent" ? "text-accent" : tone === "muted" ? "text-text-muted" : "text-text-primary"
        }`}
      >
        {value}
      </div>
      {sub ? <div className="mt-0.5 font-ui text-[11.5px] text-text-secondary">{sub}</div> : null}
    </div>
  );
}

function Op({ children }: { children: string }) {
  return (
    <span aria-hidden className="font-mono text-[18px] text-text-muted">
      {children}
    </span>
  );
}

function Field({ label, help, children, last }: { label: string; help: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 px-5 py-4 ${last ? "" : "border-b border-grid"}`}>
      <div className="min-w-0">
        <div className="font-ui text-[13.5px] font-medium text-text-primary">{label}</div>
        <div className="mt-0.5 font-ui text-[12px] text-text-muted">{help}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${FOCUS} ${on ? "justify-end bg-accent" : "justify-start bg-grid-strong"}`}
    >
      <span className="size-4 rounded-full bg-white" />
    </button>
  );
}

/** A whole percentage, clamped to the engine's bounds. Commits on blur or Enter. */
function Percent({
  value,
  onChange,
  min,
  max,
  aria,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  aria: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  const commit = () => {
    const n = parseAmount(text);
    if (n === null) return setText(String(value));
    const next = Math.round(Math.min(Math.max(n, min), max));
    setText(String(next));
    onChange(next);
  };
  return (
    <label className="flex h-9 w-[132px] items-center gap-1 rounded-[10px] border border-grid px-3 focus-within:border-accent">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        inputMode="numeric"
        aria-label={aria}
        className="tnum w-full min-w-0 bg-transparent font-mono text-[14px] text-text-primary outline-none"
      />
      <span className="font-mono text-[13px] text-text-muted">%</span>
    </label>
  );
}

/** A dollar amount that can also be switched off. Commits on blur or Enter. */
function OptionalAmount({
  value,
  onChange,
  min,
  offLabel,
  aria,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  min: number;
  offLabel: string;
  aria: string;
}) {
  const [text, setText] = useState(value === null ? "" : value.toLocaleString("en-US"));
  useEffect(() => {
    setText(value === null ? "" : value.toLocaleString("en-US"));
  }, [value]);
  const commit = () => {
    if (text.trim() === "") return onChange(null);
    const n = parseAmount(text);
    if (n === null) return setText(value === null ? "" : value.toLocaleString("en-US"));
    onChange(Math.max(n, min));
  };
  return (
    <div className="flex items-center gap-2">
      {value !== null ? (
        <button type="button" onClick={() => onChange(null)} className={`font-ui text-[12px] text-text-muted hover:text-text-primary ${FOCUS}`}>
          {offLabel}
        </button>
      ) : null}
      <label className="flex h-9 w-[132px] items-center gap-1 rounded-[10px] border border-grid px-3 focus-within:border-accent">
        <span className="font-mono text-[13px] text-text-muted">$</span>
        <input
          value={text}
          placeholder={offLabel}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
          inputMode="decimal"
          aria-label={aria}
          className="tnum w-full min-w-0 bg-transparent font-mono text-[14px] text-text-primary outline-none placeholder:font-ui placeholder:text-[12.5px] placeholder:text-text-dim"
        />
      </label>
    </div>
  );
}
