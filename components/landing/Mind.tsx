"use client";

import { useT } from "@/lib/i18n";

/**
 * "The mind behind the agent" — a split card, the same shape as "two ways".
 * Left: the hosted default, shown as the model row the picker actually
 * renders, selected, with its Included pill (the section's one accent).
 * Right: bring your own, shown as the marketplace rows with a mono price per
 * million tokens and the ceiling field beneath.
 *
 * Model names are product identifiers and are never translated.
 */
const BYO = [
  { name: "DeepSeek-V3", price: "$0.27" },
  { name: "Llama 3.3 70B", price: "$0.12" },
  { name: "GLM-4.6", price: "$0.35" },
  { name: "Kimi K2", price: "$0.60" },
];

export function Mind() {
  const t = useT();
  return (
    <section className="mind" id="models">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow">{t("lp_mind_eyebrow")}</span>
          <h2 className="h2">
            {t("lp_mind_h1")}
            <span>{t("lp_mind_h2")}</span>
          </h2>
        </div>

        <div className="split">
          <div className="half">
            <h3>{t("lp_mind_host_t")}</h3>
            <div className="well">
              <div className="mlist">
                <div className="mrow on">
                  <i className="radio on" aria-hidden />
                  <div className="mname">
                    <b>cQWEN3</b>
                    <small>{t("lp_mind_host_sub")}</small>
                  </div>
                  <span className="inc">{t("lp_mind_included")}</span>
                </div>
                <div className="mrow ghost">
                  <i className="radio" aria-hidden />
                  <div className="mname">
                    <b>DeepSeek-V3</b>
                  </div>
                  <span className="mono">$0.27 <em>{t("lp_mind_per_m")}</em></span>
                </div>
                <div className="mrow ghost">
                  <i className="radio" aria-hidden />
                  <div className="mname">
                    <b>Llama 3.3 70B</b>
                  </div>
                  <span className="mono">$0.12 <em>{t("lp_mind_per_m")}</em></span>
                </div>
              </div>
            </div>
            <p>{t("lp_mind_host_p")}</p>
          </div>

          <div className="half">
            <h3>{t("lp_mind_byo_t")}</h3>
            <div className="well">
              <div className="mlist">
                <div className="ceiling">
                  <span>{t("lp_mind_ceiling")}</span>
                  <span className="mono">$1.00 <em>{t("lp_mind_per_m")}</em></span>
                </div>
                {BYO.map((m) => (
                  <div className="mrow" key={m.name}>
                    <div className="mname">
                      <b>{m.name}</b>
                    </div>
                    <span className="mono">{m.price} <em>{t("lp_mind_per_m")}</em></span>
                  </div>
                ))}
                <div className="mrow more">{t("lp_mind_more")}</div>
              </div>
            </div>
            <p>{t("lp_mind_byo_p")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
