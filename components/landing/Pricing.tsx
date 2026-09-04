"use client";

import { Check } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Props {
  onLogin: () => void;
}

/**
 * Pricing — a split card, one plan per half. Each half: plan name, mono
 * price, a note, four hairline rows, and one pill. The Live half's
 * first-month note is the section's one accent; the Live button is the
 * primary and the Paper button is the light pill.
 */
export function Pricing({ onLogin }: Props) {
  const t = useT();
  const paper = ["lp_price_paper_1", "lp_price_paper_2", "lp_price_paper_3", "lp_price_paper_4"] as const;
  const live = ["lp_price_live_1", "lp_price_live_2", "lp_price_live_3", "lp_price_live_4"] as const;

  return (
    <section className="pricing" id="pricing">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow">{t("lp_price_eyebrow")}</span>
          <h2 className="h2">
            {t("lp_price_h1")}
            <span>{t("lp_price_h2")}</span>
          </h2>
          <p className="lede">{t("lp_price_lede")}</p>
        </div>

        <div className="split">
          <div className="half plan">
            <h3>{t("lp_price_paper")}</h3>
            <div className="amt">{t("lp_price_paper_amt")}</div>
            <div className="note">{t("lp_price_paper_note")}</div>
            <ul>
              {paper.map((k) => (
                <li key={k}>
                  <Check aria-hidden />
                  {t(k)}
                </li>
              ))}
            </ul>
            <button className="pill light" onClick={onLogin}>
              {t("lp_price_paper_cta")}
            </button>
          </div>

          <div className="half plan">
            <h3>{t("lp_price_live")}</h3>
            <div className="amt">
              {t("lp_price_live_amt")}
              <small>{t("lp_price_live_per")}</small>
            </div>
            <div className="note deal">{t("lp_price_live_note")}</div>
            <ul>
              {live.map((k) => (
                <li key={k}>
                  <Check aria-hidden />
                  {t(k)}
                </li>
              ))}
            </ul>
            <button className="pill dark" onClick={onLogin}>
              {t("lp_price_live_cta")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
