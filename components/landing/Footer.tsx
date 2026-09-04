"use client";

import { ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Props {
  onLogin: () => void;
}

/**
 * The closing: the wordmark, one last two-line claim, one sentence, and the
 * same primary pill and disclosure chip the hero opened with — so the page
 * ends where it began. Under a hairline, the footer row: wordmark, the four
 * nav links, then the fine print and the rights line in muted type.
 */
export function Footer({ onLogin }: Props) {
  const t = useT();
  const year = String(new Date().getFullYear());
  return (
    <>
      <section className="end">
        <div className="wrap">
          {/* eslint-disable-next-line @next/next/no-img-element -- static
              wordmark, sized by CSS */}
          <img className="mark" src="/canopy-wordmark.png" alt="canopy" />
          <h2 className="h2">
            {t("lp_end_h1")}
            <span>{t("lp_end_h2")}</span>
          </h2>
          <p className="lede">{t("lp_end_lede")}</p>
          <div className="cta">
            <button className="pill dark" onClick={onLogin}>
              {t("lp_end_cta")}
              <ArrowRight aria-hidden />
            </button>
            <a href="#market" className="disc">
              {t("lp_end_browse")}
            </a>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="foot-row">
            <a href="#top" className="logo" aria-label="Canopy">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/canopy-wordmark.png" alt="canopy" />
            </a>
            <nav className="foot-links" aria-label="Footer">
              <a href="#market">{t("ld_nav_marketplace")}</a>
              <a href="#build">{t("ld_nav_build")}</a>
              <a href="#models">{t("ld_nav_models")}</a>
              <a href="#pricing">{t("ld_nav_pricing")}</a>
            </nav>
          </div>
          <p className="foot-fine">{t("lp_foot_fine")}</p>
          <p className="foot-rights">{t("lp_foot_rights", { year })}</p>
        </div>
      </footer>
    </>
  );
}
