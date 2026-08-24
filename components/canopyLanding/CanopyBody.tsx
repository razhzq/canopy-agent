"use client";

import { useEffect, useRef } from "react";
import { AGENTS } from "./data";
import { drawSpark } from "./sparkline";
import { useLocale, type TranslationKey } from "@/lib/i18n";

interface Props {
  onLogin: () => void;
}

function fmt(n: number, dec: number) {
  return dec ? n.toFixed(dec) : Math.round(n).toLocaleString("en-US");
}

/** Each sample agent's badge, by the flag it carries. */
const FLAG_KEY: Record<NonNullable<import("./data").Agent["flag"]>, TranslationKey> = {
  hot: "ld_flag_hot",
  new: "ld_flag_new",
  paper: "ld_flag_paper",
};

export function CanopyBody({ onLogin }: Props) {
  const { t, locale } = useLocale();
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
          <span className="eyebrow center">{t("ld_stmt_eyebrow")}</span>
          <h2 className="sec-title">
            {t("ld_stmt_title_a")}
            <span className="mint">{t("ld_stmt_title_mint")}</span>
          </h2>
        </div>
      </section>
      <div className="stats" style={{ marginTop: 44 }}>
        <div className="wrap">
          <div className="stats-in">
            <div className="stat"><div className="k">{t("ld_stat_live_agents")}</div><div className="v tnum" data-count="318">0</div></div>
            <div className="stat"><div className="k">{t("ld_stat_capital")}</div><div className="v"><em>$</em><span className="tnum" data-count="4.2" data-dec="1">0</span><em>M</em></div></div>
            <div className="stat"><div className="k">{t("ld_stat_trades")}</div><div className="v tnum" data-count="281640">0</div></div>
            <div className="stat"><div className="k">{t("ld_stat_positions")}</div><div className="v tnum" data-count="204">0</div></div>
          </div>
        </div>
      </div>

      {/* bento */}
      <section className="sec" id="why">
        <div className="wrap">
          <div className="sec-head rv">
            <span className="eyebrow">{t("ld_why_eyebrow")}</span>
            <h2 className="sec-title">
              {t("ld_why_title_a")}
              <span className="mint">{t("ld_why_title_mint")}</span>
            </h2>
          </div>
          <div className="bento">
            <div className="cell feature tall rv">
              <span className="ck">{t("ld_bento_telemetry_k")}</span>
              <h4>{t("ld_bento_telemetry_h")}</h4>
              <p>{t("ld_bento_telemetry_p")}</p>
              <div className="grow" />
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-2)" }}>
                {t("ld_bento_telemetry_cond")}
              </div>
              <div className="mini-meter"><i /></div>
              <div className="mini-scale">
                <span>{t("ld_scale_zero")}</span>
                <span>{t("ld_scale_now", { pct: "1.8" })}</span>
                <span className="fire">{t("ld_scale_fires")}</span>
              </div>
              <div className="glowmesh" />
            </div>
            <div className="cell wide rv">
              <span className="ck">{t("ld_bento_alwayson_k")}</span>
              <h4>{t("ld_bento_alwayson_h")}</h4>
              <p>{t("ld_bento_alwayson_p")}</p>
              <div className="big-num tnum">24<em>/</em>7</div>
            </div>
            <div className="cell rv">
              <span className="ck">{t("ld_bento_keys_k")}</span>
              <h4>{t("ld_bento_keys_h")}</h4>
              <p>{t("ld_bento_keys_p")}</p>
            </div>
            <div className="cell rv">
              <span className="ck">{t("ld_bento_proof_k")}</span>
              <h4>{t("ld_bento_proof_h")}</h4>
              <p>{t("ld_bento_proof_p")}</p>
            </div>
            <div className="cell wide rv">
              <span className="ck">{t("ld_bento_exec_k")}</span>
              <h4>{t("ld_bento_exec_h")}</h4>
              <p>{t("ld_bento_exec_p")}</p>
              <div className="big-num tnum">
                0.02<em>%</em>{" "}
                <span style={{ fontSize: 14, color: "var(--text-3)", fontFamily: "var(--mono)" }}>
                  {t("ld_bento_exec_fee")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* build stepper */}
      <section className="sec" id="build" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap">
          <div className="sec-head rv">
            <span className="eyebrow">{t("ld_build_eyebrow")}</span>
            <h2 className="sec-title">
              {t("ld_build_title_a")}
              <span className="mint">{t("ld_build_title_mint")}</span>
            </h2>
            <p className="sec-sub">{t("ld_build_sub")}</p>
          </div>
          <div className="steps rv">
            <div className="draft">
              <i /> {t("ld_draft")}
            </div>
            <div className="steps-track">
              <div className="fstep">
                <div className="node">01</div>
                <h4>{t("ld_step1_h")}</h4>
                <p>{t("ld_step1_p")}</p>
                <span className="tag">AAPLx/USDC</span>
              </div>
              <div className="fstep">
                <div className="node">02</div>
                <h4>{t("ld_step2_h")}</h4>
                <p>{t("ld_step2_p")}</p>
                <span className="tag">
                  {t("ld_step2_tag")} <b>·</b> Canopy + Jupiter
                </span>
              </div>
              <div className="fstep">
                <div className="node">03</div>
                <h4>{t("ld_step3_h")}</h4>
                <p>{t("ld_step3_p")}</p>
                <span className="tag">
                  {t("ld_step3_tag_a")} <b>·</b> {t("ld_step3_tag_b")}
                </span>
              </div>
              <div className="fstep pending">
                <div className="node">04</div>
                <h4>{t("ld_step4_h")}</h4>
                <p>{t("ld_step4_p")}</p>
                <span className="tag">{t("ld_step4_tag")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* thesis */}
      <section className="sec" id="record" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap thesis">
          <div className="rv">
            <span className="eyebrow">{t("ld_thesis_eyebrow")}</span>
            <p className="quote" style={{ marginTop: 20 }}>
              {t("ld_thesis_q_a")}
              <span className="mint">{t("ld_thesis_q_public")}</span>
              <br />
              {t("ld_thesis_q_b")}
              <span className="mint">{t("ld_thesis_q_yours")}</span>
            </p>
            <p className="qsub">{t("ld_thesis_sub")}</p>
            <div className="hero-cta">
              <a href="#market" className="btn btn-ghost">
                {t("ld_thesis_cta")} <span className="arw">→</span>
              </a>
            </div>
          </div>
          <div className="record rv">
            <div className="rhead">
              <div className="lft" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="tkr-badge">AAPLx</span>
                <div>
                  <div className="agent-name" style={{ fontSize: 14 }}>
                    {t("ld_demo_agent")}
                  </div>
                  <div className="agent-sub">{t("ld_record_public_info")}</div>
                </div>
              </div>
              <span className="live-pill">
                <i className="dot" /> {t("ld_record_live_94d")}
              </span>
            </div>
            <div className="rec-grid">
              <div className="rec-cell"><div className="k">{t("ld_metric_return_30d")}</div><div className="v up">+24.1%</div></div>
              <div className="rec-cell"><div className="k">{t("ld_metric_win_rate")}</div><div className="v">64%</div></div>
              <div className="rec-cell"><div className="k">{t("ld_record_max_dd")}</div><div className="v down">−7.9%</div></div>
              <div className="rec-cell"><div className="k">{t("ld_record_uptime")}</div><div className="v">99.98%</div></div>
            </div>
            <div className="locked">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div>
                <div className="lk-t">{t("ld_locked_t")}</div>
                <div className="lk-s">{t("ld_locked_s")}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* assets */}
      <section className="sec" id="assets" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap">
          <div className="sec-head rv">
            <span className="eyebrow">{t("ld_assets_eyebrow")}</span>
            <h2 className="sec-title">
              {t("ld_assets_title_a")}
              <span className="mint">{t("ld_assets_title_mint")}</span>
            </h2>
            <p className="sec-sub">{t("ld_assets_sub")}</p>
          </div>
          <div className="classbar rv">
            {/* FIVE, because .classbar is `repeat(5,1fr)` — a fourth card leaves
                an empty column rather than re-flowing. The fifth used to be
                Treasuries, which had no tradable asset behind it; crypto splits
                cleanly in two instead, and the split is real — the universe
                already tiers tokens by whether an issuer vouches for them. */}
            {/* Every ticker below is a symbol, not a word — they stay as
                they are in both languages. Only the category and the line of
                description are translated. */}
            <div className="cls"><div className="ic">{t("ld_cls_equities")}</div><h5>{t("ld_cls_equities_h")}</h5><p>AAPLx · TSLAx<br />NVDAx · MSFTx</p></div>
            <div className="cls"><div className="ic">{t("ld_cls_indices")}</div><h5>{t("ld_cls_indices_h")}</h5><p>SPYx</p></div>
            <div className="cls"><div className="ic">{t("ld_cls_commodities")}</div><h5>{t("ld_cls_commodities_h")}</h5><p>PAXG · XAUt0<br />{t("ld_cls_commodities_p")}</p></div>
            <div className="cls"><div className="ic">{t("ld_cls_majors")}</div><h5>{t("ld_cls_majors_h")}</h5><p>SOL · JitoSOL<br />WBTC · ETH</p></div>
            <div className="cls"><div className="ic">{t("ld_cls_tail")}</div><h5>{t("ld_cls_tail_h")}</h5><p>BONK · JUP · WIF<br />{t("ld_cls_tail_p")}</p></div>
          </div>
        </div>
      </section>

      {/* marketplace */}
      <section className="sec" id="market" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap">
          <div className="sec-head rv">
            <span className="eyebrow">{t("ld_mkt_eyebrow")}</span>
            <h2 className="sec-title">
              {t("ld_mkt_title_a")}
              <span className="mint">{t("ld_mkt_title_mint")}</span>
            </h2>
            <p className="sec-sub">{t("ld_mkt_sub")}</p>
          </div>
          <div className="mkt">
            {AGENTS.map((a) => (
              <div className="acard rv" key={a.name}>
                <div className="acard-top">
                  <div>
                    <div className="nm">{locale === "zh" ? a.nameZh : a.name}</div>
                    <div className="mk">
                      {t("ld_agent_market", { pair: a.pair, days: a.days })}
                    </div>
                  </div>
                  {a.flag && <span className={`flag ${a.flag}`}>{t(FLAG_KEY[a.flag])}</span>}
                </div>
                <canvas height={44} data-seed={a.seed} data-up={a.up ? "1" : "0"} />
                <div className="acard-foot">
                  <div className="col"><span className="cl">{t("ld_col_return_30d")}</span><span className={a.up ? "up" : "down"}>{a.ret}</span></div>
                  <div className="col"><span className="cl">{t("ld_col_capital")}</span><span>{a.capital}</span></div>
                  <div className="col" style={{ textAlign: "right" }}><span className="cl">{t("ld_col_trades")}</span><span>{a.trades}</span></div>
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
            <span className="eyebrow">{t("ld_route_eyebrow")}</span>
            <h2 className="sec-title">
              {t("ld_route_title_a")}
              <span className="mint">{t("ld_route_title_mint")}</span>
            </h2>
            <p className="sec-sub">{t("ld_route_sub")}</p>
          </div>
          <div className="venue-list rv">
            {/* The venue names are brands. Everything beside them — what kind
                of venue it is, how deep it is, whether it is live — is not. */}
            <div className="vrow auto"><div><div className="vn">{t("ld_venue_auto")}</div><div className="vk">{t("ld_venue_auto_k")}</div></div><span /><span className="dep" /><span className="st-live">{t("ld_venue_default")}</span></div>
            <div className="vrow"><div><div className="vn">Jupiter</div><div className="vk">{t("ld_venue_aggregator")}</div></div><span>0.04%</span><span className="dep">{t("ld_venue_depth", { amount: "$8.2M" })}</span><span className="st-live">{t("ld_venue_live")}</span></div>
            <div className="vrow"><div><div className="vn">Canopy</div><div className="vk">{t("ld_venue_native")}</div></div><span>0.02%</span><span className="dep">{t("ld_venue_depth", { amount: "$4.6M" })}</span><span className="st-live">{t("ld_venue_live")}</span></div>
            <div className="vrow"><div><div className="vn">Aeonian</div><div className="vk">{t("ld_venue_rwa_dex")}</div></div><span>—</span><span className="dep">{t("ld_venue_integrating")}</span><span className="st-soon">{t("ld_venue_soon")}</span></div>
            <div className="vrow"><div><div className="vn">KalqiX</div><div className="vk">{t("ld_venue_clob_dex")}</div></div><span>—</span><span className="dep">{t("ld_venue_integrating")}</span><span className="st-soon">{t("ld_venue_soon")}</span></div>
            <div className="vrow"><div><div className="vn">edgeX</div><div className="vk">{t("ld_venue_spot_perps")}</div></div><span>—</span><span className="dep">{t("ld_venue_integrating")}</span><span className="st-soon">{t("ld_venue_soon")}</span></div>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section className="sec" id="pricing" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap">
          <div className="sec-head rv">
            <span className="eyebrow">{t("ld_pricing_eyebrow")}</span>
            <h2 className="sec-title">
              {t("ld_pricing_title_a")}
              <span className="mint">{t("ld_pricing_title_mint")}</span>
            </h2>
            <p className="sec-sub">{t("ld_pricing_sub")}</p>
          </div>
          <div className="price">
            <div className="plan rv">
              <div className="pn">{t("ld_plan_paper")}</div>
              <div className="amt">$0</div>
              <div className="note">{t("ld_plan_paper_note")}</div>
              {/* The <b> runs inside these bullets are gone: each wrapped a
                  phrase that moves within its sentence in Chinese. */}
              <ul>
                <li>{t("ld_plan_paper_1")}</li>
                <li>{t("ld_plan_paper_2")}</li>
                <li>{t("ld_plan_paper_3")}</li>
                <li>{t("ld_plan_paper_4")}</li>
              </ul>
              <button className="btn btn-ghost" style={{ width: "100%" }} onClick={onLogin}>
                {t("ld_plan_paper_cta")}
              </button>
            </div>
            <div className="plan pro rv">
              <div className="pn">{t("ld_plan_live")}</div>
              <div className="amt">
                {t("ld_plan_live_amt")}
                <small>{t("ld_plan_live_per")}</small>
              </div>
              <div className="note" style={{ color: "var(--accent)" }}>
                {t("ld_plan_live_note")}
              </div>
              <ul>
                <li>{t("ld_plan_live_1")}</li>
                <li>{t("ld_plan_live_2")}</li>
                <li>{t("ld_plan_live_3")}</li>
                <li>{t("ld_plan_live_4")}</li>
              </ul>
              <button className="btn btn-primary" style={{ width: "100%" }} onClick={onLogin}>
                {t("ld_plan_live_cta")}
              </button>
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
          <h3 className="rv">{t("ld_final_h")}</h3>
          <p className="rv">{t("ld_final_p")}</p>
          <div className="hero-cta rv">
            <button className="btn btn-primary" onClick={onLogin}>
              {t("ld_hero_cta")} <span className="arw">→</span>
            </button>
            <a href="#market" className="btn btn-ghost">
              {t("ld_hero_browse")}
            </a>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="foot-in">
            <div className="foot-logo font-display lowercase">canopy</div>
            <div className="foot-links">
              <a href="#market">{t("ld_nav_marketplace")}</a>
              <a href="#build">{t("ld_nav_build")}</a>
              <a href="#record">{t("ld_nav_record")}</a>
              <a href="#pricing">{t("ld_nav_pricing")}</a>
              <a href="#venues">{t("ld_nav_venues")}</a>
            </div>
          </div>
          <p className="foot-fine">{t("ld_foot_fine")}</p>
        </div>
      </footer>
    </div>
  );
}
