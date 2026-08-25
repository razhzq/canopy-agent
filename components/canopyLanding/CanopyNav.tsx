"use client";

import { LanguageSwitcher } from "@/components/languageSwitcher";
import { useT } from "@/lib/i18n";

interface Props {
  onLogin: () => void;
}

export function CanopyNav({ onLogin }: Props) {
  const t = useT();

  return (
    <nav>
      <div className="wrap nav-in">
        <a href="#top" className="nav-logo font-display lowercase">
          canopy
        </a>
        <div className="nav-links">
          <a href="#market">{t("ld_nav_marketplace")}</a>
          <a href="#build">{t("ld_nav_build")}</a>
          <a href="#models">{t("ld_nav_models")}</a>
          <a href="#record">{t("ld_nav_record")}</a>
          <a href="#pricing">{t("ld_nav_pricing")}</a>
          {/* The switcher is on the landing page too, and it has to be: this
              is the first thing a visitor sees, and it is where someone who
              cannot read the English decides whether to keep reading. */}
          <LanguageSwitcher />
          <button className="nav-cta" onClick={onLogin}>
            {t("ld_nav_cta")}
          </button>
        </div>
      </div>
    </nav>
  );
}
