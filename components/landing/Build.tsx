"use client";

import { useT } from "@/lib/i18n";

/**
 * The build — four steps in a dark panel. The panel reuses the hero demo's
 * grammar (a chip top-left, dark cards, 1px connectors with white terminals,
 * a green fade at the foot) so the two read as the same product. Each step
 * is one card: number, title, one line, and the real chip that screen shows.
 * The current step carries the section's one accent; the step not yet
 * reached is dashed and dimmed, and so is the connector into it.
 */
export function Build() {
  const t = useT();
  const steps = [
    { n: "01", t: "lp_build_s1_t", p: "lp_build_s1_p", chip: "AAPLx/USDC" },
    { n: "02", t: "lp_build_s2_t", p: "lp_build_s2_p", chip: t("lp_build_s2_chip") },
    { n: "03", t: "lp_build_s3_t", p: "lp_build_s3_p", chip: t("lp_build_s3_chip"), now: true },
    { n: "04", t: "lp_build_s4_t", p: "lp_build_s4_p", chip: t("lp_build_s4_chip"), todo: true },
  ] as const;

  return (
    <section className="build" id="build">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow">{t("lp_build_eyebrow")}</span>
          <h2 className="h2">
            {t("lp_build_h1")}
            <span>{t("lp_build_h2")}</span>
          </h2>
          <p className="lede">{t("lp_build_lede")}</p>
        </div>

        <div className="stage">
          <div className="tabs">
            <i aria-hidden />
            <span>{t("lp_build_draft")}</span>
          </div>
          <div className="steps">
            {/* The dashed S-curve behind the cards: low on the left, rising to
                the right, so the journey reads as climbing. Decorative, and
                hidden on the stacked layout. */}
            <svg className="curve" viewBox="0 0 1140 320" preserveAspectRatio="none" aria-hidden>
              <path
                d="M0 262 C 70 262, 70 215, 142 215 C 284 215, 284 178, 427 178 C 570 178, 570 142, 712 142 C 855 142, 855 105, 997 105 C 1068 105, 1068 58, 1140 58"
                fill="none"
                stroke="rgba(94,211,179,.45)"
                strokeWidth="1.4"
                strokeDasharray="3 6"
              />
            </svg>
            {steps.map((s) => (
              <div key={s.n} className={`step${"now" in s ? " now" : ""}${"todo" in s ? " todo" : ""}`}>
                  <div className="card">
                    <span className="n">{s.n}</span>
                    <h3>{t(s.t)}</h3>
                    <p>{t(s.p)}</p>
                    {"now" in s && (
                      <span className="now">
                        <i aria-hidden /> {t("lp_build_s3_now")}
                      </span>
                    )}
                    <div className="schip">
                      <span>{s.chip}</span>
                    </div>
                  </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
