"use client";

// /research — the execution footprint study. Public: no sign-in, no app chrome.
//
// One order ($500k of JUP) executed three ways. Each lane draws the price the
// fund pays over every trade in the market, placed by size; the views switch
// between what the market, a chain analyst and a market maker pool's operator
// can see. The model lives in ./footprint; this file only draws it.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Wordmark } from "@/components/brand";
import { LanguageSwitcher } from "@/components/languageSwitcher";
import { useT, type TranslationKey } from "@/lib/i18n";
import {
  buildLane,
  statsAt,
  walletColor,
  CANOPY_HOURS,
  MM_FLAG,
  ORDER,
  P99,
  WALLETS,
  type LaneData,
  type LaneKind,
} from "./footprint";
import "@/components/landing/landing.css";
import "./research.css";

type View = "market" | "analyst" | "mm";
type T = ReturnType<typeof useT>;

const DURATION = 14_000; // ms for a full play
const C = {
  grid: "#1B221E",
  meta: "rgba(255,255,255,.45)",
  organic: "rgba(255,255,255,.2)",
  p99: "rgba(255,255,255,.32)",
  naive: "#E8ECEA",
  canopy: "#5ED3B3",
  loss: "#E5484D",
  cursor: "rgba(255,255,255,.25)",
};
const usd = (v: number) => "$" + Math.round(v).toLocaleString("en-US");
const pct = (bps: number) => (bps / 100).toFixed(bps < 10 ? 3 : 2) + "%";
// Inline widths are rounded so the server and the browser serialise the same string.
const share = (part: number, whole: number) => `${((part / whole) * 100).toFixed(2)}%`;

/** A dictionary string whose `{placeholders}` render as mono figures. */
function Rich({ text, vars }: { text: string; vars: Record<string, string> }) {
  const parts = text.split(/\{(\w+)\}/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <span className="num" key={i}>
            {vars[p] ?? `{${p}}`}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}

function cssFont(variable: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

// ── One lane: canvas + stats ────────────────────────────────────────────────

interface LaneProps {
  lane: LaneData;
  name: string;
  sub: string;
  prog: number;
  view: View;
  yMax: number;
  t: T;
}

function Lane({ lane, name, sub, prog, view, yMax, t }: LaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cache = useRef<{ canvas: HTMLCanvasElement; drawn: number; prog: number; key: string } | null>(null);
  const [width, setWidth] = useState(0);
  const color = lane.kind === "canopy" ? C.canopy : C.naive;
  const minute = prog * lane.horizon;
  const st = statsAt(lane, minute);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !width) return;
    const w = width;
    const h = Math.max(280, Math.round(w * 0.64));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== w * dpr || cv.height !== h * dpr) {
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.height = `${h}px`;
    }
    const left = 46;
    const right = 4;
    const pw = w - left - right;
    const pTop = 20;
    const pH = Math.round(h * 0.4);
    const tTop = pTop + pH + 32;
    const tH = h - tTop - 24;
    const xT = (m: number) => left + (pw * m) / lane.horizon;
    const ySize = (s: number) => tTop + tH * (1 - (Math.log10(Math.max(10, s)) - 1) / 5); // $10..$1M
    const MONO = `11px ${cssFont("--font-plex-mono", "ui-monospace, Menlo, monospace")}`;
    const SANS = `12px ${cssFont("--font-inter", "system-ui, sans-serif")}`;
    const unit = (m: number) =>
      lane.unit === "h" ? t("rs_unit_h", { n: (m / 60).toFixed(0) }) : t("rs_unit_min", { n: Math.round(m) });

    // Static axes and the market's own trades go to an offscreen cache, drawn
    // once and then only topped up with the trades revealed since last frame.
    const key = `${w}x${h}:${yMax}:${t("rs_axis_price")}`;
    let c = cache.current;
    if (!c || c.key !== key || prog < c.prog) {
      const off = document.createElement("canvas");
      off.width = cv.width;
      off.height = cv.height;
      const x = off.getContext("2d")!;
      x.scale(dpr, dpr);
      x.strokeStyle = C.grid;
      x.lineWidth = 1;
      x.fillStyle = C.meta;
      x.font = MONO;
      x.textAlign = "right";
      x.textBaseline = "middle";
      for (let i = 0; i <= 4; i++) {
        const v = (yMax * i) / 4;
        const y = pTop + pH * (1 - i / 4);
        x.beginPath();
        x.moveTo(left, y + 0.5);
        x.lineTo(w - right, y + 0.5);
        x.stroke();
        x.fillText("+" + (v / 100).toFixed(yMax >= 400 ? 0 : yMax >= 40 ? 1 : 2) + "%", left - 8, y);
      }
      for (const [s, lab] of [[100, "$100"], [1000, "$1k"], [10000, "$10k"], [100000, "$100k"], [1000000, "$1M"]] as const) {
        const y = ySize(s);
        x.beginPath();
        x.moveTo(left, y + 0.5);
        x.lineTo(w - right, y + 0.5);
        x.stroke();
        x.fillText(lab, left - 8, y);
      }
      x.font = SANS;
      x.textAlign = "left";
      x.textBaseline = "bottom";
      x.fillText(t("rs_axis_price"), left, pTop - 6);
      x.fillText(t("rs_axis_trades"), left, tTop - 6);
      x.save();
      x.setLineDash([4, 4]);
      x.strokeStyle = C.p99;
      x.beginPath();
      x.moveTo(left, ySize(P99) + 0.5);
      x.lineTo(w - right, ySize(P99) + 0.5);
      x.stroke();
      x.restore();
      x.font = MONO;
      x.textBaseline = "top";
      x.textAlign = "left";
      x.fillText("0", left, h - 16);
      x.textAlign = "center";
      x.fillText(unit(lane.horizon / 2), left + pw / 2, h - 16);
      x.textAlign = "right";
      x.fillText(unit(lane.horizon), w - right, h - 16);
      c = cache.current = { canvas: off, drawn: 0, prog, key };
    }
    const ox = c.canvas.getContext("2d")!;
    ox.fillStyle = C.organic;
    ox.globalAlpha = lane.kind === "canopy" ? 0.75 : 1;
    const r0 = lane.kind === "canopy" ? 1.05 : 1.6;
    while (c.drawn < lane.organic.length && lane.organic[c.drawn].t <= minute) {
      const o = lane.organic[c.drawn++];
      ox.beginPath();
      ox.arc(xT(o.t), ySize(o.s), r0, 0, Math.PI * 2);
      ox.fill();
    }
    ox.globalAlpha = 1;
    c.prog = prog;

    const ctx = cv.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(c.canvas, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // price paid
    const M = lane.path.length - 1;
    const jEnd = Math.floor(prog * M);
    const yP = (v: number) => pTop + pH * (1 - Math.max(0, Math.min(v, yMax)) / yMax);
    ctx.beginPath();
    for (let j = 0; j <= jEnd; j++) {
      const x = left + (pw * j) / M;
      const y = yP(lane.path[j]);
      if (j) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = "round";
    ctx.stroke();
    if (jEnd > 0) {
      ctx.lineTo(left + (pw * jEnd) / M, pTop + pH);
      ctx.lineTo(left, pTop + pH);
      ctx.closePath();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // analyst's view: each wallet's trades joined into one track
    if (view === "analyst") {
      const tracks = new Map<number, { t: number; s: number }[]>();
      for (const f of lane.fund) {
        if (f.t > minute) break;
        if (!tracks.has(f.w)) tracks.set(f.w, []);
        tracks.get(f.w)!.push(f);
      }
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      for (const [wi, fs] of tracks) {
        if (fs.length < 2) continue;
        ctx.beginPath();
        fs.forEach((f, i) => (i ? ctx.lineTo(xT(f.t), ySize(f.s)) : ctx.moveTo(xT(f.t), ySize(f.s))));
        ctx.strokeStyle = lane.kind === "canopy" ? walletColor(wi, "dark") : C.naive;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // the fund's trades
    const fr = lane.kind === "big" ? 7 : lane.kind === "diy" ? 4 : 2.1;
    const hide = view === "market";
    for (const f of lane.fund) {
      if (f.t > minute) break;
      const x = xT(f.t);
      const y = ySize(f.s);
      ctx.beginPath();
      ctx.arc(x, y, hide ? (lane.kind === "canopy" ? 1.05 : fr * 0.6 + 1) : fr, 0, Math.PI * 2);
      ctx.fillStyle = hide ? C.organic : lane.kind === "canopy" ? walletColor(f.w, "dark") : color;
      ctx.globalAlpha = hide && lane.kind === "canopy" ? 0.75 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (f.spotted) {
        const age = ((minute - f.t) / lane.horizon) * DURATION;
        const pulse = age < 700 ? age / 700 : 1;
        ctx.beginPath();
        ctx.arc(x, y, fr + 4 + (1 - pulse) * 14, 0, Math.PI * 2);
        ctx.strokeStyle = C.loss;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = pulse === 1 ? 0.7 : 1 - pulse * 0.3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // market maker's view: flow per wallet against the pool operator's limit
    if (view === "mm") {
      const bw = Math.min(170, pw * 0.5);
      const bh = 78;
      const bx = w - right - bw;
      const by = tTop + 4;
      ctx.fillStyle = "rgba(11,16,14,.92)";
      ctx.strokeStyle = "#262D29";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 8);
      ctx.fill();
      ctx.stroke();
      ctx.font = SANS;
      ctx.fillStyle = C.meta;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(t("rs_mm_panel"), bx + 10, by + 8);
      const cx0 = bx + 10;
      const cw = bw - 20;
      const cy0 = by + 28;
      const ch = bh - 38;
      const cap = MM_FLAG * 2;
      const ty = cy0 + ch - ch * (MM_FLAG / cap);
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = C.p99;
      ctx.beginPath();
      ctx.moveTo(cx0, ty + 0.5);
      ctx.lineTo(cx0 + cw, ty + 0.5);
      ctx.stroke();
      ctx.restore();
      const n = lane.kind === "canopy" ? WALLETS : 1;
      const slot = cw / (lane.kind === "canopy" ? WALLETS : 4);
      let top = 0;
      for (let wi = 0; wi < n; wi++) {
        const v = st.propByWallet.get(wi) ?? 0;
        top = Math.max(top, v);
        const hgt = ch * Math.min(1, v / cap);
        ctx.fillStyle = v > MM_FLAG ? C.loss : lane.kind === "canopy" ? walletColor(wi, "dark") : C.naive;
        ctx.fillRect(cx0 + wi * slot + 1, cy0 + ch - hgt, Math.max(2, slot - 3), hgt);
      }
      if (top > cap) {
        ctx.font = MONO;
        ctx.textAlign = "right";
        ctx.fillText("×" + (top / MM_FLAG).toFixed(1), cx0 + cw, by + 8);
      }
    }

    if (prog < 1) {
      ctx.strokeStyle = C.cursor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xT(minute), pTop);
      ctx.lineTo(xT(minute), tTop + tH);
      ctx.stroke();
    }
  });

  const flagged = view === "mm" && st.flagged > 0;
  const noticed = view !== "mm" && st.spotted > 0;
  const status = view === "mm"
    ? (flagged ? t("rs_status_flagged") : st.trades ? t("rs_status_retail") : t("rs_status_waiting"))
    : (noticed ? t("rs_status_noticed", { n: st.spotted }) : st.trades ? t("rs_status_blending") : t("rs_status_waiting"));
  const statusClass = flagged || noticed ? "spotted" : st.trades ? "quiet" : "";
  const time =
    lane.unit === "h" && minute >= 60
      ? t("rs_unit_h", { n: (minute / 60).toFixed(minute < 600 ? 1 : 0) })
      : t("rs_unit_min", { n: Math.round(minute) });

  return (
    <div className="rs-lane">
      <div className="rs-lane-head">
        <div>
          <h2 className="rs-lane-name">{name}</h2>
          <p className="rs-lane-sub">{sub}</p>
        </div>
        <span className={`rs-status ${statusClass}`}>{status}</span>
      </div>
      <canvas ref={canvasRef} role="img" aria-label={t("rs_canvas_label", { name })} />
      <div className="rs-stats">
        <div className="rs-stat">
          <span className="k">{t("rs_stat_bought")}</span>
          <span className="v">{usd(st.bought)}</span>
          <div className="rs-meter"><i style={{ width: share(st.bought, ORDER), backgroundColor: color }} /></div>
        </div>
        <div className="rs-stat">
          <span className="k">{t("rs_stat_cost")}</span>
          <span className="v">{usd(st.extra)}</span>
          <span className="s">{pct(st.avgBps)}</span>
        </div>
        <div className="rs-stat">
          <span className="k">{t("rs_stat_noticed")}</span>
          <span className="v">{st.spotted}</span>
          <span className="s">{st.trades === 1 ? t("rs_stat_of_one") : t("rs_stat_of_trades", { n: st.trades })}</span>
        </div>
        <div className="rs-stat">
          <span className="k">{t("rs_stat_wallets")}</span>
          <span className="v">{st.wallets}</span>
          <span className="s">{t("rs_stat_fund_owned")}</span>
        </div>
        <div className="rs-stat">
          <span className="k">{t("rs_stat_time")}</span>
          <span className="v">{time}</span>
          <span className="s">{t("rs_stat_elapsed")}</span>
        </div>
      </div>
    </div>
  );
}

// ── Wallet pool tiles ───────────────────────────────────────────────────────

function WalletTiles({ lane, prog, playing, t }: { lane: LaneData; prog: number; playing: boolean; t: T }) {
  const prev = useRef<number[]>(new Array(WALLETS).fill(0));
  const minute = prog * lane.horizon;
  const max = useMemo(() => {
    const tot = new Array(WALLETS).fill(0);
    for (const f of lane.fund) tot[f.w] += f.s;
    return Math.max(...tot);
  }, [lane]);
  const sum = new Array(WALLETS).fill(0);
  const cnt = new Array(WALLETS).fill(0);
  for (const f of lane.fund) {
    if (f.t > minute) break;
    sum[f.w] += f.s;
    cnt[f.w]++;
  }
  const hit = cnt.map((c, w) => playing && c > prev.current[w]);
  useEffect(() => {
    prev.current = cnt;
  });

  return (
    <div className="rs-wallets">
      {sum.map((v, w) => (
        <div className={`rs-wallet${hit[w] ? " hit" : ""}`} key={w}>
          <span className="wn">
            <i className="rs-dot" style={{ backgroundColor: walletColor(w, "light") }} />
            {t("rs_wallet_name", { n: String(w + 1).padStart(2, "0") })}
          </span>
          <span className="wv">{usd(v)}</span>
          <span className="wt">{cnt[w] === 1 ? t("rs_wallet_trade_one") : t("rs_wallet_trades", { n: cnt[w] })}</span>
          <div className="rs-meter"><i style={{ width: share(v, max), backgroundColor: walletColor(w, "light") }} /></div>
        </div>
      ))}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

const NOTE: Record<View, TranslationKey> = { market: "rs_note_market", analyst: "rs_note_analyst", mm: "rs_note_mm" };
const VIEW_LABEL: Record<View, TranslationKey> = { market: "rs_view_market", analyst: "rs_view_analyst", mm: "rs_view_mm" };
const LANE_COPY: Record<LaneKind, [TranslationKey, TranslationKey]> = {
  big: ["rs_lane_big", "rs_lane_big_sub"],
  diy: ["rs_lane_diy", "rs_lane_diy_sub"],
  canopy: ["rs_lane_canopy", "rs_lane_canopy_sub"],
};

export function ResearchPage() {
  const t = useT();
  const lanes = useMemo(() => ({ big: buildLane("big"), diy: buildLane("diy"), canopy: buildLane("canopy") }), []);
  const [mode, setMode] = useState<"big" | "diy">("big");
  const [view, setView] = useState<View>("analyst");
  const [prog, setProg] = useState(1); // the finished comparison is the resting state
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProg(1);
      return;
    }
    const t0 = performance.now();
    setPlaying(true);
    setProg(0);
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION);
      setProg(p);
      if (p < 1) raf.current = requestAnimationFrame(frame);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(play, 700);
    return () => {
      window.clearTimeout(id);
      cancelAnimationFrame(raf.current);
    };
  }, [play]);

  const other = lanes[mode];
  const yMax = useMemo(() => {
    let m = 0;
    for (const d of [other, lanes.canopy]) for (const v of d.path) m = Math.max(m, v);
    // tops that split into four even steps, so every tick label is a round number
    return [10, 20, 40, 80, 100, 200, 400, 800, 1000].find((n) => n >= m * 1.08) ?? m;
  }, [other, lanes]);

  const saved = statsAt(other, other.horizon).extra - statsAt(lanes.canopy, lanes.canopy.horizon).extra;
  const pickMode = (m: "big" | "diy") => {
    setMode(m);
    play();
  };

  return (
    <main className="lp rs">
      <div className="wrap">
        <nav className="rs-nav">
          <Link href="/" aria-label="Canopy">
            <Wordmark height={24} className="text-[#0B1410]" />
          </Link>
          <div className="rs-nav-right">
            <LanguageSwitcher />
            <span className="disc">{t("rs_nav_chip")}</span>
          </div>
        </nav>

        <section className="rs-sec">
          <div className="sec-head">
            <span className="eyebrow">
              <Rich text={t("rs_hero_eyebrow")} vars={{ amount: usd(ORDER).replace(",000", "k") }} />
            </span>
            <h1 className="h1">
              {t("rs_hero_h1")}
              <span>{t("rs_hero_h2")}</span>
            </h1>
          </div>

          <div className="rs-controls">
            <div className="rs-seg" role="group" aria-label={t("rs_cmp_label")}>
              {(["big", "diy"] as const).map((m) => (
                <button type="button" key={m} aria-pressed={mode === m} onClick={() => pickMode(m)}>
                  {t(m === "big" ? "rs_cmp_big" : "rs_cmp_diy")}
                </button>
              ))}
            </div>
            <div className="rs-seg" role="group" aria-label={t("rs_view_label")}>
              {(["market", "analyst", "mm"] as const).map((v) => (
                <button type="button" key={v} aria-pressed={view === v} onClick={() => setView(v)}>
                  {t(VIEW_LABEL[v])}
                </button>
              ))}
            </div>
            <button type="button" className="pill dark" onClick={play}>
              <span>{playing ? t("rs_playing") : prog >= 1 ? t("rs_replay") : t("rs_play")}</span>
              <svg viewBox="0 0 12 12" aria-hidden="true" fill="currentColor"><path d="M2 1l9 5-9 5z" /></svg>
            </button>
          </div>
          <p className="rs-viewnote">{t(NOTE[view])}</p>

          <div className="rs-demo">
            <div className="rs-split">
              {([mode, "canopy"] as const).map((k) => (
                <Lane
                  key={k}
                  lane={lanes[k]}
                  name={t(LANE_COPY[k][0])}
                  sub={t(LANE_COPY[k][1])}
                  prog={prog}
                  view={view}
                  yMax={yMax}
                  t={t}
                />
              ))}
            </div>
          </div>

          <p className="rs-verdict">
            {prog >= 1 ? (
              <Rich
                text={t(mode === "big" ? "rs_verdict_big" : "rs_verdict_diy")}
                vars={{ order: "$500k", saved: usd(saved), hours: String(CANOPY_HOURS), minutes: "45" }}
              />
            ) : (
              t("rs_verdict_playing")
            )}
          </p>

          <div className="rs-legend">
            <span><i className="rs-dot" style={{ backgroundColor: "#C9D1CD" }} />{t("rs_legend_other")}</span>
            <span><i className="rs-dot" style={{ backgroundColor: "var(--ink)" }} />{t("rs_legend_naive")}</span>
            <span><i className="rs-dot" style={{ backgroundColor: "var(--green-deep)" }} />{t("rs_legend_canopy")}</span>
            <span><i className="rs-ring" />{t("rs_legend_noticed")}</span>
            <span><i className="rs-dash" />{t("rs_legend_p99")}</span>
          </div>
        </section>

        <section className="rs-sec" aria-labelledby="rs-pool-title">
          <div className="sec-head">
            <span className="eyebrow">{t("rs_pool_eyebrow")}</span>
            <h2 className="h2" id="rs-pool-title">
              {t("rs_pool_h1")}
              <span>{t("rs_pool_h2")}</span>
            </h2>
            <p className="lede">{t("rs_pool_lede")}</p>
          </div>

          <div className="rs-flowstrip">
            {(
              [
                ["rs_flow_custodian", "rs_flow_custodian_sub"],
                ["rs_flow_manager", "rs_flow_manager_sub"],
                ["rs_flow_wallets", "rs_flow_wallets_sub"],
                ["rs_flow_jupiter", "rs_flow_jupiter_sub"],
                ["rs_flow_market", "rs_flow_market_sub"],
              ] as const
            ).map(([k, sub], i) => (
              <span key={k} style={{ display: "contents" }}>
                {i > 0 && <span className="rs-arrow" aria-hidden="true">→</span>}
                <div className={`rs-flownode${k === "rs_flow_manager" ? " on" : ""}`}>
                  {t(k)}
                  <small>{t(sub)}</small>
                </div>
              </span>
            ))}
          </div>

          <WalletTiles lane={lanes.canopy} prog={prog} playing={playing} t={t} />

          <div className="rs-row">
            {(
              [
                ["rs_job_assign", "rs_job_assign_body"],
                ["rs_job_fund", "rs_job_fund_body"],
                ["rs_job_fees", "rs_job_fees_body"],
                ["rs_job_rotate", "rs_job_rotate_body"],
                ["rs_job_links", "rs_job_links_body"],
                ["rs_job_record", "rs_job_record_body"],
              ] as const
            ).map(([h, b]) => (
              <div key={h}>
                <h3>{t(h)}</h3>
                <p>{t(b)}</p>
              </div>
            ))}
          </div>
          <p className="rs-footnote">
            <b>{t("rs_pool_note_title")}</b> {t("rs_pool_note")}
          </p>
        </section>

        <section className="rs-sec" aria-labelledby="rs-venue-title">
          <div className="sec-head">
            <span className="eyebrow">{t("rs_venue_eyebrow")}</span>
            <h2 className="h2" id="rs-venue-title">
              {t("rs_venue_h1")}
              <span>{t("rs_venue_h2")}</span>
            </h2>
            <p className="lede">{t("rs_venue_lede")}</p>
          </div>
          <div className="rs-row four">
            <div>
              <h3>{t("rs_venue_public")}</h3>
              <p>{t("rs_venue_public_body")}</p>
            </div>
            <div>
              <h3>{t("rs_venue_mm")}</h3>
              <p>{t("rs_venue_mm_body")}</p>
              <div className="rs-figure">
                <Rich text={t("rs_venue_mm_fig")} vars={{ volume: "$1.16M", pool: "$67k" }} />
                <small>{t("rs_venue_mm_fig_sub")}</small>
              </div>
            </div>
            <div>
              <h3>{t("rs_venue_book")}</h3>
              <p>{t("rs_venue_book_body")}</p>
            </div>
            <div>
              <h3>{t("rs_venue_rfq")}</h3>
              <p>{t("rs_venue_rfq_body")}</p>
            </div>
          </div>
          <p className="rs-footnote">
            <b>{t("rs_venue_note_title")}</b> {t("rs_venue_note")}
          </p>
        </section>
      </div>
    </main>
  );
}
