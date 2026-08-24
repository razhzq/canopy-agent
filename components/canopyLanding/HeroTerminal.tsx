"use client";

import { useEffect, useRef } from "react";
import { drawSpark } from "./sparkline";
import { useT } from "@/lib/i18n";

interface Props {
  onLogin: () => void;
}

export function HeroTerminal({ onLogin }: Props) {
  const t = useT();
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const fillRef = useRef<HTMLElement>(null);
  const nowRef = useRef<HTMLSpanElement>(null);
  const checkRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = sparkRef.current;
    const paint = () => canvas && drawSpark(canvas, 7, true);
    paint();
    window.addEventListener("resize", paint);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let mInt: ReturnType<typeof setInterval> | undefined;
    let cInt: ReturnType<typeof setInterval> | undefined;
    if (!reduce) {
      let pct = 45;
      let dir = 1;
      let secs = 18;
      mInt = setInterval(() => {
        pct += dir * (Math.random() * 3 + 0.5);
        if (pct > 62) dir = -1;
        if (pct < 34) dir = 1;
        if (fillRef.current) fillRef.current.style.width = pct.toFixed(1) + "%";
        // Written through the dictionary rather than concatenated: the unit
        // and the word land on opposite sides of the number in Chinese.
        if (nowRef.current) {
          nowRef.current.textContent = t("ld_scale_now", {
            pct: ((pct / 100) * 4).toFixed(1),
          });
        }
      }, 1400);
      cInt = setInterval(() => {
        secs -= 1;
        if (secs < 0) secs = 29;
        if (checkRef.current) {
          checkRef.current.textContent = t("ld_checked", { ago: 30 - secs, next: secs });
        }
      }, 1000);
    }

    return () => {
      window.removeEventListener("resize", paint);
      if (mInt) clearInterval(mInt);
      if (cInt) clearInterval(cInt);
    };
    // `t` is in the list because the two intervals above write text: switching
    // language mid-visit must restart them rather than leave the panel
    // ticking in the language it started in.
  }, [t]);

  return (
    <header className="hero" id="top">
      <div className="aurora">
        <b className="b1" /><b className="b2" /><b className="b3" /><b className="b4" />
      </div>
      <div className="wrap">
        <div className="hero-a">
          <div>
            <span className="eyebrow">{t("ld_hero_eyebrow")}</span>
            <h1 className="h1">
              {t("ld_hero_h1_a")}
              <span className="mint">{t("ld_hero_h1_mint")}</span>
            </h1>
            {/* The <b> emphasis inside the lede is gone: it wrapped three
                phrases that land in different places in Chinese, and a tag
                cannot travel with them. The sentence carries itself. */}
            <p className="lede">{t("ld_hero_lede")}</p>
            <div className="hero-cta">
              <button className="btn btn-primary" onClick={onLogin}>
                {t("ld_hero_cta")} <span className="arw">→</span>
              </button>
              <a href="#market" className="btn btn-ghost">
                {t("ld_hero_browse")}
              </a>
            </div>
            <div className="trust">
              <span>
                <i className="dot" /> {t("ld_trust_noncustodial")}
              </span>
              <span>
                <i className="dot" /> {t("ld_trust_paper")}
              </span>
              <span>
                <i className="dot" /> {t("ld_trust_routing")}
              </span>
            </div>
          </div>

          <div className="appwin">
            <div className="win-bar">
              <span className="dots"><i /><i /><i /></span>
              <span className="win-tab">{t("ld_win_tab")}</span>
            </div>
            <div className="card">
              <div className="card-head">
                <div className="lft">
                  <span className="tkr-badge">AAPLx</span>
                  <div>
                    <div className="agent-name">{t("ld_demo_agent")}</div>
                    <div className="agent-sub">{t("ld_demo_sub")}</div>
                  </div>
                </div>
                <span className="hot-pill">{t("ld_demo_hot")}</span>
              </div>
              <div className="spark-wrap">
                <canvas ref={sparkRef} className="heroSpark" height={120} />
              </div>
              <div className="card-metrics">
                <div className="metric"><div className="k">{t("ld_metric_return_30d")}</div><div className="v up">+24.1%</div></div>
                <div className="metric"><div className="k">{t("ld_metric_win_rate")}</div><div className="v">64%</div></div>
                <div className="metric"><div className="k">{t("ld_metric_capital")}</div><div className="v">$182k</div></div>
              </div>
              <div className="watch">
                <div className="watch-top">
                  <span className="watch-lbl">{t("ld_watching_now")}</span>
                  <span className="live-pill">
                    <i className="dot" /> {t("ld_live")}
                  </span>
                </div>
                <div className="watch-cond">
                  {t("ld_watch_cond_a")}
                  <span className="mint">{t("ld_watch_cond_mint")}</span>
                  {t("ld_watch_cond_b")}
                </div>
                <div className="meter"><i ref={fillRef} /></div>
                <div className="watch-scale">
                  <span>{t("ld_scale_zero")}</span>
                  <span ref={nowRef}>{t("ld_scale_now", { pct: "1.8" })}</span>
                  <span className="fire">{t("ld_scale_fires")}</span>
                </div>
                <div className="watch-foot">
                  <i className="dot" />
                  <span ref={checkRef}>{t("ld_checked", { ago: 12, next: 18 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
