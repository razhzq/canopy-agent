"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeftRight, Check, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";

/**
 * Three prompts, one flow: prompt → agent thread → market card. Cycles on a
 * timer; picking a number pins it. Every row, the sparkline and the toast
 * re-animate on each change because the whole flow remounts under a new key.
 *
 * The numbers are illustrative. The shape — a rule, the checks it ran, the
 * fill it produced — is exactly what the product shows.
 */

type Scenario = {
  k: "p1" | "p2" | "p3";
  ticker: string;
  price: string;
  delta: string;
  up: boolean;
  tab: TranslationKey;
  speed: string;
  points: number[]; // 0..1, left to right
  meta: [TranslationKey, TranslationKey, string, string];
};

const SCENARIOS: Scenario[] = [
  {
    k: "p1",
    ticker: "SOL",
    price: "$207.40",
    delta: "−$11.62 (5.3%)",
    up: false,
    tab: "lp_demo_tab_price",
    speed: "0.4s",
    points: [0.82, 0.78, 0.86, 0.74, 0.7, 0.76, 0.62, 0.66, 0.5, 0.44, 0.52, 0.36, 0.3, 0.34, 0.2],
    meta: ["lp_demo_ongoing_15s", "lp_demo_now", "3:15PM", "3:15PM"],
  },
  {
    k: "p2",
    ticker: "BONK",
    price: "$0.0000312",
    delta: "+46.2%",
    up: true,
    tab: "lp_demo_tab_volume",
    speed: "0.6s",
    points: [0.18, 0.22, 0.2, 0.28, 0.24, 0.36, 0.42, 0.38, 0.55, 0.62, 0.58, 0.74, 0.8, 0.76, 0.9],
    meta: ["lp_demo_ongoing_15s", "lp_demo_now", "11:02AM", "11:02AM"],
  },
  {
    k: "p3",
    ticker: "ETH-PERP",
    price: "$3,412.80",
    delta: "+2.1%",
    up: true,
    tab: "lp_demo_tab_funding",
    speed: "0.3s",
    points: [0.4, 0.44, 0.38, 0.46, 0.42, 0.5, 0.46, 0.56, 0.52, 0.6, 0.66, 0.62, 0.72, 0.7, 0.8],
    meta: ["lp_demo_ongoing", "lp_demo_now", "9:40AM", "9:40AM"],
  },
];

const HOLD_MS = 7000;

// The market card's tab strip: the scenario's own tab first, then two others.
const TABS: TranslationKey[] = ["lp_demo_tab_price", "lp_demo_tab_volume", "lp_demo_tab_funding"];

export function HeroDemo() {
  const t = useT();
  const [i, setI] = useState(0);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (pinned) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % SCENARIOS.length), HOLD_MS);
    return () => clearInterval(id);
  }, [pinned]);

  const s = SCENARIOS[i];
  const key = (suffix: string) => `lp_demo_${s.k}_${suffix}` as TranslationKey;

  // Sparkline geometry: 260×70 box, a little headroom top and bottom.
  const W = 260, H = 70;
  const pts = s.points.map((v, n) => [
    (n / (s.points.length - 1)) * W,
    H - 6 - v * (H - 12),
  ]);
  const last = pts[pts.length - 1];
  const stroke = s.up ? "#5ED3B3" : "#E5484D";

  return (
    <div className="demo" aria-label="How a Canopy agent runs">
      <div className="tabs" role="tablist">
        <ArrowLeftRight aria-hidden />
        <span>{t("lp_demo_prompts")}</span>
        {SCENARIOS.map((sc, n) => (
          <button
            key={sc.k}
            role="tab"
            aria-selected={n === i}
            onClick={() => {
              setI(n);
              setPinned(true);
            }}
          >
            0{n + 1}
          </button>
        ))}
      </div>

      <div className="flow" key={s.k}>
        <div className="node p">
          <div className="card">
            <div>{t(key("prompt"))}</div>
            <span className="go" aria-hidden>
              <ArrowRight />
            </span>
          </div>
        </div>

        <span className="link" aria-hidden />

        <div className="node a">
          <div className="card">
            <span className="chip">
              <Sparkles aria-hidden />
              {t("lp_demo_agent")}
            </span>
            <div className="ahead">
              <span className="aname">{t(key("name"))}</span>
              <span className="live">
                {t("lp_demo_active")} <i aria-hidden />
              </span>
            </div>
            <div className="rows">
              {(["s1", "s2", "s3", "s4"] as const).map((step, n) => {
                const m = s.meta[n];
                const metaText = n < 2 ? t(m as TranslationKey) : m;
                return (
                  <div className="row" key={step}>
                    <span className="ck" aria-hidden>
                      <Check />
                    </span>
                    <b>{t(key(step))}</b>
                    <small>{metaText}</small>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <span className="link" aria-hidden />

        <div className="node m">
          <div className="card">
            <div className="mname">{s.ticker}</div>
            <div className="mtabs">
              {[s.tab, ...TABS.filter((tab) => tab !== s.tab)].map((tab) => (
                  <span key={tab} className={tab === s.tab ? "on" : undefined}>
                    {t(tab)}
                  </span>
                ))}
            </div>
            <div className="price">{s.price}</div>
            <div className={`delta ${s.up ? "up" : "down"}`}>
              {s.up ? <TrendingUp size={13} aria-hidden /> : <TrendingDown size={13} aria-hidden />}
              {s.delta} <span>{t("lp_demo_today")}</span>
            </div>
            <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
              <polyline pathLength={1} stroke={stroke} points={pts.map((p) => p.join(",")).join(" ")} />
              <circle cx={last[0]} cy={last[1]} r={3} fill={stroke} />
            </svg>
          </div>
          <div className="toast">
            <i aria-hidden>
              <ArrowLeftRight />
            </i>
            <div>
              <b>{t("lp_demo_filled")}</b>
              <small>
                {t("lp_demo_speed")}: {s.speed}
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
