"use client";

import { Breadcrumb } from "@/components/breadcrumb";
import { useT } from "@/lib/i18n";

/**
 * The banner over an agent's cycle list.
 *
 * Not `PageHeader`: this one carries a breadcrumb instead of an eyebrow,
 * because it is three levels deep and the trail back up is the thing the eye
 * needs there. Its own component so the route stays a server component.
 */
export function CyclesHeader({ agentId }: { agentId: number }) {
  const t = useT();

  return (
    <section className="space-y-3 border-b border-grid px-8 pt-6 pb-6">
      <Breadcrumb
        parts={[
          { label: t("cycles_crumb_portfolio"), href: "/portfolio" },
          { label: t("cycles_crumb_agent", { id: agentId }), href: `/portfolio/${agentId}` },
          t("cycles_crumb_cycles"),
        ]}
      />
      <h1 className="font-mono text-[30px] leading-none text-text-primary">
        {t("cycles_page_title")}
      </h1>
      <p className="font-ui text-[14px] text-text-secondary">{t("cycles_page_body")}</p>
    </section>
  );
}
