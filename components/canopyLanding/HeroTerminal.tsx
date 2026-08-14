"use client";

import { useEffect, useRef } from "react";
import { drawSpark } from "./sparkline";

interface Props {
  onLogin: () => void;
}

export function HeroTerminal({ onLogin }: Props) {
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
        if (nowRef.current) nowRef.current.textContent = "−" + ((pct / 100) * 4).toFixed(1) + "% now";
      }, 1400);
      cInt = setInterval(() => {
        secs -= 1;
        if (secs < 0) secs = 29;
        if (checkRef.current)
          checkRef.current.textContent = `checked ${30 - secs}s ago · next check in ${secs}s`;
      }, 1000);
    }

    return () => {
      window.removeEventListener("resize", paint);
      if (mInt) clearInterval(mInt);
      if (cInt) clearInterval(cInt);
    };
  }, []);

  return (
    <header className="hero" id="top">
      <div className="aurora">
        <b className="b1" /><b className="b2" /><b className="b3" /><b className="b4" />
      </div>
      <div className="wrap">
        <div className="hero-a">
          <div>
            <span className="eyebrow">Tokenized markets · open 24/7</span>
            <h1 className="h1">
              A market of trading agents that <span className="mint">never sleep.</span>
            </h1>
            <p className="lede">
              Build an agent on tokenized stocks, gold and <b>hundreds</b> of Solana tokens in
              <b> two minutes</b>. It trades the <b>24/7</b> market for you — no closing bell,
              non-custodial, best price on every trade.
            </p>
            <div className="hero-cta">
              <button className="btn btn-primary" onClick={onLogin}>
                Build your first agent <span className="arw">→</span>
              </button>
              <a href="#market" className="btn btn-ghost">Browse the marketplace</a>
            </div>
            <div className="trust">
              <span><i className="dot" /> Non-custodial</span>
              <span><i className="dot" /> Paper test free &amp; unlimited</span>
              <span><i className="dot" /> Routed for best price</span>
            </div>
          </div>

          <div className="appwin">
            <div className="win-bar">
              <span className="dots"><i /><i /><i /></span>
              <span className="win-tab">canopy / marketplace · live</span>
            </div>
            <div className="card">
              <div className="card-head">
                <div className="lft">
                  <span className="tkr-badge">AAPLx</span>
                  <div>
                    <div className="agent-name">AAPLx Dip Catcher</div>
                    <div className="agent-sub">AAPLx/USDC · routed via Jupiter · 94 days live</div>
                  </div>
                </div>
                <span className="hot-pill">Hot</span>
              </div>
              <div className="spark-wrap">
                <canvas ref={sparkRef} className="heroSpark" height={120} />
              </div>
              <div className="card-metrics">
                <div className="metric"><div className="k">Return · 30d</div><div className="v up">+24.1%</div></div>
                <div className="metric"><div className="k">Win rate</div><div className="v">64%</div></div>
                <div className="metric"><div className="k">Capital</div><div className="v">$182k</div></div>
              </div>
              <div className="watch">
                <div className="watch-top">
                  <span className="watch-lbl">Watching now</span>
                  <span className="live-pill"><i className="dot" /> Live</span>
                </div>
                <div className="watch-cond">AAPLx drops <span className="mint">4%+</span> in a session</div>
                <div className="meter"><i ref={fillRef} /></div>
                <div className="watch-scale">
                  <span>0%</span>
                  <span ref={nowRef}>−1.8% now</span>
                  <span className="fire">−4.0% fires</span>
                </div>
                <div className="watch-foot">
                  <i className="dot" />
                  <span ref={checkRef}>checked 12s ago · next check in 18s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
