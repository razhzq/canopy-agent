import type { Metadata } from "next";
import { ActivityFeed } from "@/components/activityFeed";
import { PageHeader } from "@/components/pageHeader";
import { getServerT } from "@/lib/i18n/server";

// A function rather than a constant, because the title has to be looked up in
// the reader's language and that lives in a cookie. See lib/i18n/server.
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerT())("page_title_activity") };
}

/**
 * Every cycle your agents have run, newest first.
 *
 * Deliberately account-wide where the rest of the app is agent-at-a-time: the
 * question "what have they been doing" is not one you should have to ask six
 * times. It is assembled client-side from each agent's own log — there is no
 * account-wide endpoint — which is why it is capped per agent rather than
 * paginated.
 */
export default function ActivityPage() {
  return (
    <main>
      <PageHeader
        eyebrowKey="page_eyebrow_portfolio"
        titleKey="activity_page_title"
        bodyKey="activity_page_body"
      />
      <ActivityFeed />
    </main>
  );
}
