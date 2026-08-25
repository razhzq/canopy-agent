"use client";

import { useT } from "@/lib/i18n";

/**
 * The settings page's own title block.
 *
 * Not `PageHeader`: settings is a 720px reading column rather than a full-bleed
 * route, so it has no eyebrow and its title is set smaller. Sharing the
 * component would mean giving that one two shapes to serve two callers.
 */
export function SettingsHeader() {
  const t = useT();
  return (
    <div className="space-y-2 pb-12">
      <h1 className="font-mono text-[20px] tracking-[0.04em] text-text-primary">
        {t("settings_title")}
      </h1>
      <p className="font-ui text-[13px] text-text-secondary">{t("settings_body")}</p>
    </div>
  );
}
