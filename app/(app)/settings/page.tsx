import type { Metadata } from "next";
import { NotificationSettings } from "@/components/notifications";
import { BillingSettings } from "@/components/billing";

export const metadata: Metadata = {
  title: "Settings · Canopy",
};

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
      <div className="space-y-2 pb-12">
        <h1 className="font-mono text-[20px] tracking-[0.04em] text-text-primary">
          Settings
        </h1>
        <p className="font-ui text-[13px] text-text-secondary">
          What your plan allows, and how Canopy reaches you about your agents.
        </p>
      </div>

      <div className="space-y-16">
        <BillingSettings />
        <NotificationSettings />
      </div>
    </div>
  );
}
