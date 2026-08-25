import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notificationsPage";
import { PageHeader } from "@/components/pageHeader";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerT())("page_title_notifications") };
}

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
      <PageHeader
        eyebrowKey="page_eyebrow_account"
        titleKey="notifications_page_title"
        bodyKey="notifications_page_body"
      />
      <NotificationsPage />
    </main>
  );
}
