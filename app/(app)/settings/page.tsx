import type { Metadata } from "next";
import { NotificationSettings } from "@/components/notifications";
import { BillingSettings } from "@/components/billing";
import { SettingsHeader } from "@/components/settingsHeader";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerT())("page_title_settings") };
}

/**
 * Account settings.
 *
 * Given its own route rather than a panel inside the account dropdown because
 * both sections are read-then-decide flows — what Telegram will and will not
 * send, what a plan does and does not buy — and neither belongs in a menu that
 * closes when you click past it.
 *
 * Plan comes first. It is the section people arrive here having been sent to,
 * usually by a paywall they just hit.
 */
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[720px] px-6 py-14">
      <SettingsHeader />

      <div className="space-y-16">
        <BillingSettings />
        <NotificationSettings />
      </div>
    </div>
  );
}
