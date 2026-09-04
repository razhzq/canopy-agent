"use client";

import { ArrowUp } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * "Two ways to get started" — Public's split card, one to one. A centred
 * two-line title (second line muted), then one bordered container cut in two
 * by a single vertical hairline. Each half: title → preview well → body.
 *
 * The wells hold miniatures of the two real entry points — the build prompt
 * and a marketplace card — drawn in CSS so they stay crisp and translate.
 */
export function TwoWays() {
  const t = useT();
  return (
    <section className="ways" id="build">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow">{t("lp_ways_eyebrow")}</span>
          <h2 className="h2">
            {t("lp_ways_h1")}
            <span>{t("lp_ways_h2")}</span>
          </h2>
        </div>

        <div className="split">
          <div className="half">
            <h3>{t("lp_ways_prompt_t")}</h3>
            <div className="well">
              <div className="seg">
                <span className="on">{t("lp_ways_mock_research")}</span>
                <span>{t("lp_ways_mock_build")}</span>
              </div>
              <div className="ask">
                <span className="ph">{t("lp_ways_mock_placeholder")}</span>
                <i aria-hidden>
                  <ArrowUp />
                </i>
              </div>
            </div>
            <p>{t("lp_ways_prompt_p")}</p>
          </div>

          <div className="half">
            <h3>{t("lp_ways_fork_t")}</h3>
            <div className="well">
              <div className="cats">
                <span className="on">{t("lp_ways_cat_defi")}</span>
                <span>{t("lp_ways_cat_memes")}</span>
                <span>{t("lp_ways_cat_lp")}</span>
                <span>{t("lp_ways_cat_perps")}</span>
              </div>
              <div className="stack">
                <div className="mcard top">
                  <div className="mhead">
                    <b>{t("lp_ways_mock_agent_name")}</b>
                    <div className="tags">
                      <span>{t("lp_ways_cat_defi")}</span>
                      <span>SOL</span>
                    </div>
                  </div>
                  <svg className="mspark" viewBox="0 0 320 44" preserveAspectRatio="none" aria-hidden>
                    <polyline
                      points="0,34 24,30 48,32 72,26 96,28 120,22 144,24 168,18 192,20 216,14 240,16 264,10 288,12 320,6"
                      fill="none"
                      stroke="#1FA97A"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="mstats">
                    <div>
                      <small>{t("lp_ways_mock_return")}</small>
                      <span className="up">+12.4%</span>
                    </div>
                    <div>
                      <small>{t("lp_ways_mock_capital")}</small>
                      <span>$8,200</span>
                    </div>
                    <div>
                      <small>{t("lp_ways_mock_volume")}</small>
                      <span>$41.6K</span>
                    </div>
                    <div>
                      <small>{t("lp_ways_mock_trades")}</small>
                      <span>27</span>
                    </div>
                  </div>
                </div>
                <div className="mcard ghost g1">
                  <b>{t("lp_ways_mock_agent2_name")}</b>
                </div>
                <div className="mcard ghost g2">
                  <b>{t("lp_ways_mock_agent3_name")}</b>
                </div>
              </div>
            </div>
            <p>{t("lp_ways_fork_p")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
