import type { Metadata } from "next";
import { NotificationSettings } from "@/components/notifications";

export const metadata: Metadata = {
  title: "Settings · Canopy",
};

/**
 * Account settings.
 *
 * One section today. Given its own route rather than a panel inside the account
 * dropdown because connecting Telegram is a read-then-decide flow — four
 * paragraphs of what will and will not be sent — and that does not belong in a
 * menu that closes when you click past it.
 */
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[720px] px-6 py-14">
      <div className="space-y-2 pb-12">
        <h1 className="font-mono text-[20px] tracking-[0.04em] text-text-primary">
          Settings
        </h1>
        <p className="font-ui text-[13px] text-text-secondary">
          How Canopy reaches you about your agents.
        </p>
      </div>

      <NotificationSettings />
    </div>
  );
}
