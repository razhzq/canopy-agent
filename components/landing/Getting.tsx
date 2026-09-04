"use client";

import { useT } from "@/lib/i18n";

/**
 * "What you're actually getting" — a dark bento. One feature cell (2×2)
 * holds the miniature of the watch strip an agent shows while it waits; four
 * single cells hold one title, one line and at most one mono figure each.
 * One gap, one radius, one border, one accent (the meter fill).
 */
export function Getting() {
  const t = useT();
  const cells = [
    { t: "lp_get_c1_t", p: "lp_get_c1_p", fig: "lp_get_c1_fig" },
    { t: "lp_get_c2_t", p: "lp_get_c2_p" },
    { t: "lp_get_c3_t", p: "lp_get_c3_p" },
    { t: "lp_get_c4_t", p: "lp_get_c4_p", fig: "lp_get_c4_fig", figLabel: "lp_get_c4_fig_label" },
  ] as const;

  return (
    <section className="getting dark" id="why">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow">{t("lp_get_eyebrow")}</span>
          <h2 className="h2">
            {t("lp_get_h1")}
            <span>{t("lp_get_h2")}</span>
          </h2>
        </div>

        <div className="bento">
          <div className="cell feature">
            <div className="watch">
              <div className="whead">
                <span className="wlabel">{t("lp_get_watch_label")}</span>
                <span className="wlive">
                  <i aria-hidden /> {t("lp_get_watch_live")}
                </span>
              </div>
              <div className="wrule">{t("lp_get_watch_rule")}</div>
              <div className="wmeter" aria-hidden>
                <i />
              </div>
              <div className="wscale">
                <span>{t("lp_get_watch_zero")}</span>
                <span>{t("lp_get_watch_now")}</span>
                <span className="fires">{t("lp_get_watch_fires")}</span>
              </div>
              <div className="wfoot">{t("lp_get_watch_foot")}</div>
            </div>
          </div>

          {cells.map((c) => (
            <div className="cell" key={c.t}>
              <h3>{t(c.t)}</h3>
              <p>{t(c.p)}</p>
              {"fig" in c && (
                <div className="fig">
                  {t(c.fig)}
                  {"figLabel" in c && <small>{t(c.figLabel)}</small>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
