"use client";

import { LanguageSwitcher } from "@/components/languageSwitcher";
import { useT } from "@/lib/i18n";

interface Props {
  onLogin: () => void;
}

/**
 * Public.com's nav, one to one: wordmark left, links centred, two pills on
 * the right. Both pills go through the same login handler — Privy decides
 * whether that is a sign-in or a sign-up.
 */
export function Nav({ onLogin }: Props) {
  const t = useT();
  return (
    <nav className="top">
      <div className="wrap nav-in">
        <a href="#top" className="logo" aria-label="Canopy">
          {/* eslint-disable-next-line @next/next/no-img-element -- static
              wordmark, sized by CSS; no need for next/image here */}
          <img src="/canopy-wordmark.png" alt="canopy" />
        </a>
        <div className="links">
          <a href="#market">{t("ld_nav_marketplace")}</a>
          <a href="#build">{t("ld_nav_build")}</a>
          <a href="#models">{t("ld_nav_models")}</a>
          <a href="#pricing">{t("ld_nav_pricing")}</a>
        </div>
        <div className="nav-right">
          <LanguageSwitcher />
          <button className="pill dark" onClick={onLogin}>
            {t("lp_nav_login")}
          </button>
          <button className="pill light" onClick={onLogin}>
            {t("lp_nav_signup")}
          </button>
        </div>
      </div>
    </nav>
  );
}
