"use client";

import { useEffect, useRef } from "react";
import { AGENTS } from "./data";
import { drawSpark } from "./sparkline";

interface Props {
  onLogin: () => void;
}

function fmt(n: number, dec: number) {
  return dec ? n.toFixed(dec) : Math.round(n).toLocaleString("en-US");
}

export function CanopyBody({ onLogin }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // marketplace sparklines
    const canvases = Array.from(root.querySelectorAll<HTMLCanvasElement>("canvas[data-seed]"));
    const paintAll = () =>
      canvases.forEach((c) =>
        drawSpark(c, Number(c.dataset.seed), c.dataset.up === "1")
      );
    paintAll();
    window.addEventListener("resize", paintAll);

    // reveal on scroll
    const revealEls = Array.from(root.querySelectorAll<HTMLElement>(".rv"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.14 }
    );
    revealEls.forEach((el) => io.observe(el));

    // count-up stats
    let statsFired = false;
    const countEls = Array.from(root.querySelectorAll<HTMLElement>("[data-count]"));
    const runCount = (el: HTMLElement) => {
      const target = parseFloat(el.dataset.count || "0");
      const dec = parseInt(el.dataset.dec || "0", 10);
      if (reduce) {
        el.textContent = fmt(target, dec);
        return;
      }
      let start: number | null = null;
      const dur = 1400;
      const step = (t: number) => {
        if (start === null) start = t;
        const p = Math.min((t - start) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * e, dec);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const statsEl = root.querySelector(".stats");
    const sio = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting && !statsFired) {
            statsFired = true;
            countEls.forEach(runCount);
          }
        });
      },
      { threshold: 0.3 }
    );
    if (statsEl) sio.observe(statsEl);

    return () => {
      window.removeEventListener("resize", paintAll);
      io.disconnect();
      sio.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef}>
      {/* statement + stats */}
      <section className="sec" style={{ paddingBottom: 0 }}>
        <div className="wrap statement rv">
          <span className="eyebrow center">The backbone of a 24/7 market</span>
          <h2 className="sec-title">One marketplace. <span className="mint">Always open.</span></h2>
        </div>
      </section>
      <div className="stats" style={{ marginTop: 44 }}>
        <div className="wrap">
          <div className="stats-in">
            <div className="stat"><div className="k">Live agents</div><div className="v tnum" data-count="318">0</div></div>
            <div className="stat"><div className="k">Capital deployed</div><div className="v"><em>$</em><span className="tnum" data-count="4.2" data-dec="1">0</span><em>M</em></div></div>
            <div className="stat"><div className="k">Trades · 30d</div><div className="v tnum" data-count="281640">0</div></div>
            <div className="stat"><div className="k">Positions open</div><div className="v tnum" data-count="204">0</div></div>
          </div>
        </div>
      </div>

      {/* bento */}
      <section className="sec" id="why">
        <div className="wrap">
          <div className="sec-head rv">
            <span className="eyebrow">What you&apos;re actually getting</span>
            <h2 className="sec-title">You write the rule. It does <span className="mint">the waiting.</span></h2>
          </div>
          <div className="bento">
            <div className="cell feature tall rv">
              <span className="ck">Live telemetry</span>
              <h4>It watches the market tick by tick — and only acts when your rule fires.</h4>
              <p>Median 3.2s between checks, 24/7. Every check is recorded, whether it trades or not.</p>
              <div className="grow" />
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-2)" }}>AAPLx drops 4%+ in a session</div>
              <div className="mini-meter"><i /></div>
              <div className="mini-scale"><span>0%</span><span>−1.8% now</span><span className="fire">−4.0% fires</span></div>
              <div className="glowmesh" />
            </div>
            <div className="cell wide rv">
              <span className="ck">Always on</span>
              <h4>Real markets, no closing bell.</h4>
              <p>Tokenized equities, an index, gold — and the Solana spot market. All trading around the clock, on-chain.</p>
              <div className="big-num tnum">24<em>/</em>7</div>
            </div>
            <div className="cell rv">
              <span className="ck">Your keys</span>
              <h4>Non-custodial.</h4>
              <p>Canopy never holds your funds.</p>
            </div>
            <div className="cell rv">
              <span className="ck">The proof only</span>
              <h4>Public record, private strategy.</h4>
              <p>Performance is public. The recipe is not.</p>
            </div>
            <div className="cell wide rv">
              <span className="ck">Best execution</span>
              <h4>Best price on every trade.</h4>
              <p>Auto routes across every live venue and picks up new ones as they integrate — checked per trade.</p>
              <div className="big-num tnum">0.02<em>%</em> <span style={{ fontSize: 14, color: "var(--text-3)", fontFamily: "var(--mono)" }}>low venue fee</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* build stepper */}
      <section className="sec" id="build" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap">
          <div className="sec-head rv">
            <span className="eyebrow">The build</span>
            <h2 className="sec-title">Four screens. Then it <span className="mint">runs itself.</span></h2>
            <p className="sec-sub">No code, no back-testing homework. Pick a market, decide how it routes, prove it on live data for free, and hit go. Most people are paper-testing inside a minute.</p>
          </div>
          <div className="steps rv">
            <div className="draft"><i /> draft · autosaved</div>
            <div className="steps-track">
              <div className="fstep">
                <div className="node">01</div>
                <h4>Assign</h4>
                <p>Pick one market or several. Fourteen tokenized stocks and commodities, or hundreds of Solana tokens — all open 24/7.</p>
                <span className="tag">AAPLx/USDC</span>
              </div>
              <div className="fstep">
                <div className="node">02</div>
                <h4>Route</h4>
                <p>Let Auto shop every venue per trade, or pin it to one DEX and leave it there.</p>
                <span className="tag">Auto <b>·</b> Canopy + Jupiter</span>
              </div>
              <div className="fstep">
                <div className="node">03</div>
                <h4>Paper test</h4>
                <p>Your exact rules against live venue prices. No money down, no clock, no limit.</p>
                <span className="tag">Free <b>·</b> unlimited</span>
              </div>
              <div className="fstep pending">
                <div className="node">04</div>
                <h4>Go live</h4>
                <p>Everything&apos;s still editable. Confirm, and it trades while you get on with your day.</p>
                <span className="tag">$10 first month</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* thesis */}
      <section className="sec" id="record" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap thesis">
          <div className="rv">
            <span className="eyebrow">The proof, not the recipe</span>
            <p className="quote" style={{ marginTop: 20 }}>
              Performance is <span className="mint">public.</span><br />The strategy stays <span className="mint">yours.</span>
            </p>
            <p className="qsub">Every agent publishes a live track record — return, win rate, drawdown, uptime. Entry logic and limits never leave the owner. Nothing to copy, and nothing of yours to be copied.</p>
            <div className="hero-cta"><a href="#market" className="btn btn-ghost">See the leaderboard <span className="arw">→</span></a></div>
          </div>
          <div className="record rv">
            <div className="rhead">
              <div className="lft" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="tkr-badge">AAPLx</span>
                <div>
                  <div className="agent-name" style={{ fontSize: 14 }}>AAPLx Dip Catcher</div>
                  <div className="agent-sub">Public information</div>
                </div>
              </div>
              <span className="live-pill"><i className="dot" /> Live · 94d</span>
            </div>
            <div className="rec-grid">
              <div className="rec-cell"><div className="k">Return · 30d</div><div className="v up">+24.1%</div></div>
              <div className="rec-cell"><div className="k">Win rate</div><div className="v">64%</div></div>
              <div className="rec-cell"><div className="k">Max drawdown</div><div className="v down">−7.9%</div></div>
              <div className="rec-cell"><div className="k">Uptime</div><div className="v">99.98%</div></div>
            </div>
            <div className="locked">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div>
                <div className="lk-t">Strategy rules &amp; limits — private</div>
                <div className="lk-s">Entry logic, sizing and stops stay with the owner.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* assets */}
      <section className="sec" id="assets" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap">
          <div className="sec-head rv">
            <span className="eyebrow">What you can trade</span>
            <h2 className="sec-title">Wall Street&apos;s assets, <span className="mint">on crypto&apos;s clock.</span></h2>
            <p className="sec-sub">Apple, gold and the S&amp;P, tokenized on-chain — beside the Solana tokens they trade alongside. Your agent doesn&apos;t wait for New York to ring the bell.</p>
          </div>
          <div className="classbar rv">
            {/* FIVE, because .classbar is `repeat(5,1fr)` — a fourth card leaves
                an empty column rather than re-flowing. The fifth used to be
                Treasuries, which had no tradable asset behind it; crypto splits
                cleanly in two instead, and the split is real — the universe
                already tiers tokens by whether an issuer vouches for them. */}
            <div className="cls"><div className="ic">Equities</div><h5>Single stocks</h5><p>AAPLx · TSLAx<br />NVDAx · MSFTx</p></div>
            <div className="cls"><div className="ic">Indices</div><h5>The whole tape</h5><p>SPYx</p></div>
            <div className="cls"><div className="ic">Commodities</div><h5>Hard assets</h5><p>PAXG · XAUt0<br />tokenized gold</p></div>
            <div className="cls"><div className="ic">Majors</div><h5>Blue-chip crypto</h5><p>SOL · JitoSOL<br />WBTC · ETH</p></div>
            <div className="cls"><div className="ic">Long tail</div><h5>The rest of Solana</h5><p>BONK · JUP · WIF<br />and hundreds more</p></div>
          </div>
        </div>
      </section>

      {/* marketplace */}
      <section className="sec" id="market" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap">
          <div className="sec-head rv">
            <span className="eyebrow">The marketplace · 146 listed agents</span>
            <h2 className="sec-title">Track records, ranked. <span className="mint">Nothing else.</span></h2>
            <p className="sec-sub">Browse live agents by return, capital and age. Everything you see is performance — never a strategy.</p>
          </div>
          <div className="mkt">
            {AGENTS.map((a) => (
              <div className="acard rv" key={a.name}>
                <div className="acard-top">
                  <div>
                    <div className="nm">{a.name}</div>
                    <div className="mk">{a.market}</div>
                  </div>
                  {a.flag && <span className={`flag ${a.flag}`}>{a.flagLabel}</span>}
                </div>
                <canvas height={44} data-seed={a.seed} data-up={a.up ? "1" : "0"} />
                <div className="acard-foot">
                  <div className="col"><span className="cl">Return 30d</span><span className={a.up ? "up" : "down"}>{a.ret}</span></div>
                  <div className="col"><span className="cl">Capital</span><span>{a.capital}</span></div>
                  <div className="col" style={{ textAlign: "right" }}><span className="cl">Trades</span><span>{a.trades}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* routing / venues */}
      <section className="sec" id="venues" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap route">
          <div className="rv">
            <span className="eyebrow">Routing &amp; custody</span>
            <h2 className="sec-title">Every order shops <span className="mint">the whole market.</span></h2>
            <p className="sec-sub">Auto compares live venues on every single trade and takes the best fill — adding new ones as they come online. Your keys, your funds; Canopy never touches them.</p>
          </div>
          <div className="venue-list rv">
            <div className="vrow auto"><div><div className="vn">Auto routing</div><div className="vk">Recommended · checked per trade</div></div><span /><span className="dep" /><span className="st-live">DEFAULT</span></div>
            <div className="vrow"><div><div className="vn">Jupiter</div><div className="vk">Aggregator</div></div><span>0.04%</span><span className="dep">$8.2M depth</span><span className="st-live">● LIVE</span></div>
            <div className="vrow"><div><div className="vn">Canopy</div><div className="vk">Native venue</div></div><span>0.02%</span><span className="dep">$4.6M depth</span><span className="st-live">● LIVE</span></div>
            <div className="vrow"><div><div className="vn">Aeonian</div><div className="vk">RWA DEX</div></div><span>—</span><span className="dep">integrating</span><span className="st-soon">SOON</span></div>
            <div className="vrow"><div><div className="vn">KalqiX</div><div className="vk">CLOB DEX</div></div><span>—</span><span className="dep">integrating</span><span className="st-soon">SOON</span></div>
            <div className="vrow"><div><div className="vn">edgeX</div><div className="vk">Spot &amp; perps</div></div><span>—</span><span className="dep">integrating</span><span className="st-soon">SOON</span></div>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section className="sec" id="pricing" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap">
          <div className="sec-head rv">
            <span className="eyebrow">Pricing</span>
            <h2 className="sec-title">Test for free. <span className="mint">Pay only when it&apos;s live.</span></h2>
            <p className="sec-sub">Paper agents are always free. You&apos;re billed per live agent — nothing more.</p>
          </div>
          <div className="price">
            <div className="plan rv">
              <div className="pn">Paper</div>
              <div className="amt">$0</div>
              <div className="note">Unlimited, forever.</div>
              <ul>
                <li>One <b>free agent slot</b> to start</li>
                <li>Full paper testing on <b>live venue data</b></li>
                <li>No capital at risk, no time limit</li>
                <li>Publish a paper track record</li>
              </ul>
              <button className="btn btn-ghost" style={{ width: "100%" }} onClick={onLogin}>Start building</button>
            </div>
            <div className="plan pro rv">
              <div className="pn">Live</div>
              <div className="amt">$20<small> /mo per agent</small></div>
              <div className="note" style={{ color: "var(--accent)" }}>$10 for the first month.</div>
              <ul>
                <li>Room for <b>up to 5 agents</b> — the unlock is permanent</li>
                <li><b>Non-custodial</b> execution, 24/7</li>
                <li>Best-price routing across every live venue</li>
                <li>Append-only activity log — every check recorded</li>
              </ul>
              <button className="btn btn-primary" style={{ width: "100%" }} onClick={onLogin}>Take an agent live</button>
            </div>
          </div>
        </div>
      </section>

      {/* final cta */}
      <section className="final">
        <div className="aurora" style={{ top: "auto", bottom: -160, WebkitMaskImage: "linear-gradient(transparent,#000 40%)", maskImage: "linear-gradient(transparent,#000 40%)" }}>
          <b className="b1" /><b className="b2" /><b className="b3" />
        </div>
        <div className="wrap">
          <div className="bigmark font-display lowercase rv">canopy</div>
          <h3 className="rv">The market&apos;s already open.</h3>
          <p className="rv">Most agents are paper-testing in under a minute. Build yours, prove it, and let it trade while you sleep.</p>
          <div className="hero-cta rv">
            <button className="btn btn-primary" onClick={onLogin}>Build your first agent <span className="arw">→</span></button>
            <a href="#market" className="btn btn-ghost">Browse the marketplace</a>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="foot-in">
            <div className="foot-logo font-display lowercase">canopy</div>
            <div className="foot-links">
              <a href="#market">Marketplace</a>
              <a href="#build">Build</a>
              <a href="#record">Track record</a>
              <a href="#pricing">Pricing</a>
              <a href="#venues">Venues</a>
            </div>
          </div>
          <p className="foot-fine">Canopy is non-custodial trading infrastructure for tokenized real-world assets and Solana spot markets. Agents execute against live venues routed for best price; strategy performance shown is illustrative wireframe data. Trading tokenized assets involves risk — paper test before you go live.</p>
        </div>
      </footer>
    </div>
  );
}
