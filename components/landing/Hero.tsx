"use client";

import { ArrowRight, Info } from "lucide-react";
import { useT } from "@/lib/i18n";
import { HeroDemo } from "./HeroDemo";
import { HeroOrbit } from "./HeroOrbit";

interface Props {
  onLogin: () => void;
}

/**
 * The first screen: who Canopy is, in one serif line and one sentence, then
 * a single button, then the product demonstrating itself. Nothing else — no
 * ticker, no photograph, no trust row. The demo panel is the only colour.
 */
export function Hero({ onLogin }: Props) {
  const t = useT();
  return (
    <header className="hero" id="top">
      <HeroOrbit />
      <div className="wrap">
        <h1 className="h1">{t("lp_hero_h1")}</h1>
        <p className="sub">{t("lp_hero_sub")}</p>
        <div className="cta">
          <button className="pill dark" onClick={onLogin}>
            {t("lp_hero_cta")}
            <ArrowRight aria-hidden />
          </button>
          <a href="#build" className="disc">
            <Info aria-hidden />
            {t("lp_hero_disclosure")}
          </a>
        </div>
        <HeroDemo />
      </div>
    </header>
  );
}
