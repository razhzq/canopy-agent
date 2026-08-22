import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notificationsPage";

export const metadata: Metadata = {
  title: "Notifications · Canopy",
};

/**
 * Notifications, with a route of their own.
 *
 * The bell's dropdown stays on desktop. This exists because on a phone the
 * centre is a place you go rather than a panel you peek at — and because an
 * approval needs room for its diff and its buttons, which a 380px dropdown
 * pinned to the top-right corner does not have.
 */
export default function NotificationsRoute() {
  return (
    <main>
      <section className="space-y-2 border-b border-grid px-5 pt-6 pb-5 sm:px-8">
        <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">Account</p>
        <h1 className="font-mono text-[24px] leading-none text-text-primary sm:text-[30px]">
          Notifications
        </h1>
        <p className="font-ui text-[13.5px] text-text-secondary">
          What your agents did, and what they need from you.
        </p>
      </section>
      <NotificationsPage />
    </main>
  );
}
