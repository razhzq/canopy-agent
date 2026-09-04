"use client";

import { useT } from "@/lib/i18n";

/**
 * "Anywhere" — the product in a phone, beside three feature rows. The phone
 * is a plain CSS frame around a miniature of the real home screen: balance,
 * curve, range tabs, a couple of agent rows. The curve and the delta are the
 * section's one accent. The device says mobile so the copy never has to.
 */
export function Anywhere() {
  const t = useT();
  const rows = [
    { t: "lp_any_1_t", p: "lp_any_1_p" },
    { t: "lp_any_2_t", p: "lp_any_2_p" },
    { t: "lp_any_3_t", p: "lp_any_3_p" },
  ] as const;

  return (
    <section className="anywhere" id="app">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow">{t("lp_any_eyebrow")}</span>
          <h2 className="h2">
            {t("lp_any_h1")}
            <span>{t("lp_any_h2")}</span>
          </h2>
          <p className="lede">{t("lp_any_lede")}</p>
        </div>

        <div className="any">
          <div className="phone" aria-hidden>
            <div className="screen">
              <span className="stime">9:41</span>
              <span className="island" />
              <div className="shead">
                <b>{t("lp_any_home")}</b>
                <i>SL</i>
              </div>
              <div className="slabel">{t("lp_any_balance")}</div>
              <div className="sbal">
                <b>$24,193</b>
                <span>+47.3%</span>
              </div>
              <svg className="schart" viewBox="0 0 260 150" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lpAppFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#1FA97A" stopOpacity="0.18" />
                    <stop offset="1" stopColor="#1FA97A" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 120 L20 112 L40 118 L60 100 L80 107 L100 86 L120 93 L140 72 L160 79 L180 55 L200 62 L220 38 L240 28 L260 16 L260 150 L0 150 Z"
                  fill="url(#lpAppFill)"
                />
                <path
                  d="M0 120 L20 112 L40 118 L60 100 L80 107 L100 86 L120 93 L140 72 L160 79 L180 55 L200 62 L220 38 L240 28 L260 16"
                  fill="none"
                  stroke="#1FA97A"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
              <div className="stabs">
                <span>1D</span>
                <span>7D</span>
                <span>1M</span>
                <span className="on">1Y</span>
                <span>ALL</span>
              </div>
              <div className="srows">
                <div className="srow">
                  <span>SOL dip buyer</span>
                  <span>+12.4%</span>
                </div>
                <div className="srow">
                  <span>ETH funding long</span>
                  <span>+6.1%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="anyfeats">
            {rows.map((r) => (
              <div className="anyfeat" key={r.t}>
                <h3>{t(r.t)}</h3>
                <p>{t(r.p)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
