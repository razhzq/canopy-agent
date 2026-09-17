"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { FOCUS, SEGMENT_ITEM, SEGMENT_OFF, SEGMENT_ON, SEGMENT_TRACK } from "@/components/kit";
import { getLpRecord, type LpRecord } from "@/lib/api";
import { FUND_EDITION, FUNDS, type Fund, type FundType } from "@/lib/atlas/funds";
import { compactUsd, shortDate, usd } from "@/lib/format";
import { useLocale, useT, type TranslationKey } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";

/**
 * Atlas: fifty crypto funds beside one Canopy LP strategy's on-chain record.
 *
 * A dashboard, not an essay. Labels name figures and nothing is explained in
 * prose; the design in canopyatlas.pen is the reference.
 *
 * TWO MEASURES, NEVER BLENDED. A fund's figure is the change in its reported
 * AUM, which includes inflows. Canopy's is the net return of the wallet since
 * it started. The chart meta line says so, the Canopy row carries its days
 * live, and nothing on the page merges the two into a score.
 */

/** The team's LP strategy wallet this page benchmarks against. */
export const ATLAS_LP_ADDRESS = "CK2TVHYorRwobV2VqHncHp3kKD4NKJMdkPATtFxq7kAh";

type TypeFilter = "all" | FundType;
type Period = "12m" | "24m";

const TYPE_KEY: Record<TypeFilter, TranslationKey> = {
  all: "atlas_type_all",
  hedge: "atlas_type_hedge",
  venture: "atlas_type_venture",
  pe: "atlas_type_pe",
};

const PAGE_SIZE = 10;

/** "+19.3%" / "−4.0%", with a real minus sign. */
function pct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = Math.abs(v).toFixed(digits);
  return v < 0 ? `−${s}%` : `+${s}%`;
}

/** Percentage points, signed. */
function pts(v: number): string {
  const s = Math.abs(v).toFixed(1);
  return v < 0 ? `−${s}` : `+${s}`;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const aumUsd = (f: Fund) => (f.aumUsdM == null ? null : f.aumUsdM * 1e6);
const changeOf = (f: Fund, p: Period) => (p === "12m" ? f.change12m : f.change24m);

/** "STONK/SOL", or "4 pools" once the list would not fit a heading. */
function poolsLabel(lp: LpRecord, t: ReturnType<typeof useT>): string {
  return lp.pairs.length <= 1 ? (lp.pairs[0] ?? lp.venue) : t("atlas_lp_pools", { n: lp.pairs.length });
}

function shortName(name: string): string {
  return name
    .replace(/\s+(Management|Partners|Capital Management|AG|Ltd)$/i, "")
    .replace(/Technology Growth$/, "Tech Growth");
}

/* ------------------------------------------------------------------ page -- */

export function AtlasDashboard() {
  const record = useApi<LpRecord>((token) => getLpRecord(token, ATLAS_LP_ADDRESS), []);
  return <AtlasView record={record} />;
}

type RecordState = ReturnType<typeof useApi<LpRecord>>;

/** The dashboard without its fetch, so the dev preview can draw it from a fixture. */
export function AtlasView({ record }: { record: RecordState }) {
  const t = useT();
  const [type, setType] = useState<TypeFilter>("all");
  const [period, setPeriod] = useState<Period>("12m");
  const lp = record.phase === "ready" ? record.data : null;

  const funds = useMemo(
    () => (type === "all" ? FUNDS : FUNDS.filter((f) => f.type === type)),
    [type],
  );

  const reported = funds.filter((f) => changeOf(f, period) != null);
  const med = median(reported.map((f) => changeOf(f, period) as number));
  const totalAum = funds.reduce((s, f) => s + (aumUsd(f) ?? 0), 0);
  const ahead = lp ? reported.filter((f) => (changeOf(f, period) as number) < lp.netReturnPct).length : null;

  return (
    <div className="space-y-4 px-5 pt-7 pb-10 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <h1 className="font-ui text-[28px] leading-none font-light tracking-[-0.02em] text-text-primary">
            {t("atlas_title")}
          </h1>
          <span className="tnum rounded-md bg-surface-2 px-2 py-1 font-mono text-[11px] text-text-secondary">
            {FUND_EDITION}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Segments
            label={t("atlas_filter_aria")}
            value={type}
            onChange={setType}
            options={(["all", "hedge", "venture", "pe"] as const).map((v) => ({ v, label: t(TYPE_KEY[v]) }))}
          />
          <Segments
            label={t("atlas_period_aria")}
            value={period}
            onChange={setPeriod}
            options={[
              { v: "12m" as const, label: t("atlas_period_12m") },
              { v: "24m" as const, label: t("atlas_period_24m") },
            ]}
          />
        </div>
      </header>

      {/* Key figures. One accent: the Canopy value. */}
      <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label={t("atlas_kpi_canopy")} live>
          {lp ? (
            <span className={lp.netReturnPct < 0 ? "text-negative" : "text-accent"}>{pct(lp.netReturnPct)}</span>
          ) : (
            <Pending />
          )}
        </Kpi>
        <Kpi label={t("atlas_kpi_median")}>{pct(med)}</Kpi>
        <Kpi label={t("atlas_kpi_ahead")}>
          {ahead == null ? <Pending /> : `${ahead} / ${reported.length}`}
        </Kpi>
        <Kpi label={t("atlas_kpi_aum")}>{compactUsd(totalAum)}</Kpi>
        <Kpi label={t("atlas_kpi_firms")}>{funds.length}</Kpi>
      </section>

      <section className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <ChangeChart funds={reported} period={period} lp={lp} />
        <LpCard state={record} />
      </section>

      <section className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <FirmTable funds={funds} period={period} lp={lp} key={`${type}`} />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-rows-[auto_minmax(0,1fr)]">
          <AumByType funds={funds} />
          <Founded funds={funds} />
        </div>
      </section>

      <p className="pt-2 font-ui text-[11.5px] text-text-muted">
        {t("atlas_source", { edition: FUND_EDITION })}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- controls -- */

function Segments<V extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options: { v: V; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className={SEGMENT_TRACK}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={o.v === value}
          onClick={() => onChange(o.v)}
          className={`${SEGMENT_ITEM} ${FOCUS} ${o.v === value ? SEGMENT_ON : SEGMENT_OFF}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Kpi({ label, live, children }: { label: string; live?: boolean; children: React.ReactNode }) {
  return (
    // The negative margin collapses the doubled hairline where cells meet, so
    // the grid can wrap to two or three columns without a thick seam.
    <div className="-mt-px -ml-px space-y-2 border-t border-l border-border px-5 py-4 sm:px-6">
      <p className="flex items-center gap-1.5 font-ui text-[12px] text-text-muted">
        {live ? <span className="size-1.5 rounded-full bg-accent" aria-hidden /> : null}
        {label}
      </p>
      <p className="tnum font-mono text-[24px] leading-none tracking-[-0.02em] text-text-primary">{children}</p>
    </div>
  );
}

function Pending() {
  return <span className="inline-block h-[22px] w-20 animate-pulse rounded bg-surface-2 align-middle" />;
}

function Card({ title, meta, children, className = "" }: { title: string; meta?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-4 rounded-2xl border border-border px-5 py-5 sm:px-6 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-ui text-[14px] font-medium text-text-primary">{title}</h2>
        {meta}
      </div>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- chart -- */

function ChangeChart({ funds, period, lp }: { funds: Fund[]; period: Period; lp: LpRecord | null }) {
  const t = useT();
  type Row = { name: string; value: number; canopy?: boolean };
  const rows: Row[] = funds.map((f) => ({ name: shortName(f.name), value: changeOf(f, period) as number }));
  if (lp) rows.push({ name: t("atlas_kpi_canopy"), value: lp.netReturnPct, canopy: true });
  rows.sort((a, b) => b.value - a.value);

  // A diverging scale when anything is negative (24M has three firms below
  // -80%), otherwise bars grow from the left edge.
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const hasNeg = rows.some((r) => r.value < 0);

  return (
    <Card
      title={`${t("atlas_chart_title")} · ${t(period === "12m" ? "atlas_period_12m" : "atlas_period_24m")}`}
      meta={<span className="hidden font-ui text-[11.5px] text-text-muted sm:block">{t("atlas_chart_meta")}</span>}
    >
      {rows.length === 0 ? (
        <p className="py-10 text-center font-ui text-[12.5px] text-text-dim">{t("atlas_chart_empty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const w = `${(Math.abs(r.value) / max) * (hasNeg ? 50 : 100)}%`;
            const fill = r.canopy ? "bg-accent" : r.value < 0 ? "bg-negative/50" : "bg-grid-strong";
            return (
              <li key={r.name} className="grid grid-cols-[110px_minmax(0,1fr)_64px] items-center gap-3 sm:grid-cols-[160px_minmax(0,1fr)_72px]">
                <span className={`truncate font-ui text-[12.5px] ${r.canopy ? "font-medium text-text-primary" : "text-text-secondary"}`}>
                  {r.name}
                  {r.canopy && lp ? (
                    <span className="tnum ml-2 font-mono text-[10.5px] font-normal text-text-muted">
                      {t("atlas_days_live", { days: lp.daysLive })}
                    </span>
                  ) : null}
                </span>
                <span className="relative block h-[22px] rounded bg-surface">
                  {hasNeg ? <span className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden /> : null}
                  <span
                    className={`absolute inset-y-0 rounded ${fill}`}
                    style={
                      hasNeg
                        ? r.value >= 0
                          ? { left: "50%", width: w }
                          : { right: "50%", width: w }
                        : { left: 0, width: w }
                    }
                  />
                </span>
                <span className={`tnum text-right font-mono text-[12.5px] ${r.canopy ? "text-accent" : r.value < 0 ? "text-negative" : "text-text-primary"}`}>
                  {pct(r.value)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------- lp card -- */

function LpCard({ state }: { state: RecordState }) {
  const t = useT();
  const { locale } = useLocale();

  if (state.phase !== "ready") {
    return (
      <Card title={t("atlas_lp_title")}>
        {state.phase === "error" ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-3">
            <p className="font-ui text-[12.5px] text-text-dim">{t("atlas_lp_error")}</p>
            <button type="button" onClick={state.reload} className={`font-ui text-[12.5px] text-text-secondary hover:text-text-primary ${FOCUS}`}>
              {t("atlas_lp_retry")}
            </button>
          </div>
        ) : (
          <div className="flex-1 animate-pulse rounded-xl bg-surface" />
        )}
      </Card>
    );
  }

  const lp = state.data;
  const values = lp.series.map((p) => p.pnlUsd);
  const extent = Math.max(1, ...values.map(Math.abs));
  const hasNeg = values.some((v) => v < 0);

  const stats: [TranslationKey, string][] = [
    ["atlas_lp_value", usd(lp.valueUsd)],
    ["atlas_lp_pnl", usd(lp.pnlUsd, { sign: true })],
    ["atlas_lp_fees", usd(lp.feesUsd)],
    ["atlas_lp_opened", String(lp.positionsOpened)],
    ["atlas_lp_positions", String(lp.openPositions)],
    ["atlas_lp_days", String(lp.daysLive)],
  ];

  return (
    <Card
      title={`${t("atlas_lp_title")} · ${lp.venue}`}
      meta={
        <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-ui text-[11.5px] font-medium text-text-primary">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden />
          {t("atlas_lp_live")}
        </span>
      }
    >
      <div className="flex items-baseline gap-2.5">
        <span className={`tnum font-mono text-[36px] leading-none tracking-[-0.02em] ${lp.netReturnPct < 0 ? "text-negative" : "text-text-primary"}`}>
          {pct(lp.netReturnPct, 2)}
        </span>
        <span className="font-ui text-[12px] text-text-muted">{t("atlas_lp_since", { date: shortDate(lp.startedAt, locale) })}</span>
      </div>
      <p className="-mt-2 flex flex-wrap gap-x-3 gap-y-1 font-ui text-[12px] text-text-muted">
        <span className="tnum font-mono">{t("atlas_lp_in_sol", { pct: pct(lp.netReturnSolPct, 2) })}</span>
        <span>{lp.pairs.join(" · ")}</span>
      </p>

      {/* P&L at each midnight, as columns from a zero line. Below zero only
          when the record has been below zero, so a winning record uses the
          full height. */}
      <div className="flex h-[120px] gap-[6px]" aria-hidden>
        {values.map((v, i) => {
          const h = `${(Math.abs(v) / extent) * (hasNeg ? 50 : 100)}%`;
          const last = i === values.length - 1;
          return (
            <span key={lp.series[i].t} className="relative min-w-0 flex-1">
              {hasNeg ? <span className="absolute inset-x-0 top-1/2 h-px bg-grid" /> : null}
              <span
                className={`absolute inset-x-0 rounded-[2px] ${v < 0 ? "bg-negative/60" : last ? "bg-accent" : "bg-accent/30"}`}
                style={
                  v >= 0
                    ? { bottom: hasNeg ? "50%" : 0, height: h, minHeight: 2 }
                    : { top: "50%", height: h, minHeight: 2 }
                }
              />
            </span>
          );
        })}
      </div>

      <dl className="grid grid-cols-3 gap-x-4 gap-y-3 border-t border-grid pt-4">
        {stats.map(([k, v]) => (
          <div key={k} className="min-w-0 space-y-1">
            <dt className="truncate font-ui text-[11px] text-text-muted">{t(k)}</dt>
            <dd className="tnum truncate font-mono text-[13.5px] text-text-primary">{v}</dd>
          </div>
        ))}
      </dl>

      <a
        href={`https://solscan.io/account/${lp.address}`}
        target="_blank"
        rel="noreferrer"
        className={`mt-auto flex items-center justify-between font-ui text-[11.5px] text-text-muted hover:text-text-primary ${FOCUS}`}
      >
        <span>{t("atlas_lp_wallet")}</span>
        <span className="tnum font-mono">
          {lp.address.slice(0, 4)}…{lp.address.slice(-4)}
        </span>
      </a>
    </Card>
  );
}

/* ---------------------------------------------------------------- table -- */

function FirmTable({ funds, period, lp }: { funds: Fund[]; period: Period; lp: LpRecord | null }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return funds
      .filter((f) => !q || f.name.toLowerCase().includes(q) || (f.country ?? "").toLowerCase().includes(q))
      .sort((a, b) => (b.aumUsdM ?? -1) - (a.aumUsdM ?? -1));
  }, [funds, query]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const at = Math.min(page, pages - 1);
  const shown = rows.slice(at * PAGE_SIZE, at * PAGE_SIZE + PAGE_SIZE);
  const grid = "grid grid-cols-[minmax(0,1fr)_80px_72px] items-center gap-4 px-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_80px_120px_88px_72px_88px]";
  const hideSm = "hidden md:block";

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border">
      <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <h2 className="font-ui text-[14px] font-medium text-text-primary">{t("atlas_table_title")}</h2>
        <label className="flex h-8 w-[200px] items-center gap-2 rounded-full border border-border px-3 focus-within:border-grid-strong">
          <Search className="size-3.5 shrink-0 text-text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={t("atlas_search")}
            aria-label={t("atlas_search")}
            className="w-full bg-transparent font-ui text-[12.5px] text-text-primary outline-none placeholder:text-text-muted"
          />
        </label>
      </div>

      <div className={`${grid} h-9 border-t border-grid bg-surface font-ui text-[11px] text-text-muted`}>
        <span>{t("atlas_col_firm")}</span>
        <span className={hideSm}>{t("atlas_col_type")}</span>
        <span className={hideSm}>{t("atlas_col_hq")}</span>
        <span className="text-right">{t("atlas_col_aum")}</span>
        <span className="text-right">{t(period === "12m" ? "atlas_period_12m" : "atlas_period_24m")}</span>
        <span className={`text-right ${hideSm}`}>{t("atlas_col_vs")}</span>
      </div>

      {lp ? (
        <div className={`${grid} h-11 border-t border-grid bg-accent-wash/40`}>
          <span className="truncate font-ui text-[13px] font-medium text-text-primary">
            {t("atlas_kpi_canopy")} · {poolsLabel(lp, t)}
          </span>
          <span className={`${hideSm} truncate font-ui text-[12.5px] text-text-secondary`}>{t("atlas_onchain")}</span>
          <span className={`${hideSm} font-ui text-[12.5px] text-text-secondary`}>Solana</span>
          <span className="tnum text-right font-mono text-[12.5px] text-text-secondary">{compactUsd(lp.valueUsd)}</span>
          <span className="tnum text-right font-mono text-[12.5px] text-accent">{pct(lp.netReturnPct)}</span>
          <span className={`${hideSm} tnum text-right font-mono text-[11px] text-text-muted`}>
            {t("atlas_days_live", { days: lp.daysLive })}
          </span>
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="border-t border-grid px-6 py-10 text-center font-ui text-[12.5px] text-text-dim">{t("atlas_no_match")}</p>
      ) : (
        shown.map((f) => {
          const c = changeOf(f, period);
          const lead = lp && c != null ? lp.netReturnPct - c : null;
          return (
            <div key={f.name} className={`${grid} h-11 border-t border-grid`}>
              <span className="truncate font-ui text-[13px] font-medium text-text-primary">{f.name}</span>
              <span className={`${hideSm} font-ui text-[12.5px] text-text-secondary`}>{t(TYPE_KEY[f.type])}</span>
              <span className={`${hideSm} truncate font-ui text-[12.5px] text-text-secondary`}>{f.country ?? "—"}</span>
              <span className="tnum text-right font-mono text-[12.5px] text-text-secondary">{compactUsd(aumUsd(f))}</span>
              <span className={`tnum text-right font-mono text-[12.5px] ${c != null && c < 0 ? "text-negative" : "text-text-secondary"}`}>
                {pct(c)}
              </span>
              <span
                className={`${hideSm} tnum text-right font-mono text-[12.5px] ${
                  lead == null ? "text-text-muted" : lead >= 0 ? "text-accent" : "text-negative"
                }`}
              >
                {lead == null ? "—" : pts(lead)}
              </span>
            </div>
          );
        })
      )}

      <div className="mt-auto flex items-center justify-between border-t border-grid px-5 py-3 sm:px-6">
        <span className="tnum font-mono text-[11.5px] text-text-muted">
          {rows.length === 0
            ? "0"
            : t("atlas_page_count", {
                from: at * PAGE_SIZE + 1,
                to: Math.min(rows.length, (at + 1) * PAGE_SIZE),
                total: rows.length,
              })}
        </span>
        <div className="flex gap-2">
          {[
            { dir: -1, Icon: ChevronLeft, label: t("atlas_prev"), off: at === 0 },
            { dir: 1, Icon: ChevronRight, label: t("atlas_next"), off: at >= pages - 1 },
          ].map(({ dir, Icon, label, off }) => (
            <button
              key={dir}
              type="button"
              aria-label={label}
              disabled={off}
              onClick={() => setPage(at + dir)}
              className={`flex size-7 items-center justify-center rounded-full border border-border text-text-primary transition-colors hover:border-grid-strong disabled:opacity-30 ${FOCUS}`}
            >
              <Icon className="size-3.5" aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- side cards -- */

function AumByType({ funds }: { funds: Fund[] }) {
  const t = useT();
  const parts = (["hedge", "venture", "pe"] as const).map((k) => ({
    k,
    v: funds.filter((f) => f.type === k).reduce((s, f) => s + (aumUsd(f) ?? 0), 0),
  }));
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  const tone = { hedge: "var(--color-text-primary)", venture: "var(--color-text-muted)", pe: "var(--color-grid-strong)" };
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <Card title={t("atlas_by_type")}>
      <div className="flex items-center gap-7">
        <svg viewBox="0 0 112 112" className="size-[104px] shrink-0 -rotate-90" aria-hidden>
          <circle cx="56" cy="56" r={R} fill="none" stroke="var(--color-surface)" strokeWidth="14" />
          {parts.map((p) => {
            const len = (p.v / total) * C;
            const el = (
              <circle
                key={p.k}
                cx="56"
                cy="56"
                r={R}
                fill="none"
                stroke={tone[p.k]}
                strokeWidth="14"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <ul className="min-w-0 flex-1 space-y-3">
          {parts.map((p) => (
            <li key={p.k} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-[2px]" style={{ background: tone[p.k] }} aria-hidden />
              <span className="flex-1 truncate font-ui text-[12.5px] text-text-secondary">{t(TYPE_KEY[p.k])}</span>
              <span className="tnum font-mono text-[12.5px] text-text-primary">{compactUsd(p.v)}</span>
              <span className="tnum w-9 text-right font-mono text-[11.5px] text-text-muted">
                {Math.round((p.v / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function Founded({ funds }: { funds: Fund[] }) {
  const t = useT();
  // Three-year windows from 2004; everything earlier shares one column.
  const bins = [
    { label: "<'04", from: 0, to: 2003 },
    ...[2004, 2007, 2010, 2013, 2016, 2019, 2022].map((y) => ({ label: `'${String(y).slice(2)}`, from: y, to: y + 2 })),
  ].map((b) => ({ ...b, n: funds.filter((f) => f.founded != null && f.founded >= b.from && f.founded <= b.to).length }));
  const max = Math.max(1, ...bins.map((b) => b.n));

  return (
    <Card title={t("atlas_founded")} className="min-h-[200px]">
      <div className="flex min-h-[140px] flex-1 items-stretch gap-2">
        {bins.map((b) => (
          <div key={b.label} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="flex w-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="tnum font-mono text-[10.5px] text-text-muted">{b.n}</span>
              <span
                className="w-full rounded-[2px] bg-grid-strong"
                style={{ height: `calc(${(b.n / max) * 100}% - 18px)`, minHeight: 2 }}
              />
            </span>
            <span className="tnum font-mono text-[10.5px] text-text-muted">{b.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
